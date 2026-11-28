import * as v from 'valibot';
import { query } from '$app/server';
import { getEntityChannelName } from '#lib/server/realtime.js';
import { streamLiveQuery } from '#lib/server/live-query.js';
import { queryEventById } from '#lib/server/events/read-query.js';

export const readEvent = query(v.string(), (eventId) => queryEventById(eventId));

export const readEventLive = query.live(v.string(), (eventId) => {
	const channels = [getEntityChannelName('event', eventId)];
	const instIdx = eventId.indexOf('_inst_');
	if (instIdx > 0) {
		channels.push(getEntityChannelName('event', eventId.slice(0, instIdx)));
	}
	return streamLiveQuery({
		channels,
		compute: () => queryEventById(eventId)
	});
});
