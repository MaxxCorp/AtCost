import { createAuthClient } from "better-auth/svelte";

interface CachedSessionResponse {
	body: string;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	timestamp: number;
}

let inFlightSessionPromise: Promise<{
	body: string;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	ok: boolean;
}> | null = null;

let cachedSessionResponse: CachedSessionResponse | null = null;

/**
 * Time-to-live for cached session responses in milliseconds.
 * 5 seconds deduplicates rapid subsequent calls (e.g. across multiple mounting components
 * or swift client navigations) while remaining responsive to status updates.
 */
const SESSION_CACHE_TTL_MS = 5000;

/**
 * Manually invalidate the in-memory session cache.
 * Useful after custom login, logout, or user profile mutations.
 */
export function clearSessionCache(): void {
	cachedSessionResponse = null;
	inFlightSessionPromise = null;
}

/**
 * Custom fetch implementation for Better Auth that:
 * 1. Deduplicates concurrent in-flight requests to `/api/auth/get-session` across all components.
 * 2. Caches successful 200 OK session responses for `SESSION_CACHE_TTL_MS`.
 * 3. Automatically purges the cache when any mutation action occurs (sign-in, sign-out, session revocation).
 * 4. Yields a fresh `Response` instance to every caller to avoid "body stream already read" errors.
 */
const deduplicatedAuthFetch = async (
	url: string | URL | Request,
	init?: RequestInit
): Promise<Response> => {
	const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
	const method = (init?.method || (url instanceof Request ? url.method : "GET")).toUpperCase();

	// Invalidate cache immediately on mutating auth requests
	if (
		method === "POST" &&
		(urlStr.includes("/sign-out") ||
			urlStr.includes("/sign-in") ||
			urlStr.includes("/sign-up") ||
			urlStr.includes("/revoke") ||
			urlStr.includes("/update-user") ||
			urlStr.includes("/update-session"))
	) {
		clearSessionCache();
	}

	// Intercept and deduplicate session checks
	if (method === "GET" && urlStr.includes("/get-session")) {
		const now = Date.now();

		// 1. Return fresh cached response if available
		if (cachedSessionResponse && now - cachedSessionResponse.timestamp < SESSION_CACHE_TTL_MS) {
			return new Response(cachedSessionResponse.body, {
				status: cachedSessionResponse.status,
				statusText: cachedSessionResponse.statusText,
				headers: new Headers(cachedSessionResponse.headers),
			});
		}

		// 2. Attach to existing in-flight request, or dispatch a new one
		if (!inFlightSessionPromise) {
			inFlightSessionPromise = (async () => {
				try {
					const res = await fetch(url, init);
					const bodyText = await res.text();
					const headersRecord: Record<string, string> = {};
					res.headers.forEach((val, key) => {
						headersRecord[key] = val;
					});

					const data = {
						body: bodyText,
						status: res.status,
						statusText: res.statusText,
						headers: headersRecord,
						ok: res.ok,
					};

					if (res.ok) {
						cachedSessionResponse = {
							body: bodyText,
							status: res.status,
							statusText: res.statusText,
							headers: headersRecord,
							timestamp: Date.now(),
						};
					}

					return data;
				} finally {
					inFlightSessionPromise = null;
				}
			})();
		}

		const result = await inFlightSessionPromise;
		return new Response(result.body, {
			status: result.status,
			statusText: result.statusText,
			headers: new Headers(result.headers),
		});
	}

	return fetch(url, init);
};

export const authClient = createAuthClient({
	baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
	basePath: "/api/auth",
	fetchOptions: {
		customFetchImpl: deduplicatedAuthFetch,
	},
});
