import * as m from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatKioskSignUpCompact } from './event-signup.js';

/**
 * Formats an event's mandatory sign-up closure date & alternative contact
 * into a concise inline string for kiosk displays.
 */
export function getKioskSignUpText(
	event:
		| {
				signUpMode?: string | null;
				signUpClosureDate?: string | Date | null;
				resolvedSignUpContact?: {
					name?: string | null;
					phone?: string | null;
					email?: string | null;
				} | null;
		  }
		| null
		| undefined
): string {
	return formatKioskSignUpCompact(
		event,
		{
			req: m.kiosk_sign_up_req(),
			by: (date) => m.kiosk_sign_up_by({ date }),
			closed: m.kiosk_sign_up_closed()
		},
		getLocale()
	);
}
