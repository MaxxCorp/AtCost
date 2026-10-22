import * as v from 'valibot';

export const gdprSelfServiceSchema = v.pipe(
    v.object({
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        birthday: v.optional(v.string()),
        familyName: v.optional(v.string()),
        givenName: v.optional(v.string()),
        zip: v.optional(v.string()),
        city: v.optional(v.string()),
        street: v.optional(v.string()),
        notes: v.optional(v.string()),
        confirmRequest: v.optional(v.boolean(), false),
    }),
    v.check((input) => input.confirmRequest === true, 'Bitte bestätigen Sie die Kenntnisnahme des Antrags.'),
    v.check((input) => {
        const fields = [
            input.email,
            input.phone,
            input.birthday,
            input.familyName,
            input.givenName,
            input.zip,
            input.city,
            input.street,
        ];
        const count = fields.filter((f) => !!f && f.trim().length > 0).length;
        return count >= 3;
    }, 'Mindestens 3 Identifikationsmerkmale müssen angegeben werden.')
);

export type GdprSelfServiceInput = v.InferOutput<typeof gdprSelfServiceSchema>;

export const executeObfuscationSchema = v.object({
    contactId: v.pipe(v.string(), v.uuid('Ungültige Kontakt-ID.')),
    gdprRequestId: v.optional(v.string()),
    notes: v.optional(v.string()),
});

export type ExecuteObfuscationInput = v.InferOutput<typeof executeObfuscationSchema>;

export const gdprFilterSchema = v.object({
    status: v.optional(v.picklist(['all', 'pending', 'obfuscated']), 'pending'),
    search: v.optional(v.string()),
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
});

export type GdprFilterInput = v.InferOutput<typeof gdprFilterSchema>;
