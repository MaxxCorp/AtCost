<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import ContractForm from "../ContractForm.svelte";
    import { readContract } from "./read.remote";
    import { updateContract } from "./update.remote";
    import { updateContractSchema } from "@ac/validations/contracts";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { page } from "$app/state";
    import { ArrowLeft, Loader2 } from "@lucide/svelte";

    const contractId = $derived(page.params.id as string);
    const contractQuery = $derived(readContract({ id: contractId }));
    const contract = $derived(contractQuery.current ?? null);

    $effect(() => {
        if (contract?.title) {
            breadcrumbState.set({
                feature: "contracts",
                current: contract.title
            });
        } else {
            breadcrumbState.set({
                feature: "contracts",
                current: "Contract Details"
            });
        }
    });
</script>

<div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center gap-4">
        <a
            href="/contracts"
            class="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Zurück zur Übersicht"
        >
            <ArrowLeft class="w-5 h-5" />
        </a>
        <div class="space-y-0.5">
            <h1 class="text-2xl font-black text-gray-900">
                {contract?.title || (m.contracts ? m.contracts() : "Contract Details")}
            </h1>
            <p class="text-xs text-gray-500">
                ID: {contractId}
            </p>
        </div>
    </div>

    {#if contractQuery.loading && !contract}
        <div class="flex items-center justify-center p-12 bg-white rounded-2xl border border-gray-100">
            <Loader2 class="w-6 h-6 animate-spin text-indigo-600" />
            <span class="ml-2 text-sm text-gray-500">Lade Vertragsdetails...</span>
        </div>
    {:else if contractQuery.error}
        <div class="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            Fehler beim Laden des Vertrags: {contractQuery.error.message}
        </div>
    {:else if contract}
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <ContractForm
                remoteFunction={updateContract}
                validationSchema={updateContractSchema}
                isUpdating={true}
                initialData={contract}
                cancelHref="/contracts"
            />
        </div>
    {/if}
</div>
