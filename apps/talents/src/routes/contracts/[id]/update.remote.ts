import { form, requested } from '$app/server';
import { db, eq } from '@ac/db';
import { contract, contractFrameworkContract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { updateContractSchema } from '@ac/validations/contracts';
import { listContracts, readTalentEffectiveContract } from '../list.remote';
import { readContract } from './read.remote';

export const updateContract = form(updateContractSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const updateData: any = { ...data };
    const contractId: string = updateData.id;
    const frameworkIds: string[] = Array.isArray(updateData.frameworkIds) ? updateData.frameworkIds : [];
    delete updateData.frameworkIds;
    delete updateData.id;

    const startDate = new Date(updateData.startDate);
    let nextStufenaufstiegDate = updateData.nextStufenaufstiegDate ? new Date(updateData.nextStufenaufstiegDate) : null;
    let stufenlaufzeitMonths = updateData.stufenlaufzeitMonths;

    if (!nextStufenaufstiegDate && updateData.erfahrungsstufe && updateData.erfahrungsstufe < 6) {
        const schedule: Record<number, number> = { 1: 12, 2: 24, 3: 36, 4: 48, 5: 60 };
        stufenlaufzeitMonths = stufenlaufzeitMonths || schedule[updateData.erfahrungsstufe] || 12;
        const target = new Date(startDate);
        target.setMonth(target.getMonth() + stufenlaufzeitMonths);
        nextStufenaufstiegDate = target;
    }

    const [updatedContract] = await db.update(contract)
        .set({
            ...updateData,
            parentContractId: updateData.parentContractId || null,
            startDate,
            endDate: updateData.endDate ? new Date(updateData.endDate) : null,
            stufenlaufzeitMonths,
            nextStufenaufstiegDate,
        } as any)
        .where(eq(contract.id, contractId))
        .returning();

    // Sync junction entries
    await db.delete(contractFrameworkContract).where(eq(contractFrameworkContract.contractId, contractId));
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId, frameworkId: f }));
        await db.insert(contractFrameworkContract).values(mappings);
    }

    try {
        await requested(listContracts, 20).refreshAll();
    } catch { /* ignore */ }
    try {
        await requested(readTalentEffectiveContract, 20).refreshAll();
    } catch { /* ignore */ }
    void listContracts().refresh();
    void listContracts({}).refresh();
    void readTalentEffectiveContract({ talentId: updatedContract.talentId }).refresh();
    await readContract({ id: contractId }).set({
        ...updatedContract,
        frameworkIds,
        startDate: updatedContract.startDate.toISOString(),
        endDate: updatedContract.endDate ? updatedContract.endDate.toISOString() : undefined,
        nextStufenaufstiegDate: updatedContract.nextStufenaufstiegDate ? updatedContract.nextStufenaufstiegDate.toISOString() : undefined,
        createdAt: updatedContract.createdAt.toISOString(),
        updatedAt: updatedContract.updatedAt.toISOString(),
        frameworks: frameworkIds.map((f: string) => ({ contractId, frameworkId: f }))
    } as any);

    return { success: true, contract: updatedContract };
});
