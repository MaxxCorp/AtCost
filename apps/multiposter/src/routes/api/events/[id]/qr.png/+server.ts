import { db } from '@ac/db';
import { eq } from '@ac/db';
import QRCode from 'qrcode';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ params, url }) => {
    const eventId = params.id;
    const data = await db.query.event.findFirst({
        where: (table, { eq }) => eq(table.id, eventId),
    });

    if (!data) {
        error(404, 'Event not found');
    }

    const baseUrl = env.PUBLIC_BASE_URL || url.origin || env.BETTER_AUTH_URL || "";
    const eventUrl = `${baseUrl}/events/${eventId}/view`;

    const qrBuffer = await QRCode.toBuffer(eventUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#1e40af', // blue-800
            light: '#ffffff'
        }
    });

    return new Response(new Uint8Array(qrBuffer), {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
        }
    });
};
