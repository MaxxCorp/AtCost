import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
    schema: '../../packages/db/src/schema/index.ts',
    out: '../../packages/db/drizzle',
    dialect: 'postgresql',
    dbCredentials: { url: DATABASE_URL },
    verbose: true,
    strict: true
});
