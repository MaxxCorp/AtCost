import { query, form, requested } from '$app/server';
import { db, payrollProfile, eq, and, hmo } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { payrollProfileSchema } from '@ac/validations';
import { upsertPayrollProfile } from '#lib/server/payroll/service.js';
import * as v from 'valibot';

export const readTalentPayrollProfile = query(v.object({ talentId: v.string() }), async ({ talentId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const profile = await db.query.payrollProfile.findFirst({
        where: eq(payrollProfile.talentId, talentId),
        with: {
            hmo: true,
            accidentHmo: true,
            pensionHmo: true,
        },
    });

    if (!profile) {
        const defaultHmo = await db.query.hmo.findFirst({
            where: and(eq(hmo.isActive, true), eq(hmo.category, 'health')),
        }) ?? await db.query.hmo.findFirst({
            where: eq(hmo.isActive, true),
        });

        const defaultAccidentHmo = await db.query.hmo.findFirst({
            where: and(eq(hmo.isActive, true), eq(hmo.category, 'accident')),
        });

        const defaultPensionHmo = await db.query.hmo.findFirst({
            where: and(eq(hmo.isActive, true), eq(hmo.category, 'pension')),
        });

        return {
            id: null as string | null,
            talentId,
            taxId: null as string | null,
            taxClass: '1' as const,
            childCount: 0,
            churchTax: 'none' as const,
            state: 'BE',
            socialSecurityNumber: null as string | null,
            hmoId: defaultHmo?.id ?? null,
            accidentHmoId: defaultAccidentHmo?.id ?? null,
            accidentAdditionalApplicable: true,
            pensionHmoId: defaultPensionHmo?.id ?? null,
            u1CompensationPercent: 70.0,
            u1Exempt: false,
            u3Exempt: false,
            healthInsuranceName: defaultHmo?.name ?? 'Techniker Krankenkasse (TK)',
            healthInsuranceType: (defaultHmo?.type ?? 'statutory') as any,
            healthInsuranceAdditionalContributionPercent: defaultHmo?.additionalContributionPercent ?? 2.5,
            hmo: defaultHmo ? {
                ...defaultHmo,
                createdAt: defaultHmo.createdAt.toISOString(),
                updatedAt: defaultHmo.updatedAt.toISOString(),
            } : null,
            accidentHmo: defaultAccidentHmo ? {
                ...defaultAccidentHmo,
                createdAt: defaultAccidentHmo.createdAt.toISOString(),
                updatedAt: defaultAccidentHmo.updatedAt.toISOString(),
            } : null,
            pensionHmo: defaultPensionHmo ? {
                ...defaultPensionHmo,
                createdAt: defaultPensionHmo.createdAt.toISOString(),
                updatedAt: defaultPensionHmo.updatedAt.toISOString(),
            } : null,
            pensionInsuranceExempt: false,
            unemploymentInsuranceExempt: false,
            hasChildren: false,
            employmentType: 'regular' as const,
            fundingProgram: 'none' as const,
            fundingSubsidyPercentage: 100,
            fundingYear: 1,
            jobcenterName: null as string | null,
            jobcenterReference: null as string | null,
            furtherTrainingBudget: 3000,
            furtherTrainingUsed: 0,
            coachingHoursPerMonth: 2,
            deuevPersonengruppe: '101',
            deuevBeitragsgruppe: '1111',
            iban: null as string | null,
            bic: null as string | null,
            bankName: null as string | null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    let hmoRecord = profile.hmo;
    if (!hmoRecord && profile.hmoId) {
        hmoRecord = await db.query.hmo.findFirst({
            where: eq(hmo.id, profile.hmoId),
        }) ?? null;
    }

    let accidentHmoRecord = profile.accidentHmo;
    if (!accidentHmoRecord && profile.accidentHmoId) {
        accidentHmoRecord = await db.query.hmo.findFirst({
            where: eq(hmo.id, profile.accidentHmoId),
        }) ?? null;
    }

    let pensionHmoRecord = profile.pensionHmo;
    if (!pensionHmoRecord && profile.pensionHmoId) {
        pensionHmoRecord = await db.query.hmo.findFirst({
            where: eq(hmo.id, profile.pensionHmoId),
        }) ?? null;
    }

    const hmoData = hmoRecord ? {
        hmoId: hmoRecord.id,
        healthInsuranceName: hmoRecord.name,
        healthInsuranceAdditionalContributionPercent: hmoRecord.additionalContributionPercent,
        healthInsuranceType: hmoRecord.type,
        hmo: {
            ...hmoRecord,
            createdAt: hmoRecord.createdAt.toISOString(),
            updatedAt: hmoRecord.updatedAt.toISOString(),
        },
    } : {
        hmo: null,
    };

    const accidentHmoData = accidentHmoRecord ? {
        accidentHmoId: accidentHmoRecord.id,
        accidentHmo: {
            ...accidentHmoRecord,
            createdAt: accidentHmoRecord.createdAt.toISOString(),
            updatedAt: accidentHmoRecord.updatedAt.toISOString(),
        },
    } : {
        accidentHmo: null,
    };

    const pensionHmoData = pensionHmoRecord ? {
        pensionHmoId: pensionHmoRecord.id,
        pensionHmo: {
            ...pensionHmoRecord,
            createdAt: pensionHmoRecord.createdAt.toISOString(),
            updatedAt: pensionHmoRecord.updatedAt.toISOString(),
        },
    } : {
        pensionHmo: null,
    };

    return {
        ...profile,
        ...hmoData,
        ...accidentHmoData,
        ...pensionHmoData,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
    };
});

export const saveTalentPayrollProfile = form(payrollProfileSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');
    const data = { ...input } as any;

    if (data.hmoId) {
        const matchedHmo = await db.query.hmo.findFirst({
            where: eq(hmo.id, data.hmoId),
        });
        if (matchedHmo) {
            data.healthInsuranceName = matchedHmo.name;
            data.healthInsuranceAdditionalContributionPercent = matchedHmo.additionalContributionPercent;
            data.healthInsuranceType = matchedHmo.type || 'statutory';
        }
    } else if (data.healthInsuranceName) {
        const matchedByName = await db.query.hmo.findFirst({
            where: eq(hmo.name, data.healthInsuranceName),
        });
        if (matchedByName) {
            data.hmoId = matchedByName.id;
            data.healthInsuranceName = matchedByName.name;
            data.healthInsuranceAdditionalContributionPercent = matchedByName.additionalContributionPercent;
            data.healthInsuranceType = matchedByName.type || 'statutory';
        }
    }

    const saved = await upsertPayrollProfile(data);

    try {
        await requested(readTalentPayrollProfile, 20).refreshAll();
    } catch { /* ignore */ }
    void readTalentPayrollProfile({ talentId: data.talentId }).refresh();

    return {
        success: true,
        id: saved.id,
    };
});
