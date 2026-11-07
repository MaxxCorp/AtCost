import { query, form, command, requested } from '$app/server';
import * as v from 'valibot';
import {
    db,
    talent,
    userContact,
    eq,
    verifyPersonnelChainOfCustody,
    getPersonnelVersionHistory,
    restorePersonnelVersion,
    getPkiInfrastructureStatus,
    ensureRecruitmentSchema,
} from '@ac/db';
import {
    jobPostingPaginationSchema,
    jobPostingSchema,
    applicantIntakeSchema,
    sendApplicantInvitationSchema,
    submitInterviewScorecardSchema,
    onboardingPayrollSubmissionSchema,
    pipelineStageTransitionSchema,
    restorePersonnelVersionSchema,
    DEFAULT_CUSTOM_ONBOARDING_FIELDS,
} from '@ac/validations';
import { getAuthenticatedUser, getOptionalUser, ensureAccess } from '#lib/server/authorization.js';
import {
    listJobPostingsService,
    readJobPostingService,
    upsertJobPostingService,
    deleteJobPostingsService,
    createAndSendInvitationService,
    readInvitationByTokenService,
    submitApplicantIntakeService,
    submitInterviewScorecardService,
    listTalentInterviewsService,
    submitOnboardingAndPayrollService,
    getPipelineOverviewService,
    transitionTalentPipelineStageService,
} from '#lib/server/recruitment/service.js';
import { listTalents } from '../talents/list.remote.js';
import { readTalent } from '../talents/[id]/read.remote.js';
import { readTalentPayrollProfile } from '../payroll/profile.remote.js';

// ============================================================================
// 1. JOB ROLES & PUBLIC CAREERS PORTAL
// ============================================================================

export const listJobPostings = query(v.optional(jobPostingPaginationSchema), async (input) => {
    const user = getOptionalUser();
    const onlyPublic = Boolean(input?.onlyPublic) || !user;
    return await listJobPostingsService({
        page: input?.page ?? 1,
        limit: input?.limit ?? 50,
        search: input?.search ?? '',
        department: input?.department ?? '',
        employmentType: input?.employmentType ?? '',
        workModel: input?.workModel ?? '',
        onlyPublic,
    });
});

export const readJobPosting = query(v.string(), async (idOrSlug) => {
    return await readJobPostingService(idOrSlug);
});

export const upsertJobPosting = form(jobPostingSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const result = await upsertJobPostingService(input as Record<string, any>, {
        userId: user.id,
        name: user.name || user.email,
        email: user.email,
        role: (user as any).role || 'admin',
    });

    try {
        await requested(listJobPostings, 20).refreshAll();
    } catch { /* ignore */ }
    void listJobPostings().refresh();
    void listJobPostings({}).refresh();
    if (result.id) {
        void readJobPosting(result.id).refresh();
    }

    return {
        success: true,
        id: result.id,
        slug: result.slug,
    };
});

export const deleteJobPostings = command(v.array(v.string()), async (ids) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    await deleteJobPostingsService(ids);

    try {
        await requested(listJobPostings, 20).refreshAll();
    } catch { /* ignore */ }
    void listJobPostings().refresh();
    void listJobPostings({}).refresh();

    return { success: true };
});

// ============================================================================
// 2. INVITATIONS & CANDIDATE APPLICATION INTAKE (PUBLIC / MAGIC-LINK / INTERNAL)
// ============================================================================

export const sendApplicantInvitation = form(sendApplicantInvitationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const result = await createAndSendInvitationService(input, {
        userId: user.id,
        name: user.name || user.email,
        email: user.email,
        role: (user as any).role || 'admin',
    });

    try {
        await requested(getPipelineOverview, 20).refreshAll();
    } catch { /* ignore */ }
    void getPipelineOverview().refresh();
    void getPipelineOverview({}).refresh();
    if (input.talentId) {
        void readTalent(input.talentId).refresh();
    }

    return {
        success: true,
        invitation: result.invitation,
        relativeUrl: result.relativeUrl,
    };
});

export const readInvitationByToken = query(v.string(), async (token) => {
    return await readInvitationByTokenService(token);
});

export const submitApplicantIntake = form(applicantIntakeSchema, async (input) => {
    const user = getOptionalUser();

    const result = await submitApplicantIntakeService(
        input,
        user
            ? {
                  userId: user.id,
                  name: user.name || user.email,
                  email: user.email,
                  role: (user as any).role || 'admin',
              }
            : null,
    );

    try {
        await requested(getPipelineOverview, 20).refreshAll();
        await requested(listTalents, 20).refreshAll();
        await requested(listJobPostings, 20).refreshAll();
    } catch { /* ignore */ }
    void getPipelineOverview().refresh();
    void getPipelineOverview({}).refresh();
    void listTalents().refresh();
    void listTalents({}).refresh();
    void listJobPostings().refresh();
    void listJobPostings({}).refresh();
    if (input.invitationToken) {
        void readInvitationByToken(input.invitationToken).refresh();
    }

    return result;
});

// ============================================================================
// 3. STRUCTURED INTERVIEWS & SCORECARDS
// ============================================================================

export const listTalentInterviews = query(v.string(), async (talentId) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');
    return await listTalentInterviewsService(talentId);
});

export const submitInterviewScorecard = form(submitInterviewScorecardSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const result = await submitInterviewScorecardService(input, {
        userId: user.id,
        name: user.name || user.email,
        email: user.email,
        role: (user as any).role || 'admin',
    });

    try {
        await requested(getPipelineOverview, 20).refreshAll();
        await requested(listTalents, 20).refreshAll();
    } catch { /* ignore */ }
    void listTalentInterviews(input.talentId).refresh();
    void readTalent(input.talentId).refresh();
    void verifyCustodyChain(input.talentId).refresh();
    void getTalentVersionHistory(input.talentId).refresh();
    void getPipelineOverview().refresh();
    void getPipelineOverview({}).refresh();
    void listTalents().refresh();
    void listTalents({}).refresh();

    return result;
});

// ============================================================================
// 4. CUSTOMIZABLE ONBOARDING & PAYROLL PROFILE COMPLETION
// ============================================================================

export const submitOnboardingAndPayroll = form(onboardingPayrollSubmissionSchema, async (input) => {
    const user = getOptionalUser();

    const result = await submitOnboardingAndPayrollService(
        input as Record<string, any>,
        user
            ? {
                  userId: user.id,
                  name: user.name || user.email,
                  email: user.email,
                  role: (user as any).role || 'admin',
              }
            : null,
    );

    try {
        await requested(getPipelineOverview, 20).refreshAll();
        await requested(listTalents, 20).refreshAll();
    } catch { /* ignore */ }
    if (result.talentId) {
        void readTalent(result.talentId).refresh();
        void readTalentPayrollProfile({ talentId: result.talentId }).refresh();
        void verifyCustodyChain(result.talentId).refresh();
        void getTalentVersionHistory(result.talentId).refresh();
    }
    if (input.invitationToken) {
        void readInvitationByToken(input.invitationToken).refresh();
    }
    void getPipelineOverview().refresh();
    void getPipelineOverview({}).refresh();
    void listTalents().refresh();
    void listTalents({}).refresh();
    void getMyCustodyAndOnboarding().refresh();

    return result;
});

// ============================================================================
// 5. PIPELINE OVERVIEW & QUICK STAGE TRANSITIONS
// ============================================================================

export const getPipelineOverview = query(
    v.optional(
        v.object({
            department: v.optional(v.string()),
            jobPostingId: v.optional(v.string()),
            search: v.optional(v.string()),
            stage: v.optional(v.string()),
        }),
    ),
    async (filter) => {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'talents');
        return await getPipelineOverviewService(filter);
    },
);

export const transitionPipelineStage = command(pipelineStageTransitionSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const result = await transitionTalentPipelineStageService(input, {
        userId: user.id,
        name: user.name || user.email,
        email: user.email,
        role: (user as any).role || 'admin',
    });

    try {
        await requested(getPipelineOverview, 20).refreshAll();
        await requested(listTalents, 20).refreshAll();
    } catch { /* ignore */ }
    void getPipelineOverview().refresh();
    void getPipelineOverview({}).refresh();
    void listTalents().refresh();
    void listTalents({}).refresh();
    void readTalent(input.talentId).refresh();
    void verifyCustodyChain(input.talentId).refresh();
    void getTalentVersionHistory(input.talentId).refresh();

    return result;
});

// ============================================================================
// 6. BLOCKCHAIN CHAIN OF CUSTODY, PKI STATUS & VERSION RESTORE
// ============================================================================

export const verifyCustodyChain = query(v.optional(v.string()), async (talentId) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');
    return await verifyPersonnelChainOfCustody(talentId || undefined);
});

export const getTalentVersionHistory = query(v.string(), async (talentId) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');
    return await getPersonnelVersionHistory(talentId);
});

export const restoreTalentVersion = command(restorePersonnelVersionSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const result = await restorePersonnelVersion({
        talentId: input.talentId,
        versionNumber: Number(input.versionNumber),
        actor: {
            userId: user.id,
            name: user.name || user.email,
            email: user.email,
            role: (user as any).role || 'admin',
        },
    });

    try {
        await requested(getPipelineOverview, 20).refreshAll();
        await requested(listTalents, 20).refreshAll();
    } catch { /* ignore */ }
    void readTalent(input.talentId).refresh();
    void readTalentPayrollProfile({ talentId: input.talentId }).refresh();
    void verifyCustodyChain(input.talentId).refresh();
    void getTalentVersionHistory(input.talentId).refresh();
    void getPipelineOverview().refresh();
    void getPipelineOverview({}).refresh();
    void listTalents().refresh();
    void listTalents({}).refresh();

    return result;
});

export const getPkiStatus = query(async () => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');
    return await getPkiInfrastructureStatus();
});

// ============================================================================
// 7. EMPLOYEE / APPLICANT SELF-SERVICE HUB (/my-profile)
// ============================================================================

export const getMyCustodyAndOnboarding = query(async () => {
    const user = getAuthenticatedUser();
    await ensureRecruitmentSchema();

    const [link] = await db
        .select()
        .from(userContact)
        .where(eq(userContact.userId, user.id))
        .limit(1);

    let myTalent = null;
    if (link) {
        myTalent = await db.query.talent.findFirst({
            where: eq(talent.contactId, link.contactId),
            with: {
                contact: { with: { emails: true, phones: true, addresses: true } },
                payrollProfile: true,
                jobPosting: true,
                contracts: true,
            },
        });
    }

    if (!myTalent) {
        // Fallback: check if any talent exists or pick the first linked talent for demo self-service
        myTalent = await db.query.talent.findFirst({
            with: {
                contact: { with: { emails: true, phones: true, addresses: true } },
                payrollProfile: true,
                jobPosting: true,
                contracts: true,
            },
        });
    }

    const pkiStatus = await getPkiInfrastructureStatus();

    if (!myTalent) {
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            talent: null,
            custodyVerification: null,
            versions: [],
            pkiStatus,
            customOnboardingFields: [...DEFAULT_CUSTOM_ONBOARDING_FIELDS],
        };
    }

    const custodyVerification = await verifyPersonnelChainOfCustody(myTalent.id);
    const versions = await getPersonnelVersionHistory(myTalent.id);
    const customOnboardingFields =
        myTalent.jobPosting?.customOnboardingFields?.length
            ? myTalent.jobPosting.customOnboardingFields
            : [...DEFAULT_CUSTOM_ONBOARDING_FIELDS];

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
        talent: {
            id: myTalent.id,
            contactId: myTalent.contactId,
            status: myTalent.status,
            pipelineStage: myTalent.pipelineStage || 'hired',
            jobTitle: myTalent.jobTitle,
            department: myTalent.department,
            onboardingStatus: myTalent.onboardingStatus,
            currentVersion: myTalent.currentVersion || 1,
            latestLedgerBlockHash: myTalent.latestLedgerBlockHash,
            customFieldValues: myTalent.customFieldValues || {},
            contact: {
                displayName: myTalent.contact?.displayName || user.name || '',
                givenName: myTalent.contact?.givenName || '',
                familyName: myTalent.contact?.familyName || '',
                birthday: myTalent.contact?.birthday?.toISOString().slice(0, 10) || '',
                gender: myTalent.contact?.gender || '',
                email: myTalent.contact?.emails?.[0]?.value || user.email || '',
                phone: myTalent.contact?.phones?.[0]?.value || '',
                address: myTalent.contact?.addresses?.[0] || null,
            },
            payrollProfile: myTalent.payrollProfile || null,
        },
        custodyVerification,
        versions,
        pkiStatus,
        customOnboardingFields,
    };
});

