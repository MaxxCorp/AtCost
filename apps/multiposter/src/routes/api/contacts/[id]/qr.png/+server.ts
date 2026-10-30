import { db } from '@ac/db';
import QRCode from 'qrcode';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_BASE_URL, BETTER_AUTH_URL } from '$app/env/private';
import { cachedBinary, cacheKeys } from '#lib/server/cache/index.js';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';

export const GET: RequestHandler = async ({ params, url }) => {
    const contactId = params.id;
    const user = getOptionalUser();
    const isAuthorized = Boolean(user && hasAccess(user, 'contacts'));

    const generateQr = async () => {
        const baseUrl = PUBLIC_BASE_URL || url.origin || BETTER_AUTH_URL || "";
        const contactUrl = `${baseUrl}/contacts/${contactId}/view`;

        const qrBuffer = await QRCode.toBuffer(contactUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#1e40af', // blue-800
                light: '#ffffff'
            }
        });

        return new Uint8Array(qrBuffer);
    };

    try {
        const data = await db.query.contact.findFirst({
            where: (table, { eq }) => eq(table.id, contactId),
        });

        if (!data) {
            error(404, 'Contact not found');
        }

        if ((!data.isPublic || data.obfuscationStatus === 'obfuscated') && !isAuthorized) {
            error(403, 'Forbidden');
        }

        const qrBytes = data.isPublic
            ? await cachedBinary(cacheKeys.contactQr(contactId), 86400, generateQr)
            : await generateQr();

        return new Response(qrBytes as BodyInit, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': data.isPublic ? 'public, max-age=3600, stale-while-revalidate=86400' : 'private, max-age=60'
            }
        });
    } catch (err: any) {
        if (err?.status) throw err;
        throw error(500, err?.message || 'Failed to generate QR code');
    }
};
