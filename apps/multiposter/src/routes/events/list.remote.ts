import { query } from '$app/server';
import { eventPaginationSchema as PaginationSchema } from '@ac/validations';
import { getEntityListChannelName } from '#lib/server/realtime.js';
import { streamLiveQuery } from '#lib/server/live-query.js';
import { queryEventsList } from '#lib/server/events/list-query.js';

export const listEvents = query(PaginationSchema, (input) => queryEventsList(input));

export const listEventsLive = query.live(PaginationSchema, (input) =>
	streamLiveQuery({
		channels: [getEntityListChannelName('event')],
		compute: () => queryEventsList(input)
	})
);
