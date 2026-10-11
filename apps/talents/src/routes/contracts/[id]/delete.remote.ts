import { command } from '$app/server';
import { db, eq } from '@ac/db';
import { contract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { listContracts, readTalentEffectiveContract } from '../list.remote';

export const deleteContract = command(v.object({ id: v.string() }), async ({ id }: { id: string }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const [c] = await db.select({ talentId: contract.talentId }).from(contract).where(eq(contract.id, id));
    await db.delete(contract).where(eq(contract.id, id));
    await listContracts().refresh();
    if (c?.talentId) {
        await readTalentEffectiveContract({ talentId: c.talentId }).refresh();
    }

    return { success: true };
});
