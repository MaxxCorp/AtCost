<script lang="ts">
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import * as m from "$lib/paraglide/messages";
    import MenuForm from "$lib/components/menus/MenuForm.svelte";
    import { readMenu } from "./read.remote";
    import { updateMenu } from "./update.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { listRecipes } from "../../recipes/list.remote";
    import { updateMenuSchema } from "@ac/validations";
    import { page } from "$app/state";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import { Utensils } from "@lucide/svelte";

    const id = $derived(page.params.id || '');
    const dataPromise = $derived(
        Promise.all([
            readMenu(id),
            listConsumables({ limit: 200 }),
            listRecipes({ limit: 200 })
        ])
    );
</script>

<div class="container mx-auto px-4 py-6 max-w-5xl space-y-6">
    {#await dataPromise}
        <LoadingSection message={m.loading_item?.({ item: m.menu?.() || 'Menu' }) || 'Loading menu...'} />
    {:then [menu, consumablesResult, recipesResult]}
        {#if menu}
            <Breadcrumb feature="menus" current={menu.name} />

            <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                    <Utensils size={28} class="text-violet-600" />
                    {m.edit_item_label?.({ item: menu.name }) || `Edit ${menu.name}`}
                </h1>
                <p class="text-sm text-gray-500 mt-1">
                    Manage menu items, unit prices, and calculate catering costs.
                </p>
            </div>

            <MenuForm
                remoteFunction={updateMenu}
                validationSchema={updateMenuSchema}
                isUpdating={true}
                initialData={menu}
                allConsumables={consumablesResult?.data || []}
                allRecipes={recipesResult?.data || []}
                cancelHref="/menus"
            />
        {:else}
            <ErrorSection
                headline={m.item_not_found?.({ item: m.menu?.() || 'Menu' }) || 'Menu not found'}
                message="The requested menu could not be found."
                href="/menus"
                button={m.back_to_feature?.({ feature: m.menus?.() || 'Menus' }) || 'Back to Menus'}
            />
        {/if}
    {:catch error}
        <ErrorSection
            headline={m.error?.() || 'Error'}
            message={error.message || 'Failed to load menu'}
            href="/menus"
            button={m.back_to_feature?.({ feature: m.menus?.() || 'Menus' }) || 'Back to Menus'}
        />
    {/await}
</div>
