import { query } from '$app/server';
import { listBlocks } from '#lib/server/cms/operations.js';

export const listBlocksFunction = query(async () => {
    return listBlocks();
});
