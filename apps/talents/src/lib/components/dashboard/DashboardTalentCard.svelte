<script lang="ts">
    import { User, Edit, Briefcase, Calendar } from "@lucide/svelte";
    import { Button } from "@ac/ui/components/button";

    let { talent } = $props<{ talent: any }>();

    const displayName = $derived(
        talent?.contact?.displayName || 
        `${talent?.contact?.givenName || ""} ${talent?.contact?.familyName || ""}`.trim() || 
        "Unknown Talent"
    );
</script>

<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
    <div class="p-6 bg-gradient-to-br from-indigo-50/50 to-white flex-1">
        <div class="flex justify-between items-start mb-6">
            <div class="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <User size={24} />
            </div>
            <Button variant="outline" size="sm" href={`/talents/${talent?.id}`} class="gap-2">
                <Edit size={14} />
                Edit Profile
            </Button>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mb-1">{displayName}</h2>
        <p class="text-indigo-600 font-medium text-sm mb-6">{talent?.jobTitle || "No Job Title"}</p>

        <div class="space-y-4">
            <div class="flex items-center gap-3 text-sm text-gray-600">
                <Briefcase size={16} class="text-gray-400" />
                <span>Status: <span class="font-semibold text-gray-900 capitalize">{talent?.status}</span></span>
            </div>
            <div class="flex items-center gap-3 text-sm text-gray-600">
                <Calendar size={16} class="text-gray-400" />
                <span>Onboarding: <span class="font-semibold text-gray-900">{talent?.onboardingStatus || "N/A"}</span></span>
            </div>
        </div>
    </div>
    
    {#if talent?.contact?.emails?.length > 0}
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 truncate">
            {talent.contact.emails[0].email}
        </div>
    {/if}
</div>
