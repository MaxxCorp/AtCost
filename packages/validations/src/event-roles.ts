import * as v from 'valibot';
import { PaginationSchema } from './pagination.js';

export const EVENT_ROLE_MAIN_CONTACT = 'Main Contact';
export const EVENT_ROLE_PROJECT_MANAGER = 'Project Manager';
export const EVENT_ROLE_PARTICIPANT = 'Participant';

export const EventRoleSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    color: v.optional(v.string(), 'blue'),
    description: v.optional(v.nullable(v.string())),
    isDefault: v.optional(v.boolean(), false),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
});

export type EventRole = v.InferOutput<typeof EventRoleSchema>;

export const eventRolePaginationSchema = v.optional(
    v.intersect([
        PaginationSchema,
        v.object({
            search: v.optional(v.string()),
        })
    ]),
    {}
);

export const createEventRoleSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    color: v.optional(v.string(), 'blue'),
    description: v.optional(v.nullable(v.string())),
});

export const updateEventRoleSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    color: v.optional(v.string(), 'blue'),
    description: v.optional(v.nullable(v.string())),
});

export const updateContactRolesSchema = v.object({
    eventId: v.string(),
    contactId: v.pipe(v.string(), v.uuid()),
    roleIds: v.array(v.pipe(v.string(), v.uuid())),
});

export type UpdateContactRolesInput = v.InferOutput<typeof updateContactRolesSchema>;
