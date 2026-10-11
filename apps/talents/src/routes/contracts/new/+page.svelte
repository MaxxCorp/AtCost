<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import ContractForm from "../ContractForm.svelte";
    import { createContract } from "./create.remote";
    import { contractSchema } from "@ac/validations/contracts";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";

    breadcrumbState.set({
        feature: "contracts",
        current: m.create_contract ? m.create_contract() : "Create Contract"
    });
</script>

<div class="max-w-4xl mx-auto space-y-6">
    <div class="space-y-1">
        <h1 class="text-2xl font-black text-gray-900">
            {m.create_contract ? m.create_contract() : "Create Contract"}
        </h1>
        <p class="text-sm text-gray-500">
            {m.contract_description()}
        </p>
    </div>

    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <ContractForm
            remoteFunction={createContract}
            validationSchema={contractSchema}
            cancelHref="/contracts"
        />
    </div>
</div>
