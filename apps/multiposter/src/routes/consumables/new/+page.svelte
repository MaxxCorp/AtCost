<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import ConsumableForm from "#lib/components/consumables/ConsumableForm.svelte";
    import { createConsumable } from "./create.remote";
    import { createConsumableSchema } from "@ac/validations";
    import { Package } from "@lucide/svelte";
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
    <Breadcrumb feature="consumables" current={m.create_item_label?.({ item: m.consumable?.() || 'Consumable' }) || 'New Consumable'} />

    <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Package size={28} class="text-amber-600" />
            {m.create_item_label?.({ item: m.consumable?.() || 'Consumable' }) || 'New Consumable'}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
            Add a new consumable item with purchase price, unit, and storage details.
        </p>
    </div>

    <ConsumableForm
        remoteFunction={createConsumable}
        validationSchema={createConsumableSchema}
        isUpdating={false}
        cancelHref="/consumables"
    />
</div>
