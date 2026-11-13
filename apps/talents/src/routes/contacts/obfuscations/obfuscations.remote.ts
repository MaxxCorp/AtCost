import { query, command, requested } from '$app/server';
import { gdprFilterSchema, executeObfuscationSchema } from '@ac/validations';
import { db, talent, eq, listGdprRequests as listGdprRequestsDb, obfuscateContact } from '@ac/db';
import { getAuthenticatedUser, parseRoles } from '#lib/server/authorization.js';
import { invalidateContact, invalidateTalent } from '#lib/server/cache/index.js';
import { listContacts } from '../list.remote.js';
import { readContact } from '../[id]/read.remote.js';
import { listTalents } from '../../talents/list.remote.js';
import { readTalent } from '../../talents/[id]/read.remote.js';
import { listTasks, listCompletedTasks } from '../../tasks.remote.js';
import * as v from 'valibot';

export const listGdprRequests = query(v.optional(gdprFilterSchema), async (input) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins and HR Management can access GDPR obfuscations.');
    }

    return await listGdprRequestsDb(input || {});
});

export const executeGdprObfuscation = command(executeObfuscationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins and HR Management can execute GDPR obfuscation.');
    }

    const result = await obfuscateContact(data.contactId, user.id, data.notes);

    await invalidateContact(data.contactId);
    const linkedTalents = await db
        .select({ id: talent.id })
        .from(talent)
        .where(eq(talent.contactId, data.contactId));
    if (linkedTalents.length > 0) {
        await invalidateTalent(linkedTalents.map((t) => t.id));
        for (const t of linkedTalents) {
            void readTalent(t.id).refresh();
        }
    }

    try {
        await requested(listGdprRequests, 20).refreshAll();
        await requested(listContacts, 20).refreshAll();
        await requested(listTalents, 20).refreshAll();
        await requested(listTasks, 20).refreshAll();
        await requested(listCompletedTasks, 20).refreshAll();
    } catch { /* ignore */ }

    void readContact(data.contactId).refresh();
    void listContacts().refresh();
    void listContacts({}).refresh();
    void listTalents().refresh();
    void listTalents({}).refresh();
    void listGdprRequests().refresh();
    void listGdprRequests({}).refresh();
    void listGdprRequests({ status: 'all' }).refresh();
    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return result;
});
