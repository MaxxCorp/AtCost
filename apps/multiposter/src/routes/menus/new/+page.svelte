<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import MenuForm from "#lib/components/menus/MenuForm.svelte";
    import { createMenu } from "./create.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { listRecipes } from "../../recipes/list.remote";
    import { createMenuSchema } from "@ac/validations";
    import { Tag } from "@lucide/svelte";
    import { LoadingSection } from "@ac/ui";

    const consumablesQuery = listConsumables({ limit: 200 });
    const recipesQuery = listRecipes({ limit: 200 });

    const consumables = $derived(consumablesQuery.current?.data ?? []);
    const recipes = $derived(recipesQuery.current?.data ?? []);
    const isLoading = $derived(consumablesQuery.loading || recipesQuery.loading);
</script>

<div class="container mx-auto px-4 py-6 max-w-5xl space-y-6">
    <Breadcrumb feature="menus" current={m.create_item_label?.({ item: m.menu?.() || 'Price List' }) || 'New Price List'} />

    <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Tag size={28} class="text-violet-600" />
            {m.create_item_label?.({ item: m.menu?.() || 'Price List' }) || 'New Price List'}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
            {m.feature_menus_description?.() || 'Aggregate consumables and recipes into price lists and templates.'}
        </p>
    </div>

    {#if isLoading && !consumablesQuery.current && !recipesQuery.current}
        <LoadingSection message="Loading items..." />
    {:else}
        <MenuForm
            remoteFunction={createMenu}
            validationSchema={createMenuSchema}
            isUpdating={false}
            allConsumables={consumables}
            allRecipes={recipes}
            cancelHref="/menus"
        />
    {/if}
</div>
