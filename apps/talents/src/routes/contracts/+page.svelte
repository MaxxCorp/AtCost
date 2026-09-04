<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { FileText } from "@lucide/svelte";
    import { EntityManager } from "@ac/ui";
    import ContractForm from "./ContractForm.svelte";
    import { listContracts, readContract, createContract, updateContract, deleteContract } from "./contracts.remote";
    import { listTalents } from "../talents/list.remote";
    import { listContractFrameworks } from "../contract-frameworks/frameworks.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { contractSchema } from "@ac/validations/contracts";

    breadcrumbState.set({ feature: "contracts" });
</script>

<div class="space-y-6">
    <h1 class="text-2xl font-black text-gray-900 px-1">{m.contracts ? m.contracts() : "Contracts"}</h1>
    <EntityManager
        title={m.contracts ? m.contracts() : "Contracts"}
        icon={FileText}
        mode="standalone"
        listItemsRemote={listContracts as any}
        filterAssociations={[
            {
                id: "talentId",
                label: m.talent ? m.talent() : "Talent",
                listRemote: listTalents as any,
                getOptionLabel: (t: any) => t.contact?.displayName,
            },
            {
                id: "frameworkId",
                label: m.framework ? m.framework() : "Framework",
                listRemote: listContractFrameworks as any,
                getOptionLabel: (f: any) => f.name,
            }
        ]}
        deleteItemRemote={deleteContract}
        createHref="/contracts/new"
        createLabel={m.create_contract ? m.create_contract() : "Create Contract"}
        createRemote={createContract}
        createSchema={contractSchema}
        updateRemote={updateContract}
        updateSchema={contractSchema}
        readItemRemote={(id: string) => readContract({ id })}
        searchPredicate={(c: any, q: any) => {
            return (c.entgeltgruppe?.toLowerCase() || '').includes(q.toLowerCase());
        }}
    >
        {#snippet renderItemLabel(c: any)}
            <div class="flex flex-col">
                <span class="font-medium">Contract (Talent: {c.talentId})</span>
                <span class="text-xs text-gray-500 truncate">
                    {c.wageType} · {c.entgeltgruppe ? `Group: ${c.entgeltgruppe}` : (m.no_group ? m.no_group() : 'No group')} · {c.erfahrungsstufe ? (m.level ? m.level({ level: c.erfahrungsstufe }) : `Level: ${c.erfahrungsstufe}`) : ''}
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
