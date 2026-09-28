export interface VirtualInstanceDiffInput {
	master: {
		summary?: string | null;
		description?: string | null;
		internalNotes?: string | null;
		status?: string | null;
		categoryBerlinDotDe?: string | null;
		heroImage?: string | null;
		ticketPrice?: string | null;
		ticketPriceUnknown?: boolean | null;
		isAllDay?: boolean | null;
		isPublic?: boolean | null;
		guestsCanInviteOthers?: boolean | null;
		guestsCanModify?: boolean | null;
		guestsCanSeeOtherGuests?: boolean | null;
		participantsCount?: number | null;
		startDateTime?: Date | string | null;
		endDateTime?: Date | string | null;
		reminders?: any;
	};
	submitted: {
		summary?: string | null;
		description?: string | null;
		internalNotes?: string | null;
		status?: string | null;
		categoryBerlinDotDe?: string | null;
		heroImage?: string | null;
		ticketPrice?: string | null;
		ticketPriceUnknown?: boolean | string | null;
		isAllDay?: boolean | string | null;
		isPublic?: boolean | string | null;
		guestsCanInviteOthers?: boolean | string | null;
		guestsCanModify?: boolean | string | null;
		guestsCanSeeOtherGuests?: boolean | string | null;
		participantsCount?: number | string | null;
		reminders?: any;
	};
	targetStart: Date;
	targetEnd: Date;
	submittedStart?: Date | null;
	submittedEnd?: Date | null;
	associations?: {
		masterLocationIds?: string[];
		submittedLocationIds?: string[];
		masterResourceIds?: string[];
		submittedResourceIds?: string[];
		masterContactIds?: string[];
		submittedContactIds?: string[];
		masterTags?: string[];
		submittedTags?: string[];
		masterSyncIds?: string[];
		submittedSyncIds?: string[];
	};
}

const strNorm = (v: any) => (v === undefined || v === null ? '' : String(v)).trim();

/**
 * Compares a submitted update against the master event's inherited fields
 * for a virtual recurrence occurrence.
 * Returns true if ANY field or association has changed, signifying that
 * a real database exception should be created.
 * Returns false if all submitted values match the virtual instance defaults,
 * meaning no new exception row is needed.
 */
export function hasVirtualInstanceChanged(input: VirtualInstanceDiffInput): boolean {
	const { master, submitted, targetStart, targetEnd, submittedStart, submittedEnd, associations } = input;

	// Check dates and times (allow small tolerance for second/subsecond differences)
	if (submittedStart && Math.abs(submittedStart.getTime() - targetStart.getTime()) >= 1000) {
		return true;
	}
	if (submittedEnd && Math.abs(submittedEnd.getTime() - targetEnd.getTime()) >= 1000) {
		return true;
	}

	// Text and basic metadata
	if (submitted.summary !== undefined && strNorm(submitted.summary) !== strNorm(master.summary)) return true;
	if (submitted.description !== undefined && strNorm(submitted.description) !== strNorm(master.description)) return true;
	if (submitted.internalNotes !== undefined && strNorm(submitted.internalNotes) !== strNorm(master.internalNotes)) return true;
	if (submitted.status !== undefined && strNorm(submitted.status) !== strNorm(master.status)) return true;
	if (submitted.categoryBerlinDotDe !== undefined && strNorm(submitted.categoryBerlinDotDe) !== strNorm(master.categoryBerlinDotDe)) return true;
	if (submitted.heroImage !== undefined && strNorm(submitted.heroImage) !== strNorm(master.heroImage)) return true;

	// Pricing & participants
	if (submitted.ticketPrice !== undefined && strNorm(submitted.ticketPrice) !== strNorm(master.ticketPrice)) return true;
	if (submitted.ticketPriceUnknown !== undefined && Boolean(submitted.ticketPriceUnknown) !== Boolean(master.ticketPriceUnknown)) return true;
	if (submitted.participantsCount !== undefined && Number(submitted.participantsCount || 0) !== Number(master.participantsCount || 0)) return true;

	// Booleans
	if (submitted.isAllDay !== undefined && Boolean(submitted.isAllDay) !== Boolean(master.isAllDay)) return true;
	if (submitted.isPublic !== undefined && Boolean(submitted.isPublic) !== Boolean(master.isPublic)) return true;
	if (submitted.guestsCanInviteOthers !== undefined && Boolean(submitted.guestsCanInviteOthers) !== Boolean(master.guestsCanInviteOthers)) return true;
	if (submitted.guestsCanModify !== undefined && Boolean(submitted.guestsCanModify) !== Boolean(master.guestsCanModify)) return true;
	if (submitted.guestsCanSeeOtherGuests !== undefined && Boolean(submitted.guestsCanSeeOtherGuests) !== Boolean(master.guestsCanSeeOtherGuests)) return true;

	// Reminders
	if (submitted.reminders !== undefined) {
		if (JSON.stringify(submitted.reminders || null) !== JSON.stringify(master.reminders || null)) {
			return true;
		}
	}

	// Associations
	if (associations) {
		const {
			masterLocationIds,
			submittedLocationIds,
			masterResourceIds,
			submittedResourceIds,
			masterContactIds,
			submittedContactIds,
			masterTags,
			submittedTags,
			masterSyncIds,
			submittedSyncIds,
		} = associations;

		if (submittedLocationIds !== undefined && masterLocationIds !== undefined) {
			const mSet = new Set(masterLocationIds);
			const sSet = new Set(submittedLocationIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedResourceIds !== undefined && masterResourceIds !== undefined) {
			const mSet = new Set(masterResourceIds);
			const sSet = new Set(submittedResourceIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedContactIds !== undefined && masterContactIds !== undefined) {
			const mSet = new Set(masterContactIds);
			const sSet = new Set(submittedContactIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedTags !== undefined && masterTags !== undefined) {
			const mSet = new Set(masterTags.filter(n => n !== 'Series'));
			const sSet = new Set(submittedTags.filter(n => n !== 'Series'));
			if (mSet.size !== sSet.size || [...mSet].some(n => !sSet.has(n))) return true;
		}

		if (submittedSyncIds !== undefined && masterSyncIds !== undefined) {
			const mSet = new Set(masterSyncIds);
			const sSet = new Set(submittedSyncIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}
	}

	return false;
}
