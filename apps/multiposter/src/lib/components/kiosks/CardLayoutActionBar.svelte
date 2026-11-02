<script lang="ts">
    import { onDestroy } from "svelte";
    import { fly } from "svelte/transition";
    import { Sparkles, LoaderCircle, Sliders, X, Eye, SquareDashed, EyeOff, Palette, Contrast, Calendar, CalendarOff } from "@lucide/svelte";
    import { summarizeItemLength } from "../../../routes/kiosks/[id]/view/summarize.remote";
    import { calculatePlainCutoff } from "#lib/utils/text-cutoff.js";

    interface Props {
        selectedItem: {
            id: string;
            title: string;
            description?: string | null;
            hasSeriesDates?: boolean;
        };
        kioskId?: string;
        currentPercentage?: number;
        currentBehavior?: 'print' | 'reserve_space' | 'omit';
        currentColor?: 'color' | 'greyscale';
        hideSeriesDates?: boolean;
        onPercentageChange: (percentage: number, summarizedText: string) => void;
        onBehaviorChange: (behavior: 'print' | 'reserve_space' | 'omit') => void;
        onColorChange: (color: 'color' | 'greyscale') => void;
        onToggleSeriesDates?: (hide: boolean) => void;
        onClose: () => void;
    }

    let {
        selectedItem,
        kioskId = "default",
        currentPercentage = $bindable(),
        currentBehavior = "print",
        currentColor = "color",
        hideSeriesDates = false,
        onPercentageChange,
        onBehaviorChange,
        onColorChange,
        onToggleSeriesDates,
        onClose
    }: Props = $props();

    let effectivePercentage = $derived(currentPercentage ?? 100);
    let isLoading = $state(false);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const aiCache = new Map<string, string>(); // key: `${itemId}_${percentage}`

    const rawDesc = $derived(selectedItem.description?.trim() || "");

    function handleSliderInput(e: Event) {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        updatePercentage(val);
    }

    function resetToFull() {
        updatePercentage(100);
    }

    function updatePercentage(val: number) {
        currentPercentage = val;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }

        if (val >= 100 || !rawDesc) {
            isLoading = false;
            onPercentageChange(100, rawDesc);
            return;
        }

        // 1. Immediately apply plain cutoff for responsive preview
        const plainCut = calculatePlainCutoff(rawDesc, val);
        onPercentageChange(val, plainCut);

        // 2. Check in-memory cache
        const cacheKey = `${selectedItem.id}_${val}`;
        if (aiCache.has(cacheKey)) {
            isLoading = false;
            onPercentageChange(val, aiCache.get(cacheKey)!);
            return;
        }

        // 3. Debounced AI call
        isLoading = true;
        debounceTimer = setTimeout(async () => {
            try {
                const result = await summarizeItemLength({
                    kioskId: kioskId || "default",
                    itemId: selectedItem.id,
                    title: selectedItem.title,
                    description: rawDesc,
                    targetPercentage: val
                });

                if (result.success && !result.fallback && result.summary) {
                    aiCache.set(cacheKey, result.summary);
                    if (effectivePercentage === val) {
                        onPercentageChange(val, result.summary);
                    }
                } else if (result.summary) {
                    if (effectivePercentage === val) {
                        onPercentageChange(val, result.summary);
                    }
                }
            } catch (err) {
                console.warn("[CardLayoutActionBar] AI failed, falling back to plain cutoff:", err);
                if (effectivePercentage === val) {
                    onPercentageChange(val, plainCut);
                }
            } finally {
                if (effectivePercentage === val) {
                    isLoading = false;
                }
            }
        }, 500);
    }

    onDestroy(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
    });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onClose(); }} />

<div class="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-50 flex justify-center pointer-events-none px-4 print:hidden">
    <aside
        aria-label="Card Layout Controls"
        transition:fly={{ y: 24, duration: 200 }}
        class="pointer-events-auto flex items-center gap-2 sm:gap-3 p-2 sm:px-4 sm:py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/90 shadow-2xl rounded-2xl text-xs max-w-[calc(100vw-2rem)] overflow-x-auto select-none"
    >
        <!-- Item Title Badge -->
        <div class="flex items-center gap-1.5 shrink-0 max-w-[140px] sm:max-w-[200px]">
            <Sliders class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span class="font-bold text-slate-800 dark:text-slate-100 truncate" title={selectedItem.title}>
                {selectedItem.title}
            </span>
        </div>

        <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

        <!-- Description Length Slider (if description exists) -->
        {#if rawDesc}
            <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center gap-1 shrink-0 min-w-[50px]">
                    {#if isLoading}
                        <LoaderCircle class="w-3.5 h-3.5 animate-spin text-purple-600 shrink-0" />
                        <span class="text-purple-600 font-mono font-bold text-[11px]">KI...</span>
                    {:else}
                        <Sparkles class="w-3 h-3 text-purple-500 shrink-0" />
                        <span class="font-mono font-bold text-slate-700 dark:text-slate-200 text-[11px]">{effectivePercentage}%</span>
                    {/if}
                </div>

                <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={effectivePercentage}
                    oninput={handleSliderInput}
                    class="h-1.5 w-20 sm:w-28 accent-purple-600 bg-slate-200 dark:bg-slate-700 rounded-sm cursor-pointer"
                    title="Beschreibungslänge: {effectivePercentage}% des Originaltexts"
                />

                <button
                    type="button"
                    onclick={resetToFull}
                    class="px-2 py-0.5 text-[10.5px] font-semibold rounded transition cursor-pointer {effectivePercentage === 100 ? 'bg-purple-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}"
                    title="Auf 100% (Volltext) setzen"
                >
                    100%
                </button>
            </div>
        {:else}
            <span class="text-slate-400 italic text-[11px] shrink-0">Keine Beschreibung</span>
        {/if}

        <!-- Series Dates Visibility (only for series with instances/dates) -->
        {#if selectedItem.hasSeriesDates}
            <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

            <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <button
                    type="button"
                    onclick={() => onToggleSeriesDates?.(false)}
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {!hideSeriesDates ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                    title="Alle Termine der Serie auf der Karte anzeigen"
                >
                    <Calendar class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Termine</span>
                </button>
                <button
                    type="button"
                    onclick={() => onToggleSeriesDates?.(true)}
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {hideSeriesDates ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                    title="Serientermine ausblenden, um Platz auf der Karte zu sparen"
                >
                    <CalendarOff class="w-3.5 h-3.5 text-slate-500" />
                    <span>Ohne</span>
                </button>
            </div>
        {/if}

        <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

        <!-- Print Behavior Buttons -->
        <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
                type="button"
                onclick={() => onBehaviorChange('print')}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentBehavior === 'print' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                title="Karte normal drucken"
            >
                <Eye class="w-3.5 h-3.5 text-emerald-600" />
                <span>Drucken</span>
            </button>
            <button
                type="button"
                onclick={() => onBehaviorChange('reserve_space')}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentBehavior === 'reserve_space' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                title="Auf dem Papier leer lassen (Platzhalter / Raum freihalten)"
            >
                <SquareDashed class="w-3.5 h-3.5 text-amber-600" />
                <span>Reservieren</span>
            </button>
            <button
                type="button"
                onclick={() => onBehaviorChange('omit')}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentBehavior === 'omit' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                title="Ausblenden und Platz im Layout für andere Inhalte freigeben"
            >
                <EyeOff class="w-3.5 h-3.5 text-red-600" />
                <span>Ausblenden</span>
            </button>
        </div>

        <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

        <!-- Print Color Buttons -->
        <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
                type="button"
                onclick={() => onColorChange('color')}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentColor === 'color' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                title="In Farbe drucken"
            >
                <Palette class="w-3.5 h-3.5 text-blue-600" />
                <span>Farbe</span>
            </button>
            <button
                type="button"
                onclick={() => onColorChange('greyscale')}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentColor === 'greyscale' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                title="In Graustufen drucken"
            >
                <Contrast class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>S/W</span>
            </button>
        </div>

        <!-- Deselect / Close Button -->
        <button
            type="button"
            onclick={onClose}
            class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-1 shrink-0"
            title="Auswahl aufheben"
        >
            <X size={15} />
        </button>
    </aside>
</div>
