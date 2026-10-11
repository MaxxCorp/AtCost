<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import MenuForm from "#lib/components/menus/MenuForm.svelte";
    import { readMenu } from "./read.remote";
    import { updateMenu } from "./update.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { listRecipes } from "../../recipes/list.remote";
    import { updateMenuSchema } from "@ac/validations";
    import { page } from "$app/state";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import { Tag } from "@lucide/svelte";

    const id = $derived(page.params.id || '');
    const menuQuery = $derived(readMenu(id));
    const consumablesQuery = listConsumables({ limit: 200 });
    const recipesQuery = listRecipes({ limit: 200 });

    const menu = $derived(menuQuery.current);
    const consumables = $derived(consumablesQuery.current?.data ?? []);
    const recipes = $derived(recipesQuery.current?.data ?? []);
    const isLoading = $derived(menuQuery.loading || consumablesQuery.loading || recipesQuery.loading);
</script>

<div class="container mx-auto px-4 py-6 max-w-5xl space-y-6">
    {#if isLoading && !menu}
        <LoadingSection message={m.loading_item?.({ item: m.menu?.() || 'Price List' }) || 'Loading price list...'} />
    {:else if menuQuery.error}
        <ErrorSection
            headline={m.error?.() || 'Error'}
            message={menuQuery.error instanceof Error ? menuQuery.error.message : 'Failed to load price list'}
            href="/menus"
            button={m.back_to_feature?.({ feature: m.menus?.() || 'Prices' }) || 'Back to Prices'}
        />
    {:else if menu}
        <Breadcrumb feature="menus" current={menu.name} />

        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <Tag size={28} class="text-violet-600" />
                {m.edit_item_label?.({ item: menu.name }) || `Edit ${menu.name}`}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                {m.feature_menus_description?.() || 'Aggregate consumables and recipes into price lists and templates.'}
            </p>
        </div>

        <MenuForm
            remoteFunction={updateMenu}
            validationSchema={updateMenuSchema}
            isUpdating={true}
            initialData={menu}
            allConsumables={consumables}
            allRecipes={recipes}
            cancelHref="/menus"
        />
    {:else}
        <ErrorSection
            headline={m.item_not_found?.({ item: m.menu?.() || 'Price List' }) || 'Price list not found'}
            message="The requested price list could not be found."
            href="/menus"
            button={m.back_to_feature?.({ feature: m.menus?.() || 'Prices' }) || 'Back to Prices'}
        />
    {/if}
</div>
