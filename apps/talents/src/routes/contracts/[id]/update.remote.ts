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

    const [updatedContract] = await db.update(contract)
        .set({
            ...updateData,
            parentContractId: updateData.parentContractId || null,
            startDate: new Date(updateData.startDate),
            endDate: updateData.endDate ? new Date(updateData.endDate) : null,
            nextStufenaufstiegDate: updateData.nextStufenaufstiegDate ? new Date(updateData.nextStufenaufstiegDate) : null,
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
