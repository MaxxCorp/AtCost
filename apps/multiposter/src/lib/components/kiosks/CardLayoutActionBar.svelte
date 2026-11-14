<script lang="ts">
    import { onDestroy } from "svelte";
    import { fly } from "svelte/transition";
    import { Sparkles, LoaderCircle, Sliders, X, Eye, SquareDashed, EyeOff, Palette, Contrast, Calendar, CalendarOff, Clock, Type, Minus, Plus, RotateCcw, ChevronDown, ChevronUp } from "@lucide/svelte";
    import { summarizeItemLength } from "../../../routes/kiosks/[id]/view/summarize.remote";
    import { calculatePlainCutoff } from "#lib/utils/text-cutoff.js";
    import {
        KIOSK_FONT_OPTIONS,
        KIOSK_FONT_SCALE_MIN,
        KIOSK_FONT_SCALE_MAX,
        KIOSK_FONT_SCALE_STEP,
        clampKioskFontScale,
        getKioskFontCss
    } from "./ci/types.js";

    interface Props {
        selectedItem?: {
            id: string;
            title: string;
            description?: string | null;
            hasSeriesDates?: boolean;
            hasEndTime?: boolean;
            isLogo?: boolean;
        } | null;
        kioskId?: string;
        scopeLabel?: string;
        docFontFamily?: string;
        docFontScale?: number;
        onDocFontFamilyChange?: (fontFamily: string) => void;
        onDocFontScaleChange?: (fontScale: number) => void;
        itemFontFamily?: string;
        itemFontScale?: number;
        onItemFontFamilyChange?: (fontFamily: string) => void;
        onItemFontScaleChange?: (fontScale: number) => void;
        currentPercentage?: number;
        currentBehavior?: 'print' | 'reserve_space' | 'omit';
        currentColor?: 'color' | 'greyscale';
        hideSeriesDates?: boolean;
        hideEndTime?: boolean;
        onPercentageChange?: (percentage: number, summarizedText: string) => void;
        onBehaviorChange?: (behavior: 'print' | 'reserve_space' | 'omit') => void;
        onColorChange?: (color: 'color' | 'greyscale') => void;
        onToggleSeriesDates?: (hide: boolean) => void;
        onToggleEndTime?: (hide: boolean) => void;
        onClose?: () => void;
    }

    let {
        selectedItem = null,
        kioskId = "default",
        scopeLabel = "Dokument",
        docFontFamily = "default",
        docFontScale = 1,
        onDocFontFamilyChange,
        onDocFontScaleChange,
        itemFontFamily = "",
        itemFontScale = 1,
        onItemFontFamilyChange,
        onItemFontScaleChange,
        currentPercentage = $bindable(),
        currentBehavior = "print",
        currentColor = "color",
        hideSeriesDates = false,
        hideEndTime = false,
        onPercentageChange,
        onBehaviorChange,
        onColorChange,
        onToggleSeriesDates,
        onToggleEndTime,
        onClose
    }: Props = $props();

    let isCollapsed = $state(false);
    let effectivePercentage = $derived(currentPercentage ?? 100);
    let effectiveDocScale = $derived(clampKioskFontScale(docFontScale));
    let effectiveItemScale = $derived(clampKioskFontScale(itemFontScale));
    let hasCustomDocTypography = $derived(
        (Boolean(docFontFamily) && docFontFamily !== 'default') || Math.abs(effectiveDocScale - 1) > 0.001
    );
    let isLoading = $state(false);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const aiCache = new Map<string, string>(); // key: `${itemId}_${percentage}`

    const rawDesc = $derived(selectedItem?.description?.trim() || "");

    function handleSliderInput(e: Event) {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        updatePercentage(val);
    }

    function resetToFull() {
        updatePercentage(100);
    }

    function updatePercentage(val: number) {
        if (!selectedItem || !onPercentageChange) return;
        const activeItemId = selectedItem.id;
        const activeItemTitle = selectedItem.title;
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
        const cacheKey = `${activeItemId}_${val}`;
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
                    itemId: activeItemId,
                    title: activeItemTitle,
                    description: rawDesc,
                    targetPercentage: val
                });

                if (result.success && !result.fallback && result.summary) {
                    aiCache.set(cacheKey, result.summary);
                    if (effectivePercentage === val && selectedItem?.id === activeItemId) {
                        onPercentageChange(val, result.summary);
                    }
                } else if (result.summary) {
                    if (effectivePercentage === val && selectedItem?.id === activeItemId) {
                        onPercentageChange(val, result.summary);
                    }
                }
            } catch (err) {
                console.warn("[CardLayoutActionBar] AI failed, falling back to plain cutoff:", err);
                if (effectivePercentage === val && selectedItem?.id === activeItemId) {
                    onPercentageChange(val, plainCut);
                }
            } finally {
                if (effectivePercentage === val && selectedItem?.id === activeItemId) {
                    isLoading = false;
                }
            }
        }, 500);
    }

    onDestroy(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
    });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && selectedItem) onClose?.(); }} />

<div class="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-50 flex justify-center pointer-events-none px-4 print:hidden">
    {#if !selectedItem && isCollapsed}
        <button
            type="button"
            onclick={() => (isCollapsed = false)}
            transition:fly={{ y: 20, duration: 180 }}
            class="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/90 shadow-xl rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer select-none"
            title="Schrift- & Größenmenü öffnen"
        >
            <Type class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Schrift &amp; Größe</span>
            {#if hasCustomDocTypography}
                <span class="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                    {Math.round(effectiveDocScale * 100)}%
                </span>
            {/if}
            <ChevronUp class="w-3.5 h-3.5 text-slate-400" />
        </button>
    {:else}
        <aside
            aria-label={selectedItem ? "Card Layout Controls" : "Document Typography Controls"}
            transition:fly={{ y: 24, duration: 200 }}
            class="pointer-events-auto flex items-center gap-2 sm:gap-3 p-2 sm:px-4 sm:py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/90 shadow-2xl rounded-2xl text-xs max-w-[calc(100vw-2rem)] overflow-x-auto select-none"
        >
            {#if selectedItem}
                <!-- Item Title Badge -->
                <div class="flex items-center gap-1.5 shrink-0 max-w-[140px] sm:max-w-[200px]">
                    <Sliders class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span class="font-bold text-slate-800 dark:text-slate-100 truncate" title={selectedItem.title}>
                        {selectedItem.title}
                    </span>
                </div>

                <!-- Per-Item Font Family & Size (hidden for pure logo items) -->
                {#if !selectedItem.isLogo && (onItemFontFamilyChange || onItemFontScaleChange)}
                    <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    <div class="flex items-center gap-1.5 shrink-0">
                        {#if onItemFontFamilyChange}
                            <label class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80" title="Schriftart für dieses Element">
                                <Type class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <select
                                    aria-label="Schriftart für Element"
                                    value={itemFontFamily || ""}
                                    onchange={(e) => onItemFontFamilyChange?.((e.target as HTMLSelectElement).value)}
                                    style={itemFontFamily ? `font-family: ${getKioskFontCss(itemFontFamily)}` : ""}
                                    class="bg-transparent text-[11px] font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[165px]"
                                >
                                    <option value="">Wie {scopeLabel}</option>
                                    {#each KIOSK_FONT_OPTIONS.filter((f) => f.id !== 'default') as font (font.id)}
                                        <option value={font.id} style={font.cssFamily ? `font-family: ${font.cssFamily}` : ""}>
                                            {font.label}
                                        </option>
                                    {/each}
                                </select>
                            </label>
                        {/if}

                        {#if onItemFontScaleChange}
                            <div class="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                                <button
                                    type="button"
                                    onclick={() => onItemFontScaleChange?.(clampKioskFontScale(effectiveItemScale - KIOSK_FONT_SCALE_STEP))}
                                    disabled={effectiveItemScale <= KIOSK_FONT_SCALE_MIN}
                                    class="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none transition cursor-pointer"
                                    title="Schrift dieses Elements verkleinern"
                                >
                                    <Minus class="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onclick={() => onItemFontScaleChange?.(1)}
                                    class="px-1.5 py-0.5 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer min-w-[42px] text-center {Math.abs(effectiveItemScale - 1) > 0.001 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs'}"
                                    title="Schriftgröße des Elements auf 100% zurücksetzen"
                                >
                                    {Math.round(effectiveItemScale * 100)}%
                                </button>
                                <button
                                    type="button"
                                    onclick={() => onItemFontScaleChange?.(clampKioskFontScale(effectiveItemScale + KIOSK_FONT_SCALE_STEP))}
                                    disabled={effectiveItemScale >= KIOSK_FONT_SCALE_MAX}
                                    class="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none transition cursor-pointer"
                                    title="Schrift dieses Elements vergrößern"
                                >
                                    <Plus class="w-3 h-3" />
                                </button>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Description Length Slider (only if description exists and handler provided) -->
                {#if rawDesc && onPercentageChange}
                    <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

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
                {/if}

                <!-- Series Dates Visibility (only for series with instances/dates) -->
                {#if selectedItem.hasSeriesDates && onToggleSeriesDates}
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

                <!-- End Time Visibility (only for items with end time) -->
                {#if selectedItem.hasEndTime && onToggleEndTime}
                    <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <button
                            type="button"
                            onclick={() => onToggleEndTime?.(false)}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {!hideEndTime ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="Endzeit auf der Karte anzeigen (z. B. 14:00 – 16:00)"
                        >
                            <Clock class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Endzeit</span>
                        </button>
                        <button
                            type="button"
                            onclick={() => onToggleEndTime?.(true)}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {hideEndTime ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="Endzeit ausblenden, nur Beginn anzeigen (z. B. 14:00)"
                        >
                            <Clock class="w-3.5 h-3.5 text-slate-400" />
                            <span>Ohne</span>
                        </button>
                    </div>
                {/if}

                {#if onBehaviorChange}
                    <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    <!-- Print Behavior Buttons -->
                    <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <button
                            type="button"
                            onclick={() => onBehaviorChange?.('print')}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentBehavior === 'print' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="Karte normal drucken"
                        >
                            <Eye class="w-3.5 h-3.5 text-emerald-600" />
                            <span>Drucken</span>
                        </button>
                        <button
                            type="button"
                            onclick={() => onBehaviorChange?.('reserve_space')}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentBehavior === 'reserve_space' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="Auf dem Papier leer lassen (Platzhalter / Raum freihalten)"
                        >
                            <SquareDashed class="w-3.5 h-3.5 text-amber-600" />
                            <span>Reservieren</span>
                        </button>
                        <button
                            type="button"
                            onclick={() => onBehaviorChange?.('omit')}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentBehavior === 'omit' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="Ausblenden und Platz im Layout für andere Inhalte freigeben"
                        >
                            <EyeOff class="w-3.5 h-3.5 text-red-600" />
                            <span>Ausblenden</span>
                        </button>
                    </div>
                {/if}

                {#if onColorChange}
                    <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    <!-- Print Color Buttons -->
                    <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <button
                            type="button"
                            onclick={() => onColorChange?.('color')}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentColor === 'color' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="In Farbe drucken"
                        >
                            <Palette class="w-3.5 h-3.5 text-blue-600" />
                            <span>Farbe</span>
                        </button>
                        <button
                            type="button"
                            onclick={() => onColorChange?.('greyscale')}
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer {currentColor === 'greyscale' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
                            title="In Graustufen drucken"
                        >
                            <Contrast class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            <span>S/W</span>
                        </button>
                    </div>
                {/if}

                <!-- Deselect / Return to Whole-Document Bar -->
                <button
                    type="button"
                    onclick={() => onClose?.()}
                    class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-1 shrink-0"
                    title="Zurück zu {scopeLabel} (Gesamt)"
                >
                    <X size={15} />
                </button>
            {:else}
                <!-- Whole-Document Typography Mode -->
                <div class="flex items-center gap-1.5 shrink-0">
                    <Type class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span class="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {scopeLabel} (Gesamt)
                    </span>
                </div>

                <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                <!-- Document Font Family Picker -->
                <label class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0" title="Schriftart für das gesamte Dokument">
                    <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">Schrift:</span>
                    <select
                        aria-label="Schriftart (Gesamt)"
                        value={docFontFamily || "default"}
                        onchange={(e) => onDocFontFamilyChange?.((e.target as HTMLSelectElement).value)}
                        style={docFontFamily && docFontFamily !== 'default' ? `font-family: ${getKioskFontCss(docFontFamily)}` : ""}
                        class="bg-transparent text-[11px] font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer max-w-[155px] sm:max-w-[190px]"
                    >
                        {#each KIOSK_FONT_OPTIONS as font (font.id)}
                            <option value={font.id} style={font.cssFamily ? `font-family: ${font.cssFamily}` : ""}>
                                {font.label}
                            </option>
                        {/each}
                    </select>
                </label>

                <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                <!-- Document Font Size Controls (- / 100% / +) -->
                <div class="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <button
                        type="button"
                        onclick={() => onDocFontScaleChange?.(clampKioskFontScale(effectiveDocScale - KIOSK_FONT_SCALE_STEP))}
                        disabled={effectiveDocScale <= KIOSK_FONT_SCALE_MIN}
                        class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none transition cursor-pointer"
                        title="Gesamte Schriftgröße verkleinern"
                    >
                        <Minus class="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onclick={() => onDocFontScaleChange?.(1)}
                        class="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer min-w-[46px] text-center {Math.abs(effectiveDocScale - 1) > 0.001 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs'}"
                        title="Schriftgröße auf 100% zurücksetzen"
                    >
                        {Math.round(effectiveDocScale * 100)}%
                    </button>
                    <button
                        type="button"
                        onclick={() => onDocFontScaleChange?.(clampKioskFontScale(effectiveDocScale + KIOSK_FONT_SCALE_STEP))}
                        disabled={effectiveDocScale >= KIOSK_FONT_SCALE_MAX}
                        class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none transition cursor-pointer"
                        title="Gesamte Schriftgröße vergrößern"
                    >
                        <Plus class="w-3.5 h-3.5" />
                    </button>
                </div>

                {#if hasCustomDocTypography}
                    <button
                        type="button"
                        onclick={() => {
                            onDocFontFamilyChange?.('default');
                            onDocFontScaleChange?.(1);
                        }}
                        class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                        title="Schriftart und Größe zurücksetzen"
                    >
                        <RotateCcw class="w-3 h-3" />
                        <span class="hidden sm:inline">Reset</span>
                    </button>
                {/if}

                <span class="hidden md:inline text-[10.5px] text-slate-400 dark:text-slate-500 pl-1 shrink-0">
                    Klick auf Element für Einzelanpassung
                </span>

                <button
                    type="button"
                    onclick={() => (isCollapsed = true)}
                    class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-0.5 shrink-0"
                    title="Leiste minimieren"
                >
                    <ChevronDown size={15} />
                </button>
            {/if}
        </aside>
    {/if}
</div>
