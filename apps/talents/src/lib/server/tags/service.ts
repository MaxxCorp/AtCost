import {
    db,
    tag,
    tagCategory,
    eq,
    and,
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
    TagCategory
} from '@ac/validations';

let isDefaultSeeded = false;

export async function ensureDefaultCategoriesAndTags(): Promise<void> {
    if (isDefaultSeeded) return;
    try {
        const existingCats = await db.query.tagCategory.findMany();
        if (existingCats.length === 0) {
            const [payrollCat] = await db.insert(tagCategory).values({
                name: "Abrechnung & Vergütung",
                slug: "payroll",
                description: "Mitarbeitergruppierung für Entgeltabrechnungsläufe (z.B. Festgehalt vs. Stundenlohn)",
                color: "indigo",
                isDefault: true,
            }).returning();

            const [deptCat] = await db.insert(tagCategory).values({
                name: "Abteilungen & Teams",
                slug: "department",
                description: "Organisatorische Zuordnung von Mitarbeitern und Rollen",
                color: "emerald",
                isDefault: false,
            }).returning();

            const [eventCat] = await db.insert(tagCategory).values({
                name: "Events & Öffentlichkeit",
                slug: "events",
                description: "Kategorisierung von öffentlichen Veranstaltungen und Programmen",
                color: "blue",
                isDefault: false,
            }).returning();

            const initialTags = [
                {
                    name: "Gehaltsempfänger (Festgehalt)",
                    visibility: "internal" as const,
                    categoryId: payrollCat.id,
                    color: "indigo",
                    description: "Monatliches Festgehalt, Auszahlung vor Monatsende (25.-28.).",
                    userId: "system",
                },
                {
                    name: "Stundenlohnempfänger (Zeitlohn)",
                    visibility: "internal" as const,
                    categoryId: payrollCat.id,
                    color: "emerald",
                    description: "Stundenbasierte Vergütung nach erfassten und genehmigten Arbeitszeiten.",
                    userId: "system",
                },
                {
                    name: "Öffentliches Event",
                    visibility: "external" as const,
                    categoryId: eventCat.id,
                    color: "blue",
                    description: "Öffentlich auf Displays, Kiosken und Webseiten sichtbar.",
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

    // Get count of tags per category
    const catIds = rawResults.map(c => c.id);
    let tagCounts: Record<string, number> = {};
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
    // Unlink tags first
    await db.update(tag).set({ categoryId: null }).where(eq(tag.categoryId, id));
    await db.delete(tagCategory).where(eq(tagCategory.id, id));
    return { success: true };
}
