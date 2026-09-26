import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRealtimeInfo } from '$lib/server/realtime';

export const GET: RequestHandler = async () => {
    return json(getRealtimeInfo());
};
