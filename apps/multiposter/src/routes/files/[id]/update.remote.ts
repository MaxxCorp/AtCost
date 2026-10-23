import { form, requested } from '$app/server';
import { db, file, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { updateFileSchema } from '@ac/validations';
import { fileStorageService } from '#lib/server/files/index.js';
import { listFiles } from '../list.remote';
import { readFile } from './read.remote';
import { fetchEntityFiles } from '../associate.remote';

export const updateFile = form(updateFileSchema, async (data) => {
	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const [existing] = await db.select().from(file).where(eq(file.id, data.id)).limit(1);
		if (!existing) {
			throw new Error('File not found');
		}

		// If the file is backed by SharePoint/OneDrive and its name changed, rename it externally too
		if (existing.driveId && existing.externalItemId && data.name !== existing.name) {
			try {
				const ctx = await fileStorageService.getInitializedProvider(user.id);
				if (ctx && existing.parentItemId) {
					await ctx.provider.moveOrRenameFolder(
						existing.driveId,
						existing.externalItemId,
						existing.parentItemId,
						data.name
					);
				}
			} catch (err) {
				console.warn('[updateFile] External rename warning:', err);
			}
		}

		const [updated] = await db
			.update(file)
			.set({
				name: data.name,
				description: data.description ?? existing.description,
				targetUrl: data.targetUrl ?? existing.targetUrl,
				webUrl: data.targetUrl && existing.isShortcut ? data.targetUrl : existing.webUrl,
				isArchived:
					data.isArchived !== undefined ? Boolean(data.isArchived) : existing.isArchived,
				updatedAt: new Date()
			})
			.where(eq(file.id, data.id))
			.returning();

		const serialized = fileStorageService.serializeFile(updated);

		try {
			await requested(listFiles, 20).refreshAll();
			await requested(fetchEntityFiles, 20).refreshAll();
			void listFiles().refresh();
			await readFile(data.id).refresh();
		} catch {
			// Ignore
		}

		return {
			success: true,
			data: serialized
		};
	} catch (err: any) {
		return {
			success: false,
			error: {
				message: err?.message || 'Failed to update file'
			}
		};
	}
});
