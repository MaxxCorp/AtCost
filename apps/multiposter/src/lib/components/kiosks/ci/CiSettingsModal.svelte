<script lang="ts">
    import { X, Sparkles, Printer, Palette, Building2, Save, Trash2, Check, RefreshCw, LayoutTemplate } from "@lucide/svelte";
    import { DEFAULT_PRESETS, DEFAULT_ELEMENT_SETTINGS, type CiPreset, type CiPrintOptions, type CiSponsorItem, type KioskElementSettings } from "./types.js";
    import ElementManager from "./ElementManager.svelte";

    let {
        open = $bindable(false),
        preset = $bindable(),
        printOptions = $bindable(),
        elementSettings = $bindable(DEFAULT_ELEMENT_SETTINGS),
        customPresets = $bindable([]),
        isFlyer = false,
        onSavePreset,
        onDeletePreset
    }: {
        open: boolean;
        preset: CiPreset;
        printOptions: CiPrintOptions;
        elementSettings?: KioskElementSettings;
        customPresets: CiPreset[];
        isFlyer?: boolean;
        onSavePreset?: (preset: CiPreset) => void;
        onDeletePreset?: (presetId: string) => void;
    } = $props();

    let activeTab = $state<"elements" | "ci" | "logos">("elements");
    let newPresetName = $state("");
    let isSavingPreset = $state(false);

    let allPresets = $derived([...DEFAULT_PRESETS, ...customPresets]);

    function selectPreset(presetId: string) {
        const found = allPresets.find((p) => p.id === presetId);
        if (found) {
            preset = { ...found, sponsors: found.sponsors ? [...found.sponsors] : [] };
        }
    }

    function handleSaveCustomPreset() {
        if (!newPresetName.trim()) return;
        const newPreset: CiPreset = {
            ...preset,
            id: `custom_${Date.now()}`,
            name: newPresetName.trim()
        };
        onSavePreset?.(newPreset);
        newPresetName = "";
        isSavingPreset = false;
    }

    function addSponsor() {
        if (!preset.sponsors) preset.sponsors = [];
        preset.sponsors.push({
            id: `sponsor_${Date.now()}`,
            name: "",
            logoUrl: "",
            placement: "center"
        });
    }

    function removeSponsor(index: number) {
        if (!preset.sponsors) return;
        preset.sponsors.splice(index, 1);
        preset.sponsors = [...preset.sponsors];
    }
</script>

{#if open}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs print:hidden animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ci-settings-title"
    >
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 flex items-center justify-center">
                        <Palette class="w-4 h-4" />
                    </div>
                    <div>
                        <h2 id="ci-settings-title" class="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            Layout, Elemente & Corporate Identity
                        </h2>
                        <p class="text-[11px] text-slate-500">
                            Elemente verwalten, Farben konfigurieren und Druckoptionen flexibel steuern
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

            <!-- Tab Navigation -->
            <div class="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 px-6 gap-2 overflow-x-auto">
                <button
                    type="button"
                    onclick={() => (activeTab = "elements")}
                    class="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap {activeTab === 'elements' ? 'border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-white dark:bg-slate-900' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                >
                    <LayoutTemplate class="w-4 h-4" />
                    <span>Elemente & Druckoptionen</span>
                </button>
                <button
                    type="button"
                    onclick={() => (activeTab = "ci")}
                    class="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap {activeTab === 'ci' ? 'border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-white dark:bg-slate-900' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                >
                    <Palette class="w-4 h-4" />
                    <span>CI-Farben & Vorlagen</span>
                </button>
                <button
                    type="button"
                    onclick={() => (activeTab = "logos")}
                    class="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap {activeTab === 'logos' ? 'border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-white dark:bg-slate-900' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                >
                    <Building2 class="w-4 h-4" />
                    <span>Logos & Standort</span>
                </button>
            </div>

            <!-- Tab Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <!-- TAB 1: PER-ELEMENT SETTINGS & PRINT CONFIGURATION -->
                {#if activeTab === "elements"}
                    <ElementManager
                        bind:elementSettings
                        bind:previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
                        {isFlyer}
                    />
                {/if}

                <!-- TAB 2: CORPORATE IDENTITY & PRESETS -->
                {#if activeTab === "ci"}
                    <div class="space-y-6">
                        <!-- Presets Selector & Manager -->
                        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                            <div class="flex items-center justify-between">
                                <label for="ci-preset-select" class="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    Gespeicherte Presets / Vorlagen
                                </label>
                                {#if !isSavingPreset}
                                    <button
                                        type="button"
                                        onclick={() => (isSavingPreset = true)}
                                        class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100"
                                    >
                                        <Save class="w-3.5 h-3.5" />
                                        <span>Aktuelles als Vorlage speichern</span>
                                    </button>
                                {/if}
                            </div>

                            {#if isSavingPreset}
                                <div class="flex items-center gap-2 pt-1">
                                    <input
                                        type="text"
                                        bind:value={newPresetName}
                                        placeholder="Name des neuen Presets eingeben..."
                                        class="flex-1 text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                    />
                                    <button
                                        type="button"
                                        onclick={handleSaveCustomPreset}
                                        class="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        Speichern
                                    </button>
                                    <button
                                        type="button"
                                        onclick={() => { isSavingPreset = false; newPresetName = ""; }}
                                        class="px-2 py-1.5 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                    >
                                        Abbrechen
                                    </button>
                                </div>
                            {/if}

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {#each allPresets as p (p.id)}
                                    <div
                                        role="button"
                                        tabindex="0"
                                        onclick={() => selectPreset(p.id)}
                                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectPreset(p.id); }}
                                        class="flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition {preset.id === p.id ? 'border-red-500 bg-red-50/50 dark:bg-red-950/40 text-red-900 dark:text-red-200 shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'}"
                                    >
                                        <div class="flex items-center gap-2.5 min-w-0">
                                            <div
                                                class="w-5 h-5 rounded-full border border-black/20 shrink-0"
                                                style="background-color: {p.lineColor};"
                                            ></div>
                                            <div class="truncate">
                                                <div class="text-xs font-bold truncate">{p.name}</div>
                                                <div class="text-[10px] text-slate-500">
                                                    {p.bgStyle === 'brick' ? 'Klinker-Muster' : 'Farbfläche'}
                                                </div>
                                            </div>
                                        </div>

                                        {#if customPresets.some((cp) => cp.id === p.id)}
                                            <button
                                                type="button"
                                                onclick={(e) => {
                                                    e.stopPropagation();
                                                    onDeletePreset?.(p.id);
                                                }}
                                                class="p-1 text-slate-400 hover:text-red-600 rounded"
                                                title="Preset löschen"
                                            >
                                                <Trash2 class="w-3.5 h-3.5" />
                                            </button>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Color Customization -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <!-- Line Color -->
                            <div class="space-y-1.5">
                                <div class="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Linien- & Akzentfarbe
                                </div>
                                <div class="flex items-center gap-2">
                                    <input
                                        type="color"
                                        bind:value={preset.lineColor}
                                        class="w-9 h-9 p-0.5 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
                                    />
                                    <input
                                        type="text"
                                        bind:value={preset.lineColor}
                                        class="flex-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase"
                                    />
                                </div>
                            </div>

                            <!-- Background Color -->
                            <div class="space-y-1.5">
                                <div class="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Hintergrundfarbe
                                </div>
                                <div class="flex items-center gap-2">
                                    <input
                                        type="color"
                                        bind:value={preset.bgColor}
                                        class="w-9 h-9 p-0.5 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
                                    />
                                    <input
                                        type="text"
                                        bind:value={preset.bgColor}
                                        class="flex-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase"
                                    />
                                </div>
                            </div>

                            <!-- Text Color -->
                            <div class="space-y-1.5">
                                <div class="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Textfarbe in CI-Bereichen
                                </div>
                                <div class="flex items-center gap-2">
                                    <input
                                        type="color"
                                        bind:value={preset.textColor}
                                        class="w-9 h-9 p-0.5 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
                                    />
                                    <input
                                        type="text"
                                        bind:value={preset.textColor}
                                        class="flex-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Pattern / Style -->
                        <div class="space-y-2">
                            <div class="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Hintergrund-Muster / Textur
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <label class="flex items-center gap-2 p-3 rounded-lg border cursor-pointer {preset.bgStyle === 'solid' ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700'}">
                                    <input
                                        type="radio"
                                        name="bgStyle"
                                        value="solid"
                                        checked={preset.bgStyle === "solid"}
                                        onchange={() => (preset.bgStyle = "solid")}
                                        class="text-red-600 focus:ring-red-500"
                                    />
                                    <span class="text-xs">Einfarbig (Hell / Sandfarben)</span>
                                </label>

                                <label class="flex items-center gap-2 p-3 rounded-lg border cursor-pointer {preset.bgStyle === 'brick' ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700'}">
                                    <input
                                        type="radio"
                                        name="bgStyle"
                                        value="brick"
                                        checked={preset.bgStyle === "brick"}
                                        onchange={() => (preset.bgStyle = "brick")}
                                        class="text-red-600 focus:ring-red-500"
                                    />
                                    <span class="text-xs">Klinkermuster (Ziegel-Struktur)</span>
                                </label>
                            </div>
                        </div>

                        <!-- Triangle Proportions / Height Sliders -->
                        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-4">
                            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Geometrie der Dreiecke (Höhe in mm)
                            </h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <!-- Top Triangle Height -->
                                <div class="space-y-1">
                                    <div class="flex justify-between text-xs font-medium text-slate-700">
                                        <span>Oberes Dreieck (Höhe links)</span>
                                        <span>{preset.topHeightMm} mm</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="25"
                                        max="60"
                                        bind:value={preset.topHeightMm}
                                        class="w-full accent-red-600"
                                    />
                                </div>

                                <!-- Bottom Triangle Height -->
                                <div class="space-y-1">
                                    <div class="flex justify-between text-xs font-medium text-slate-700">
                                        <span>Unteres Dreieck (Höhe rechts)</span>
                                        <span>{preset.bottomHeightMm} mm</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="25"
                                        max="60"
                                        bind:value={preset.bottomHeightMm}
                                        class="w-full accent-red-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- TAB 3: LOGOS & STANDORT -->
                {#if activeTab === "logos"}
                    <div class="space-y-5">
                        <!-- Location Logo -->
                        <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Standort-Logo (Oberes Dreieck, links)
                                </div>
                                <label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        bind:checked={preset.showLocationLogo}
                                        class="rounded text-red-600"
                                    />
                                    <span>Anzeigen</span>
                                </label>
                            </div>
                            <input
                                type="text"
                                bind:value={preset.locationLogoUrl}
                                placeholder="/logos/location-suedspitze.jpg oder URL"
                                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
                            />
                        </div>

                        <!-- Organization Logo (BALL e.V.) -->
                        <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Organisations-Logo (z. B. BALL e.V. - Oberes Dreieck, rechts)
                                </div>
                                <label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        bind:checked={preset.showOrgLogo}
                                        class="rounded text-red-600"
                                    />
                                    <span>Anzeigen</span>
                                </label>
                            </div>
                            <input
                                type="text"
                                bind:value={preset.orgLogoUrl}
                                placeholder="/logos/org-ball.png oder URL"
                                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
                            />
                        </div>

                        <!-- Inclusivity Info -->
                        <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Inklusions-Text (Unteres Dreieck, links)
                                </div>
                                <label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        bind:checked={preset.showInclusivityIcon}
                                        class="rounded text-red-600"
                                    />
                                    <span>Icon anzeigen</span>
                                </label>
                            </div>
                            <input
                                type="text"
                                bind:value={preset.inclusivityText}
                                placeholder="Barrierefreies Haus (oder wird aus Standort übernommen)"
                                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
                            />
                        </div>

                        <!-- Partner & Sponsor Logos (Center and Above Address) -->
                        <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div class="flex items-center justify-between">
                                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Partner- & Corporate-Logos (Unteres Dreieck)
                                </div>
                                <button
                                    type="button"
                                    onclick={addSponsor}
                                    class="px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                                >
                                    + Logo hinzufügen
                                </button>
                            </div>

                            <p class="text-[11px] text-slate-500">
                                Logos können im Zentrum des unteren Dreiecks oder über den Adressdaten platziert werden.
                            </p>

                            <div class="space-y-2">
                                {#each (preset.sponsors || []) as sponsor, i (sponsor.id)}
                                    <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                        <input
                                            type="text"
                                            bind:value={sponsor.name}
                                            placeholder="Name / Beschriftung"
                                            class="w-1/3 text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1"
                                        />
                                        <input
                                            type="text"
                                            bind:value={sponsor.logoUrl}
                                            placeholder="Logo Bild-URL (optional)"
                                            class="flex-1 text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1"
                                        />
                                        <select
                                            bind:value={sponsor.placement}
                                            class="text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1 bg-white dark:bg-slate-900"
                                        >
                                            <option value="center">Mitte</option>
                                            <option value="above_address">Über Adresse</option>
                                        </select>
                                        <button
                                            type="button"
                                            onclick={() => removeSponsor(i)}
                                            class="p-1 text-slate-400 hover:text-red-600"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-end px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onclick={() => (open = false)}
                    class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition shadow-2xs"
                >
                    Fertig
                </button>
            </div>
        </div>
    </div>
{/if}
