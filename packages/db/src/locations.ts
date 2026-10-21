import { db } from './db.js';
import {
    location,
    eventLocation,
    kioskLocation,
    resourceLocation,
    announcementLocation,
    locationContact,
    talent,
    type OpeningHoursData,
} from './schema/index.js';
import { eq, and, or, inArray, notInArray, ilike, sql } from 'drizzle-orm';

function normalizeOpeningHours(val: OpeningHoursData | string | null | undefined): OpeningHoursData | null {
    if (!val) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed as OpeningHoursData;
                }
            } catch {
                // fall through
            }
        }
        return { raw: trimmed };
    }
    return val;
}

function parseFilterValueHelper(val: any): { include: string[]; exclude: string[] } {
    if (!val) return { include: [], exclude: [] };
    if (typeof val === 'string') {
        const trimmed = val.trim();
        return { include: trimmed ? [trimmed] : [], exclude: [] };
    }
    if (Array.isArray(val)) {
        return {
            include: val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
            exclude: [],
        };
    }
    if (typeof val === 'object') {
        const inc = val.include ?? val.in;
        const exc = val.exclude ?? val.notIn;
        const toArray = (v: any): string[] => {
            if (!v) return [];
            if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
            if (Array.isArray(v)) return v.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
            return [];
        };
        return {
            include: toArray(inc),
            exclude: toArray(exc),
        };
    }
    return { include: [], exclude: [] };
}

export interface LocationListInput {
    page?: number;
    limit?: number;
    search?: string;
    city?: any;
    associatedWith?: {
        type: string;
        id: string;
    };
    sortField?: 'updatedAt' | 'createdAt' | 'name' | 'displayName';
    sortOrder?: 'asc' | 'desc';
}

export async function listLocations(input?: LocationListInput) {
    const { page = 1, limit = 50, search = '', city, associatedWith, sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: location.id }).from(location).$dynamic();
    const conditions = [];

    if (associatedWith) {
        if (associatedWith.type === 'event') {
            baseQuery = baseQuery.innerJoin(eventLocation, eq(location.id, eventLocation.locationId)) as any;
            conditions.push(eq(eventLocation.eventId, associatedWith.id));
        } else if (associatedWith.type === 'contact') {
            baseQuery = baseQuery.innerJoin(locationContact, eq(location.id, locationContact.locationId)) as any;
            conditions.push(eq(locationContact.contactId, associatedWith.id));
        } else if (associatedWith.type === 'resource') {
            baseQuery = baseQuery.innerJoin(resourceLocation, eq(location.id, resourceLocation.locationId)) as any;
            conditions.push(eq(resourceLocation.resourceId, associatedWith.id));
        } else if (associatedWith.type === 'kiosk') {
            baseQuery = baseQuery.innerJoin(kioskLocation, eq(location.id, kioskLocation.locationId)) as any;
            conditions.push(eq(kioskLocation.kioskId, associatedWith.id));
        } else if (associatedWith.type === 'announcement') {
            baseQuery = baseQuery.innerJoin(announcementLocation, eq(location.id, announcementLocation.locationId)) as any;
            conditions.push(eq(announcementLocation.announcementId, associatedWith.id));
        } else if (associatedWith.type === 'talent') {
            baseQuery = baseQuery
                .innerJoin(locationContact, eq(location.id, locationContact.locationId))
                .innerJoin(talent, eq(locationContact.contactId, talent.contactId)) as any;
            conditions.push(eq(talent.id, associatedWith.id));
        } else {
            conditions.push(sql`1 = 0`);
        }
    }

    if (search) {
        conditions.push(or(
            ilike(location.name, `%${search}%`),
            ilike(location.city, `%${search}%`)
        ));
    }

    if (city) {
        const { include, exclude } = parseFilterValueHelper(city);
        if (include.length > 0) {
            conditions.push(inArray(location.city, include as any));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(location.city, exclude as any));
        }
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
        return { data: [], total: 0 };
    }

    let orderField: any = location.updatedAt;
    if (sortField === 'name' || sortField === 'displayName') orderField = location.name;
    else if (sortField === 'createdAt') orderField = location.createdAt;

    const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

    const paginatedIdsQuery = baseQuery.orderBy(orderExpression).limit(limit).offset(offset);
    const paginatedIds = (await paginatedIdsQuery).map((r) => r.id);

    if (paginatedIds.length === 0) {
        return { data: [], total };
    }

    const rawResults = await db.query.location.findMany({
        where: inArray(location.id, paginatedIds),
        with: { user: true },
        orderBy: [orderExpression]
    });

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
}

export async function getLocationById(id: string) {
    const [result] = await db
        .select()
        .from(location)
        .where(eq(location.id, id));
    if (!result) return null;
    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };
}

export interface LocationInsertData {
    userId?: string | null;
    name: string;
    description?: string | null;
    capacity?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    addressSuffix?: string | null;
    zip?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    roomId?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    what3words?: string | null;
    inclusivitySupport?: string | null;
    openingHours?: OpeningHoursData | string | null;
    isPublic?: boolean;
    heroImage?: string | null;
}

export async function createLocation(data: LocationInsertData, userId?: string) {
    const insertData: any = {
        userId: userId ?? data.userId ?? null,
        name: data.name,
        description: data.description || null,
        capacity: data.capacity || null,
        street: data.street || null,
        houseNumber: data.houseNumber || null,
        addressSuffix: data.addressSuffix || null,
        zip: data.zip || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        roomId: data.roomId || null,
        latitude: data.latitude ? parseFloat(String(data.latitude)) : null,
        longitude: data.longitude ? parseFloat(String(data.longitude)) : null,
        what3words: data.what3words || null,
        inclusivitySupport: data.inclusivitySupport || null,
        openingHours: normalizeOpeningHours(data.openingHours),
        isPublic: data.isPublic ?? false,
        heroImage: data.heroImage || null,
    };

    if (insertData.latitude && isNaN(insertData.latitude)) insertData.latitude = null;
    if (insertData.longitude && isNaN(insertData.longitude)) insertData.longitude = null;

    const result = await db.insert(location as any).values(insertData).returning();
    if (result.length === 0) {
        throw new Error('Failed to create location');
    }
    const row = result[0];
    return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export async function updateLocation(id: string, data: Partial<LocationInsertData>) {
    const updateData: any = {
        name: data.name,
        description: data.description || null,
        capacity: data.capacity || null,
        street: data.street || null,
        houseNumber: data.houseNumber || null,
        addressSuffix: data.addressSuffix || null,
        zip: data.zip || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        roomId: data.roomId || null,
        latitude: data.latitude ? parseFloat(String(data.latitude)) : null,
        longitude: data.longitude ? parseFloat(String(data.longitude)) : null,
        what3words: data.what3words || null,
        inclusivitySupport: data.inclusivitySupport || null,
        openingHours: normalizeOpeningHours(data.openingHours),
        isPublic: data.isPublic ?? false,
        heroImage: data.heroImage || null,
        updatedAt: new Date(),
    };

    if (updateData.latitude && isNaN(updateData.latitude)) updateData.latitude = null;
    if (updateData.longitude && isNaN(updateData.longitude)) updateData.longitude = null;

    const result = await db.update(location)
        .set(updateData)
        .where(eq(location.id, id))
        .returning();

    if (result.length === 0) {
        throw new Error('Location not found or update failed');
    }
    const row = result[0];
    return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export async function deleteLocations(ids: string[]) {
    await db.delete(location).where(inArray(location.id, ids));
    return { success: true };
}

export async function addLocationAssociation(data: { type: string; entityId: string; locationId: string }) {
    const { type, entityId, locationId } = data;
    if (type === 'event') {
        await db.insert(eventLocation).values({ eventId: entityId, locationId }).onConflictDoNothing();
    } else if (type === 'contact') {
        await db.insert(locationContact).values({ locationId, contactId: entityId }).onConflictDoNothing();
    } else if (type === 'talent') {
        const t = await db.query.talent.findFirst({ where: eq(talent.id, entityId) });
        if (t) {
            await db.insert(locationContact).values({ locationId, contactId: t.contactId }).onConflictDoNothing();
        }
    } else if (type === 'resource') {
        await db.insert(resourceLocation).values({ resourceId: entityId, locationId }).onConflictDoNothing();
    } else if (type === 'kiosk') {
        await db.insert(kioskLocation).values({ kioskId: entityId, locationId }).onConflictDoNothing();
    } else if (type === 'announcement') {
        await db.insert(announcementLocation).values({ announcementId: entityId, locationId }).onConflictDoNothing();
    } else {
        throw new Error(`Unsupported association type: ${type}`);
    }
    return { success: true };
}

export async function removeLocationAssociation(data: { type: string; entityId: string; locationId: string }) {
    const { type, entityId, locationId } = data;
    if (type === 'event') {
        await db.delete(eventLocation).where(and(eq(eventLocation.eventId, entityId), eq(eventLocation.locationId, locationId)));
    } else if (type === 'contact') {
        await db.delete(locationContact).where(and(eq(locationContact.locationId, locationId), eq(locationContact.contactId, entityId)));
    } else if (type === 'talent') {
        const t = await db.query.talent.findFirst({ where: eq(talent.id, entityId) });
        if (t) {
            await db.delete(locationContact).where(and(eq(locationContact.locationId, locationId), eq(locationContact.contactId, t.contactId)));
        }
    } else if (type === 'resource') {
        await db.delete(resourceLocation).where(and(eq(resourceLocation.resourceId, entityId), eq(resourceLocation.locationId, locationId)));
    } else if (type === 'kiosk') {
        await db.delete(kioskLocation).where(and(eq(kioskLocation.kioskId, entityId), eq(kioskLocation.locationId, locationId)));
    } else if (type === 'announcement') {
        await db.delete(announcementLocation).where(and(eq(announcementLocation.announcementId, entityId), eq(announcementLocation.locationId, locationId)));
    } else {
        throw new Error(`Unsupported association type: ${type}`);
    }
    return { success: true };
}

export async function fetchEntityLocations(data: { type: string; entityId: string }) {
    let { type, entityId } = data;
    if (type === 'event' && entityId.includes('_inst_')) {
        entityId = entityId.split('_inst_')[0];
    }
    let results: { location: typeof location.$inferSelect }[] = [];
    if (type === 'event') {
        results = await db.select({ location }).from(eventLocation).innerJoin(location, eq(eventLocation.locationId, location.id)).where(eq(eventLocation.eventId, entityId));
    } else if (type === 'contact') {
        results = await db.select({ location }).from(locationContact).innerJoin(location, eq(locationContact.locationId, location.id)).where(eq(locationContact.contactId, entityId));
    } else if (type === 'talent') {
        const t = await db.query.talent.findFirst({ where: eq(talent.id, entityId) });
        if (t) {
            results = await db.select({ location }).from(locationContact).innerJoin(location, eq(locationContact.locationId, location.id)).where(eq(locationContact.contactId, t.contactId));
        }
    } else if (type === 'resource') {
        results = await db.select({ location }).from(resourceLocation).innerJoin(location, eq(resourceLocation.locationId, location.id)).where(eq(resourceLocation.resourceId, entityId));
    } else if (type === 'kiosk') {
        results = await db.select({ location }).from(kioskLocation).innerJoin(location, eq(kioskLocation.locationId, location.id)).where(eq(kioskLocation.kioskId, entityId));
    } else if (type === 'announcement') {
        results = await db.select({ location }).from(announcementLocation).innerJoin(location, eq(announcementLocation.locationId, location.id)).where(eq(announcementLocation.announcementId, entityId));
    } else {
        throw new Error(`Unsupported association type: ${type}`);
    }
    return results.map(r => ({
        ...r.location,
        createdAt: r.location.createdAt instanceof Date ? r.location.createdAt.toISOString() : (r.location.createdAt ? String(r.location.createdAt) : ''),
        updatedAt: r.location.updatedAt instanceof Date ? r.location.updatedAt.toISOString() : (r.location.updatedAt ? String(r.location.updatedAt) : ''),
    }));
}
