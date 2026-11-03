<script lang="ts">
    import {
        Euro,
        DollarSign,
        PoundSterling,
        SwissFranc,
        JapaneseYen,
        IndianRupee,
        Banknote,
    } from "@lucide/svelte";

    let {
        currency = "EUR",
        size = 16,
        class: className = "",
    }: {
        currency?: string | null;
        size?: number | string;
        class?: string;
    } = $props();

    const code = $derived((currency || "EUR").trim().toUpperCase());
</script>

{#if code === "EUR"}
    <Euro {size} class={className} />
{:else if code === "USD" || code === "CAD" || code === "AUD"}
    <DollarSign {size} class={className} />
{:else if code === "GBP"}
    <PoundSterling {size} class={className} />
{:else if code === "CHF"}
    <SwissFranc {size} class={className} />
{:else if code === "JPY"}
    <JapaneseYen {size} class={className} />
{:else if code === "INR"}
    <IndianRupee {size} class={className} />
{:else}
    <Banknote {size} class={className} />
{/if}
