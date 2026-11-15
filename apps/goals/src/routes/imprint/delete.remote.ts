import { command } from '$app/server';
import { deleteBlockSchema } from '#lib/validations/cms.js';
import { deleteBlock } from '#lib/server/cms/operations.js';

export const deleteBlockRemote = command(deleteBlockSchema, async (blockId) => {
    return await deleteBlock(blockId);
});
