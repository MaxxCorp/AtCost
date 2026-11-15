import { query, command, requested } from '$app/server';
import { gdprFilterSchema, executeObfuscationSchema } from '@ac/validations';
import { listGdprRequests as listRequestsFromDb, obfuscateContact } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { ensureGoalsTablesAndSeed } from '#lib/server/goals/service.js';
import { listContacts } from '../list.remote';
import { listGoalCampaigns, getShowcaseCampaigns } from '../../goals/list.remote';

export const listGdprRequests = query(gdprFilterSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');
    await ensureGoalsTablesAndSeed();

    return await listRequestsFromDb(input || {});
});

export const executeGdprObfuscation = command(executeObfuscationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const res = await obfuscateContact(input.contactId, user.id, input.notes);

    try {
        await requested(listGdprRequests, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGdprRequests({}).refresh();
    void listGdprRequests({ status: 'all' }).refresh();

    try {
        await requested(listContacts, 20).refreshAll();
    } catch {
        // ignore
    }
    void listContacts().refresh();
    void listContacts({}).refresh();

    try {
        await requested(listGoalCampaigns, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGoalCampaigns().refresh();
    void listGoalCampaigns({}).refresh();
    void getShowcaseCampaigns().refresh();
    void getShowcaseCampaigns({}).refresh();

    return res;
});
