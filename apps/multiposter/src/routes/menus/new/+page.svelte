<script lang="ts">
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import * as m from "$lib/paraglide/messages";
    import MenuForm from "$lib/components/menus/MenuForm.svelte";
    import { createMenu } from "./create.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { listRecipes } from "../../recipes/list.remote";
    import { createMenuSchema } from "@ac/validations";
    import { Utensils } from "@lucide/svelte";
    import { LoadingSection } from "@ac/ui";

    const dataPromise = Promise.all([
        listConsumables({ limit: 200 }),
        listRecipes({ limit: 200 })
    ]);
</script>

<div class="container mx-auto px-4 py-6 max-w-5xl space-y-6">
    <Breadcrumb feature="menus" current={m.create_item_label?.({ item: m.menu?.() || 'Menu' }) || 'New Menu'} />

    <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Utensils size={28} class="text-violet-600" />
            {m.create_item_label?.({ item: m.menu?.() || 'Menu' }) || 'New Menu'}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
            Aggregate consumables and recipes into a menu template with unit prices and total calculation.
        </p>
    </div>

    {#await dataPromise}
        <LoadingSection message="Loading items..." />
    {:then [consumablesResult, recipesResult]}
        <MenuForm
            remoteFunction={createMenu}
            validationSchema={createMenuSchema}
            isUpdating={false}
            allConsumables={consumablesResult?.data || []}
            allRecipes={recipesResult?.data || []}
            cancelHref="/menus"
        />
    {/await}
</div>
