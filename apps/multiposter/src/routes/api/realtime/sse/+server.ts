import type { RequestHandler } from './$types';
import { getEntityChannelName, localRealtimeHub, isServerlessEnvironment } from '$lib/server/realtime';

export const GET: RequestHandler = async (event) => {
    // If in serverless environment, long-lived SSE connections are not supported
    if (isServerlessEnvironment()) {
        return new Response('SSE not supported on serverless runtime without persistent connections', {
            status: 400
        });
    }

    const entityType = event.url.searchParams.get('entityType');
    const entityId = event.url.searchParams.get('entityId');

    if (!entityType || !entityId) {
        return new Response('Missing entityType or entityId query parameters', { status: 400 });
    }

    const channelName = getEntityChannelName(entityType, entityId);
    const user = event.locals.user;
    const requestedClientId = event.url.searchParams.get('clientId');
    const clientId = user?.id || requestedClientId || `anon-${crypto.randomUUID()}`;
    const connectionId = `sse-${crypto.randomUUID()}`;

    const member = {
        clientId,
        connectionId,
        userId: user?.id || clientId,
        name: user?.name || user?.email || event.url.searchParams.get('name') || 'Anonymous',
        email: user?.email,
        avatar: user?.image || event.url.searchParams.get('avatar'),
        color: event.url.searchParams.get('color') ? JSON.parse(event.url.searchParams.get('color')!) : undefined,
        focusedField: null,
        activeAt: Date.now()
    };

    let intervalId: ReturnType<typeof setInterval>;
    let unsubscribeChange: () => void = () => {};
    let unsubscribePresence: () => void = () => {};

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // 1. Initial snapshot
            const initialPayload = JSON.stringify({
                connectionId,
                members: localRealtimeHub.getPresenceMembers(channelName)
            });
            controller.enqueue(encoder.encode(`event: init\ndata: ${initialPayload}\n\n`));

            // 2. Enter presence
            localRealtimeHub.enterPresence(channelName, member);

            // 3. Listen to entity changes
            unsubscribeChange = localRealtimeHub.subscribe(channelName, (changeData) => {
                try {
                    controller.enqueue(encoder.encode(`event: change\ndata: ${JSON.stringify(changeData)}\n\n`));
                } catch {
                    // client closed
                }
            });

            // 4. Listen to presence updates
            unsubscribePresence = localRealtimeHub.subscribe(`${channelName}:presence`, (presenceData) => {
                try {
                    controller.enqueue(encoder.encode(`event: presence\ndata: ${JSON.stringify(presenceData)}\n\n`));
                } catch {
                    // client closed
                }
            });

            // 5. Keepalive comment every 15s to keep proxy/router connections open
            intervalId = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: ping\n\n`));
                } catch {
                    clearInterval(intervalId);
                }
            }, 15000);

            event.request.signal.addEventListener('abort', () => {
                clearInterval(intervalId);
                unsubscribeChange();
                unsubscribePresence();
                localRealtimeHub.leavePresence(channelName, connectionId);
            });
        },
        cancel() {
            clearInterval(intervalId);
            unsubscribeChange();
            unsubscribePresence();
            localRealtimeHub.leavePresence(channelName, connectionId);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
        }
    });
};
