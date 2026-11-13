import * as v from 'valibot';
import { command, requested } from '$app/server';
import { db } from '@ac/db';
import { contact } from '@ac/db';
import { inArray, and, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { listContacts } from '../list.remote';
import { fetchEntityContacts } from '../associate.remote';
import { readEvent } from '../../events/[id]/read.remote';
import { listEvents } from '../../events/list.remote';
import { getStorageProvider } from '#lib/server/blob-storage/index.js';
import { invalidateContact, invalidateEvent } from '#lib/server/cache/index.js';
import { applyEventParticipantsDelta, getEventHeadcountsByContactIds } from '#lib/server/events/participants.js';

const deleteContactsSchema = v.array(v.string());

export const deleteContact = command(deleteContactsSchema, async (ids) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

    // Fetch contacts to get asset paths before deletion
    const contactsToDelete = await db.query.contact.findMany({
        where: (table, { inArray }) => inArray(table.id, ids)
    });

    const affectedEventHeadcounts = await getEventHeadcountsByContactIds(db, ids);
    const affectedEventIds = Array.from(affectedEventHeadcounts.keys());

    const result = await db.transaction(async (tx) => {
        const deletedRows = await tx
            .delete(contact)
            .where(inArray(contact.id, ids))
            .returning({ id: contact.id });

        for (const [evtId, removedHeadcount] of affectedEventHeadcounts.entries()) {
            if (removedHeadcount > 0) {
                await applyEventParticipantsDelta(tx, evtId, -removedHeadcount);
            }
        }

        return deletedRows;
    });

    const deletedIds = result.map(r => r.id);
    const storage = getStorageProvider();

    // Clean up assets for deleted contacts
    for (const contactItem of contactsToDelete) {
        if (deletedIds.includes(contactItem.id)) {
            if (contactItem.vCardPath && contactItem.vCardPath.startsWith('http')) await storage.delete(contactItem.vCardPath);
            if (contactItem.qrCodePath && contactItem.qrCodePath.startsWith('http')) await storage.delete(contactItem.qrCodePath);
        }
    }

    await invalidateContact(deletedIds);
    if (affectedEventIds.length > 0) {
        await invalidateEvent(affectedEventIds);
        for (const evtId of affectedEventIds) {
            void readEvent(evtId).refresh();
        }
    }
    try {
        await requested(listContacts, 20).refreshAll();
        await requested(fetchEntityContacts, 20).refreshAll();
        await requested(listEvents, 20).refreshAll();
    } catch { /* ignore */ }
    void listContacts().refresh();
    void listContacts({}).refresh();
    void listEvents().refresh();
    void listEvents({}).refresh();
    return { count: result.length, ids: deletedIds };
});

