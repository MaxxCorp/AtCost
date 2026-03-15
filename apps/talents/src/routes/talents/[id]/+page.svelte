<script lang="ts">
    import { page } from "$app/state";
    import ContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import { TalentTimeline } from "@ac/ui";
    import { readTalent, addTimelineEntry, listEmployees, listTalents } from "../talents.remote";
    import { updateExistingContact } from "./update.remote";
    import { updateContactSchema } from "@ac/validations/contacts";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    const id = $derived(page.params.id as string);
    const talentQuery = $derived(readTalent(id) as any);
    const employeeQuery = $derived(listEmployees() as any);

    $effect(() => {
        const data = talentQuery.data;
        if (data?.contact) {
            breadcrumbState.set({
                feature: "talents",
                current: `Edit: ${data.contact.displayName}`,
            });
        }
    });

    const initialData = $derived(
        talentQuery.data
            ? {
                  contact: talentQuery.data.contact,
                  emails: talentQuery.data.contact.emails,
                  phones: talentQuery.data.contact.phones,
                  addresses: talentQuery.data.contact.addresses,
                  relations: talentQuery.data.contact.relations,
                  tags: talentQuery.data.contact.tags,
              }
            : null,
    );
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#if talentQuery.pending}
        <LoadingSection message="Loading talent details..." />
    {:else if talentQuery.data}
        <div class="mb-8 flex justify-between items-start">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 line-clamp-1">
                    {talentQuery.data.contact.displayName}
                </h1>
                <p class="text-gray-500 mt-2">
                    Talent Profile & Recruitment History
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-8">
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <h2 class="text-lg font-semibold mb-6">Contact Information</h2>
                    <ContactForm
                        remoteFunction={updateExistingContact}
                        schema={updateContactSchema}
                        {initialData}
                        contactId={talentQuery.data.contactId}
                        cancelHref="/talents"
                        listContactsRemote={listTalents}
                    />
                </div>
            </div>

            <div class="space-y-8">
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <TalentTimeline 
                        talentId={talentQuery.data.id}
                        entries={talentQuery.data.timelineEntries || []}
                        employees={employeeQuery.data || []}
                        onAddEntry={async (entry) => {
                            await (addTimelineEntry as any)({ talentId: talentQuery.data.id, entry });
                        }}
                    />
                </div>
            </div>
        </div>
    {:else}
        <div class="text-center py-12">
            <h2 class="text-xl font-semibold text-gray-900">
                Talent not found
            </h2>
            <p class="text-gray-500 mt-2">
                The talent you're looking for doesn't exist.
            </p>
            <a
                href="/talents"
                class="text-blue-600 hover:underline mt-4 inline-block"
                >Back to list</a
            >
        </div>
    {/if}
</div>
