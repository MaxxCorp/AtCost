import { createAuthClient } from "better-auth/svelte";
import { PUBLIC_BASE_URL } from "$env/static/public";

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

const SESSION_CACHE_TTL_MS = 5000;

export function clearSessionCache(): void {
	cachedSessionResponse = null;
	inFlightSessionPromise = null;
}

const deduplicatedAuthFetch = async (
	url: string | URL | Request,
	init?: RequestInit
): Promise<Response> => {
	const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
	const method = (init?.method || (url instanceof Request ? url.method : "GET")).toUpperCase();

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

	if (method === "GET" && urlStr.includes("/get-session")) {
		const now = Date.now();

		if (cachedSessionResponse && now - cachedSessionResponse.timestamp < SESSION_CACHE_TTL_MS) {
			return new Response(cachedSessionResponse.body, {
				status: cachedSessionResponse.status,
				statusText: cachedSessionResponse.statusText,
				headers: new Headers(cachedSessionResponse.headers),
			});
		}

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
	baseURL: typeof window !== "undefined" ? window.location.origin : (PUBLIC_BASE_URL || "http://localhost:5175"),
	basePath: "/api/auth",
	fetchOptions: {
		customFetchImpl: deduplicatedAuthFetch,
	},
});
