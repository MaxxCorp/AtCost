import { command } from '$app/server';
import { db } from '@ac/db';
import { event, recurringSeries } from '@ac/db';
import { inArray, eq, or } from '@ac/db';
import { listEvents } from './list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { syncService } from '$lib/server/sync/service';
import { publishEventChange } from '$lib/server/realtime';
import { getStorageProvider } from '$lib/server/blob-storage';

/**
 * Command for bulk deleting events or series
 */
export const deleteEvents = command(
  v.object({
    ids: v.array(v.string()),
    deleteSeries: v.optional(v.boolean())
  }),
  async ({ ids, deleteSeries }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    if (ids.length === 0) return { success: true };

    const storage = getStorageProvider();
    const deletedEventIds: string[] = [];

    if (deleteSeries) {
      // Fetch all target events to gather series info
      const targetEvents = await db.query.event.findMany({
        where: (table, { inArray }) => inArray(table.id, ids),
        columns: {
          id: true,
          seriesId: true,
          recurringEventId: true
        }
      });

      const seriesIdsToProcess = new Set<string>();
      const legacyMasterIdsToProcess = new Set<string>();

      for (const e of targetEvents) {
        if (e.seriesId) {
          seriesIdsToProcess.add(e.seriesId);
        }
        legacyMasterIdsToProcess.add(e.recurringEventId || e.id);
      }

      // 1. New schema: Delete by seriesId
      if (seriesIdsToProcess.size > 0) {
        const seriesIdArray = Array.from(seriesIdsToProcess);
        const seriesEvents = await db.query.event.findMany({
          where: (table, { inArray }) => inArray(table.seriesId, seriesIdArray),
          columns: { id: true, qrCodePath: true, iCalPath: true }
        });

        const currentDeletedIds = seriesEvents.map(e => e.id);
        deletedEventIds.push(...currentDeletedIds);

        if (currentDeletedIds.length > 0) {
          await syncService.deleteEventMappings(user.id, currentDeletedIds);
        }

        await db.delete(event).where(inArray(event.seriesId, seriesIdArray));
        await db.delete(recurringSeries).where(inArray(recurringSeries.id, seriesIdArray));

        for (const e of seriesEvents) {
          if (e.qrCodePath && e.qrCodePath.startsWith('http')) await storage.delete(e.qrCodePath);
          if (e.iCalPath && e.iCalPath.startsWith('http')) await storage.delete(e.iCalPath);
        }
      }

      // 2. Legacy schema: Delete by recurringEventId
      if (legacyMasterIdsToProcess.size > 0) {
        const legacyMasterIdArray = Array.from(legacyMasterIdsToProcess);
        const legacyEvents = await db.query.event.findMany({
          where: (table, { inArray, or }) => or(
            inArray(table.id, legacyMasterIdArray),
            inArray(table.recurringEventId, legacyMasterIdArray)
          ),
          columns: { id: true, qrCodePath: true, iCalPath: true }
        });

        const legacyIds = legacyEvents.map(e => e.id).filter(id => !deletedEventIds.includes(id));
        if (legacyIds.length > 0) {
          await syncService.deleteEventMappings(user.id, legacyIds);
          deletedEventIds.push(...legacyIds);

          const legacyToClean = legacyEvents.filter(e => legacyIds.includes(e.id));
          for (const e of legacyToClean) {
            if (e.qrCodePath && e.qrCodePath.startsWith('http')) await storage.delete(e.qrCodePath);
            if (e.iCalPath && e.iCalPath.startsWith('http')) await storage.delete(e.iCalPath);
          }

          await db.delete(event).where(or(
            inArray(event.id, legacyMasterIdArray),
            inArray(event.recurringEventId, legacyMasterIdArray)
          ));
        }
      }
    } else {
      // Just delete the specific IDs
      const eventsToDelete = await db.query.event.findMany({
        where: (table, { inArray }) => inArray(table.id, ids),
        columns: { id: true, qrCodePath: true, iCalPath: true }
      });

      deletedEventIds.push(...ids);
      await syncService.deleteEventMappings(user.id, ids);

      await db.delete(event).where(inArray(event.id, ids));

      for (const e of eventsToDelete) {
        if (e.qrCodePath && e.qrCodePath.startsWith('http')) await storage.delete(e.qrCodePath);
        if (e.iCalPath && e.iCalPath.startsWith('http')) await storage.delete(e.iCalPath);
      }
    }

    if (deletedEventIds.length > 0) {
      await publishEventChange('delete', deletedEventIds);
    }

    void listEvents().refresh();
    return { success: true, deletedCount: deletedEventIds.length };
  }
);
