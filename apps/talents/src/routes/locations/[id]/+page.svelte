<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { Users } from "@lucide/svelte";
    import { LocationDetailView, EntityManager, handleDelete } from "@ac/ui";
    import TalentForm from "#lib/components/talent/TalentForm.svelte";
    import { page } from "$app/state";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { deleteLocation } from "./delete.remote";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { listTalents } from "../../talents/list.remote";
    import { getEntityTalents, associateTalent, dissociateTalent } from "../../talents/associate.remote";
    import { deleteTalent } from "../../talents/[id]/delete.remote";
    import { updateTalent } from "../../talents/[id]/update.remote";
    import { readTalent } from "../../talents/[id]/read.remote";
    import { unifiedTalentSchema, updateLocationSchema } from "@ac/validations";
    import { getTalentFilterGroups } from "#lib/filters/index.js";

    const locationId = $derived(page.params.id as string);
</script>

<LocationDetailView
    {locationId}
    readLocationRemote={readLocation}
    updateLocationRemote={updateLocation}
    deleteLocationRemote={deleteLocation}
    validationSchema={updateLocationSchema}
    cancelHref="/locations"
    {m}
    onLocationLoaded={(loc: any) => {
        breadcrumbState.set({
            feature: "locations",
            current: `Edit: ${loc.name}`,
        });
    }}
>
    {#snippet children({ location }: any)}
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
                entityId={location.id}
                listItemsRemote={listTalents}
                fetchAssociationsRemote={getEntityTalents}
                addAssociationRemote={async (p: any) => associateTalent({ ...p, talentId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) => dissociateTalent({ ...p, talentId: p.itemId } as any)}
                filters={getTalentFilterGroups(m)}
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
                createRemote={updateTalent}
                createSchema={unifiedTalentSchema}
                updateRemote={updateTalent}
                updateSchema={unifiedTalentSchema}
                readItemRemote={readTalent}
            >
                {#snippet renderItemLabel(talent: any)}
                    <div class="flex flex-col">
                        <span class="font-bold text-sm tracking-tight text-gray-900">{talent.contact?.displayName || 'Unknown Talent'}</span>
                        {#if talent.jobTitle}
                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-0.5">{talent.jobTitle}</span>
                        {/if}
                    </div>
                {/snippet}
                
                {#snippet renderItemBadge(talent: any)}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-100
                        {talent.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 
                         talent.status === 'applicant' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                         'bg-gray-50 text-gray-600 border-gray-100'}">
                        {talent.status}
                    </span>
                {/snippet}

                {#snippet renderForm({ remoteFunction: rf, id: talentId, initialData, onSuccess, onCancel }: any)}
                    <TalentForm
                        remoteFunction={rf}
                        talentId={talentId}
                        initialData={initialData}
                        onSuccess={onSuccess as any}
                        onCancel={onCancel}
                    />
                {/snippet}
            </EntityManager>
        </div>
    {/snippet}
</LocationDetailView>
