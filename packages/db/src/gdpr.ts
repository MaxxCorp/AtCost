import { db } from './db.js';
import {
    contact,
    contactEmail,
    contactPhone,
    contactAddress,
    gdprRequest,
    task,
} from './schema/index.js';
import { eq, and, or, sql, inArray, desc, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';

export interface IdentifyAttributesInput {
    email?: string;
    phone?: string;
    birthday?: string;
    familyName?: string;
    givenName?: string;
    zip?: string;
    city?: string;
    street?: string;
    notes?: string;
    confirmRequest?: boolean;
}

export interface IdentificationResult {
    success: boolean;
    reason?: string;
    contactId?: string;
    contactDisplayName?: string;
    identifiedFields?: string[];
    gdprRequestId?: string;
    alreadyObfuscated?: boolean;
    alreadyPending?: boolean;
}

function sha256(val: string): string {
    return createHash('sha256').update(val.trim()).digest('hex');
}

function normalizePhone(val: string): string {
    return val.replace(/[\s\-\(\)\/\.]/g, '').toLowerCase();
}

/**
 * Searches the contact pool for a contact matching at least 3 provided semi-private attributes.
 * If verified, marks the contact for obfuscation and creates a GDPR request + management task.
 */
export async function identifyAndMarkContactForObfuscation(
    input: IdentifyAttributesInput
): Promise<IdentificationResult> {
    if (input.confirmRequest === false) {
        return {
            success: false,
            reason: 'Bitte bestätigen Sie die Anforderung zur Datenanonymisierung.',
        };
    }

    const identifiedFields: string[] = [];

    const normEmail = input.email?.trim().toLowerCase();
    const normPhone = input.phone?.trim() ? normalizePhone(input.phone) : undefined;
    const normBirthday = input.birthday?.trim();
    const normFamilyName = input.familyName?.trim().toLowerCase();
    const normGivenName = input.givenName?.trim().toLowerCase();
    const normZip = input.zip?.trim().toLowerCase();
    const normCity = input.city?.trim().toLowerCase();
    const normStreet = input.street?.trim().toLowerCase();

    if (normEmail) identifiedFields.push('email');
    if (normPhone) identifiedFields.push('phone');
    if (normBirthday) identifiedFields.push('birthday');
    if (normFamilyName) identifiedFields.push('familyName');
    if (normGivenName) identifiedFields.push('givenName');
    if (normZip) identifiedFields.push('zip');
    if (normCity) identifiedFields.push('city');
    if (normStreet) identifiedFields.push('street');

    if (identifiedFields.length < 3) {
        return {
            success: false,
            reason: 'Mindestens 3 Identifikationsmerkmale müssen angegeben werden.',
        };
    }

    // Load candidates matching any of the top discriminators (email, phone, birthday, or familyName)
    const baseConditions: any[] = [];
    if (normEmail) {
        baseConditions.push(
            sql`EXISTS (SELECT 1 FROM ${contactEmail} WHERE ${contactEmail.contactId} = ${contact.id} AND lower(${contactEmail.value}) = ${normEmail})`
        );
    }
    if (normPhone) {
        baseConditions.push(
            sql`EXISTS (SELECT 1 FROM ${contactPhone} WHERE ${contactPhone.contactId} = ${contact.id} AND regexp_replace(lower(${contactPhone.value}), '[\\s\\-\\(\\)\\.]', '', 'g') = ${normPhone})`
        );
    }
    if (normBirthday) {
        baseConditions.push(
            sql`to_char(${contact.birthday}, 'YYYY-MM-DD') = ${normBirthday}`
        );
    }
    if (normFamilyName) {
        baseConditions.push(sql`lower(${contact.familyName}) = ${normFamilyName}`);
    }
    if (normGivenName) {
        baseConditions.push(sql`lower(${contact.givenName}) = ${normGivenName}`);
    }
    if (normZip) {
        baseConditions.push(
            sql`EXISTS (SELECT 1 FROM ${contactAddress} WHERE ${contactAddress.contactId} = ${contact.id} AND lower(${contactAddress.zip}) = ${normZip})`
        );
    }
    if (normCity) {
        baseConditions.push(
            sql`EXISTS (SELECT 1 FROM ${contactAddress} WHERE ${contactAddress.contactId} = ${contact.id} AND lower(${contactAddress.city}) = ${normCity})`
        );
    }
    if (normStreet) {
        baseConditions.push(
            sql`EXISTS (SELECT 1 FROM ${contactAddress} WHERE ${contactAddress.contactId} = ${contact.id} AND lower(${contactAddress.street}) LIKE ${'%' + normStreet + '%'})`
        );
    }

    // Must match ALL provided conditions
    const matchedContacts = await db
        .select()
        .from(contact)
        .where(and(...baseConditions));

    if (matchedContacts.length === 0) {
        return {
            success: false,
            reason: 'Keine Übereinstimmung gefunden. Bitte überprüfen Sie Ihre eingegebenen Daten.',
        };
    }

    if (matchedContacts.length > 1) {
        return {
            success: false,
            reason: 'Mehrdeutiges Ergebnis. Bitte geben Sie zusätzliche Merkmale an, um die Identität eindeutig zu verifizieren.',
        };
    }

    const matched = matchedContacts[0];

    // Check if already obfuscated
    if (matched.obfuscationStatus === 'obfuscated') {
        return {
            success: false,
            alreadyObfuscated: true,
            reason: 'Dieser Datensatz wurde bereits erfolgreich anonymisiert / obfuskiert.',
            contactId: matched.id,
        };
    }

    // Check if request is already pending
    if (matched.obfuscationStatus === 'pending') {
        const [existingReq] = await db
            .select()
            .from(gdprRequest)
            .where(and(eq(gdprRequest.contactId, matched.id), eq(gdprRequest.status, 'pending')))
            .limit(1);

        return {
            success: true,
            alreadyPending: true,
            contactId: matched.id,
            contactDisplayName: matched.displayName || 'Kontakt',
            identifiedFields,
            gdprRequestId: existingReq?.id,
            reason: 'Ein Antrag auf Anonymisierung liegt bereits vor und wird von den Administratoren bearbeitet.',
        };
    }

    const now = new Date();

    // Mark contact as pending obfuscation
    await db
        .update(contact)
        .set({
            obfuscationStatus: 'pending',
            obfuscationRequestedAt: now,
            updatedAt: now,
        })
        .where(eq(contact.id, matched.id));

    // Create GDPR request record
    const [newRequest] = await db
        .insert(gdprRequest)
        .values({
            contactId: matched.id,
            status: 'pending',
            identifiedFields,
            requestedAt: now,
            notes: input.notes?.trim() || 'Selbstauskunft DSGVO Art. 17',
        })
        .returning();

    // Integrate with ac-talents task system (shared task queue for Admins / HR Managers)
    try {
        const deadlineDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day statutory GDPR deadline
        const contactLabel = matched.displayName || [matched.givenName, matched.familyName].filter(Boolean).join(' ') || 'Kontakt';

        await db.insert(task).values({
            type: 'gdpr_obfuscation',
            status: 'pending',
            title: `DSGVO-Anonymisierung: ${contactLabel}`,
            description: `Antrag auf Löschung / Anonymisierung (Art. 17 DSGVO). Identifiziert über 3 Merkmale (${identifiedFields.join(', ')}).`,
            targetRoles: ['admin', 'hr_manager', 'top_management'],
            dueDate: deadlineDate,
            data: {
                contactId: matched.id,
                gdprRequestId: newRequest.id,
                identifiedFields,
                requestedAt: now.toISOString(),
            },
        });
    } catch (taskErr) {
        console.warn('[GDPR Service] Notice: Could not register task into task table:', taskErr);
    }

    return {
        success: true,
        contactId: matched.id,
        contactDisplayName: matched.displayName || 'Kontakt',
        identifiedFields,
        gdprRequestId: newRequest.id,
    };
}

/**
 * Executes the obfuscation of a contact by replacing all identifiable data with cryptographic hashes (SHA-256).
 */
export async function obfuscateContact(
    contactId: string,
    adminUserId: string,
    notes?: string
): Promise<{ success: boolean; contactId: string }> {
    const existing = await db.query.contact.findFirst({
        where: eq(contact.id, contactId),
        with: {
            emails: true,
            phones: true,
            addresses: true,
        },
    });

    if (!existing) {
        throw new Error('Kontakt nicht gefunden.');
    }

    const now = new Date();
    const rawDisp = existing.displayName || existing.id;
    const dispHash = sha256(rawDisp).slice(0, 8);
    const givenHash = existing.givenName ? sha256(existing.givenName).slice(0, 10) : dispHash;
    const familyHash = existing.familyName ? sha256(existing.familyName).slice(0, 10) : sha256(existing.id).slice(0, 10);

    // 1. Obfuscate master contact record
    await db
        .update(contact)
        .set({
            displayName: `Obfuscated Contact (${dispHash})`,
            givenName: `obf_${givenHash}`,
            familyName: `obf_${familyHash}`,
            middleName: null,
            honorificPrefix: null,
            honorificSuffix: null,
            company: null,
            department: null,
            role: null,
            birthday: null,
            gender: null,
            notes: '[OBFUSCATED PER GDPR REQUEST]',
            vCardPath: null,
            qrCodePath: null,
            obfuscationStatus: 'obfuscated',
            obfuscatedAt: now,
            updatedAt: now,
        })
        .where(eq(contact.id, contactId));

    // 2. Obfuscate associated emails
    if (existing.emails && existing.emails.length > 0) {
        for (const e of existing.emails) {
            const emailHash = sha256(e.value).slice(0, 16);
            await db
                .update(contactEmail)
                .set({
                    value: `obf_${emailHash}@obfuscated.local`,
                })
                .where(eq(contactEmail.id, e.id));
        }
    }

    // 3. Obfuscate associated phones
    if (existing.phones && existing.phones.length > 0) {
        for (const p of existing.phones) {
            const phoneHash = sha256(p.value).slice(0, 12);
            await db
                .update(contactPhone)
                .set({
                    value: `obf_${phoneHash}`,
                })
                .where(eq(contactPhone.id, p.id));
        }
    }

    // 4. Obfuscate associated addresses
    if (existing.addresses && existing.addresses.length > 0) {
        for (const a of existing.addresses) {
            await db
                .update(contactAddress)
                .set({
                    street: 'Obfuscated Street',
                    houseNumber: '0',
                    addressSuffix: null,
                    zip: '00000',
                    city: 'Obfuscated City',
                    state: null,
                    country: null,
                })
                .where(eq(contactAddress.id, a.id));
        }
    }

    // 5. Update any pending GDPR requests for this contact
    await db
        .update(gdprRequest)
        .set({
            status: 'obfuscated',
            processedAt: now,
            processedBy: adminUserId,
            notes: notes ? sql`concat(coalesce(${gdprRequest.notes}, ''), ' | ', ${notes})` : undefined,
            updatedAt: now,
        })
        .where(and(eq(gdprRequest.contactId, contactId), eq(gdprRequest.status, 'pending')));

    // 6. Complete related tasks in the task system
    try {
        await db
            .update(task)
            .set({
                status: 'completed',
                updatedAt: now,
            })
            .where(
                and(
                    eq(task.type, 'gdpr_obfuscation'),
                    eq(task.status, 'pending'),
                    sql`${task.data}->>'contactId' = ${contactId}`
                )
            );
    } catch (taskErr) {
        console.warn('[GDPR Service] Notice: Could not auto-complete task:', taskErr);
    }

    return { success: true, contactId };
}

export interface ListGdprRequestsOptions {
    status?: 'all' | 'pending' | 'obfuscated';
    search?: string;
    page?: number;
    limit?: number;
}

/**
 * Lists GDPR obfuscation requests with contact details and pagination.
 */
export async function listGdprRequests(options?: ListGdprRequestsOptions) {
    const { status = 'pending', search = '', page = 1, limit = 50 } = options || {};
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (status !== 'all') {
        conditions.push(eq(gdprRequest.status, status));
    }

    if (search.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push(
            or(
                sql`EXISTS (SELECT 1 FROM ${contact} WHERE ${contact.id} = ${gdprRequest.contactId} AND (${contact.displayName} ILIKE ${s} OR ${contact.givenName} ILIKE ${s} OR ${contact.familyName} ILIKE ${s}))`,
                sql`${gdprRequest.notes} ILIKE ${s}`
            )
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(gdprRequest)
        .where(whereClause);

    const total = Number(countResult?.count || 0);

    const requests = await db.query.gdprRequest.findMany({
        where: whereClause,
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                },
            },
        },
        orderBy: [desc(gdprRequest.requestedAt)],
        limit,
        offset,
    });

    const data = requests.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        status: r.status,
        identifiedFields: r.identifiedFields || [],
        requestedAt: r.requestedAt.toISOString(),
        processedAt: r.processedAt?.toISOString() || null,
        processedBy: r.processedBy,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        contact: r.contact
            ? {
                  id: r.contact.id,
                  displayName: r.contact.displayName || '',
                  givenName: r.contact.givenName || '',
                  familyName: r.contact.familyName || '',
                  obfuscationStatus: r.contact.obfuscationStatus,
                  obfuscatedAt: r.contact.obfuscatedAt?.toISOString() || null,
                  emails: (r.contact.emails || []).map((e) => e.value),
                  phones: (r.contact.phones || []).map((p) => p.value),
                  addresses: (r.contact.addresses || []).map(
                      (a) => `${a.street || ''} ${a.houseNumber || ''}, ${a.zip || ''} ${a.city || ''}`.trim()
                  ),
              }
            : null,
    }));

    return { data, total, page, limit };
}
