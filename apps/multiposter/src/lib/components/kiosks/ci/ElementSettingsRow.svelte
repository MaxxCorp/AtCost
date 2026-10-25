<script lang="ts">
    import type { Component } from "svelte";
    import type { ElementPrintConfig } from "./types.js";
    import { Printer, ChevronDown, ChevronUp } from "@lucide/svelte";

    let {
        title,
        description = "",
        icon: IconComponent,
        config = $bindable(),
        showEnabledToggle = true,
        children
    }: {
        title: string;
        description?: string;
        icon?: Component<{ class?: string }>;
        config: ElementPrintConfig;
        showEnabledToggle?: boolean;
        children?: any;
    } = $props();

    let isPrintOptionsOpen = $state<boolean>(false);

    let isCustomized = $derived(
        config.printBehavior !== "print" || config.printColor !== "color"
    );
</script>

<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-all overflow-hidden">
    <!-- Header Row: Minimal & Clean by default -->
    <div class="p-3.5 sm:p-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
            {#if IconComponent}
                <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300">
                    <IconComponent class="w-4 h-4" />
                </div>
            {/if}
            <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        {title}
                    </h4>
                    <!-- Subtle print status badge -->
                    {#if isCustomized}
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border {config.printBehavior === 'reserve_space' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' : config.printBehavior === 'omit' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'}">
                            {#if config.printBehavior === "reserve_space"}
                                <span>✂️ Raum reserviert</span>
                            {:else if config.printBehavior === "omit"}
                                <span>🚫 Ausgeblendet</span>
                            {/if}
                            {#if config.printColor === "greyscale"}
                                <span>⚫ Graustufen</span>
                            {/if}
                        </span>
                    {/if}
                </div>
                {#if description}
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {description}
                    </p>
                {/if}
            </div>
        </div>

        <!-- Right Side: Print options toggle & enable switch -->
        <div class="flex items-center gap-2 shrink-0">
            <!-- Minimal Print Options Trigger Button -->
            <button
                type="button"
                onclick={() => (isPrintOptionsOpen = !isPrintOptionsOpen)}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition border {isCustomized ? 'border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                title="Druck- und Spartoner-Einstellungen für dieses Element anpassen"
            >
                <Printer class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Druck</span>
                {#if isPrintOptionsOpen}
                    <ChevronUp class="w-3 h-3 opacity-60" />
                {:else}
                    <ChevronDown class="w-3 h-3 opacity-60" />
                {/if}
            </button>

            <!-- Visibility / In-Layout Toggle -->
            {#if showEnabledToggle}
                <label class="relative inline-flex items-center cursor-pointer ml-1" title="Element im Layout ein-/ausschalten">
                    <input
                        type="checkbox"
                        bind:checked={config.enabled}
                        class="sr-only peer"
                    />
                    <div class="w-8 h-4 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                </label>
            {/if}
        </div>
    </div>

    <!-- Optional Custom Content controls slot (e.g. text inputs or settings) -->
    {#if children}
        <div class="px-3.5 pb-3 sm:px-4 sm:pb-3.5 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            {@render children()}
        </div>
    {/if}

    <!-- Expandable Print Options Disclosure (Hidden by Default!) -->
    {#if isPrintOptionsOpen}
        <div class="bg-slate-50 dark:bg-slate-800/50 p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 transition-all text-xs">
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span class="flex items-center gap-1.5">
                    <Printer class="w-3.5 h-3.5 text-purple-600" />
                    <span>Druck-Einstellungen für „{title}“</span>
                </span>
                {#if isCustomized}
                    <button
                        type="button"
                        onclick={() => {
                            config.printBehavior = "print";
                            config.printColor = "color";
                        }}
                        class="text-[10px] text-purple-600 dark:text-purple-400 hover:underline capitalize"
                    >
                        Auf Standard zurücksetzen
                    </button>
                {/if}
            </div>

            <!-- Print Behavior: Print vs Reserve Space vs Omit -->
            <div class="space-y-1.5">
                <span class="font-semibold text-slate-700 dark:text-slate-300 block">
                    Druck-Verhalten:
                </span>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <!-- 1. Normal print -->
                    <button
                        type="button"
                        onclick={() => (config.printBehavior = "print")}
                        class="p-2 rounded-lg border text-left transition {config.printBehavior === 'print' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Normal drucken</span>
                            {#if config.printBehavior === 'print'}<span>✓</span>{/if}
                        </div>
                        <div class="text-[10px] font-normal opacity-75 mt-0.5">
                            Wird regulär mitgedruckt.
                        </div>
                    </button>

                    <!-- 2. Reserve Space (Letterhead) -->
                    <button
                        type="button"
                        onclick={() => (config.printBehavior = "reserve_space")}
                        class="p-2 rounded-lg border text-left transition {config.printBehavior === 'reserve_space' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-semibold' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Raum reservieren</span>
                            {#if config.printBehavior === 'reserve_space'}<span>✓</span>{/if}
                        </div>
                        <div class="text-[10px] font-normal opacity-75 mt-0.5">
                            Nicht drucken, aber Platz freihalten (Briefpapier).
                        </div>
                    </button>

                    <!-- 3. Omit / Collapse -->
                    <button
                        type="button"
                        onclick={() => (config.printBehavior = "omit")}
                        class="p-2 rounded-lg border text-left transition {config.printBehavior === 'omit' ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 font-semibold' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Ausblenden</span>
                            {#if config.printBehavior === 'omit'}<span>✓</span>{/if}
                        </div>
                        <div class="text-[10px] font-normal opacity-75 mt-0.5">
                            Beim Drucken komplett weglassen (rückt auf).
                        </div>
                    </button>
                </div>
            </div>

            <!-- Print Color: Color vs Greyscale -->
            <div class="space-y-1.5 pt-1">
                <span class="font-semibold text-slate-700 dark:text-slate-300 block">
                    Farbe im Ausdruck:
                </span>
                <div class="grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onclick={() => (config.printColor = "color")}
                        class="p-2 rounded-lg border text-left transition {config.printColor === 'color' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>🎨 Vollfarbe</span>
                            {#if config.printColor === 'color'}<span>✓</span>{/if}
                        </div>
                        <div class="text-[10px] font-normal opacity-75 mt-0.5">
                            In Originalfarben drucken.
                        </div>
                    </button>

                    <button
                        type="button"
                        onclick={() => (config.printColor = "greyscale")}
                        class="p-2 rounded-lg border text-left transition {config.printColor === 'greyscale' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>⚫ Graustufen</span>
                            {#if config.printColor === 'greyscale'}<span>✓</span>{/if}
                        </div>
                        <div class="text-[10px] font-normal opacity-75 mt-0.5">
                            In Graustufen drucken (spart Tinte).
                        </div>
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
