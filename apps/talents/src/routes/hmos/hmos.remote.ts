import { query, form, command, requested } from '$app/server';
import { db, desc, asc, and, or, ilike, sql, eq, inArray, hmo } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { syncConditions } from '#lib/server/conditions/service.js';
import {
    hmoPaginationSchema,
    createHmoSchema,
    updateHmoSchema,
    syncConditionsSchema,
    DEFAULT_GERMAN_HMO_RATES,
} from '@ac/validations';
import * as v from 'valibot';

export const listHmos = query(hmoPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'hmos');

    const { page = 1, limit = 50, search = '', category = 'all' } = input || {};
    const offset = (page - 1) * limit;

    // Check & seed / sync default statutory providers if not present
    for (const item of DEFAULT_GERMAN_HMO_RATES) {
        const existing = await db.query.hmo.findFirst({
            where: or(
                eq(hmo.name, item.name),
                item.code ? eq(hmo.code, item.code) : sql`false`
            ),
        });

        if (!existing) {
            await db.insert(hmo).values({
                name: item.name,
                code: item.code || null,
                category: item.category || 'health',
                type: item.type || 'statutory',
                ikNumber: item.ikNumber || null,
                betriebsnummer: item.betriebsnummer || null,
                additionalContributionPercent: item.additionalContributionPercent ?? 2.50,
                u1Rates: (item as any).u1Rates || null,
                u1DefaultCompensationPercent: (item as any).u1DefaultCompensationPercent ?? 70,
                u2Rate: (item as any).u2Rate ?? 0.44,
                u3Rate: (item as any).u3Rate ?? 0.15,
                accidentGefahrklasse: (item as any).accidentGefahrklasse ?? null,
                accidentBeitragsfuss: (item as any).accidentBeitragsfuss ?? null,
                accidentGefahrtarifstelle: (item as any).accidentGefahrtarifstelle ?? null,
                accidentMemberNumber: (item as any).accidentMemberNumber ?? null,
                accidentAdditionalRate: (item as any).accidentAdditionalRate != null ? Number((item as any).accidentAdditionalRate) : 0,
                accidentAdditionalLabel: (item as any).accidentAdditionalLabel || null,
                pensionEmployerPercent: (item as any).pensionEmployerPercent ?? null,
                pensionEmployeePercent: (item as any).pensionEmployeePercent ?? null,
                pensionMemberNumber: (item as any).pensionMemberNumber ?? null,
                website: item.website || null,
                notes: (item as any).notes || null,
                isActive: true,
            });
        } else if ((existing as any).u1Rates === null && (item as any).u1Rates) {
            await db.update(hmo).set({
                category: item.category || 'health',
                ikNumber: item.ikNumber || existing.ikNumber,
                betriebsnummer: item.betriebsnummer || existing.betriebsnummer,
                u1Rates: (item as any).u1Rates,
                u1DefaultCompensationPercent: (item as any).u1DefaultCompensationPercent ?? 70,
                u2Rate: (item as any).u2Rate ?? 0.44,
                u3Rate: (item as any).u3Rate ?? 0.15,
            }).where(eq(hmo.id, existing.id));
        } else if ((item as any).accidentAdditionalRate && !(existing as any).accidentAdditionalRate) {
            await db.update(hmo).set({
                accidentAdditionalRate: (item as any).accidentAdditionalRate,
                accidentAdditionalLabel: (item as any).accidentAdditionalLabel,
                accidentBeitragsfuss: (item as any).accidentBeitragsfuss,
            }).where(eq(hmo.id, existing.id));
        }
    }

    let baseQuery = db.select().from(hmo).$dynamic();
    const conditions = [];

    if (category && category !== 'all') {
        conditions.push(eq(hmo.category, category as any));
    }

    if (search) {
        conditions.push(
            or(
                ilike(hmo.name, `%${search}%`),
                ilike(hmo.code, `%${search}%`),
                ilike(hmo.betriebsnummer, `%${search}%`),
                ilike(hmo.ikNumber, `%${search}%`)
            )
        );
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(asc(hmo.category), asc(hmo.name))
        .limit(limit)
        .offset(offset);

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});

export const readHmo = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'hmos');

    const result = await db.select().from(hmo).where(eq(hmo.id, id));
    if (result.length === 0) throw new Error('Versicherer / Kasse nicht gefunden');

    const item = result[0];
    return {
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
    };
});

export const createHmo = form(createHmoSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'hmos');
    const input = data as any;

    const [newHmo] = await db.insert(hmo).values({
        name: input.name,
        code: input.code || null,
        category: input.category || 'health',
        type: input.type || 'statutory',
        ikNumber: input.ikNumber || null,
        betriebsnummer: input.betriebsnummer || null,
        additionalContributionPercent: Number(input.additionalContributionPercent ?? 2.5),
        u1Rates: input.u1Rates || null,
        u1DefaultCompensationPercent: input.u1DefaultCompensationPercent != null ? Number(input.u1DefaultCompensationPercent) : 70,
        u2Rate: input.u2Rate != null ? Number(input.u2Rate) : 0.44,
        u3Rate: input.u3Rate != null ? Number(input.u3Rate) : 0.15,
        accidentGefahrklasse: input.accidentGefahrklasse != null ? Number(input.accidentGefahrklasse) : null,
        accidentBeitragsfuss: input.accidentBeitragsfuss != null ? Number(input.accidentBeitragsfuss) : null,
        accidentGefahrtarifstelle: input.accidentGefahrtarifstelle || null,
        accidentMemberNumber: input.accidentMemberNumber || null,
        accidentPin: input.accidentPin || null,
        accidentAdditionalRate: input.accidentAdditionalRate != null ? Number(input.accidentAdditionalRate) : 0,
        accidentAdditionalLabel: input.accidentAdditionalLabel || null,
        pensionEmployerPercent: input.pensionEmployerPercent != null ? Number(input.pensionEmployerPercent) : null,
        pensionEmployeePercent: input.pensionEmployeePercent != null ? Number(input.pensionEmployeePercent) : null,
        pensionMemberNumber: input.pensionMemberNumber || null,
        website: input.website || null,
        notes: input.notes || null,
        isActive: input.isActive ?? true,
    }).returning();

    try {
        await requested(listHmos, 20).refreshAll();
    } catch { /* ignore */ }
    void listHmos().refresh();
    void listHmos({}).refresh();

    return {
        success: true,
        id: newHmo.id,
        hmo: {
            ...newHmo,
            createdAt: newHmo.createdAt.toISOString(),
            updatedAt: newHmo.updatedAt.toISOString(),
        }
    };
});

export const updateHmo = form(updateHmoSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'hmos');
    const input = data as any;

    const [updatedHmo] = await db.update(hmo)
        .set({
            name: input.name,
            code: input.code || null,
            category: input.category || 'health',
            type: input.type || 'statutory',
            ikNumber: input.ikNumber || null,
            betriebsnummer: input.betriebsnummer || null,
            additionalContributionPercent: Number(input.additionalContributionPercent ?? 2.5),
            u1Rates: input.u1Rates || null,
            u1DefaultCompensationPercent: input.u1DefaultCompensationPercent != null ? Number(input.u1DefaultCompensationPercent) : 70,
            u2Rate: input.u2Rate != null ? Number(input.u2Rate) : 0.44,
            u3Rate: input.u3Rate != null ? Number(input.u3Rate) : 0.15,
            accidentGefahrklasse: input.accidentGefahrklasse != null ? Number(input.accidentGefahrklasse) : null,
            accidentBeitragsfuss: input.accidentBeitragsfuss != null ? Number(input.accidentBeitragsfuss) : null,
            accidentGefahrtarifstelle: input.accidentGefahrtarifstelle || null,
            accidentMemberNumber: input.accidentMemberNumber || null,
            accidentPin: input.accidentPin || null,
            accidentAdditionalRate: input.accidentAdditionalRate != null ? Number(input.accidentAdditionalRate) : 0,
            accidentAdditionalLabel: input.accidentAdditionalLabel || null,
            pensionEmployerPercent: input.pensionEmployerPercent != null ? Number(input.pensionEmployerPercent) : null,
            pensionEmployeePercent: input.pensionEmployeePercent != null ? Number(input.pensionEmployeePercent) : null,
            pensionMemberNumber: input.pensionMemberNumber || null,
            website: input.website || null,
            notes: input.notes || null,
            isActive: input.isActive ?? true,
        })
        .where(eq(hmo.id, input.id))
        .returning();

    if (!updatedHmo) throw new Error('Versicherer / Kasse nicht gefunden');

    try {
        await requested(listHmos, 20).refreshAll();
    } catch { /* ignore */ }
    void listHmos().refresh();
    void listHmos({}).refresh();
    void readHmo({ id: input.id }).set({
        ...updatedHmo,
        createdAt: updatedHmo.createdAt.toISOString(),
        updatedAt: updatedHmo.updatedAt.toISOString(),
    });

    return {
        success: true,
        hmo: {
            ...updatedHmo,
            createdAt: updatedHmo.createdAt.toISOString(),
            updatedAt: updatedHmo.updatedAt.toISOString(),
        }
    };
});

export const deleteHmo = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'hmos');

    await db.delete(hmo).where(inArray(hmo.id, ids));

    try {
        await requested(listHmos, 20).refreshAll();
    } catch { /* ignore */ }
    void listHmos().refresh();
    void listHmos({}).refresh();

    return { success: true };
});

export const checkUpdatedTerms = command(v.optional(syncConditionsSchema), async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'hmos');
    const params = input as any;

    const force = params?.force ?? true;
    const period = params?.period;
    const simulateChange = params?.simulateChange ?? false;

    const result = await syncConditions({
        force,
        period,
        simulateChange,
        userId: user.id
    });

    try {
        await requested(listHmos, 20).refreshAll();
    } catch { /* ignore */ }
    void listHmos().refresh();
    void listHmos({}).refresh();

    return result;
});
