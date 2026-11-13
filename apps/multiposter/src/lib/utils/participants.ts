/**
 * Pure isomorphic helpers for computing event participant headcounts,
 * baselines, and per-contact party size / status state.
 */

export interface ContactParticipantEntry {
	id?: string;
	contactId?: string;
	partySize?: unknown;
	participationStatus?: unknown;
	contact?: {
		id?: string;
		partySize?: unknown;
		participationStatus?: unknown;
	};
}

/**
 * Extracts a contact's ID from either an ID string, a flat contact record,
 * or a nested junction record (`{ contactId, contact: { id } }`).
 */
export function extractContactId(entry: unknown): string | null {
	if (typeof entry === 'string') {
		return entry.trim() || null;
	}
	if (!entry || typeof entry !== 'object') {
		return null;
	}
	const item = entry as ContactParticipantEntry;
	const id = item.contact?.id ?? item.id ?? item.contactId;
	return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Normalizes a party size to a positive integer >= 1.
 */
export function normalizePartySize(raw: unknown): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return 1;
	}
	return Math.max(1, Math.trunc(parsed));
}

/**
 * Normalizes a participation status string.
 */
export function normalizeParticipationStatus(raw: unknown): string {
	return typeof raw === 'string' && raw.trim() ? raw.trim() : 'needsAction';
}

/**
 * Computes the headcount contributed by a single event-contact association.
 * Declined contacts contribute 0; all other statuses contribute their partySize (>= 1).
 */
export function getContactHeadcount(entry: unknown): number {
	if (typeof entry === 'string') {
		return 1;
	}
	if (!entry || typeof entry !== 'object') {
		return 0;
	}
	const item = entry as ContactParticipantEntry;
	const status = normalizeParticipationStatus(
		item.participationStatus ?? item.contact?.participationStatus
	);
	if (status === 'declined') {
		return 0;
	}
	return normalizePartySize(item.partySize ?? item.contact?.partySize ?? 1);
}

/**
 * Extracts normalized contact IDs, party sizes, and participation statuses
 * from `event.contacts` and optional fallback `event.contactIds`.
 */
export function extractContactParticipantState(
	contacts: readonly unknown[] | undefined | null,
	contactIds?: readonly unknown[] | undefined | null
): {
	contactIds: string[];
	partySizes: Record<string, number>;
	participationStatuses: Record<string, string>;
} {
	const orderedIds: string[] = [];
	const seen = new Set<string>();
	const partySizes: Record<string, number> = {};
	const participationStatuses: Record<string, string> = {};

	for (const raw of contacts ?? []) {
		const id = extractContactId(raw);
		if (!id) continue;
		const item = typeof raw === 'object' && raw ? (raw as ContactParticipantEntry) : {};
		partySizes[id] = normalizePartySize(item.partySize ?? item.contact?.partySize ?? 1);
		participationStatuses[id] = normalizeParticipationStatus(
			item.participationStatus ?? item.contact?.participationStatus
		);
		if (!seen.has(id)) {
			seen.add(id);
			orderedIds.push(id);
		}
	}

	for (const rawId of contactIds ?? []) {
		const id = extractContactId(rawId);
		if (!id) continue;
		if (!(id in partySizes)) {
			partySizes[id] = 1;
		}
		if (!(id in participationStatuses)) {
			participationStatuses[id] = 'needsAction';
		}
		if (!seen.has(id)) {
			seen.add(id);
			orderedIds.push(id);
		}
	}

	return {
		contactIds: orderedIds,
		partySizes,
		participationStatuses,
	};
}

/**
 * Sums total effective headcount across linked contact IDs, counting 0 for declined contacts.
 */
export function sumContactsHeadcount(
	ids: readonly string[],
	partySizes: Record<string, number>,
	participationStatuses?: Record<string, string>
): number {
	const seen = new Set<string>();
	let total = 0;
	for (const id of ids) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		total += getContactHeadcount({
			partySize: partySizes[id] ?? 1,
			participationStatus: participationStatuses?.[id],
		});
	}
	return total;
}

/**
 * Parses an initial `participantsCount` field (number or string) to a non-negative integer,
 * or returns undefined if unset/invalid.
 */
export function parseParticipantsCount(raw: unknown): number | undefined {
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		return Math.max(0, Math.trunc(raw));
	}
	if (typeof raw === 'string' && raw.trim() !== '') {
		const parsed = parseInt(raw, 10);
		if (!Number.isNaN(parsed)) {
			return Math.max(0, parsed);
		}
	}
	return undefined;
}

/**
 * Computes the manual/anonymous baseline (`total - contactsHeadcount`, floored at 0)
 * from initial event data.
 */
export function computeInitialBaseline(
	initialParticipantsCount: unknown,
	initialContacts: readonly unknown[] | undefined | null,
	initialContactIds?: readonly unknown[] | undefined | null
): number {
	const initialParticipants = parseParticipantsCount(initialParticipantsCount);
	if (initialParticipants === undefined) {
		return 0;
	}
	const state = extractContactParticipantState(initialContacts, initialContactIds);
	const initialHeadcount = sumContactsHeadcount(
		state.contactIds,
		state.partySizes,
		state.participationStatuses
	);
	return Math.max(0, initialParticipants - initialHeadcount);
}

/**
 * Recomputes baseline and clamped total when the user edits the total participants field directly.
 */
export function applyManualTotalParticipants(
	manualTotal: number,
	contactsHeadcount: number
): { baseline: number; total: number } {
	const safeHeadcount = Math.max(0, Math.trunc(contactsHeadcount));
	const safeInput = Number.isFinite(manualTotal) ? Math.trunc(manualTotal) : safeHeadcount;
	const baseline = Math.max(0, safeInput - safeHeadcount);
	return {
		baseline,
		total: baseline + safeHeadcount,
	};
}

/**
 * Creates a mutable participant-count state controller matching EventForm's runtime logic,
 * useful for verifying all CRUD state transitions in unit tests.
 */
export function createParticipantState(
	initialParticipantsCount: unknown,
	initialContacts: readonly unknown[] | undefined | null = [],
	initialContactIds?: readonly unknown[] | undefined | null
) {
	const initialState = extractContactParticipantState(initialContacts, initialContactIds);
	let contactIds = [...initialState.contactIds];
	let partySizes: Record<string, number> = { ...initialState.partySizes };
	let participationStatuses: Record<string, string> = { ...initialState.participationStatuses };
	let baseline = computeInitialBaseline(initialParticipantsCount, initialContacts, initialContactIds);

	const getContactsHeadcount = () =>
		sumContactsHeadcount(contactIds, partySizes, participationStatuses);

	return {
		getTotal: () => baseline + getContactsHeadcount(),
		getBaseline: () => baseline,
		getContactsHeadcount,
		getContactIds: () => [...contactIds],
		getPartySizes: () => ({ ...partySizes }),
		getParticipationStatuses: () => ({ ...participationStatuses }),
		linkContact: (
			contact: string | { id: string; partySize?: number; participationStatus?: string }
		) => {
			const id = extractContactId(contact);
			if (!id || contactIds.includes(id)) return;
			const entry: { partySize?: number; participationStatus?: string } =
				typeof contact === 'string' ? {} : contact;
			contactIds = [...contactIds, id];
			partySizes = { ...partySizes, [id]: normalizePartySize(entry.partySize ?? 1) };
			participationStatuses = {
				...participationStatuses,
				[id]: normalizeParticipationStatus(entry.participationStatus),
			};
		},
		unlinkContact: (id: string) => {
			contactIds = contactIds.filter((cId) => cId !== id);
			const nextSizes = { ...partySizes };
			delete nextSizes[id];
			partySizes = nextSizes;
			const nextStatuses = { ...participationStatuses };
			delete nextStatuses[id];
			participationStatuses = nextStatuses;
		},
		setContactsFromManager: (ids: string[], items?: any[]) => {
			contactIds = [...ids];
			const nextSizes: Record<string, number> = {};
			const nextStatuses: Record<string, string> = {};
			for (const id of ids) {
				const matched = items?.find((it) => extractContactId(it) === id);
				nextSizes[id] = normalizePartySize(matched?.partySize ?? partySizes[id] ?? 1);
				nextStatuses[id] = normalizeParticipationStatus(
					matched?.participationStatus ?? participationStatuses[id]
				);
			}
			partySizes = nextSizes;
			participationStatuses = nextStatuses;
		},
		setPartySize: (id: string, rawSize: number) => {
			partySizes = { ...partySizes, [id]: normalizePartySize(rawSize) };
		},
		setParticipationStatus: (id: string, status: string) => {
			participationStatuses = {
				...participationStatuses,
				[id]: normalizeParticipationStatus(status),
			};
		},
		shiftBaseline: (delta: number) => {
			baseline = Math.max(0, baseline + delta);
		},
		setManualTotal: (total: number) => {
			const next = applyManualTotalParticipants(total, getContactsHeadcount());
			baseline = next.baseline;
		},
	};
}
