import { command, requested } from '$app/server';
import { renameBlockSchema } from '#lib/validations/cms.js';
import { renameBlock } from '#lib/server/cms/operations.js';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { readContent } from './read.remote';
import { listBlocksFunction } from './list.remote';

export const renameBlockFunction = command(renameBlockSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = user.roles as string[] || [];
    if (!roles.includes('admin')) throw new Error('Forbidden');

    await renameBlock(data.blockId, data.newName);

    try {
        await requested(readContent, 20).refreshAll();
    } catch { /* ignore */ }
    void readContent({}).refresh();
    void listBlocksFunction().refresh();

    return { success: true };
});
