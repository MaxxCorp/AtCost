import { command, requested } from '$app/server';
import { db, inArray, eq } from '@ac/db';
import { contract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { listContracts, readTalentEffectiveContract } from './list.remote';

export const deleteContract = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    if (ids.length === 0) return { success: true };

    const contractsToDelete = await db.select({ talentId: contract.talentId }).from(contract).where(inArray(contract.id, ids));
    const talentIds = Array.from(new Set(contractsToDelete.map(c => c.talentId)));

    await db.delete(contract).where(inArray(contract.id, ids));

    try {
        await requested(listContracts, 20).refreshAll();
    } catch { /* ignore */ }
    try {
        await requested(readTalentEffectiveContract, 20).refreshAll();
    } catch { /* ignore */ }
    void listContracts().refresh();
    void listContracts({}).refresh();
    for (const tId of talentIds) {
        void readTalentEffectiveContract({ talentId: tId }).refresh();
    }

    return { success: true };
});
