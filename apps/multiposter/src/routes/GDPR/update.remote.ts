import { command, requested } from '$app/server';
import { updateContentSchema } from '#lib/validations/cms.js';
import { saveContent } from '#lib/server/cms/operations.js';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { readContent } from './read.remote';

export const updateContent = command(updateContentSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = user.roles as string[] || [];
    if (!roles.includes('admin')) throw new Error('Forbidden');

    const saved = await saveContent(data.blockId, data.language, data.branch, data.content, user.id);

    try {
        await requested(readContent, 20).refreshAll();
    } catch { /* ignore */ }
    void readContent({}).refresh();

    return { success: true, version: saved };
});
