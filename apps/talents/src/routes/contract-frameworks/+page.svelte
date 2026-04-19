<script lang="ts">
    import { FileSignature } from "@lucide/svelte";
    import EntityManager from "@ac/ui/components/EntityManager.svelte";
    import ContractFrameworkForm from "./ContractFrameworkForm.svelte";
    import { listContractFrameworks, createContractFramework, updateContractFramework, deleteContractFramework } from "./frameworks.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { contractFrameworkSchema } from "@ac/validations/contracts";

    breadcrumbState.set({ feature: "contract-frameworks" });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Contract Frameworks</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage base union contracts and governing frameworks (e.g., German Law, AWO Berlin).
            </p>
        </div>
    </div>

    <EntityManager
        title="Contract Frameworks"
        icon={FileSignature}
        mode="standalone"
        listItemsRemote={listContractFrameworks}
        deleteItemRemote={deleteContractFramework}
        createRemote={createContractFramework}
        createSchema={contractFrameworkSchema}
        updateRemote={updateContractFramework}
        updateSchema={contractFrameworkSchema}
        getFormData={(fw: any) => fw}
        searchPredicate={(fw: any, q: any) => {
            return fw.name.toLowerCase().includes(q.toLowerCase());
        }}
    >
        {#snippet renderItemLabel(fw: any)}
            <div class="flex flex-col">
                <span class="font-medium">{fw.name}</span>
                <span class="text-xs text-gray-500 truncate">{fw.description || "No description"}</span>
            </div>
        {/snippet}

        {#snippet renderForm({ remoteFunction, schema, initialData, onSuccess, onCancel, id }: any)}
            <ContractFrameworkForm
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
