import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Translates hardcoded schema validation error messages to localized strings using the Paraglide messages object.
 */
export function translateIssue(message: string, m: any): string {
	if (!message) return "";

	const keyMap: Record<string, string> = {
		"Name is required": "name_required",
		"Display name is required": "display_name_required",
		"Event title is required": "event_title_required",
		"Title is required": "title_required",
		"Content is required": "content_required",
		"Campaign name is required": "campaign_name_required",
		"Block name is required": "block_name_required",
		"Language code required": "language_code_required",
		"Filename required": "filename_required",
		"Ticket price is required": "ticket_price_required",
		"Resource type is required": "resource_type_required",
		"Provider type is required": "provider_type_required",
		"Start date is required": "start_date_required",
		"End date is required": "end_date_required",
		"Date is required": "date_required",
		"Talent is required": "talent_required",
		"Comment is required": "comment_required",
		"Contact is required": "contact_required",
		"Responsible employee is required": "responsible_employee_required",
		"Next step name is required": "next_step_name_required",
		"At least one working hour field must be configured": "at_least_one_working_hour_required"
	};

	if (message.startsWith("Invalid email")) {
		return m.invalid_email ? m.invalid_email() : message;
	}
	if (message.startsWith("Invalid length") || message === "Required") {
		return m.required_field ? m.required_field() : message;
	}

	const key = keyMap[message];
	if (key && m && typeof m[key] === "function") {
		return m[key]();
	}
	return message;
}

