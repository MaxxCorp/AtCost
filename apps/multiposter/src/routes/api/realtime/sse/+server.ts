import type { RequestHandler } from './$types';
import {
    getEntityChannelName,
    localRealtimeHub,
    isServerlessEnvironment,
    isValidRealtimeChannel
} from '#lib/server/realtime.js';

export const GET: RequestHandler = async (event) => {
    // If in serverless environment, long-lived SSE connections are not supported
    if (isServerlessEnvironment()) {
        return new Response('SSE not supported on serverless runtime without persistent connections', {
            status: 400
        });
    }

    const explicitChannels = event.url.searchParams.getAll('channel').filter(Boolean);
    const entityType = event.url.searchParams.get('entityType');
    const entityId = event.url.searchParams.get('entityId');

    if (explicitChannels.length > 0) {
        for (const ch of explicitChannels) {
            if (!isValidRealtimeChannel(ch)) {
                return new Response(`Invalid realtime channel: ${ch}`, { status: 400 });
            }
        }

        let intervalId: ReturnType<typeof setInterval>;
        const unsubscribers: Array<() => void> = [];

        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode(`event: init\ndata: ${JSON.stringify({ channels: explicitChannels })}\n\n`));

                for (const channel of explicitChannels) {
                    const unsub = localRealtimeHub.subscribe(channel, (changeData) => {
                        try {
                            controller.enqueue(
                                encoder.encode(`event: change\ndata: ${JSON.stringify({ channel, ...changeData })}\n\n`)
                            );
                        } catch {
                            // client closed
                        }
                    });
                    unsubscribers.push(unsub);
                }

                intervalId = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(`: ping\n\n`));
                    } catch {
                        clearInterval(intervalId);
                    }
                }, 15000);

                event.request.signal.addEventListener('abort', () => {
                    clearInterval(intervalId);
                    for (const unsub of unsubscribers) unsub();
                });
            },
            cancel() {
                clearInterval(intervalId);
                for (const unsub of unsubscribers) unsub();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive'
            }
        });
    }

    if (!entityType || !entityId) {
        return new Response('Missing entityType/entityId or channel query parameters', { status: 400 });
    }

    const channelName = getEntityChannelName(entityType, entityId);
    if (!isValidRealtimeChannel(channelName)) {
        return new Response('Invalid entityType or entityId', { status: 400 });
    }

    const user = event.locals.user;
    const requestedClientId = event.url.searchParams.get('clientId');
    const clientId = user?.id || requestedClientId || `anon-${crypto.randomUUID()}`;
    const connectionId = `sse-${crypto.randomUUID()}`;

    let parsedColor: unknown = undefined;
    const rawColor = event.url.searchParams.get('color');
    if (rawColor) {
        try {
            parsedColor = JSON.parse(rawColor);
        } catch {
            parsedColor = undefined;
        }
    }

    const member = {
        clientId,
        connectionId,
        userId: user?.id || clientId,
        name: user?.name || user?.email || event.url.searchParams.get('name') || 'Anonymous',
        email: user?.email,
        avatar: user?.image || event.url.searchParams.get('avatar'),
        color: parsedColor,
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
