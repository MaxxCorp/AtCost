import * as v from 'valibot';

export const insurerCategoryPicklist = v.picklist(['health', 'accident', 'pension', 'other']);
export type InsurerCategory = v.InferOutput<typeof insurerCategoryPicklist>;

export const hmoTypePicklist = v.picklist(['statutory', 'private']);
export type HmoType = v.InferOutput<typeof hmoTypePicklist>;

export const u1RateTierSchema = v.object({
    compensationPercent: v.number(),
    contributionPercent: v.number(),
});
export type U1RateTier = v.InferOutput<typeof u1RateTierSchema>;

export const u1RatesFieldSchema = v.optional(
    v.union([
        v.array(u1RateTierSchema),
        v.pipe(
            v.string(),
            v.transform((str) => {
                if (!str || str.trim() === '') return undefined;
                try {
                    const parsed = JSON.parse(str);
                    return Array.isArray(parsed) ? parsed : undefined;
                } catch {
                    return undefined;
                }
            })
        ),
    ])
);

export const hmoSchema = v.object({
    id: v.optional(v.string()),
    name: v.pipe(v.string(), v.minLength(1, 'Name der Versicherung / Kasse ist erforderlich')),
    code: v.optional(v.string()),
    category: v.optional(insurerCategoryPicklist, 'health'),
    type: v.optional(hmoTypePicklist, 'statutory'),

    // Identification
    ikNumber: v.optional(v.string()),
    betriebsnummer: v.optional(v.string()),

    // Health Insurance & Social Levies (GKV / Einzugsstelle)
    additionalContributionPercent: v.optional(v.number(), 2.50),
    u1Rates: u1RatesFieldSchema,
    u1DefaultCompensationPercent: v.optional(v.number(), 70.0),
    u2Rate: v.optional(v.number(), 0.44),
    u3Rate: v.optional(v.number(), 0.15),

    // Accident Insurance (Berufsgenossenschaft / DGUV)
    accidentGefahrklasse: v.optional(v.number()),
    accidentBeitragsfuss: v.optional(v.number()),
    accidentGefahrtarifstelle: v.optional(v.string()),
    accidentMemberNumber: v.optional(v.string()),
    accidentPin: v.optional(v.string()),
    accidentAdditionalRate: v.optional(v.number(), 0), // € je 1.000 € Entgelt (z.B. 0.08 € Ausgleichsumlage Wohlfahrtspflege)
    accidentAdditionalLabel: v.optional(v.string()),

    // Supplementary Pension (Zusatzversorgung / ZVK / VBL / bAV)
    pensionEmployerPercent: v.optional(v.number()),
    pensionEmployeePercent: v.optional(v.number()),
    pensionMemberNumber: v.optional(v.string()),

    website: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean(), true),
});

export type HmoInput = v.InferOutput<typeof hmoSchema>;

export const createHmoSchema = hmoSchema;
export type CreateHmoInput = v.InferOutput<typeof createHmoSchema>;

export const updateHmoSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1, 'ID ist erforderlich')),
    name: v.pipe(v.string(), v.minLength(1, 'Name der Versicherung / Kasse ist erforderlich')),
    code: v.optional(v.string()),
    category: v.optional(insurerCategoryPicklist, 'health'),
    type: v.optional(hmoTypePicklist, 'statutory'),

    ikNumber: v.optional(v.string()),
    betriebsnummer: v.optional(v.string()),

    additionalContributionPercent: v.optional(v.number(), 2.50),
    u1Rates: u1RatesFieldSchema,
    u1DefaultCompensationPercent: v.optional(v.number(), 70.0),
    u2Rate: v.optional(v.number(), 0.44),
    u3Rate: v.optional(v.number(), 0.15),

    accidentGefahrklasse: v.optional(v.number()),
    accidentBeitragsfuss: v.optional(v.number()),
    accidentGefahrtarifstelle: v.optional(v.string()),
    accidentMemberNumber: v.optional(v.string()),
    accidentPin: v.optional(v.string()),
    accidentAdditionalRate: v.optional(v.number(), 0),
    accidentAdditionalLabel: v.optional(v.string()),

    pensionEmployerPercent: v.optional(v.number()),
    pensionEmployeePercent: v.optional(v.number()),
    pensionMemberNumber: v.optional(v.string()),

    website: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean(), true),
});
export type UpdateHmoInput = v.InferOutput<typeof updateHmoSchema>;

export const hmoPaginationSchema = v.optional(
    v.object({
        page: v.optional(v.number(), 1),
        limit: v.optional(v.number(), 50),
        search: v.optional(v.string(), ''),
        category: v.optional(v.union([insurerCategoryPicklist, v.literal('all')])),
        sortField: v.optional(v.string()),
        sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
    }),
    {}
);
export type HmoPaginationInput = v.InferOutput<typeof hmoPaginationSchema>;

/**
 * Standard German Statutory Baseline Insurers & Social Providers
 * Covers Health Funds (GKV Einzugsstellen with U1-U3), Accident Insurers (BGs), and Pension Funds (ZVK/VBL).
 */
export const DEFAULT_GERMAN_HMO_RATES = [
    // --- HEALTH INSURERS (Krankenkassen / Einzugsstellen) ---
    {
        name: 'Techniker Krankenkasse (TK)',
        code: 'TK',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.69,
        ikNumber: '101575519',
        betriebsnummer: '98765432',
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.30 },
            { compensationPercent: 70, contributionPercent: 2.10 },
            { compensationPercent: 80, contributionPercent: 3.20 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.44,
        u3Rate: 0.15,
        website: 'https://www.tk.de',
    },
    {
        name: 'BARMER',
        code: 'BARMER',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.79,
        ikNumber: '101520078',
        betriebsnummer: '12345678',
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.40 },
            { compensationPercent: 70, contributionPercent: 2.20 },
            { compensationPercent: 80, contributionPercent: 3.30 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.46,
        u3Rate: 0.15,
        website: 'https://www.barmer.de',
    },
    {
        name: 'DAK-Gesundheit',
        code: 'DAK',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.80,
        ikNumber: '101538014',
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.35 },
            { compensationPercent: 70, contributionPercent: 2.15 },
            { compensationPercent: 80, contributionPercent: 3.25 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.45,
        u3Rate: 0.15,
        website: 'https://www.dak.de',
    },
    {
        name: 'AOK Nordost',
        code: 'AOK_NO',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.70,
        ikNumber: '101584055',
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.50 },
            { compensationPercent: 65, contributionPercent: 2.10 },
            { compensationPercent: 80, contributionPercent: 3.40 },
        ],
        u1DefaultCompensationPercent: 65,
        u2Rate: 0.48,
        u3Rate: 0.15,
        website: 'https://www.aok.de/nordost',
    },
    {
        name: 'AOK Plus',
        code: 'AOK_PLUS',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.60,
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.40 },
            { compensationPercent: 70, contributionPercent: 2.20 },
            { compensationPercent: 80, contributionPercent: 3.30 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.45,
        u3Rate: 0.15,
        website: 'https://www.aok.de/plus',
    },
    {
        name: 'AOK Bayern',
        code: 'AOK_BY',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.58,
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.30 },
            { compensationPercent: 70, contributionPercent: 2.05 },
            { compensationPercent: 80, contributionPercent: 3.15 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.44,
        u3Rate: 0.15,
        website: 'https://www.aok.de/bayern',
    },
    {
        name: 'IKK classic',
        code: 'IKK_CLASSIC',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 2.60,
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.40 },
            { compensationPercent: 70, contributionPercent: 2.20 },
            { compensationPercent: 80, contributionPercent: 3.30 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.47,
        u3Rate: 0.15,
        website: 'https://www.ikk-classic.de',
    },
    {
        name: 'hkk Krankenkasse',
        code: 'HKK',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 1.98,
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.10 },
            { compensationPercent: 70, contributionPercent: 1.90 },
            { compensationPercent: 80, contributionPercent: 2.90 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.40,
        u3Rate: 0.15,
        website: 'https://www.hkk.de',
    },
    {
        name: 'KKH Kaufmännische Krankenkasse',
        code: 'KKH',
        category: 'health' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 3.28,
        u1Rates: [
            { compensationPercent: 50, contributionPercent: 1.60 },
            { compensationPercent: 70, contributionPercent: 2.50 },
            { compensationPercent: 80, contributionPercent: 3.60 },
        ],
        u1DefaultCompensationPercent: 70,
        u2Rate: 0.50,
        u3Rate: 0.15,
        website: 'https://www.kkh.de',
    },

    // --- ACCIDENT INSURERS (Berufsgenossenschaften / DGUV) ---
    {
        name: 'BGW (Berufsgenossenschaft für Gesundheitsdienst und Wohlfahrtspflege)',
        code: 'BGW',
        category: 'accident' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 0,
        betriebsnummer: '15408942',
        accidentGefahrklasse: 1.40,
        accidentBeitragsfuss: 1.94, // 1,94 € für Wohlfahrtspflege/gemeinnützig (2,08 € für gewerblich)
        accidentGefahrtarifstelle: '01',
        accidentMemberNumber: 'BGW-1049285',
        accidentAdditionalRate: 0.08, // Ausgleichsumlage Wohlfahrtspflege: 0,08 € je 1.000 € Arbeitsentgelt
        accidentAdditionalLabel: 'Ausgleichsumlage Wohlfahrtspflege',
        website: 'https://www.bgw-online.de',
        notes: 'Zuständige BG für Wohlfahrt, Pflege, Gesundheit und Soziales. Beitragsfuß 1,94 € zzgl. 0,08 € je 1.000 € Entgelt Ausgleichsumlage Wohlfahrtspflege.',
    },
    {
        name: 'VBG (Verwaltungs-Berufsgenossenschaft)',
        code: 'VBG',
        category: 'accident' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 0,
        betriebsnummer: '25489110',
        accidentGefahrklasse: 1.15,
        accidentBeitragsfuss: 3.40,
        accidentGefahrtarifstelle: '01',
        accidentMemberNumber: 'VBG-2849102',
        website: 'https://www.vbg.de',
        notes: 'Zuständige BG für Verwaltung, IT, Zeitarbeit, Bildung und Agenturen.',
    },
    {
        name: 'Unfallkasse Berlin (UKB)',
        code: 'UK_BERLIN',
        category: 'accident' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 0,
        betriebsnummer: '10984512',
        accidentGefahrklasse: 1.20,
        accidentBeitragsfuss: 3.20,
        accidentGefahrtarifstelle: '01',
        website: 'https://www.unfallkasse-berlin.de',
        notes: 'Gesetzliche Unfallkasse für kommunale und landeseigene Einrichtungen in Berlin.',
    },

    // --- SUPPLEMENTARY PENSION (Zusatzversorgungskassen / ZVK / VBL) ---
    {
        name: 'VBL.Klassik (Versorgungsanstalt des Bundes und der Länder)',
        code: 'VBL',
        category: 'pension' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 0,
        betriebsnummer: '10549811',
        pensionEmployerPercent: 6.45,
        pensionEmployeePercent: 1.81,
        pensionMemberNumber: 'VBL-559021',
        website: 'https://www.vbl.de',
        notes: 'Betriebliche Altersversorgung für den öffentlichen Dienst (TVöD / TV-L).',
    },
    {
        name: 'ZVK Berlin (Zusatzversorgungskasse des Landes Berlin)',
        code: 'ZVK_BERLIN',
        category: 'pension' as const,
        type: 'statutory' as const,
        additionalContributionPercent: 0,
        betriebsnummer: '10948271',
        pensionEmployerPercent: 4.00,
        pensionEmployeePercent: 1.81,
        pensionMemberNumber: 'ZVK-BE-9941',
        website: 'https://www.zvk-berlin.de',
        notes: 'Zusatzversorgungskasse des Landes Berlin für Beschäftigte in Berlin.',
    },
];

