import { command } from '$app/server';
import { db } from '$lib/server/db';
import { event } from '@ac/db';
import { inArray, eq, and } from 'drizzle-orm';
import { listEvents } from './list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

import { getStorageProvider } from '$lib/server/blob-storage';

/**
 * Command for bulk deleting events
 */
export const deleteEvents = command(v.array(v.string()), async (ids: string[]) => {
  const user = getAuthenticatedUser();
  ensureAccess(user, 'events');

  if (ids.length === 0) return { success: true };

  // Fetch events to get asset paths before deletion
  const eventsToDelete = await db.query.event.findMany({
    where: (table, { inArray }) => inArray(table.id, ids),
    columns: {
      id: true,
      qrCodePath: true,
      iCalPath: true
    }
  });

  await db.delete(event).where(inArray(event.id, ids));

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
