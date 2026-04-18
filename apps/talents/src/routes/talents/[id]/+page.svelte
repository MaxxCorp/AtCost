<script lang="ts">
    import { page } from "$app/state";
    import { LoadingSection, ErrorSection, TalentTimeline, Button } from "@ac/ui";
    import { Calendar, ArrowLeft, ExternalLink } from "@lucide/svelte";
    import { 
        readTalent, 
        invokeAddTimelineEntry, 
        listEmployees 
    } from '../talents.remote';
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import TalentForm from "$lib/components/talent/TalentForm.svelte";

    const talentIdParam = $derived(page.params.id as string);
    
    // Remote functions return Promises, so we track it with $derived
    const talentPromise = $derived(readTalent(talentIdParam));
    
    $effect(() => {
        talentPromise.then(talent => {
            if (talent?.contact) {
                breadcrumbState.set({
                    feature: "talents",
                    current: `Edit: ${talent.contact.displayName}`,
                });
            }
        });
    });

    const employees = $derived(listEmployees() as any);
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#await talentPromise}
        <LoadingSection message="Loading talent details..." />
    {:then talent}
        {#if talent}
            <div class="mb-6">
                <a
                    href="/talents"
                    class="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                >
                    <ArrowLeft size={16} class="mr-1" />
                    Back to Talents
                </a>
                <div class="flex items-center justify-between">
                    <h1 class="text-3xl font-bold text-gray-900 tracking-tight">
                        Edit Talent Profile
                    </h1>
                    <div class="flex gap-2">
                        <a href="/talents/{talentIdParam}/view">
                            <Button variant="outline" size="sm">
                                <ExternalLink size={16} class="mr-2" />
                                View Public Profile
                            </Button>
                        </a>
                    </div>
                </div>
            </div>

            <div class="space-y-8">
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <TalentForm
                        initialData={talent}
                        talentId={talentIdParam}
                    />
                </div>

                <div class="pt-8 border-t border-gray-100">
                    <h2 class="text-xl font-bold text-gray-900 mb-6">
                        Talent Timeline
                    </h2>
                    <TalentTimeline 
                        talentId={talentIdParam}
                        entries={(talent.timelineEntries || []) as any}
                        {employees}
                        onAddEntry={async (entry: any) => {
                            await invokeAddTimelineEntry({
                                talentId: talentIdParam,
                                entry
                            });
                            // No need for refresh logic as Svelte 5 will re-derive when needed
                            // or the page could be refreshed.
                        }}
                    />
                </div>
            </div>
        {:else}
            <div
                class="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
            >
                <h2 class="text-2xl font-bold text-gray-900">
                    Talent not found
                </h2>
                <p class="text-gray-500 mt-2">
                    The talent profile you are looking for does not exist.
                </p>
                <a
                    href="/talents"
                    class="mt-6 inline-block text-indigo-600 font-semibold hover:underline"
                >
                    Return to Talent List
                </a>
            </div>
        {/if}
    {:catch error}
        <ErrorSection headline="Error loading talent" message={error.message} />
    {/await}
</div>
