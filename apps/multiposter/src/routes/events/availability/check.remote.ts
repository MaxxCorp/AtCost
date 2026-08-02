import { query } from '$app/server';
import * as v from 'valibot';
import { db, resource, contact, contactEmail, contactTag, tag, eq, inArray } from '@ac/db';
import { availabilityService } from '$lib/server/availability/service';
import { getAuthenticatedUser } from '$lib/server/authorization';

const checkAvailabilitySchema = v.object({
    startDateTime: v.pipe(v.string(), v.minLength(1)),
    endDateTime: v.pipe(v.string(), v.minLength(1)),
    eventId: v.optional(v.string()),
    resourceIds: v.optional(v.array(v.string())),
    contactIds: v.optional(v.array(v.string())),
});

export const checkEventAvailability = query(checkAvailabilitySchema, async (input) => {
    try {
        const user = getAuthenticatedUser();
        const startDateTime = new Date(input.startDateTime);
        const endDateTime = new Date(input.endDateTime);

        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            return {
                resourceAvailability: {},
                contactAvailability: {}
            };
        }

        // 1. Fetch internal resources (those with allocationCalendars)
        const resourceQuery = db
            .select({
                id: resource.id,
                allocationCalendars: resource.allocationCalendars
            })
            .from(resource);

        const dbResources = (input.resourceIds && input.resourceIds.length > 0)
            ? await resourceQuery.where(inArray(resource.id, input.resourceIds))
            : await resourceQuery;

        const targetResources = dbResources.filter(r => {
            let cals = r.allocationCalendars;
            if (!cals) return false;
            if (typeof cals === 'string') {
                try { cals = JSON.parse(cals); } catch { return false; }
            }
            return Array.isArray(cals) && cals.length > 0;
        });

        // 2. Fetch internal contacts (only those tagged with "Employee")
        const contactQuery = db
            .select({
                contactId: contact.id,
                tagName: tag.name,
                primaryEmail: contactEmail.value
            })
            .from(contact)
            .innerJoin(contactTag, eq(contact.id, contactTag.contactId))
            .innerJoin(tag, eq(contactTag.tagId, tag.id))
            .leftJoin(contactEmail, eq(contact.id, contactEmail.contactId));

        const employeeContacts = (input.contactIds && input.contactIds.length > 0)
            ? await contactQuery.where(inArray(contact.id, input.contactIds))
            : await contactQuery;

        const employeeMap = new Map<string, string | undefined>();
        for (const row of employeeContacts) {
            const tagName = (row.tagName || '').toLowerCase();
            if (tagName === 'employee' || tagName === 'employees') {
                if (!employeeMap.has(row.contactId) || row.primaryEmail) {
                    employeeMap.set(row.contactId, row.primaryEmail || undefined);
                }
            }
        }

        const targetContacts = Array.from(employeeMap.entries()).map(([id, email]) => ({ id, email }));

        if (targetResources.length === 0 && targetContacts.length === 0) {
            return {
                resourceAvailability: {},
                contactAvailability: {}
            };
        }

        const result = await availabilityService.checkAvailability({
            startDateTime,
            endDateTime,
            currentEventId: input.eventId,
            resources: targetResources,
            contacts: targetContacts,
            userId: user?.id
        });

        return result;
    } catch (err) {
        console.error('[checkEventAvailability] Error:', err);
        return {
            resourceAvailability: {},
            contactAvailability: {}
        };
    }
});
