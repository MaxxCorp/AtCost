<script lang="ts">
    import { getMyTalentProfile } from "../talents/talents.remote";
    import { goto } from "$app/navigation";
    import { LoadingSection } from "@ac/ui";

    // Call the query factory synchronously during component initialization
    const profilePromise = getMyTalentProfile();
</script>

{#await profilePromise}
    <div class="min-h-[50vh] flex items-center justify-center">
        <LoadingSection />
    </div>
{:then profile}
    {#if profile?.id}
        <!-- Redirect on the client once the profile is loaded -->
        {@const _ = goto(`/talents/${profile.id}/view`)}
    {:else}
        <!-- Handle no profile state -->
        {@const _ = goto("/?error=no_talent_profile")}
    {/if}
{/await}
