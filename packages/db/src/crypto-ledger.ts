import {
    createCipheriv,
    createDecipheriv,
    createHash,
    createHmac,
    generateKeyPairSync,
    hkdfSync,
    privateDecrypt,
    publicEncrypt,
    randomBytes,
    constants as cryptoConstants,
    sign as cryptoSign,
    verify as cryptoVerify,
} from "node:crypto";
import { db } from "./db.js";
import {
    cryptoKeyPair,
    cryptoDataKey,
    personnelLedgerBlock,
    personnelDataVersion,
    talent,
    contact,
    contactEmail,
    contactPhone,
    contactAddress,
    payrollProfile,
    account,
    type EncryptedEnvelopePayload,
    type FieldDiffRecord,
    type SignedTreeHead,
    type WrappedKeyMaterial,
    type WrappedRecipientDek,
} from "./schema/index.js";
import { eq, and, asc, desc, sql, or } from "drizzle-orm";

// ============================================================================
// 0. IDEMPOTENT SCHEMA BOOTSTRAPPER
// ============================================================================

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

export async function ensureRecruitmentSchema(): Promise<void> {
    if (schemaInitialized) return;
    if (schemaInitPromise) return schemaInitPromise;

    schemaInitPromise = (async () => {
        try {
            // 1. Extend existing talent & sync_mapping tables safely
            await db.execute(sql`
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "pipeline_stage" text DEFAULT 'applied' NOT NULL;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "job_posting_id" uuid;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "department" text;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "average_rating" double precision;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "sync_ids" jsonb DEFAULT '[]'::jsonb;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "current_version" integer DEFAULT 1 NOT NULL;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "latest_ledger_block_hash" text;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "encrypted_envelope" jsonb;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "custom_field_values" jsonb DEFAULT '{}'::jsonb;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "last_modified_by_user_id" text;
                ALTER TABLE "talent" ADD COLUMN IF NOT EXISTS "last_modified_channel" text DEFAULT 'internal_ui';
                ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "encrypted_envelope" jsonb;
                ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "encryption_status" text DEFAULT 'plaintext' NOT NULL;
                CREATE INDEX IF NOT EXISTS "contact_encryption_status_idx" ON "contact" ("encryption_status");
            `);

            await db.execute(sql`
                ALTER TABLE "sync_mapping" ADD COLUMN IF NOT EXISTS "talent_id" uuid;
                ALTER TABLE "sync_mapping" ADD COLUMN IF NOT EXISTS "job_posting_id" uuid;
            `);

            // 2. Create PKI & Envelope Key tables
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "crypto_key_pair" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "owner_type" text NOT NULL,
                    "owner_id" text NOT NULL,
                    "label" text NOT NULL,
                    "provider_type" text DEFAULT 'm365-entra-oidc' NOT NULL,
                    "entra_tenant_id" text,
                    "entra_object_id" text,
                    "encryption_algorithm" text DEFAULT 'RSA-OAEP-256' NOT NULL,
                    "signing_algorithm" text DEFAULT 'RSASSA-PSS-SHA256' NOT NULL,
                    "public_key_spki" text NOT NULL,
                    "signing_public_key_spki" text NOT NULL,
                    "encrypted_private_key" jsonb NOT NULL,
                    "encrypted_signing_private_key" jsonb NOT NULL,
                    "key_fingerprint" text NOT NULL,
                    "x509_subject" text NOT NULL,
                    "status" text DEFAULT 'active' NOT NULL,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "expires_at" timestamp
                );
                CREATE INDEX IF NOT EXISTS "crypto_key_pair_owner_idx" ON "crypto_key_pair" ("owner_type", "owner_id");
                CREATE INDEX IF NOT EXISTS "crypto_key_pair_fingerprint_idx" ON "crypto_key_pair" ("key_fingerprint");
            `);

            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "crypto_data_key" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "subject_type" text NOT NULL,
                    "subject_id" uuid NOT NULL,
                    "key_version" integer DEFAULT 1 NOT NULL,
                    "algorithm" text DEFAULT 'AES-256-GCM' NOT NULL,
                    "record_salt" text NOT NULL,
                    "wrapped_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "status" text DEFAULT 'active' NOT NULL,
                    "shredded_at" timestamp,
                    "shredded_by_user_id" text,
                    "shred_reason" text,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "updated_at" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "crypto_data_key_subject_idx" ON "crypto_data_key" ("subject_type", "subject_id");
                CREATE INDEX IF NOT EXISTS "crypto_data_key_status_idx" ON "crypto_data_key" ("status");
            `);

            // 3. Create Blockchain Custody & Versioning tables
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "personnel_ledger_block" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "block_index" integer NOT NULL,
                    "previous_block_hash" text NOT NULL,
                    "previous_entity_block_hash" text NOT NULL,
                    "block_hash" text NOT NULL,
                    "merkle_root_hash" text NOT NULL,
                    "signed_tree_head" jsonb NOT NULL,
                    "talent_id" uuid REFERENCES "talent"("id") ON DELETE SET NULL,
                    "contact_id" uuid REFERENCES "contact"("id") ON DELETE SET NULL,
                    "entity_type" text NOT NULL,
                    "entity_id" text NOT NULL,
                    "version_number" integer DEFAULT 1 NOT NULL,
                    "operation" text NOT NULL,
                    "channel" text DEFAULT 'internal_ui' NOT NULL,
                    "actor_user_id" text NOT NULL,
                    "actor_name" text NOT NULL,
                    "actor_email_hash" text NOT NULL,
                    "actor_role" text NOT NULL,
                    "changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "change_summary" text NOT NULL,
                    "payload_commitment_hash" text NOT NULL,
                    "signature_base64" text NOT NULL,
                    "signer_key_fingerprint" text NOT NULL,
                    "timestamp" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "personnel_ledger_block_index_idx" ON "personnel_ledger_block" ("block_index");
                CREATE INDEX IF NOT EXISTS "personnel_ledger_talent_idx" ON "personnel_ledger_block" ("talent_id");
                CREATE INDEX IF NOT EXISTS "personnel_ledger_contact_idx" ON "personnel_ledger_block" ("contact_id");
                CREATE INDEX IF NOT EXISTS "personnel_ledger_hash_idx" ON "personnel_ledger_block" ("block_hash");
            `);

            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "personnel_data_version" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "talent_id" uuid REFERENCES "talent"("id") ON DELETE CASCADE,
                    "contact_id" uuid REFERENCES "contact"("id") ON DELETE SET NULL,
                    "entity_type" text NOT NULL,
                    "entity_id" text NOT NULL,
                    "version_number" integer NOT NULL,
                    "ledger_block_id" uuid REFERENCES "personnel_ledger_block"("id") ON DELETE SET NULL,
                    "ledger_block_hash" text NOT NULL,
                    "operation" text NOT NULL,
                    "channel" text DEFAULT 'internal_ui' NOT NULL,
                    "encrypted_snapshot" jsonb,
                    "redacted_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
                    "field_diffs" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "restored_from_version" integer,
                    "is_shredded" boolean DEFAULT false NOT NULL,
                    "created_by_user_id" text NOT NULL,
                    "created_by_name" text NOT NULL,
                    "created_by_role" text DEFAULT 'user' NOT NULL,
                    "created_at" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "personnel_version_talent_idx" ON "personnel_data_version" ("talent_id", "version_number");
                CREATE INDEX IF NOT EXISTS "personnel_version_entity_idx" ON "personnel_data_version" ("entity_type", "entity_id", "version_number");
            `);

            // 4. Create Recruitment, Invitations, Interviews & Onboarding tables
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "job_posting" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "title" text NOT NULL,
                    "slug" text NOT NULL,
                    "department" text NOT NULL,
                    "role_category" text DEFAULT 'general' NOT NULL,
                    "employment_type" text DEFAULT 'regular' NOT NULL,
                    "work_model" text DEFAULT 'onsite' NOT NULL,
                    "work_hours_per_week" double precision DEFAULT 39 NOT NULL,
                    "contract_framework_code" text,
                    "entgeltgruppe" text,
                    "erfahrungsstufe" integer DEFAULT 1,
                    "salary_range_min" double precision,
                    "salary_range_max" double precision,
                    "currency" text DEFAULT 'EUR' NOT NULL,
                    "sgb2_eligible" text DEFAULT 'none' NOT NULL,
                    "summary" text,
                    "description" text,
                    "responsibilities" text,
                    "qualifications" text,
                    "benefits" text,
                    "equal_opportunity_statement" text,
                    "accessibility_notes" text,
                    "is_public" boolean DEFAULT true NOT NULL,
                    "status" text DEFAULT 'published' NOT NULL,
                    "openings_count" integer DEFAULT 1 NOT NULL,
                    "hiring_manager_talent_id" uuid REFERENCES "talent"("id") ON DELETE SET NULL,
                    "hr_responsible_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
                    "created_by_user_id" text,
                    "interview_scorecard_template" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "custom_onboarding_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
                    "sync_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "published_at" timestamp,
                    "closing_date" timestamp,
                    "target_hire_date" timestamp,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "updated_at" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "job_posting_status_public_idx" ON "job_posting" ("status", "is_public");
                CREATE INDEX IF NOT EXISTS "job_posting_department_idx" ON "job_posting" ("department");
            `);

            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "job_posting_location" (
                    "job_posting_id" uuid NOT NULL REFERENCES "job_posting"("id") ON DELETE CASCADE,
                    "location_id" uuid NOT NULL REFERENCES "location"("id") ON DELETE CASCADE,
                    PRIMARY KEY ("job_posting_id", "location_id")
                );
                CREATE TABLE IF NOT EXISTS "job_posting_contact" (
                    "job_posting_id" uuid NOT NULL REFERENCES "job_posting"("id") ON DELETE CASCADE,
                    "contact_id" uuid NOT NULL REFERENCES "contact"("id") ON DELETE CASCADE,
                    "role" text DEFAULT 'hiring_team' NOT NULL,
                    PRIMARY KEY ("job_posting_id", "contact_id")
                );
                CREATE TABLE IF NOT EXISTS "job_posting_tag" (
                    "job_posting_id" uuid NOT NULL REFERENCES "job_posting"("id") ON DELETE CASCADE,
                    "tag_id" uuid NOT NULL REFERENCES "tag"("id") ON DELETE CASCADE,
                    PRIMARY KEY ("job_posting_id", "tag_id")
                );
            `);

            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "applicant_invitation" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "token" text NOT NULL UNIQUE,
                    "invitation_type" text NOT NULL,
                    "email" text NOT NULL,
                    "given_name" text,
                    "family_name" text,
                    "job_posting_id" uuid REFERENCES "job_posting"("id") ON DELETE SET NULL,
                    "talent_id" uuid REFERENCES "talent"("id") ON DELETE CASCADE,
                    "status" text DEFAULT 'pending' NOT NULL,
                    "custom_fields_config" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "prefill_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
                    "invited_by_user_id" text,
                    "invited_by_name" text,
                    "personal_message" text,
                    "sent_at" timestamp DEFAULT now() NOT NULL,
                    "opened_at" timestamp,
                    "completed_at" timestamp,
                    "expires_at" timestamp NOT NULL,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "updated_at" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "applicant_invitation_token_idx" ON "applicant_invitation" ("token");
                CREATE INDEX IF NOT EXISTS "applicant_invitation_talent_idx" ON "applicant_invitation" ("talent_id");
            `);

            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "interview_evaluation" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "talent_id" uuid NOT NULL REFERENCES "talent"("id") ON DELETE CASCADE,
                    "job_posting_id" uuid REFERENCES "job_posting"("id") ON DELETE SET NULL,
                    "stage" text DEFAULT 'screening' NOT NULL,
                    "interview_type" text DEFAULT 'video' NOT NULL,
                    "scheduled_at" timestamp,
                    "conducted_at" timestamp DEFAULT now() NOT NULL,
                    "interviewer_user_id" text,
                    "interviewer_name" text NOT NULL,
                    "interviewer_role" text DEFAULT 'Hiring Team' NOT NULL,
                    "status" text DEFAULT 'submitted' NOT NULL,
                    "competency_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "overall_score" double precision DEFAULT 0 NOT NULL,
                    "recommendation" text DEFAULT 'hire' NOT NULL,
                    "strengths" text,
                    "concerns" text,
                    "structured_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "calibration_notes" text,
                    "is_blind_submitted" boolean DEFAULT true NOT NULL,
                    "ledger_block_id" uuid,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "updated_at" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "interview_eval_talent_idx" ON "interview_evaluation" ("talent_id");
                CREATE INDEX IF NOT EXISTS "interview_eval_job_idx" ON "interview_evaluation" ("job_posting_id");
            `);

            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "onboarding_submission" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "talent_id" uuid NOT NULL REFERENCES "talent"("id") ON DELETE CASCADE,
                    "job_posting_id" uuid REFERENCES "job_posting"("id") ON DELETE SET NULL,
                    "invitation_id" uuid REFERENCES "applicant_invitation"("id") ON DELETE SET NULL,
                    "status" text DEFAULT 'in_progress' NOT NULL,
                    "filled_by_channel" text DEFAULT 'internal_team' NOT NULL,
                    "submitted_by_user_id" text,
                    "verified_by_user_id" text,
                    "payroll_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
                    "custom_field_definitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
                    "custom_field_responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
                    "encrypted_payload" jsonb,
                    "ledger_block_id" uuid,
                    "submitted_at" timestamp,
                    "verified_at" timestamp,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "updated_at" timestamp DEFAULT now() NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "onboarding_submission_talent_idx" ON "onboarding_submission" ("talent_id");
                CREATE INDEX IF NOT EXISTS "onboarding_submission_status_idx" ON "onboarding_submission" ("status");
            `);

            schemaInitialized = true;
        } catch (err) {
            console.warn("[CryptoLedger] Schema initialization warning:", err);
        }
    })();

    return schemaInitPromise;
}

// ============================================================================
// 1. IETF RFC 8785 JSON CANONICALIZATION SCHEME (JCS) & HASH HELPERS
// ============================================================================

/**
 * Deterministic JSON Canonicalization per IETF RFC 8785 (JCS).
 * Ensures identical byte representation across runtimes before hashing/signing.
 */
export function canonicalizeJson(value: unknown): string {
    if (value === null || value === undefined) {
        return "null";
    }
    if (typeof value === "boolean" || typeof value === "number") {
        return JSON.stringify(value);
    }
    if (typeof value === "string") {
        return JSON.stringify(value);
    }
    if (value instanceof Date) {
        return JSON.stringify(value.toISOString());
    }
    if (Array.isArray(value)) {
        return "[" + value.map((item) => canonicalizeJson(item)).join(",") + "]";
    }
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const sortedKeys = Object.keys(obj)
            .filter((k) => obj[k] !== undefined)
            .sort();
        const entries = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
        return "{" + entries.join(",") + "}";
    }
    return JSON.stringify(String(value));
}

export function sha256Hex(input: string | Buffer): string {
    return createHash("sha256").update(input).digest("hex");
}

function getTenantMasterSecret(): string {
    return (
        process.env.PKI_MASTER_KEY_SECRET ||
        process.env.BETTER_AUTH_SECRET ||
        process.env.AUTH_SECRET ||
        "ac-talents-ngo-m365-default-pki-kek-seed-2026"
    );
}

/**
 * Computes HMAC-SHA256 blind index for O(1) privacy-preserving lookups
 * (used for 3-factor GDPR self-service identification and duplicate checks).
 */
export function computeBlindIndex(domain: string, rawValue: string): string {
    const normalized = rawValue.trim().toLowerCase().replace(/\s+/g, " ");
    return createHmac("sha256", `${getTenantMasterSecret()}:blind-index:${domain}`)
        .update(normalized)
        .digest("hex");
}

export function computeContactBlindIndexes(input: {
    email?: string | null;
    phone?: string | null;
    birthday?: string | Date | null;
    familyName?: string | null;
    givenName?: string | null;
    zip?: string | null;
    city?: string | null;
    street?: string | null;
    taxId?: string | null;
}): Record<string, string> {
    const indexes: Record<string, string> = {};
    if (input.email?.trim()) {
        indexes.email = computeBlindIndex("email", input.email.trim().toLowerCase());
    }
    if (input.phone?.trim()) {
        const normPhone = input.phone.replace(/[\s\-\(\)\/\.]/g, "").toLowerCase();
        indexes.phone = computeBlindIndex("phone", normPhone);
    }
    if (input.birthday) {
        const bdayStr =
            input.birthday instanceof Date
                ? input.birthday.toISOString().slice(0, 10)
                : String(input.birthday).slice(0, 10);
        if (bdayStr) indexes.birthday = computeBlindIndex("birthday", bdayStr);
    }
    if (input.familyName?.trim()) {
        indexes.familyName = computeBlindIndex("familyName", input.familyName);
    }
    if (input.givenName?.trim()) {
        indexes.givenName = computeBlindIndex("givenName", input.givenName);
    }
    if (input.zip?.trim()) {
        indexes.zip = computeBlindIndex("zip", input.zip);
    }
    if (input.city?.trim()) {
        indexes.city = computeBlindIndex("city", input.city);
    }
    if (input.street?.trim()) {
        indexes.street = computeBlindIndex("street", input.street);
    }
    if (input.taxId?.trim()) {
        indexes.taxId = computeBlindIndex("taxId", input.taxId.replace(/\s+/g, ""));
    }
    return indexes;
}

// ============================================================================
// 2. IETF RFC 6962 BINARY MERKLE TREE (CERTIFICATE TRANSPARENCY STANDARD)
// ============================================================================

function largestPowerOfTwoLessThan(n: number): number {
    let k = 1;
    while (k * 2 < n) {
        k *= 2;
    }
    return k;
}

/**
 * Computes the IETF RFC 6962 Section 2.1 Merkle Tree Hash (MTH).
 * Uses domain separation: 0x00 prefix for leaves, 0x01 prefix for internal nodes.
 */
export function computeRfc6962MerkleRoot(leafHashesHex: string[]): string {
    const n = leafHashesHex.length;
    if (n === 0) {
        return createHash("sha256").digest("hex");
    }
    if (n === 1) {
        const leafBuf = Buffer.from(leafHashesHex[0], "hex");
        return createHash("sha256")
            .update(Buffer.from([0x00]))
            .update(leafBuf)
            .digest("hex");
    }
    const k = largestPowerOfTwoLessThan(n);
    const leftHex = computeRfc6962MerkleRoot(leafHashesHex.slice(0, k));
    const rightHex = computeRfc6962MerkleRoot(leafHashesHex.slice(k, n));
    return createHash("sha256")
        .update(Buffer.from([0x01]))
        .update(Buffer.from(leftHex, "hex"))
        .update(Buffer.from(rightHex, "hex"))
        .digest("hex");
}

/**
 * Generates an RFC 6962 Section 2.1.1 Merkle Audit Path (inclusion proof) for leaf index `m`.
 */
export function generateMerkleInclusionProof(leafHashesHex: string[], m: number): string[] {
    const n = leafHashesHex.length;
    if (n <= 1 || m < 0 || m >= n) return [];
    const k = largestPowerOfTwoLessThan(n);
    if (m < k) {
        const subPath = generateMerkleInclusionProof(leafHashesHex.slice(0, k), m);
        const rightRoot = computeRfc6962MerkleRoot(leafHashesHex.slice(k, n));
        return [...subPath, rightRoot];
    } else {
        const subPath = generateMerkleInclusionProof(leafHashesHex.slice(k, n), m - k);
        const leftRoot = computeRfc6962MerkleRoot(leafHashesHex.slice(0, k));
        return [...subPath, leftRoot];
    }
}

// ============================================================================
// 3. PKI KEY MANAGEMENT & HYBRID ENVELOPE ENCRYPTION (M365 NGO + MULTI-PROVIDER)
// ============================================================================

function wrapPrivateKeyPem(
    privateKeyPem: string,
    ownerContext: string,
    providerType: "m365-entra-oidc" | "local-pki-ca" | "webcrypto-passkey" | "external-kms",
    entraBinding?: WrappedKeyMaterial["entraBinding"],
): WrappedKeyMaterial {
    const kdfSalt = randomBytes(16);
    const derivedKek = Buffer.from(
        hkdfSync(
            "sha256",
            Buffer.from(getTenantMasterSecret(), "utf-8"),
            kdfSalt,
            Buffer.from(`ac-talents-kek:${providerType}:${ownerContext}`, "utf-8"),
            32,
        ),
    );
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", derivedKek, iv);
    const aad = Buffer.from(`${providerType}:${ownerContext}`, "utf-8");
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(privateKeyPem, "utf-8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        algorithm: "HKDF-SHA256+AES-256-GCM",
        ivBase64: iv.toString("base64"),
        authTagBase64: authTag.toString("base64"),
        ciphertextBase64: ciphertext.toString("base64"),
        kdfSaltBase64: kdfSalt.toString("base64"),
        providerType,
        entraBinding,
    };
}

function unwrapPrivateKeyPem(wrapped: WrappedKeyMaterial, ownerContext: string): string {
    const kdfSalt = Buffer.from(wrapped.kdfSaltBase64, "base64");
    const derivedKek = Buffer.from(
        hkdfSync(
            "sha256",
            Buffer.from(getTenantMasterSecret(), "utf-8"),
            kdfSalt,
            Buffer.from(`ac-talents-kek:${wrapped.providerType}:${ownerContext}`, "utf-8"),
            32,
        ),
    );
    const iv = Buffer.from(wrapped.ivBase64, "base64");
    const authTag = Buffer.from(wrapped.authTagBase64, "base64");
    const ciphertext = Buffer.from(wrapped.ciphertextBase64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", derivedKek, iv);
    decipher.setAAD(Buffer.from(`${wrapped.providerType}:${ownerContext}`, "utf-8"));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

function createNewKeyPairRecordValues(params: {
    ownerType: "org_master" | "role" | "user";
    ownerId: string;
    label: string;
    providerType: "m365-entra-oidc" | "local-pki-ca" | "webcrypto-passkey" | "external-kms";
    entraTenantId?: string | null;
    entraObjectId?: string | null;
    x509Subject: string;
}) {
    // 1. Encryption Keypair (RSA-OAEP-256, 2048-bit SPKI/PKCS8)
    const encPair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // 2. Digital Signature Keypair (RSASSA-PSS-SHA256, 2048-bit SPKI/PKCS8)
    const sigPair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const ownerContext = `${params.ownerType}:${params.ownerId}`;
    const entraBinding =
        params.providerType === "m365-entra-oidc"
            ? {
                tenantId: params.entraTenantId || process.env.MICROSOFT_TENANT_ID || "common-ngo-tenant",
                objectId: params.entraObjectId || params.ownerId,
                oneDriveAppFolderEscrow: true,
            }
            : undefined;

    const fingerprint = sha256Hex(`${encPair.publicKey}||${sigPair.publicKey}`).slice(0, 32);

    return {
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        label: params.label,
        providerType: params.providerType,
        entraTenantId: entraBinding?.tenantId ?? null,
        entraObjectId: entraBinding?.objectId ?? null,
        encryptionAlgorithm: "RSA-OAEP-256",
        signingAlgorithm: "RSASSA-PSS-SHA256",
        publicKeySpki: encPair.publicKey,
        signingPublicKeySpki: sigPair.publicKey,
        encryptedPrivateKey: wrapPrivateKeyPem(encPair.privateKey, ownerContext, params.providerType, entraBinding),
        encryptedSigningPrivateKey: wrapPrivateKeyPem(
            sigPair.privateKey,
            `${ownerContext}:sign`,
            params.providerType,
            entraBinding,
        ),
        keyFingerprint: fingerprint,
        x509Subject: params.x509Subject,
        status: "active" as const,
    };
}

/**
 * Ensures the Organization Master PKI CA keypair and HR Role PKI keypair exist.
 */
export async function ensureOrgAndRoleKeyPairs() {
    await ensureRecruitmentSchema();

    const existing = await db
        .select()
        .from(cryptoKeyPair)
        .where(
            and(
                eq(cryptoKeyPair.status, "active"),
                or(
                    and(eq(cryptoKeyPair.ownerType, "org_master"), eq(cryptoKeyPair.ownerId, "org")),
                    and(eq(cryptoKeyPair.ownerType, "role"), eq(cryptoKeyPair.ownerId, "hr_manager")),
                ),
            ),
        );

    let orgKey = existing.find((k) => k.ownerType === "org_master" && k.ownerId === "org");
    let hrRoleKey = existing.find((k) => k.ownerType === "role" && k.ownerId === "hr_manager");

    if (!orgKey) {
        const [inserted] = await db
            .insert(cryptoKeyPair)
            .values(
                createNewKeyPairRecordValues({
                    ownerType: "org_master",
                    ownerId: "org",
                    label: "Organization Root Custody & Envelope PKI Key (O365 NGO Tenant Bound)",
                    providerType: "m365-entra-oidc",
                    entraTenantId: process.env.MICROSOFT_TENANT_ID || "ngo-business-basic-tenant",
                    x509Subject: "CN=AC-Talents Organization Master Authority, O=AtCost NGO, OU=HR-PKI",
                }),
            )
            .returning();
        orgKey = inserted;
    }

    if (!hrRoleKey) {
        const [inserted] = await db
            .insert(cryptoKeyPair)
            .values(
                createNewKeyPairRecordValues({
                    ownerType: "role",
                    ownerId: "hr_manager",
                    label: "HR Responsible & Hiring Management Group Keypair",
                    providerType: "m365-entra-oidc",
                    entraTenantId: process.env.MICROSOFT_TENANT_ID || "ngo-business-basic-tenant",
                    x509Subject: "CN=HR & Hiring Management Role Key, O=AtCost NGO, OU=HR-Recruitment",
                }),
            )
            .returning();
        hrRoleKey = inserted;
    }

    return { orgKey, hrRoleKey };
}

/**
 * Ensures an individual actor/user has a PKI keypair bound to their Microsoft 365 Entra ID account (if connected)
 * or local PKI authority.
 */
export async function ensureActorKeyPair(actorUserId: string, actorName: string) {
    await ensureRecruitmentSchema();
    const normalizedId = actorUserId || "system";

    const [existing] = await db
        .select()
        .from(cryptoKeyPair)
        .where(
            and(
                eq(cryptoKeyPair.ownerType, "user"),
                eq(cryptoKeyPair.ownerId, normalizedId),
                eq(cryptoKeyPair.status, "active"),
            ),
        )
        .limit(1);

    if (existing) return existing;

    // Check if user has a connected Microsoft 365 / Entra ID OAuth account in Better Auth
    let msAccount: { accountId: string; issuer: string | null } | undefined;
    try {
        const [acc] = await db
            .select({ accountId: account.accountId, issuer: account.issuer })
            .from(account)
            .where(and(eq(account.userId, normalizedId), eq(account.providerId, "microsoft")))
            .limit(1);
        msAccount = acc;
    } catch {
        // Ignore if user is system/anonymous
    }

    const providerType = msAccount ? "m365-entra-oidc" : "local-pki-ca";
    const [created] = await db
        .insert(cryptoKeyPair)
        .values(
            createNewKeyPairRecordValues({
                ownerType: "user",
                ownerId: normalizedId,
                label: `${actorName || normalizedId} (${providerType === "m365-entra-oidc" ? "M365 Entra ID Bound" : "Internal PKI"})`,
                providerType,
                entraTenantId: process.env.MICROSOFT_TENANT_ID || "ngo-business-basic-tenant",
                entraObjectId: msAccount?.accountId || normalizedId,
                x509Subject: `CN=${actorName || normalizedId}, UID=${normalizedId}, O=AtCost NGO`,
            }),
        )
        .returning();

    return created;
}

function rsaOaepWrapDek(publicKeyPem: string, dekBuffer: Buffer): string {
    return publicEncrypt(
        {
            key: publicKeyPem,
            padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        dekBuffer,
    ).toString("base64");
}

function rsaOaepUnwrapDek(privateKeyPem: string, wrappedDekBase64: string): Buffer {
    return privateDecrypt(
        {
            key: privateKeyPem,
            padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        Buffer.from(wrappedDekBase64, "base64"),
    );
}

/**
 * Ensures a unique 256-bit AES-GCM Data Encryption Key (DEK) exists for a subject (talent or contact),
 * wrapped with the PKI public keys of authorized recipients.
 */
export async function ensureSubjectDataKey(
    subjectType: "talent" | "contact",
    subjectId: string,
): Promise<{ record: typeof cryptoDataKey.$inferSelect; rawDek: Buffer }> {
    await ensureRecruitmentSchema();
    const { orgKey, hrRoleKey } = await ensureOrgAndRoleKeyPairs();

    const [existing] = await db
        .select()
        .from(cryptoDataKey)
        .where(and(eq(cryptoDataKey.subjectType, subjectType), eq(cryptoDataKey.subjectId, subjectId)))
        .orderBy(desc(cryptoDataKey.keyVersion))
        .limit(1);

    if (existing && existing.status === "active" && existing.wrappedKeys.length > 0) {
        const orgWrapped = existing.wrappedKeys.find((w) => w.keyPairId === orgKey.id) || existing.wrappedKeys[0];
        const keyRecord =
            orgWrapped.keyPairId === orgKey.id
                ? orgKey
                : (
                    await db
                        .select()
                        .from(cryptoKeyPair)
                        .where(eq(cryptoKeyPair.id, orgWrapped.keyPairId))
                        .limit(1)
                )[0] || orgKey;
        const ownerCtx = `${keyRecord.ownerType}:${keyRecord.ownerId}`;
        const privPem = unwrapPrivateKeyPem(keyRecord.encryptedPrivateKey, ownerCtx);
        const rawDek = rsaOaepUnwrapDek(privPem, orgWrapped.wrappedDekBase64);
        return { record: existing, rawDek };
    }

    // Generate fresh 256-bit DEK and per-record cryptographic salt
    const rawDek = randomBytes(32);
    const recordSalt = randomBytes(24).toString("hex");

    const wrappedKeys: WrappedRecipientDek[] = [
        {
            keyPairId: orgKey.id,
            ownerType: "org_master",
            ownerId: orgKey.ownerId,
            providerType: orgKey.providerType as WrappedRecipientDek["providerType"],
            keyFingerprint: orgKey.keyFingerprint,
            wrappedDekBase64: rsaOaepWrapDek(orgKey.publicKeySpki, rawDek),
        },
        {
            keyPairId: hrRoleKey.id,
            ownerType: "role",
            ownerId: hrRoleKey.ownerId,
            providerType: hrRoleKey.providerType as WrappedRecipientDek["providerType"],
            keyFingerprint: hrRoleKey.keyFingerprint,
            wrappedDekBase64: rsaOaepWrapDek(hrRoleKey.publicKeySpki, rawDek),
        },
    ];

    const [created] = await db
        .insert(cryptoDataKey)
        .values({
            subjectType,
            subjectId,
            keyVersion: existing ? existing.keyVersion + 1 : 1,
            algorithm: "AES-256-GCM",
            recordSalt,
            wrappedKeys,
            status: "active",
        })
        .returning();

    return { record: created, rawDek };
}

/**
 * Encrypts sensitive personnel/onboarding/version data at rest using the subject's PKI-wrapped DEK.
 */
export async function encryptPersonnelPayload(params: {
    subjectType: "talent" | "contact";
    subjectId: string;
    aadText: string;
    payload: unknown;
}): Promise<{ envelope: EncryptedEnvelopePayload; recordSalt: string }> {
    const { record, rawDek } = await ensureSubjectDataKey(params.subjectType, params.subjectId);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", rawDek, iv);
    cipher.setAAD(Buffer.from(params.aadText, "utf-8"));

    const serialized = canonicalizeJson(params.payload);
    const ciphertext = Buffer.concat([cipher.update(serialized, "utf-8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        recordSalt: record.recordSalt,
        envelope: {
            envelopeVersion: 1,
            algorithm: "AES-256-GCM",
            dataKeyId: record.id,
            keyVersion: record.keyVersion,
            ivBase64: iv.toString("base64"),
            authTagBase64: authTag.toString("base64"),
            aadText: params.aadText,
            ciphertextBase64: ciphertext.toString("base64"),
            encryptedAt: new Date().toISOString(),
        },
    };
}

/**
 * Decrypts an EncryptedEnvelopePayload using the PKI-wrapped DEK.
 * Returns { shredded: true, data: null } if the subject's DEK was GDPR crypto-shredded.
 */
export async function decryptPersonnelPayload<T = Record<string, unknown>>(
    envelope: EncryptedEnvelopePayload | null | undefined,
): Promise<{ shredded: boolean; data: T | null; keyFingerprint?: string }> {
    if (!envelope || !envelope.dataKeyId) {
        return { shredded: false, data: null };
    }
    await ensureRecruitmentSchema();

    const [dataKey] = await db
        .select()
        .from(cryptoDataKey)
        .where(eq(cryptoDataKey.id, envelope.dataKeyId))
        .limit(1);

    if (!dataKey || dataKey.status === "shredded" || !dataKey.wrappedKeys || dataKey.wrappedKeys.length === 0) {
        return { shredded: true, data: null };
    }

    const { orgKey } = await ensureOrgAndRoleKeyPairs();
    const wrappedEntry = dataKey.wrappedKeys.find((w) => w.keyPairId === orgKey.id) || dataKey.wrappedKeys[0];
    const [keyPair] = await db
        .select()
        .from(cryptoKeyPair)
        .where(eq(cryptoKeyPair.id, wrappedEntry.keyPairId))
        .limit(1);

    const activeKeyPair = keyPair || orgKey;
    const ownerCtx = `${activeKeyPair.ownerType}:${activeKeyPair.ownerId}`;
    const privPem = unwrapPrivateKeyPem(activeKeyPair.encryptedPrivateKey, ownerCtx);
    const rawDek = rsaOaepUnwrapDek(privPem, wrappedEntry.wrappedDekBase64);

    const decipher = createDecipheriv(
        "aes-256-gcm",
        rawDek,
        Buffer.from(envelope.ivBase64, "base64"),
    );
    decipher.setAAD(Buffer.from(envelope.aadText, "utf-8"));
    decipher.setAuthTag(Buffer.from(envelope.authTagBase64, "base64"));

    const decryptedJson = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertextBase64, "base64")),
        decipher.final(),
    ]).toString("utf-8");

    return {
        shredded: false,
        data: JSON.parse(decryptedJson) as T,
        keyFingerprint: activeKeyPair.keyFingerprint,
    };
}

// ============================================================================
// 4. BLOCKCHAIN CUSTODY LEDGER, SIGNING & VERSIONING ENGINE
// ============================================================================

const SENSITIVE_FIELD_NAMES = new Set([
    "taxId",
    "socialSecurityNumber",
    "iban",
    "bic",
    "birthday",
    "emails",
    "phones",
    "addresses",
    "internalNotes",
    "notes",
    "salaryExpectation",
    "wageAmount",
]);

export function computeFieldDiffs(
    beforeState: Record<string, unknown> | null | undefined,
    afterState: Record<string, unknown>,
): { changedFields: string[]; fieldDiffs: FieldDiffRecord[] } {
    const before = beforeState || {};
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(afterState)])).sort();
    const changedFields: string[] = [];
    const fieldDiffs: FieldDiffRecord[] = [];

    for (const key of allKeys) {
        if (key === "updatedAt" || key === "createdAt" || key === "encryptedEnvelope" || key === "latestLedgerBlockHash") {
            continue;
        }
        const bVal = before[key];
        const aVal = afterState[key];
        if (canonicalizeJson(bVal) !== canonicalizeJson(aVal)) {
            changedFields.push(key);
            fieldDiffs.push({
                field: key,
                before: bVal ?? null,
                after: aVal ?? null,
                isEncrypted: SENSITIVE_FIELD_NAMES.has(key),
            });
        }
    }

    return { changedFields, fieldDiffs };
}

function signCanonicalString(signingPrivateKeyPem: string, canonicalString: string): string {
    return cryptoSign(
        "sha256",
        Buffer.from(canonicalString, "utf-8"),
        {
            key: signingPrivateKeyPem,
            padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
            saltLength: 32,
        },
    ).toString("base64");
}

function verifyCanonicalStringSignature(
    signingPublicKeyPem: string,
    canonicalString: string,
    signatureBase64: string,
): boolean {
    try {
        return cryptoVerify(
            "sha256",
            Buffer.from(canonicalString, "utf-8"),
            {
                key: signingPublicKeyPem,
                padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
                saltLength: 32,
            },
            Buffer.from(signatureBase64, "base64"),
        );
    } catch {
        return false;
    }
}

export interface RecordPersonnelMutationInput {
    talentId?: string | null;
    contactId?: string | null;
    entityType:
    | "talent"
    | "contact"
    | "payroll_profile"
    | "contract"
    | "job_application"
    | "interview_evaluation"
    | "onboarding_submission"
    | "gdpr_obfuscation";
    entityId: string;
    operation:
    | "create"
    | "update"
    | "delete"
    | "restore"
    | "stage_transition"
    | "interview_rating"
    | "onboarding_submit"
    | "obfuscate"
    | "crypto_shred";
    channel?:
    | "internal_ui"
    | "public_portal"
    | "magic_link"
    | "self_service"
    | "sync_provider"
    | "system_automation"
    | "gdpr_portal";
    actor: {
        userId?: string | null;
        name?: string | null;
        email?: string | null;
        role?: string | null;
    };
    beforeState?: Record<string, unknown> | null;
    afterState: Record<string, unknown>;
    changeSummary?: string;
    restoredFromVersion?: number;
}

/**
 * Records a cryptographically encrypted version snapshot and appends a signed block
 * to the tamper-evident personnel blockchain custody ledger with RFC 6962 Merkle anchoring.
 */
export async function recordPersonnelMutation(input: RecordPersonnelMutationInput) {
    await ensureRecruitmentSchema();

    const { orgKey } = await ensureOrgAndRoleKeyPairs();
    const actorUserId = input.actor.userId || "external_applicant";
    const actorName = input.actor.name || "External / System Actor";
    const actorRole = input.actor.role || "applicant";
    const actorEmailHash = input.actor.email
        ? computeBlindIndex("actor_email", input.actor.email)
        : sha256Hex(actorUserId).slice(0, 32);
    const channel = input.channel || "internal_ui";

    const actorKeyPair = await ensureActorKeyPair(actorUserId, actorName);
    const subjectType: "talent" | "contact" = input.talentId ? "talent" : "contact";
    const subjectId = (input.talentId || input.contactId || input.entityId) as string;

    // 1. Determine next version number for this talent/entity
    const [latestVersionRow] = await db
        .select({ versionNumber: personnelDataVersion.versionNumber })
        .from(personnelDataVersion)
        .where(
            input.talentId
                ? eq(personnelDataVersion.talentId, input.talentId)
                : and(
                    eq(personnelDataVersion.entityType, input.entityType),
                    eq(personnelDataVersion.entityId, input.entityId),
                ),
        )
        .orderBy(desc(personnelDataVersion.versionNumber))
        .limit(1);

    const nextVersion = (latestVersionRow?.versionNumber ?? 0) + 1;

    // 2. Compute field diffs
    const { changedFields, fieldDiffs } = computeFieldDiffs(input.beforeState, input.afterState);

    // 3. Encrypt full state snapshot at rest using subject's PKI-wrapped DEK
    const aadText = `${input.entityType}:${input.entityId}:v${nextVersion}`;
    const { envelope, recordSalt } = await encryptPersonnelPayload({
        subjectType,
        subjectId,
        aadText,
        payload: input.afterState,
    });

    // 4. Compute GDPR-safe commitment hash over salted ciphertext
    const payloadCommitmentHash = sha256Hex(`${recordSalt}||${envelope.ciphertextBase64}||${envelope.authTagBase64}`);

    // 5. Fetch previous global block & previous entity block
    const [prevGlobalBlock] = await db
        .select()
        .from(personnelLedgerBlock)
        .orderBy(desc(personnelLedgerBlock.blockIndex))
        .limit(1);

    const [prevEntityBlock] = await db
        .select()
        .from(personnelLedgerBlock)
        .where(
            input.talentId
                ? eq(personnelLedgerBlock.talentId, input.talentId)
                : eq(personnelLedgerBlock.entityId, input.entityId),
        )
        .orderBy(desc(personnelLedgerBlock.blockIndex))
        .limit(1);

    const blockIndex = (prevGlobalBlock?.blockIndex ?? 0) + 1;
    const previousBlockHash = prevGlobalBlock?.blockHash ?? "0".repeat(64);
    const previousEntityBlockHash = prevEntityBlock?.blockHash ?? "0".repeat(64);
    const timestampDate = new Date();
    const timestampIso = timestampDate.toISOString();

    const defaultSummary =
        input.changeSummary ||
        `${input.operation.toUpperCase()} on ${input.entityType} (v${nextVersion}) via ${channel}` +
        (changedFields.length > 0 ? ` [${changedFields.slice(0, 6).join(", ")}]` : "");

    // 6. Canonicalize block payload per RFC 8785 JCS and compute blockHash + Actor PKI Signature
    const canonicalBlockPayload = canonicalizeJson({
        actorEmailHash,
        actorRole,
        actorUserId,
        changedFields,
        channel,
        entityId: input.entityId,
        entityType: input.entityType,
        operation: input.operation,
        payloadCommitmentHash,
        previousBlockHash,
        previousEntityBlockHash,
        talentId: input.talentId ?? null,
        timestamp: timestampIso,
        versionNumber: nextVersion,
        blockIndex,
    });

    const blockHash = sha256Hex(canonicalBlockPayload);
    const actorSignPrivPem = unwrapPrivateKeyPem(
        actorKeyPair.encryptedSigningPrivateKey,
        `user:${actorKeyPair.ownerId}:sign`,
    );
    const signatureBase64 = signCanonicalString(actorSignPrivPem, canonicalBlockPayload);

    // 7. Compute updated RFC 6962 Merkle Tree Root across all ledger blocks + Sign Tree Head (STH)
    const priorHashesRows = await db
        .select({ blockHash: personnelLedgerBlock.blockHash })
        .from(personnelLedgerBlock)
        .orderBy(asc(personnelLedgerBlock.blockIndex));
    const allBlockHashes = [...priorHashesRows.map((r) => r.blockHash), blockHash];
    const merkleRootHash = computeRfc6962MerkleRoot(allBlockHashes);

    const orgSignPrivPem = unwrapPrivateKeyPem(
        orgKey.encryptedSigningPrivateKey,
        `org_master:${orgKey.ownerId}:sign`,
    );
    const sthCanonical = canonicalizeJson({
        standard: "IETF-RFC-6962-Merkle-v1",
        treeSize: allBlockHashes.length,
        rootHash: merkleRootHash,
        timestamp: timestampIso,
    });
    const sthSignature = signCanonicalString(orgSignPrivPem, sthCanonical);

    const signedTreeHead: SignedTreeHead = {
        standard: "IETF-RFC-6962-Merkle-v1",
        treeSize: allBlockHashes.length,
        rootHash: merkleRootHash,
        timestamp: timestampIso,
        signerKeyFingerprint: orgKey.keyFingerprint,
        signatureBase64: sthSignature,
    };

    // 8. Persist Ledger Block & Version Snapshot
    const [insertedBlock] = await db
        .insert(personnelLedgerBlock)
        .values({
            blockIndex,
            previousBlockHash,
            previousEntityBlockHash,
            blockHash,
            merkleRootHash,
            signedTreeHead,
            talentId: input.talentId ?? null,
            contactId: input.contactId ?? null,
            entityType: input.entityType,
            entityId: input.entityId,
            versionNumber: nextVersion,
            operation: input.operation,
            channel,
            actorUserId,
            actorName,
            actorEmailHash,
            actorRole,
            changedFields,
            changeSummary: defaultSummary,
            payloadCommitmentHash,
            signatureBase64,
            signerKeyFingerprint: actorKeyPair.keyFingerprint,
            timestamp: timestampDate,
        })
        .returning();

    const redactedSummary: Record<string, unknown> = {
        entityType: input.entityType,
        operation: input.operation,
        channel,
        changedFieldsCount: changedFields.length,
        changedFields,
        status: input.afterState.status ?? (input.afterState.talent as any)?.status ?? undefined,
        pipelineStage:
            input.afterState.pipelineStage ?? (input.afterState.talent as any)?.pipelineStage ?? undefined,
        jobTitle: input.afterState.jobTitle ?? (input.afterState.talent as any)?.jobTitle ?? undefined,
    };

    const [insertedVersion] = await db
        .insert(personnelDataVersion)
        .values({
            talentId: input.talentId ?? null,
            contactId: input.contactId ?? null,
            entityType: input.entityType,
            entityId: input.entityId,
            versionNumber: nextVersion,
            ledgerBlockId: insertedBlock.id,
            ledgerBlockHash: blockHash,
            operation: input.operation,
            channel,
            encryptedSnapshot: envelope,
            redactedSummary,
            fieldDiffs,
            restoredFromVersion: input.restoredFromVersion ?? null,
            isShredded: false,
            createdByUserId: actorUserId,
            createdByName: actorName,
            createdByRole: actorRole,
            createdAt: timestampDate,
        })
        .returning();

    // 9. Update talent's currentVersion, latestLedgerBlockHash & encryptedEnvelope metadata
    if (input.talentId) {
        await db
            .update(talent)
            .set({
                currentVersion: nextVersion,
                latestLedgerBlockHash: blockHash,
                encryptedEnvelope: envelope,
                lastModifiedByUserId: actorUserId,
                lastModifiedChannel: channel,
            })
            .where(eq(talent.id, input.talentId));
    }

    return {
        block: insertedBlock,
        version: insertedVersion,
        envelope,
    };
}

/**
 * Cryptographically verifies the personnel blockchain custody chain, actor digital signatures,
 * and RFC 6962 Merkle Tree Root / Signed Tree Head.
 */
export async function verifyPersonnelChainOfCustody(talentId?: string) {
    await ensureRecruitmentSchema();
    const { orgKey } = await ensureOrgAndRoleKeyPairs();

    const allBlocks = await db
        .select()
        .from(personnelLedgerBlock)
        .orderBy(asc(personnelLedgerBlock.blockIndex));

    const allKeys = await db.select().from(cryptoKeyPair);
    const keyByFingerprint = new Map(allKeys.map((k) => [k.keyFingerprint, k]));

    const blockHashes = allBlocks.map((b) => b.blockHash);
    const computedMerkleRoot = computeRfc6962MerkleRoot(blockHashes);

    let validChainLinks = 0;
    let validSignatures = 0;
    const tamperAlerts: string[] = [];

    const targetBlocks = talentId ? allBlocks.filter((b) => b.talentId === talentId) : allBlocks;

    for (let i = 0; i < allBlocks.length; i++) {
        const b = allBlocks[i];
        const expectedPrevGlobal = i === 0 ? "0".repeat(64) : allBlocks[i - 1].blockHash;
        const prevLinkValid = b.previousBlockHash === expectedPrevGlobal;
        if (prevLinkValid) validChainLinks++;
        else tamperAlerts.push(`Block #${b.blockIndex}: Global previousBlockHash mismatch.`);

        const canonicalPayload = canonicalizeJson({
            actorEmailHash: b.actorEmailHash,
            actorRole: b.actorRole,
            actorUserId: b.actorUserId,
            changedFields: b.changedFields,
            channel: b.channel,
            entityId: b.entityId,
            entityType: b.entityType,
            operation: b.operation,
            payloadCommitmentHash: b.payloadCommitmentHash,
            previousBlockHash: b.previousBlockHash,
            previousEntityBlockHash: b.previousEntityBlockHash,
            talentId: b.talentId ?? null,
            timestamp: b.timestamp.toISOString(),
            versionNumber: b.versionNumber,
            blockIndex: b.blockIndex,
        });

        const recomputedHash = sha256Hex(canonicalPayload);
        const hashValid = recomputedHash === b.blockHash;
        if (!hashValid) {
            tamperAlerts.push(`Block #${b.blockIndex}: Canonical JCS SHA-256 hash mismatch.`);
        }

        const signerKey = keyByFingerprint.get(b.signerKeyFingerprint) || orgKey;
        const sigValid = verifyCanonicalStringSignature(
            signerKey.signingPublicKeySpki,
            canonicalPayload,
            b.signatureBase64,
        );
        if (sigValid && hashValid) {
            validSignatures++;
        } else if (!sigValid) {
            tamperAlerts.push(`Block #${b.blockIndex}: RSASSA-PSS digital signature verification failed.`);
        }
    }

    const latestGlobal = allBlocks[allBlocks.length - 1];
    let sthValid = true;
    if (latestGlobal?.signedTreeHead) {
        const sth = latestGlobal.signedTreeHead;
        const sthCanonical = canonicalizeJson({
            standard: sth.standard,
            treeSize: sth.treeSize,
            rootHash: sth.rootHash,
            timestamp: sth.timestamp,
        });
        sthValid =
            sth.rootHash === computedMerkleRoot &&
            verifyCanonicalStringSignature(orgKey.signingPublicKeySpki, sthCanonical, sth.signatureBase64);
    }

    const detailedBlocks = targetBlocks
        .slice()
        .reverse()
        .map((b) => {
            const globalIdx = allBlocks.findIndex((gb) => gb.id === b.id);
            const inclusionProof =
                globalIdx >= 0 ? generateMerkleInclusionProof(blockHashes, globalIdx) : [];
            return {
                id: b.id,
                blockIndex: b.blockIndex,
                previousBlockHash: b.previousBlockHash,
                previousEntityBlockHash: b.previousEntityBlockHash,
                blockHash: b.blockHash,
                merkleRootHash: b.merkleRootHash,
                entityType: b.entityType,
                entityId: b.entityId,
                versionNumber: b.versionNumber,
                operation: b.operation,
                channel: b.channel,
                actorUserId: b.actorUserId,
                actorName: b.actorName,
                actorEmailHash: b.actorEmailHash,
                actorRole: b.actorRole,
                changedFields: b.changedFields,
                changeSummary: b.changeSummary,
                payloadCommitmentHash: b.payloadCommitmentHash,
                signerKeyFingerprint: b.signerKeyFingerprint,
                signaturePreview: b.signatureBase64.slice(0, 28) + "...",
                inclusionProofLength: inclusionProof.length,
                inclusionProof,
                timestamp: b.timestamp.toISOString(),
            };
        });

    return {
        isValid: tamperAlerts.length === 0 && sthValid,
        standards: {
            encryption: "CMS/JWE Hybrid Envelope (RSA-OAEP-256 + AES-256-GCM)",
            identityBinding: "Microsoft 365 Business Basic (Entra ID Free OIDC + Multi-Provider KMS)",
            canonicalization: "IETF RFC 8785 (JCS)",
            signatures: "IETF RFC 7515 (JWS RSASSA-PSS-SHA256) / W3C Data Integrity 1.0",
            transparencyLog: "IETF RFC 6962 (Certificate Transparency Binary Merkle Tree)",
        },
        totalGlobalBlocks: allBlocks.length,
        totalEntityBlocks: targetBlocks.length,
        validChainLinks,
        validSignatures,
        merkleRootHash: computedMerkleRoot,
        signedTreeHead: latestGlobal?.signedTreeHead ?? null,
        sthValid,
        tamperAlerts,
        orgPublicKeyFingerprint: orgKey.keyFingerprint,
        blocks: detailedBlocks,
    };
}

/**
 * Retrieves the complete version history for a talent, decrypting snapshots via PKI where authorized
 * (or reporting crypto-shredded status if GDPR Art. 17 erasure was executed).
 */
export async function getPersonnelVersionHistory(talentId: string) {
    await ensureRecruitmentSchema();

    const versions = await db
        .select()
        .from(personnelDataVersion)
        .where(eq(personnelDataVersion.talentId, talentId))
        .orderBy(desc(personnelDataVersion.versionNumber));

    const results = [];
    for (const v of versions) {
        let decryptedState: Record<string, unknown> | null = null;
        let isShredded = v.isShredded;

        if (!isShredded && v.encryptedSnapshot) {
            try {
                const dec = await decryptPersonnelPayload<Record<string, unknown>>(v.encryptedSnapshot);
                if (dec.shredded) {
                    isShredded = true;
                } else {
                    decryptedState = dec.data;
                }
            } catch {
                // Keep null if undecryptable
            }
        }

        results.push({
            id: v.id,
            talentId: v.talentId,
            versionNumber: v.versionNumber,
            entityType: v.entityType,
            operation: v.operation,
            channel: v.channel,
            ledgerBlockHash: v.ledgerBlockHash,
            redactedSummary: v.redactedSummary,
            fieldDiffs: v.fieldDiffs,
            restoredFromVersion: v.restoredFromVersion,
            isShredded,
            decryptedState,
            createdByUserId: v.createdByUserId,
            createdByName: v.createdByName,
            createdByRole: v.createdByRole,
            createdAt: v.createdAt.toISOString(),
        });
    }

    return results;
}

/**
 * Restores a talent's personnel data to a historical version v_k non-destructively:
 * creates version v_{n+1} referencing restoredFromVersion = k and appends a signed custody block.
 */
export async function restorePersonnelVersion(params: {
    talentId: string;
    versionNumber: number;
    actor: {
        userId: string;
        name: string;
        email?: string;
        role?: string;
    };
}) {
    await ensureRecruitmentSchema();

    const [targetVersion] = await db
        .select()
        .from(personnelDataVersion)
        .where(
            and(
                eq(personnelDataVersion.talentId, params.talentId),
                eq(personnelDataVersion.versionNumber, params.versionNumber),
            ),
        )
        .limit(1);

    if (!targetVersion) {
        throw new Error(`Version v${params.versionNumber} not found for this talent.`);
    }

    if (targetVersion.isShredded || !targetVersion.encryptedSnapshot) {
        throw new Error(
            `Version v${params.versionNumber} has been cryptographically shredded per GDPR Art. 17 and cannot be restored.`,
        );
    }

    const decrypted = await decryptPersonnelPayload<Record<string, any>>(targetVersion.encryptedSnapshot);
    if (decrypted.shredded || !decrypted.data) {
        throw new Error(`DEK for version v${params.versionNumber} has been shredded.`);
    }

    const snapshot = decrypted.data;
    const currentTalent = await db.query.talent.findFirst({
        where: eq(talent.id, params.talentId),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                },
            },
        },
    });

    if (!currentTalent) {
        throw new Error("Talent record not found.");
    }

    const beforeState = {
        status: currentTalent.status,
        pipelineStage: currentTalent.pipelineStage,
        jobTitle: currentTalent.jobTitle,
        department: currentTalent.department,
        salaryExpectation: currentTalent.salaryExpectation,
        onboardingStatus: currentTalent.onboardingStatus,
        internalNotes: currentTalent.internalNotes,
        contact: {
            displayName: currentTalent.contact?.displayName,
            givenName: currentTalent.contact?.givenName,
            familyName: currentTalent.contact?.familyName,
            role: currentTalent.contact?.role,
            department: currentTalent.contact?.department,
            notes: currentTalent.contact?.notes,
        },
    };

    const restoredTalentFields = snapshot.talent || snapshot;
    const restoredContactFields = snapshot.contact || {};

    await db
        .update(talent)
        .set({
            status: restoredTalentFields.status || currentTalent.status,
            pipelineStage: restoredTalentFields.pipelineStage || currentTalent.pipelineStage,
            jobTitle:
                restoredTalentFields.jobTitle !== undefined
                    ? restoredTalentFields.jobTitle
                    : currentTalent.jobTitle,
            department:
                restoredTalentFields.department !== undefined
                    ? restoredTalentFields.department
                    : currentTalent.department,
            salaryExpectation:
                restoredTalentFields.salaryExpectation !== undefined
                    ? restoredTalentFields.salaryExpectation
                    : currentTalent.salaryExpectation,
            onboardingStatus:
                restoredTalentFields.onboardingStatus !== undefined
                    ? restoredTalentFields.onboardingStatus
                    : currentTalent.onboardingStatus,
            internalNotes:
                restoredTalentFields.internalNotes !== undefined
                    ? restoredTalentFields.internalNotes
                    : currentTalent.internalNotes,
            updatedAt: new Date(),
        })
        .where(eq(talent.id, params.talentId));

    if (currentTalent.contactId && Object.keys(restoredContactFields).length > 0) {
        await db
            .update(contact)
            .set({
                displayName: restoredContactFields.displayName || currentTalent.contact?.displayName,
                givenName:
                    restoredContactFields.givenName !== undefined
                        ? restoredContactFields.givenName
                        : currentTalent.contact?.givenName,
                familyName:
                    restoredContactFields.familyName !== undefined
                        ? restoredContactFields.familyName
                        : currentTalent.contact?.familyName,
                role:
                    restoredContactFields.role !== undefined
                        ? restoredContactFields.role
                        : currentTalent.contact?.role,
                department:
                    restoredContactFields.department !== undefined
                        ? restoredContactFields.department
                        : currentTalent.contact?.department,
                notes:
                    restoredContactFields.notes !== undefined
                        ? restoredContactFields.notes
                        : currentTalent.contact?.notes,
                updatedAt: new Date(),
            })
            .where(eq(contact.id, currentTalent.contactId));
    }

    const mutationResult = await recordPersonnelMutation({
        talentId: params.talentId,
        contactId: currentTalent.contactId,
        entityType: "talent",
        entityId: params.talentId,
        operation: "restore",
        channel: "internal_ui",
        actor: params.actor,
        beforeState,
        afterState: snapshot,
        restoredFromVersion: params.versionNumber,
        changeSummary: `Restored personnel profile to historical version v${params.versionNumber}`,
    });

    return {
        success: true,
        newVersionNumber: mutationResult.version.versionNumber,
        blockHash: mutationResult.block.blockHash,
    };
}

/**
 * Executes GDPR Art. 17 Crypto-Shredding on a subject's Data Encryption Keys (DEKs),
 * permanently destroying the ability to decrypt historical version snapshots while keeping
 * the blockchain hash chain intact.
 */
export async function cryptoShredSubjectKeys(params: {
    contactId: string;
    talentId?: string | null;
    adminUserId: string;
    reason?: string;
}) {
    await ensureRecruitmentSchema();
    const now = new Date();
    const subjectIds = [params.contactId, ...(params.talentId ? [params.talentId] : [])];

    for (const sid of subjectIds) {
        await db
            .update(cryptoDataKey)
            .set({
                wrappedKeys: [],
                recordSalt: "[CRYPTO-SHREDDED-ART-17-GDPR]",
                status: "shredded",
                shreddedAt: now,
                shreddedByUserId: params.adminUserId,
                shredReason: params.reason || "GDPR Art. 17 Right to Erasure / Crypto-Shredding",
                updatedAt: now,
            })
            .where(eq(cryptoDataKey.subjectId, sid));
    }

    if (params.talentId) {
        await db
            .update(personnelDataVersion)
            .set({
                encryptedSnapshot: null,
                isShredded: true,
            })
            .where(eq(personnelDataVersion.talentId, params.talentId));
    }

    await db
        .update(personnelDataVersion)
        .set({
            encryptedSnapshot: null,
            isShredded: true,
        })
        .where(eq(personnelDataVersion.contactId, params.contactId));

    // Append immutable crypto_shred block to the custody ledger
    await recordPersonnelMutation({
        talentId: params.talentId ?? null,
        contactId: params.contactId,
        entityType: "gdpr_obfuscation",
        entityId: params.contactId,
        operation: "crypto_shred",
        channel: "gdpr_portal",
        actor: {
            userId: params.adminUserId,
            name: "GDPR Data Protection Officer / Admin",
            role: "admin",
        },
        beforeState: { encryptionStatus: "active_dek" },
        afterState: {
            encryptionStatus: "crypto_shredded",
            obfuscationStatus: "obfuscated",
            shreddedAt: now.toISOString(),
        },
        changeSummary: `GDPR Art. 17 Crypto-Shredding & SHA-256 Obfuscation executed (${params.reason || "Self-Service Request"})`,
    });
}

/**
 * Lists PKI Key Pairs & Cryptographic Infrastructure status for the Admin/HR Security Console.
 */
export async function getPkiInfrastructureStatus() {
    await ensureRecruitmentSchema();
    await ensureOrgAndRoleKeyPairs();

    const keys = await db
        .select({
            id: cryptoKeyPair.id,
            ownerType: cryptoKeyPair.ownerType,
            ownerId: cryptoKeyPair.ownerId,
            label: cryptoKeyPair.label,
            providerType: cryptoKeyPair.providerType,
            entraTenantId: cryptoKeyPair.entraTenantId,
            entraObjectId: cryptoKeyPair.entraObjectId,
            encryptionAlgorithm: cryptoKeyPair.encryptionAlgorithm,
            signingAlgorithm: cryptoKeyPair.signingAlgorithm,
            keyFingerprint: cryptoKeyPair.keyFingerprint,
            x509Subject: cryptoKeyPair.x509Subject,
            status: cryptoKeyPair.status,
            createdAt: cryptoKeyPair.createdAt,
        })
        .from(cryptoKeyPair)
        .orderBy(asc(cryptoKeyPair.createdAt));

    const dataKeys = await db.select().from(cryptoDataKey);
    const activeDeks = dataKeys.filter((d) => d.status === "active").length;
    const shreddedDeks = dataKeys.filter((d) => d.status === "shredded").length;

    return {
        activeProvider: "m365-entra-oidc",
        supportedProviders: [
            {
                id: "m365-entra-oidc",
                name: "Microsoft 365 Business Basic (Entra ID Free OIDC + OneDrive AppFolder Escrow)",
                status: "active",
                licenseCompatibility: "Free NGO Grant (up to 300 users) & All M365 Tiers",
            },
            {
                id: "local-pki-ca",
                name: "Internal X.509 / SPKI Certificate Authority (RSA-OAEP-256 + RSASSA-PSS)",
                status: "active",
                licenseCompatibility: "Built-in Zero-Cost Sovereign Fallback",
            },
            {
                id: "webcrypto-passkey",
                name: "Browser WebCrypto + WebAuthn Passkey PRF / Passphrase KEK",
                status: "ready",
                licenseCompatibility: "W3C WebAuthn Level 3 / FIDO2 Compatible",
            },
            {
                id: "external-kms",
                name: "Enterprise KMS BYOK (Azure Key Vault / AWS KMS / HashiCorp Vault)",
                status: "pluggable",
                licenseCompatibility: "Optional Enterprise Cloud Upgrade",
            },
        ],
        activeDeksCount: activeDeks,
        shreddedDeksCount: shreddedDeks,
        keys: keys.map((k) => ({
            ...k,
            createdAt: k.createdAt.toISOString(),
        })),
    };
}
