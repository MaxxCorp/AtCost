import { query, form } from '$app/server';
import { db } from '$lib/server/db';
import { talent, talentTimelineEntry, contact, user } from '$lib/server/db/schema';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createTalentSchema, updateTalentSchema, talentTimelineEntrySchema } from '@ac/validations';
import { eq, desc } from 'drizzle-orm';
import * as v from 'valibot';

export const listTalents = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    const results = await db.query.talent.findMany({
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    tags: { with: { tag: true } }
                }
            },
            timelineEntries: {
                orderBy: [desc(talentTimelineEntry.timestamp)],
                limit: 3
            }
        },
        orderBy: [desc(talent.updatedAt)]
    });

    return results.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        contact: {
            ...t.contact,
            createdAt: t.contact.createdAt.toISOString(),
            updatedAt: t.contact.updatedAt.toISOString(),
            birthday: t.contact.birthday?.toISOString(),
            tags: t.contact.tags.map(ct => ct.tag.name)
        }
    }));
});

export const readTalent = query(v.string(), async (id) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    const result = await db.query.talent.findFirst({
        where: eq(talent.id, id),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    tags: { with: { tag: true } },
                    relations: { with: { targetContact: true } }
                }
            },
            timelineEntries: {
                orderBy: [desc(talentTimelineEntry.timestamp)]
            }
        }
    });

    if (!result) return null;

    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        contact: {
            ...result.contact,
            createdAt: result.contact.createdAt.toISOString(),
            updatedAt: result.contact.updatedAt.toISOString(),
            birthday: result.contact.birthday?.toISOString(),
            tags: result.contact.tags.map(ct => ct.tag.name)
        }
    };
});

export const createTalent = form(createTalentSchema, async (data) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const [newTalent] = await db.insert(talent).values({
        contactId: data.contactId,
    }).returning();

    await listTalents().refresh();
    return { success: true, id: newTalent.id };
});

export const addTimelineEntry = form(v.object({
    talentId: v.string(),
    entry: talentTimelineEntrySchema
}), async (data) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const entry = data.entry as v.InferOutput<typeof talentTimelineEntrySchema>;

    const [newEntry] = await db.insert(talentTimelineEntry).values({
        talentId: data.talentId as string,
        type: entry.type as "Interview" | "Hiring" | "Evaluation" | "Termination",
        description: entry.description,
        addedByUserId: authUser.id,
        timestamp: new Date(entry.date),
        data: {
            date: entry.date,
            comment: entry.comment,
            nextStep: entry.nextStep
        }
    }).returning();

    await readTalent(data.talentId as string).refresh();
    await listTalents().refresh();

    return { success: true, id: newEntry.id };
});

export const listEmployees = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    // Filter contacts by tag "Employee"
    const results = await db.query.contact.findMany({
        with: {
            tags: {
                with: { tag: true }
            }
        }
    });

    return results.filter(c => c.tags.some(ct => ct.tag.name === 'Employee')).map(c => ({
        id: c.id,
        displayName: c.displayName || `${c.givenName} ${c.familyName}`
    }));
});
