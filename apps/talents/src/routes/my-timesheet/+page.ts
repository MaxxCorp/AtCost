import { getMyTalentProfile } from "../talents/talents.remote";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
    // Await the profile to ensure we pass raw data through the serialization boundary.
    // This avoids issues with Proxy serialization/hydration.
    const profile = await (getMyTalentProfile as any)();
    return { profile };
};
