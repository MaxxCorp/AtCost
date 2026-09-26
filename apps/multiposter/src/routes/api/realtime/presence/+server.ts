import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEntityChannelName, localRealtimeHub } from '$lib/server/realtime';

export const POST: RequestHandler = async (event) => {
    try {
        const body = await event.request.json();
        const { entityType, entityId, connectionId, focusedField } = body;

        if (!entityType || !entityId || !connectionId) {
            return json({ error: 'Missing parameters' }, { status: 400 });
        }

        const channelName = getEntityChannelName(entityType, entityId);
        localRealtimeHub.updatePresence(channelName, connectionId, {
            focusedField: focusedField ?? null
        });

        return json({ ok: true });
    } catch (err) {
        return json({ error: 'Failed to update presence' }, { status: 500 });
    }
};
