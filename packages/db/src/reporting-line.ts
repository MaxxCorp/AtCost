import { db } from "./db";
import { contactRelation, talent, userContact, userTalent } from "./schema";
import { eq, or, and } from "drizzle-orm";

/**
 * Finds the direct superior (manager) for a given talent.
 * A superior is found via contact relations ("reports to" or "manager of").
 */
export async function getSuperior(talentId: string) {
    // 1. Get contactId for the talent
    const t = await db.query.talent.findFirst({
        where: eq(talent.id as any, talentId),
        columns: { contactId: true }
    });
    if (!t) return null;

    const contactId = t.contactId;

    // 2. Find relations that point to a manager
    const relations = await db.query.contactRelation.findMany({
        where: or(
            and(eq(contactRelation.contactId as any, contactId), eq(contactRelation.relationType as any, "reports to")),
            and(eq(contactRelation.targetContactId as any, contactId), eq(contactRelation.relationType as any, "manager of"))
        )
    });

    if (relations.length === 0) return null;

    // Pick the target contact ID who is the manager
    const managerContactId = relations[0].relationType === "reports to" 
        ? relations[0].targetContactId 
        : relations[0].contactId;

    // 3. Find the talent/user associated with this manager contact
    const managerTalent = await db.query.talent.findFirst({
        where: eq(talent.contactId as any, managerContactId)
    });

    return managerTalent || null;
}

/**
 * Finds direct reports for a given talent.
 */
export async function getDirectReports(talentId: string) {
    const t = await db.query.talent.findFirst({
        where: eq(talent.id as any, talentId),
        columns: { contactId: true }
    });
    if (!t) return [];

    const contactId = t.contactId;

    const relations = await db.query.contactRelation.findMany({
        where: or(
            and(eq(contactRelation.contactId as any, contactId), eq(contactRelation.relationType as any, "manager of")),
            and(eq(contactRelation.targetContactId as any, contactId), eq(contactRelation.relationType as any, "reports to"))
        )
    });

    const reportContactIds = relations.map(r => 
        r.relationType === "manager of" ? r.targetContactId : r.contactId
    );

    if (reportContactIds.length === 0) return [];

    return await db.query.talent.findMany({
        where: or(...reportContactIds.map(id => eq(talent.contactId as any, id))),
        with: {
            contact: true
        }
    });
}

/**
 * Recursively finds all subordinates in the reporting line.
 */
export async function getSubordinateTree(talentId: string, depth = 5) {
    if (depth <= 0) return [];

    const directReports = await getDirectReports(talentId);
    let allSubordinates = [...directReports];

    for (const report of directReports) {
        const subSubordinates = await getSubordinateTree(report.id, depth - 1);
        allSubordinates = [...allSubordinates, ...subSubordinates];
    }

    // Remove duplicates if any (e.g. matrix management)
    const seen = new Set();
    return allSubordinates.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
    });
}
