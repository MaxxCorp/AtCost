import { randomBytes } from "node:crypto";
import {
    db,
    talent,
    talentTimelineEntry,
    contact,
    contactEmail,
    contactPhone,
    contactAddress,
    contactTag,
    tag,
    jobPosting,
    jobPostingLocation,
    jobPostingContact,
    jobPostingTag,
    applicantInvitation,
    interviewEvaluation,
    onboardingSubmission,
    payrollProfile,
    contract,
    hmo,
    eq,
    and,
    or,
    desc,
    asc,
    inArray,
    sql,
    ensureRecruitmentSchema,
    computeContactBlindIndexes,
    recordPersonnelMutation,
    encryptPersonnelPayload,
    type CustomOnboardingFieldDef,
    type InterviewCompetencyDef,
} from "@ac/db";
import {
    DEFAULT_INTERVIEW_COMPETENCIES,
    DEFAULT_CUSTOM_ONBOARDING_FIELDS,
    PIPELINE_STAGES,
    type PipelineStage,
} from "@ac/validations";
import { upsertPayrollProfile } from "#lib/server/payroll/service.js";
import { syncJobPostingTargets } from "#lib/server/sync/talent-sync.js";

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

/**
 * Seeds initial best-practice NGO job postings if none exist yet so the public careers portal
 * (/careers & /careers/embed) and recruitment pipeline work out-of-the-box.
 */
export async function ensureDemoJobPostings() {
    await ensureRecruitmentSchema();

    const existingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(jobPosting);

    if (Number(existingCount[0]?.count || 0) > 0) {
        return;
    }

    const defaultScorecard = [...DEFAULT_INTERVIEW_COMPETENCIES] as unknown as InterviewCompetencyDef[];
    const defaultOnboarding = [...DEFAULT_CUSTOM_ONBOARDING_FIELDS] as unknown as CustomOnboardingFieldDef[];
    const now = new Date();

    await db.insert(jobPosting).values([
        {
            title: "Sozialpädagogische Fachkraft / Teilhabecoach (m/w/d)",
            slug: "sozialpaedagogische-fachkraft-teilhabecoach",
            department: "Soziale Arbeit & Beratung",
            roleCategory: "social_work",
            employmentType: "regular",
            workModel: "hybrid",
            workHoursPerWeek: 39,
            contractFrameworkCode: "AWO_BERLIN",
            entgeltgruppe: "S11b",
            erfahrungsstufe: 2,
            salaryRangeMin: 3850,
            salaryRangeMax: 4450,
            currency: "EUR",
            sgb2Eligible: "sgb2_16i",
            summary:
                "Begleitung und Coaching von Menschen im Rahmen des Teilhabechancengesetzes (§ 16i SGB II) sowie psychosoziale Beratung in Berlin.",
            description:
                "Als Sozialpädagogische Fachkraft in unserem gemeinnützigen Träger begleiten Sie Teilnehmende auf ihrem Weg in nachhaltige Beschäftigung und gesellschaftliche Teilhabe.",
            responsibilities:
                "• Individuelle sozialpädagogische Begleitung und beschäftigungsbegleitendes Coaching\n• Zusammenarbeit mit Jobcentern, Betrieben und kommunalen Netzwerken\n• Dokumentation und Wirkungsmessung nach modernen Datenschutzstandards",
            qualifications:
                "• Abgeschlossenes Studium der Sozialen Arbeit, Sozialpädagogik (B.A./Diplom) oder vergleichbare Qualifikation\n• Empathie, interkulturelle Kompetenz und lösungsorientierte Gesprächsführung\n• Kenntnisse im SGB II / SGB III von Vorteil",
            benefits:
                "• Vergütung nach Tarifwerk (AWO Berlin / TV-L analog) inkl. Jahressonderzahlung\n• 30 Tage Urlaub + 24.12. & 31.12. bezahlt frei\n• Mobiles Arbeiten (Hybrid), Fortbildungsbudget & BVG-Firmenticket",
            equalOpportunityStatement:
                "Wir schätzen Vielfalt und begrüßen ausdrücklich alle Bewerbungen – unabhängig von Herkunft, Geschlecht, Behinderung, Religion oder Lebensentwurf. Schwerbehinderte Bewerber:innen werden bei gleicher Eignung bevorzugt.",
            accessibilityNotes:
                "Barrierefreier Zugang an allen Berliner Standorten (Aufzug, rollstuhlgerechte Sanitäranlagen, Induktionsschleife im Beratungsraum).",
            isPublic: true,
            status: "published",
            openingsCount: 2,
            interviewScorecardTemplate: defaultScorecard,
            customOnboardingFields: defaultOnboarding,
            translations: {
                en: {
                    title: "Social Work Specialist / Inclusion Coach (m/f/d)",
                    department: "Social Work & Counseling",
                    summary:
                        "Coaching and empowering individuals under the Participation Opportunities Act (§ 16i SGB II) and psychosocial counseling in Berlin.",
                    description:
                        "As a Social Work Specialist in our non-profit organization, you support participants on their path to sustainable employment and social inclusion.",
                    responsibilities:
                        "• Individualized social-pedagogical support and job coaching\n• Collaboration with municipal agencies and community networks\n• Privacy-first documentation and impact tracking",
                    qualifications:
                        "• Degree in Social Work, Social Pedagogy, or equivalent qualification\n• Empathy, intercultural competence, and structured communication",
                    benefits:
                        "• Collective bargaining pay scale (EG S11b) plus annual bonus\n• 30 days paid leave + Dec 24 & Dec 31 off\n• Hybrid work model, training budget & public transit pass",
                },
            },
            publishedAt: now,
        },
        {
            title: "Koordinator:in Digitale Bildung & IT-Infrastruktur (m/w/d)",
            slug: "koordinator-digitale-bildung-it-infrastruktur",
            department: "IT & Digitalisierung",
            roleCategory: "it_digital",
            employmentType: "regular",
            workModel: "hybrid",
            workHoursPerWeek: 35,
            contractFrameworkCode: "TV_L",
            entgeltgruppe: "E11",
            erfahrungsstufe: 2,
            salaryRangeMin: 4100,
            salaryRangeMax: 4800,
            currency: "EUR",
            sgb2Eligible: "none",
            summary:
                "Gestaltung sicherer, barrierefreier Open-Source- und Microsoft-365-NGO-Infrastrukturen sowie digitaler Bildungsangebote.",
            description:
                "Sie verantworten die Weiterentwicklung unserer datenschutzfreundlichen Cloud- und Web-Anwendungen sowie die Unterstützung unserer gemeinnützigen Standorte.",
            responsibilities:
                "• Administration von Microsoft 365 Business Basic (NGO) / Entra ID sowie moderner Web-Applikationen\n• Beratung der Fachteams zu IT-Sicherheit, PKI-Verschlüsselung und DSGVO\n• Durchführung von Workshops zur digitalen Teilhabe",
            qualifications:
                "• Erfahrung in IT-Systemadministration, Web-Technologien oder Wirtschaftsinformatik\n• Hohes Bewusstsein für Datenschutz (DSGVO), Kryptografie und digitale Barrierefreiheit (BITV 2.0 / WCAG 2.1)",
            benefits:
                "• Tarifliche Vergütung (EG E11), flexible Arbeitszeiten (Gleitzeit) & hoher Homeoffice-Anteil\n• Moderne Hardware nach Wahl (Linux / macOS / Windows)\n• Sinnstiftende Tätigkeit im gemeinnützigen Sektor",
            equalOpportunityStatement:
                "Chancengleichheit und Inklusion sind fester Bestandteil unserer Kultur.",
            accessibilityNotes:
                "Vollständig remote oder im barrierefreien Büro in Berlin-Mitte möglich; Screenreader-kompatible Arbeitsmittel werden gestellt.",
            isPublic: true,
            status: "published",
            openingsCount: 1,
            interviewScorecardTemplate: defaultScorecard,
            customOnboardingFields: defaultOnboarding,
            translations: {
                en: {
                    title: "Digital Education & IT Infrastructure Coordinator (m/f/d)",
                    department: "IT & Digitalization",
                    summary:
                        "Shape secure, accessible Open-Source and Microsoft 365 NGO infrastructures and digital inclusion programs.",
                    description:
                        "Lead the evolution of our privacy-first web platforms and support our non-profit community locations.",
                    responsibilities:
                        "• Manage Microsoft 365 Business Basic (NGO) / Entra ID and modern web applications\n• Advise teams on IT security, PKI encryption, and GDPR compliance\n• Facilitate digital inclusion workshops",
                    qualifications:
                        "• Experience in IT administration, software engineering, or information systems\n• Strong commitment to GDPR privacy, cryptography, and WCAG 2.1 accessibility",
                    benefits:
                        "• Collective scale remuneration (E11), flexible hours & remote-friendly hybrid model\n• Choice of modern hardware (Linux / macOS / Windows)",
                },
            },
            publishedAt: now,
        },
        {
            title: "Projektassistenz Gemeinwesen & Veranstaltungsorganisation (§ 16i / Teilzeit)",
            slug: "projektassistenz-gemeinwesen-veranstaltungsorganisation",
            department: "Gemeinwesen & Kultur",
            roleCategory: "administration",
            employmentType: "sgb2_16i",
            workModel: "onsite",
            workHoursPerWeek: 30,
            contractFrameworkCode: "SGB2_16I",
            entgeltgruppe: "E6",
            erfahrungsstufe: 1,
            salaryRangeMin: 2450,
            salaryRangeMax: 2850,
            currency: "EUR",
            sgb2Eligible: "sgb2_16i",
            summary:
                "Organisation von Nachbarschaftsveranstaltungen, Empfang und Projektunterstützung in unseren Berliner Kiezzentren (förderfähig nach § 16i / § 16d SGB II).",
            description:
                "Unterstützen Sie unser Kiezteam bei der Vorbereitung von Kultur-, Bildungs- und Beratungsangeboten vor Ort.",
            responsibilities:
                "• Freundlicher Empfang und Erstinformation für Besucher:innen im Nachbarschaftszentrum\n• Unterstützung bei Raumplanung, Veranstaltungslogistik und Öffentlichkeitsarbeit\n• Pflege von Terminen und Kontakten",
            qualifications:
                "• Freude am Umgang mit Menschen unterschiedlicher Kulturen und Generationen\n• Organisationsgeschick und Zuverlässigkeit (auch für Quereinsteiger:innen und Geförderte nach § 16i SGB II offen!)",
            benefits:
                "• Tarifgerechte Vergütung, strukturierte Einarbeitung und begleitendes Coaching\n• Weiterbildungsbudget bis 3.000 € (§ 16i Abs. 5 SGB II)\n• Herzliches, diverses Team",
            equalOpportunityStatement:
                "Quereinsteiger:innen und Menschen mit längerer Arbeitsmarktferne sind herzlich willkommen!",
            accessibilityNotes:
                "Erdgeschoss-Zugang ohne Stufen, ruhige Rückzugsräume vorhanden.",
            isPublic: true,
            status: "published",
            openingsCount: 3,
            interviewScorecardTemplate: defaultScorecard,
            customOnboardingFields: defaultOnboarding,
            translations: {
                en: {
                    title: "Community Project & Event Assistant (§ 16i / Part-Time)",
                    department: "Community & Culture",
                    summary:
                        "Support neighborhood events, front-desk welcome, and community projects in our Berlin centers (eligible for § 16i SGB II funding).",
                    description:
                        "Join our neighborhood center team to help organize cultural, educational, and social activities.",
                    responsibilities:
                        "• Warm welcome and front-desk information for community visitors\n• Assist with room scheduling and event logistics\n• Maintain calendars and community contacts",
                    qualifications:
                        "• Enjoy working with people from diverse backgrounds and generations\n• Reliable and organized (career changers and § 16i SGB II candidates warmly encouraged!)",
                    benefits:
                        "• Fair collective pay scale, structured onboarding, and dedicated coaching\n• Up to €3,000 further training budget",
                },
            },
            publishedAt: now,
        },
    ]);
}

// ============================================================================
// 1. JOB POSTINGS CRUD & PUBLIC CAREERS SERVICE
// ============================================================================

export async function listJobPostingsService(options?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    employmentType?: string;
    workModel?: string;
    onlyPublic?: boolean;
}) {
    await ensureDemoJobPostings();

    const {
        page = 1,
        limit = 50,
        search = "",
        department = "",
        employmentType = "",
        workModel = "",
        onlyPublic = false,
    } = options || {};

    const allPostings = await db.query.jobPosting.findMany({
        with: {
            locations: { with: { location: true } },
            contacts: { with: { contact: true } },
            tags: { with: { tag: true } },
            applicants: true,
        },
        orderBy: [desc(jobPosting.createdAt)],
    });

    const filtered = allPostings.filter((jp) => {
        if (onlyPublic && (!jp.isPublic || jp.status !== "published")) {
            return false;
        }
        if (department && department !== "all" && jp.department.toLowerCase() !== department.toLowerCase()) {
            return false;
        }
        if (employmentType && employmentType !== "all" && jp.employmentType !== employmentType) {
            return false;
        }
        if (workModel && workModel !== "all" && jp.workModel !== workModel) {
            return false;
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            const haystack = [
                jp.title,
                jp.department,
                jp.summary,
                jp.description,
                jp.responsibilities,
                jp.qualifications,
                jp.benefits,
                jp.contractFrameworkCode,
                jp.entgeltgruppe,
                jp.translations?.en?.title,
                jp.translations?.en?.department,
                jp.translations?.en?.summary,
                ...(jp.locations || []).map((l: any) => `${l.location?.name || ""} ${l.location?.city || ""}`),
                ...(jp.tags || []).map((t: any) => t.tag?.name || ""),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });

    const departments = Array.from(new Set(allPostings.map((p) => p.department).filter(Boolean))).sort();
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    const mapped = paged.map((jp) => ({
        ...jp,
        publishedAt: jp.publishedAt?.toISOString() ?? null,
        closingDate: jp.closingDate?.toISOString() ?? null,
        targetHireDate: jp.targetHireDate?.toISOString() ?? null,
        createdAt: jp.createdAt.toISOString(),
        updatedAt: jp.updatedAt.toISOString(),
        locations: (jp.locations || []).map((l: any) => l.location).filter(Boolean),
        locationIds: (jp.locations || []).map((l: any) => l.locationId),
        contacts: (jp.contacts || []).map((c: any) => c.contact).filter(Boolean),
        contactIds: (jp.contacts || []).map((c: any) => c.contactId),
        tags: (jp.tags || []).map((t: any) => t.tag).filter(Boolean),
        applicantCount: (jp.applicants || []).length,
    }));

    return {
        data: mapped,
        total: filtered.length,
        page,
        limit,
        departments,
    };
}

export async function readJobPostingService(idOrSlug: string) {
    await ensureDemoJobPostings();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const jp = await db.query.jobPosting.findFirst({
        where: isUuid ? eq(jobPosting.id, idOrSlug) : eq(jobPosting.slug, idOrSlug),
        with: {
            locations: { with: { location: true } },
            contacts: { with: { contact: true } },
            tags: { with: { tag: true } },
            applicants: {
                with: {
                    contact: {
                        with: { emails: true, phones: true },
                    },
                },
            },
        },
    });

    if (!jp) return null;

    return {
        ...jp,
        publishedAt: jp.publishedAt?.toISOString() ?? null,
        closingDate: jp.closingDate?.toISOString() ?? null,
        targetHireDate: jp.targetHireDate?.toISOString() ?? null,
        createdAt: jp.createdAt.toISOString(),
        updatedAt: jp.updatedAt.toISOString(),
        locations: (jp.locations || []).map((l: any) => l.location).filter(Boolean),
        locationIds: (jp.locations || []).map((l: any) => l.locationId),
        contacts: (jp.contacts || []).map((c: any) => c.contact).filter(Boolean),
        contactIds: (jp.contacts || []).map((c: any) => c.contactId),
        tags: (jp.tags || []).map((t: any) => t.tag).filter(Boolean),
        applicantCount: (jp.applicants || []).length,
    };
}

export async function upsertJobPostingService(
    input: Record<string, any>,
    actor: { userId: string; name: string; email?: string; role?: string },
) {
    await ensureRecruitmentSchema();

    const isPublicBool =
        input.isPublic === true || input.isPublic === "true" || input.isPublic === "on" || input.isPublic === 1;
    const slug = input.slug?.trim() ? slugify(input.slug) : slugify(`${input.title}-${input.department}`);

    let interviewScorecardTemplate = [...DEFAULT_INTERVIEW_COMPETENCIES] as unknown as InterviewCompetencyDef[];
    if (input.interviewScorecardJson) {
        try {
            const parsed = JSON.parse(input.interviewScorecardJson);
            if (Array.isArray(parsed) && parsed.length > 0) interviewScorecardTemplate = parsed;
        } catch {
            // keep default
        }
    }

    let customOnboardingFields = [...DEFAULT_CUSTOM_ONBOARDING_FIELDS] as unknown as CustomOnboardingFieldDef[];
    if (input.customOnboardingFieldsJson) {
        try {
            const parsed = JSON.parse(input.customOnboardingFieldsJson);
            if (Array.isArray(parsed)) customOnboardingFields = parsed;
        } catch {
            // keep default
        }
    }

    const locationIds: string[] = input.locationIdsJson ? JSON.parse(input.locationIdsJson) : [];
    const contactIds: string[] = input.contactIdsJson ? JSON.parse(input.contactIdsJson) : [];
    const tagNames: string[] = input.tagsJson ? JSON.parse(input.tagsJson) : [];
    const syncIds: string[] = input.syncIdsJson ? JSON.parse(input.syncIdsJson) : [];

    const translations = {
        en: {
            title: input.titleEn || undefined,
            department: input.departmentEn || undefined,
            summary: input.summaryEn || undefined,
            description: input.descriptionEn || undefined,
            responsibilities: input.responsibilitiesEn || undefined,
            qualifications: input.qualificationsEn || undefined,
            benefits: input.benefitsEn || undefined,
        },
    };

    const values = {
        title: input.title.trim(),
        slug,
        department: input.department.trim(),
        roleCategory: input.roleCategory || "general",
        employmentType: input.employmentType || "regular",
        workModel: input.workModel || "onsite",
        workHoursPerWeek: Number(input.workHoursPerWeek || 39),
        contractFrameworkCode: input.contractFrameworkCode || null,
        entgeltgruppe: input.entgeltgruppe || null,
        erfahrungsstufe: Number(input.erfahrungsstufe || 1),
        salaryRangeMin: input.salaryRangeMin ? Number(input.salaryRangeMin) : null,
        salaryRangeMax: input.salaryRangeMax ? Number(input.salaryRangeMax) : null,
        currency: input.currency || "EUR",
        sgb2Eligible: input.sgb2Eligible || "none",
        summary: input.summary || null,
        description: input.description || null,
        responsibilities: input.responsibilities || null,
        qualifications: input.qualifications || null,
        benefits: input.benefits || null,
        equalOpportunityStatement: input.equalOpportunityStatement || null,
        accessibilityNotes: input.accessibilityNotes || null,
        isPublic: isPublicBool,
        status: input.status || "published",
        openingsCount: Number(input.openingsCount || 1),
        hiringManagerTalentId: input.hiringManagerTalentId || null,
        hrResponsibleUserId: input.hrResponsibleUserId || actor.userId,
        createdByUserId: actor.userId,
        interviewScorecardTemplate,
        customOnboardingFields,
        translations,
        syncIds,
        publishedAt: (input.status || "published") === "published" ? new Date() : null,
        closingDate: input.closingDate ? new Date(input.closingDate) : null,
        targetHireDate: input.targetHireDate ? new Date(input.targetHireDate) : null,
        updatedAt: new Date(),
    };

    let jobPostingId = input.id as string | undefined;

    if (jobPostingId) {
        await db.update(jobPosting).set(values).where(eq(jobPosting.id, jobPostingId));
    } else {
        const [created] = await db.insert(jobPosting).values(values).returning();
        jobPostingId = created.id;
    }

    // Sync embedded EntityManager associations (Locations, Contacts, Tags, Synchronizations)
    await db.delete(jobPostingLocation).where(eq(jobPostingLocation.jobPostingId, jobPostingId));
    if (locationIds.length > 0) {
        await db
            .insert(jobPostingLocation)
            .values(locationIds.map((locationId) => ({ jobPostingId: jobPostingId!, locationId })))
            .onConflictDoNothing();
    }

    await db.delete(jobPostingContact).where(eq(jobPostingContact.jobPostingId, jobPostingId));
    if (contactIds.length > 0) {
        await db
            .insert(jobPostingContact)
            .values(contactIds.map((contactId) => ({ jobPostingId: jobPostingId!, contactId, role: "hiring_team" })))
            .onConflictDoNothing();
    }

    await db.delete(jobPostingTag).where(eq(jobPostingTag.jobPostingId, jobPostingId));
    for (const rawTag of tagNames) {
        const tName = String(rawTag).trim();
        if (!tName) continue;
        let [existingTag] = await db.select().from(tag).where(eq(tag.name, tName)).limit(1);
        if (!existingTag) {
            [existingTag] = await db.insert(tag).values({ name: tName, userId: actor.userId }).returning();
        }
        await db
            .insert(jobPostingTag)
            .values({ jobPostingId, tagId: existingTag.id })
            .onConflictDoNothing();
    }

    await syncJobPostingTargets(actor.userId, jobPostingId, syncIds);

    return { id: jobPostingId, slug };
}

export async function deleteJobPostingsService(ids: string[]) {
    await ensureRecruitmentSchema();
    if (!ids.length) return;
    await db.delete(jobPosting).where(inArray(jobPosting.id, ids));
}

// ============================================================================
// 2. STORY 2: APPLICATION & ONBOARDING INVITATIONS + CANDIDATE INTAKE
// ============================================================================

export async function createAndSendInvitationService(
    input: {
        invitationType: "application" | "onboarding";
        email: string;
        givenName?: string;
        familyName?: string;
        jobPostingId?: string;
        talentId?: string;
        personalMessage?: string;
        expiresInDays?: number | string;
        customFieldsConfigJson?: string;
    },
    actor: { userId: string; name: string; email?: string; role?: string },
) {
    await ensureRecruitmentSchema();

    const token = randomBytes(24).toString("hex");
    const days = Number(input.expiresInDays || 14);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    let customFieldsConfig = [...DEFAULT_CUSTOM_ONBOARDING_FIELDS] as unknown as CustomOnboardingFieldDef[];
    if (input.customFieldsConfigJson) {
        try {
            const parsed = JSON.parse(input.customFieldsConfigJson);
            if (Array.isArray(parsed)) customFieldsConfig = parsed;
        } catch {
            // fallback
        }
    } else if (input.jobPostingId) {
        const jp = await readJobPostingService(input.jobPostingId);
        if (jp?.customOnboardingFields?.length) {
            customFieldsConfig = jp.customOnboardingFields;
        }
    }

    const [invitation] = await db
        .insert(applicantInvitation)
        .values({
            token,
            invitationType: input.invitationType,
            email: input.email.trim().toLowerCase(),
            givenName: input.givenName?.trim() || null,
            familyName: input.familyName?.trim() || null,
            jobPostingId: input.jobPostingId || null,
            talentId: input.talentId || null,
            status: "pending",
            customFieldsConfig,
            prefillData: {
                email: input.email.trim().toLowerCase(),
                givenName: input.givenName?.trim() || "",
                familyName: input.familyName?.trim() || "",
            },
            invitedByUserId: actor.userId,
            invitedByName: actor.name,
            personalMessage: input.personalMessage || null,
            expiresAt,
        })
        .returning();

    const relativeUrl =
        input.invitationType === "application" ? `/apply/${token}` : `/onboarding/${token}`;

    if (input.talentId) {
        await db.insert(talentTimelineEntry).values({
            talentId: input.talentId,
            addedByUserId: actor.userId,
            title:
                input.invitationType === "application"
                    ? "Bewerbungs-Einladungslink versendet"
                    : "Onboarding- & Lohnstammdaten-Link versendet",
            description: `Einladungslink (${relativeUrl}) an ${input.email} durch ${actor.name} bereitgestellt.`,
            date: new Date(),
            type: input.invitationType === "application" ? "Interview" : "Hiring",
            timestamp: new Date(),
            data: {
                date: new Date().toISOString(),
                comment: input.personalMessage || `Magic-Link gültig bis ${expiresAt.toLocaleDateString("de-DE")}`,
                invitationId: invitation.id,
                relativeUrl,
            },
        });
    }

    return {
        invitation: {
            ...invitation,
            sentAt: invitation.sentAt.toISOString(),
            expiresAt: invitation.expiresAt.toISOString(),
            createdAt: invitation.createdAt.toISOString(),
            updatedAt: invitation.updatedAt.toISOString(),
        },
        relativeUrl,
    };
}

export async function readInvitationByTokenService(token: string) {
    await ensureRecruitmentSchema();

    const [inv] = await db
        .select()
        .from(applicantInvitation)
        .where(eq(applicantInvitation.token, token))
        .limit(1);

    if (!inv) return null;

    if (inv.status === "pending") {
        await db
            .update(applicantInvitation)
            .set({ status: "opened", openedAt: new Date(), updatedAt: new Date() })
            .where(eq(applicantInvitation.id, inv.id));
    }

    const job = inv.jobPostingId ? await readJobPostingService(inv.jobPostingId) : null;
    let talentRecord = null;
    if (inv.talentId) {
        talentRecord = await db.query.talent.findFirst({
            where: eq(talent.id, inv.talentId),
            with: {
                contact: {
                    with: { emails: true, phones: true, addresses: true },
                },
                payrollProfile: true,
            },
        });
    }

    return {
        invitation: {
            ...inv,
            sentAt: inv.sentAt.toISOString(),
            openedAt: inv.openedAt?.toISOString() ?? new Date().toISOString(),
            completedAt: inv.completedAt?.toISOString() ?? null,
            expiresAt: inv.expiresAt.toISOString(),
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
        },
        jobPosting: job,
        talent: talentRecord
            ? {
                  id: talentRecord.id,
                  jobTitle: talentRecord.jobTitle,
                  department: talentRecord.department,
                  customFieldValues: talentRecord.customFieldValues || {},
                  contact: {
                      givenName: talentRecord.contact?.givenName || inv.givenName || "",
                      familyName: talentRecord.contact?.familyName || inv.familyName || "",
                      birthday: talentRecord.contact?.birthday?.toISOString().slice(0, 10) || "",
                      gender: talentRecord.contact?.gender || "",
                      email: talentRecord.contact?.emails?.[0]?.value || inv.email,
                      phone: talentRecord.contact?.phones?.[0]?.value || "",
                      address: talentRecord.contact?.addresses?.[0] || null,
                  },
                  payrollProfile: talentRecord.payrollProfile || null,
              }
            : null,
    };
}

/**
 * Handles candidate contact & application submission from all 3 Story 2 pathways:
 * 1. Public Careers Portal (/careers & /careers/embed) -> channel = 'public_portal'
 * 2. Personalized Email Magic-Link (/apply/[token]) -> channel = 'magic_link'
 * 3. Internal Admin/HR/Manager Entry -> channel = 'internal_ui'
 */
export async function submitApplicantIntakeService(
    input: {
        invitationToken?: string;
        jobPostingId?: string;
        channel?: "public_portal" | "magic_link" | "internal_ui";
        givenName: string;
        familyName: string;
        honorificPrefix?: string;
        email: string;
        phone?: string;
        street?: string;
        houseNumber?: string;
        zip?: string;
        city?: string;
        country?: string;
        birthday?: string;
        jobTitle?: string;
        department?: string;
        salaryExpectation?: string;
        availabilityDate?: string;
        resumeUrl?: string;
        portfolioUrl?: string;
        motivationNotes?: string;
        accessibilityAccommodations?: string;
        sgb2Interest?: "none" | "sgb2_16d" | "sgb2_16i";
    },
    actor?: { userId?: string; name?: string; email?: string; role?: string } | null,
) {
    await ensureRecruitmentSchema();

    let linkedJob = input.jobPostingId ? await readJobPostingService(input.jobPostingId) : null;
    let invitationRecord = null;

    if (input.invitationToken) {
        const [inv] = await db
            .select()
            .from(applicantInvitation)
            .where(eq(applicantInvitation.token, input.invitationToken))
            .limit(1);
        if (inv) {
            invitationRecord = inv;
            if (!linkedJob && inv.jobPostingId) {
                linkedJob = await readJobPostingService(inv.jobPostingId);
            }
        }
    }

    const displayName = `${input.givenName.trim()} ${input.familyName.trim()}`.trim();
    const resolvedJobTitle = input.jobTitle?.trim() || linkedJob?.title || "Initiativbewerbung / General Application";
    const resolvedDepartment = input.department?.trim() || linkedJob?.department || "Allgemein";
    const channel = input.channel || (input.invitationToken ? "magic_link" : actor?.userId ? "internal_ui" : "public_portal");

    const blindIndexes = computeContactBlindIndexes({
        email: input.email,
        phone: input.phone,
        birthday: input.birthday,
        familyName: input.familyName,
        givenName: input.givenName,
        zip: input.zip,
        city: input.city,
        street: input.street,
    });

    const combinedNotes = [
        input.motivationNotes ? `Motivation: ${input.motivationNotes}` : null,
        input.portfolioUrl ? `Portfolio/Links: ${input.portfolioUrl}` : null,
        input.accessibilityAccommodations ? `Barrierefreiheits-Bedarf: ${input.accessibilityAccommodations}` : null,
        input.sgb2Interest && input.sgb2Interest !== "none" ? `SGB II Förderinteresse: ${input.sgb2Interest}` : null,
    ]
        .filter(Boolean)
        .join("\n");

    const result = await db.transaction(async (tx) => {
        // 1. Create or update Contact with HMAC blind indexes
        const [newContact] = await tx
            .insert(contact)
            .values({
                userId: actor?.userId || "system",
                displayName,
                givenName: input.givenName.trim(),
                familyName: input.familyName.trim(),
                honorificPrefix: input.honorificPrefix?.trim() || null,
                role: resolvedJobTitle,
                department: resolvedDepartment,
                birthday: input.birthday ? new Date(input.birthday) : null,
                notes: combinedNotes || null,
                isPublic: false,
                fingerprints: blindIndexes,
            })
            .returning();

        await tx.insert(contactEmail).values({
            contactId: newContact.id,
            value: input.email.trim().toLowerCase(),
            type: "work",
            primary: true,
        });

        if (input.phone?.trim()) {
            await tx.insert(contactPhone).values({
                contactId: newContact.id,
                value: input.phone.trim(),
                type: "mobile",
                primary: true,
            });
        }

        if (input.street?.trim() || input.city?.trim()) {
            await tx.insert(contactAddress).values({
                contactId: newContact.id,
                street: input.street?.trim() || null,
                houseNumber: input.houseNumber?.trim() || null,
                zip: input.zip?.trim() || null,
                city: input.city?.trim() || null,
                country: input.country?.trim() || "DE",
                type: "home",
                primary: true,
            });
        }

        // Tag as Applicant
        let [applicantTag] = await tx.select().from(tag).where(eq(tag.name, "Applicant")).limit(1);
        if (!applicantTag) {
            [applicantTag] = await tx
                .insert(tag)
                .values({ name: "Applicant", userId: actor?.userId || "system" })
                .returning();
        }
        await tx
            .insert(contactTag)
            .values({ contactId: newContact.id, tagId: applicantTag.id })
            .onConflictDoNothing();

        // 2. Create Talent record in 'applied' pipeline stage
        const [newTalent] = await tx
            .insert(talent)
            .values({
                contactId: newContact.id,
                status: "applicant",
                pipelineStage: "applied",
                jobPostingId: linkedJob?.id || null,
                department: resolvedDepartment,
                jobTitle: resolvedJobTitle,
                salaryExpectation: input.salaryExpectation || null,
                availabilityDate: input.availabilityDate ? new Date(input.availabilityDate) : null,
                onboardingStatus: "application_received",
                resumeUrl: input.resumeUrl || null,
                source: channel,
                internalNotes: combinedNotes || null,
                customFieldValues: {
                    portfolioUrl: input.portfolioUrl || null,
                    sgb2Interest: input.sgb2Interest || "none",
                    accessibilityAccommodations: input.accessibilityAccommodations || null,
                },
                lastModifiedByUserId: actor?.userId || "applicant_self",
                lastModifiedChannel: channel,
            })
            .returning();

        // 3. Log Timeline Entry
        await tx.insert(talentTimelineEntry).values({
            talentId: newTalent.id,
            addedByUserId: actor?.userId || "applicant_self",
            title: `Bewerbung eingegangen: ${resolvedJobTitle}`,
            description: `Eingang über ${
                channel === "public_portal"
                    ? "Öffentliches Karriereportal"
                    : channel === "magic_link"
                      ? "Persönlicher Einladungslink"
                      : "Interne Direktaufnahme"
            }`,
            date: new Date(),
            type: "Interview",
            timestamp: new Date(),
            data: {
                date: new Date().toISOString(),
                comment: combinedNotes || "Bewerbungsformular vollständig übermittelt.",
                channel,
                jobPostingId: linkedJob?.id || null,
            },
        });

        if (invitationRecord) {
            await tx
                .update(applicantInvitation)
                .set({
                    status: "completed",
                    talentId: newTalent.id,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(applicantInvitation.id, invitationRecord.id));
        }

        return { talent: newTalent, contact: newContact };
    });

    // 4. Record Version v1 + Signed Blockchain Custody Block + PKI Envelope Encryption
    const custody = await recordPersonnelMutation({
        talentId: result.talent.id,
        contactId: result.contact.id,
        entityType: "job_application",
        entityId: result.talent.id,
        operation: "create",
        channel,
        actor: {
            userId: actor?.userId || `applicant:${input.email.trim().toLowerCase()}`,
            name: actor?.name || displayName,
            email: actor?.email || input.email.trim().toLowerCase(),
            role: actor?.role || "applicant",
        },
        beforeState: null,
        afterState: {
            talent: {
                id: result.talent.id,
                status: "applicant",
                pipelineStage: "applied",
                jobPostingId: linkedJob?.id || null,
                jobTitle: resolvedJobTitle,
                department: resolvedDepartment,
                salaryExpectation: input.salaryExpectation || null,
                availabilityDate: input.availabilityDate || null,
                onboardingStatus: "application_received",
                internalNotes: combinedNotes || null,
            },
            contact: {
                id: result.contact.id,
                displayName,
                givenName: input.givenName.trim(),
                familyName: input.familyName.trim(),
                email: input.email.trim().toLowerCase(),
                phone: input.phone || null,
                birthday: input.birthday || null,
                street: input.street || null,
                houseNumber: input.houseNumber || null,
                zip: input.zip || null,
                city: input.city || null,
                department: resolvedDepartment,
                role: resolvedJobTitle,
            },
        },
        changeSummary: `Initial application & contact profile created (${resolvedJobTitle}) via ${channel}`,
    });

    return {
        success: true,
        talentId: result.talent.id,
        contactId: result.contact.id,
        ledgerBlockHash: custody.block.blockHash,
        versionNumber: custody.version.versionNumber,
    };
}

// ============================================================================
// 3. STORY 3: STRUCTURED INTERVIEW SCORECARD & RATING SERVICE
// ============================================================================

export async function submitInterviewScorecardService(
    input: {
        id?: string;
        talentId: string;
        jobPostingId?: string;
        stage?: "screening" | "technical" | "team_culture" | "practical_trial" | "final_panel";
        interviewType?: "video" | "onsite" | "phone" | "panel";
        conductedAt?: string;
        interviewerName: string;
        interviewerRole?: string;
        recommendation: "strong_hire" | "hire" | "leaning_hire" | "leaning_no_hire" | "no_hire";
        strengths: string;
        concerns?: string;
        calibrationNotes?: string;
        competencyScoresJson: string;
        structuredQuestionsJson?: string;
        advancePipelineStage?: string;
    },
    actor: { userId: string; name: string; email?: string; role?: string },
) {
    await ensureRecruitmentSchema();

    const competencyScores = JSON.parse(input.competencyScoresJson || "[]") as Array<{
        competencyId: string;
        competency: string;
        category: string;
        weight: number;
        score: number;
        evidenceNotes: string;
    }>;

    const structuredQuestions = input.structuredQuestionsJson
        ? JSON.parse(input.structuredQuestionsJson)
        : [];

    // Compute weighted average score (1.00 - 5.00)
    let totalWeight = 0;
    let weightedSum = 0;
    for (const c of competencyScores) {
        const w = Number(c.weight || 20);
        const s = Math.min(5, Math.max(1, Number(c.score || 3)));
        totalWeight += w;
        weightedSum += w * s;
    }
    const overallScore =
        totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 3.0;

    const existingTalent = await db.query.talent.findFirst({
        where: eq(talent.id, input.talentId),
    });
    if (!existingTalent) {
        throw new Error("Talent not found.");
    }

    const [evaluation] = await db
        .insert(interviewEvaluation)
        .values({
            talentId: input.talentId,
            jobPostingId: input.jobPostingId || existingTalent.jobPostingId || null,
            stage: input.stage || "screening",
            interviewType: input.interviewType || "video",
            conductedAt: input.conductedAt ? new Date(input.conductedAt) : new Date(),
            interviewerUserId: actor.userId,
            interviewerName: input.interviewerName.trim() || actor.name,
            interviewerRole: input.interviewerRole?.trim() || actor.role || "Hiring Team",
            status: "submitted",
            competencyScores,
            overallScore,
            recommendation: input.recommendation,
            strengths: input.strengths.trim(),
            concerns: input.concerns?.trim() || null,
            structuredQuestions,
            calibrationNotes: input.calibrationNotes?.trim() || null,
            isBlindSubmitted: true,
        })
        .returning();

    // Recompute candidate's aggregate averageRating across all submitted scorecards
    const allEvaluations = await db
        .select({ overallScore: interviewEvaluation.overallScore })
        .from(interviewEvaluation)
        .where(eq(interviewEvaluation.talentId, input.talentId));

    const avgRating =
        allEvaluations.length > 0
            ? Math.round(
                  (allEvaluations.reduce((acc, e) => acc + Number(e.overallScore || 0), 0) /
                      allEvaluations.length) *
                      100,
              ) / 100
            : overallScore;

    const nextStage = (input.advancePipelineStage || existingTalent.pipelineStage || "interview") as PipelineStage;

    await db
        .update(talent)
        .set({
            averageRating: avgRating,
            pipelineStage: nextStage,
            updatedAt: new Date(),
        })
        .where(eq(talent.id, input.talentId));

    // Add to Talent Timeline
    await db.insert(talentTimelineEntry).values({
        talentId: input.talentId,
        addedByUserId: actor.userId,
        title: `Strukturiertes Interview (${input.stage || "screening"}): ${overallScore.toFixed(2)} / 5.00`,
        description: `Empfehlung: ${input.recommendation.toUpperCase()} · Interviewer: ${input.interviewerName}`,
        date: new Date(),
        type: "Interview",
        timestamp: new Date(),
        data: {
            date: new Date().toISOString(),
            comment: `Stärken: ${input.strengths}${input.concerns ? ` | Offene Punkte: ${input.concerns}` : ""}`,
            evaluationId: evaluation.id,
            overallScore,
            recommendation: input.recommendation,
        },
    });

    // Record into Blockchain Custody Ledger
    const custody = await recordPersonnelMutation({
        talentId: input.talentId,
        contactId: existingTalent.contactId,
        entityType: "interview_evaluation",
        entityId: evaluation.id,
        operation: "interview_rating",
        channel: "internal_ui",
        actor,
        beforeState: {
            averageRating: existingTalent.averageRating,
            pipelineStage: existingTalent.pipelineStage,
        },
        afterState: {
            averageRating: avgRating,
            pipelineStage: nextStage,
            evaluationId: evaluation.id,
            stage: evaluation.stage,
            overallScore,
            recommendation: evaluation.recommendation,
            competencyScores,
            strengths: evaluation.strengths,
            concerns: evaluation.concerns,
        },
        changeSummary: `Structured Interview Scorecard (${evaluation.stage}) submitted by ${input.interviewerName}: ${overallScore.toFixed(2)}/5.0 (${input.recommendation})`,
    });

    await db
        .update(interviewEvaluation)
        .set({ ledgerBlockId: custody.block.id })
        .where(eq(interviewEvaluation.id, evaluation.id));

    return {
        success: true,
        evaluationId: evaluation.id,
        overallScore,
        averageRating: avgRating,
        ledgerBlockHash: custody.block.blockHash,
    };
}

export async function listTalentInterviewsService(talentId: string) {
    await ensureRecruitmentSchema();

    const rows = await db
        .select()
        .from(interviewEvaluation)
        .where(eq(interviewEvaluation.talentId, talentId))
        .orderBy(desc(interviewEvaluation.conductedAt));

    return rows.map((r) => ({
        ...r,
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
        conductedAt: r.conductedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));
}

// ============================================================================
// 4. STORY 4: CUSTOMIZABLE ONBOARDING & PAYROLL PROFILE COMPLETION SERVICE
// ============================================================================

/**
 * Completes the post-selection onboarding profile extension and statutory German payroll data,
 * feeding directly into `payrollProfile`, `contact`, `contract`, and the PKI-encrypted custody ledger.
 * Can be submitted by the selected applicant via Email Magic Link (/onboarding/[token]) OR by the internal team.
 */
export async function submitOnboardingAndPayrollService(
    input: Record<string, any>,
    actor?: { userId?: string; name?: string; email?: string; role?: string } | null,
) {
    await ensureRecruitmentSchema();

    let resolvedTalentId = input.talentId as string | undefined;
    let invitationRecord = null;

    if (input.invitationToken) {
        const [inv] = await db
            .select()
            .from(applicantInvitation)
            .where(eq(applicantInvitation.token, input.invitationToken))
            .limit(1);
        if (inv) {
            invitationRecord = inv;
            if (!resolvedTalentId && inv.talentId) {
                resolvedTalentId = inv.talentId;
            }
        }
    }

    if (!resolvedTalentId) {
        throw new Error("Talent ID or valid onboarding invitation token is required.");
    }

    const existingTalent = await db.query.talent.findFirst({
        where: eq(talent.id, resolvedTalentId),
        with: {
            contact: { with: { emails: true, phones: true, addresses: true } },
            payrollProfile: true,
            contracts: true,
        },
    });

    if (!existingTalent) {
        throw new Error("Talent record not found.");
    }

    const displayName = `${input.givenName.trim()} ${input.familyName.trim()}`.trim();
    const channel =
        input.filledByChannel === "candidate_magic_link" || input.invitationToken
            ? "magic_link"
            : input.filledByChannel === "self_service"
              ? "self_service"
              : "internal_ui";

    let customFieldDefinitions = [...DEFAULT_CUSTOM_ONBOARDING_FIELDS] as unknown as CustomOnboardingFieldDef[];
    if (input.customFieldDefinitionsJson) {
        try {
            const parsed = JSON.parse(input.customFieldDefinitionsJson);
            if (Array.isArray(parsed)) customFieldDefinitions = parsed;
        } catch {
            // fallback
        }
    }

    let customFieldResponses: Record<string, unknown> = {};
    if (input.customFieldResponsesJson) {
        try {
            customFieldResponses = JSON.parse(input.customFieldResponsesJson);
        } catch {
            // fallback
        }
    }

    // 1. Update Contact + Blind Indexes
    const primaryEmail = existingTalent.contact?.emails?.[0]?.value || invitationRecord?.email || "";
    const blindIndexes = computeContactBlindIndexes({
        email: primaryEmail,
        phone: input.phone || existingTalent.contact?.phones?.[0]?.value,
        birthday: input.birthday,
        familyName: input.familyName,
        givenName: input.givenName,
        zip: input.zip,
        city: input.city,
        street: input.street,
        taxId: input.taxId,
    });

    await db
        .update(contact)
        .set({
            displayName,
            givenName: input.givenName.trim(),
            familyName: input.familyName.trim(),
            birthday: input.birthday ? new Date(input.birthday) : existingTalent.contact?.birthday,
            gender: input.gender || existingTalent.contact?.gender || null,
            fingerprints: blindIndexes,
            updatedAt: new Date(),
        })
        .where(eq(contact.id, existingTalent.contactId));

    if (input.phone?.trim()) {
        await db.delete(contactPhone).where(eq(contactPhone.contactId, existingTalent.contactId));
        await db.insert(contactPhone).values({
            contactId: existingTalent.contactId,
            value: input.phone.trim(),
            type: "mobile",
            primary: true,
        });
    }

    if (input.street?.trim() && input.city?.trim()) {
        await db.delete(contactAddress).where(eq(contactAddress.contactId, existingTalent.contactId));
        await db.insert(contactAddress).values({
            contactId: existingTalent.contactId,
            street: input.street.trim(),
            houseNumber: input.houseNumber?.trim() || "",
            zip: input.zip?.trim() || "",
            city: input.city.trim(),
            country: input.country?.trim() || "DE",
            type: "home",
            primary: true,
        });
    }

    // 2. Resolve default HMO / BG if not explicitly provided so payroll engine has complete insurer references
    let resolvedHmoId = input.hmoId || existingTalent.payrollProfile?.hmoId || null;
    let resolvedHealthName = input.healthInsuranceName || existingTalent.payrollProfile?.healthInsuranceName || "Techniker Krankenkasse (TK)";
    let resolvedAddContrib = Number(input.healthInsuranceAdditionalContributionPercent ?? 2.5);
    let resolvedHealthType = (input.healthInsuranceType || "statutory") as "statutory" | "private";

    if (resolvedHmoId) {
        const matchedHmo = await db.query.hmo.findFirst({ where: eq(hmo.id, resolvedHmoId) });
        if (matchedHmo) {
            resolvedHealthName = matchedHmo.name;
            resolvedAddContrib = Number(matchedHmo.additionalContributionPercent ?? 2.5);
            resolvedHealthType = (matchedHmo.type as "statutory" | "private") || "statutory";
        }
    } else {
        const defaultHealthHmo = await db.query.hmo.findFirst({
            where: eq(hmo.isActive, true),
        });
        if (defaultHealthHmo) {
            resolvedHmoId = defaultHealthHmo.id;
        }
    }

    const savedPayrollProfile = await upsertPayrollProfile({
        talentId: resolvedTalentId,
        taxId: input.taxId.replace(/\s+/g, ""),
        taxClass: (input.taxClass || "1") as "1" | "2" | "3" | "4" | "5" | "6",
        childCount: Number(input.childCount ?? 0),
        hasChildren: Boolean(input.hasChildren) || Number(input.childCount ?? 0) > 0,
        churchTax: (input.churchTax || "none") as "none" | "ev" | "rk",
        state: input.state || "BE",
        socialSecurityNumber: input.socialSecurityNumber.trim(),
        hmoId: resolvedHmoId,
        accidentHmoId: input.accidentHmoId || existingTalent.payrollProfile?.accidentHmoId || undefined,
        accidentAdditionalApplicable: true,
        pensionHmoId: input.pensionHmoId || existingTalent.payrollProfile?.pensionHmoId || undefined,
        u1CompensationPercent: 70.0,
        u1Exempt: false,
        u3Exempt: false,
        healthInsuranceName: resolvedHealthName,
        healthInsuranceType: resolvedHealthType,
        healthInsuranceAdditionalContributionPercent: resolvedAddContrib,
        pensionInsuranceExempt: Boolean(input.pensionInsuranceExempt),
        unemploymentInsuranceExempt:
            Boolean(input.unemploymentInsuranceExempt) || input.fundingProgram === "sgb2_16i",
        employmentType: (input.employmentType || "regular") as any,
        fundingProgram: (input.fundingProgram || "none") as "none" | "sgb2_16d" | "sgb2_16i",
        fundingSubsidyPercentage: Number(input.fundingSubsidyPercentage ?? 100),
        fundingYear: 1,
        jobcenterName: input.jobcenterName || undefined,
        jobcenterReference: input.jobcenterReference || undefined,
        furtherTrainingBudget: 3000,
        furtherTrainingUsed: 0,
        coachingHoursPerMonth: 2,
        deuevPersonengruppe:
            input.deuevPersonengruppe || (input.fundingProgram === "sgb2_16d" ? "190" : "101"),
        deuevBeitragsgruppe:
            input.deuevBeitragsgruppe ||
            (input.fundingProgram === "sgb2_16d"
                ? "0000"
                : input.fundingProgram === "sgb2_16i"
                  ? "1101"
                  : "1111"),
        iban: input.iban.replace(/\s+/g, "").toUpperCase(),
        bic: input.bic?.trim() || null,
        bankName: input.bankName?.trim() || null,
    });

    // 3. Optionally provision Base Contract so GermanPayrollEngine can run immediately
    let provisionedContractId: string | null = null;
    if (
        (input.autoCreateContract || input.markAsHiredAndActive) &&
        (!existingTalent.contracts || existingTalent.contracts.length === 0)
    ) {
        const linkedJob = existingTalent.jobPostingId
            ? await readJobPostingService(existingTalent.jobPostingId)
            : null;
        const wageAmount = Number(
            input.contractWageAmount ||
                linkedJob?.salaryRangeMin ||
                (existingTalent.salaryExpectation ? parseFloat(existingTalent.salaryExpectation) : 3500) ||
                3500,
        );
        const [newContract] = await db
            .insert(contract)
            .values({
                talentId: resolvedTalentId,
                title: `Arbeitsvertrag – ${existingTalent.jobTitle || linkedJob?.title || displayName}`,
                contractType: "base_contract",
                precedence: 1,
                isActive: true,
                startDate: input.contractStartDate ? new Date(input.contractStartDate) : new Date(),
                probationPeriodMonths: 6,
                workHoursPerWeek: Number(input.contractWorkHoursPerWeek || linkedJob?.workHoursPerWeek || 39),
                workDaysPerWeek: 5,
                wageType: (input.contractWageType || "monthly") as "hourly" | "monthly",
                wageAmount,
                wageTable: linkedJob?.contractFrameworkCode || "TV_L",
                entgeltgruppe: input.contractEntgeltgruppe || linkedJob?.entgeltgruppe || "E9",
                erfahrungsstufe: Number(input.contractErfahrungsstufe || linkedJob?.erfahrungsstufe || 1),
                holidayAllotmentDays: 30,
                fundingProgram: (input.fundingProgram || linkedJob?.sgb2Eligible || "none") as
                    | "none"
                    | "sgb2_16d"
                    | "sgb2_16i",
                fundingSubsidyPercentage: Number(input.fundingSubsidyPercentage ?? 100),
                jobcenterReference: input.jobcenterReference || null,
            })
            .returning();
        provisionedContractId = newContract.id;
    }

    // 4. Encrypt onboarding submission envelope & persist onboardingSubmission
    const mergedCustomFields = {
        ...(existingTalent.customFieldValues || {}),
        ...customFieldResponses,
    };

    const fullOnboardingPayload = {
        personal: {
            givenName: input.givenName,
            familyName: input.familyName,
            birthday: input.birthday,
            gender: input.gender,
            street: input.street,
            houseNumber: input.houseNumber,
            zip: input.zip,
            city: input.city,
            country: input.country || "DE",
            phone: input.phone,
        },
        payrollProfile: {
            id: savedPayrollProfile.id,
            taxId: savedPayrollProfile.taxId,
            taxClass: savedPayrollProfile.taxClass,
            childCount: savedPayrollProfile.childCount,
            churchTax: savedPayrollProfile.churchTax,
            state: savedPayrollProfile.state,
            socialSecurityNumber: savedPayrollProfile.socialSecurityNumber,
            healthInsuranceName: savedPayrollProfile.healthInsuranceName,
            healthInsuranceType: savedPayrollProfile.healthInsuranceType,
            employmentType: savedPayrollProfile.employmentType,
            fundingProgram: savedPayrollProfile.fundingProgram,
            deuevPersonengruppe: savedPayrollProfile.deuevPersonengruppe,
            deuevBeitragsgruppe: savedPayrollProfile.deuevBeitragsgruppe,
            iban: savedPayrollProfile.iban,
            bic: savedPayrollProfile.bic,
            bankName: savedPayrollProfile.bankName,
        },
        customFieldResponses: mergedCustomFields,
        provisionedContractId,
    };

    const { envelope } = await encryptPersonnelPayload({
        subjectType: "talent",
        subjectId: resolvedTalentId,
        aadText: `onboarding:${resolvedTalentId}`,
        payload: fullOnboardingPayload,
    });

    const markActive = Boolean(input.markAsHiredAndActive);
    const nextStatus = markActive ? "active" : existingTalent.status === "active" ? "active" : "applicant";
    const nextPipelineStage: PipelineStage = markActive ? "hired" : "onboarding";

    const [submission] = await db
        .insert(onboardingSubmission)
        .values({
            talentId: resolvedTalentId,
            jobPostingId: existingTalent.jobPostingId || input.jobPostingId || null,
            invitationId: invitationRecord?.id || null,
            status: markActive ? "provisioned" : "submitted",
            filledByChannel:
                (input.filledByChannel as "candidate_magic_link" | "internal_team" | "self_service") ||
                "internal_team",
            submittedByUserId: actor?.userId || "candidate_self",
            verifiedByUserId: markActive ? actor?.userId || null : null,
            payrollData: fullOnboardingPayload.payrollProfile,
            customFieldDefinitions,
            customFieldResponses: mergedCustomFields,
            encryptedPayload: envelope,
            submittedAt: new Date(),
            verifiedAt: markActive ? new Date() : null,
        })
        .returning();

    await db
        .update(talent)
        .set({
            status: nextStatus,
            pipelineStage: nextPipelineStage,
            onboardingStatus: markActive ? "completed" : "submitted_pending_review",
            customFieldValues: mergedCustomFields,
            updatedAt: new Date(),
        })
        .where(eq(talent.id, resolvedTalentId));

    if (invitationRecord) {
        await db
            .update(applicantInvitation)
            .set({
                status: "completed",
                completedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(applicantInvitation.id, invitationRecord.id));
    }

    await db.insert(talentTimelineEntry).values({
        talentId: resolvedTalentId,
        addedByUserId: actor?.userId || "candidate_self",
        title: markActive
            ? "Onboarding abgeschlossen & Lohnstammdaten aktiviert"
            : "Onboarding- & Lohnfragebogen eingereicht",
        description: `Steuer-ID, SV-Nummer, Krankenkasse (${resolvedHealthName}), IBAN und ${Object.keys(customFieldResponses).length} Zusatzfelder PKI-verschlüsselt gespeichert.`,
        date: new Date(),
        type: "Hiring",
        timestamp: new Date(),
        data: {
            date: new Date().toISOString(),
            comment: `Erfasst über ${channel}. Abrechnungsprofil bereit für Gehaltslauf.`,
            submissionId: submission.id,
            provisionedContractId,
        },
    });

    // 5. Append Version + Signed Blockchain Custody Block
    const custody = await recordPersonnelMutation({
        talentId: resolvedTalentId,
        contactId: existingTalent.contactId,
        entityType: "onboarding_submission",
        entityId: resolvedTalentId,
        operation: "onboarding_submit",
        channel,
        actor: {
            userId: actor?.userId || `candidate:${resolvedTalentId}`,
            name: actor?.name || displayName,
            email: actor?.email || primaryEmail,
            role: actor?.role || "candidate",
        },
        beforeState: {
            status: existingTalent.status,
            pipelineStage: existingTalent.pipelineStage,
            onboardingStatus: existingTalent.onboardingStatus,
            payrollProfile: existingTalent.payrollProfile
                ? {
                      taxId: existingTalent.payrollProfile.taxId,
                      socialSecurityNumber: existingTalent.payrollProfile.socialSecurityNumber,
                      iban: existingTalent.payrollProfile.iban,
                      healthInsuranceName: existingTalent.payrollProfile.healthInsuranceName,
                  }
                : null,
        },
        afterState: {
            talent: {
                id: resolvedTalentId,
                status: nextStatus,
                pipelineStage: nextPipelineStage,
                onboardingStatus: markActive ? "completed" : "submitted_pending_review",
                jobTitle: existingTalent.jobTitle,
                department: existingTalent.department,
            },
            contact: fullOnboardingPayload.personal,
            payrollProfile: fullOnboardingPayload.payrollProfile,
            customFieldResponses: mergedCustomFields,
        },
        changeSummary: `Onboarding & Statutory Payroll Profile completed via ${channel} (Payroll Ready: Yes)`,
    });

    await db
        .update(onboardingSubmission)
        .set({ ledgerBlockId: custody.block.id })
        .where(eq(onboardingSubmission.id, submission.id));

    return {
        success: true,
        talentId: resolvedTalentId,
        submissionId: submission.id,
        payrollProfileId: savedPayrollProfile.id,
        provisionedContractId,
        ledgerBlockHash: custody.block.blockHash,
        versionNumber: custody.version.versionNumber,
    };
}

// ============================================================================
// 5. STORY 5: PIPELINE OVERVIEW & QUICK ACTIONS SERVICE
// ============================================================================

export async function getRecruitmentPipelineOverviewService(filter?: {
    search?: string;
    department?: string;
    jobPostingId?: string;
    stage?: string;
}) {
    await ensureDemoJobPostings();

    const allTalents = await db.query.talent.findMany({
        with: {
            contact: {
                with: { emails: true, phones: true, addresses: true, tags: { with: { tag: true } } },
            },
            jobPosting: true,
            payrollProfile: true,
            contracts: true,
            interviewEvaluations: {
                orderBy: [desc(interviewEvaluation.conductedAt)],
            },
            onboardingSubmissions: {
                orderBy: [desc(onboardingSubmission.createdAt)],
            },
            invitations: {
                orderBy: [desc(applicantInvitation.createdAt)],
            },
        },
        orderBy: [desc(talent.updatedAt)],
    });

    const mapped = allTalents
        .map((t) => {
            const pp = t.payrollProfile;
            const missingPayrollFields: string[] = [];
            if (!pp?.taxId) missingPayrollFields.push("Steuer-ID");
            if (!pp?.socialSecurityNumber) missingPayrollFields.push("SV-Nummer");
            if (!pp?.iban) missingPayrollFields.push("IBAN");
            if (!pp?.healthInsuranceName) missingPayrollFields.push("Krankenkasse");
            if (!t.contracts || t.contracts.length === 0) missingPayrollFields.push("Arbeitsvertrag");

            const isPayrollReady = missingPayrollFields.length === 0;
            const resolvedStage: PipelineStage =
                (t.pipelineStage as PipelineStage) ||
                (t.status === "active" ? "hired" : t.status === "rejected" ? "rejected" : "applied");

            return {
                id: t.id,
                contactId: t.contactId,
                displayName:
                    t.contact?.displayName ||
                    [t.contact?.givenName, t.contact?.familyName].filter(Boolean).join(" ") ||
                    "Unbenannt",
                givenName: t.contact?.givenName || "",
                familyName: t.contact?.familyName || "",
                email: t.contact?.emails?.[0]?.value || "",
                phone: t.contact?.phones?.[0]?.value || "",
                city: t.contact?.addresses?.[0]?.city || "",
                obfuscationStatus: t.contact?.obfuscationStatus || null,
                status: t.status,
                pipelineStage: resolvedStage,
                jobPostingId: t.jobPostingId,
                jobPostingTitle: t.jobPosting?.title || t.jobTitle || "Allgemein",
                jobTitle: t.jobTitle || t.jobPosting?.title || "Fachkraft",
                department: t.department || t.jobPosting?.department || t.contact?.department || "Allgemein",
                salaryExpectation: t.salaryExpectation,
                availabilityDate: t.availabilityDate?.toISOString() ?? null,
                onboardingStatus: t.onboardingStatus || "not_started",
                source: t.source || "internal_ui",
                averageRating: t.averageRating,
                interviewCount: (t.interviewEvaluations || []).length,
                latestRecommendation: t.interviewEvaluations?.[0]?.recommendation || null,
                isPayrollReady,
                missingPayrollFields,
                activeContractsCount: (t.contracts || []).filter((c) => c.isActive !== false).length,
                currentVersion: t.currentVersion || 1,
                latestLedgerBlockHash: t.latestLedgerBlockHash || null,
                lastModifiedChannel: t.lastModifiedChannel || "internal_ui",
                customFieldValues: t.customFieldValues || {},
                latestInvitation: t.invitations?.[0]
                    ? {
                          id: t.invitations[0].id,
                          token: t.invitations[0].token,
                          invitationType: t.invitations[0].invitationType,
                          status: t.invitations[0].status,
                      }
                    : null,
                createdAt: t.createdAt.toISOString(),
                updatedAt: t.updatedAt.toISOString(),
            };
        })
        .filter((item) => {
            if (filter?.department && filter.department !== "all") {
                if (item.department.toLowerCase() !== filter.department.toLowerCase()) return false;
            }
            if (filter?.jobPostingId && filter.jobPostingId !== "all") {
                if (item.jobPostingId !== filter.jobPostingId) return false;
            }
            if (filter?.stage && filter.stage !== "all") {
                if (item.pipelineStage !== filter.stage) return false;
            }
            if (filter?.search?.trim()) {
                const q = filter.search.trim().toLowerCase();
                const hay = `${item.displayName} ${item.email} ${item.jobTitle} ${item.department}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

    const stageCounts: Record<string, number> = {};
    for (const st of PIPELINE_STAGES) {
        stageCounts[st.id] = 0;
    }
    for (const item of mapped) {
        stageCounts[item.pipelineStage] = (stageCounts[item.pipelineStage] || 0) + 1;
    }

    return {
        candidates: mapped,
        stageCounts,
        totalCandidates: mapped.length,
        payrollReadyCount: mapped.filter((m) => m.isPayrollReady).length,
        activeApplicantsCount: mapped.filter((m) => m.status === "applicant").length,
    };
}

export const getPipelineOverviewService = getRecruitmentPipelineOverviewService;

export async function transitionTalentPipelineStageService(
    input: {
        talentId: string;
        pipelineStage: PipelineStage;
        status?: "active" | "inactive" | "applicant" | "rejected";
        note?: string;
    },
    actor: { userId: string; name: string; email?: string; role?: string },
) {
    await ensureRecruitmentSchema();

    const existing = await db.query.talent.findFirst({
        where: eq(talent.id, input.talentId),
    });
    if (!existing) {
        throw new Error("Talent not found.");
    }

    const derivedStatus =
        input.status ||
        (input.pipelineStage === "hired"
            ? "active"
            : input.pipelineStage === "rejected"
              ? "rejected"
              : "applicant");

    const derivedOnboardingStatus =
        input.pipelineStage === "hired"
            ? "completed"
            : input.pipelineStage === "onboarding"
              ? "in_progress"
              : input.pipelineStage === "offered"
                ? "invited"
                : existing.onboardingStatus;

    await db
        .update(talent)
        .set({
            pipelineStage: input.pipelineStage,
            status: derivedStatus,
            onboardingStatus: derivedOnboardingStatus,
            updatedAt: new Date(),
        })
        .where(eq(talent.id, input.talentId));

    const stageMeta = PIPELINE_STAGES.find((s) => s.id === input.pipelineStage);

    await db.insert(talentTimelineEntry).values({
        talentId: input.talentId,
        addedByUserId: actor.userId,
        title: `Pipeline-Phase: ${stageMeta?.labelDe || input.pipelineStage}`,
        description: input.note || `Status aktualisiert auf ${derivedStatus.toUpperCase()} durch ${actor.name}`,
        date: new Date(),
        type: input.pipelineStage === "hired" ? "Hiring" : "Evaluation",
        timestamp: new Date(),
        data: {
            date: new Date().toISOString(),
            comment: input.note || `Übergang von ${existing.pipelineStage} nach ${input.pipelineStage}`,
            previousStage: existing.pipelineStage,
            newStage: input.pipelineStage,
        },
    });

    const custody = await recordPersonnelMutation({
        talentId: input.talentId,
        contactId: existing.contactId,
        entityType: "talent",
        entityId: input.talentId,
        operation: "stage_transition",
        channel: "internal_ui",
        actor,
        beforeState: {
            status: existing.status,
            pipelineStage: existing.pipelineStage,
            onboardingStatus: existing.onboardingStatus,
        },
        afterState: {
            status: derivedStatus,
            pipelineStage: input.pipelineStage,
            onboardingStatus: derivedOnboardingStatus,
            note: input.note || null,
        },
        changeSummary: `Pipeline stage transitioned: ${existing.pipelineStage} -> ${input.pipelineStage} (${derivedStatus})`,
    });

    return {
        success: true,
        pipelineStage: input.pipelineStage,
        status: derivedStatus,
        ledgerBlockHash: custody.block.blockHash,
    };
}

