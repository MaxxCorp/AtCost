import { command, requested } from '$app/server';
import { db, file, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { fileStorageService } from '#lib/server/files/index.js';
import { listFiles } from '../list.remote';
import { fetchEntityFiles } from '../associate.remote';
import * as v from 'valibot';

export const deleteFiles = command(v.array(v.string()), async (ids: string[]) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	if (ids.length === 0) return { success: true };

	// Attempt to delete external items if backed by SharePoint/OneDrive
	try {
		const rows = await db.select().from(file).where(inArray(file.id, ids));
		const ctx = await fileStorageService.getInitializedProvider(user.id);
		if (ctx) {
			for (const r of rows) {
				if (r.driveId && r.externalItemId && !r.externalItemId.startsWith('link-')) {
					try {
						await ctx.provider.deleteExternalItem(r.driveId, r.externalItemId);
					} catch {
						// Ignore if already deleted externally
					}
				}
			}
		}
	} catch {
		// Ignore cloud errors when deleting DB records
	}

	await db.delete(file).where(inArray(file.id, ids));

	try {
		await requested(listFiles, 10).refreshAll();
		await requested(fetchEntityFiles, 10).refreshAll();
		void listFiles().refresh();
	} catch {
		// Ignore
	}

	return { success: true };
});
