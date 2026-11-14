import type { EncryptedEnvelopePayload } from "./schema/index.js";
import {
    decryptPersonnelPayload,
    encryptPersonnelPayload,
    ensureRecruitmentSchema,
} from "./crypto-ledger.js";

/**
 * Type guard to determine whether a stored `sync_config.credentials` JSONB
 * value is an AES-256-GCM encrypted envelope produced by the PKI crypto ledger.
 */
export function isEncryptedSyncCredentialsEnvelope(
    value: unknown,
): value is EncryptedEnvelopePayload {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return (
        candidate.envelopeVersion === 1 &&
        candidate.algorithm === "AES-256-GCM" &&
        typeof candidate.dataKeyId === "string" &&
        typeof candidate.ivBase64 === "string" &&
        typeof candidate.authTagBase64 === "string" &&
        typeof candidate.ciphertextBase64 === "string" &&
        typeof candidate.aadText === "string"
    );
}

/**
 * Encrypts a `sync_config.credentials` payload using the same per-subject
 * PKI + AES-256-GCM envelope scheme used for contacts and talents.
 *
 * Returns `null` when `credentials` is nullish or empty, passes through
 * already-encrypted envelopes unchanged, and throws only if encryption itself fails.
 */
export async function encryptSyncCredentials(
    syncConfigId: string,
    credentials: Record<string, any> | null | undefined,
): Promise<EncryptedEnvelopePayload | null> {
    if (!credentials || typeof credentials !== "object") {
        return null;
    }

    if (isEncryptedSyncCredentialsEnvelope(credentials)) {
        return credentials;
    }

    const keys = Object.keys(credentials).filter((k) => credentials[k] !== undefined);
    if (keys.length === 0) {
        return null;
    }

    await ensureRecruitmentSchema();

    const cleanPayload: Record<string, any> = {};
    for (const key of keys) {
        cleanPayload[key] = credentials[key];
    }

    const { envelope } = await encryptPersonnelPayload({
        subjectType: "sync_config",
        subjectId: syncConfigId,
        aadText: `sync_config:${syncConfigId}:v1`,
        payload: cleanPayload,
    });

    return envelope;
}

/**
 * Decrypts a stored `sync_config.credentials` JSONB value.
 *
 * - If the stored value is an `EncryptedEnvelopePayload`, decrypts it via the PKI crypto ledger.
 * - If the stored value is a legacy plaintext object (created before encryption was enabled),
 *   returns it as-is so existing configurations keep working seamlessly.
 * - If decryption fails or the subject key has been shredded, returns `undefined`.
 */
export async function decryptSyncCredentials(
    storedCredentials: unknown,
): Promise<Record<string, any> | undefined> {
    if (!storedCredentials || typeof storedCredentials !== "object") {
        return undefined;
    }

    if (!isEncryptedSyncCredentialsEnvelope(storedCredentials)) {
        return storedCredentials as Record<string, any>;
    }

    try {
        await ensureRecruitmentSchema();
        const result = await decryptPersonnelPayload<Record<string, any>>(storedCredentials);
        if (result.shredded || !result.data || typeof result.data !== "object") {
            return undefined;
        }
        return result.data;
    } catch (error) {
        console.error("[sync-encryption] Failed to decrypt sync credentials:", error);
        return undefined;
    }
}
