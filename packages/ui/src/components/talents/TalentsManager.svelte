<script lang="ts">
    import { Briefcase } from "@lucide/svelte";
    import EntityManager from "../EntityManager.svelte";
    import TalentForm from "./TalentForm.svelte";

    interface Props {
        userId: string;
        listTalentsRemote: () => Promise<any[]>;
        fetchAssociationsRemote: any;
        addAssociationRemote: any;
        removeAssociationRemote: any;
        deleteItemRemote?: (ids: string[]) => Promise<any>;
        createRemote?: any;
        createSchema?: any;
        updateRemote?: any;
        updateSchema?: any;
    }

    let {
        userId,
        listTalentsRemote,
        fetchAssociationsRemote,
        addAssociationRemote,
        removeAssociationRemote,
        deleteItemRemote,
        createRemote,
        createSchema,
        updateRemote,
        updateSchema,
    }: Props = $props();
</script>

<div class="mt-8 pt-8 border-t border-gray-100">
    <EntityManager
        title="Associated Talents"
        icon={Briefcase}
        type="user"
        entityId={userId}
        listItemsRemote={listTalentsRemote}
        fetchAssociationsRemote={fetchAssociationsRemote}
        addAssociationRemote={addAssociationRemote}
        removeAssociationRemote={removeAssociationRemote}
        deleteItemRemote={deleteItemRemote}
        createRemote={createRemote}
        createSchema={createSchema}
        updateRemote={updateRemote}
        updateSchema={updateSchema}
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
        searchPredicate={(t: any, q: string) => {
            const name = (t.contact?.displayName || t.jobTitle || "").toLowerCase();
            return name.includes(q.toLowerCase());
        }}
    >
        {#snippet renderItemLabel(talent)}
            <div class="flex flex-col">
                <span class="font-medium text-sm">{talent.contact?.displayName || 'Unknown Talent'}</span>
                {#if talent.jobTitle}
                    <span class="text-xs text-gray-500">{talent.jobTitle}</span>
                {/if}
            </div>
        {/snippet}
        
        {#snippet renderItemBadge(talent)}
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                {talent.status === 'active' ? 'bg-green-100 text-green-700' : 
                 talent.status === 'applicant' ? 'bg-blue-100 text-blue-700' : 
                 'bg-gray-100 text-gray-700'}">
                {talent.status}
            </span>
        {/snippet}

        {#snippet renderForm({ remoteFunction: rf, schema, id, initialData, onSuccess, onCancel })}
            <TalentForm
                remoteFunction={rf}
                schema={schema}
                id={id}
                initialData={initialData}
                onSuccess={onSuccess as any}
                onCancel={onCancel}
            />
        {/snippet}
    </EntityManager>
</div>
