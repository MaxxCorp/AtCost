import type { Resource as DbResource } from '@ac/db';

export type Resource = DbResource & {
    locationName: string | null;
};
