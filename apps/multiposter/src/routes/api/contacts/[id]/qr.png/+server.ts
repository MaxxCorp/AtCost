import { db } from '@ac/db';
import QRCode from 'qrcode';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_BASE_URL, BETTER_AUTH_URL } from '$app/env/private';
import { cachedBinary, cacheKeys } from '#lib/server/cache/index.js';

export const GET: RequestHandler = async ({ params, url }) => {
    const contactId = params.id;

    try {
        const qrBytes = await cachedBinary(cacheKeys.contactQr(contactId), 86400, async () => {
            const data = await db.query.contact.findFirst({
                where: (table, { eq }) => eq(table.id, contactId),
            });

            if (!data) {
                error(404, 'Contact not found');
            }

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
        });

        return new Response(qrBytes as BodyInit, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
            }
        });
    } catch (err: any) {
        if (err?.status) throw err;
        throw error(500, err?.message || 'Failed to generate QR code');
    }
};

