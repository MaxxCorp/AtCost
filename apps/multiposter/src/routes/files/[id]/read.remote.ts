import { query } from '$app/server';
import { db, file, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import type { FileItem } from '@ac/validations';
import { fileStorageService } from '#lib/server/files/index.js';

export const readFile = query(v.string(), async (id: string): Promise<FileItem | null> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const f = await db.query.file.findFirst({
		where: eq(file.id, id),
		with: {
			events: {
				with: {
					event: true
				}
			},
			announcements: {
				with: {
					announcement: true
				}
			}
		}
	});

	if (!f) return null;

	return fileStorageService.serializeFile(f as any);
});
