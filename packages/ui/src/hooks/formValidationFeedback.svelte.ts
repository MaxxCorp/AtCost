// src/hooks/formValidationFeedback.svelte.ts
import { toast } from 'svelte-sonner';
import { tick } from 'svelte';

export interface FormValidationFeedbackOptions {
	/**
	 * Explicit HTMLFormElement or getter function returning the form element.
	 * Can also be omitted if using the returned `formAction` on `<form>`.
	 */
	form?: HTMLFormElement | (() => HTMLFormElement | null | undefined) | null;

	/**
	 * Custom error message or message getter (e.g., `() => m.please_fix_validation()`).
	 * Defaults to "Please fix the validation errors in the form."
	 */
	message?: string | (() => string);

	/**
	 * Optional callback invoked whenever client-side validation fails.
	 */
	onValidationFailed?: (issues: any[], firstElement: HTMLElement | null) => void;
}

/**
 * Extracts validation issues from a SvelteKit remote function / form instance.
 */
export function extractIssues(target: any): Array<{ path?: (string | number)[]; message?: string; name?: string }> {
	if (!target) return [];
	const resolved = typeof target === 'function' ? target() : target;
	if (!resolved) return [];

	// SvelteKit Remote Functions proxy: resolved.fields.allIssues()
	if (typeof resolved.fields?.allIssues === 'function') {
		try {
			const issues = resolved.fields.allIssues();
			if (Array.isArray(issues) && issues.length > 0) return issues;
		} catch {
			// Ignore potential proxy errors
		}
	}

	// Direct allIssues method
	if (typeof resolved.allIssues === 'function') {
		try {
			const issues = resolved.allIssues();
			if (Array.isArray(issues) && issues.length > 0) return issues;
		} catch {
			// Ignore potential proxy errors
		}
	}

	// Direct issues array or method
	if (Array.isArray(resolved.issues)) return resolved.issues;
	if (typeof resolved.issues === 'function') {
		try {
			const issues = resolved.issues();
			if (Array.isArray(issues)) return issues;
		} catch {
			// Ignore potential errors
		}
	}

	return [];
}

/**
 * Returns a visible, actionable target element from a potentially hidden element.
 */
function getVisibleTarget(el: HTMLElement): HTMLElement {
	if (el instanceof HTMLInputElement && el.type === 'hidden') {
		// Try finding a related visible element or container
		const container = el.closest('label, .form-group, .space-y-2, .space-y-1, [data-field-wrapper], div:not([hidden])');
		if (container && container instanceof HTMLElement && container.tagName !== 'FORM') {
			return container;
		}
		if (el.parentElement && el.parentElement instanceof HTMLElement && el.parentElement.tagName !== 'FORM') {
			return el.parentElement;
		}
	}
	return el;
}

/**
 * Checks whether an element is suitable as a visible target.
 */
function isVisibleOrUsable(el: HTMLElement): boolean {
	if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
	return true;
}

/**
 * Finds the first invalid DOM element corresponding to the issues within a given root or the document.
 */
export function findFirstInvalidElement(
	root: HTMLElement | Document | null | undefined,
	issues: Array<{ path?: (string | number)[]; message?: string; name?: string }>
): HTMLElement | null {
	if (typeof document === 'undefined') return null;
	const scope = root || document;

	// 1. Try to find the element for the first issue by its path segments
	const firstIssue = issues[0];
	if (firstIssue) {
		const pathSegments = firstIssue.path ?? (firstIssue.name ? [firstIssue.name] : []);
		const candidates: string[] = [];
		if (pathSegments.length > 0) {
			candidates.push(pathSegments.join('.'));
			candidates.push(String(pathSegments[pathSegments.length - 1]));
			candidates.push(String(pathSegments[0]));
		}

		for (const candidate of candidates) {
			if (!candidate) continue;

			// Check [name*="..."]
			try {
				const byName = scope.querySelector<HTMLElement>(`[name*="${candidate}"]`);
				if (byName && isVisibleOrUsable(byName)) return getVisibleTarget(byName);
			} catch {}

			// Check #id
			try {
				const byId = scope.querySelector<HTMLElement>(`#${CSS.escape(candidate)}`);
				if (byId && isVisibleOrUsable(byId)) return getVisibleTarget(byId);
			} catch {}

			// Check [data-field="..."] or [data-testid="..."]
			try {
				const byData = scope.querySelector<HTMLElement>(`[data-field="${candidate}"], [data-testid="${candidate}"]`);
				if (byData && isVisibleOrUsable(byData)) return getVisibleTarget(byData);
			} catch {}
		}
	}

	// 2. SvelteKit standard aria-invalid="true" attribute
	try {
		const byAria = scope.querySelector<HTMLElement>('[aria-invalid="true"]');
		if (byAria) return getVisibleTarget(byAria);
	} catch {}

	// 3. Fallback to error indicators or containers
	try {
		const byError = scope.querySelector<HTMLElement>('.border-destructive, [data-fs-error], [aria-errormessage]');
		if (byError) return getVisibleTarget(byError);
	} catch {}

	// 4. Last resort: any match for candidate even if hidden
	if (firstIssue) {
		const pathSegments = firstIssue.path ?? [];
		if (pathSegments.length > 0) {
			const candidate = String(pathSegments[0]);
			try {
				const anyMatch = scope.querySelector<HTMLElement>(`[name*="${candidate}"], #${CSS.escape(candidate)}`);
				if (anyMatch) return getVisibleTarget(anyMatch);
			} catch {}
		}
	}

	return null;
}

/**
 * Highlights a form field with an animated glow and scrolls it into view.
 */
export function highlightAndScrollToElement(element: HTMLElement | null): void {
	if (!element || typeof window === 'undefined') return;

	// 1. Smooth scroll to center of viewport
	try {
		element.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'nearest'
		});
	} catch {
		element.scrollIntoView();
	}

	// 2. Focus if focusable
	try {
		if (
			typeof element.focus === 'function' &&
			!(element instanceof HTMLInputElement && element.type === 'hidden')
		) {
			element.focus({ preventScroll: true });
		}
	} catch {
		// Ignore focus errors
	}

	// 3. Visual pulse highlight
	try {
		element.classList.add('ring-2', 'ring-destructive', 'ring-offset-2');

		if (typeof element.animate === 'function') {
			const animation = element.animate(
				[
					{
						outline: '3px solid #ef4444',
						boxShadow: '0 0 0 6px rgba(239, 68, 68, 0.35)',
						transform: 'scale(1.01)'
					},
					{
						outline: '3px solid #ef4444',
						boxShadow: '0 0 0 8px rgba(239, 68, 68, 0.45)',
						transform: 'scale(1.02)'
					},
					{
						outline: '2px solid #ef4444',
						boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.25)',
						transform: 'scale(1)'
					},
					{
						outline: '2px solid #ef4444',
						boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.1)',
						transform: 'scale(1)'
					},
					{
						outline: '',
						boxShadow: '',
						transform: 'scale(1)'
					}
				],
				{
					duration: 2500,
					easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
					iterations: 1
				}
			);

			animation.onfinish = () => {
				element.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2');
			};
		} else {
			setTimeout(() => {
				element.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2');
			}, 2500);
		}
	} catch (e) {
		console.warn('[formValidationFeedback] Error highlighting element:', e);
	}
}

/**
 * Shared Svelte 5 hook providing:
 * - Error toast on client-side (preflight) validation issues
 * - Smooth scroll to the first invalid field
 * - Highlighting of the invalid field
 * - Optional Svelte action `formAction` for `<form use:feedback.formAction ...>`
 */
export function useFormValidationFeedback(
	remoteFunction: any | (() => any),
	options: FormValidationFeedbackOptions = {}
) {
	let capturedFormEl = $state<HTMLFormElement | null>(null);
	let prevIssuesLength = $state(0);
	let lastToastTime = 0;

	const getFormElement = (): HTMLFormElement | null => {
		if (typeof options.form === 'function') return options.form() ?? null;
		if (options.form) return options.form;
		return capturedFormEl;
	};

	const getMessage = (): string => {
		if (typeof options.message === 'function') return options.message();
		if (typeof options.message === 'string') return options.message;
		return 'Please fix the validation errors in the form.';
	};

	const triggerFeedback = (issues: any[], explicitTarget?: HTMLElement | null) => {
		if (issues.length === 0) return;

		const now = Date.now();
		if (now - lastToastTime > 1000) {
			lastToastTime = now;
			toast.error(getMessage());
		}

		// Wait a tick and small timeout for DOM to update with error attributes/messages
		void tick().then(() => {
			setTimeout(() => {
				const formEl = getFormElement();
				const firstEl = explicitTarget ?? findFirstInvalidElement(formEl, issues);
				if (firstEl) {
					highlightAndScrollToElement(firstEl);
				}
				options.onValidationFailed?.(issues, firstEl);
			}, 50);
		});
	};

	// Reactive effect on issues count
	$effect(() => {
		const issues = extractIssues(remoteFunction);
		const currentLength = issues.length;

		if (currentLength > 0 && currentLength !== prevIssuesLength) {
			triggerFeedback(issues);
		}
		prevIssuesLength = currentLength;
	});

	// Automatic capture listener on submit events to handle repeated submit attempts
	$effect(() => {
		if (typeof document === 'undefined') return;

		const handleSubmit = (event: Event) => {
			const target = event.target as HTMLElement | null;
			setTimeout(() => {
				const issues = extractIssues(remoteFunction);
				if (issues.length > 0) {
					const formEl = target instanceof HTMLFormElement ? target : target?.closest('form') ?? getFormElement();
					const firstEl = findFirstInvalidElement(formEl, issues);
					if (firstEl) {
						triggerFeedback(issues, firstEl);
					}
				}
			}, 60);
		};

		document.addEventListener('submit', handleSubmit, { capture: true });

		return () => {
			document.removeEventListener('submit', handleSubmit, { capture: true });
		};
	});

	// Svelte action for `<form use:feedback.formAction ...>` (optional helper)
	function formAction(node: HTMLFormElement) {
		capturedFormEl = node;
		return {
			destroy() {
				if (capturedFormEl === node) capturedFormEl = null;
			}
		};
	}

	return {
		formAction,
		trigger: () => {
			const issues = extractIssues(remoteFunction);
			if (issues.length > 0) triggerFeedback(issues);
		},
		get issues() {
			return extractIssues(remoteFunction);
		}
	};
}
