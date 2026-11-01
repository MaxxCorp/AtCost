<script lang="ts">
    import { X, Printer, RotateCcw } from "@lucide/svelte";
    import type { KioskElementSettings } from "./ci/types.js";
    import { DEFAULT_ELEMENT_SETTINGS } from "./ci/types.js";
    import ElementManager from "./ci/ElementManager.svelte";

    let {
        open = $bindable(false),
        elementSettings = $bindable(),
        previewGreyscaleOnScreen = $bindable(false),
        isFlyer = false,
        onSettingsChange
    }: {
        open: boolean;
        elementSettings: KioskElementSettings;
        previewGreyscaleOnScreen?: boolean;
        isFlyer?: boolean;
        onSettingsChange?: () => void;
    } = $props();

    function resetToDefault() {
        elementSettings = JSON.parse(JSON.stringify(DEFAULT_ELEMENT_SETTINGS));
        previewGreyscaleOnScreen = false;
        onSettingsChange?.();
    }
</script>

{#if open}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs print:hidden animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-settings-title"
    >
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
                        <Printer class="w-4 h-4" />
                    </div>
                    <div>
                        <h2 id="print-settings-title" class="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            Druck-Optionen & Elemente
                        </h2>
                        <p class="text-[11px] text-slate-500">
                            Elemente verwalten, Druckfarben steuern und Bereiche freihalten oder ausblenden
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onclick={() => (open = false)}
                    class="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                    aria-label="Schließen"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Modal Body -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <ElementManager
                    bind:elementSettings
                    bind:previewGreyscaleOnScreen
                    {isFlyer}
                    showCi={false}
                    {onSettingsChange}
                />
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onclick={resetToDefault}
                    class="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition"
                >
                    <RotateCcw class="w-3.5 h-3.5" />
                    <span>Auf Standard zurücksetzen</span>
                </button>

                <button
                    type="button"
                    onclick={() => (open = false)}
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-xs transition"
                >
                    Fertig
                </button>
            </div>
        </div>
    </div>
{/if}
