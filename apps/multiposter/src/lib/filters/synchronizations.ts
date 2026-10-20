import type { FilterGroup } from "@ac/ui";
import { RefreshCw } from "@lucide/svelte";

export function getSynchronizationFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "providerType",
            label: m?.providers ? m.providers() : "Providers",
            icon: RefreshCw,
            options: [
                { id: "google-calendar", label: "Google Calendar" },
                { id: "microsoft-calendar", label: "Microsoft Calendar" },
                { id: "microsoft-contacts", label: "Microsoft Contacts" },
                { id: "microsoft-resources", label: "Microsoft Resources & Rooms" },
                { id: "berlin-de-main-calendar", label: "Berlin.de (Main)" },
                { id: "berlin-de-mh-calendar", label: "Berlin.de (M-H)" },
                { id: "wp-the-events-calendar", label: "WP The Events Calendar" },
                { id: "email", label: "E-Mail (Brevo)" },
                { id: "instagram", label: "Instagram" },
            ],
            searchable: true,
        },
    ];
}

export function isEmployeeContact(contactOrAssociation: any): boolean {
    if (!contactOrAssociation) return false;
    const c = contactOrAssociation.contact || contactOrAssociation;
    const tags = c.tags || contactOrAssociation.tags || [];

    return tags.some((t: any) => {
        const tagName = (t?.name || t?.tag?.name || (typeof t === 'string' ? t : '')).trim().toLowerCase();
        return tagName === 'employee' || tagName === 'employees' || tagName === 'mitarbeiter' || tagName === 'staff';
    });
}

function normalizeArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
    if (typeof val === 'string' && val.trim()) {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
        } catch {
            // not JSON
        }
        return [val.trim()];
    }
    return [];
}

/**
 * Checks whether a contact satisfies the participant sync rules.
 */
export function matchesContactParticipantRules(contactOrAssoc: any, settings: Record<string, any>): boolean {
    if (!contactOrAssoc) return false;

    const syncParticipants = settings.syncParticipants ?? settings.includeEventContacts ?? settings.includeContacts;
    if (syncParticipants === false || syncParticipants === 'false') {
        return false;
    }

    const c = contactOrAssoc.contact || contactOrAssoc;
    const isEmployee = isEmployeeContact(contactOrAssoc);
    const isPublic = c.isPublic === true || contactOrAssoc.isPublic === true;

    const includeEmployee = settings.includeEmployeeContacts !== undefined
        ? (settings.includeEmployeeContacts === true || settings.includeEmployeeContacts === 'true')
        : (settings.onlyEmployeeContacts !== false && settings.onlyEmployeeContacts !== 'false');

    const includePublic = settings.includePublicContacts === true || settings.includePublicContacts === 'true';
    const includeNonPublic = settings.includeNonPublicContacts === true || settings.includeNonPublicContacts === 'true';

    let matchesPrivacyScope = false;
    if (isEmployee && includeEmployee) {
        matchesPrivacyScope = true;
    } else if (isPublic && includePublic) {
        matchesPrivacyScope = true;
    } else if (!isEmployee && !isPublic && includeNonPublic) {
        matchesPrivacyScope = true;
    }

    // Role filtering evaluation
    const roleFilterMode = settings.participantRoleFilterMode || 'all';
    const rawRoles: Array<{ id: string; name: string }> = contactOrAssoc.roles || c.roles || contactOrAssoc.eventRoles || [];
    const roleIds = new Set(rawRoles.map((r: any) => String(r.id || r.role?.id || '').toLowerCase()));
    const roleNames = new Set(rawRoles.map((r: any) => String(r.name || r.role?.name || '').toLowerCase().trim()));

    const excludedRoles = normalizeArray(settings.excludedContactRoles);
    const includedRoles = normalizeArray(settings.includedContactRoles);

    let roleFilterActive = false;
    let roleMatches = true;

    if (roleFilterMode === 'include' && includedRoles.length > 0) {
        roleFilterActive = true;
        roleMatches = includedRoles.some(r => roleIds.has(r.toLowerCase()) || roleNames.has(r.toLowerCase().trim()));
    } else if (roleFilterMode === 'exclude' && excludedRoles.length > 0) {
        roleFilterActive = true;
        roleMatches = !excludedRoles.some(r => roleIds.has(r.toLowerCase()) || roleNames.has(r.toLowerCase().trim()));
    }

    // Tag filtering evaluation
    const tagFilterMode = settings.participantTagFilterMode || 'all';
    const rawTags: Array<{ id: string; name: string }> = (c.tags || contactOrAssoc.tags || []).map((t: any) => t.tag || t);
    const tagIds = new Set(rawTags.map((t: any) => String(t?.id || '').toLowerCase()));
    const tagNames = new Set(rawTags.map((t: any) => String(t?.name || '').toLowerCase().trim()));

    const excludedTags = normalizeArray(settings.excludedContactTags);
    const includedTags = normalizeArray(settings.includedContactTags);

    let tagFilterActive = false;
    let tagMatches = true;

    if (tagFilterMode === 'include' && includedTags.length > 0) {
        tagFilterActive = true;
        tagMatches = includedTags.some(t => tagIds.has(t.toLowerCase()) || tagNames.has(t.toLowerCase().trim()));
    } else if (tagFilterMode === 'exclude' && excludedTags.length > 0) {
        tagFilterActive = true;
        tagMatches = !excludedTags.some(t => tagIds.has(t.toLowerCase()) || tagNames.has(t.toLowerCase().trim()));
    }

    // Role and Tag logic chaining
    const filterLogic = (settings.participantFilterLogic || 'AND').toUpperCase();
    const refinementActive = roleFilterActive || tagFilterActive;
    let refinementMatches = true;

    if (roleFilterActive && tagFilterActive) {
        if (filterLogic === 'OR') {
            refinementMatches = roleMatches || tagMatches;
        } else {
            refinementMatches = roleMatches && tagMatches;
        }
    } else if (roleFilterActive) {
        refinementMatches = roleMatches;
    } else if (tagFilterActive) {
        refinementMatches = tagMatches;
    }

    // Scope and Refinement logic chaining
    if (!refinementActive) {
        return matchesPrivacyScope;
    }

    const scopeLogic = (settings.participantScopeLogic || 'AND').toUpperCase();
    if (scopeLogic === 'OR') {
        return matchesPrivacyScope || refinementMatches;
    } else {
        return matchesPrivacyScope && refinementMatches;
    }
}

/**
 * Checks whether an event matches the event selection rules.
 */
export function matchesEventSelectionRules(event: any, settings: Record<string, any>): boolean {
    if (!event) return false;

    // 1. Explicit Overrides
    const excludedEventIds = normalizeArray(settings.excludedEventIds);
    if (excludedEventIds.length > 0 && excludedEventIds.includes(event.id)) {
        return false;
    }
    const includedEventIds = normalizeArray(settings.includedEventIds);
    if (includedEventIds.length > 0 && !includedEventIds.includes(event.id)) {
        return false;
    }

    // 2. Series / Recurrence
    const isSeries = Boolean(
        event.seriesId ||
        event.recurringEventId ||
        (Array.isArray(event.recurrence) && event.recurrence.length > 0) ||
        (typeof event.recurrence === 'string' && event.recurrence.trim().length > 0)
    );
    const excludeSeries = settings.excludeSeries === true || settings.excludeSeries === 'true' || settings.syncSeriesMode === 'exclude';
    if (excludeSeries && isSeries) return false;

    // 3. Status & Visibility
    const excludeNonPublic = settings.excludeNonPublic !== undefined
        ? (settings.excludeNonPublic === true || settings.excludeNonPublic === 'true')
        : true;
    if (excludeNonPublic && !event.isPublic) return false;

    const excludeTentative = settings.excludeTentative !== undefined
        ? (settings.excludeTentative === true || settings.excludeTentative === 'true')
        : true;
    if (excludeTentative && event.status === 'tentative') return false;

    const excludeCancelled = settings.excludeCancelled !== undefined
        ? (settings.excludeCancelled === true || settings.excludeCancelled === 'true')
        : true;
    if (excludeCancelled && event.status === 'cancelled') return false;

    // 4. Past Events
    const now = new Date();
    const end = event.endDateTime ? new Date(event.endDateTime) : (event.startDateTime ? new Date(event.startDateTime) : null);
    const start = event.startDateTime ? new Date(event.startDateTime) : null;
    const excludePast = settings.excludePastEvents === true || settings.excludePastEvents === 'true';
    if (excludePast && end && end.getTime() < now.getTime()) return false;

    // 5. Locations
    const includedLocs = normalizeArray(settings.includedLocationIds);
    const excludedLocs = normalizeArray(settings.excludedLocationIds);
    const eventLocIds: string[] = [];
    if (event.locationId) eventLocIds.push(event.locationId);
    if (event.venueId) eventLocIds.push(event.venueId);
    if (Array.isArray(event.locations)) {
        for (const l of event.locations) {
            if (l?.id) eventLocIds.push(l.id);
            if (l?.locationId) eventLocIds.push(l.locationId);
            if (l?.location?.id) eventLocIds.push(l.location.id);
        }
    }
    if (excludedLocs.length > 0 && eventLocIds.some(id => excludedLocs.includes(id))) return false;
    if (includedLocs.length > 0 && !eventLocIds.some(id => includedLocs.includes(id))) return false;

    // 6. Tags
    const includedTags = normalizeArray(settings.includedTags);
    const excludedTags = normalizeArray(settings.excludedTags);
    const eventTags: string[] = [];
    if (Array.isArray(event.tags)) {
        for (const t of event.tags) {
            if (typeof t === 'string') eventTags.push(t);
            else {
                if (t?.id) eventTags.push(t.id);
                if (t?.name) eventTags.push(t.name);
                if (t?.tag?.id) eventTags.push(t.tag.id);
                if (t?.tag?.name) eventTags.push(t.tag.name);
            }
        }
    }
    if (excludedTags.length > 0 && eventTags.some(t => excludedTags.includes(t))) return false;
    if (includedTags.length > 0 && !eventTags.some(t => includedTags.includes(t))) return false;

    return true;
}

export interface DerivedRecipientContact {
    id: string;
    displayName: string;
    givenName?: string;
    familyName?: string;
    company?: string;
    isPublic?: boolean;
    emails?: Array<{ value: string; primary?: boolean; type?: string }>;
    tags?: any[];
    eventCount: number;
    eventTitles: string[];
    isEventDerived: boolean;
    isEmployee: boolean;
}

/**
 * Extracts and deduplicates all contacts from events matching the event selection rules,
 * filtered by the participant rules.
 */
export function getDerivedEventContacts(events: any[], settings: Record<string, any>): DerivedRecipientContact[] {
    const contactsMap = new Map<string, DerivedRecipientContact>();

    for (const evt of events || []) {
        if (!matchesEventSelectionRules(evt, settings)) {
            continue;
        }

        const rawEventContacts = evt.contacts || [];
        for (const assoc of rawEventContacts) {
            if (!matchesContactParticipantRules(assoc, settings)) {
                continue;
            }

            const c = assoc.contact || assoc;
            if (!c?.id) continue;

            const existing = contactsMap.get(c.id);
            const title = evt.summary || evt.title || 'Untitled Event';
            const isEmployee = isEmployeeContact(assoc);

            if (existing) {
                existing.eventCount++;
                if (!existing.eventTitles.includes(title)) {
                    existing.eventTitles.push(title);
                }
                if (isEmployee) existing.isEmployee = true;
            } else {
                contactsMap.set(c.id, {
                    id: c.id,
                    displayName: c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim() || c.company || 'Unnamed Contact',
                    givenName: c.givenName,
                    familyName: c.familyName,
                    company: c.company,
                    isPublic: c.isPublic === true,
                    emails: c.emails || [],
                    tags: c.tags || [],
                    eventCount: 1,
                    eventTitles: [title],
                    isEventDerived: true,
                    isEmployee
                });
            }
        }
    }

    return Array.from(contactsMap.values());
}
