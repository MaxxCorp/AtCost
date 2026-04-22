import { db } from './db';
import {
    contact, contactEmail, contactPhone, contactAddress
} from './db/schema';
import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import QRCode from 'qrcode';
import ICAL from 'ical.js';
import { getStorageProvider } from './blob-storage';
import { env } from '$env/dynamic/private';
import { createHash } from 'crypto';

function getFingerprint(content: string | Buffer): string {
    return createHash('sha256').update(content).digest('hex');
}

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
            addresses: true,
            locationAssociations: {
                with: {
                    location: true
                }
            }
        }
    });

    if (!data) return;

    // vCard generation using ical.js (vCard RFC 6350 support via jCard format)
    const card = new ICAL.Component(['vcard', [], []]);
    card.addPropertyWithValue('version', '4.0');

    // Public vCard (filtered)
    const publicCard = new ICAL.Component(['vcard', [], []]);
    publicCard.addPropertyWithValue('version', '4.0');

    const fullName = data.displayName || `${data.givenName || ''} ${data.familyName || ''}`.trim();
    if (fullName) {
        card.addPropertyWithValue('fn', fullName);
        publicCard.addPropertyWithValue('fn', fullName);
    }

    // Name property (N): Family Name; Given Name; Additional Names; Honorific Prefixes; Honorific Suffixes
    card.addPropertyWithValue('n', [
        data.familyName || '',
        data.givenName || '',
        data.middleName || '',
        data.honorificPrefix || '',
        data.honorificSuffix || ''
    ]);
    publicCard.addPropertyWithValue('n', [
        data.familyName || '',
        data.givenName || '',
        data.middleName || '',
        data.honorificPrefix || '',
        data.honorificSuffix || ''
    ]);

    data.emails?.forEach((e: any) => {
        const prop = card.addPropertyWithValue('email', e.value);
        if (e.type) prop.setParameter('type', e.type.toLowerCase());
        
        // Only include work emails in public vCard
        if (e.type?.toLowerCase() === 'work') {
            const publicProp = publicCard.addPropertyWithValue('email', e.value);
            publicProp.setParameter('type', 'work');
        }
    });

    data.phones?.forEach((p: any) => {
        const prop = card.addPropertyWithValue('tel', p.value);
        if (p.type) prop.setParameter('type', p.type.toLowerCase());

        // Only include work phones in public vCard
        if (p.type?.toLowerCase() === 'work') {
            const publicProp = publicCard.addPropertyWithValue('tel', p.value);
            publicProp.setParameter('type', 'work');
        }
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

        // Only include work addresses in public vCard
        if (a.type?.toLowerCase() === 'work') {
            const publicProp = publicCard.addPropertyWithValue('adr', adrValue);
            publicProp.setParameter('type', 'work');
        }
    });

    if (data.company || data.department) {
        const orgValue = [data.company || '', data.department || ''].filter(Boolean);
        if (orgValue.length > 0) {
            card.addPropertyWithValue('org', orgValue);
            publicCard.addPropertyWithValue('org', orgValue);
        }
    }

    if (data.role) {
        card.addPropertyWithValue('title', data.role);
        publicCard.addPropertyWithValue('title', data.role);
    }

    // Add associated locations to full vCard
    data.locationAssociations?.forEach((la: any) => {
        const l = la.location;
        if (!l) return;
        const adrValue = [
            '',
            l.addressSuffix || '',
            `${l.street || ''} ${l.houseNumber || ''}`.trim(),
            l.city || '',
            l.state || '',
            l.zip || '',
            l.country || ''
        ];
        const prop = card.addPropertyWithValue('adr', adrValue);
        prop.setParameter('type', 'work');
        if (l.name) prop.setParameter('label', l.name);

        // Add public associations to public vCard
        if (l.isPublic) {
            const publicProp = publicCard.addPropertyWithValue('adr', adrValue);
            publicProp.setParameter('type', 'work');
            if (l.name) publicProp.setParameter('label', l.name);
        }
    });

    const storage = getStorageProvider();
    const fullNameSlug = fullName.replace(/\s+/g, '_');

    const oldVCardPath = data.vCardPath;
    const oldQrCodePath = data.qrCodePath;
    const fingerprints = (data.fingerprints as Record<string, string>) || {};
    const newFingerprints = { ...fingerprints };

    // Full vCard Upload
    const vCardContent = card.toString();
    const vCardFingerprint = getFingerprint(vCardContent);
    const vCardFileName = `contacts/${contactId}/${fullNameSlug}.vcf`;
    
    let vCardUrl = oldVCardPath;
    if (vCardFingerprint !== fingerprints.vcard || !oldVCardPath || !oldVCardPath.includes(fullNameSlug)) {
        vCardUrl = await storage.put(vCardFileName, vCardContent, 'text/vcard');
        newFingerprints.vcard = vCardFingerprint;
    }

    // Public vCard Upload
    const publicVCardContent = publicCard.toString();
    const publicVCardFingerprint = getFingerprint(publicVCardContent);
    const publicVCardFileName = `contacts/${contactId}/${fullNameSlug}_public.vcf`;
    
    if (publicVCardFingerprint !== fingerprints.vcard_public) {
        await storage.put(publicVCardFileName, publicVCardContent, 'text/vcard');
        newFingerprints.vcard_public = publicVCardFingerprint;
    }

    // QR Code generation — resolve base URL with multiple fallbacks
    const baseUrl = env.PUBLIC_BASE_URL || origin || env.BETTER_AUTH_URL || "";
    const contactUrl = `${baseUrl}/contacts/${contactId}/view`;
    const contactUrlFingerprint = getFingerprint(contactUrl);

    let qrCodeUrl = oldQrCodePath;
    if (contactUrlFingerprint !== fingerprints.qrcode || !oldQrCodePath) {
        // Generate QR as Buffer
        const qrBuffer = await QRCode.toBuffer(contactUrl, {
            width: 300,
            margin: 2,
            color: { dark: '#1e40af', light: '#ffffff' }
        });

        const qrCodeFileName = `contacts/${contactId}/qr.png`;
        qrCodeUrl = await storage.put(qrCodeFileName, qrBuffer, 'image/png');

        const publicQrCodeFileName = `contacts/${contactId}/qr_public.png`;
        await storage.put(publicQrCodeFileName, qrBuffer, 'image/png');
        
        newFingerprints.qrcode = contactUrlFingerprint;
    }

    // Update paths and fingerprints in DB
    const updateData: any = {};
    if (vCardUrl && vCardUrl !== oldVCardPath) updateData.vCardPath = vCardUrl;
    if (qrCodeUrl && qrCodeUrl !== oldQrCodePath) updateData.qrCodePath = qrCodeUrl;
    if (JSON.stringify(newFingerprints) !== JSON.stringify(fingerprints)) {
        updateData.fingerprints = newFingerprints;
    }

    if (Object.keys(updateData).length > 0) {
        await db.update(contact)
            .set(updateData)
            .where(eq(contact.id, contactId));
    }

    // Clean up old assets if paths changed
    if (oldVCardPath && vCardUrl && oldVCardPath !== vCardUrl) await storage.delete(oldVCardPath);
    if (oldQrCodePath && qrCodeUrl && oldQrCodePath !== qrCodeUrl) await storage.delete(oldQrCodePath);
}


export interface GetEntityContactsParams {
    type: 'event' | 'user' | 'location' | 'resource' | 'announcement';
    entityId: string;
}

/**
 * Fetch contacts associated with a specific entity
 */
export async function getEntityContacts(type: string, entityId: string, includeSubEntities = true): Promise<any[]> {
    const tableMap = {
        user: 'userContact',
        location: 'locationContact',
        resource: 'resourceContact',
        event: 'eventContact',
        announcement: 'announcementContact'
    } as const;

    const fieldMap = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId',
        event: 'eventId',
        announcement: 'announcementId'
    } as const;

    const tableName = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    if (!tableName || !entityField) {
        throw new Error(`Unsupported entity type: ${type}`);
    }

    const withOptions = includeSubEntities ? {
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
    } : {
        contact: true
    };

    const associations = await (db.query as any)[tableName].findMany({
        where: (t: any, { eq }: any) => eq(t[entityField], entityId),
        with: withOptions
    });

    return associations.map((a: any) => {
        const c = a.contact;
        if (!c) return null;
        
        // Add participation status for events if present
        const result = {
            ...c,
            participationStatus: a.participationStatus || 'needsAction'
        };

        if (includeSubEntities) {
            return {
                ...result,
                createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
                updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
                birthday: c.birthday instanceof Date ? c.birthday.toISOString() : (c.birthday || null),
                emails: c.emails || [],
                phones: c.phones || [],
                addresses: c.addresses || [],
                relations: (c.relations || []).map((rel: any) => ({
                    id: rel.id,
                    targetContactId: rel.targetContactId,
                    relationType: rel.relationType,
                    targetContact: rel.targetContact
                })),
                tags: (c.tags || []).map((t: any) => ({
                    id: t.tag?.id,
                    name: t.tag?.name
                }))
            };
        }
        return result;
    }).filter(Boolean);
}
