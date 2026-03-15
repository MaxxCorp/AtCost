<script lang="ts">
    import { User, MapPin, Calendar, Clock } from "@lucide/svelte";
    import EntityManager from "@ac/ui/components/EntityManager.svelte";
    import ContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import { listTalents, addTimelineEntry, listEmployees, createTalent } from "./talents.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { createContactSchema } from "@ac/validations/contacts";
    import { createTalentSchema } from "@ac/validations";
    import { TalentTimeline } from "@ac/ui";
    import { format } from "date-fns";

    breadcrumbState.set({ feature: "talents" });

    const searchPredicate = (t: any, q: string) => {
        const query = q.toLowerCase();
        const contact = t.contact || {};
        const displayName = (contact.displayName || "").toLowerCase();
        const email = (contact.emails?.[0]?.value || "").toLowerCase();
        return (
            displayName.includes(query) ||
            email.includes(query)
        );
    };

    const employeeQuery = $derived(listEmployees() as any);
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Talents</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage talent pipeline, recruitment history and contacts
            </p>
        </div>
    </div>

    <EntityManager
        title="Talents"
        icon={User}
        mode="standalone"
        listItemsRemote={listTalents}
        createRemote={async (data: any) => {
            return (createTalent as any)(data);
        }}
        createSchema={createTalentSchema}
        getFormData={(t) => t}
        {searchPredicate}
    >
        {#snippet renderItemLabel(talent)}
            <div class="flex flex-col">
                <span class="font-medium">{talent.contact.displayName}</span>
                <span class="text-xs text-gray-500">
                    {talent.contact.emails?.[0]?.value || "No email"}
                </span>
            </div>
        {/snippet}

        {#snippet renderItemBadge(talent)}
            {#if talent.timelineEntries?.[0]}
                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold uppercase tracking-wider">
                    <Clock size={10} />
                    <span>Last: {talent.timelineEntries[0].type}</span>
                </div>
            {/if}
        {/snippet}

        {#snippet renderItemDetail(talent)}
            <div class="mt-4 pt-4 border-t border-gray-50">
                <TalentTimeline 
                    talentId={talent.id}
                    entries={talent.timelineEntries || []}
                    employees={employeeQuery.data || []}
                    onAddEntry={async (entry) => {
                        await (addTimelineEntry as any)({ talentId: talent.id, entry });
                    }}
                />
            </div>
        {/snippet}

        {#snippet renderForm({ onCancel })}
            <div class="p-6 space-y-4">
                <h2 class="text-xl font-bold">Register New Talent</h2>
                <p class="text-sm text-gray-500">
                    To register a talent, first create or select a contact.
                </p>
                <!-- Simplified for now: in a real app would use ContactManager to pick/create contact -->
                <div class="flex justify-end gap-2">
                    <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" onclick={onCancel}>
                        Cancel
                    </button>
                    <button class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700" onclick={() => alert('Contact Selection logic here')}>
                        Select Contact
                    </button>
                </div>
            </div>
        {/snippet}
    </EntityManager>
</div>
