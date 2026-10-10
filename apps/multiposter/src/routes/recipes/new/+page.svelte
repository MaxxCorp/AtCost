<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import RecipeForm from "#lib/components/recipes/RecipeForm.svelte";
    import { createRecipe } from "./create.remote";
    import { listConsumables } from "../../consumables/list.remote";
    import { createRecipeSchema } from "@ac/validations";
    import { ChefHat } from "@lucide/svelte";
    import { LoadingSection } from "@ac/ui";

    const consumablesPromise = listConsumables({ limit: 200 });
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
    <Breadcrumb feature="recipes" current={m.create_item_label?.({ item: m.recipe?.() || 'Recipe' }) || 'New Recipe'} />

    <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <ChefHat size={28} class="text-emerald-600" />
            {m.create_item_label?.({ item: m.recipe?.() || 'Recipe' }) || 'New Recipe'}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
            Create a recipe with consumables and preparation instructions.
        </p>
    </div>

    {#await consumablesPromise}
        <LoadingSection message="Loading consumables..." />
    {:then consumablesResult}
        <RecipeForm
            remoteFunction={createRecipe}
            validationSchema={createRecipeSchema}
            isUpdating={false}
            allConsumables={consumablesResult?.data || []}
            cancelHref="/recipes"
        />
    {/await}
</div>
