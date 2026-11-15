import { command } from '$app/server';
import { linkBlockSchema } from '#lib/validations/cms.js';
import { linkBlock } from '#lib/server/cms/operations.js';

export const linkBlockRemote = command(linkBlockSchema, async ({ blockId, pageSlug, slotName }) => {
    return await linkBlock(pageSlug || 'imprint', slotName || 'main', blockId);
});
