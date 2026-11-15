import { form, requested } from '$app/server';
import { updateCmsSchema } from '#lib/validations/cms.js';
import { saveContent, getContent, createBlock, linkBlock, type ContentBranch } from '#lib/server/cms/operations.js';
import { readContent } from './read.remote';

export const updateContent = form(updateCmsSchema, async ({ content, language, branch, pageSlug, slotName }) => {
    const slug = pageSlug || 'gdpr';
    const slot = slotName || 'main';
    let current = await getContent(slug, slot, language, branch as ContentBranch);

    if (!current || !current.blockId) {
        const block = await createBlock(`${slug}-${slot}`, `Default block for ${slug}`);
        await linkBlock(slug, slot, block.id);
        current = { content: '', blockId: block.id };
    }

    await saveContent(current.blockId, language, branch as ContentBranch, content);

    try {
        await requested(readContent, 20).refreshAll();
    } catch {
        // ignore
    }
    void readContent({ branch, language, pageSlug: slug, slotName: slot }).refresh();
    void readContent({}).refresh();

    return { success: true };
});
