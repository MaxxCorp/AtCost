import { db } from '@ac/db';
import { and, eq } from '@ac/db';
import type { PgTable } from 'drizzle-orm/pg-core';

export interface AssociationOptions {
    type: string;
    entityId: string;
    itemId: string;
    tableMap: Record<string, PgTable>;
    fieldMap: Record<string, string>;
    itemField: string;
}

/**
 * Shared logic for adding an association between an entity and an item (e.g. contact, location, resource)
 */
export async function addAssociation(options: AssociationOptions) {
    const { type, entityId, itemId, tableMap, fieldMap, itemField } = options;
    const table = tableMap[type];
    const entityField = fieldMap[type];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type for association: ${type}`);
    }

    await (db.insert(table as any) as any).values({
        [entityField]: entityId,
        [itemField]: itemId
    }).onConflictDoNothing();
}

/**
 * Shared logic for removing an association
 */
export async function removeAssociation(options: AssociationOptions) {
    const { type, entityId, itemId, tableMap, fieldMap, itemField } = options;
    const table = tableMap[type];
    const entityField = fieldMap[type];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type for association: ${type}`);
    }

    await db.delete(table as any).where(and(
        eq((table as any)[entityField], entityId),
        eq((table as any)[itemField], itemId)
    ));
}
