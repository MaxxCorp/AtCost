import { createSubscriber } from 'svelte/reactivity';

export interface QueryState<T = any> {
	readonly current: T | undefined;
	readonly loading: boolean;
	readonly error: any;
}

/**
 * Resolves either a SvelteKit RemoteQuery (`'current' in q`) or a plain Promise/value
 * without `$effect`, using Svelte 5 `createSubscriber` for plain promises.
 */
export function usePromiseOrRemoteQuery<T = any>(getQuery: () => any): QueryState<T> {
	let lastQ: any = undefined;
	let plainData: T | undefined = undefined;
	let plainLoading = false;
	let plainError: any = null;
	let updateFn: (() => void) | null = null;

	const subscribe = createSubscriber((update) => {
		updateFn = update;
		return () => {
			updateFn = null;
		};
	});

	function ensurePlainAttached(q: any) {
		if (!q || (typeof q === 'object' && 'current' in q) || q === lastQ) return;
		lastQ = q;
		if (typeof q.then === 'function') {
			plainLoading = true;
			plainError = null;
			plainData = undefined;
			q.then(
				(val: T) => {
					if (lastQ === q) {
						plainData = val;
						plainLoading = false;
						updateFn?.();
					}
				},
				(err: any) => {
					if (lastQ === q) {
						plainError = err;
						plainLoading = false;
						updateFn?.();
					}
				}
			);
		} else {
			plainData = q;
			plainLoading = false;
			plainError = null;
		}
	}

	return {
		get current() {
			const q = getQuery();
			if (!q) return undefined;
			if (typeof q === 'object' && 'current' in q) return q.current;
			subscribe();
			ensurePlainAttached(q);
			return plainData;
		},
		get loading() {
			const q = getQuery();
			if (!q) return false;
			if (typeof q === 'object' && 'loading' in q) {
				return Boolean(q.loading && q.current === undefined);
			}
			subscribe();
			ensurePlainAttached(q);
			return plainLoading;
		},
		get error() {
			const q = getQuery();
			if (!q) return null;
			if (typeof q === 'object' && 'error' in q) return q.error;
			subscribe();
			ensurePlainAttached(q);
			return plainError;
		}
	};
}
