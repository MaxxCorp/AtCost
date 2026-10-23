import { query } from '$app/server';
import { db, file, eventFile, announcementFile, and, eq, or, ilike, desc, asc, count, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
	filePaginationSchema as PaginationSchema,
	type FileItem,
	type PaginatedResult
} from '@ac/validations';
import { fileStorageService } from '#lib/server/files/index.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import type * as v from 'valibot';

export const listFiles = query(
	PaginationSchema,
	async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<FileItem>> => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const {
			page = 1,
			limit = 50,
			search = '',
			itemType,
			isArchived,
			entityType,
			entityId,
			sortField = 'updatedAt',
			sortOrder = 'desc'
		} = input || {};
		const offset = (page - 1) * limit;

		const conditions: any[] = [];

		if (search && search.trim()) {
			const q = `%${search.trim()}%`;
			conditions.push(
				or(ilike(file.name, q), ilike(file.description, q), ilike(file.folderPath, q))
			);
		}

		if (itemType && itemType !== 'all') {
			conditions.push(eq(file.itemType, itemType));
		}

		if (isArchived !== undefined && isArchived !== 'all') {
			const archivedBool =
				typeof isArchived === 'string' ? isArchived === 'true' : Boolean(isArchived);
			conditions.push(eq(file.isArchived, archivedBool));
		}

		if (entityType && entityId) {
			let resolvedId = entityId;
			if (entityType === 'event' && entityId.includes('_inst_')) {
				resolvedId = await resolveEventIdForAssociations(entityId, {
					materializeIfVirtual: false
				});
			}
			const assocRows =
				entityType === 'event'
					? await db
							.select({ fileId: eventFile.fileId })
							.from(eventFile)
							.where(eq(eventFile.eventId, resolvedId))
					: await db
							.select({ fileId: announcementFile.fileId })
							.from(announcementFile)
							.where(eq(announcementFile.announcementId, resolvedId));

			const fileIds = assocRows.map((r) => r.fileId);
			if (fileIds.length === 0) {
				return { data: [], total: 0 };
			}
			conditions.push(inArray(file.id, fileIds));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [countResult] = await db.select({ count: count() }).from(file).where(whereClause);
		const total = Number(countResult?.count || 0);

		let orderColumn: any = file.updatedAt;
		if (sortField === 'name') orderColumn = file.name;
		else if (sortField === 'itemType') orderColumn = file.itemType;
		else if (sortField === 'size') orderColumn = file.size;
		else if (sortField === 'createdAt') orderColumn = file.createdAt;
		else if (sortField === 'updatedAt') orderColumn = file.updatedAt;

		const orderFn = sortOrder === 'asc' ? asc : desc;

		const rows = await db.query.file.findMany({
			where: whereClause,
			orderBy: [orderFn(orderColumn)],
			limit,
			offset,
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

		const data: FileItem[] = rows.map((f) => fileStorageService.serializeFile(f as any));

		return {
			data,
			total
		};
	}
);
