import { db, eq, sql } from '@ac/db';
import QRCode from 'qrcode';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { cachedBinary, cacheKeys } from '$lib/server/cache';

export const GET: RequestHandler = async ({ params, url }) => {
    const eventId = params.id;

    try {
        const qrBytes = await cachedBinary(cacheKeys.eventQr(eventId), 86400, async () => {
            let data: any = null;
            const isVirtual = eventId.includes('_inst_');

            if (isVirtual) {
                const [masterId, instIso] = eventId.split('_inst_');
                const decodedIso = decodeURIComponent(instIso);
                data = await db.query.event.findFirst({
                    where: (table, { and, eq, or }) => and(
                        eq(table.recurringEventId, masterId),
                        or(
                            sql`${table.originalStartTime}->>'dateTime' = ${instIso}`,
                            sql`${table.originalStartTime}->>'dateTime' = ${decodedIso}`
                        )
                    ),
                });

                if (!data) {
                    data = await db.query.event.findFirst({
                        where: (table, { eq }) => eq(table.id, masterId),
                    });
                    if (data && instIso) {
                        const masterExdates = Array.isArray(data.exdates) ? (data.exdates as string[]) : [];
                        const targetDate = new Date(decodedIso);
                        if (!isNaN(targetDate.getTime())) {
                            const isExcluded = masterExdates.some(ex => {
                                const exTime = new Date(ex).getTime();
                                return !isNaN(exTime) && Math.abs(exTime - targetDate.getTime()) < 60000;
                            });
                            if (isExcluded) {
                                data = undefined;
                            }
                        }
                    }
                }
            } else {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
                if (isUuid) {
                    data = await db.query.event.findFirst({
                        where: (table, { eq }) => eq(table.id, eventId),
                    });
                }
            }

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

