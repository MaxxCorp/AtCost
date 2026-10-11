import { form } from '$app/server';
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
    delete insertData.frameworkIds;

    const [newContract] = await db.insert(contract).values({
        ...insertData,
        parentContractId: insertData.parentContractId || null,
        startDate: new Date(insertData.startDate),
        endDate: insertData.endDate ? new Date(insertData.endDate) : null,
        nextStufenaufstiegDate: insertData.nextStufenaufstiegDate ? new Date(insertData.nextStufenaufstiegDate) : null,
    } as any).returning();

    // Create single-flight junction entries
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId: newContract.id, frameworkId: f }));
        await db.insert(contractFrameworkContract).values(mappings);
    }

    await listContracts().refresh();
    await readTalentEffectiveContract({ talentId: newContract.talentId }).refresh();
    return { success: true, id: newContract.id, contract: newContract };
});
