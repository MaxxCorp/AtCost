<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import {
        formatEuro,
        formatPortion,
        getItemPrice,
        groupItemsBySection,
        type PriceMenuList,
    } from "#lib/utils/price-menu.js";

    /**
     * Customer-facing price list. Deliberately shows no internal data (costs, markups,
     * templates, item types, tags) - only what a guest would read on a menu.
     */
    let {
        prices = [],
        vatNote = m.price_menu_vat_default(),
    }: {
        prices?: PriceMenuList[];
        vatNote?: string;
    } = $props();

    const lists = $derived((prices ?? []).filter((list) => (list.items?.length ?? 0) > 0));
</script>

{#if lists.length === 0}
    <p class="py-10 text-center text-sm text-gray-500">{m.no_items_in_price_list()}</p>
{:else}
    <div class="space-y-8">
        {#each lists as list (list.id ?? list.name)}
            {@const sections = groupItemsBySection(list.items, m.other_items())}
            <section class="space-y-4">
                {#if lists.length > 1}
                    <div>
                        <h3 class="text-base font-bold text-gray-900">{list.name}</h3>
                        {#if list.description}
                            <p class="mt-0.5 text-xs text-gray-500">{list.description}</p>
                        {/if}
                    </div>
                {/if}

                {#each sections as section (section.id)}
                    <div>
                        {#if section.name}
                            <h4 class="mb-1 border-b border-gray-200 pb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                                {section.name}
                            </h4>
                        {/if}
                        <ul class="divide-y divide-gray-100">
                            {#each section.items as item, i (item.id ?? i)}
                                {@const portion = formatPortion(item)}
                                <li class="flex items-baseline justify-between gap-4 py-2">
                                    <div class="min-w-0">
                                        <p class="text-sm font-semibold text-gray-900">
                                            {item.name}
                                            {#if portion}
                                                <span class="ml-1 text-xs font-normal text-gray-500">{portion}</span>
                                            {/if}
                                        </p>
                                        {#if item.description}
                                            <p class="text-xs text-gray-500">{item.description}</p>
                                        {/if}
                                    </div>
                                    <span class="shrink-0 font-mono text-sm font-bold text-gray-900">
                                        {formatEuro(getItemPrice(item))}
                                    </span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </section>
        {/each}

        {#if vatNote}
            <p class="border-t border-gray-100 pt-3 text-center text-xs text-gray-400">{vatNote}</p>
        {/if}
    </div>
{/if}
