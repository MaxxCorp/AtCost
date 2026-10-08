import { command } from '$app/server';
import { createBlockSchema } from '#lib/validations/cms.js';
import { createBlock, linkBlock } from '#lib/server/cms/operations.js';
import { getAuthenticatedUser } from '#lib/server/authorization.js';

export const createBlockFunction = command(createBlockSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = user.roles as string[] || [];
    if (!roles.includes('admin')) throw new Error('Forbidden');

    const block = await createBlock(data.name, data.description);
    await linkBlock('gdpr', 'main', block.id);

    return { success: true, block };
});
