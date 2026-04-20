<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { Users } from "@lucide/svelte";
    import { EntityManager } from "@ac/ui";
    import TalentForm from "$lib/components/talent/TalentForm.svelte";
    import { page } from "$app/state";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { updateLocationSchema } from "@ac/validations/locations";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { listTalents } from "../../talents/list.remote";
    import { getEntityTalents, associateTalent, dissociateTalent } from "../../talents/associate.remote";
    import { deleteTalent } from "../../talents/[id]/delete.remote";
    import { createTalent } from "../../talents/new/create.remote";
    import { updateTalent } from "../../talents/[id]/update.remote";
    import { listTags } from "../../talents/talents.remote";
    import { listLocations } from "../list.remote";
    import { createTalentSchema, updateTalentSchema } from "@ac/validations/talents";
    import { handleDelete } from "@ac/ui";

    const id = $derived(page.params.id as string);

    // Initialize query in script setup for correct reactive context
    let locationQuery = $state(readLocation(page.params.id as string) as any);
    
    // Update query when ID changes
    $effect(() => {
        locationQuery = readLocation(id) as any;
    });

    $effect(() => {
        if (locationQuery.data) {
            breadcrumbState.set({
                feature: "locations",
                current: `Edit: ${locationQuery.data.name}`,
            });
        }
    });
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#if locationQuery.pending}
        <LoadingSection message="Loading location details..." />
    {:else if locationQuery.data}
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 line-clamp-1">
                {locationQuery.data.name}
            </h1>
            <p class="text-gray-500 mt-2">
                Update location details and settings
            </p>
        </div>

        <div
            class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8"
        >
            <LocationForm
                remoteFunction={updateLocation}
                validationSchema={updateLocationSchema}
                initialData={locationQuery.data}
                isUpdating={true}
                cancelHref="/locations"
            >
                {#snippet children()}
                    <div class="mt-8 pt-8 border-t border-gray-100">
                        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                            <Users size={20} class="text-indigo-500" />
                            {m.talents()}
                        </h3>
                        <EntityManager
                            title="Associated Talents"
                            icon={Users}
                            mode="embedded"
                            type="location"
                            entityId={id}
                            listItemsRemote={listTalents}
                            fetchAssociationsRemote={getEntityTalents}
                            addAssociationRemote={async (p: any) => associateTalent({ ...p, talentId: p.itemId } as any)}
                            removeAssociationRemote={async (p: any) => dissociateTalent({ ...p, talentId: p.itemId } as any)}
                            filterAssociations={[
                                {
                                    id: "locationId",
                                    label: "Locations",
                                    listRemote: listLocations as any,
                                    getOptionLabel: (l: any) => l.name,
                                },
                                {
                                    id: "tagId",
                                    label: "Tags",
                                    listRemote: listTags as any,
                                    getOptionLabel: (t: any) => t.name,
                                },
                            ]}
                            filters={[
                                {
                                    id: "status",
                                    label: "Status",
                                    type: "select",
                                    options: [
                                        { value: "active", label: "Active" },
                                        { value: "applicant", label: "Applicant" },
                                        { value: "inactive", label: "Inactive" },
                                    ],
                                    optionsRemote: async () => [],
                                }
                            ]}
                            searchPredicate={(t: any, q: string) => {
                                const name = (t.contact?.displayName || t.jobTitle || "").toLowerCase();
                                return name.includes(q.toLowerCase());
                            }}
                            deleteItemRemote={async (ids: string[]) => {
                                return await handleDelete({
                                    ids,
                                    deleteFn: async (targetIds: string[]) => {
                                        for (const tid of targetIds) {
                                            await deleteTalent(tid);
                                        }
                                        return { success: true };
                                    },
                                    itemName: "talent"
                                });
                            }}
                            createRemote={createTalent}
                            createSchema={createTalentSchema}
                            updateRemote={updateTalent}
                            updateSchema={updateTalentSchema}
                            getFormData={(t: any) => ({
                                id: t.id,
                                data: {
                                    jobTitle: t.jobTitle,
                                    status: t.status,
                                    salaryExpectation: t.salaryExpectation,
                                    availabilityDate: t.availabilityDate,
                                    onboardingStatus: t.onboardingStatus,
                                    resumeUrl: t.resumeUrl,
                                    source: t.source,
                                    internalNotes: t.internalNotes,
                                }
                            })}
                        >
                            {#snippet renderItemLabel(talent)}
                                <div class="flex flex-col">
                                    <span class="font-bold text-sm tracking-tight text-gray-900">{talent.contact?.displayName || 'Unknown Talent'}</span>
                                    {#if talent.jobTitle}
                                        <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-0.5">{talent.jobTitle}</span>
                                    {/if}
                                </div>
                            {/snippet}
                            
                            {#snippet renderItemBadge(talent)}
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-100
                                    {talent.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 
                                     talent.status === 'applicant' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                     'bg-gray-50 text-gray-600 border-gray-100'}">
                                    {talent.status}
                                </span>
                            {/snippet}

                            {#snippet renderForm({ remoteFunction: rf, id, initialData, onSuccess, onCancel })}
                                <TalentForm
                                    remoteFunction={rf}
                                    talentId={id}
                                    initialData={initialData}
                                    onSuccess={onSuccess as any}
                                    onCancel={onCancel}
                                />
                            {/snippet}
                        </EntityManager>
                    </div>
                {/snippet}
            </LocationForm>
        </div>
    {:else}
        <div class="text-center py-24 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
            <h2 class="text-xl font-black text-gray-900 uppercase tracking-tighter">
                Location not found
            </h2>
            <p class="text-gray-500 mt-2 font-medium">
                The location you're looking for doesn't exist.
            </p>
            <a
                href="/locations"
                class="text-blue-600 font-bold hover:underline mt-6 inline-block"
                >Back to list view</a
            >
        </div>
    {/if}
</div>

