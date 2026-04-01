import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// Connection string for the database
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/atcost';

// For edge environments or build time, we might not have a connection string
// but we still need to export the db object for type safety.
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
