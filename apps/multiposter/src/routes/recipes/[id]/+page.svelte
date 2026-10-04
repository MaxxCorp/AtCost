<script lang="ts">
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import * as m from "$lib/paraglide/messages";
    import RecipeForm from "$lib/components/recipes/RecipeForm.svelte";
    import { readRecipe } from "./read.remote";
    import { updateRecipe } from "./update.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { updateRecipeSchema } from "@ac/validations";
    import { page } from "$app/state";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import { ChefHat } from "@lucide/svelte";

    const id = $derived(page.params.id || '');
    const dataPromise = $derived(readRecipe(id));
    const consumablesPromise = listConsumables({ limit: 200 });
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
    {#await dataPromise}
        <LoadingSection message={m.loading_item?.({ item: m.recipe?.() || 'Recipe' }) || 'Loading recipe...'} />
    {:then recipe}
        {#if recipe}
            <Breadcrumb feature="recipes" current={recipe.name} />

            <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                    <ChefHat size={28} class="text-emerald-600" />
                    {m.edit_item_label?.({ item: recipe.name }) || `Edit ${recipe.name}`}
                </h1>
                <p class="text-sm text-gray-500 mt-1">
                    Update ingredients, portion count, or preparation instructions.
                </p>
            </div>

            {#await consumablesPromise}
                <LoadingSection message="Loading consumables..." />
            {:then consumablesResult}
                <RecipeForm
                    remoteFunction={updateRecipe}
                    validationSchema={updateRecipeSchema}
                    isUpdating={true}
                    initialData={recipe}
                    allConsumables={consumablesResult?.data || []}
                    cancelHref="/recipes"
                />
            {/await}
        {:else}
            <ErrorSection
                headline={m.item_not_found?.({ item: m.recipe?.() || 'Recipe' }) || 'Recipe not found'}
                message="The requested recipe could not be found."
                href="/recipes"
                button={m.back_to_feature?.({ feature: m.recipes?.() || 'Recipes' }) || 'Back to Recipes'}
            />
        {/if}
    {:catch error}
        <ErrorSection
            headline={m.error?.() || 'Error'}
            message={error.message || 'Failed to load recipe'}
            href="/recipes"
            button={m.back_to_feature?.({ feature: m.recipes?.() || 'Recipes' }) || 'Back to Recipes'}
        />
    {/await}
</div>
