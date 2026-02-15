import { relations } from 'drizzle-orm';
import { campaign } from "./campaigns";
import { contact, tag } from "./contacts";
import { event } from "./events";
import { location, resource } from "./resources";

// Import tables from shared package
import { user, session, account, verification, type User } from "@ac/auth/schema";

// Re-export tables
export { user, session, account, verification, type User };

// Define relations locally to include app-specific relations
export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    // App specific
    campaigns: many(campaign),
    contacts: many(contact),
    tags: many(tag),
    events: many(event),
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
