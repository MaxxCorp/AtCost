import { query } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '@ac/db';
import { getOptionalUser, parseRoles } from '$lib/server/authorization';
import { desc, type InferSelectModel } from 'drizzle-orm';
import { appendFileSync } from 'fs';
import { join } from 'path';

export type User = InferSelectModel<typeof user>;

const REMOTE_LOG = join(process.cwd(), 'debug_remote_v4.txt');
function log(msg: string) {
    appendFileSync(REMOTE_LOG, `${new Date().toISOString()} ${msg}\n`);
}

export const listUsers = query(async (): Promise<User[]> => {
    try {
        const currentUser = getOptionalUser();
        if (!currentUser) throw new Error('Unauthorized');
        
        const roles = parseRoles(currentUser);
        if (!roles.includes('admin')) {
            throw new Error('Forbidden: Admin access only');
        }

        return await db
            .select()
            .from(user)
            .orderBy(desc(user.createdAt));
    } catch (error: any) {
        console.error(`[listUsers] Error: ${error.message}`);
        throw error;
    }
});
