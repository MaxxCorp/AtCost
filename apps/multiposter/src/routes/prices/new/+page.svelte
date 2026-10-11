<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import PriceForm from "#lib/components/prices/PriceForm.svelte";
    import { createPrice } from "./create.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { listRecipes } from "../../recipes/list.remote";
    import { createPriceSchema } from "@ac/validations";
    import { Tag } from "@lucide/svelte";
    import { LoadingSection } from "@ac/ui";

    const consumablesQuery = listConsumables({ limit: 200 });
    const recipesQuery = listRecipes({ limit: 200 });

    const consumables = $derived(consumablesQuery.current?.data ?? []);
    const recipes = $derived(recipesQuery.current?.data ?? []);
    const isLoading = $derived(consumablesQuery.loading || recipesQuery.loading);
</script>

<div class="container mx-auto px-4 py-6 max-w-5xl space-y-6">
    <Breadcrumb feature="prices" current={m.create_item_label?.({ item: m.price_list?.() || 'Price List' }) || 'New Price List'} />

    <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Tag size={28} class="text-violet-600" />
            {m.create_item_label?.({ item: m.price_list?.() || 'Price List' }) || 'New Price List'}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
            {m.feature_prices_description?.() || 'Aggregate consumables and recipes into price lists and templates.'}
        </p>
    </div>

    {#if isLoading && !consumablesQuery.current && !recipesQuery.current}
        <LoadingSection message="Loading items..." />
    {:else}
        <PriceForm
            remoteFunction={createPrice}
            validationSchema={createPriceSchema}
            isUpdating={false}
            allConsumables={consumables}
            allRecipes={recipes}
            cancelHref="/prices"
        />
    {/if}
</div>
