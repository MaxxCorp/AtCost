import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Lazy initialization - only create connection when db is actually accessed
// This prevents DATABASE_URL checks during build time (Cloudflare Pages build phase)
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
	if (!_db) {
		if (!env.DATABASE_URL) {
			throw new Error('DATABASE_URL is not set');
		}
		const client = postgres(env.DATABASE_URL);
		_db = drizzle(client, { schema });
	}
	return _db;
}

// Export a Proxy that lazily initializes the connection
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(target, prop) {
		return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
	}
});
