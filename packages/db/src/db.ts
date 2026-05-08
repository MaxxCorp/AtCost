import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Lazy initialization helper for the database connection.
 * This ensures we don't try to connect during build time and 
 * that we pick up the environment variables from the running app.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _connectionString: string | null = null;

/**
 * Sets the database connection string explicitly.
 * Should be called during application initialization (e.g. in hooks or auth).
 */
export function setConnectionString(url: string) {
    _connectionString = url;
}

function getDb() {
    if (!_db) {
        // We use process.env here because this is a shared package
        // that might be used outside of SvelteKit (e.g. in scripts).
        let connectionString = _connectionString || process.env.DATABASE_URL || 'postgres://localhost:5432/atcost';
        
        // Clean up surrounding quotes from process.env if they exist
        connectionString = connectionString.replace(/^"|"$/g, '');
        
        const client = postgres(connectionString, { prepare: false });
        _db = drizzle(client, { schema });
    }
    return _db;
}

/**
 * The unified Drizzle database instance for the entire monorepo.
 * Using a Proxy ensures it's initialized lazily on first access.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get(target, prop) {
        const database = getDb();
        return database[prop as keyof typeof database];
    }
});
