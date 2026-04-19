import * as v from 'valibot';
import { type User as DbUser } from '@ac/db';

export const userBaseSchema = v.object({
    id: v.pipe(v.string()),
    email: v.pipe(v.string(), v.email()),
    name: v.pipe(v.string(), v.minLength(1)),
    roles: v.optional(v.array(v.string())),
    claims: v.optional(v.any()),
});

export const updateUserSchema = v.intersect([
    v.object({ id: v.pipe(v.string()) }),
    v.partial(v.omit(userBaseSchema, ['id']))
]);

export const deleteUserSchema = v.array(v.string());

export type User = Omit<DbUser, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

export const UserPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    role: v.optional(v.union([v.string(), v.array(v.string())])),
}), {});
