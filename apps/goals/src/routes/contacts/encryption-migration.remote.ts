import { query, command, requested } from '$app/server';
import { processContactEncryptionBatchSchema, type ContactEncryptionStatus } from '@ac/validations';
import {
    checkContactEncryptionStatus,
    startContactEncryptionMigration,
    processContactEncryptionBatch,
} from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { ensureGoalsTablesAndSeed } from '#lib/server/goals/service.js';
import { listContacts } from './list.remote';

export const getEncryptionStatus = query(async (): Promise<ContactEncryptionStatus> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');
    await ensureGoalsTablesAndSeed();

    return await checkContactEncryptionStatus();
});

export const beginEncryptionMigration = command(async () => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const res = await startContactEncryptionMigration();
    void getEncryptionStatus().refresh();
    return res;
});

export const runEncryptionBatch = command(
    processContactEncryptionBatchSchema,
    async (input) => {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');

        const res = await processContactEncryptionBatch({
            operationId: input.operationId,
            batchSize: input.batchSize ?? 25,
            actor: {
                userId: user.id,
                name: user.name ?? null,
                email: user.email ?? null,
            },
        });

        void getEncryptionStatus().refresh();
        if (res.done) {
            try {
                await requested(listContacts, 20).refreshAll();
            } catch {
                // ignore
            }
            void listContacts().refresh();
            void listContacts({}).refresh();
        }
        return res;
    }
);
