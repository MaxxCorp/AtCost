import * as v from 'valibot';

export const synchronizationBaseSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    providerId: v.optional(v.string()),
    providerType: v.pipe(v.string(), v.minLength(1, 'Provider type is required')),
    direction: v.picklist(['pull', 'push', 'bidirectional']),
    enabled: v.optional(v.union([v.boolean(), v.string()])),
    credentials: v.optional(v.any()),
    settings: v.optional(v.object({
        calendarId: v.optional(v.string()),
        calendarName: v.optional(v.string()),
        syncIntervalMinutes: v.optional(v.number()),
        company: v.optional(v.string()),
        baseUrl: v.optional(v.string()),
        username: v.optional(v.string()),
        applicationPassword: v.optional(v.string()),
        profileId: v.optional(v.string()),
        selectedTemplate: v.optional(v.string()),
        instagramAccountId: v.optional(v.string()),
        accessToken: v.optional(v.string()),
        defaultHashtags: v.optional(v.string()),
        recipientEmail: v.optional(v.string()),
        recipientContactIds: v.optional(v.union([v.array(v.string()), v.string()])),
        excludedRecipientContactIds: v.optional(v.union([v.array(v.string()), v.string()])),
        includeEventContacts: v.optional(v.union([v.boolean(), v.string()])),
        apiKey: v.optional(v.string()),
        isDefault: v.optional(v.union([v.boolean(), v.string()])),

        // Microsoft Synchronization Settings
        authMode: v.optional(v.union([v.literal('auto'), v.literal('app'), v.literal('user')])),
        mailboxType: v.optional(v.union([v.literal('user'), v.literal('shared'), v.literal('room'), v.literal('group')])),
        mailboxEmail: v.optional(v.string()),
        folderId: v.optional(v.string()),
        resourceFilter: v.optional(v.union([v.literal('all'), v.literal('room'), v.literal('equipment')])),
        includeRoomBookings: v.optional(v.union([v.boolean(), v.string()])),
        includeContacts: v.optional(v.union([v.boolean(), v.string()])),
        autoBookOnCalendar: v.optional(v.union([v.boolean(), v.string()])),
        syncTag: v.optional(v.string()),

        // Event Selection & Filtering Settings
        excludeSeries: v.optional(v.union([v.boolean(), v.string()])),
        syncSeriesMode: v.optional(v.union([v.literal('all'), v.literal('exclude'), v.literal('master_only'), v.string()])),
        excludeNonPublic: v.optional(v.union([v.boolean(), v.string()])),
        excludeTentative: v.optional(v.union([v.boolean(), v.string()])),
        excludeCancelled: v.optional(v.union([v.boolean(), v.string()])),
        excludePastEvents: v.optional(v.union([v.boolean(), v.string()])),

        rangeMode: v.optional(v.union([
            v.literal('all'),
            v.literal('rolling'),
            v.literal('fixed'),
            v.literal('next_week'),
            v.literal('next_month'),
            v.literal('this_week'),
            v.literal('this_month'),
            v.string()
        ])),
        lookAheadDays: v.optional(v.union([v.number(), v.string()])),
        lookPastDays: v.optional(v.union([v.number(), v.string()])),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),

        includedTags: v.optional(v.union([v.array(v.string()), v.string()])),
        excludedTags: v.optional(v.union([v.array(v.string()), v.string()])),
        includedLocationIds: v.optional(v.union([v.array(v.string()), v.string()])),
        excludedLocationIds: v.optional(v.union([v.array(v.string()), v.string()])),
        includedEventIds: v.optional(v.union([v.array(v.string()), v.string()])),
        excludedEventIds: v.optional(v.union([v.array(v.string()), v.string()])),

        // Participant & Contact Sync Settings
        syncParticipants: v.optional(v.union([v.boolean(), v.string()])),
        onlyEmployeeContacts: v.optional(v.union([v.boolean(), v.string()])),
        includeEmployeeContacts: v.optional(v.union([v.boolean(), v.string()])),
        includePublicContacts: v.optional(v.union([v.boolean(), v.string()])),
        includeNonPublicContacts: v.optional(v.union([v.boolean(), v.string()])),
        participantRoleFilterMode: v.optional(v.union([v.literal('all'), v.literal('include'), v.literal('exclude'), v.string()])),
        includedContactRoles: v.optional(v.union([v.array(v.string()), v.string()])),
        excludedContactRoles: v.optional(v.union([v.array(v.string()), v.string()])),
        participantTagFilterMode: v.optional(v.union([v.literal('all'), v.literal('include'), v.literal('exclude'), v.string()])),
        includedContactTags: v.optional(v.union([v.array(v.string()), v.string()])),
        excludedContactTags: v.optional(v.union([v.array(v.string()), v.string()])),
        participantScopeLogic: v.optional(v.union([v.literal('AND'), v.literal('OR'), v.string()])),
        participantFilterLogic: v.optional(v.union([v.literal('AND'), v.literal('OR'), v.string()])),
    })),
});

/**
 * Normalizes sync settings object from form input strings, booleans, and JSON arrays.
 */
export function normalizeSyncSettings(settings: Record<string, any>): Record<string, any> {
    if (!settings || typeof settings !== 'object') return settings;

    // Normalize booleans
    const boolFields = [
        'isDefault',
        'includeEventContacts',
        'includeRoomBookings',
        'includeContacts',
        'autoBookOnCalendar',
        'excludeSeries',
        'excludeNonPublic',
        'excludeTentative',
        'excludeCancelled',
        'excludePastEvents',
        'syncParticipants',
        'onlyEmployeeContacts',
        'includeEmployeeContacts',
        'includePublicContacts',
        'includeNonPublicContacts'
    ];
    for (const bf of boolFields) {
        if (settings[bf] !== undefined) {
            settings[bf] = settings[bf] === true || settings[bf] === 'true' || settings[bf] === 1;
        }
    }

    // Default contact privacy scope: internal staff only, public off by default, non-public off by default
    if (settings.includeEmployeeContacts === undefined) {
        if (settings.onlyEmployeeContacts !== undefined) {
            settings.includeEmployeeContacts = settings.onlyEmployeeContacts === true;
        } else {
            settings.includeEmployeeContacts = true;
        }
    }
    if (settings.includePublicContacts === undefined) {
        settings.includePublicContacts = false;
    }
    if (settings.includeNonPublicContacts === undefined) {
        settings.includeNonPublicContacts = false;
    }
    settings.onlyEmployeeContacts = settings.includeEmployeeContacts === true &&
        !settings.includePublicContacts &&
        !settings.includeNonPublicContacts;

    // Normalize numbers
    const numFields = ['syncIntervalMinutes', 'lookAheadDays', 'lookPastDays'];
    for (const nf of numFields) {
        if (settings[nf] !== undefined && settings[nf] !== '') {
            const num = Number(settings[nf]);
            if (!isNaN(num)) settings[nf] = num;
        }
    }

    // Normalize string arrays
    const arrayFields = [
        'recipientContactIds',
        'excludedRecipientContactIds',
        'includedTags',
        'excludedTags',
        'includedLocationIds',
        'excludedLocationIds',
        'includedEventIds',
        'excludedEventIds',
        'includedContactRoles',
        'excludedContactRoles',
        'includedContactTags',
        'excludedContactTags'
    ];
    for (const af of arrayFields) {
        if (typeof settings[af] === 'string') {
            try {
                const parsed = JSON.parse(settings[af]);
                settings[af] = Array.isArray(parsed) ? parsed : (settings[af].trim() ? [settings[af]] : []);
            } catch {
                settings[af] = settings[af].trim() ? [settings[af]] : [];
            }
        }
    }

    if (settings.syncSeriesMode === 'exclude') {
        settings.excludeSeries = true;
    } else if (settings.excludeSeries === true) {
        settings.syncSeriesMode = 'exclude';
    }

    // Normalize participant logic operators
    if (settings.participantScopeLogic !== undefined) {
        const psl = String(settings.participantScopeLogic).toUpperCase().trim();
        settings.participantScopeLogic = psl === 'OR' ? 'OR' : 'AND';
    } else {
        settings.participantScopeLogic = 'AND';
    }

    if (settings.participantFilterLogic !== undefined) {
        const pfl = String(settings.participantFilterLogic).toUpperCase().trim();
        settings.participantFilterLogic = pfl === 'OR' ? 'OR' : 'AND';
    } else {
        settings.participantFilterLogic = 'AND';
    }

    // Role filter mode array cleanup
    if (settings.participantRoleFilterMode === 'all') {
        settings.includedContactRoles = [];
        settings.excludedContactRoles = [];
    } else if (settings.participantRoleFilterMode === 'include') {
        settings.excludedContactRoles = [];
    } else if (settings.participantRoleFilterMode === 'exclude') {
        settings.includedContactRoles = [];
    }

    // Tag filter mode array cleanup
    if (settings.participantTagFilterMode === 'all') {
        settings.includedContactTags = [];
        settings.excludedContactTags = [];
    } else if (settings.participantTagFilterMode === 'include') {
        settings.excludedContactTags = [];
    } else if (settings.participantTagFilterMode === 'exclude') {
        settings.includedContactTags = [];
    }

    return settings;
}

export const createSynchronizationSchema = synchronizationBaseSchema;

export const updateSynchronizationSchema = v.intersect([
    v.partial(synchronizationBaseSchema),
    v.object({ id: v.pipe(v.string(), v.uuid()) })
]);

export const deleteSynchronizationSchema = v.array(v.pipe(v.string(), v.uuid()));

// Missing exports needed by remote functions
export type CreateSynchronizationInput = v.InferOutput<typeof createSynchronizationSchema>;
export type UpdateSynchronizationInput = v.InferOutput<typeof updateSynchronizationSchema>;

export const getEmailCampaignsSchema = v.object({
    configId: v.pipe(v.string(), v.uuid()),
    limit: v.optional(v.union([v.number(), v.string()])),
    offset: v.optional(v.union([v.number(), v.string()])),
});

export const processBulkSyncBatchSchema = v.object({
    configId: v.pipe(v.string(), v.uuid()),
    operationId: v.pipe(v.string(), v.uuid()),
    batchSize: v.optional(v.number()),
});
export type ProcessBulkSyncBatchInput = v.InferOutput<typeof processBulkSyncBatchSchema>;

export const processMigrationBatchSchema = v.object({
    operationId: v.pipe(v.string(), v.uuid()),
    batchSize: v.optional(v.number()),
});
export type ProcessMigrationBatchInput = v.InferOutput<typeof processMigrationBatchSchema>;

export const testMicrosoftTargetSchema = v.object({
    type: v.picklist(['calendar', 'contacts', 'resources']),
    authMode: v.optional(v.picklist(['auto', 'app', 'user'])),
    mailboxEmail: v.optional(v.string()),
    calendarId: v.optional(v.string()),
    folderId: v.optional(v.string()),
});
export type TestMicrosoftTargetInput = v.InferOutput<typeof testMicrosoftTargetSchema>;

export const listMicrosoftMailboxesSchema = v.optional(v.object({
    authMode: v.optional(v.picklist(['auto', 'app', 'user'])),
    type: v.optional(v.picklist(['all', 'shared', 'room', 'user'])),
    search: v.optional(v.string()),
}));
export type ListMicrosoftMailboxesInput = v.InferOutput<typeof listMicrosoftMailboxesSchema>;

export const listMicrosoftCalendarsSchema = v.optional(v.object({
    authMode: v.optional(v.picklist(['auto', 'app', 'user'])),
    mailboxEmail: v.optional(v.string()),
    currentCalendarId: v.optional(v.string()),
}));
export type ListMicrosoftCalendarsInput = v.InferOutput<typeof listMicrosoftCalendarsSchema>;

export const listMicrosoftContactFoldersSchema = v.optional(v.object({
    authMode: v.optional(v.picklist(['auto', 'app', 'user'])),
    mailboxEmail: v.optional(v.string()),
    currentFolderId: v.optional(v.string()),
}));
export type ListMicrosoftContactFoldersInput = v.InferOutput<typeof listMicrosoftContactFoldersSchema>;



