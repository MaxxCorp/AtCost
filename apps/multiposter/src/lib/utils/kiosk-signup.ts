import * as m from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatRecurrenceText } from './format-recurrence.js';
import {
	formatKioskSignUpCompact,
	formatSignUpClosureTimeText,
	isSignUpClosed,
	normalizeSignUpRecurrence
} from './event-signup.js';

/**
 * Formats an event's mandatory sign-up closure date (or recurring deadline for compressed series)
 * and alternative contact into a concise inline string for kiosk displays.
 */
export function getKioskSignUpText(
	event:
		| {
				signUpMode?: string | null;
				signUpClosureDate?: string | Date | null;
				signUpRecurrence?: string[] | string | null;
				seriesMaster?: { id?: string; signUpRecurrence?: string[] | string | null } | null;
				isCompressedSeries?: boolean;
				seriesDates?: unknown[];
				seriesInstances?: Array<{ id?: string; signUpClosureDate?: string | Date | null }>;
				instanceCount?: number;
				resolvedSignUpContact?: {
					name?: string | null;
					phone?: string | null;
					email?: string | null;
				} | null;
		  }
		| null
		| undefined
): string {
	const locale = getLocale();
	const recurrenceRules = normalizeSignUpRecurrence(
		event?.signUpRecurrence ?? event?.seriesMaster?.signUpRecurrence
	);
	const isMultiOccurrenceSeries = Boolean(
		event?.isCompressedSeries &&
			((event.seriesDates?.length ?? 0) > 1 ||
				(event.seriesInstances?.length ?? 0) > 1 ||
				(event.instanceCount ?? 0) > 1)
	);

	let recurringDeadlineLabel: string | undefined;
	let allOccurrencesClosed: boolean | undefined;

	if (isMultiOccurrenceSeries && recurrenceRules) {
		const recText = formatRecurrenceText(recurrenceRules, {
			short: true,
			includeEnd: false,
			locale,
			dtstart: event?.signUpClosureDate ?? undefined
		});
		if (recText) {
			const timeText = formatSignUpClosureTimeText(
				event?.signUpClosureDate,
				locale,
				undefined,
				true
			);
			recurringDeadlineLabel = timeText ? `${recText} ${timeText}` : recText;
			if (event?.seriesInstances && event.seriesInstances.length > 0) {
				allOccurrencesClosed = event.seriesInstances.every(
					(inst) =>
						inst?.signUpClosureDate != null &&
						isSignUpClosed(event.signUpMode, inst.signUpClosureDate)
				);
			}
		}
	}

	return formatKioskSignUpCompact(
		event,
		{
			req: m.kiosk_sign_up_req(),
			by: (date) => m.kiosk_sign_up_by({ date }),
			orContact: (contact) => m.kiosk_sign_up_or_contact({ contact }),
			closed: m.kiosk_sign_up_closed()
		},
		locale,
		undefined,
		recurringDeadlineLabel ? { recurringDeadlineLabel, allOccurrencesClosed } : undefined
	);
}
