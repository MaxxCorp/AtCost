import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { schema: (input) => input ?? '' },
	PUBLIC_BASE_URL: { public: true, static: true },
	BETTER_AUTH_SECRET: { schema: (input) => input ?? '' },
	BETTER_AUTH_URL: { schema: (input) => input ?? '' },
	GOOGLE_CLIENT_ID: { schema: (input) => input ?? '' },
	GOOGLE_CLIENT_SECRET: { schema: (input) => input ?? '' },
	MICROSOFT_CLIENT_ID: { schema: (input) => input ?? '' },
	MICROSOFT_CLIENT_SECRET: { schema: (input) => input ?? '' },
	MICROSOFT_TENANT_ID: { schema: (input) => input ?? '' },
	REDIS_URL: { schema: (input) => input ?? '' }
});
