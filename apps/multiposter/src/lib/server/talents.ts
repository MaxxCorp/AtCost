import { db } from './db';
import { talent, userTalent } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Backend logic for managing talent associations with users.
 */

export async function associateTalent(type: "user", entityId: string, talentId: string) {
    const user = getAuthenticatedUser();
    // Use 'talents' or 'users' feature for authorization. Since it's user-form, 'users' makes sense, but 'talents' is more specific.
    ensureAccess(user, 'talents');

    if (type === "user") {
        await db.insert(userTalent).values({
            userId: entityId,
            talentId: talentId
        }).onConflictDoNothing();
    }
}

export async function dissociateTalent(type: "user", entityId: string, talentId: string) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    if (type === "user") {
        await db.delete(userTalent).where(
            and(
                eq(userTalent.userId, entityId),
                eq(userTalent.talentId, talentId)
            )
        );
    }
}

export async function getEntityTalents(type: "user", entityId: string) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    if (type === "user") {
        const results = await db.query.userTalent.findMany({
            where: (table, { eq }) => eq(table.userId, entityId),
            with: {
                talent: {
                    with: {
                        contact: {
                            with: {
                                emails: true,
                                phones: true
                            }
                        }
                    }
                }
            }
        });
        return results.map(r => r.talent);
    }
    return [];
}
