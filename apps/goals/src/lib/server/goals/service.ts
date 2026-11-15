import {
    db,
    goalCampaign,
    goalStage,
    goalContribution,
    goalUpdate,
    goalCampaignLocation,
    goalCampaignTag,
    goalCampaignContact,
    goalShowcaseConfig,
    contact,
    contactEmail,
    contactPhone,
    contactAddress,
    userContact,
    syncContactEncryption,
    decryptContactRecord,
    location,
    tag,
    eq,
    and,
    or,
    ilike,
    inArray,
    notInArray,
    exists,
    not,
    sql,
    asc,
    desc,
} from '@ac/db';
import {
    parseFilterValue,
    type GoalCampaign,
    type GoalShowcaseConfig,
    type GoalContributionType,
    type GoalCampaignStatus,
    type GoalShowcaseSelectionMode,
    type GoalPluginConfig,
} from '@ac/validations';
import { ensureDefaultCategoriesAndTags, assignTagsToGoalCampaign } from '#lib/server/tags/service.js';
import { getContributionPlugin } from '#lib/plugins/registry.js';
import {
    processFinancialContributionPayment,
    reverseOrSettleFinancialContribution,
} from '#lib/server/payments/provider.js';

let isSchemaAndSeedChecked = false;

export async function ensureGoalsTablesAndSeed(): Promise<void> {
    if (isSchemaAndSeedChecked) return;
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_campaign" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "user_id" text NOT NULL,
                "creator_name" text,
                "creator_role" text DEFAULT 'community' NOT NULL,
                "title" text NOT NULL,
                "slug" text,
                "executive_summary" text NOT NULL,
                "description" text NOT NULL,
                "hero_image" text,
                "contribution_type" text DEFAULT 'vote' NOT NULL,
                "primary_target" double precision DEFAULT 100 NOT NULL,
                "current_amount" double precision DEFAULT 0 NOT NULL,
                "contributions_count" integer DEFAULT 0 NOT NULL,
                "visits_count" integer DEFAULT 0 NOT NULL,
                "currency" text DEFAULT 'EUR' NOT NULL,
                "unit_label" text DEFAULT 'votes' NOT NULL,
                "status" text DEFAULT 'draft' NOT NULL,
                "approval_status" text DEFAULT 'pending' NOT NULL,
                "approval_notes" text,
                "approved_by_user_id" text,
                "approved_at" timestamp with time zone,
                "is_showcased" boolean DEFAULT false NOT NULL,
                "showcase_order" integer DEFAULT 0 NOT NULL,
                "start_date" timestamp with time zone,
                "end_date" timestamp with time zone,
                "plugin_config" jsonb,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL,
                "updated_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_stage" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "campaign_id" uuid NOT NULL REFERENCES "goal_campaign"("id") ON DELETE CASCADE,
                "stage_type" text DEFAULT 'primary' NOT NULL,
                "sort_order" integer DEFAULT 0 NOT NULL,
                "title" text NOT NULL,
                "description" text,
                "target_amount" double precision NOT NULL,
                "is_reached" boolean DEFAULT false NOT NULL,
                "reached_at" timestamp with time zone,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL,
                "updated_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_contribution" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "campaign_id" uuid NOT NULL REFERENCES "goal_campaign"("id") ON DELETE CASCADE,
                "user_id" text NOT NULL,
                "contributor_name" text,
                "plugin_type" text NOT NULL,
                "amount" double precision DEFAULT 1 NOT NULL,
                "currency" text DEFAULT 'EUR' NOT NULL,
                "comment" text,
                "is_anonymous" boolean DEFAULT false NOT NULL,
                "payment_status" text DEFAULT 'not_applicable' NOT NULL,
                "payment_provider" text,
                "payment_reference" text,
                "metadata" jsonb,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_update" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "campaign_id" uuid NOT NULL REFERENCES "goal_campaign"("id") ON DELETE CASCADE,
                "author_id" text NOT NULL,
                "author_name" text,
                "title" text NOT NULL,
                "content" text NOT NULL,
                "is_milestone" boolean DEFAULT false NOT NULL,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL,
                "updated_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_campaign_location" (
                "campaign_id" uuid NOT NULL REFERENCES "goal_campaign"("id") ON DELETE CASCADE,
                "location_id" uuid NOT NULL REFERENCES "location"("id") ON DELETE CASCADE,
                PRIMARY KEY ("campaign_id", "location_id")
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_campaign_tag" (
                "campaign_id" uuid NOT NULL REFERENCES "goal_campaign"("id") ON DELETE CASCADE,
                "tag_id" uuid NOT NULL REFERENCES "tag"("id") ON DELETE CASCADE,
                PRIMARY KEY ("campaign_id", "tag_id")
            );
        `);

        await db.execute(sql`
            ALTER TABLE "goal_campaign"
            ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contact"("id") ON DELETE SET NULL;
        `);

        await db.execute(sql`
            ALTER TABLE "goal_contribution"
            ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contact"("id") ON DELETE SET NULL;
        `);

        await db.execute(sql`
            ALTER TABLE "goal_update"
            ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contact"("id") ON DELETE SET NULL;
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_campaign_contact" (
                "campaign_id" uuid NOT NULL REFERENCES "goal_campaign"("id") ON DELETE CASCADE,
                "contact_id" uuid NOT NULL REFERENCES "contact"("id") ON DELETE CASCADE,
                "role" text DEFAULT 'participant' NOT NULL,
                PRIMARY KEY ("campaign_id", "contact_id")
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "goal_showcase_config" (
                "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
                "is_active" boolean DEFAULT true NOT NULL,
                "selection_mode" text DEFAULT 'mixed' NOT NULL,
                "max_items" integer DEFAULT 3 NOT NULL,
                "title" text DEFAULT 'Featured Goal Campaigns' NOT NULL,
                "subtitle" text,
                "updated_by_user_id" text,
                "updated_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

        await ensureDefaultCategoriesAndTags();

        const [existingConfig] = await db
            .select()
            .from(goalShowcaseConfig)
            .where(eq(goalShowcaseConfig.id, 'default'));

        if (!existingConfig) {
            await db.insert(goalShowcaseConfig).values({
                id: 'default',
                isActive: true,
                selectionMode: 'mixed',
                maxItems: 3,
                title: 'Featured Goal Campaigns',
                subtitle:
                    'Spotlight initiatives curated by operator choice, community momentum, and recent launches.',
            }).onConflictDoNothing();
        }

        const existingCampaigns = await db
            .select({ id: goalCampaign.id })
            .from(goalCampaign)
            .limit(1);

        if (existingCampaigns.length === 0) {
            await seedInitialGoalCampaigns();
        }

        isSchemaAndSeedChecked = true;
    } catch (err) {
        console.warn('[AC-Goals] Schema/seed check warning:', err);
    }
}

function sanitizePublicDisplayName(label?: string | null, fallback = 'Community Member'): string {
    const trimmed = (label || '').trim();
    if (!trimmed) return fallback;
    // Never expose raw email addresses in unencrypted campaign/contribution/update columns
    if (trimmed.includes('@')) {
        const localPart = trimmed.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
        return localPart
            ? localPart.replace(/\b\w/g, (ch) => ch.toUpperCase())
            : fallback;
    }
    return trimmed;
}

/**
 * Segregates personal identifiable information (PII) of a campaign creator, contributor, or update author
 * into the shared `contact` table and encrypts it at rest using AES-256-GCM PKI envelope encryption
 * (`syncContactEncryption`) with HMAC blind indexes (`fingerprints`) for GDPR Art. 15/17 self-service.
 */
export async function ensureEncryptedUserContact(
    actor: {
        id: string;
        name?: string | null;
        email?: string | null;
        givenName?: string;
        familyName?: string;
        phone?: string;
        street?: string;
        houseNumber?: string;
        zip?: string;
        city?: string;
        country?: string;
        company?: string;
        role?: string;
    },
    options?: {
        campaignId?: string;
        campaignRole?: 'creator' | 'contributor' | 'author' | 'participant';
    }
): Promise<{
    contactId: string | null;
    publicDisplayName: string;
    isObfuscated: boolean;
}> {
    const fallbackName = sanitizePublicDisplayName(actor.name || actor.email, 'Community Member');
    try {
        // 1. Look up existing contact linked via userContact or contact.userId
        let existingContact: any = null;

        try {
            const [ucLink] = await db
                .select({ contactId: userContact.contactId })
                .from(userContact)
                .where(eq(userContact.userId, actor.id))
                .limit(1);
            if (ucLink?.contactId) {
                existingContact = await db.query.contact.findFirst({
                    where: eq(contact.id, ucLink.contactId),
                });
            }
        } catch {
            // userContact lookup optional if user row is synthetic
        }

        if (!existingContact && actor.email) {
            const normEmail = actor.email.trim().toLowerCase();
            const [byEmail] = await db
                .select({ contactId: contactEmail.contactId })
                .from(contactEmail)
                .where(ilike(contactEmail.value, normEmail))
                .limit(1);
            if (byEmail?.contactId) {
                existingContact = await db.query.contact.findFirst({
                    where: eq(contact.id, byEmail.contactId),
                });
            }
        }

        if (!existingContact) {
            const nameParts = fallbackName.split(/\s+/);
            const givenName = actor.givenName || nameParts[0] || 'Community';
            const familyName =
                actor.familyName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Participant');

            const [created] = await db
                .insert(contact)
                .values({
                    userId: actor.id,
                    displayName: fallbackName,
                    givenName,
                    familyName,
                    company: actor.company || null,
                    role: actor.role || 'AC-Goals Participant',
                    isPublic: false,
                    notes: 'Segregated AC-Goals participant contact record (PKI Encrypted Envelope).',
                })
                .returning();

            existingContact = created;

            if (created) {
                if (actor.email) {
                    await db.insert(contactEmail).values({
                        contactId: created.id,
                        value: actor.email.trim().toLowerCase(),
                        type: 'work',
                        primary: true,
                    });
                }
                if (actor.phone) {
                    await db.insert(contactPhone).values({
                        contactId: created.id,
                        value: actor.phone.trim(),
                        type: 'mobile',
                        primary: true,
                    });
                }
                if (actor.city || actor.zip || actor.street) {
                    await db.insert(contactAddress).values({
                        contactId: created.id,
                        street: actor.street || null,
                        houseNumber: actor.houseNumber || null,
                        zip: actor.zip || null,
                        city: actor.city || null,
                        country: actor.country || 'Germany',
                        type: 'home',
                        primary: true,
                    });
                }
                try {
                    await db
                        .insert(userContact)
                        .values({
                            userId: actor.id,
                            contactId: created.id,
                        })
                        .onConflictDoNothing();
                } catch {
                    // ignore if user.id is a mock/external actor not in user table
                }
            }
        }

        if (!existingContact) {
            return { contactId: null, publicDisplayName: fallbackName, isObfuscated: false };
        }

        // 2. Ensure contact PII is encrypted at rest if not already obfuscated/shredded
        if (
            existingContact.obfuscationStatus !== 'obfuscated' &&
            existingContact.encryptionStatus !== 'shredded'
        ) {
            await syncContactEncryption(
                existingContact.id,
                {
                    userId: actor.id,
                    name: fallbackName,
                    email: actor.email ?? null,
                },
                `ac-goals-${options?.campaignRole || 'participant'}`
            );
        }

        // 3. Link contact to campaign in goalCampaignContact if campaignId is provided
        if (options?.campaignId) {
            await db
                .insert(goalCampaignContact)
                .values({
                    campaignId: options.campaignId,
                    contactId: existingContact.id,
                    role: options.campaignRole || 'participant',
                })
                .onConflictDoNothing();
        }

        const decrypted = await decryptContactRecord(existingContact);
        const isObfuscated =
            decrypted.obfuscationStatus === 'obfuscated' ||
            decrypted.encryptionStatus === 'shredded';

        return {
            contactId: existingContact.id,
            publicDisplayName: isObfuscated
                ? decrypted.displayName || 'Anonymized Participant (GDPR)'
                : sanitizePublicDisplayName(decrypted.displayName || fallbackName, fallbackName),
            isObfuscated,
        };
    } catch (err) {
        console.warn('[AC-Goals] Contact segregation notice:', err);
        return { contactId: null, publicDisplayName: fallbackName, isObfuscated: false };
    }
}

async function seedInitialGoalCampaigns(): Promise<void> {
    const existingLocs = await db.select().from(location).limit(3);
    let primaryLocationId = existingLocs[0]?.id;
    let secondaryLocationId = existingLocs[1]?.id ?? existingLocs[0]?.id;

    if (!primaryLocationId) {
        const [berlinHub] = await db.insert(location).values({
            userId: 'mock-operator',
            name: 'Berlin-Mitte Community Hub',
            street: 'Torstraße',
            houseNumber: '112',
            zip: '10119',
            city: 'Berlin',
            country: 'Germany',
            isPublic: true,
            description: 'Central civic innovation and community gathering space.',
        }).returning();
        primaryLocationId = berlinHub?.id;

        const [kreuzbergCampus] = await db.insert(location).values({
            userId: 'mock-operator',
            name: 'Kreuzberg Neighborhood Campus',
            street: 'Oranienstraße',
            houseNumber: '45',
            zip: '10969',
            city: 'Berlin',
            country: 'Germany',
            isPublic: true,
            description: 'Workshop and neighborhood action center.',
        }).returning();
        secondaryLocationId = kreuzbergCampus?.id ?? primaryLocationId;
    }

    // Create segregated, PKI-encrypted contacts for the initial campaign creators & contributors
    const operatorSegregated = await ensureEncryptedUserContact({
        id: 'mock-operator',
        name: 'AtCost Sustainability Operations',
        givenName: 'Sustainability',
        familyName: 'Operations',
        email: 'sustainability@atcost.local',
        phone: '+49 30 5550101',
        street: 'Torstraße',
        houseNumber: '112',
        zip: '10119',
        city: 'Berlin',
        country: 'Germany',
        company: 'AtCost Operations',
        role: 'Internal Campaign Operator',
    });

    const elenaSegregated = await ensureEncryptedUserContact({
        id: 'community-user-1',
        name: 'Elena Weber',
        givenName: 'Elena',
        familyName: 'Weber',
        email: 'elena.weber@community.local',
        phone: '+49 30 5550199',
        street: 'Oranienstraße',
        houseNumber: '45',
        zip: '10969',
        city: 'Berlin',
        country: 'Germany',
        company: 'Neighborhood Mobility Initiative',
        role: 'Community Organizer & Backer',
    });

    // 1. Financial Crowdfunding Campaign (Kickstarter style, primary reached, working on Stretch Goal #1)
    const [solarCampaign] = await db.insert(goalCampaign).values({
        userId: 'mock-operator',
        contactId: operatorSegregated.contactId,
        creatorName: 'AtCost Sustainability Operations',
        creatorRole: 'operator',
        title: 'Community Solar Microgrid & Open Charging Station',
        slug: 'community-solar-microgrid',
        executiveSummary:
            'Install a 45 kWp rooftop solar array on our community hub to provide 100% clean power and free e-bike charging for the neighborhood. Primary array funding is unlocked—now pushing for Stretch Goal #1 (Battery Storage)!',
        description:
            'Our neighborhood hub hosts over 180 community events each year. By co-funding our rooftop solar installation, we cut annual carbon emissions by 22 tonnes and lower operating costs for all local initiatives.\n\nBecause our backers already helped us cross the €5,000 Primary Goal, installation is guaranteed! Every additional euro now goes directly toward Stretch Goal #1 (€8,000): a 30 kWh LFP battery bank so evening events run on stored daytime sunshine, and Stretch Goal #2 (€11,500): a covered 8-port public cargo-bike & e-mobility charging dock.',
        heroImage: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1600&auto=format&fit=crop',
        contributionType: 'financial',
        primaryTarget: 5000,
        currentAmount: 6450,
        contributionsCount: 84,
        visitsCount: 412,
        currency: 'EUR',
        unitLabel: 'EUR',
        status: 'published',
        approvalStatus: 'not_required',
        isShowcased: true,
        showcaseOrder: 1,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
        pluginConfig: getContributionPlugin('financial').defaultConfig,
    }).returning();

    if (solarCampaign) {
        if (operatorSegregated.contactId) {
            await db.insert(goalCampaignContact).values({
                campaignId: solarCampaign.id,
                contactId: operatorSegregated.contactId,
                role: 'creator',
            }).onConflictDoNothing();
        }
        if (elenaSegregated.contactId) {
            await db.insert(goalCampaignContact).values({
                campaignId: solarCampaign.id,
                contactId: elenaSegregated.contactId,
                role: 'contributor',
            }).onConflictDoNothing();
        }

        await db.insert(goalStage).values([
            {
                campaignId: solarCampaign.id,
                stageType: 'primary',
                sortOrder: 0,
                title: 'Primary Goal: 45 kWp Rooftop Solar Array',
                description: 'Full rooftop photovoltaic panels + grid inverter installation.',
                targetAmount: 5000,
                isReached: true,
                reachedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
            },
            {
                campaignId: solarCampaign.id,
                stageType: 'stretch',
                sortOrder: 1,
                title: 'Stretch Goal #1: 30 kWh Evening Battery Storage',
                description: 'Store solar energy generated during the day to power evening community workshops.',
                targetAmount: 8000,
                isReached: false,
            },
            {
                campaignId: solarCampaign.id,
                stageType: 'stretch',
                sortOrder: 2,
                title: 'Stretch Goal #2: Public Cargo-Bike & E-Mobility Charging Plaza',
                description: 'Weatherproof outdoor charging station with 8 free green-power outlets.',
                targetAmount: 11500,
                isReached: false,
            },
        ]);

        await db.insert(goalUpdate).values([
            {
                campaignId: solarCampaign.id,
                authorId: 'mock-operator',
                contactId: operatorSegregated.contactId,
                authorName: 'AtCost Sustainability Operations',
                title: 'Primary Goal Reached in 11 Days! Stretch Goal #1 Now Live',
                content:
                    'Thank you to our first 70 backers! We officially crossed the €5,000 primary funding threshold. Our structural roof assessment is complete and we have unlocked Stretch Goal #1: the 30 kWh LFP battery storage unit.',
                isMilestone: true,
            },
        ]);

        await db.insert(goalContribution).values([
            {
                campaignId: solarCampaign.id,
                userId: 'community-user-1',
                contactId: elenaSegregated.contactId,
                contributorName: 'Elena Weber',
                pluginType: 'financial',
                amount: 150,
                currency: 'EUR',
                comment: 'Excited to see the battery storage unlocked so evening workshops run on solar! (Pledged via conditional authorization)',
                isAnonymous: false,
                paymentStatus: 'authorized',
                paymentProvider: 'stripe',
                paymentReference: 'plg_stripe_seed01',
                metadata: {
                    financialType: 'pledge',
                    selectedTierLabel: 'Founding Patron',
                },
            },
            {
                campaignId: solarCampaign.id,
                userId: 'mock-operator',
                contactId: operatorSegregated.contactId,
                contributorName: 'AtCost Sustainability Operations',
                pluginType: 'financial',
                amount: 250,
                currency: 'EUR',
                comment: 'Direct seed transfer into the microgrid campaign escrow account.',
                isAnonymous: false,
                paymentStatus: 'captured',
                paymentProvider: 'stripe',
                paymentReference: 'trf_stripe_seed02',
                metadata: {
                    financialType: 'transfer',
                    selectedTierLabel: 'Founding Patron',
                },
            },
        ]);

        await assignTagsToGoalCampaign(
            solarCampaign.id,
            ['Sustainability & Green Energy', 'Community & Neighborhood'],
            'mock-operator'
        );
        if (primaryLocationId) {
            await db.insert(goalCampaignLocation).values({
                campaignId: solarCampaign.id,
                locationId: primaryLocationId,
            }).onConflictDoNothing();
        }
    }

    // 2. Vote / Petition Campaign (Change.org style)
    const [petitionCampaign] = await db.insert(goalCampaign).values({
        userId: 'community-user-1',
        contactId: elenaSegregated.contactId,
        creatorName: 'Neighborhood Mobility Initiative',
        creatorRole: 'community',
        title: 'Car-Free Weekend Cultural Street & Barrier-Free Ramps',
        slug: 'car-free-weekend-cultural-street',
        executiveSummary:
            'Petitioning the district council to designate our campus block as a pedestrian & wheelchair-friendly cultural zone on Saturdays, with permanent barrier-free curb ramps.',
        description:
            'Every weekend, hundreds of families, seniors, and workshop participants navigate narrow sidewalks outside our neighborhood campus. With 300 verified community votes, the district council commits to a public hearing; at 500 votes (Stretch Goal #1), we submit the joint plan for permanent barrier-free tactile crossings and outdoor seating.',
        heroImage: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1600&auto=format&fit=crop',
        contributionType: 'vote',
        primaryTarget: 300,
        currentAmount: 242,
        contributionsCount: 242,
        visitsCount: 685,
        currency: 'EUR',
        unitLabel: 'votes',
        status: 'published',
        approvalStatus: 'approved',
        approvedByUserId: 'mock-operator',
        approvedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
        isShowcased: true,
        showcaseOrder: 2,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        pluginConfig: getContributionPlugin('vote').defaultConfig,
    }).returning();

    if (petitionCampaign) {
        if (elenaSegregated.contactId) {
            await db.insert(goalCampaignContact).values({
                campaignId: petitionCampaign.id,
                contactId: elenaSegregated.contactId,
                role: 'creator',
            }).onConflictDoNothing();
        }

        await db.insert(goalStage).values([
            {
                campaignId: petitionCampaign.id,
                stageType: 'primary',
                sortOrder: 0,
                title: 'Primary Goal: District Council Hearing Quorum (300 Votes)',
                description: 'Triggers formal agenda placement at the municipal mobility committee.',
                targetAmount: 300,
                isReached: false,
            },
            {
                campaignId: petitionCampaign.id,
                stageType: 'stretch',
                sortOrder: 1,
                title: 'Stretch Goal #1: Permanent Barrier-Free Curb Ramps (500 Votes)',
                description: 'Mandates full accessibility upgrade and weekend cultural street pilot.',
                targetAmount: 500,
                isReached: false,
            },
        ]);

        await db.insert(goalUpdate).values([
            {
                campaignId: petitionCampaign.id,
                authorId: 'community-user-1',
                contactId: elenaSegregated.contactId,
                authorName: 'Neighborhood Mobility Initiative',
                title: 'Over 240 Signatures Collected — Only 58 More Needed!',
                content:
                    'Local shopkeepers and the accessibility advisory board have endorsed our proposal. Share with neighbors so we reach 300 votes before Friday!',
                isMilestone: false,
            },
        ]);

        await assignTagsToGoalCampaign(
            petitionCampaign.id,
            ['Accessibility & Inclusion', 'Community & Neighborhood'],
            'community-user-1'
        );
        if (secondaryLocationId) {
            await db.insert(goalCampaignLocation).values({
                campaignId: petitionCampaign.id,
                locationId: secondaryLocationId,
            }).onConflictDoNothing();
        }
    }

    // 3. Sign-Up Campaign (Volunteer / Participation style)
    const [signupCampaign] = await db.insert(goalCampaign).values({
        userId: 'mock-operator',
        contactId: operatorSegregated.contactId,
        creatorName: 'Open Youth Tech Lab',
        creatorRole: 'operator',
        title: 'Summer Open-Source & Repair Café Mentor Mobilization',
        slug: 'summer-repair-cafe-mentors',
        executiveSummary:
            'Recruiting volunteer mentors and repair specialists to run weekly free electronics & bike repair sessions for youth and seniors across our locations.',
        description:
            'Once 40 volunteer participants sign up (Primary Goal), we can staff every Saturday afternoon all summer. If we hit 65 sign-ups (Stretch Goal #1), we add a dedicated Wednesday Youth Coding & 3D-Printing Lab!',
        heroImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1600&auto=format&fit=crop',
        contributionType: 'signup',
        primaryTarget: 40,
        currentAmount: 31,
        contributionsCount: 26,
        visitsCount: 290,
        currency: 'EUR',
        unitLabel: 'sign-ups',
        status: 'published',
        approvalStatus: 'not_required',
        isShowcased: false,
        showcaseOrder: 3,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18),
        pluginConfig: getContributionPlugin('signup').defaultConfig,
    }).returning();

    if (signupCampaign) {
        if (operatorSegregated.contactId) {
            await db.insert(goalCampaignContact).values({
                campaignId: signupCampaign.id,
                contactId: operatorSegregated.contactId,
                role: 'creator',
            }).onConflictDoNothing();
        }

        await db.insert(goalStage).values([
            {
                campaignId: signupCampaign.id,
                stageType: 'primary',
                sortOrder: 0,
                title: 'Primary Goal: Launch Weekly Saturday Repair Café (40 Sign-ups)',
                description: 'Full mentor coverage for electronics, textiles, and bicycle repair stations.',
                targetAmount: 40,
                isReached: false,
            },
            {
                campaignId: signupCampaign.id,
                stageType: 'stretch',
                sortOrder: 1,
                title: 'Stretch Goal #1: Add Wednesday Youth Coding & 3D-Print Lab (65 Sign-ups)',
                description: 'Expands the program with a mid-week youth maker workshop.',
                targetAmount: 65,
                isReached: false,
            },
        ]);

        await assignTagsToGoalCampaign(
            signupCampaign.id,
            ['Education & Youth', 'Sustainability & Green Energy'],
            'mock-operator'
        );
        if (primaryLocationId) {
            await db.insert(goalCampaignLocation).values({
                campaignId: signupCampaign.id,
                locationId: primaryLocationId,
            }).onConflictDoNothing();
        }
    }

    // 4. Community Campaign Pending Operator Approval (to showcase the approval workflow!)
    const [pendingCampaign] = await db.insert(goalCampaign).values({
        userId: 'community-user-1',
        contactId: elenaSegregated.contactId,
        creatorName: 'Elena Weber (Community Member)',
        creatorRole: 'community',
        title: 'Neighborhood Tool Library & Shared Workshop Lockers',
        slug: 'neighborhood-tool-library',
        executiveSummary:
            'Create a shared lending library of power tools, sewing machines, and gardening equipment so residents can borrow instead of buying.',
        description:
            'Submitted by community members for operator review. Aims to collect 150 member sign-ups to justify dedicating basement storage room B-04 to a cooperative tool library.',
        heroImage: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=1600&auto=format&fit=crop',
        contributionType: 'signup',
        primaryTarget: 150,
        currentAmount: 0,
        contributionsCount: 0,
        visitsCount: 14,
        currency: 'EUR',
        unitLabel: 'sign-ups',
        status: 'pending_approval',
        approvalStatus: 'pending',
        isShowcased: false,
        showcaseOrder: 0,
        pluginConfig: getContributionPlugin('signup').defaultConfig,
    }).returning();

    if (pendingCampaign) {
        if (elenaSegregated.contactId) {
            await db.insert(goalCampaignContact).values({
                campaignId: pendingCampaign.id,
                contactId: elenaSegregated.contactId,
                role: 'creator',
            }).onConflictDoNothing();
        }

        await db.insert(goalStage).values([
            {
                campaignId: pendingCampaign.id,
                stageType: 'primary',
                sortOrder: 0,
                title: 'Primary Goal: 150 Founding Tool Library Members',
                description: 'Unlocks room allocation and starter tool inventory.',
                targetAmount: 150,
                isReached: false,
            },
            {
                campaignId: pendingCampaign.id,
                stageType: 'stretch',
                sortOrder: 1,
                title: 'Stretch Goal #1: 24/7 Smart PIN Locker Access (250 Members)',
                description: 'Adds automated keycard/PIN lockers for self-service evening pickup.',
                targetAmount: 250,
                isReached: false,
            },
        ]);
        await assignTagsToGoalCampaign(
            pendingCampaign.id,
            ['Community & Neighborhood', 'Sustainability & Green Energy'],
            'community-user-1'
        );
        if (primaryLocationId) {
            await db.insert(goalCampaignLocation).values({
                campaignId: pendingCampaign.id,
                locationId: primaryLocationId,
            }).onConflictDoNothing();
        }
    }
}

export async function hydrateGoalCampaigns(
    rawCampaigns: Array<typeof goalCampaign.$inferSelect>,
    options?: { includeDetails?: boolean; isAuthorizedOperator?: boolean }
): Promise<GoalCampaign[]> {
    if (rawCampaigns.length === 0) return [];

    const campaignIds = rawCampaigns.map((c) => c.id);

    const [allStages, allLocLinks, allTagLinks, allUpdates, allContributions] = await Promise.all([
        db
            .select()
            .from(goalStage)
            .where(inArray(goalStage.campaignId, campaignIds))
            .orderBy(asc(goalStage.sortOrder), asc(goalStage.targetAmount)),
        db
            .select({
                campaignId: goalCampaignLocation.campaignId,
                location: location,
            })
            .from(goalCampaignLocation)
            .innerJoin(location, eq(goalCampaignLocation.locationId, location.id))
            .where(inArray(goalCampaignLocation.campaignId, campaignIds)),
        db
            .select({
                campaignId: goalCampaignTag.campaignId,
                tag: tag,
            })
            .from(goalCampaignTag)
            .innerJoin(tag, eq(goalCampaignTag.tagId, tag.id))
            .where(inArray(goalCampaignTag.campaignId, campaignIds)),
        db
            .select()
            .from(goalUpdate)
            .where(inArray(goalUpdate.campaignId, campaignIds))
            .orderBy(desc(goalUpdate.createdAt)),
        options?.includeDetails
            ? db
                  .select()
                  .from(goalContribution)
                  .where(inArray(goalContribution.campaignId, campaignIds))
                  .orderBy(desc(goalContribution.createdAt))
            : Promise.resolve([]),
    ]);

    const stagesByCampaign = new Map<string, any[]>();
    for (const s of allStages) {
        const list = stagesByCampaign.get(s.campaignId) ?? [];
        list.push({
            ...s,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            reachedAt: s.reachedAt ? s.reachedAt.toISOString() : null,
        });
        stagesByCampaign.set(s.campaignId, list);
    }

    const locsByCampaign = new Map<string, any[]>();
    for (const row of allLocLinks) {
        const list = locsByCampaign.get(row.campaignId) ?? [];
        list.push({
            id: row.location.id,
            name: row.location.name,
            street: row.location.street,
            houseNumber: row.location.houseNumber,
            zip: row.location.zip,
            city: row.location.city,
            country: row.location.country,
            isPublic: row.location.isPublic,
        });
        locsByCampaign.set(row.campaignId, list);
    }

    const tagsByCampaign = new Map<string, any[]>();
    for (const row of allTagLinks) {
        if (!options?.isAuthorizedOperator && row.tag.visibility !== 'external') {
            continue;
        }
        const list = tagsByCampaign.get(row.campaignId) ?? [];
        list.push({
            ...row.tag,
            createdAt: row.tag.createdAt.toISOString(),
        });
        tagsByCampaign.set(row.campaignId, list);
    }

    // Batch-resolve segregated encrypted contacts for creators, update authors, and contributors
    const referencedContactIds = Array.from(
        new Set([
            ...rawCampaigns.map((c) => c.contactId).filter((id): id is string => Boolean(id)),
            ...allUpdates.map((u) => u.contactId).filter((id): id is string => Boolean(id)),
            ...allContributions.map((c) => c.contactId).filter((id): id is string => Boolean(id)),
        ])
    );

    const decryptedContactMap = new Map<
        string,
        { displayName: string; isObfuscated: boolean }
    >();

    if (referencedContactIds.length > 0) {
        try {
            const contactRows = await db
                .select()
                .from(contact)
                .where(inArray(contact.id, referencedContactIds));
            const decryptedRows = await Promise.all(
                contactRows.map((row) => decryptContactRecord(row))
            );
            for (const d of decryptedRows) {
                const isObfuscated =
                    d.obfuscationStatus === 'obfuscated' || d.encryptionStatus === 'shredded';
                decryptedContactMap.set(d.id, {
                    displayName: d.displayName || (isObfuscated ? 'Obfuscated Contact (GDPR)' : ''),
                    isObfuscated,
                });
            }
        } catch {
            // fallback to row display labels if contact table query fails
        }
    }

    const updatesByCampaign = new Map<string, any[]>();
    for (const u of allUpdates) {
        const list = updatesByCampaign.get(u.campaignId) ?? [];
        const segContact = u.contactId ? decryptedContactMap.get(u.contactId) : undefined;
        const resolvedAuthorName = segContact?.isObfuscated
            ? segContact.displayName || 'Obfuscated Author (GDPR)'
            : sanitizePublicDisplayName(u.authorName || segContact?.displayName, 'Campaign Owner');
        list.push({
            ...u,
            authorName: resolvedAuthorName,
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString(),
        });
        updatesByCampaign.set(u.campaignId, list);
    }

    const contribsByCampaign = new Map<string, any[]>();
    for (const c of allContributions) {
        const list = contribsByCampaign.get(c.campaignId) ?? [];
        const segContact = c.contactId ? decryptedContactMap.get(c.contactId) : undefined;
        const isAnonOrObfuscated = Boolean(c.isAnonymous || segContact?.isObfuscated);
        const resolvedContributorName = c.isAnonymous
            ? 'Anonymous Supporter'
            : segContact?.isObfuscated
              ? segContact.displayName || 'Obfuscated Supporter (GDPR)'
              : sanitizePublicDisplayName(
                    segContact?.displayName || c.contributorName,
                    'Supporter'
                );
        list.push({
            ...c,
            isAnonymous: isAnonOrObfuscated,
            contributorName: resolvedContributorName,
            createdAt: c.createdAt.toISOString(),
        });
        contribsByCampaign.set(c.campaignId, list);
    }

    return rawCampaigns.map((c) => {
        const locs = locsByCampaign.get(c.id) ?? [];
        const tagsList = tagsByCampaign.get(c.id) ?? [];
        const segCreator = c.contactId ? decryptedContactMap.get(c.contactId) : undefined;
        const resolvedCreatorName = segCreator?.isObfuscated
            ? segCreator.displayName || 'Obfuscated Creator (GDPR)'
            : sanitizePublicDisplayName(
                  c.creatorName || segCreator?.displayName,
                  'Community Member'
              );
        return {
            ...c,
            creatorName: resolvedCreatorName,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
            startDate: c.startDate ? c.startDate.toISOString() : null,
            endDate: c.endDate ? c.endDate.toISOString() : null,
            stages: stagesByCampaign.get(c.id) ?? [],
            locations: locs,
            locationIds: locs.map((l) => l.id),
            tags: tagsList,
            tagNames: tagsList.map((t) => t.name),
            updates: updatesByCampaign.get(c.id) ?? [],
            contributions: contribsByCampaign.get(c.id) ?? [],
        };
    });
}

export async function queryGoalCampaigns(
    input: any,
    options?: { isAuthorizedOperator?: boolean; currentUserId?: string | null }
): Promise<{ data: GoalCampaign[]; total: number }> {
    await ensureGoalsTablesAndSeed();

    const {
        page = 1,
        limit = 50,
        search = '',
        locationId,
        tagId,
        contributionType,
        status,
        approvalStatus,
        creatorRole,
        sortField = 'createdAt',
        sortOrder = 'desc',
        onlyPublished = false,
        onlyShowcased = false,
        createdByUserId,
    } = input || {};

    const offset = (page - 1) * limit;
    let baseQuery = db.select({ id: goalCampaign.id }).from(goalCampaign).$dynamic();
    const conditions: any[] = [];

    if (onlyPublished) {
        conditions.push(
            inArray(goalCampaign.status, ['published', 'completed_successful', 'completed_unsuccessful'])
        );
    } else if (!options?.isAuthorizedOperator) {
        // Non-operators see published/completed campaigns PLUS their own drafts/pending campaigns
        const publicStatuses: GoalCampaignStatus[] = [
            'published',
            'completed_successful',
            'completed_unsuccessful',
        ];
        if (options?.currentUserId) {
            conditions.push(
                or(
                    inArray(goalCampaign.status, publicStatuses),
                    eq(goalCampaign.userId, options.currentUserId)
                )
            );
        } else {
            conditions.push(inArray(goalCampaign.status, publicStatuses));
        }
    }

    if (onlyShowcased) {
        conditions.push(eq(goalCampaign.isShowcased, true));
    }

    if (createdByUserId) {
        conditions.push(eq(goalCampaign.userId, createdByUserId));
    }

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
            or(
                ilike(goalCampaign.title, term),
                ilike(goalCampaign.executiveSummary, term),
                ilike(goalCampaign.description, term),
                ilike(goalCampaign.creatorName, term)
            )
        );
    }

    if (locationId) {
        const locFilter = parseFilterValue(locationId);
        if (locFilter.include.length > 0) {
            conditions.push(
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(goalCampaignLocation)
                        .where(
                            and(
                                eq(goalCampaignLocation.campaignId, goalCampaign.id),
                                inArray(goalCampaignLocation.locationId, locFilter.include)
                            )
                        )
                )
            );
        }
        if (locFilter.exclude.length > 0) {
            conditions.push(
                not(
                    exists(
                        db
                            .select({ one: sql`1` })
                            .from(goalCampaignLocation)
                            .where(
                                and(
                                    eq(goalCampaignLocation.campaignId, goalCampaign.id),
                                    inArray(goalCampaignLocation.locationId, locFilter.exclude)
                                )
                            )
                    )
                )
            );
        }
    }

    if (tagId) {
        const tagFilter = parseFilterValue(tagId);
        if (tagFilter.include.length > 0) {
            conditions.push(
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(goalCampaignTag)
                        .where(
                            and(
                                eq(goalCampaignTag.campaignId, goalCampaign.id),
                                inArray(goalCampaignTag.tagId, tagFilter.include)
                            )
                        )
                )
            );
        }
        if (tagFilter.exclude.length > 0) {
            conditions.push(
                not(
                    exists(
                        db
                            .select({ one: sql`1` })
                            .from(goalCampaignTag)
                            .where(
                                and(
                                    eq(goalCampaignTag.campaignId, goalCampaign.id),
                                    inArray(goalCampaignTag.tagId, tagFilter.exclude)
                                )
                            )
                    )
                )
            );
        }
    }

    if (contributionType) {
        const ctFilter = parseFilterValue(contributionType);
        if (ctFilter.include.length > 0) {
            conditions.push(inArray(goalCampaign.contributionType, ctFilter.include as any));
        }
        if (ctFilter.exclude.length > 0) {
            conditions.push(notInArray(goalCampaign.contributionType, ctFilter.exclude as any));
        }
    }

    if (status) {
        const stFilter = parseFilterValue(status);
        if (stFilter.include.length > 0) {
            conditions.push(inArray(goalCampaign.status, stFilter.include as any));
        }
        if (stFilter.exclude.length > 0) {
            conditions.push(notInArray(goalCampaign.status, stFilter.exclude as any));
        }
    }

    if (approvalStatus) {
        const appFilter = parseFilterValue(approvalStatus);
        if (appFilter.include.length > 0) {
            conditions.push(inArray(goalCampaign.approvalStatus, appFilter.include as any));
        }
        if (appFilter.exclude.length > 0) {
            conditions.push(notInArray(goalCampaign.approvalStatus, appFilter.exclude as any));
        }
    }

    if (creatorRole) {
        const roleFilter = parseFilterValue(creatorRole);
        if (roleFilter.include.length > 0) {
            conditions.push(inArray(goalCampaign.creatorRole, roleFilter.include as any));
        }
        if (roleFilter.exclude.length > 0) {
            conditions.push(notInArray(goalCampaign.creatorRole, roleFilter.exclude as any));
        }
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);
    if (total === 0) return { data: [], total: 0 };

    let orderExpr: any;
    if (sortField === 'updatedAt') {
        orderExpr = sortOrder === 'asc' ? asc(goalCampaign.updatedAt) : desc(goalCampaign.updatedAt);
    } else if (sortField === 'popularity') {
        // Weighted popularity score combining participation (contributionsCount * 5) and visitsCount
        const popExpr = sql`(${goalCampaign.contributionsCount} * 5 + ${goalCampaign.visitsCount})`;
        orderExpr = sortOrder === 'asc' ? sql`${popExpr} asc` : sql`${popExpr} desc`;
    } else if (sortField === 'visitsCount') {
        orderExpr = sortOrder === 'asc' ? asc(goalCampaign.visitsCount) : desc(goalCampaign.visitsCount);
    } else if (sortField === 'contributionsCount') {
        orderExpr =
            sortOrder === 'asc'
                ? asc(goalCampaign.contributionsCount)
                : desc(goalCampaign.contributionsCount);
    } else if (sortField === 'currentAmount') {
        orderExpr = sortOrder === 'asc' ? asc(goalCampaign.currentAmount) : desc(goalCampaign.currentAmount);
    } else {
        orderExpr = sortOrder === 'asc' ? asc(goalCampaign.createdAt) : desc(goalCampaign.createdAt);
    }

    const idRows = await baseQuery.orderBy(orderExpr).limit(limit).offset(offset);
    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) return { data: [], total };

    const rawRows = await db
        .select()
        .from(goalCampaign)
        .where(inArray(goalCampaign.id, ids))
        .orderBy(orderExpr);

    const hydrated = await hydrateGoalCampaigns(rawRows, {
        includeDetails: false,
        isAuthorizedOperator: options?.isAuthorizedOperator,
    });

    return { data: hydrated, total };
}

export async function getShowcaseData(options?: {
    isAuthorizedOperator?: boolean;
}): Promise<{ config: GoalShowcaseConfig; campaigns: GoalCampaign[] }> {
    await ensureGoalsTablesAndSeed();

    const [rawConfig] = await db
        .select()
        .from(goalShowcaseConfig)
        .where(eq(goalShowcaseConfig.id, 'default'));

    const config: GoalShowcaseConfig = rawConfig
        ? {
              ...rawConfig,
              updatedAt: rawConfig.updatedAt.toISOString(),
          }
        : {
              id: 'default',
              isActive: true,
              selectionMode: 'mixed',
              maxItems: 3,
              title: 'Featured Goal Campaigns',
              subtitle:
                  'Spotlight initiatives curated by operator choice, community momentum, and recent launches.',
              updatedByUserId: null,
              updatedAt: new Date().toISOString(),
          };

    if (!config.isActive) {
        return { config, campaigns: [] };
    }

    const activeStatuses: GoalCampaignStatus[] = ['published', 'completed_successful'];
    const maxItems = Math.max(1, Math.min(12, config.maxItems || 3));

    const allPublished = await db
        .select()
        .from(goalCampaign)
        .where(inArray(goalCampaign.status, activeStatuses));

    if (allPublished.length === 0) {
        return { config, campaigns: [] };
    }

    const byOperatorChoice = [...allPublished]
        .filter((c) => c.isShowcased)
        .sort((a, b) => (a.showcaseOrder || 0) - (b.showcaseOrder || 0));

    const byPopularity = [...allPublished].sort(
        (a, b) =>
            b.contributionsCount * 5 +
            b.visitsCount -
            (a.contributionsCount * 5 + a.visitsCount)
    );

    const byRecency = [...allPublished].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const selected: Array<typeof goalCampaign.$inferSelect> = [];
    const seenIds = new Set<string>();

    const pushUnique = (item: typeof goalCampaign.$inferSelect | undefined) => {
        if (!item || seenIds.has(item.id) || selected.length >= maxItems) return;
        seenIds.add(item.id);
        selected.push(item);
    };

    const mode: GoalShowcaseSelectionMode = config.selectionMode || 'mixed';

    if (mode === 'operator_choice') {
        for (const item of byOperatorChoice) pushUnique(item);
        for (const item of byPopularity) pushUnique(item);
    } else if (mode === 'popularity') {
        for (const item of byPopularity) pushUnique(item);
    } else if (mode === 'recency') {
        for (const item of byRecency) pushUnique(item);
    } else {
        // 'mixed': interleaves operator choice, popularity, and recency
        const maxLen = Math.max(byOperatorChoice.length, byPopularity.length, byRecency.length);
        for (let i = 0; i < maxLen && selected.length < maxItems; i++) {
            pushUnique(byOperatorChoice[i]);
            pushUnique(byPopularity[i]);
            pushUnique(byRecency[i]);
        }
    }

    const hydrated = await hydrateGoalCampaigns(selected, {
        includeDetails: false,
        isAuthorizedOperator: options?.isAuthorizedOperator,
    });

    return { config, campaigns: hydrated };
}

export async function getGoalCampaignById(
    id: string,
    options?: { incrementVisit?: boolean; isAuthorizedOperator?: boolean }
): Promise<GoalCampaign | null> {
    await ensureGoalsTablesAndSeed();

    if (options?.incrementVisit) {
        await db
            .update(goalCampaign)
            .set({ visitsCount: sql`${goalCampaign.visitsCount} + 1` })
            .where(eq(goalCampaign.id, id));
    }

    const [row] = await db.select().from(goalCampaign).where(eq(goalCampaign.id, id));
    if (!row) return null;

    const [hydrated] = await hydrateGoalCampaigns([row], {
        includeDetails: true,
        isAuthorizedOperator: options?.isAuthorizedOperator,
    });
    return hydrated ?? null;
}

export async function syncGoalCampaignStages(
    campaignId: string,
    currentAmount: number,
    primaryTarget: number,
    primaryTitle: string,
    primaryDescription: string,
    stretchGoalsJson?: string
): Promise<void> {
    let stretchInputs: Array<{ title: string; description?: string; targetAmount: number }> = [];
    if (stretchGoalsJson) {
        try {
            const parsed = JSON.parse(stretchGoalsJson);
            if (Array.isArray(parsed)) {
                stretchInputs = parsed
                    .filter((s) => s && String(s.title || '').trim().length > 0 && Number(s.targetAmount) > 0)
                    .map((s) => ({
                        title: String(s.title).trim(),
                        description: s.description ? String(s.description).trim() : '',
                        targetAmount: Number(s.targetAmount),
                    }))
                    .sort((a, b) => a.targetAmount - b.targetAmount);
            }
        } catch {
            // ignore malformed JSON
        }
    }

    await db.delete(goalStage).where(eq(goalStage.campaignId, campaignId));

    const now = new Date();
    const stagesToInsert = [
        {
            campaignId,
            stageType: 'primary' as const,
            sortOrder: 0,
            title: primaryTitle?.trim() || 'Primary Goal',
            description: primaryDescription?.trim() || null,
            targetAmount: primaryTarget,
            isReached: currentAmount >= primaryTarget,
            reachedAt: currentAmount >= primaryTarget ? now : null,
        },
        ...stretchInputs.map((s, idx) => ({
            campaignId,
            stageType: 'stretch' as const,
            sortOrder: idx + 1,
            title: s.title,
            description: s.description || null,
            targetAmount: s.targetAmount,
            isReached: currentAmount >= s.targetAmount,
            reachedAt: currentAmount >= s.targetAmount ? now : null,
        })),
    ];

    await db.insert(goalStage).values(stagesToInsert);
}

export async function syncGoalCampaignLocations(
    campaignId: string,
    locationIdsJson?: string
): Promise<void> {
    await db.delete(goalCampaignLocation).where(eq(goalCampaignLocation.campaignId, campaignId));
    if (!locationIdsJson) return;
    try {
        const parsed = JSON.parse(locationIdsJson);
        if (Array.isArray(parsed)) {
            for (const locId of parsed) {
                if (typeof locId === 'string' && locId.trim()) {
                    await db
                        .insert(goalCampaignLocation)
                        .values({ campaignId, locationId: locId.trim() })
                        .onConflictDoNothing();
                }
            }
        }
    } catch {
        // ignore
    }
}

export async function addGoalContributionRecord(
    input: {
        campaignId: string;
        pluginType: GoalContributionType;
        amount?: number | string;
        comment?: string;
        isAnonymous?: boolean | string;
        commitmentRole?: string;
        availabilityNote?: string;
        financialType?: 'pledge' | 'transfer';
        paymentProvider?: 'stripe' | 'mollie' | 'adyen';
        selectedTierLabel?: string;
    },
    user: { id: string; name?: string | null; email: string }
) {
    await ensureGoalsTablesAndSeed();

    const [campaign] = await db
        .select()
        .from(goalCampaign)
        .where(eq(goalCampaign.id, input.campaignId));

    if (!campaign) {
        throw new Error('Goal campaign not found');
    }

    if (campaign.status !== 'published') {
        throw new Error(`Contributions are only open for published campaigns (current status: ${campaign.status}).`);
    }

    const plugin = getContributionPlugin(campaign.contributionType);
    const delta = plugin.computeDelta(input.amount);
    const isAnon = input.isAnonymous === true || input.isAnonymous === 'true';

    let paymentStatus: 'not_applicable' | 'authorized' | 'captured' = 'not_applicable';
    let paymentProvider: string | null = null;
    let paymentReference: string | null = null;
    let checkoutReceiptUrl: string | null = null;
    let resolvedFinancialType: 'pledge' | 'transfer' | undefined = undefined;

    if (campaign.contributionType === 'financial') {
        const provider = input.paymentProvider || campaign.pluginConfig?.paymentProvider || 'stripe';
        const allowedFinancialMode =
            campaign.pluginConfig?.financialMode ??
            (campaign.pluginConfig?.captureStrategy === 'immediate' ? 'transfer_only' : 'both');

        if (allowedFinancialMode === 'pledge_only') {
            resolvedFinancialType = 'pledge';
        } else if (allowedFinancialMode === 'transfer_only') {
            resolvedFinancialType = 'transfer';
        } else {
            resolvedFinancialType = input.financialType === 'transfer' ? 'transfer' : 'pledge';
        }

        const paymentRes = await processFinancialContributionPayment({
            campaignId: campaign.id,
            userId: user.id,
            amount: delta,
            currency: campaign.currency || 'EUR',
            provider,
            financialType: resolvedFinancialType,
            captureStrategy:
                resolvedFinancialType === 'transfer' ? 'immediate' : 'all_or_nothing',
        });
        paymentStatus = paymentRes.paymentStatus;
        paymentProvider = paymentRes.provider;
        paymentReference = paymentRes.paymentReference;
        checkoutReceiptUrl = paymentRes.checkoutReceiptUrl;
    }

    // Segregate contributor PII into encrypted contact record
    const segregatedContributor = await ensureEncryptedUserContact(
        {
            id: user.id,
            name: user.name,
            email: user.email,
            role: 'AC-Goals Contributor',
        },
        {
            campaignId: campaign.id,
            campaignRole: 'contributor',
        }
    );

    const [createdContribution] = await db
        .insert(goalContribution)
        .values({
            campaignId: campaign.id,
            userId: user.id,
            contactId: segregatedContributor.contactId,
            contributorName: isAnon
                ? 'Anonymous Supporter'
                : segregatedContributor.publicDisplayName,
            pluginType: campaign.contributionType,
            amount: delta,
            currency: campaign.currency || 'EUR',
            comment: input.comment?.trim() || null,
            isAnonymous: isAnon || segregatedContributor.isObfuscated,
            paymentStatus,
            paymentProvider,
            paymentReference,
            metadata: {
                ...(resolvedFinancialType ? { financialType: resolvedFinancialType } : {}),
                ...(input.commitmentRole ? { commitmentRole: input.commitmentRole } : {}),
                ...(input.availabilityNote ? { availabilityNote: input.availabilityNote } : {}),
                ...(input.selectedTierLabel ? { selectedTierLabel: input.selectedTierLabel } : {}),
                ...(checkoutReceiptUrl ? { checkoutReceiptUrl } : {}),
            },
        })
        .returning();

    const newAmount = Number((Number(campaign.currentAmount || 0) + delta).toFixed(2));
    const newCount = Number(campaign.contributionsCount || 0) + 1;

    await db
        .update(goalCampaign)
        .set({
            currentAmount: newAmount,
            contributionsCount: newCount,
            updatedAt: new Date(),
        })
        .where(eq(goalCampaign.id, campaign.id));

    // Check and mark any newly reached primary or stretch stages
    const stages = await db
        .select()
        .from(goalStage)
        .where(eq(goalStage.campaignId, campaign.id));

    for (const st of stages) {
        if (!st.isReached && newAmount >= Number(st.targetAmount)) {
            await db
                .update(goalStage)
                .set({
                    isReached: true,
                    reachedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(goalStage.id, st.id));
        }
    }

    return {
        contribution: createdContribution,
        newAmount,
        newCount,
        paymentReference,
        checkoutReceiptUrl,
    };
}

/**
 * Automatically cancels financial pledges and refunds actual transfers when a campaign is
 * cancelled (`cancelled`) or completed unsuccessfully (`completed_unsuccessful`), or captures
 * pledges when a campaign is completed successfully (`completed_successful`).
 */
export async function settleOrReverseCampaignFinancialContributions(
    campaignId: string,
    targetStatus: GoalCampaignStatus,
    actor: { id: string; name?: string | null; email?: string | null }
): Promise<{
    cancelledPledgesCount: number;
    cancelledPledgesAmount: number;
    refundedTransfersCount: number;
    refundedTransfersAmount: number;
    capturedPledgesCount: number;
    capturedPledgesAmount: number;
}> {
    const summary = {
        cancelledPledgesCount: 0,
        cancelledPledgesAmount: 0,
        refundedTransfersCount: 0,
        refundedTransfersAmount: 0,
        capturedPledgesCount: 0,
        capturedPledgesAmount: 0,
    };

    if (
        targetStatus !== 'cancelled' &&
        targetStatus !== 'completed_unsuccessful' &&
        targetStatus !== 'completed_successful'
    ) {
        return summary;
    }

    const contribs = await db
        .select()
        .from(goalContribution)
        .where(
            and(
                eq(goalContribution.campaignId, campaignId),
                eq(goalContribution.pluginType, 'financial')
            )
        );

    if (contribs.length === 0) return summary;

    for (const c of contribs) {
        const meta = (c.metadata ?? {}) as Record<string, any>;
        const inferredType: 'pledge' | 'transfer' =
            meta.financialType === 'transfer' || c.paymentStatus === 'captured' || c.paymentStatus === 'transferred'
                ? 'transfer'
                : 'pledge';

        const reversal = await reverseOrSettleFinancialContribution({
            provider: c.paymentProvider || 'stripe',
            financialType: inferredType,
            currentPaymentStatus: c.paymentStatus,
            originalReference: c.paymentReference,
            outcome: targetStatus,
        });

        if (!reversal) continue;

        const amountNum = Number(c.amount || 0);
        if (reversal.action === 'pledge_cancelled') {
            summary.cancelledPledgesCount += 1;
            summary.cancelledPledgesAmount = Number((summary.cancelledPledgesAmount + amountNum).toFixed(2));
        } else if (reversal.action === 'transfer_refunded') {
            summary.refundedTransfersCount += 1;
            summary.refundedTransfersAmount = Number((summary.refundedTransfersAmount + amountNum).toFixed(2));
        } else if (reversal.action === 'pledge_captured') {
            summary.capturedPledgesCount += 1;
            summary.capturedPledgesAmount = Number((summary.capturedPledgesAmount + amountNum).toFixed(2));
        }

        await db
            .update(goalContribution)
            .set({
                paymentStatus: reversal.nextPaymentStatus,
                metadata: {
                    ...meta,
                    financialType: inferredType,
                    reversalOrSettlementAction: reversal.action,
                    reversalOrSettlementReference: reversal.reference,
                    reversalOrSettlementAt: reversal.processedAt,
                    campaignOutcomeStatus: targetStatus,
                },
            })
            .where(eq(goalContribution.id, c.id));
    }

    // Record an official campaign update when pledges are cancelled or transfers are refunded/captured
    if (
        summary.cancelledPledgesCount > 0 ||
        summary.refundedTransfersCount > 0 ||
        summary.capturedPledgesCount > 0
    ) {
        const segregatedActor = await ensureEncryptedUserContact(
            {
                id: actor.id,
                name: actor.name,
                email: actor.email,
                role: 'Campaign Settlement System',
            },
            {
                campaignId,
                campaignRole: 'author',
            }
        );

        const isReversal =
            targetStatus === 'cancelled' || targetStatus === 'completed_unsuccessful';
        const outcomeLabel =
            targetStatus === 'cancelled'
                ? 'Campaign Cancelled'
                : targetStatus === 'completed_unsuccessful'
                  ? 'Campaign Completed Unsuccessfully'
                  : 'Campaign Completed Successfully';

        const title = isReversal
            ? `${outcomeLabel}: All Financial Pledges Cancelled & Transfers Refunded`
            : `${outcomeLabel}: Financial Pledges Captured & Transfers Settled`;

        const content = isReversal
            ? `Automated payment reversal executed for ${outcomeLabel.toLowerCase()}:\n• Cancelled Pledges (no charge to backers): ${summary.cancelledPledgesCount} (${summary.cancelledPledgesAmount.toLocaleString()})\n• Refunded Actual Transfers: ${summary.refundedTransfersCount} (${summary.refundedTransfersAmount.toLocaleString()})`
            : `Automated milestone settlement completed:\n• Captured Pledges: ${summary.capturedPledgesCount} (${summary.capturedPledgesAmount.toLocaleString()})\n• Settled Direct Transfers: all active transfers finalized.`;

        await db.insert(goalUpdate).values({
            campaignId,
            authorId: actor.id,
            contactId: segregatedActor.contactId,
            authorName: segregatedActor.publicDisplayName || 'Payment Settlement Engine',
            title,
            content,
            isMilestone: true,
        });
    }

    return summary;
}
