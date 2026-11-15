import { query } from '$app/server';
import { getLocale } from '#lib/paraglide/runtime.js';
import { getContent, type ContentBranch } from '#lib/server/cms/operations.js';
import { readCmsSchema } from '#lib/validations/cms.js';

export const readContent = query(readCmsSchema, async ({ branch, language, pageSlug, slotName }) => {
    const lang = language || getLocale();
    return await getContent(pageSlug || 'gdpr', slotName || 'main', lang, (branch as ContentBranch) || 'published');
});
