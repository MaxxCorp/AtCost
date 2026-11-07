import * as v from "valibot";
import { FilterableIdSchema } from "./pagination.js";

// ============================================================================
// 1. PIPELINE STAGES & BEST-PRACTICE TEMPLATES
// ============================================================================

export const PIPELINE_STAGE_VALUES = [
    "applied",
    "screening",
    "interview",
    "evaluation",
    "offered",
    "onboarding",
    "hired",
    "rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_VALUES)[number];

export interface PipelineStageMeta {
    id: PipelineStage;
    labelDe: string;
    labelEn: string;
    descriptionDe: string;
    descriptionEn: string;
    badgeClass: string;
    order: number;
}

export const PIPELINE_STAGES: readonly PipelineStageMeta[] = [
    {
        id: "applied",
        labelDe: "Eingegangen / Bewerbung",
        labelEn: "Applied / New",
        descriptionDe: "Bewerbung über Karriereportal, E-Mail-Link oder Direktaufnahme eingegangen",
        descriptionEn: "Application received via careers portal, email link, or internal entry",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
        order: 1,
    },
    {
        id: "screening",
        labelDe: "Vorauswahl (Screening)",
        labelEn: "Recruiter Screening",
        descriptionDe: "Prüfung der Unterlagen, Qualifikationen und Rahmenbedingungen",
        descriptionEn: "Review of qualifications, availability, and role fit",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        order: 2,
    },
    {
        id: "interview",
        labelDe: "Strukturiertes Interview",
        labelEn: "Structured Interview",
        descriptionDe: "Kompetenzbasiertes Interview mit verankerten Bewertungsrubriken",
        descriptionEn: "Competency-based interview with anchored scorecards",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        order: 3,
    },
    {
        id: "evaluation",
        labelDe: "Kalibrierung & Auswahl",
        labelEn: "Debrief & Calibration",
        descriptionDe: "Vergleich der Scorecards im Auswahlgremium und Einstellungsentscheidung",
        descriptionEn: "Panel scorecard calibration and hiring decision",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        order: 4,
    },
    {
        id: "offered",
        labelDe: "Vertragsangebot (Zusage)",
        labelEn: "Offer Extended",
        descriptionDe: "Bewerber ausgewählt, Angebot und Onboarding-Link bereitgestellt",
        descriptionEn: "Candidate selected, offer and onboarding link prepared",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        order: 5,
    },
    {
        id: "onboarding",
        labelDe: "Onboarding & Lohnstammdaten",
        labelEn: "Onboarding & Payroll Intake",
        descriptionDe: "Vervollständigung der Steuer-, SV-, Bank- und Zusatzfelder",
        descriptionEn: "Completion of statutory tax, social security, bank, and custom fields",
        badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
        order: 6,
    },
    {
        id: "hired",
        labelDe: "Eingestellt & Aktiv",
        labelEn: "Hired & Active",
        descriptionDe: "Onboarding abgeschlossen, Lohnprofil & Vertrag aktiv",
        descriptionEn: "Onboarding completed, payroll profile and contract active",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        order: 7,
    },
    {
        id: "rejected",
        labelDe: "Abgesagt / Talent-Pool",
        labelEn: "Archived / Talent Pool",
        descriptionDe: "Nicht ausgewählt oder auf Wunsch archiviert",
        descriptionEn: "Not selected or archived in talent pool",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        order: 8,
    },
] as const;

export interface DefaultCompetencyTemplate {
    id: string;
    competency: string;
    competencyEn: string;
    category: "technical" | "behavioral" | "values" | "leadership";
    weight: number;
    description: string;
    anchors: {
        1: string;
        3: string;
        5: string;
    };
}

export const DEFAULT_INTERVIEW_COMPETENCIES: readonly DefaultCompetencyTemplate[] = [
    {
        id: "role_expertise",
        competency: "Fach- & Methodenkompetenz",
        competencyEn: "Role & Domain Expertise",
        category: "technical",
        weight: 30,
        description: "Relevantes Fachwissen, Praxiserfahrung und methodische Sicherheit für die ausgeschriebene Stelle.",
        anchors: {
            1: "Grundlegende Fachkenntnisse fehlen; kann konkrete Praxisbeispiele nicht erläutern.",
            3: "Beherrscht alle Kernanforderungen sicher und belegt diese mit nachvollziehbaren Praxisbeispielen.",
            5: "Herausragende Fachexpertise; antizipiert komplexe Sonderfälle und bringt innovative Best Practices ein.",
        },
    },
    {
        id: "collaboration_empathy",
        competency: "Teamfähigkeit, Empathie & Klientenorientierung",
        competencyEn: "Collaboration, Empathy & Beneficiary Focus",
        category: "behavioral",
        weight: 25,
        description: "Wertschätzender Umgang im interdisziplinären Team sowie mit Klient:innen, Mitgliedern und Partnern.",
        anchors: {
            1: "Agiert isoliert; wenig Sensibilität für unterschiedliche Perspektiven oder Bedürfnisse.",
            3: "Kommuniziert kooperativ, hört aktiv zu und löst Spannungen im Team konstruktiv.",
            5: "Schafft aktiv psychologische Sicherheit, integriert diverse Gruppen und fördert Teamerfolge nachhaltig.",
        },
    },
    {
        id: "problem_solving",
        competency: "Strukturierte Problemlösung & Eigeninitiative",
        competencyEn: "Structured Problem Solving & Ownership",
        category: "technical",
        weight: 20,
        description: "Analytisches Vorgehen bei neuen Herausforderungen, Priorisierung und verlässliche Umsetzung.",
        anchors: {
            1: "Benötigt kleinschrittige Anleitung; verliert bei unklaren Anforderungen schnell den Überblick.",
            3: "Strukturiert Aufgaben selbstständig, erkennt Risiken frühzeitig und liefert verlässliche Ergebnisse.",
            5: "Entwickelt systematische Verbesserungen und löst auch abteilungsübergreifende Engpässe souverän.",
        },
    },
    {
        id: "values_alignment",
        competency: "Identifikation mit NGO-Werten, Vielfalt & Inklusion",
        competencyEn: "NGO Mission Alignment, Diversity & Inclusion",
        category: "values",
        weight: 15,
        description: "Übereinstimmung mit gemeinnützigen Zielen, Diskriminierungsschutz, Barrierefreiheit und Nachhaltigkeit.",
        anchors: {
            1: "Wenig Bezug zum gemeinnützigen Auftrag oder zu Prinzipien von Teilhabe und Inklusion.",
            3: "Teilt die Werte des Trägers überzeugend und handelt reflektiert sowie inklusiv.",
            5: "Tritt als inspirierender Multiplikator für soziale Teilhabe, Diversität und gemeinnützige Wirkung auf.",
        },
    },
    {
        id: "communication",
        competency: "Kommunikationsklarheit & Verbindlichkeit",
        competencyEn: "Clarity of Communication & Reliability",
        category: "behavioral",
        weight: 10,
        description: "Klare, adressatengerechte Ausdrucksweise und transparente Abstimmung.",
        anchors: {
            1: "Antworten bleiben vage oder widersprüchlich; Absprachen wirken unverbindlich.",
            3: "Drückt sich präzise, strukturiert und adressatengerecht aus.",
            5: "Überzeugt auch in schwierigen Gesprächssituationen durch höchste Klarheit, Ruhe und Verbindlichkeit.",
        },
    },
] as const;

export interface CustomOnboardingFieldTemplate {
    id: string;
    key: string;
    labelDe: string;
    labelEn: string;
    type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "url";
    required: boolean;
    category: "compliance" | "equipment" | "personal" | "payroll" | "custom";
    options?: string[];
    helpText?: string;
}

export const DEFAULT_CUSTOM_ONBOARDING_FIELDS: readonly CustomOnboardingFieldTemplate[] = [
    {
        id: "emergency_contact_name",
        key: "emergencyContactName",
        labelDe: "Notfallkontakt (Vor- und Nachname, Beziehung)",
        labelEn: "Emergency Contact (Full Name & Relationship)",
        type: "text",
        required: true,
        category: "personal",
        helpText: "Wird ausschließlich für medizinische oder betriebliche Notfälle verschlüsselt hinterlegt.",
    },
    {
        id: "emergency_contact_phone",
        key: "emergencyContactPhone",
        labelDe: "Notfallkontakt Telefonnummer",
        labelEn: "Emergency Contact Phone Number",
        type: "text",
        required: true,
        category: "personal",
    },
    {
        id: "work_permit_status",
        key: "workPermitStatus",
        labelDe: "Staatsangehörigkeit / Arbeitserlaubnis-Status",
        labelEn: "Citizenship / Work Authorization Status",
        type: "select",
        required: true,
        category: "compliance",
        options: [
            "EU / EWR / Schweiz (uneingeschränkt)",
            "Unbefristeter Aufenthaltstitel / Niederlassungserlaubnis",
            "Befristete Arbeitserlaubnis / Blaue Karte EU",
            "Sonstiges / In Beantragung",
        ],
    },
    {
        id: "police_clearance_date",
        key: "policeClearanceDate",
        labelDe: "Erweitertes Führungszeugnis (§ 30a BZRG) – Ausstellungsdatum",
        labelEn: "Extended Police Clearance Certificate Issue Date",
        type: "date",
        required: false,
        category: "compliance",
        helpText: "Falls für die Tätigkeit im sozialen/pädagogischen Bereich erforderlich.",
    },
    {
        id: "measles_immunity_verified",
        key: "measlesImmunityVerified",
        labelDe: "Masernschutz-Nachweis gem. § 20 IfSG liegt vor (falls Gemeinschaftseinrichtung)",
        labelEn: "Measles Immunity Proof (§ 20 IfSG) Available",
        type: "checkbox",
        required: false,
        category: "compliance",
    },
    {
        id: "it_workspace_preferences",
        key: "itWorkspacePreferences",
        labelDe: "IT-Ausstattung, Barrierefreiheit & Arbeitsplatz-Bedarfe",
        labelEn: "IT Equipment, Accessibility & Workspace Needs",
        type: "textarea",
        required: false,
        category: "equipment",
        helpText: "z.B. Betriebssystem-Präferenz, ergonomische Hilfsmittel, Assistenztechnologien, ÖPNV-Firmenticket.",
    },
] as const;

// ============================================================================
// 2. JOB POSTING VALIDATION SCHEMAS
// ============================================================================

export const jobPostingSchema = v.object({
    id: v.optional(v.string()),
    title: v.pipe(v.string(), v.minLength(2, "Job title is required")),
    slug: v.optional(v.string()),
    department: v.pipe(v.string(), v.minLength(2, "Department is required")),
    roleCategory: v.optional(v.string(), "general"),
    employmentType: v.optional(
        v.picklist(["regular", "minijob", "midijob", "student", "freelance", "sgb2_16d", "sgb2_16i", "voluntary"]),
        "regular",
    ),
    workModel: v.optional(v.picklist(["onsite", "hybrid", "remote"]), "onsite"),
    workHoursPerWeek: v.optional(v.union([v.number(), v.string()]), 39),
    contractFrameworkCode: v.optional(v.string()),
    entgeltgruppe: v.optional(v.string()),
    erfahrungsstufe: v.optional(v.union([v.number(), v.string()]), 1),
    salaryRangeMin: v.optional(v.union([v.number(), v.string()])),
    salaryRangeMax: v.optional(v.union([v.number(), v.string()])),
    currency: v.optional(v.string(), "EUR"),
    sgb2Eligible: v.optional(v.picklist(["none", "sgb2_16d", "sgb2_16i"]), "none"),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    responsibilities: v.optional(v.string()),
    qualifications: v.optional(v.string()),
    benefits: v.optional(v.string()),
    equalOpportunityStatement: v.optional(v.string()),
    accessibilityNotes: v.optional(v.string()),
    isPublic: v.optional(v.union([v.boolean(), v.string()]), true),
    status: v.optional(v.picklist(["draft", "published", "paused", "closed", "archived"]), "published"),
    openingsCount: v.optional(v.union([v.number(), v.string()]), 1),
    hiringManagerTalentId: v.optional(v.string()),
    hrResponsibleUserId: v.optional(v.string()),
    closingDate: v.optional(v.string()),
    targetHireDate: v.optional(v.string()),
    // English i18n optional fields
    titleEn: v.optional(v.string()),
    departmentEn: v.optional(v.string()),
    summaryEn: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    responsibilitiesEn: v.optional(v.string()),
    qualificationsEn: v.optional(v.string()),
    benefitsEn: v.optional(v.string()),
    // JSON serialized arrays for EntityManager & templates
    locationIdsJson: v.optional(v.string()),
    contactIdsJson: v.optional(v.string()),
    tagsJson: v.optional(v.string()),
    syncIdsJson: v.optional(v.string()),
    interviewScorecardJson: v.optional(v.string()),
    customOnboardingFieldsJson: v.optional(v.string()),
});

export const createJobPostingSchema = jobPostingSchema;

export const updateJobPostingSchema = v.object({
    ...jobPostingSchema.entries,
    id: v.pipe(v.string(), v.minLength(1)),
});

export const jobPostingPaginationSchema = v.optional(
    v.object({
        page: v.optional(v.number(), 1),
        limit: v.optional(v.number(), 50),
        search: v.optional(v.string()),
        department: v.optional(v.string()),
        employmentType: v.optional(v.string()),
        workModel: v.optional(v.string()),
        status: FilterableIdSchema,
        locationId: FilterableIdSchema,
        tagId: FilterableIdSchema,
        onlyPublic: v.optional(v.boolean()),
    }),
    {},
);

// ============================================================================
// 3. STORY 2: CANDIDATE APPLICATION & CONTACT INTAKE SCHEMAS
// ============================================================================

export const applicantIntakeSchema = v.object({
    invitationToken: v.optional(v.string()),
    jobPostingId: v.optional(v.string()),
    channel: v.optional(v.picklist(["public_portal", "magic_link", "internal_ui"]), "public_portal"),
    givenName: v.pipe(v.string(), v.minLength(1, "Vorname ist erforderlich / First name is required")),
    familyName: v.pipe(v.string(), v.minLength(1, "Nachname ist erforderlich / Last name is required")),
    honorificPrefix: v.optional(v.string()),
    email: v.pipe(v.string(), v.email("Gültige E-Mail erforderlich / Valid email required")),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    zip: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string(), "DE"),
    birthday: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    salaryExpectation: v.optional(v.string()),
    availabilityDate: v.optional(v.string()),
    resumeUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    motivationNotes: v.optional(v.string()),
    accessibilityAccommodations: v.optional(v.string()),
    sgb2Interest: v.optional(v.picklist(["none", "sgb2_16d", "sgb2_16i"]), "none"),
    gdprConsent: v.optional(v.boolean(), false),
});

export const sendApplicantInvitationSchema = v.object({
    invitationType: v.picklist(["application", "onboarding"]),
    email: v.pipe(v.string(), v.email("Bitte geben Sie eine gültige E-Mail-Adresse ein")),
    givenName: v.optional(v.string()),
    familyName: v.optional(v.string()),
    jobPostingId: v.optional(v.string()),
    talentId: v.optional(v.string()),
    personalMessage: v.optional(v.string()),
    expiresInDays: v.optional(v.union([v.number(), v.string()]), 14),
    customFieldsConfigJson: v.optional(v.string()),
});

// ============================================================================
// 4. STORY 3: STRUCTURED INTERVIEW SCORECARD SCHEMA
// ============================================================================

export const submitInterviewScorecardSchema = v.object({
    id: v.optional(v.string()),
    talentId: v.pipe(v.string(), v.minLength(1, "Talent ID is required")),
    jobPostingId: v.optional(v.string()),
    stage: v.optional(
        v.picklist(["screening", "technical", "team_culture", "practical_trial", "final_panel"]),
        "screening",
    ),
    interviewType: v.optional(v.picklist(["video", "onsite", "phone", "panel"]), "video"),
    conductedAt: v.optional(v.string()),
    interviewerName: v.pipe(v.string(), v.minLength(1, "Interviewer name is required")),
    interviewerRole: v.optional(v.string(), "Hiring Team"),
    recommendation: v.picklist(["strong_hire", "hire", "leaning_hire", "leaning_no_hire", "no_hire"]),
    strengths: v.pipe(v.string(), v.minLength(3, "Bitte Stärken / Belege dokumentieren")),
    concerns: v.optional(v.string()),
    calibrationNotes: v.optional(v.string()),
    competencyScoresJson: v.pipe(v.string(), v.minLength(2, "Kompetenzbewertung ist erforderlich")),
    structuredQuestionsJson: v.optional(v.string()),
    advancePipelineStage: v.optional(v.string()),
});

// ============================================================================
// 5. STORY 4: CUSTOMIZABLE ONBOARDING & PAYROLL PROFILE COMPLETION SCHEMA
// ============================================================================

export const onboardingPayrollSubmissionSchema = v.object({
    invitationToken: v.optional(v.string()),
    talentId: v.optional(v.string()),
    jobPostingId: v.optional(v.string()),
    filledByChannel: v.optional(
        v.picklist(["candidate_magic_link", "internal_team", "self_service"]),
        "internal_team",
    ),
    // Personal & Address Details
    givenName: v.pipe(v.string(), v.minLength(1, "Vorname ist erforderlich")),
    familyName: v.pipe(v.string(), v.minLength(1, "Nachname ist erforderlich")),
    birthday: v.pipe(v.string(), v.minLength(4, "Geburtsdatum ist für DEÜV/ELStAM erforderlich")),
    gender: v.optional(v.string()),
    street: v.pipe(v.string(), v.minLength(1, "Straße ist erforderlich")),
    houseNumber: v.pipe(v.string(), v.minLength(1, "Hausnummer ist erforderlich")),
    zip: v.pipe(v.string(), v.minLength(4, "Postleitzahl ist erforderlich")),
    city: v.pipe(v.string(), v.minLength(2, "Wohnort ist erforderlich")),
    country: v.optional(v.string(), "DE"),
    phone: v.optional(v.string()),

    // Statutory German Tax (ELStAM)
    taxId: v.pipe(v.string(), v.minLength(11, "11-stellige Steuer-ID erforderlich")),
    taxClass: v.optional(v.picklist(["1", "2", "3", "4", "5", "6"]), "1"),
    childCount: v.optional(v.union([v.number(), v.string()]), 0),
    hasChildren: v.optional(v.boolean(), false),
    churchTax: v.optional(v.picklist(["none", "ev", "rk"]), "none"),
    state: v.optional(v.string(), "BE"),

    // Statutory Social Security & Insurers (KV / RV / AV / PV / BG / ZVK)
    socialSecurityNumber: v.pipe(v.string(), v.minLength(8, "Sozialversicherungsnummer erforderlich")),
    healthInsuranceType: v.optional(v.picklist(["statutory", "private"]), "statutory"),
    hmoId: v.optional(v.string()),
    healthInsuranceName: v.pipe(v.string(), v.minLength(2, "Krankenkasse ist erforderlich")),
    healthInsuranceAdditionalContributionPercent: v.optional(v.union([v.number(), v.string()]), 2.5),
    accidentHmoId: v.optional(v.string()),
    pensionHmoId: v.optional(v.string()),
    pensionInsuranceExempt: v.optional(v.boolean(), false),
    unemploymentInsuranceExempt: v.optional(v.boolean(), false),

    // Employment & SGB II (§ 16d / § 16i)
    employmentType: v.optional(
        v.picklist(["regular", "minijob", "midijob", "student", "freelance", "sgb2_16d", "sgb2_16i"]),
        "regular",
    ),
    fundingProgram: v.optional(v.picklist(["none", "sgb2_16d", "sgb2_16i"]), "none"),
    fundingSubsidyPercentage: v.optional(v.union([v.number(), v.string()]), 100),
    jobcenterName: v.optional(v.string()),
    jobcenterReference: v.optional(v.string()),
    deuevPersonengruppe: v.optional(v.string(), "101"),
    deuevBeitragsgruppe: v.optional(v.string(), "1111"),

    // SEPA Banking Details
    iban: v.pipe(v.string(), v.minLength(15, "Gültige IBAN für Gehaltsabrechnung erforderlich")),
    bic: v.optional(v.string()),
    bankName: v.optional(v.string()),

    // Contract Auto-Provisioning Options (for Internal Team)
    autoCreateContract: v.optional(v.boolean(), false),
    contractStartDate: v.optional(v.string()),
    contractWageType: v.optional(v.picklist(["hourly", "monthly"]), "monthly"),
    contractWageAmount: v.optional(v.union([v.number(), v.string()])),
    contractWorkHoursPerWeek: v.optional(v.union([v.number(), v.string()]), 39),
    contractEntgeltgruppe: v.optional(v.string()),
    contractErfahrungsstufe: v.optional(v.union([v.number(), v.string()]), 1),

    // Customizable Additional Fields JSON
    customFieldDefinitionsJson: v.optional(v.string()),
    customFieldResponsesJson: v.optional(v.string()),
    markAsHiredAndActive: v.optional(v.boolean(), false),
});

export const pipelineStageTransitionSchema = v.object({
    talentId: v.pipe(v.string(), v.minLength(1)),
    pipelineStage: v.picklist(PIPELINE_STAGE_VALUES),
    status: v.optional(v.picklist(["active", "inactive", "applicant", "rejected"])),
    note: v.optional(v.string()),
});

export const restorePersonnelVersionSchema = v.object({
    talentId: v.pipe(v.string(), v.minLength(1)),
    versionNumber: v.number(),
});

