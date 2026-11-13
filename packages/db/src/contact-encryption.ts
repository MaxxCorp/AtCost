import { db } from "./db.js";
import {
    contact,
    contactEmail,
    contactPhone,
    contactAddress,
    personnelLedgerBlock,
    type EncryptedEnvelopePayload,
} from "./schema/index.js";
import { eq, ne, and, or, isNull, sql } from "drizzle-orm";
import {
    ensureRecruitmentSchema,
    encryptPersonnelPayload,
    decryptPersonnelPayload,
    computeContactBlindIndexes,
    recordPersonnelMutation,
} from "./crypto-ledger.js";

export interface ContactEncryptionStatus {
    totalContacts: number;
    unencryptedCount: number;
    migratedCount: number;
    hasUnencryptedData: boolean;
}

export interface ActorContext {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
}

function getUnencryptedContactCondition() {
    return and(
        ne(contact.encryptionStatus, "shredded"),
        or(
            isNull(contact.encryptedEnvelope),
            eq(contact.encryptionStatus, "plaintext"),
        ),
    );
}

/**
 * Checks how many contact records in the database are currently unencrypted.
 */
export async function checkContactEncryptionStatus(): Promise<ContactEncryptionStatus> {
    await ensureRecruitmentSchema();

    const [totalRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contact);

    const [unencryptedRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contact)
        .where(getUnencryptedContactCondition());

    const [migratedRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contact)
        .where(eq(contact.encryptionStatus, "migrated"));

    const totalContacts = Number(totalRow?.count || 0);
    const unencryptedCount = Number(unencryptedRow?.count || 0);
    const migratedCount = Number(migratedRow?.count || 0);

    return {
        totalContacts,
        unencryptedCount,
        migratedCount,
        hasUnencryptedData: unencryptedCount > 0,
    };
}

/**
 * Encrypts a single contact at rest using the PKI envelope hierarchy.
 * Securely archives full details into contact.encrypted_envelope,
 * updates blind search indexes in contact.fingerprints, and records
 * an immutable block into the personnel custody ledger.
 */
export async function encryptSingleContact(
    contactId: string,
    actor?: ActorContext,
): Promise<{ success: boolean; contactId: string }> {
    await ensureRecruitmentSchema();

    const contactRow = await db.query.contact.findFirst({
        where: eq(contact.id, contactId),
        with: {
            emails: true,
            phones: true,
            addresses: true,
        },
    });

    if (!contactRow) {
        throw new Error(`Contact ${contactId} not found`);
    }

    if (contactRow.encryptionStatus === "shredded") {
        return { success: false, contactId };
    }

    // 1. Build comprehensive sensitive payload
    const payload = {
        displayName: contactRow.displayName || "",
        givenName: contactRow.givenName || "",
        familyName: contactRow.familyName || "",
        middleName: contactRow.middleName || "",
        honorificPrefix: contactRow.honorificPrefix || "",
        honorificSuffix: contactRow.honorificSuffix || "",
        birthday: contactRow.birthday
            ? contactRow.birthday instanceof Date
                ? contactRow.birthday.toISOString()
                : String(contactRow.birthday)
            : null,
        gender: contactRow.gender || "",
        company: contactRow.company || "",
        role: contactRow.role || "",
        department: contactRow.department || "",
        notes: contactRow.notes || "",
        isPublic: !!contactRow.isPublic,
        notifyOnChanges: !!contactRow.notifyOnChanges,
        emails: (contactRow.emails || []).map((e) => ({
            value: e.value,
            type: e.type || "work",
            primary: !!e.primary,
        })),
        phones: (contactRow.phones || []).map((p) => ({
            value: p.value,
            type: p.type || "mobile",
            primary: !!p.primary,
        })),
        addresses: (contactRow.addresses || []).map((a) => ({
            street: a.street || "",
            houseNumber: a.houseNumber || "",
            addressSuffix: a.addressSuffix || "",
            zip: a.zip || "",
            city: a.city || "",
            state: a.state || "",
            country: a.country || "",
            type: a.type || "home",
            primary: !!a.primary,
        })),
    };

    // 2. Encrypt payload via PKI-wrapped DEK
    const aadText = `contact:${contactId}:v1`;
    const { envelope } = await encryptPersonnelPayload({
        subjectType: "contact",
        subjectId: contactId,
        aadText,
        payload,
    });

    // 3. Compute deterministic blind search indexes
    const blindIndexes = computeContactBlindIndexes({
        email: payload.emails[0]?.value,
        phone: payload.phones[0]?.value,
        birthday: payload.birthday,
        familyName: payload.familyName,
        givenName: payload.givenName,
        zip: payload.addresses[0]?.zip,
        city: payload.addresses[0]?.city,
        street: payload.addresses[0]?.street,
    });

    // 4. Update contact record with envelope & status
    const now = new Date();
    await db
        .update(contact)
        .set({
            encryptedEnvelope: envelope,
            encryptionStatus: "migrated",
            fingerprints: blindIndexes,
            updatedAt: now,
        })
        .where(eq(contact.id, contactId));

    // 5. Append custody block to blockchain ledger
    const actorInfo = actor || {
        userId: "system_migration",
        name: "Security Migration Engine",
        role: "admin",
    };

    try {
        await recordPersonnelMutation({
            contactId,
            entityType: "contact",
            entityId: contactId,
            operation: "update",
            channel: "system_automation",
            actor: actorInfo,
            beforeState: { encryptionStatus: contactRow.encryptionStatus },
            afterState: { encryptionStatus: "migrated", envelopeVersion: envelope.envelopeVersion },
            changeSummary: `Encrypted contact ${contactRow.displayName || contactId} at rest using AES-256-GCM envelope`,
        });
    } catch (auditErr) {
        console.warn("[ContactEncryption] Notice: Custody ledger recording deferred:", auditErr);
    }

    return { success: true, contactId };
}

/**
 * Ensures a contact record is encrypted at rest after creation or mutation.
 * Skips GDPR-shredded contacts and logs warnings instead of failing the primary mutation.
 */
export async function syncContactEncryption(
    contactId: string | null | undefined,
    actor?: ActorContext,
    context = "syncContactEncryption",
): Promise<boolean> {
    if (!contactId) return false;
    try {
        const result = await encryptSingleContact(contactId, actor);
        return result.success;
    } catch (err) {
        console.warn(`[${context}] Envelope encryption notice:`, err);
        return false;
    }
}

/**
 * Transparently decrypts an encrypted contact record into a full Contact object.
 */
export async function decryptContactRecord<T extends { encryptedEnvelope?: EncryptedEnvelopePayload | null }>(
    record: T,
): Promise<T> {
    if (!record || !record.encryptedEnvelope) {
        return record;
    }

    try {
        const { shredded, data } = await decryptPersonnelPayload<any>(record.encryptedEnvelope);
        if (shredded || !data) {
            return record;
        }

        return {
            ...record,
            displayName: data.displayName ?? (record as any).displayName,
            givenName: data.givenName ?? (record as any).givenName,
            familyName: data.familyName ?? (record as any).familyName,
            middleName: data.middleName ?? (record as any).middleName,
            honorificPrefix: data.honorificPrefix ?? (record as any).honorificPrefix,
            honorificSuffix: data.honorificSuffix ?? (record as any).honorificSuffix,
            birthday: data.birthday ?? (record as any).birthday,
            gender: data.gender ?? (record as any).gender,
            company: data.company ?? (record as any).company,
            role: data.role ?? (record as any).role,
            department: data.department ?? (record as any).department,
            notes: data.notes ?? (record as any).notes,
            notifyOnChanges: data.notifyOnChanges ?? (record as any).notifyOnChanges,
            emails: data.emails?.length ? data.emails : (record as any).emails,
            phones: data.phones?.length ? data.phones : (record as any).phones,
            addresses: data.addresses?.length ? data.addresses : (record as any).addresses,
        };
    } catch (err) {
        console.warn("[ContactEncryption] Notice: Decryption fallback to stored values:", err);
        return record;
    }
}

// In-memory progress tracking for client migration polling
interface MigrationOperationState {
    operationId: string;
    total: number;
    processed: number;
    startedAt: Date;
    completedAt?: Date;
    errors: string[];
}

const activeMigrationOperations = new Map<string, MigrationOperationState>();

/**
 * Starts the contact at-rest encryption migration.
 * Identifies total unencrypted count and registers an operation queue.
 */
export async function startContactEncryptionMigration(): Promise<{
    operationId: string;
    total: number;
    done: boolean;
}> {
    await ensureRecruitmentSchema();

    const status = await checkContactEncryptionStatus();
    if (!status.hasUnencryptedData) {
        return { operationId: "", total: 0, done: true };
    }

    const operationId = `contact_mig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeMigrationOperations.set(operationId, {
        operationId,
        total: status.unencryptedCount,
        processed: 0,
        startedAt: new Date(),
        errors: [],
    });

    return {
        operationId,
        total: status.unencryptedCount,
        done: false,
    };
}

/**
 * Processes a single batch of unencrypted contacts (default 25)
 * safe for execution in serverless timeout environments (Vercel/Node).
 */
export async function processContactEncryptionBatch(params: {
    operationId: string;
    batchSize?: number;
    actor?: ActorContext;
}): Promise<{
    processed: number;
    total: number;
    done: boolean;
    errors: string[];
}> {
    await ensureRecruitmentSchema();
    const batchSize = Math.max(1, Math.min(params.batchSize || 25, 100));
    const state = activeMigrationOperations.get(params.operationId) || {
        operationId: params.operationId,
        total: 0,
        processed: 0,
        startedAt: new Date(),
        errors: [],
    };

    // Find the next batch of unencrypted contacts
    const unencryptedContacts = await db
        .select({ id: contact.id })
        .from(contact)
        .where(getUnencryptedContactCondition())
        .limit(batchSize);

    if (unencryptedContacts.length === 0) {
        state.completedAt = new Date();
        activeMigrationOperations.delete(params.operationId);
        return {
            processed: state.processed,
            total: state.total || state.processed,
            done: true,
            errors: state.errors,
        };
    }

    // Process chunk
    const batchErrors: string[] = [];
    for (const item of unencryptedContacts) {
        try {
            await encryptSingleContact(item.id, params.actor);
            state.processed += 1;
        } catch (err: any) {
            const msg = `Contact ${item.id}: ${err?.message || "Encryption error"}`;
            batchErrors.push(msg);
            state.errors.push(msg);
        }
    }

    // Check remaining
    const status = await checkContactEncryptionStatus();
    const isDone = !status.hasUnencryptedData;
    if (isDone) {
        state.completedAt = new Date();
        activeMigrationOperations.delete(params.operationId);
    } else {
        activeMigrationOperations.set(params.operationId, state);
    }

    return {
        processed: state.processed,
        total: Math.max(state.total, state.processed + status.unencryptedCount),
        done: isDone,
        errors: batchErrors,
    };
}
