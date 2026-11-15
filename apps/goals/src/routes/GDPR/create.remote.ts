import { command } from '$app/server';
import { createBlockSchema } from '#lib/validations/cms.js';
import { createBlock } from '#lib/server/cms/operations.js';

export const createBlockRemote = command(createBlockSchema, async ({ name, description }) => {
    return await createBlock(name, description);
});
