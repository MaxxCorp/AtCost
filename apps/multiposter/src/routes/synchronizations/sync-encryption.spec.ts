import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	mockEnsureRecruitmentSchema,
	mockEncryptPersonnelPayload,
	mockDecryptPersonnelPayload,
} = vi.hoisted(() => ({
	mockEnsureRecruitmentSchema: vi.fn(),
	mockEncryptPersonnelPayload: vi.fn(),
	mockDecryptPersonnelPayload: vi.fn(),
}));

vi.mock('../../../../../packages/db/src/crypto-ledger.js', () => ({
	ensureRecruitmentSchema: mockEnsureRecruitmentSchema,
	encryptPersonnelPayload: mockEncryptPersonnelPayload,
	decryptPersonnelPayload: mockDecryptPersonnelPayload,
}));

import {
	decryptSyncCredentials,
	encryptSyncCredentials,
	isEncryptedSyncCredentialsEnvelope,
} from '../../../../../packages/db/src/sync-encryption.js';

describe('sync-encryption', () => {
	const sampleEnvelope = {
		envelopeVersion: 1 as const,
		algorithm: 'AES-256-GCM' as const,
		dataKeyId: 'dek-sync-1',
		keyVersion: 1,
		ivBase64: 'iv123',
		authTagBase64: 'tag123',
		aadText: 'sync_config:cfg-1:v1',
		ciphertextBase64: 'cipher123',
		encryptedAt: '2026-11-14T12:00:00.000Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockEnsureRecruitmentSchema.mockResolvedValue(undefined);
		mockEncryptPersonnelPayload.mockResolvedValue({
			envelope: sampleEnvelope,
			recordSalt: 'salt-1',
		});
		mockDecryptPersonnelPayload.mockResolvedValue({
			shredded: false,
			data: { username: 'Ball-EV-berlin.de', password: 'secret' },
			keyFingerprint: 'fp-1',
		});
	});

	it('encrypts credentials with sync_config subjectType and v1 AAD', async () => {
		const encrypted = await encryptSyncCredentials('cfg-1', {
			username: 'Ball-EV-berlin.de',
			password: 'secret',
		});

		expect(mockEnsureRecruitmentSchema).toHaveBeenCalledTimes(1);
		expect(mockEncryptPersonnelPayload).toHaveBeenCalledWith({
			subjectType: 'sync_config',
			subjectId: 'cfg-1',
			aadText: 'sync_config:cfg-1:v1',
			payload: { username: 'Ball-EV-berlin.de', password: 'secret' },
		});
		expect(isEncryptedSyncCredentialsEnvelope(encrypted)).toBe(true);
		expect(encrypted).toEqual(sampleEnvelope);
	});

	it('returns null for empty or nullish credentials and is idempotent for envelopes', async () => {
		expect(await encryptSyncCredentials('cfg-1', null)).toBeNull();
		expect(await encryptSyncCredentials('cfg-1', {})).toBeNull();
		expect(await encryptSyncCredentials('cfg-1', sampleEnvelope)).toEqual(sampleEnvelope);
		expect(mockEncryptPersonnelPayload).not.toHaveBeenCalled();
	});

	it('decrypts encrypted envelopes and passes through legacy plaintext credentials', async () => {
		const decrypted = await decryptSyncCredentials(sampleEnvelope);
		expect(mockEnsureRecruitmentSchema).toHaveBeenCalledTimes(1);
		expect(mockDecryptPersonnelPayload).toHaveBeenCalledWith(sampleEnvelope);
		expect(decrypted).toEqual({ username: 'Ball-EV-berlin.de', password: 'secret' });

		const legacy = await decryptSyncCredentials({ username: 'legacy', password: 'pw' });
		expect(legacy).toEqual({ username: 'legacy', password: 'pw' });
		expect(mockDecryptPersonnelPayload).toHaveBeenCalledTimes(1);
	});

	it('returns undefined when subject key is shredded or decryption throws', async () => {
		mockDecryptPersonnelPayload.mockResolvedValueOnce({
			shredded: true,
			data: null,
		});
		expect(await decryptSyncCredentials(sampleEnvelope)).toBeUndefined();

		mockDecryptPersonnelPayload.mockRejectedValueOnce(new Error('decrypt error'));
		expect(await decryptSyncCredentials(sampleEnvelope)).toBeUndefined();
	});
});
