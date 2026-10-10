import { db } from '@ac/db';
import { and, eq } from '@ac/db';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';

export interface AssociationOptions {
    type: string;
    entityId: string;
    itemId: string;
    tableMap: Record<string, any>;
    fieldMap: Record<string, string>;
    itemField: string;
    userId?: string;
}

/**
 * Shared logic for adding an association between an entity and an item (e.g. contact, location, resource)
 */
export async function addAssociation(options: AssociationOptions) {
    let { type, entityId, itemId, tableMap, fieldMap, itemField, userId } = options;
    const table = tableMap[type];
    const entityField = fieldMap[type];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type for association: ${type}`);
    }

    if (type === 'event' && entityId.includes('_inst_')) {
        entityId = await resolveEventIdForAssociations(entityId, { materializeIfVirtual: true, userId });
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
    let { type, entityId, itemId, tableMap, fieldMap, itemField, userId } = options;
    const table = tableMap[type];
    const entityField = fieldMap[type];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type for association: ${type}`);
    }

    if (type === 'event' && entityId.includes('_inst_')) {
        entityId = await resolveEventIdForAssociations(entityId, { materializeIfVirtual: true, userId });
    }

    await db.delete(table as any).where(and(
        eq((table as any)[entityField], entityId),
        eq((table as any)[itemField], itemId)
    ));
}

