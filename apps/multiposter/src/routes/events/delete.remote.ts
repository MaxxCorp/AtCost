import { command } from '$app/server';
import { db } from '$lib/server/db';
import { event } from '@ac/db';
import { inArray } from 'drizzle-orm';
import { listEvents } from './list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { syncService } from '$lib/server/sync/service';
import { publishEventChange } from '$lib/server/realtime';

import { getStorageProvider } from '$lib/server/blob-storage';

/**
 * Command for bulk deleting events
 */
export const deleteEvents = command(v.array(v.string()), async (ids: string[]) => {
  const user = getAuthenticatedUser();
  ensureAccess(user, 'events');

  if (ids.length === 0) return { success: true };

  // Trigger sync deletion first (before local event is gone)
  await syncService.deleteEventMappings(user.id, ids);

  // Fetch events to get asset paths before deletion
  const eventsToDelete = await db.query.event.findMany({
    where: (table, { inArray }) => inArray(table.id, ids),
    columns: {
      id: true,
      qrCodePath: true,
      iCalPath: true
    }
  });

  // Detach child instances that reference any of the to-be-deleted events
  // via recurringEventId, so they are NOT cascade-deleted.
  await db.update(event)
    .set({ recurringEventId: null })
    .where(inArray(event.recurringEventId, ids));

  // Also clear seriesId on the events being deleted so the cascade from
  // recurring_series does not interfere (series record itself stays intact).
  await db.update(event)
    .set({ seriesId: null })
    .where(inArray(event.id, ids));

  await db.delete(event).where(inArray(event.id, ids));

  // Notify of deletion
  await publishEventChange('delete', ids);

  // Clean up assets from storage
  const storage = getStorageProvider();
  for (const eventItem of eventsToDelete) {
    if (eventItem.qrCodePath) {
      await storage.delete(eventItem.qrCodePath);
    }
    if (eventItem.iCalPath) {
      await storage.delete(eventItem.iCalPath);
    }
  }

  await listEvents().refresh();
  return { success: true };
});
