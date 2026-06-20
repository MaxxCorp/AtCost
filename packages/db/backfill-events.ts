
import { db } from './src/index';
import { event } from './src/schema/events';
import { isNull } from 'drizzle-orm';

async function main() {
    console.log("Starting backfill for events without endDateTime...");
    const eventsWithoutEnd = await db.select().from(event).where(isNull(event.endDateTime));
    
    console.log(`Found ${eventsWithoutEnd.length} events without endDateTime.`);
    
    for (const e of eventsWithoutEnd) {
        let newEndDateTime: Date;
        if (e.isAllDay) {
            // End of the day for startDateTime
            const start = e.startDateTime ? new Date(e.startDateTime) : new Date();
            newEndDateTime = new Date(start);
            newEndDateTime.setHours(23, 59, 59, 999);
        } else {
            // Start + 1 hour
            const start = e.startDateTime ? new Date(e.startDateTime) : new Date();
            newEndDateTime = new Date(start.getTime() + 60 * 60 * 1000);
        }
        
        await db.update(event)
            .set({ 
                endDateTime: newEndDateTime,
                endTimeZone: e.endTimeZone || e.startTimeZone || 'UTC'
            })
            .where(e.id ? { id: e.id } : { id: e.id }) // Handle drizzle eq
    }
    console.log("Backfill complete.");
    process.exit(0);
}

// wait, the where clause should use eq(event.id, e.id)
import { eq } from 'drizzle-orm';
async function run() {
    const eventsWithoutEnd = await db.select().from(event).where(isNull(event.endDateTime));
    console.log(`Found ${eventsWithoutEnd.length} events without endDateTime.`);
    for (const e of eventsWithoutEnd) {
        let newEndDateTime: Date;
        if (e.isAllDay) {
            const start = e.startDateTime ? new Date(e.startDateTime) : new Date();
            newEndDateTime = new Date(start);
            newEndDateTime.setHours(23, 59, 59, 999);
        } else {
            const start = e.startDateTime ? new Date(e.startDateTime) : new Date();
            newEndDateTime = new Date(start.getTime() + 60 * 60 * 1000);
        }
        await db.update(event)
            .set({ 
                endDateTime: newEndDateTime,
                endTimeZone: e.endTimeZone || e.startTimeZone || 'UTC'
            })
            .where(eq(event.id, e.id));
    }
    console.log("Backfill complete.");
    process.exit(0);
}
run().catch(console.error);
