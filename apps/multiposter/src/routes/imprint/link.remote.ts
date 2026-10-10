import { command } from '$app/server';
import { linkBlockSchema } from '#lib/validations/cms.js';
import { linkBlock, getBlock } from '#lib/server/cms/operations.js';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { error } from '@sveltejs/kit';

export const linkBlockFunction = command(linkBlockSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = user.roles as string[] || [];
    if (!roles.includes('admin')) throw new Error('Forbidden');

    const block = await getBlock(data.blockId);
    if (!block) error(404, 'Block not found');

    await linkBlock('imprint', 'main', data.blockId);

    return { success: true };
});
