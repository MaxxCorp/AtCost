import { query, command, requested } from '$app/server';
import {
    checkContactEncryptionStatus as checkStatusCore,
    startContactEncryptionMigration as startMigrationCore,
    processContactEncryptionBatch as processBatchCore,
} from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
    processContactEncryptionBatchSchema,
    type ContactEncryptionStatus,
} from '@ac/validations';
import { listContacts } from './list.remote';
import { bumpNamespaceVersion, CACHE_NAMESPACES } from '#lib/server/cache/index.js';

export const checkContactEncryptionStatus = query(async (): Promise<ContactEncryptionStatus> => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'contacts');
    return await checkStatusCore();
});

export const startContactEncryptionMigration = command(async (): Promise<{
    operationId: string;
    total: number;
    done: boolean;
}> => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'contacts');
    return await startMigrationCore();
});

export const processContactEncryptionBatch = command(
    processContactEncryptionBatchSchema,
    async (input): Promise<{
        processed: number;
        total: number;
        done: boolean;
        errors: string[];
    }> => {
        const authUser = getAuthenticatedUser();
        ensureAccess(authUser, 'contacts');

        const actor = {
            userId: authUser.id,
            name: (authUser as any).name || authUser.email,
            email: authUser.email,
            role: Array.isArray((authUser as any).roles) ? (authUser as any).roles[0] : 'admin',
        };

        const result = await processBatchCore({
            operationId: input.operationId,
            batchSize: input.batchSize || 25,
            actor,
        });

        if (result.done) {
            await bumpNamespaceVersion(CACHE_NAMESPACES.CONTACTS);
            void checkContactEncryptionStatus().refresh();
            try { await requested(listContacts, 20).refreshAll(); } catch { /* ignore */ }
            void listContacts().refresh();
            void listContacts({}).refresh();
        }

        return result;
    },
);

