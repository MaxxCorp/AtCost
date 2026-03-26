import { command } from '$app/server';
import { db } from '$lib/server/db';
import { event, recurringSeries } from '@ac/db';
import { eq, or } from 'drizzle-orm';
import { listEvents } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { publishEventChange } from '$lib/server/realtime';
import { syncService } from '$lib/server/sync/service';
import { getStorageProvider } from '$lib/server/blob-storage';

/**
 * Command: Delete an entire recurring series.
 * Accepts any event ID from the series and deletes:
 * 1. All events with the same seriesId
 * 2. The recurring_series record itself
 * 
 * For backward compatibility, also deletes events linked via recurringEventId.
 */
export const deleteSeries = command(
    v.string(), // Single event ID from the series
    async (eventId: string) => {
        console.log('--- deleteSeries START ---');
        console.log('Event ID:', eventId);

        const user = getAuthenticatedUser();
        ensureAccess(user, 'events');

        // Find the event to get its series info
        const [targetEvent] = await db
            .select()
            .from(event)
            .where(eq(event.id, eventId));

        if (!targetEvent) {
            throw new Error('Event not found');
        }

        const deletedEventIds: string[] = [];
        const storage = getStorageProvider();

        // Strategy 1: Delete by seriesId (new schema)
        if (targetEvent.seriesId) {
            // Get all events in this series for notification and asset cleanup
            const seriesEvents = await db
                .select({ 
                    id: event.id,
                    qrCodePath: event.qrCodePath,
                    iCalPath: event.iCalPath
                })
                .from(event)
                .where(eq(event.seriesId, targetEvent.seriesId));

            deletedEventIds.push(...seriesEvents.map(e => e.id));

            // Trigger sync deletion before local events are gone
            await syncService.deleteEventMappings(user.id, deletedEventIds);

            // Delete all events in the series
            await db.delete(event).where(eq(event.seriesId, targetEvent.seriesId));

            // Delete the series record
            await db.delete(recurringSeries).where(eq(recurringSeries.id, targetEvent.seriesId));

            // Clean up assets
            for (const e of seriesEvents) {
                if (e.qrCodePath) await storage.delete(e.qrCodePath);
                if (e.iCalPath) await storage.delete(e.iCalPath);
            }

            console.log(`Deleted ${seriesEvents.length} events and series record ${targetEvent.seriesId}`);
        }

        // Strategy 2: Delete by recurringEventId (legacy schema)
        // Find the master event ID - either this event IS the master, or it points to one
        const masterId = targetEvent.recurringEventId || targetEvent.id;

        // Get all events linked to this master
        const legacyEvents = await db
            .select({ 
                id: event.id,
                qrCodePath: event.qrCodePath,
                iCalPath: event.iCalPath
            })
            .from(event)
            .where(or(
                eq(event.id, masterId),
                eq(event.recurringEventId, masterId)
            ));

        const legacyIds = legacyEvents
            .map(e => e.id)
            .filter(id => !deletedEventIds.includes(id));

        if (legacyIds.length > 0) {
            // Trigger sync deletion
            await syncService.deleteEventMappings(user.id, legacyIds);

            deletedEventIds.push(...legacyIds);

            // Clean up legacy assets
            const legacyToClean = legacyEvents.filter(e => legacyIds.includes(e.id));
            for (const e of legacyToClean) {
                if (e.qrCodePath) await storage.delete(e.qrCodePath);
                if (e.iCalPath) await storage.delete(e.iCalPath);
            }

            // Delete master and all instances
            await db.delete(event).where(or(
                eq(event.id, masterId),
                eq(event.recurringEventId, masterId)
            ));

            console.log(`Deleted ${legacyIds.length} events via legacy recurringEventId`);
        }

        // Publish deletion events
        if (deletedEventIds.length > 0) {
            await publishEventChange('delete', deletedEventIds);
        }

        await listEvents().refresh();

        console.log('--- deleteSeries DONE ---');
        return { success: true, deletedCount: deletedEventIds.length };
    }
);
