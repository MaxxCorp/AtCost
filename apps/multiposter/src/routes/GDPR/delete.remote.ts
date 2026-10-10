import { command } from '$app/server';
import { deleteBlockSchema } from '#lib/validations/cms.js';
import { deleteBlock } from '#lib/server/cms/operations.js';
import { getAuthenticatedUser } from '#lib/server/authorization.js';

export const deleteBlockFunction = command(deleteBlockSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = user.roles as string[] || [];
    if (!roles.includes('admin')) throw new Error('Forbidden');

    await deleteBlock(data.blockId);

    return { success: true };
});
