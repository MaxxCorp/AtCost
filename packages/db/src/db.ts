import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';
import * as dotenv from 'dotenv';
import { join } from 'path';

const { Pool } = pg;

// Lazy initialization - only create connection when db is actually accessed
// This prevents DATABASE_URL checks during build time (Cloudflare Pages build phase)
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _connectionString: string | null = null;

/**
 * Manually set the database connection string.
 * Useful for SvelteKit apps that want to pass $env/dynamic/private variables.
 */
export function setDatabaseUrl(url: string) {
	_connectionString = url;
	_db = null;
}

function getDb() {
	if (!_db) {
		// Try to load .env if process.env.DATABASE_URL is missing
		if (!process.env.DATABASE_URL && !_connectionString) {
			try {
				dotenv.config({ path: join(process.cwd(), '.env') });
			} catch (e) {
				// Ignore errors if .env is missing
			}
		}

		const connectionString = _connectionString || process.env.DATABASE_URL || 'postgres://localhost:5432/atcost';
		
		// Clean up surrounding quotes from process.env if they exist
		const cleanConnectionString = connectionString.replace(/^"|"$/g, '');
		
		const pool = new Pool({ connectionString: cleanConnectionString });
		_db = drizzle(pool, { schema });
	}
	return _db;
}

// Export a Proxy that lazily initializes the connection
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(target, prop) {
		const database = getDb();
		return database[prop as keyof typeof database];
	}
});

