import {
    pgTable,
    text,
    timestamp,
    uuid,
    jsonb,
    doublePrecision,
    boolean,
    integer,
    primaryKey,
    index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { contact, tag } from "./contacts";
import { location } from "./resources";
import { talent } from "./talents";

// ============================================================================
// 1. CRYPTOGRAPHIC PKI & ENVELOPE KEY MANAGEMENT TABLES
// ============================================================================

export interface WrappedKeyMaterial {
    algorithm: string;
    ivBase64: string;
    authTagBase64: string;
    ciphertextBase64: string;
    kdfSaltBase64: string;
    providerType: "m365-entra-oidc" | "local-pki-ca" | "webcrypto-passkey" | "external-kms";
    entraBinding?: {
        tenantId?: string;
        objectId?: string;
        upnHash?: string;
        oneDriveAppFolderEscrow?: boolean;
    };
}

export interface WrappedRecipientDek {
    keyPairId: string;
    ownerType: "org_master" | "role" | "user";
    ownerId: string;
    providerType: "m365-entra-oidc" | "local-pki-ca" | "webcrypto-passkey" | "external-kms";
    keyFingerprint: string;
    wrappedDekBase64: string;
}

export interface EncryptedEnvelopePayload {
    envelopeVersion: number;
    algorithm: "AES-256-GCM";
    dataKeyId: string;
    keyVersion: number;
    ivBase64: string;
    authTagBase64: string;
    aadText: string;
    ciphertextBase64: string;
    encryptedAt: string;
}

export const cryptoKeyPair = pgTable(
    "crypto_key_pair",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        ownerType: text("owner_type", { enum: ["org_master", "role", "user"] }).notNull(),
        ownerId: text("owner_id").notNull(), // e.g. 'org', 'hr_manager', 'admin', or user.id
        label: text("label").notNull(),
        providerType: text("provider_type", {
            enum: ["m365-entra-oidc", "local-pki-ca", "webcrypto-passkey", "external-kms"],
        })
            .default("m365-entra-oidc")
            .notNull(),
        entraTenantId: text("entra_tenant_id"),
        entraObjectId: text("entra_object_id"),
        encryptionAlgorithm: text("encryption_algorithm").default("RSA-OAEP-256").notNull(),
        signingAlgorithm: text("signing_algorithm").default("RSASSA-PSS-SHA256").notNull(),
        publicKeySpki: text("public_key_spki").notNull(),
        signingPublicKeySpki: text("signing_public_key_spki").notNull(),
        encryptedPrivateKey: jsonb("encrypted_private_key").$type<WrappedKeyMaterial>().notNull(),
        encryptedSigningPrivateKey: jsonb("encrypted_signing_private_key").$type<WrappedKeyMaterial>().notNull(),
        keyFingerprint: text("key_fingerprint").notNull(),
        x509Subject: text("x509_subject").notNull(),
        status: text("status", { enum: ["active", "rotated", "revoked"] }).default("active").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index("crypto_key_pair_owner_idx").on(table.ownerType, table.ownerId),
        index("crypto_key_pair_fingerprint_idx").on(table.keyFingerprint),
    ],
);

export const cryptoDataKey = pgTable(
    "crypto_data_key",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        subjectType: text("subject_type", { enum: ["talent", "contact", "sync_config"] }).notNull(),
        subjectId: uuid("subject_id").notNull(),
        keyVersion: integer("key_version").default(1).notNull(),
        algorithm: text("algorithm").default("AES-256-GCM").notNull(),
        recordSalt: text("record_salt").notNull(),
        wrappedKeys: jsonb("wrapped_keys").$type<WrappedRecipientDek[]>().default([]).notNull(),
        status: text("status", { enum: ["active", "shredded", "rotated"] }).default("active").notNull(),
        shreddedAt: timestamp("shredded_at"),
        shreddedByUserId: text("shredded_by_user_id"),
        shredReason: text("shred_reason"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index("crypto_data_key_subject_idx").on(table.subjectType, table.subjectId),
        index("crypto_data_key_status_idx").on(table.status),
    ],
);

// ============================================================================
// 2. BLOCKCHAIN CHAIN OF CUSTODY (RFC 8785 JCS + RFC 7515 JWS + RFC 6962 MERKLE)
// ============================================================================

export interface SignedTreeHead {
    standard: "IETF-RFC-6962-Merkle-v1";
    treeSize: number;
    rootHash: string;
    timestamp: string;
    signerKeyFingerprint: string;
    signatureBase64: string;
}

export interface FieldDiffRecord {
    field: string;
    before: unknown;
    after: unknown;
    isEncrypted?: boolean;
}

export const personnelLedgerBlock = pgTable(
    "personnel_ledger_block",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        blockIndex: integer("block_index").notNull(),
        previousBlockHash: text("previous_block_hash").notNull(),
        previousEntityBlockHash: text("previous_entity_block_hash").notNull(),
        blockHash: text("block_hash").notNull(),
        merkleRootHash: text("merkle_root_hash").notNull(),
        signedTreeHead: jsonb("signed_tree_head").$type<SignedTreeHead>().notNull(),
        talentId: uuid("talent_id").references(() => talent.id, { onDelete: "set null" }),
        contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        versionNumber: integer("version_number").default(1).notNull(),
        operation: text("operation", {
            enum: [
                "create",
                "update",
                "delete",
                "restore",
                "stage_transition",
                "interview_rating",
                "onboarding_submit",
                "obfuscate",
                "crypto_shred",
            ],
        }).notNull(),
        channel: text("channel", {
            enum: [
                "internal_ui",
                "public_portal",
                "magic_link",
                "self_service",
                "sync_provider",
                "system_automation",
                "gdpr_portal",
            ],
        })
            .default("internal_ui")
            .notNull(),
        actorUserId: text("actor_user_id").notNull(),
        actorName: text("actor_name").notNull(),
        actorEmailHash: text("actor_email_hash").notNull(), // Pseudonymized SHA-256/HMAC for GDPR compliance
        actorRole: text("actor_role").notNull(),
        changedFields: jsonb("changed_fields").$type<string[]>().default([]).notNull(),
        changeSummary: text("change_summary").notNull(),
        payloadCommitmentHash: text("payload_commitment_hash").notNull(),
        signatureBase64: text("signature_base64").notNull(),
        signerKeyFingerprint: text("signer_key_fingerprint").notNull(),
        timestamp: timestamp("timestamp").defaultNow().notNull(),
    },
    (table) => [
        index("personnel_ledger_block_index_idx").on(table.blockIndex),
        index("personnel_ledger_talent_idx").on(table.talentId),
        index("personnel_ledger_contact_idx").on(table.contactId),
        index("personnel_ledger_hash_idx").on(table.blockHash),
    ],
);

export const personnelDataVersion = pgTable(
    "personnel_data_version",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        talentId: uuid("talent_id").references(() => talent.id, { onDelete: "cascade" }),
        contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        versionNumber: integer("version_number").notNull(),
        ledgerBlockId: uuid("ledger_block_id").references(() => personnelLedgerBlock.id, { onDelete: "set null" }),
        ledgerBlockHash: text("ledger_block_hash").notNull(),
        operation: text("operation").notNull(),
        channel: text("channel").default("internal_ui").notNull(),
        encryptedSnapshot: jsonb("encrypted_snapshot").$type<EncryptedEnvelopePayload | null>(),
        redactedSummary: jsonb("redacted_summary").$type<Record<string, unknown>>().default({}).notNull(),
        fieldDiffs: jsonb("field_diffs").$type<FieldDiffRecord[]>().default([]).notNull(),
        restoredFromVersion: integer("restored_from_version"),
        isShredded: boolean("is_shredded").default(false).notNull(),
        createdByUserId: text("created_by_user_id").notNull(),
        createdByName: text("created_by_name").notNull(),
        createdByRole: text("created_by_role").default("user").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("personnel_version_talent_idx").on(table.talentId, table.versionNumber),
        index("personnel_version_entity_idx").on(table.entityType, table.entityId, table.versionNumber),
    ],
);

// ============================================================================
// 3. RECRUITMENT: JOB POSTINGS, INVITATIONS, INTERVIEWS & ONBOARDING
// ============================================================================

export interface InterviewCompetencyDef {
    id: string;
    competency: string;
    competencyEn?: string;
    category: "technical" | "behavioral" | "values" | "leadership";
    weight: number;
    description: string;
    anchors: {
        1: string;
        3: string;
        5: string;
    };
}

export interface CustomOnboardingFieldDef {
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

export interface JobPostingTranslations {
    de?: {
        title?: string;
        department?: string;
        summary?: string;
        description?: string;
        responsibilities?: string;
        qualifications?: string;
        benefits?: string;
    };
    en?: {
        title?: string;
        department?: string;
        summary?: string;
        description?: string;
        responsibilities?: string;
        qualifications?: string;
        benefits?: string;
    };
}

export const jobPosting = pgTable(
    "job_posting",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        title: text("title").notNull(),
        slug: text("slug").notNull(),
        department: text("department").notNull(),
        roleCategory: text("role_category").default("general").notNull(),
        employmentType: text("employment_type", {
            enum: ["regular", "minijob", "midijob", "student", "freelance", "sgb2_16d", "sgb2_16i", "voluntary"],
        })
            .default("regular")
            .notNull(),
        workModel: text("work_model", { enum: ["onsite", "hybrid", "remote"] }).default("onsite").notNull(),
        workHoursPerWeek: doublePrecision("work_hours_per_week").default(39).notNull(),
        contractFrameworkCode: text("contract_framework_code"), // e.g. 'AWO_BERLIN', 'TV_L', 'SGB2_16I'
        entgeltgruppe: text("entgeltgruppe"),
        erfahrungsstufe: integer("erfahrungsstufe").default(1),
        salaryRangeMin: doublePrecision("salary_range_min"),
        salaryRangeMax: doublePrecision("salary_range_max"),
        currency: text("currency").default("EUR").notNull(),
        sgb2Eligible: text("sgb2_eligible", { enum: ["none", "sgb2_16d", "sgb2_16i"] }).default("none").notNull(),
        summary: text("summary"),
        description: text("description"),
        responsibilities: text("responsibilities"),
        qualifications: text("qualifications"),
        benefits: text("benefits"),
        equalOpportunityStatement: text("equal_opportunity_statement"),
        accessibilityNotes: text("accessibility_notes"),
        isPublic: boolean("is_public").default(true).notNull(),
        status: text("status", { enum: ["draft", "published", "paused", "closed", "archived"] })
            .default("published")
            .notNull(),
        openingsCount: integer("openings_count").default(1).notNull(),
        hiringManagerTalentId: uuid("hiring_manager_talent_id").references(() => talent.id, { onDelete: "set null" }),
        hrResponsibleUserId: text("hr_responsible_user_id").references(() => user.id, { onDelete: "set null" }),
        createdByUserId: text("created_by_user_id"),
        interviewScorecardTemplate: jsonb("interview_scorecard_template")
            .$type<InterviewCompetencyDef[]>()
            .default([])
            .notNull(),
        customOnboardingFields: jsonb("custom_onboarding_fields")
            .$type<CustomOnboardingFieldDef[]>()
            .default([])
            .notNull(),
        translations: jsonb("translations").$type<JobPostingTranslations>().default({}).notNull(),
        syncIds: jsonb("sync_ids").$type<string[]>().default([]).notNull(),
        publishedAt: timestamp("published_at"),
        closingDate: timestamp("closing_date"),
        targetHireDate: timestamp("target_hire_date"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index("job_posting_status_public_idx").on(table.status, table.isPublic),
        index("job_posting_department_idx").on(table.department),
    ],
);

export const jobPostingLocation = pgTable(
    "job_posting_location",
    {
        jobPostingId: uuid("job_posting_id")
            .notNull()
            .references(() => jobPosting.id, { onDelete: "cascade" }),
        locationId: uuid("location_id")
            .notNull()
            .references(() => location.id, { onDelete: "cascade" }),
    },
    (table) => [primaryKey({ columns: [table.jobPostingId, table.locationId] })],
);

export const jobPostingContact = pgTable(
    "job_posting_contact",
    {
        jobPostingId: uuid("job_posting_id")
            .notNull()
            .references(() => jobPosting.id, { onDelete: "cascade" }),
        contactId: uuid("contact_id")
            .notNull()
            .references(() => contact.id, { onDelete: "cascade" }),
        role: text("role").default("hiring_team").notNull(),
    },
    (table) => [primaryKey({ columns: [table.jobPostingId, table.contactId] })],
);

export const jobPostingTag = pgTable(
    "job_posting_tag",
    {
        jobPostingId: uuid("job_posting_id")
            .notNull()
            .references(() => jobPosting.id, { onDelete: "cascade" }),
        tagId: uuid("tag_id")
            .notNull()
            .references(() => tag.id, { onDelete: "cascade" }),
    },
    (table) => [primaryKey({ columns: [table.jobPostingId, table.tagId] })],
);

export const applicantInvitation = pgTable(
    "applicant_invitation",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        token: text("token").notNull().unique(),
        invitationType: text("invitation_type", { enum: ["application", "onboarding"] }).notNull(),
        email: text("email").notNull(),
        givenName: text("given_name"),
        familyName: text("family_name"),
        jobPostingId: uuid("job_posting_id").references(() => jobPosting.id, { onDelete: "set null" }),
        talentId: uuid("talent_id").references(() => talent.id, { onDelete: "cascade" }),
        status: text("status", { enum: ["pending", "opened", "completed", "expired", "revoked"] })
            .default("pending")
            .notNull(),
        customFieldsConfig: jsonb("custom_fields_config")
            .$type<CustomOnboardingFieldDef[]>()
            .default([])
            .notNull(),
        prefillData: jsonb("prefill_data").$type<Record<string, unknown>>().default({}).notNull(),
        invitedByUserId: text("invited_by_user_id"),
        invitedByName: text("invited_by_name"),
        personalMessage: text("personal_message"),
        sentAt: timestamp("sent_at").defaultNow().notNull(),
        openedAt: timestamp("opened_at"),
        completedAt: timestamp("completed_at"),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index("applicant_invitation_token_idx").on(table.token),
        index("applicant_invitation_talent_idx").on(table.talentId),
    ],
);

export interface CompetencyScoreRecord {
    competencyId: string;
    competency: string;
    category: string;
    weight: number;
    score: number; // 1 to 5 anchored rubric
    evidenceNotes: string;
}

export interface StructuredQuestionRecord {
    question: string;
    answerNotes: string;
    rating?: number;
}

export const interviewEvaluation = pgTable(
    "interview_evaluation",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        talentId: uuid("talent_id")
            .notNull()
            .references(() => talent.id, { onDelete: "cascade" }),
        jobPostingId: uuid("job_posting_id").references(() => jobPosting.id, { onDelete: "set null" }),
        stage: text("stage", {
            enum: ["screening", "technical", "team_culture", "practical_trial", "final_panel"],
        })
            .default("screening")
            .notNull(),
        interviewType: text("interview_type", { enum: ["video", "onsite", "phone", "panel"] })
            .default("video")
            .notNull(),
        scheduledAt: timestamp("scheduled_at"),
        conductedAt: timestamp("conducted_at").defaultNow().notNull(),
        interviewerUserId: text("interviewer_user_id"),
        interviewerName: text("interviewer_name").notNull(),
        interviewerRole: text("interviewer_role").default("Hiring Team").notNull(),
        status: text("status", { enum: ["scheduled", "in_progress", "submitted", "calibrated"] })
            .default("submitted")
            .notNull(),
        competencyScores: jsonb("competency_scores").$type<CompetencyScoreRecord[]>().default([]).notNull(),
        overallScore: doublePrecision("overall_score").default(0).notNull(),
        recommendation: text("recommendation", {
            enum: ["strong_hire", "hire", "leaning_hire", "leaning_no_hire", "no_hire"],
        })
            .default("hire")
            .notNull(),
        strengths: text("strengths"),
        concerns: text("concerns"),
        structuredQuestions: jsonb("structured_questions").$type<StructuredQuestionRecord[]>().default([]).notNull(),
        calibrationNotes: text("calibration_notes"),
        isBlindSubmitted: boolean("is_blind_submitted").default(true).notNull(),
        ledgerBlockId: uuid("ledger_block_id"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index("interview_eval_talent_idx").on(table.talentId),
        index("interview_eval_job_idx").on(table.jobPostingId),
    ],
);

export const onboardingSubmission = pgTable(
    "onboarding_submission",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        talentId: uuid("talent_id")
            .notNull()
            .references(() => talent.id, { onDelete: "cascade" }),
        jobPostingId: uuid("job_posting_id").references(() => jobPosting.id, { onDelete: "set null" }),
        invitationId: uuid("invitation_id").references(() => applicantInvitation.id, { onDelete: "set null" }),
        status: text("status", { enum: ["invited", "in_progress", "submitted", "verified", "provisioned"] })
            .default("in_progress")
            .notNull(),
        filledByChannel: text("filled_by_channel", {
            enum: ["candidate_magic_link", "internal_team", "self_service"],
        })
            .default("internal_team")
            .notNull(),
        submittedByUserId: text("submitted_by_user_id"),
        verifiedByUserId: text("verified_by_user_id"),
        payrollData: jsonb("payroll_data").$type<Record<string, unknown>>().default({}).notNull(),
        customFieldDefinitions: jsonb("custom_field_definitions")
            .$type<CustomOnboardingFieldDef[]>()
            .default([])
            .notNull(),
        customFieldResponses: jsonb("custom_field_responses")
            .$type<Record<string, unknown>>()
            .default({})
            .notNull(),
        encryptedPayload: jsonb("encrypted_payload").$type<EncryptedEnvelopePayload | null>(),
        ledgerBlockId: uuid("ledger_block_id"),
        submittedAt: timestamp("submitted_at"),
        verifiedAt: timestamp("verified_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index("onboarding_submission_talent_idx").on(table.talentId),
        index("onboarding_submission_status_idx").on(table.status),
    ],
);

export type CryptoKeyPair = typeof cryptoKeyPair.$inferSelect;
export type NewCryptoKeyPair = typeof cryptoKeyPair.$inferInsert;
export type CryptoDataKey = typeof cryptoDataKey.$inferSelect;
export type NewCryptoDataKey = typeof cryptoDataKey.$inferInsert;
export type PersonnelLedgerBlock = typeof personnelLedgerBlock.$inferSelect;
export type NewPersonnelLedgerBlock = typeof personnelLedgerBlock.$inferInsert;
export type PersonnelDataVersion = typeof personnelDataVersion.$inferSelect;
export type NewPersonnelDataVersion = typeof personnelDataVersion.$inferInsert;
export type JobPosting = typeof jobPosting.$inferSelect;
export type NewJobPosting = typeof jobPosting.$inferInsert;
export type ApplicantInvitation = typeof applicantInvitation.$inferSelect;
export type NewApplicantInvitation = typeof applicantInvitation.$inferInsert;
export type InterviewEvaluation = typeof interviewEvaluation.$inferSelect;
export type NewInterviewEvaluation = typeof interviewEvaluation.$inferInsert;
export type OnboardingSubmission = typeof onboardingSubmission.$inferSelect;
export type NewOnboardingSubmission = typeof onboardingSubmission.$inferInsert;

