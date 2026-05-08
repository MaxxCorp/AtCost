import { db } from '@ac/db';
import ICAL from 'ical.js';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
    const contactId = params.id;
    const isPublicRequested = url.searchParams.has('public');

    const data = await db.query.contact.findFirst({
        where: (table, { eq }) => eq(table.id, contactId),
        with: {
            emails: true,
            phones: true,
            addresses: true,
            locationAssociations: { with: { location: true } }
        }
    });

    if (!data) {
        error(404, 'Contact not found');
    }

    const card = new ICAL.Component(['vcard', [], []]);
    card.addPropertyWithValue('version', '4.0');

    const fullName = data.displayName || `${data.givenName || ''} ${data.familyName || ''}`.trim();
    if (fullName) card.addPropertyWithValue('fn', fullName);

    card.addPropertyWithValue('n', [
        data.familyName || '',
        data.givenName || '',
        data.middleName || '',
        data.honorificPrefix || '',
        data.honorificSuffix || ''
    ]);

    data.emails?.forEach((e: any) => {
        if (isPublicRequested && e.type?.toLowerCase() !== 'work') return;
        const prop = card.addPropertyWithValue('email', e.value);
        if (e.type) prop.setParameter('type', e.type.toLowerCase());
    });

    data.phones?.forEach((p: any) => {
        if (isPublicRequested && p.type?.toLowerCase() !== 'work') return;
        const prop = card.addPropertyWithValue('tel', p.value);
        if (p.type) prop.setParameter('type', p.type.toLowerCase());
    });

    data.addresses?.forEach((a: any) => {
        if (isPublicRequested && a.type?.toLowerCase() !== 'work') return;
        const adrValue = ['', a.addressSuffix || '', `${a.street || ''} ${a.houseNumber || ''}`.trim(), a.city || '', a.state || '', a.zip || '', a.country || ''];
        const prop = card.addPropertyWithValue('adr', adrValue);
        if (a.type) prop.setParameter('type', a.type.toLowerCase());
    });

    if (data.company || data.department) {
        const orgValue = [data.company || '', data.department || ''].filter(Boolean);
        if (orgValue.length > 0) card.addPropertyWithValue('org', orgValue);
    }

    if (data.role) card.addPropertyWithValue('title', data.role);

    data.locationAssociations?.forEach((la: any) => {
        const l = la.location;
        if (!l) return;
        if (isPublicRequested && !l.isPublic) return;
        const adrValue = ['', l.addressSuffix || '', `${l.street || ''} ${l.houseNumber || ''}`.trim(), l.city || '', l.state || '', l.zip || '', l.country || ''];
        const prop = card.addPropertyWithValue('adr', adrValue);
        prop.setParameter('type', 'work');
        if (l.name) prop.setParameter('label', l.name);
    });

    const fileName = `${fullName.replace(/\s+/g, '_')}${isPublicRequested ? '_public' : ''}.vcf`;
    const vCardContent = card.toString();

    return new Response(new Uint8Array(Buffer.from(vCardContent)), {
        headers: {
            'Content-Type': 'text/vcard',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Cache-Control': 'public, max-age=60'
        }
    });
};
