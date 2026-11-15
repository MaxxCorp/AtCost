import { query } from '$app/server';
import { getLocale } from '#lib/paraglide/runtime.js';
import { getContent, type ContentBranch } from '#lib/server/cms/operations.js';
import { readCmsSchema } from '#lib/validations/cms.js';
import { getOptionalUser, isOperator } from '#lib/server/authorization.js';

export const readContent = query(readCmsSchema, async ({ branch, language, pageSlug, slotName }) => {
    const lang = language || getLocale();
    const resolvedBranch: ContentBranch =
        branch === 'draft' && isOperator(getOptionalUser()) ? 'draft' : 'published';
    return await getContent(pageSlug || 'imprint', slotName || 'main', lang, resolvedBranch);
});
