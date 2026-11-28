import * as v from 'valibot';
import { query } from '$app/server';
import { getRealtimeInfo } from '#lib/server/realtime.js';
import { streamLiveChannel } from '#lib/server/live-query.js';

export const getRealtimeConfig = query(async () => getRealtimeInfo());

export const watchRealtimeChannel = query.live(v.string(), (channel) =>
	streamLiveChannel(channel)
);
