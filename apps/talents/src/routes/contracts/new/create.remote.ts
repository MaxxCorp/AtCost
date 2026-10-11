import { form, requested } from '$app/server';
import { db } from '@ac/db';
import { contract, contractFrameworkContract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { contractSchema } from '@ac/validations/contracts';
import { listContracts, readTalentEffectiveContract } from '../list.remote';

export const createContract = form(contractSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const insertData: any = { ...data };
    const frameworkIds: string[] = Array.isArray(insertData.frameworkIds) ? insertData.frameworkIds : [];
    const startDate = new Date(insertData.startDate);
    let nextStufenaufstiegDate = insertData.nextStufenaufstiegDate ? new Date(insertData.nextStufenaufstiegDate) : null;
    let stufenlaufzeitMonths = insertData.stufenlaufzeitMonths;

    if (!nextStufenaufstiegDate && insertData.erfahrungsstufe && insertData.erfahrungsstufe < 6) {
        const schedule: Record<number, number> = { 1: 12, 2: 24, 3: 36, 4: 48, 5: 60 };
        stufenlaufzeitMonths = stufenlaufzeitMonths || schedule[insertData.erfahrungsstufe] || 12;
        const target = new Date(startDate);
        target.setMonth(target.getMonth() + stufenlaufzeitMonths);
        nextStufenaufstiegDate = target;
    }

    const [newContract] = await db.insert(contract).values({
        ...insertData,
        parentContractId: insertData.parentContractId || null,
        startDate,
        endDate: insertData.endDate ? new Date(insertData.endDate) : null,
        stufenlaufzeitMonths,
        nextStufenaufstiegDate,
    } as any).returning();

    // Create single-flight junction entries
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId: newContract.id, frameworkId: f }));
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
    void readTalentEffectiveContract({ talentId: newContract.talentId }).refresh();

    return { success: true, id: newContract.id, contract: newContract };
});
