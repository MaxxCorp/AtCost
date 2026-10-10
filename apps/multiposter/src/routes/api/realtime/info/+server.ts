import type { RequestHandler } from './$types';
import { getRealtimeInfo } from '#lib/server/realtime.js';

export const GET: RequestHandler = async () => {
    return Response.json(getRealtimeInfo());
};
