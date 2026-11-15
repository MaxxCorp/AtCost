import { command } from '$app/server';
import { renameBlockSchema } from '#lib/validations/cms.js';
import { renameBlock } from '#lib/server/cms/operations.js';
import { listBlocksRemote } from './list.remote';

export const renameBlockRemote = command(renameBlockSchema, async ({ blockId, newName }) => {
    const res = await renameBlock(blockId, newName);
    await listBlocksRemote().refresh();
    return res;
});
