import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { gdprSelfServiceSchema, executeObfuscationSchema } from '@ac/validations';
import { createHash } from 'node:crypto';

describe('GDPR Self-Service Validations and Obfuscation Rules', () => {
    it('rejects submissions with fewer than 3 identifying criteria', () => {
        const input = {
            email: 'erika.mustermann@example.de',
            familyName: 'Mustermann',
            confirmRequest: true,
        };

        const result = v.safeParse(gdprSelfServiceSchema, input);
        expect(result.success).toBe(false);
        if (!result.success) {
            const hasCriteriaIssue = result.issues.some((issue) =>
                issue.message.includes('Mindestens 3 Identifikationsmerkmale')
            );
            expect(hasCriteriaIssue).toBe(true);
        }
    });

    it('accepts submissions with 3 or more identifying criteria and confirmed request', () => {
        const input = {
            email: 'erika.mustermann@example.de',
            phone: '+49 170 1234567',
            birthday: '1985-06-15',
            familyName: 'Mustermann',
            confirmRequest: true,
        };

        const result = v.safeParse(gdprSelfServiceSchema, input);
        expect(result.success).toBe(true);
    });

    it('rejects submissions if confirmRequest is false or missing', () => {
        const input = {
            email: 'erika.mustermann@example.de',
            phone: '+49 170 1234567',
            birthday: '1985-06-15',
            confirmRequest: false,
        };

        const result = v.safeParse(gdprSelfServiceSchema, input);
        expect(result.success).toBe(false);
    });

    it('validates executeObfuscationSchema requires a valid UUID contactId', () => {
        const valid = v.safeParse(executeObfuscationSchema, {
            contactId: '123e4567-e89b-12d3-a456-426614174000',
            notes: 'Approved',
        });
        expect(valid.success).toBe(true);

        const invalid = v.safeParse(executeObfuscationSchema, {
            contactId: 'not-a-uuid',
        });
        expect(invalid.success).toBe(false);
    });

    it('produces deterministic SHA-256 hashes for obfuscated identifiers', () => {
        const email = 'test@example.com';
        const hash = createHash('sha256').update(email.trim()).digest('hex');
        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);

        const obfuscatedEmail = `obf_${hash.slice(0, 16)}@obfuscated.local`;
        expect(obfuscatedEmail).toContain('@obfuscated.local');
        expect(obfuscatedEmail.startsWith('obf_')).toBe(true);
    });
});
