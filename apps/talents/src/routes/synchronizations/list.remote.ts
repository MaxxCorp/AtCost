import { query } from "$app/server";
import * as v from "valibot";
import { getOptionalUser } from "#lib/server/authorization.js";
import { ensureDefaultTalentSyncConfigs } from "#lib/server/sync/talent-sync.js";

export const list = query(v.optional(v.object({}), {}), async () => {
    const user = getOptionalUser();
    const configs = await ensureDefaultTalentSyncConfigs(user?.id || "system");
    return {
        data: configs.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
            nextSyncAt: c.nextSyncAt?.toISOString() ?? null,
        })),
        total: configs.length,
    };
});

