import { command, requested } from '$app/server';
import { deleteBlockSchema } from '#lib/validations/cms.js';
import { deleteBlock } from '#lib/server/cms/operations.js';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { readContent } from './read.remote';
import { listBlocksFunction } from './list.remote';

export const deleteBlockFunction = command(deleteBlockSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = user.roles as string[] || [];
    if (!roles.includes('admin')) throw new Error('Forbidden');

    await deleteBlock(data.blockId);

    try {
        await requested(readContent, 20).refreshAll();
    } catch { /* ignore */ }
    void readContent({}).refresh();
    void listBlocksFunction().refresh();

    return { success: true };
});
