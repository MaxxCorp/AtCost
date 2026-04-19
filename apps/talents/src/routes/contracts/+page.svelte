<script lang="ts">
    import { FileText } from "@lucide/svelte";
    import EntityManager from "@ac/ui/components/EntityManager.svelte";
    import ContractForm from "./ContractForm.svelte";
    import { listContracts, createContract, updateContract, deleteContract } from "./contracts.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { contractSchema } from "@ac/validations/contracts";

    breadcrumbState.set({ feature: "contracts" });
</script>

<div class="space-y-6">
    <EntityManager
        title="Contracts"
        icon={FileText}
        mode="standalone"
        listItemsRemote={listContracts}
        deleteItemRemote={deleteContract}
        createHref="/contracts/new"
        createLabel="Create Contract"
        createRemote={createContract}
        createSchema={contractSchema}
        updateRemote={updateContract}
        updateSchema={contractSchema}
        getFormData={(c: any) => c}
        searchPredicate={(c: any, q: any) => {
            return (c.entgeltgruppe?.toLowerCase() || '').includes(q.toLowerCase());
        }}
    >
        {#snippet renderItemLabel(c: any)}
            <div class="flex flex-col">
                <span class="font-medium">Contract (Talent: {c.talentId})</span>
                <span class="text-xs text-gray-500 truncate">
                    {c.wageType} · {c.entgeltgruppe ? `Group: ${c.entgeltgruppe}` : 'No group'} · {c.erfahrungsstufe ? `Level: ${c.erfahrungsstufe}` : ''}
                </span>
            </div>
        {/snippet}

        {#snippet renderForm({ remoteFunction, schema, initialData, onSuccess, onCancel, id }: any)}
            <ContractForm
                {remoteFunction}
                validationSchema={schema}
                isUpdating={!!id}
                {initialData}
                {onSuccess}
                {onCancel}
            />
        {/snippet}
    </EntityManager>
</div>
