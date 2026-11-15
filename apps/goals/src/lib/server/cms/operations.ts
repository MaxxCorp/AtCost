import {
    db,
    cmsPage,
    cmsBlock,
    cmsSlot,
    cmsContentVersion,
    eq,
    and,
    desc,
} from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';

export type ContentBranch = 'draft' | 'published';

const DEFAULT_CMS_CONTENT: Record<string, Record<string, string>> = {
    imprint: {
        en: `<h2>Legal Notice &amp; Operator Information (§ 5 DDG / TMG)</h2>
<p><strong>AtCost Community &amp; Civic Initiatives Platform (AC-Goals)</strong><br />
Torstraße 112<br />
10119 Berlin, Germany</p>
<p><strong>Contact:</strong><br />
Email: legal@atcost.local<br />
Phone: +49 (0) 30 5550101</p>
<h3>Authorized Representatives</h3>
<p>Executive Operations Board — AtCost Cooperative &amp; Civic Infrastructure</p>
<h3>Editorial Responsibility (§ 18 Abs. 2 MStV)</h3>
<p>AtCost Sustainability &amp; Community Operations, Torstraße 112, 10119 Berlin.</p>
<h3>Dispute Resolution &amp; Consumer Arbitration</h3>
<p>The European Commission provides a platform for online dispute resolution (OS). Community campaigns undergo operator review prior to publication. Financial pledges are processed via licensed payment institutions (Stripe Connect / Mollie / Adyen) using escrow-style authorization and capture.</p>`,
        de: `<h2>Angaben gemäß § 5 DDG (vormals TMG)</h2>
<p><strong>AtCost Community &amp; Civic Initiatives Platform (AC-Goals)</strong><br />
Torstraße 112<br />
10119 Berlin, Deutschland</p>
<p><strong>Kontakt:</strong><br />
E-Mail: legal@atcost.local<br />
Telefon: +49 (0) 30 5550101</p>
<h3>Vertretungsberechtigter Vorstand / Geschäftsführung</h3>
<p>Executive Operations Board — AtCost Cooperative &amp; Civic Infrastructure</p>
<h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
<p>AtCost Sustainability &amp; Community Operations, Torstraße 112, 10119 Berlin.</p>
<h3>Streitschlichtung &amp; Zahlungsabwicklung</h3>
<p>Community-Kampagnen durchlaufen vor der Veröffentlichung einen Operator-Prüfprozess. Finanzielle Unterstützungen werden über lizenzierte Zahlungsdienstleister (Stripe Connect / Mollie / Adyen) abgewickelt.</p>`,
    },
    gdpr: {
        en: `<h2>Data Privacy Policy &amp; Technical Data Protection (GDPR / DSGVO)</h2>
<p>Protecting the personal data of campaign creators, contributors, and community participants is a core architectural principle of <strong>AC-Goals</strong>.</p>
<h3>1. Encrypted Contact Data Segregation (AES-256-GCM &amp; PKI Envelopes)</h3>
<ul>
  <li><strong>Strict Segregation of PII:</strong> Personal identifiable information (names, email addresses, phone numbers, postal addresses) is segregated from public campaign, vote, sign-up, and pledge tables into the dedicated <code>contact</code> subsystem.</li>
  <li><strong>At-Rest Envelope Encryption:</strong> Contact records are encrypted using <strong>AES-256-GCM</strong> with per-subject Data Encryption Keys (DEKs) wrapped via asymmetric PKI keys (<code>contact.encryptedEnvelope</code>) and audited in an immutable custody ledger (<code>personnelLedgerBlock</code>).</li>
  <li><strong>HMAC Blind Indexes:</strong> Searchable identity attributes are stored as keyed cryptographic blind indexes (<code>contact.fingerprints</code>) so records can be verified without exposing plaintext PII.</li>
</ul>
<h3>2. GDPR Art. 15 &amp; Art. 17 Self-Service &amp; Crypto-Shredding</h3>
<ul>
  <li><strong>Automated 3-Attribute Verification:</strong> You can request data anonymization / erasure at any time via our <a href="/gdpr-self-service"><strong>GDPR Self-Service Portal (/gdpr-self-service)</strong></a> by providing at least 3 matching personal attributes.</li>
  <li><strong>Irreversible Crypto-Shredding:</strong> When an obfuscation request is executed by an administrator, the subject's PKI Data Encryption Keys are permanently destroyed (<em>crypto-shredded</em>), contact attributes are replaced with irreversible SHA-256 hashes, and linked campaign contributions or creator attributions are anonymized.</li>
</ul>
<h3>3. Payment Processing (Financial Contribution Plugin)</h3>
<p>Financial campaign pledges are processed through PCI-DSS Level 1 certified payment providers (<strong>Stripe Connect</strong>, <strong>Mollie</strong>, or <strong>Adyen</strong>). Raw card or bank credentials never touch AC-Goals servers.</p>`,
        de: `<h2>Datenschutzerklärung &amp; Technische Datenschutzarchitektur (DSGVO)</h2>
<p>Der Schutz personenbezogener Daten von Kampagnenstarter:innen, Unterstützer:innen und Teilnehmenden ist ein zentrales Architekturprinzip von <strong>AC-Goals</strong>.</p>
<h3>1. Verschlüsselte Kontaktdaten-Segregation (AES-256-GCM &amp; PKI-Envelopes)</h3>
<ul>
  <li><strong>Strikte Trennung personenbezogener Daten (PII):</strong> Personenbezogene Identitätsdaten (Namen, E-Mail-Adressen, Telefonnummern, Anschriften) werden strikt von den Kampagnen-, Abstimmungs- und Unterstützungsdaten getrennt im zentralen <code>contact</code>-Subsystem gespeichert.</li>
  <li><strong>Envelope-Verschlüsselung (At-Rest):</strong> Kontaktdatensätze werden mittels <strong>AES-256-GCM</strong> und subjektspezifischen Data Encryption Keys (DEKs) in asymmetrischen PKI-Envelopes (<code>contact.encryptedEnvelope</code>) verschlüsselt und in einer kryptografischen Nachweiskette (<code>personnelLedgerBlock</code>) protokolliert.</li>
  <li><strong>HMAC Blind-Indizes:</strong> Für die Identifikation im Rahmen von Betroffenenrechten werden gehashte Blind-Indizes (<code>contact.fingerprints</code>) genutzt.</li>
</ul>
<h3>2. DSGVO Art. 15 &amp; Art. 17 Self-Service &amp; Crypto-Shredding</h3>
<ul>
  <li><strong>Automatisierte 3-Merkmale-Verifikation:</strong> Über unser <a href="/gdpr-self-service"><strong>DSGVO Self-Service Portal (/gdpr-self-service)</strong></a> können Sie jederzeit ohne Login die Anonymisierung und Löschung Ihrer Kontaktdaten beantragen, indem Sie mindestens 3 übereinstimmende Merkmale angeben.</li>
  <li><strong>Unwiderrufliches Crypto-Shredding:</strong> Bei Ausführung der Anonymisierung werden sämtliche kryptografischen Schlüssel (DEKs) unwiderruflich vernichtet (<em>Crypto-Shredding</em>), Klartextfelder durch SHA-256-Hashes ersetzt und verknüpfte Kampagnenbeiträge anonymisiert.</li>
</ul>
<h3>3. Zahlungsabwicklung (Finanzielle Unterstützungen)</h3>
<p>Finanzielle Beiträge werden über PCI-DSS-zertifizierte Zahlungsdienstleister (<strong>Stripe Connect</strong>, <strong>Mollie</strong> oder <strong>Adyen</strong>) abgewickelt. Zahlungsdaten werden niemals unverschlüsselt auf AC-Goals-Servern gespeichert.</p>`,
    },
};

export async function getContent(
    pageSlug: string,
    slotName: string,
    language: string,
    branch: ContentBranch = 'published'
) {
    let slot = await db.query.cmsSlot.findFirst({
        where: and(eq(cmsSlot.pageSlug, pageSlug), eq(cmsSlot.slotName, slotName)),
    });

    if (!slot) {
        const defaultPageContent = DEFAULT_CMS_CONTENT[pageSlug];
        if (defaultPageContent) {
            try {
                await db
                    .insert(cmsPage)
                    .values({
                        slug: pageSlug,
                        name: pageSlug === 'imprint' ? 'Imprint / Legal Notice' : 'Data Privacy Policy (GDPR)',
                    })
                    .onConflictDoNothing();

                const [createdBlock] = await db
                    .insert(cmsBlock)
                    .values({
                        name: `${pageSlug}-${slotName}`,
                        description: `Default ${pageSlug} content block`,
                    })
                    .returning();

                if (createdBlock) {
                    const [createdSlot] = await db
                        .insert(cmsSlot)
                        .values({
                            pageSlug,
                            slotName,
                            blockId: createdBlock.id,
                        })
                        .onConflictDoNothing()
                        .returning();

                    slot = createdSlot;

                    for (const [lang, html] of Object.entries(defaultPageContent)) {
                        await db.insert(cmsContentVersion).values({
                            blockId: createdBlock.id,
                            language: lang,
                            branch: 'published',
                            content: { html },
                        });
                    }
                }
            } catch {
                // fallback to static content below if DB insert races
            }
        }
    }

    if (!slot) {
        const fallbackHtml =
            DEFAULT_CMS_CONTENT[pageSlug]?.[language] ??
            DEFAULT_CMS_CONTENT[pageSlug]?.['en'] ??
            null;
        return fallbackHtml ? { content: fallbackHtml, blockId: null } : null;
    }

    let version = await db.query.cmsContentVersion.findFirst({
        where: and(
            eq(cmsContentVersion.blockId, slot.blockId),
            eq(cmsContentVersion.language, language),
            eq(cmsContentVersion.branch, branch)
        ),
        orderBy: [desc(cmsContentVersion.createdAt)],
    });

    if (!version && branch === 'draft') {
        version = await db.query.cmsContentVersion.findFirst({
            where: and(
                eq(cmsContentVersion.blockId, slot.blockId),
                eq(cmsContentVersion.language, language),
                eq(cmsContentVersion.branch, 'published')
            ),
            orderBy: [desc(cmsContentVersion.createdAt)],
        });
    }

    if (!version && language !== 'en') {
        version = await db.query.cmsContentVersion.findFirst({
            where: and(
                eq(cmsContentVersion.blockId, slot.blockId),
                eq(cmsContentVersion.language, 'en'),
                eq(cmsContentVersion.branch, 'published')
            ),
            orderBy: [desc(cmsContentVersion.createdAt)],
        });
    }

    const htmlContent =
        (version?.content as { html: string })?.html ??
        DEFAULT_CMS_CONTENT[pageSlug]?.[language] ??
        DEFAULT_CMS_CONTENT[pageSlug]?.['en'] ??
        '';

    return {
        content: htmlContent,
        blockId: slot.blockId,
    };
}

export async function createBlock(name: string, description?: string) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'cms');

    const [newBlock] = await db
        .insert(cmsBlock)
        .values({
            name,
            description,
        })
        .returning();

    return newBlock;
}

export async function linkBlock(pageSlug: string, slotName: string, blockId: string) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'cms');

    const existingPage = await db.query.cmsPage.findFirst({
        where: eq(cmsPage.slug, pageSlug),
    });
    if (!existingPage) {
        await db.insert(cmsPage).values({
            slug: pageSlug,
            name: pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1),
        });
    }

    const existingSlot = await db.query.cmsSlot.findFirst({
        where: and(eq(cmsSlot.pageSlug, pageSlug), eq(cmsSlot.slotName, slotName)),
    });

    if (existingSlot) {
        await db
            .update(cmsSlot)
            .set({ blockId })
            .where(and(eq(cmsSlot.pageSlug, pageSlug), eq(cmsSlot.slotName, slotName)));
    } else {
        await db.insert(cmsSlot).values({
            pageSlug,
            slotName,
            blockId,
        });
    }

    return { success: true };
}

export async function saveContent(
    blockId: string,
    language: string,
    branch: ContentBranch,
    html: string
) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'cms');

    await db.insert(cmsContentVersion).values({
        blockId,
        language,
        branch,
        content: { html },
        createdBy: user.id,
    });

    return { success: true };
}

export async function deleteBlock(blockId: string) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'cms');

    await db.delete(cmsBlock).where(eq(cmsBlock.id, blockId));
    return { success: true };
}

export async function getBlock(blockId: string) {
    const block = await db.query.cmsBlock.findFirst({
        where: eq(cmsBlock.id, blockId),
    });
    return block;
}

export async function listBlocks() {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'cms');

    return await db.query.cmsBlock.findMany({
        orderBy: [desc(cmsBlock.createdAt)],
    });
}

export async function renameBlock(blockId: string, newName: string) {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'cms');

    const [updated] = await db
        .update(cmsBlock)
        .set({ name: newName })
        .where(eq(cmsBlock.id, blockId))
        .returning();

    return updated;
}
