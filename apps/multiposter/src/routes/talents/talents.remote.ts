import { query, form } from '$app/server';
import { db, talent, type Talent, type Contact } from '@ac/db';
import { eq, desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createTalentSchema, updateTalentSchema } from '@ac/validations';
import * as v from 'valibot';

export const listTalents = query(v.void_(), async () => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');
    const results = await (db.query as any).talent.findMany({
        with: {
            contact: true
        },
        orderBy: [(desc as any)(talent.updatedAt)]
    });
    return results.map((t: any) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        availabilityDate: t.availabilityDate ? t.availabilityDate.toISOString() : null,
        contact: t.contact ? {
            ...t.contact,
            birthday: t.contact.birthday ? t.contact.birthday.toISOString() : null,
            createdAt: t.contact.createdAt.toISOString(),
            updatedAt: t.contact.updatedAt.toISOString(),
        } : null
    }));
});

export const createTalent = form(createTalentSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [newTalent] = await db.insert(talent).values({
        contactId: data.contactId,
        status: data.status,
        jobTitle: data.jobTitle,
        salaryExpectation: data.salaryExpectation,
        availabilityDate: data.availabilityDate ? new Date(data.availabilityDate) : null,
        onboardingStatus: data.onboardingStatus,
        resumeUrl: data.resumeUrl,
        source: data.source,
        internalNotes: data.internalNotes,
    } as any).returning();

    await listTalents().refresh();
    return { success: true, id: newTalent.id };
});

export const updateTalent = form(updateTalentSchema as any, async (data: any) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [updatedTalent] = await db.update(talent).set({
        status: data.status,
        jobTitle: data.jobTitle,
        salaryExpectation: data.salaryExpectation,
        availabilityDate: data.availabilityDate ? new Date(data.availabilityDate) : null,
        onboardingStatus: data.onboardingStatus,
        resumeUrl: data.resumeUrl,
        source: data.source,
        internalNotes: data.internalNotes,
    } as any).where((eq as any)((talent as any).id, data.id)).returning();

    await listTalents().refresh();
    return { success: true, id: updatedTalent.id };
});
