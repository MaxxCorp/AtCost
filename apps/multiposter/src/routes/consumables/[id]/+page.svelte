<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import ConsumableForm from "#lib/components/consumables/ConsumableForm.svelte";
    import { readConsumable } from "./read.remote";
    import { updateConsumable } from "./update.remote";
    import { updateConsumableSchema } from "@ac/validations";
    import { page } from "$app/state";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import { Package } from "@lucide/svelte";

    const id = $derived(page.params.id || '');
    const dataPromise = $derived(readConsumable(id));
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
    {#await dataPromise}
        <LoadingSection message={m.loading_item?.({ item: m.consumable?.() || 'Consumable' }) || 'Loading consumable...'} />
    {:then consumable}
        {#if consumable}
            <Breadcrumb feature="consumables" current={consumable.name} />

            <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                    <Package size={28} class="text-amber-600" />
                    {m.edit_item_label?.({ item: consumable.name }) || `Edit ${consumable.name}`}
                </h1>
                <p class="text-sm text-gray-500 mt-1">
                    Update price, storage location, or expiration date.
                </p>
            </div>

            <ConsumableForm
                remoteFunction={updateConsumable}
                validationSchema={updateConsumableSchema}
                isUpdating={true}
                initialData={consumable}
                cancelHref="/consumables"
            />
        {:else}
            <ErrorSection
                headline={m.item_not_found?.({ item: m.consumable?.() || 'Consumable' }) || 'Consumable not found'}
                message="The requested consumable could not be found."
                href="/consumables"
                button={m.back_to_feature?.({ feature: m.consumables?.() || 'Consumables' }) || 'Back to Consumables'}
            />
        {/if}
    {:catch error}
        <ErrorSection
            headline={m.error?.() || 'Error'}
            message={error.message || 'Failed to load consumable'}
            href="/consumables"
            button={m.back_to_feature?.({ feature: m.consumables?.() || 'Consumables' }) || 'Back to Consumables'}
        />
    {/await}
</div>
