import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	mockUpdateSet,
	mockUpdateWhere,
	mockSelectWhere,
	mockSelectFrom,
	mockFindFirst,
	mockEncryptPersonnelPayload,
	mockComputeContactBlindIndexes,
	mockRecordPersonnelMutation,
	mockEnsureRecruitmentSchema,
} = vi.hoisted(() => ({
	mockUpdateSet: vi.fn(),
	mockUpdateWhere: vi.fn(),
	mockSelectWhere: vi.fn(),
	mockSelectFrom: vi.fn(),
	mockFindFirst: vi.fn(),
	mockEncryptPersonnelPayload: vi.fn(),
	mockComputeContactBlindIndexes: vi.fn(),
	mockRecordPersonnelMutation: vi.fn(),
	mockEnsureRecruitmentSchema: vi.fn(),
}));

vi.mock('../../../../../packages/db/src/db.js', () => ({
	db: {
		select: vi.fn(() => ({ from: mockSelectFrom })),
		update: vi.fn(() => ({ set: mockUpdateSet })),
		query: {
			contact: {
				findFirst: mockFindFirst,
			},
		},
	},
}));

vi.mock('../../../../../packages/db/src/crypto-ledger.js', () => ({
	ensureRecruitmentSchema: mockEnsureRecruitmentSchema,
	encryptPersonnelPayload: mockEncryptPersonnelPayload,
	decryptPersonnelPayload: vi.fn(),
	computeContactBlindIndexes: mockComputeContactBlindIndexes,
	recordPersonnelMutation: mockRecordPersonnelMutation,
}));

import {
	checkContactEncryptionStatus,
	encryptSingleContact,
	syncContactEncryption,
} from '../../../../../packages/db/src/contact-encryption.js';

describe('contact-encryption', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnsureRecruitmentSchema.mockResolvedValue(undefined);
		mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
		mockUpdateWhere.mockResolvedValue(undefined);
		mockSelectFrom.mockImplementation(() => ({
			where: mockSelectWhere,
			then: (resolve: (rows: Array<{ count: number }>) => void) => resolve([{ count: 5 }]),
		}));
		mockSelectWhere.mockResolvedValue([{ count: 0 }]);
		mockEncryptPersonnelPayload.mockResolvedValue({
			envelope: {
				envelopeVersion: 1,
				algorithm: 'AES-256-GCM',
				dataKeyId: 'dek-1',
				keyVersion: 1,
				ivBase64: 'iv',
				authTagBase64: 'tag',
				aadText: 'contact:c1:v1',
				ciphertextBase64: 'cipher',
				encryptedAt: '2026-11-13T00:00:00.000Z',
			},
			recordSalt: 'salt',
		});
		mockComputeContactBlindIndexes.mockReturnValue({ email: 'hash' });
		mockRecordPersonnelMutation.mockResolvedValue({});
	});

	it('skips shredded contacts in encryptSingleContact', async () => {
		mockFindFirst.mockResolvedValue({
			id: 'c-shredded',
			encryptionStatus: 'shredded',
			emails: [],
			phones: [],
			addresses: [],
		});

		const result = await encryptSingleContact('c-shredded');

		expect(result).toEqual({ success: false, contactId: 'c-shredded' });
		expect(mockEncryptPersonnelPayload).not.toHaveBeenCalled();
		expect(mockUpdateSet).not.toHaveBeenCalled();
		expect(mockRecordPersonnelMutation).not.toHaveBeenCalled();
	});

	it('encrypts plaintext contacts and preserves beforeState encryptionStatus', async () => {
		mockFindFirst.mockResolvedValue({
			id: 'c-plain',
			displayName: 'Jane Doe',
			givenName: 'Jane',
			familyName: 'Doe',
			encryptionStatus: 'plaintext',
			birthday: null,
			emails: [{ value: 'jane@example.com', type: 'work', primary: true }],
			phones: [],
			addresses: [],
		});

		const result = await encryptSingleContact('c-plain', { userId: 'u-1', name: 'Admin' });

		expect(result).toEqual({ success: true, contactId: 'c-plain' });
		expect(mockEncryptPersonnelPayload).toHaveBeenCalledTimes(1);
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				encryptionStatus: 'migrated',
			}),
		);
		expect(mockRecordPersonnelMutation).toHaveBeenCalledWith(
			expect.objectContaining({
				contactId: 'c-plain',
				beforeState: { encryptionStatus: 'plaintext' },
				afterState: { encryptionStatus: 'migrated', envelopeVersion: 1 },
			}),
		);
	});

	it('syncContactEncryption handles missing contactId and logs warning on failure', async () => {
		expect(await syncContactEncryption(null)).toBe(false);
		expect(await syncContactEncryption(undefined)).toBe(false);

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockFindFirst.mockRejectedValueOnce(new Error('DB temporary error'));

		const ok = await syncContactEncryption('c-err', undefined, 'createContact');
		expect(ok).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			'[createContact] Envelope encryption notice:',
			expect.any(Error),
		);
		warnSpy.mockRestore();
	});

	it('checkContactEncryptionStatus excludes shredded contacts from unencrypted filter', async () => {
		const status = await checkContactEncryptionStatus();

		expect(status).toEqual({
			totalContacts: 5,
			unencryptedCount: 0,
			migratedCount: 0,
			hasUnencryptedData: false,
		});
		expect(mockSelectWhere).toHaveBeenCalledTimes(2);
		const unencryptedFilterArg = mockSelectWhere.mock.calls[0][0];
		const seen = new Set<unknown>();
		const tokens: unknown[] = [];
		const walk = (node: any) => {
			if (!node || typeof node !== 'object' || seen.has(node)) return;
			seen.add(node);
			if (Array.isArray(node.value)) tokens.push(...node.value);
			else if ('value' in node && typeof node.value === 'string') tokens.push(node.value);
			if (Array.isArray(node.queryChunks)) node.queryChunks.forEach(walk);
		};
		walk(unencryptedFilterArg);
		expect(tokens).toContain(' <> ');
		expect(tokens).toContain('shredded');
		expect(tokens).toContain('plaintext');
	});
});
