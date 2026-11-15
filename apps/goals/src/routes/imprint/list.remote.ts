import { query } from '$app/server';
import { listBlocks } from '#lib/server/cms/operations.js';

export const listBlocksRemote = query(async () => {
    return await listBlocks();
});
