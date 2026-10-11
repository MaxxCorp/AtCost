import { query, form, requested } from '$app/server';
import { db, payrollProfile, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { payrollProfileSchema } from '@ac/validations';
import { upsertPayrollProfile } from '#lib/server/payroll/service.js';
import * as v from 'valibot';

export const readTalentPayrollProfile = query(v.object({ talentId: v.string() }), async ({ talentId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const profile = await db.query.payrollProfile.findFirst({
        where: eq(payrollProfile.talentId, talentId),
    });

    if (!profile) {
        return {
            id: null as string | null,
            talentId,
            taxId: null as string | null,
            taxClass: '1' as const,
            childCount: 0,
            churchTax: 'none' as const,
            state: 'BE',
            socialSecurityNumber: null as string | null,
            healthInsuranceName: 'Techniker Krankenkasse (TK)',
            healthInsuranceType: 'statutory' as const,
            healthInsuranceAdditionalContributionPercent: 2.5,
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

    return {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
    };
});

export const saveTalentPayrollProfile = form(payrollProfileSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const saved = await upsertPayrollProfile(input);

    try {
        await requested(readTalentPayrollProfile, 20).refreshAll();
    } catch { /* ignore */ }
    void readTalentPayrollProfile({ talentId: input.talentId }).refresh();

    return {
        success: true,
        id: saved.id,
    };
});
