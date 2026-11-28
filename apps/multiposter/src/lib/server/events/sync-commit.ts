import { requested } from '$app/server';
import { invalidateEvent } from '#lib/server/cache/index.js';
import { publishEventChange, type EventChangeType, type RealtimeActor } from '#lib/server/realtime.js';
import { listEvents, listEventsLive } from '../../../routes/events/list.remote.js';
import { readEvent, readEventLive } from '../../../routes/events/[id]/read.remote.js';

/**
 * Expand physical and virtual event IDs so that any virtual instance
 * (`<masterId>_inst_<iso>`) also invalidates/notifies its series master.
 */
export function expandAffectedEventIds(
	ids: Iterable<string | null | undefined>,
	extraMasterIds?: Iterable<string | null | undefined>
): string[] {
	const expanded = new Set<string>();

	const addId = (raw: string | null | undefined) => {
		if (!raw) return;
		expanded.add(raw);
		const instIdx = raw.indexOf('_inst_');
		if (instIdx > 0) {
			expanded.add(raw.slice(0, instIdx));
		}
	};

	for (const id of ids) addId(id);
	if (extraMasterIds) {
		for (const id of extraMasterIds) addId(id);
	}

	return Array.from(expanded);
}

export interface CommitEventChangeOptions {
	action: EventChangeType;
	ids: Iterable<string | null | undefined>;
	masterIds?: Iterable<string | null | undefined>;
	user?: { id: string; name?: string | null; email?: string | null } | null;
	originTabId?: string;
	extraRefresh?: () => Promise<void> | void;
}

/**
 * Commit an event mutation cleanly in strict order:
 * 1. Invalidate Redis namespace + event detail cache entries (BEFORE broadcasting).
 * 2. Refresh single-flight SvelteKit queries requested by the calling tab (if inside a remote request).
 * 3. Publish realtime invalidation across Ably & local SSE for other tabs / collaborators / kiosks.
 */
export async function commitEventChange(options: CommitEventChangeOptions): Promise<string[]> {
	const affectedIds = expandAffectedEventIds(options.ids, options.masterIds);

	// 1. Invalidate Redis cache first so any refetch triggered by realtime sees fresh DB state
	await invalidateEvent(affectedIds);

	// 2. Refresh active client-requested remote queries & live queries in the same single-flight response
	try {
		await requested(listEvents, 50).refreshAll();
	} catch {
		// Outside remote function execution (e.g. REST webhook or unit test)
	}
	try {
		await requested(listEventsLive, 50).reconnectAll();
	} catch {
		// ignore
	}
	try {
		await requested(readEvent, 50).refreshAll();
	} catch {
		// ignore
	}
	try {
		await requested(readEventLive, 50).reconnectAll();
	} catch {
		// ignore
	}
	try {
		await Promise.allSettled(affectedIds.map((id) => readEvent(id).refresh()));
	} catch {
		// ignore
	}
	try {
		await Promise.allSettled(affectedIds.map((id) => readEventLive(id).reconnect()));
	} catch {
		// ignore
	}
	try {
		void listEvents().refresh();
		void listEvents({}).refresh();
	} catch {
		// ignore
	}
	try {
		void listEventsLive().reconnect();
		void listEventsLive({}).reconnect();
	} catch {
		// ignore
	}
	if (options.extraRefresh) {
		try {
			await options.extraRefresh();
		} catch {
			// ignore
		}
	}

	// 3. Notify all collaborators, other open tabs of the same user, and kiosks
	if (affectedIds.length > 0) {
		const actor: RealtimeActor | undefined = options.user
			? {
					id: options.user.id,
					name: options.user.name || undefined,
					email: options.user.email || undefined
				}
			: undefined;

		await publishEventChange(options.action, affectedIds, actor, options.originTabId);
	}

	return affectedIds;
}
