// Re-export shared schema tables
export {
    user, session, account, verification,
    contact, contactEmail, contactPhone, contactAddress,
    userContact, locationContact, resourceContact,
    contactRelation, tag, contactTag,
    contactRelations, contactRelationRelations, tagRelations,
    contactTagRelations, contactEmailRelations, contactPhoneRelations,
    contactAddressRelations, userContactRelations,
    locationContactRelations, resourceContactRelations,
    location, resource, resourceRelation,
} from '@ac/db';

// App-specific relations for auth tables
import { relations } from 'drizzle-orm';
import { user, session, account, contact, tag, location, resource } from '@ac/db';

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    contacts: many(contact),
    tags: many(tag),
    locations: many(location),
    resources: many(resource),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));
