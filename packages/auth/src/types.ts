import type { User } from 'better-auth';

export type UserWithRolesAndClaims = User & {
    roles?: string[] | string;
    claims?: Record<string, any> | string;
};
