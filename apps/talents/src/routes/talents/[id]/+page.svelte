<script lang="ts">
    import { page } from "$app/state";
    import { LoadingSection, TalentTimeline, Button } from "@ac/ui";
    import { Calendar } from "@lucide/svelte";
    import { readTalent, addTimelineEntry, listEmployees, listTalents } from "../talents.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import TalentForm from "$lib/components/talent/TalentForm.svelte";

    const id = $derived(page.params.id as string);
    const talentQuery = $derived(readTalent(id) as any);
    const employeeQuery = $derived(listEmployees() as any);

    $effect(() => {
        const data = talentQuery.data;
        if (data?.contact) {
            breadcrumbState.set({
                feature: "talents",
                current: `${data.contact.displayName}`,
            });
        }
    });

    const initialData = $derived(talentQuery.data);
</script>

<div class="max-w-6xl mx-auto px-4 py-8">
    {#if talentQuery.pending}
        <LoadingSection message="Loading talent details..." />
    {:else if talentQuery.data}
        <div class="mb-8 flex justify-between items-end border-b border-gray-100 pb-6">
            <div>
                <h1 class="text-4xl font-black text-gray-900 tracking-tight">
                    {talentQuery.data.contact.displayName}
                </h1>
                <p class="text-gray-500 mt-2 font-medium">
                    {talentQuery.data.jobTitle || "No title set"} • <span class="uppercase text-indigo-600 text-xs font-bold">{talentQuery.data.status}</span>
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div class="xl:col-span-2">
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <TalentForm
                        {initialData}
                        talentId={id}
                        cancelHref="/talents"
                        listContactsRemote={listTalents}
                    />
                </div>
            </div>

            <div class="space-y-8">
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 class="text-lg font-bold mb-6 flex items-center gap-2">
                        <Calendar size={20} class="text-indigo-500" />
                        Recruitment Timeline
                    </h3>
                    <TalentTimeline 
                        talentId={talentQuery.data.id}
                        entries={talentQuery.data.timelineEntries || []}
                        employees={employeeQuery.data || []}
                        onAddEntry={async (entry: any) => {
                            await (addTimelineEntry as any)({ talentId: talentQuery.data.id, entry });
                        }}
                    />
                </div>
            </div>
        </div>
    {:else}
        <div class="text-center py-20">
            <h2 class="text-2xl font-bold text-gray-900">Talent not found</h2>
            <p class="text-gray-500 mt-2">The talent profile you are looking for does not exist.</p>
            <Button href="/talents" variant="outline" class="mt-6">Back to Talents</Button>
        </div>
    {/if}
</div>
