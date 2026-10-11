<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import PriceForm from "#lib/components/prices/PriceForm.svelte";
    import { readPrice } from "./read.remote";
    import { updatePrice } from "./update.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { listRecipes } from "../../recipes/list.remote";
    import { updatePriceSchema } from "@ac/validations";
    import { page } from "$app/state";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import { Tag } from "@lucide/svelte";

    const id = $derived(page.params.id || '');
    const priceQuery = $derived(readPrice(id));
    const consumablesQuery = listConsumables({ limit: 200 });
    const recipesQuery = listRecipes({ limit: 200 });

    const priceList = $derived(priceQuery.current);
    const consumables = $derived(consumablesQuery.current?.data ?? []);
    const recipes = $derived(recipesQuery.current?.data ?? []);
    const isLoading = $derived(priceQuery.loading || consumablesQuery.loading || recipesQuery.loading);
</script>

<div class="container mx-auto px-4 py-6 max-w-5xl space-y-6">
    {#if isLoading && !priceList}
        <LoadingSection message={m.loading_item?.({ item: m.price_list?.() || 'Price List' }) || 'Loading price list...'} />
    {:else if priceQuery.error}
        <ErrorSection
            headline={m.error?.() || 'Error'}
            message={priceQuery.error instanceof Error ? priceQuery.error.message : 'Failed to load price list'}
            href="/prices"
            button={m.back_to_feature?.({ feature: m.prices?.() || 'Prices' }) || 'Back to Prices'}
        />
    {:else if priceList}
        <Breadcrumb feature="prices" current={priceList.name} />

        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <Tag size={28} class="text-violet-600" />
                {m.edit_item_label?.({ item: priceList.name }) || `Edit ${priceList.name}`}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                {m.feature_prices_description?.() || 'Aggregate consumables and recipes into price lists and templates.'}
            </p>
        </div>

        <PriceForm
            remoteFunction={updatePrice}
            validationSchema={updatePriceSchema}
            isUpdating={true}
            initialData={priceList}
            allConsumables={consumables}
            allRecipes={recipes}
            cancelHref="/prices"
        />
    {:else}
        <ErrorSection
            headline={m.item_not_found?.({ item: m.price_list?.() || 'Price List' }) || 'Price list not found'}
            message="The requested price list could not be found."
            href="/prices"
            button={m.back_to_feature?.({ feature: m.prices?.() || 'Prices' }) || 'Back to Prices'}
        />
    {/if}
</div>
