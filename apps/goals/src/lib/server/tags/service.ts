import {
    db,
    tag,
    tagCategory,
    goalCampaignTag,
    eq,
    or,
    ilike,
    desc,
    asc,
    sql,
    inArray
} from '@ac/db';
import type {
    CreateTagCategoryInput,
    UpdateTagCategoryInput,
} from '@ac/validations';

let isDefaultSeeded = false;

export async function ensureDefaultCategoriesAndTags(): Promise<void> {
    if (isDefaultSeeded) return;
    try {
        const existingCats = await db.query.tagCategory.findMany();
        let goalsCat = existingCats.find(c => c.slug === 'goals-impact' || c.name === 'Goals & Impact');

        if (!goalsCat) {
            const [createdCat] = await db.insert(tagCategory).values({
                name: "Goals & Impact",
                slug: "goals-impact",
                description: "Categorization for community petitions, crowdfunding, and organizational goals",
                color: "#6366f1",
                isDefault: existingCats.length === 0,
            }).returning();
            goalsCat = createdCat;
        }

        if (goalsCat) {
            const initialTags = [
                {
                    name: "Sustainability & Green Energy",
                    visibility: "external" as const,
                    categoryId: goalsCat.id,
                    color: "#10b981",
                    description: "Climate action, renewable energy, and ecological initiatives.",
                    userId: "system",
                },
                {
                    name: "Community & Neighborhood",
                    visibility: "external" as const,
                    categoryId: goalsCat.id,
                    color: "#3b82f6",
                    description: "Local civic petitions, neighborhood improvements, and events.",
                    userId: "system",
                },
                {
                    name: "Education & Youth",
                    visibility: "external" as const,
                    categoryId: goalsCat.id,
                    color: "#8b5cf6",
                    description: "Workshops, open-access learning, and youth programs.",
                    userId: "system",
                },
                {
                    name: "Accessibility & Inclusion",
                    visibility: "external" as const,
                    categoryId: goalsCat.id,
                    color: "#f59e0b",
                    description: "Barrier-free access, inclusive spaces, and social equity.",
                    userId: "system",
                }
            ];

            for (const t of initialTags) {
                const exists = await db.query.tag.findFirst({
                    where: eq(tag.name, t.name)
                });
                if (!exists) {
                    await db.insert(tag).values(t);
                }
            }
        }
        isDefaultSeeded = true;
    } catch (err) {
        console.warn("Failed to check or seed default categories and tags:", err);
    }
}

export async function assignTagsToGoalCampaign(
    campaignId: string,
    tagInputs: string[],
    userId: string,
    options?: { allowCreate?: boolean }
): Promise<void> {
    await ensureDefaultCategoriesAndTags();

    await db.delete(goalCampaignTag).where(eq(goalCampaignTag.campaignId, campaignId));

    const cleanInputs = tagInputs
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

    if (cleanInputs.length === 0) return;

    const allowCreate = options?.allowCreate === true;
    const defaultCat = allowCreate
        ? await db.query.tagCategory.findFirst({
              where: or(eq(tagCategory.slug, 'goals-impact'), eq(tagCategory.isDefault, true))
          })
        : null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resolvedTagIds = new Set<string>();

    for (const item of cleanInputs) {
        if (uuidRegex.test(item)) {
            const existingById = await db.query.tag.findFirst({
                where: eq(tag.id, item)
            });
            if (existingById && (allowCreate || existingById.visibility === 'external')) {
                resolvedTagIds.add(existingById.id);
                continue;
            }
        }

        const existingByName = await db.query.tag.findFirst({
            where: ilike(tag.name, item)
        });
        if (existingByName) {
            if (allowCreate || existingByName.visibility === 'external') {
                resolvedTagIds.add(existingByName.id);
            }
        } else if (allowCreate) {
            const [created] = await db.insert(tag).values({
                name: item,
                visibility: 'external',
                categoryId: defaultCat?.id ?? null,
                color: '#6366f1',
                userId: userId || 'system',
            }).returning();
            if (created) {
                resolvedTagIds.add(created.id);
            }
        }
    }

    for (const tagId of resolvedTagIds) {
        await db.insert(goalCampaignTag).values({
            campaignId,
            tagId
        }).onConflictDoNothing();
    }
}

export async function listCategories(input?: { search?: string; page?: number; limit?: number }) {
    await ensureDefaultCategoriesAndTags();

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(tagCategory).$dynamic();
    if (search.trim()) {
        baseQuery = baseQuery.where(
            or(
                ilike(tagCategory.name, `%${search}%`),
                ilike(tagCategory.description, `%${search}%`),
                ilike(tagCategory.slug, `%${search}%`)
            )
        ) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const rawResults = await baseQuery
        .orderBy(desc(tagCategory.isDefault), asc(tagCategory.name))
        .limit(limit)
        .offset(offset);

    const catIds = rawResults.map(c => c.id);
    const tagCounts: Record<string, number> = {};
    if (catIds.length > 0) {
        const counts = await db
            .select({
                categoryId: tag.categoryId,
                count: sql<number>`count(*)`
            })
            .from(tag)
            .where(inArray(tag.categoryId, catIds))
            .groupBy(tag.categoryId);
        for (const c of counts) {
            if (c.categoryId) tagCounts[c.categoryId] = Number(c.count);
        }
    }

    const data = rawResults.map(r => ({
        ...r,
        tagCount: tagCounts[r.id] || 0,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));

    return { data, total };
}

export async function createCategory(input: CreateTagCategoryInput) {
    const [created] = await db.insert(tagCategory).values({
        name: input.name,
        slug: input.slug,
        description: input.description,
        color: input.color || 'indigo',
        icon: input.icon,
        isDefault: input.isDefault ?? false,
    }).returning();

    return created;
}

export async function updateCategory(input: UpdateTagCategoryInput) {
    const [updated] = await db.update(tagCategory).set({
        name: input.name,
        slug: input.slug,
        description: input.description,
        color: input.color,
        icon: input.icon,
        isDefault: input.isDefault,
        updatedAt: new Date(),
    }).where(eq(tagCategory.id, input.id)).returning();

    return updated;
}

export async function deleteCategory(id: string) {
    await db.update(tag).set({ categoryId: null }).where(eq(tag.categoryId, id));
    await db.delete(tagCategory).where(eq(tagCategory.id, id));
    return { success: true };
}
