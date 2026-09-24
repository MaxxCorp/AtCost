import { db } from '@ac/db';
import { cmsBlock, cmsSlot, cmsContentVersion, cmsPage } from '@ac/db';
import { eq, and, desc } from '@ac/db';
import { error } from '@sveltejs/kit';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { cached, getNamespaceVersion, CACHE_NAMESPACES, cacheKeys, invalidateCms } from '$lib/server/cache';

/**
 * Get content for a specific page slot.
 * Falls back: `(lang, branch)` -> `('en', branch)` -> first available for branch.
 */
export async function getContent(pageSlug: string, slotName: string, language: string, branch: string = 'published') {
    const fetchFromDb = async () => {
        // 1. Find active block for slot
        // We strictly use the composite key logic: pageSlug + slotName
        // Since our schema has (pageSlug, slotName) PK, there's only one row per slot.
        const slot = await db.query.cmsSlot.findFirst({
            where: and(
                eq(cmsSlot.pageSlug, pageSlug),
                eq(cmsSlot.slotName, slotName),
                eq(cmsSlot.isActive, true)
            ),
            with: {
                block: true
            }
        });

        if (!slot) return null;

        const blockId = slot.blockId;

        // 2. Fetch versions for this block and branch
        const versions = await db.query.cmsContentVersion.findMany({
            where: and(
                eq(cmsContentVersion.blockId, blockId),
                eq(cmsContentVersion.branch, branch)
            ),
            orderBy: [desc(cmsContentVersion.createdAt)]
        });

        if (versions.length === 0) return { block: slot.block, content: null };

        // 3. Find best match
        // Exact match
        const exact = versions.find(v => v.language === language);
        if (exact) return { block: slot.block, content: exact };

        // Fallback to 'en'
        const fallbackEn = versions.find(v => v.language === 'en');
        if (fallbackEn) return { block: slot.block, content: fallbackEn };

        // Fallback to whatever is first (latest)
        return { block: slot.block, content: versions[0] };
    };

    if (branch === 'published') {
        const version = await getNamespaceVersion(CACHE_NAMESPACES.CMS);
        const key = cacheKeys.cmsContent(pageSlug, slotName, language, branch, version);
        return cached(key, 86400, fetchFromDb);
    }

    return fetchFromDb();
}

/**
 * Create a new block (and optionally link it)
 */
export async function createBlock(name: string, description?: string) {
    const [block] = await db.insert(cmsBlock).values({
        name,
        description
    }).returning();
    return block;
}

/**
 * Link a block to a slot
 */
export async function linkBlock(pageSlug: string, slotName: string, blockId: string) {
    // Ensure page exists
    await db.insert(cmsPage).values({ slug: pageSlug, name: pageSlug }).onConflictDoNothing();

    // Upsert slot
    await db.insert(cmsSlot).values({
        pageSlug,
        slotName,
        blockId,
        isActive: true
    }).onConflictDoUpdate({
        target: [cmsSlot.pageSlug, cmsSlot.slotName],
        set: { blockId, isActive: true }
    });

    await invalidateCms();
}

/**
 * Save new content version
 */
export async function saveContent(blockId: string, language: string, branch: string, content: string, userId?: string) {
    // We use `jsonb` for content, so wrap the string.
    // CKEditor returns HTML string.
    const contentJson = { html: content };

    const [saved] = await db.insert(cmsContentVersion).values({
        blockId,
        language,
        branch,
        content: contentJson,
        createdBy: userId
    }).onConflictDoUpdate({
        target: [cmsContentVersion.blockId, cmsContentVersion.language, cmsContentVersion.branch],
        set: {
            content: contentJson,
            createdAt: new Date(), // touch timestamp
            createdBy: userId
        }
    }).returning();

    await invalidateCms();
    return saved;
}

export async function deleteBlock(blockId: string) {
    // Cascade should handle slots and versions
    await db.delete(cmsBlock).where(eq(cmsBlock.id, blockId));
    await invalidateCms();
}

export async function getBlock(blockId: string) {
    return db.query.cmsBlock.findFirst({
        where: eq(cmsBlock.id, blockId)
    });
}

export async function listBlocks() {
    return db.query.cmsBlock.findMany({
        orderBy: [desc(cmsBlock.name)]
    });
}

export async function renameBlock(blockId: string, newName: string) {
    await db.update(cmsBlock)
        .set({ name: newName })
        .where(eq(cmsBlock.id, blockId));
    await invalidateCms();
}

