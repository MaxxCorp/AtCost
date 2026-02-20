import { db } from './db';
import {
    contact, contactEmail, contactPhone, contactAddress,
    userContact, locationContact, resourceContact, eventContact, announcementContact,
    contactRelation, tag, contactTag
} from './db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { getAuthenticatedUser, ensureAccess, parseRoles, hasAccess } from '$lib/authorization';
import QRCode from 'qrcode';
import ICAL from 'ical.js';
import { getStorageProvider } from './blob-storage';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

/**
 * Backend logic for managing contacts and their associations.
 * Designed according to Google People API documentation.
 */

/**
 * Generate vCard and QR Code for a contact
 */
export async function generateContactAssets(contactId: string, origin?: string) {
    const data = await db.query.contact.findFirst({
        where: (table, { eq }) => eq(table.id, contactId),
        with: {
            emails: true,
            phones: true,
            addresses: true
        }
    });

    if (!data) return;

    // vCard generation using ical.js (vCard RFC 6350 support via jCard format)
    const card = new ICAL.Component(['vcard', [], []]);
    card.addPropertyWithValue('version', '4.0');

    const fullName = data.displayName || `${data.givenName || ''} ${data.familyName || ''}`.trim();
    if (fullName) {
        card.addPropertyWithValue('fn', fullName);
    }

    // Name property (N): Family Name; Given Name; Additional Names; Honorific Prefixes; Honorific Suffixes
    card.addPropertyWithValue('n', [
        data.familyName || '',
        data.givenName || '',
        data.middleName || '',
        data.honorificPrefix || '',
        data.honorificSuffix || ''
    ]);

    data.emails?.forEach((e: any) => {
        const prop = card.addPropertyWithValue('email', e.value);
        if (e.type) prop.setParameter('type', e.type.toLowerCase());
    });

    data.phones?.forEach((p: any) => {
        const prop = card.addPropertyWithValue('tel', p.value);
        if (p.type) prop.setParameter('type', p.type.toLowerCase());
    });

    data.addresses?.forEach((a: any) => {
        // ADR: post-office box; extended address; street address; locality; region; postal code; country name
        const adrValue = [
            '', // po box
            a.addressSuffix || '',
            `${a.street || ''} ${a.houseNumber || ''}`.trim(),
            a.city || '',
            a.state || '',
            a.zip || '',
            a.country || ''
        ];
        const prop = card.addPropertyWithValue('adr', adrValue);
        if (a.type) prop.setParameter('type', a.type.toLowerCase());
    });

    if (data.notes) {
        card.addPropertyWithValue('note', data.notes);
    }

    // Public vCard generation (Work data only)
    const publicCard = new ICAL.Component(['vcard', [], []]);
    publicCard.addPropertyWithValue('version', '4.0');
    if (fullName) publicCard.addPropertyWithValue('fn', fullName);
    publicCard.addPropertyWithValue('n', [
        data.familyName || '',
        data.givenName || '',
        data.middleName || '',
        data.honorificPrefix || '',
        data.honorificSuffix || ''
    ]);

    data.emails?.filter((e: any) => e.type?.toLowerCase() === 'work').forEach((e: any) => {
        const prop = publicCard.addPropertyWithValue('email', e.value);
        if (e.type) prop.setParameter('type', e.type.toLowerCase());
    });

    data.phones?.filter((p: any) => p.type?.toLowerCase() === 'work').forEach((p: any) => {
        const prop = publicCard.addPropertyWithValue('tel', p.value);
        if (p.type) prop.setParameter('type', p.type.toLowerCase());
    });

    data.addresses?.filter((a: any) => a.type?.toLowerCase() === 'work').forEach((a: any) => {
        const adrValue = [
            '',
            a.addressSuffix || '',
            `${a.street || ''} ${a.houseNumber || ''}`.trim(),
            a.city || '',
            a.state || '',
            a.zip || '',
            a.country || ''
        ];
        const prop = publicCard.addPropertyWithValue('adr', adrValue);
        if (a.type) prop.setParameter('type', a.type.toLowerCase());
    });

    const storage = getStorageProvider();
    const fullNameSlug = fullName.replace(/\s+/g, '_');

    const oldVCardPath = data.vCardPath;
    const oldQrCodePath = data.qrCodePath;

    // Upload vCards
    const vCardFileName = `contacts/${contactId}/${fullNameSlug}.vcf`;
    const vCardUrl = await storage.put(vCardFileName, card.toString(), 'text/vcard');

    const publicVCardFileName = `contacts/${contactId}/${fullNameSlug}_public.vcf`;
    await storage.put(publicVCardFileName, publicCard.toString(), 'text/vcard');

    // QR Code generation
    const baseUrl = env.PUBLIC_BASE_URL || origin || "";
    const contactUrl = `${baseUrl}/contacts/${contactId}/view`;

    // Generate QR as Buffer
    const qrBuffer = await QRCode.toBuffer(contactUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#1e40af', light: '#ffffff' }
    });

    const qrCodeFileName = `contacts/${contactId}/qr.png`;
    const qrCodeUrl = await storage.put(qrCodeFileName, qrBuffer, 'image/png');

    const publicQrCodeFileName = `contacts/${contactId}/qr_public.png`;
    await storage.put(publicQrCodeFileName, qrBuffer, 'image/png');

    // Update paths in DB
    await db.update(contact)
        .set({
            vCardPath: vCardUrl,
            qrCodePath: qrCodeUrl
        })
        .where(eq(contact.id, contactId));

    // Clean up old assets if paths changed
    if (oldVCardPath && oldVCardPath !== vCardUrl) await storage.delete(oldVCardPath);
    if (oldQrCodePath && oldQrCodePath !== qrCodeUrl) await storage.delete(oldQrCodePath);
}

export interface ContactData {
    contact: Partial<typeof contact.$inferInsert> & { displayName: string };
    emails?: (Omit<typeof contactEmail.$inferInsert, 'contactId'> & { contactId?: string })[];
    phones?: (Omit<typeof contactPhone.$inferInsert, 'contactId'> & { contactId?: string })[];
    addresses?: (Omit<typeof contactAddress.$inferInsert, 'contactId'> & { contactId?: string })[];
    relationIds?: { targetContactId: string, relationType: string }[];
    tagNames?: string[];
    locationIds?: string[];
}







/**
 * Associate a contact with an entity (user, location, resource, event)
 */
export async function associateContact(type: 'user' | 'location' | 'resource' | 'event' | 'announcement', entityId: string, contactId: string) {
    const user = getAuthenticatedUser();

    // Allow users with 'contacts' access OR 'events' access if associating with an event
    if (!hasAccess(user, 'contacts') && !(type === 'event' && hasAccess(user, 'events')) && !(type === 'announcement' && hasAccess(user, 'announcements'))) {
        throw new Error('Forbidden');
    }

    const table = {
        user: userContact,
        location: locationContact,
        resource: resourceContact,
        event: eventContact,
        announcement: announcementContact
    }[type];

    const entityField = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId',
        event: 'eventId',
        announcement: 'announcementId'
    }[type];

    await (db.insert(table) as any).values({
        [entityField]: entityId,
        contactId
    }).onConflictDoNothing();
}



/**
 * Dissociate a contact from an entity
 */
export async function dissociateContact(type: 'user' | 'location' | 'resource' | 'event' | 'announcement', entityId: string, contactId: string) {
    const user = getAuthenticatedUser();

    // Allow users with 'contacts' access OR 'events' access if dissociating from an event
    if (!hasAccess(user, 'contacts') && !(type === 'event' && hasAccess(user, 'events')) && !(type === 'announcement' && hasAccess(user, 'announcements'))) {
        throw new Error('Forbidden');
    }

    const table = {
        user: userContact,
        location: locationContact,
        resource: resourceContact,
        event: eventContact,
        announcement: announcementContact
    }[type];

    const entityField = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId',
        event: 'eventId',
        announcement: 'announcementId'
    }[type];

    await db.delete(table).where(and(
        eq((table as any)[entityField], entityId),
        eq(table.contactId, contactId)
    ));
}

/**
 * Get all contacts associated with a specific entity
 */
export async function getEntityContacts(type: 'user' | 'location' | 'resource' | 'event' | 'announcement', entityId: string, skipAccessControl: boolean = false) {
    if (!skipAccessControl) {
        const user = getAuthenticatedUser();

        // Allow users with 'contacts' access OR 'events' access if fetching event contacts
        if (!hasAccess(user, 'contacts') && !(type === 'event' && hasAccess(user, 'events')) && !(type === 'announcement' && hasAccess(user, 'announcements'))) {
            error(401, 'Forbidden');
        }
    }

    const tableName = {
        user: 'userContact',
        location: 'locationContact',
        resource: 'resourceContact',
        event: 'eventContact',
        announcement: 'announcementContact'
    }[type];

    const entityField = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId',
        event: 'eventId',
        announcement: 'announcementId'
    }[type];

    // Wait, let's check contacts-schema.ts for userContact
    // userContact = pgTable('userContact', {
    //   userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    //   contactId: uuid('contactId').notNull().references(() => contact.id, { onDelete: 'cascade' }),
    // }, ...

    // Actually, 'userId' in userContact is the entity it's associated with.
    // BUT there is also contact.userId which is the owner.
    // This might be confusing.

    const associations = await (db.query as any)[tableName].findMany({
        where: (t: any, { eq }: any) => eq(t[entityField], entityId),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    tags: {
                        with: {
                            tag: true
                        }
                    },
                    relations: {
                        with: {
                            targetContact: true
                        }
                    }
                }
            }
        }
    });

    return associations.map((a: any) => ({
        ...a.contact,
        participationStatus: a.participationStatus || 'needsAction'
    }));
}

/**
 * Update metadata (like participation status) for an association
 */
export async function updateAssociationStatus(type: 'event', entityId: string, contactId: string, status: string) {
    const user = getAuthenticatedUser();

    // Allow users with either 'contacts' or the respective entity's access
    if (!hasAccess(user, 'contacts') && !hasAccess(user, 'events')) {
        throw new Error('Forbidden');
    }

    if (type !== 'event') {
        throw new Error('Only event associations support participation status');
    }

    const result = await db.update(eventContact)
        .set({ participationStatus: status })
        .where(and(
            eq(eventContact.eventId, entityId),
            eq(eventContact.contactId, contactId)
        ))
        .returning();


}

