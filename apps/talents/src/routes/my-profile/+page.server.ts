import { redirect } from "@sveltejs/kit";
import { getMyTalentProfile } from "../talents/talents.remote";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    const profile = await (getMyTalentProfile as any)();
    
    if (profile?.id) {
        throw redirect(303, `/talents/${profile.id}/view`);
    }
    
    // If no profile, we can either redirect to home with a message 
    // or let the page render a "No profile found" state.
    // For now, redirect to home.
    throw redirect(303, "/?error=no_talent_profile");
};
