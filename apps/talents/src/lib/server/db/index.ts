import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@ac/db/schema';
import { env } from '$env/dynamic/private';

// Connection string handling
let connectionString = env.DATABASE_URL || process.env.DATABASE_URL || 'postgres://postgres:Soulhunter1!@localhost:5432/AtCost';

// Clean up surrounding quotes from .env if they exist
connectionString = connectionString.replace(/^"|"$/g, '');

const client = postgres(connectionString);

/**
 * The standard type-safe Drizzle instance for the talents application.
 * Using this locally ensures we pick up app-specific environment variables correctly.
 */
export const db = drizzle(client, { schema });

// Re-export all schema objects directly from the schema entry point
export * from '@ac/db/schema';

// Re-export reporting-line helpers
export { getSuperior, getDirectReports, getSubordinateTree } from '@ac/db';

// Re-export all Drizzle helpers and types
export { 
    sql, eq, ne, inArray, isNull, isNotNull, 
    and, or, asc, desc, ilike, like,
    type InferSelectModel, type InferInsertModel
} from 'drizzle-orm';
