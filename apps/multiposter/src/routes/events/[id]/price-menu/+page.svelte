<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { LoadingSection, ErrorSection, getLastListUrl } from "@ac/ui";
    import { ArrowLeft, Printer, Plus, Trash2, Upload, ZoomIn, ZoomOut, RotateCcw } from "@lucide/svelte";
    import * as m from "#lib/paraglide/messages.js";
    import PriceMenuSheet from "#lib/components/prices/PriceMenuSheet.svelte";
    import {
        PRICE_MENU_ACCENTS,
        PRICE_MENU_PAPER,
        defaultPriceMenuSettings,
        type PriceMenuList,
        type PriceMenuPaperSize,
        type PriceMenuSettings,
    } from "#lib/utils/price-menu.js";
    import { readEvent } from "../read.remote";
    import { uploadMedia } from "../../../cms/media/create.remote";

    const eventId = $derived(page.params.id || "");
    const eventQuery = $derived(readEvent(eventId));

    // --- Settings (persisted per event in the browser) ---
    let settings = $state<PriceMenuSettings>(defaultPriceMenuSettings(m.price_menu_vat_default()));
    let zoom = $state(0.8);
    let settingsLoaded = $state(false);
    const storageKey = $derived(`price_menu_settings_${eventId}`);

    onMount(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) settings = { ...settings, ...JSON.parse(raw) };
        } catch (e) {
            console.error("Failed to load price menu settings", e);
        }
        settingsLoaded = true;
    });

    // Persist settings to localStorage (external system sync)
    $effect(() => {
        const snapshot = JSON.stringify($state.snapshot(settings));
        if (!settingsLoaded) return;
        try {
            localStorage.setItem(storageKey, snapshot);
        } catch (e) {
            console.warn("Could not persist price menu settings (quota exceeded?)", e);
        }
    });

    const paper = $derived(PRICE_MENU_PAPER[settings.paperSize]);

    const prices = $derived((eventQuery.current?.prices ?? []) as unknown as PriceMenuList[]);
    const visibleLists = $derived(prices.filter((p) => !settings.hiddenPriceIds.includes(p.id ?? "")));

    function toggleList(id: string, visible: boolean) {
        const hidden = settings.hiddenPriceIds.filter((h) => h !== id);
        settings.hiddenPriceIds = visible ? hidden : [...hidden, id];
    }

    function resetSettings() {
        settings = defaultPriceMenuSettings(m.price_menu_vat_default());
    }

    function setZoom(value: number) {
        zoom = Math.min(1.5, Math.max(0.3, Number(value.toFixed(2))));
    }

    // --- Sponsors ---
    function addSponsor() {
        settings.sponsors = [...settings.sponsors, { id: `sponsor-${Date.now()}`, name: "", logoUrl: "" }];
    }

    function removeSponsor(id: string) {
        settings.sponsors = settings.sponsors.filter((s) => s.id !== id);
    }

    function readAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    async function handleLogoUpload(input: HTMLInputElement, sponsorId: string) {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error(m.price_menu_image_only());
            return;
        }

        let url = await readAsDataUrl(file);
        if (!file.type.includes("svg")) {
            try {
                const res = await uploadMedia({ filename: file.name, contentType: file.type, content: url });
                if (res.success && res.urls?.default) url = res.urls.default;
            } catch {
                // keep the embedded data URL as fallback
            }
        }
        settings.sponsors = settings.sponsors.map((s) => (s.id === sponsorId ? { ...s, logoUrl: url } : s));
    }

    const paperOptions: PriceMenuPaperSize[] = ["A5", "A4", "A3"];
    const columnOptions = [1, 2, 3] as const;
    const sizeOptions = $derived([
        { value: "compact", label: m.price_menu_size_compact() },
        { value: "standard", label: m.price_menu_size_standard() },
        { value: "large", label: m.price_menu_size_large() },
    ] as const);

    const inputClass =
        "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-violet-500";
</script>

<svelte:head>
    <title>{m.price_menu_title()} – {eventQuery.current?.summary ?? ""}</title>
    {@html `<style>@page { size: ${paper.width}mm ${paper.height}mm; margin: ${paper.margin}mm; }</style>`}
</svelte:head>

{#snippet toggleRow(label: string, checked: boolean, onToggle: (value: boolean) => void, description?: string)}
    <label class="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-gray-50">
        <input
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            {checked}
            onchange={(e) => onToggle(e.currentTarget.checked)}
        />
        <span class="text-sm leading-snug text-gray-800">
            {label}
            {#if description}
                <span class="mt-0.5 block text-xs text-gray-500">{description}</span>
            {/if}
        </span>
    </label>
{/snippet}

{#snippet segmented(options: readonly { value: string | number; label: string }[], current: string | number, onSelect: (value: any) => void)}
    <div class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {#each options as option (option.value)}
            <button
                type="button"
                onclick={() => onSelect(option.value)}
                class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors {current === option.value
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'}"
            >
                {option.label}
            </button>
        {/each}
    </div>
{/snippet}

{#if eventQuery.loading && !eventQuery.current}
    <LoadingSection message={m.loading_event_data()} />
{:else if eventQuery.current}
    {@const event = eventQuery.current}
    <div class="flex min-h-screen flex-col bg-slate-100 print:block print:min-h-0 print:bg-white">
        <!-- Toolbar -->
        <header class="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur-md print:hidden">
            <div class="flex items-center gap-3">
                <a
                    href={`/events/${eventId}/view`}
                    class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                    <ArrowLeft size={16} />
                    {m.price_menu_back()}
                </a>
                <span class="hidden h-5 w-px bg-gray-200 sm:block"></span>
                <h1 class="hidden text-sm font-bold text-gray-900 sm:block">{m.price_menu_title()}</h1>
            </div>

            <div class="flex items-center gap-2">
                <div class="hidden items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 md:inline-flex" aria-label={m.price_menu_zoom()}>
                    <button type="button" class="cursor-pointer p-1.5 text-gray-500 hover:text-gray-900" onclick={() => setZoom(zoom - 0.1)} title="−">
                        <ZoomOut size={14} />
                    </button>
                    <span class="min-w-12 text-center font-mono text-[11px] text-gray-600">{Math.round(zoom * 100)}%</span>
                    <button type="button" class="cursor-pointer p-1.5 text-gray-500 hover:text-gray-900" onclick={() => setZoom(zoom + 0.1)} title="+">
                        <ZoomIn size={14} />
                    </button>
                </div>
                <button
                    type="button"
                    id="price-menu-print"
                    onclick={() => window.print()}
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-violet-700"
                >
                    <Printer size={15} />
                    {m.price_menu_print()}
                </button>
            </div>
        </header>

        <div class="flex flex-1 flex-col lg:flex-row print:block">
            <!-- Settings panel -->
            <aside class="w-full shrink-0 space-y-2 overflow-y-auto border-gray-200 bg-white p-4 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-80 lg:border-r print:hidden">
                <div class="flex items-center justify-between pb-1">
                    <p class="text-xs text-gray-500">{m.price_menu_print_hint()}</p>
                    <button
                        type="button"
                        class="ml-2 inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
                        onclick={resetSettings}
                        title={m.price_menu_reset()}
                    >
                        <RotateCcw size={12} />
                        {m.price_menu_reset()}
                    </button>
                </div>

                <!-- Price lists -->
                <details open class="rounded-xl border border-gray-200 p-3">
                    <summary class="cursor-pointer text-sm font-bold text-gray-900">{m.price_menu_section_lists()}</summary>
                    <div class="mt-2 space-y-0.5">
                        {#each prices as list (list.id ?? list.name)}
                            {@render toggleRow(
                                list.name,
                                !settings.hiddenPriceIds.includes(list.id ?? ""),
                                (value) => toggleList(list.id ?? "", value),
                            )}
                        {:else}
                            <p class="text-xs text-gray-500">{m.price_menu_no_prices()}</p>
                        {/each}
                    </div>
                </details>

                <!-- Layout -->
                <details open class="rounded-xl border border-gray-200 p-3">
                    <summary class="cursor-pointer text-sm font-bold text-gray-900">{m.price_menu_section_layout()}</summary>
                    <div class="mt-3 space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_paper()}</span>
                            {@render segmented(
                                paperOptions.map((p) => ({ value: p, label: p })),
                                settings.paperSize,
                                (value) => (settings.paperSize = value),
                            )}
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_columns()}</span>
                            {@render segmented(
                                columnOptions.map((c) => ({ value: c, label: String(c) })),
                                settings.columns,
                                (value) => (settings.columns = value),
                            )}
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_text_size()}</span>
                            {@render segmented(sizeOptions, settings.textScale, (value) => (settings.textScale = value))}
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_accent()}</span>
                            <div class="flex items-center gap-1.5">
                                {#each PRICE_MENU_ACCENTS as color (color)}
                                    <button
                                        type="button"
                                        aria-label={color}
                                        onclick={() => (settings.accent = color)}
                                        class="h-6 w-6 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 {settings.accent === color
                                            ? 'border-gray-900'
                                            : 'border-white ring-1 ring-gray-200'}"
                                        style="background-color: {color};"
                                    ></button>
                                {/each}
                            </div>
                        </div>
                    </div>
                </details>

                <!-- Header & event info -->
                <details open class="rounded-xl border border-gray-200 p-3">
                    <summary class="cursor-pointer text-sm font-bold text-gray-900">{m.price_menu_section_header()}</summary>
                    <div class="mt-3 space-y-3">
                        <label class="block space-y-1">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_headline()}</span>
                            <input
                                id="price-menu-title"
                                type="text"
                                class={inputClass}
                                bind:value={settings.title}
                                placeholder={m.price_menu_headline_placeholder()}
                            />
                        </label>
                        <label class="block space-y-1">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_subtitle()}</span>
                            <input id="price-menu-subtitle" type="text" class={inputClass} bind:value={settings.subtitle} />
                        </label>

                        <div class="space-y-0.5">
                            {@render toggleRow(m.price_menu_show_intro(), settings.showEventIntro, (v) => (settings.showEventIntro = v))}
                            {#if settings.showEventIntro}
                                <div class="space-y-0.5 pl-6">
                                    {@render toggleRow(m.price_menu_show_datetime(), settings.showDateTime, (v) => (settings.showDateTime = v))}
                                    {@render toggleRow(m.price_menu_show_location(), settings.showLocation, (v) => (settings.showLocation = v))}
                                    {@render toggleRow(m.price_menu_show_description(), settings.showDescription, (v) => (settings.showDescription = v))}
                                </div>
                            {/if}
                        </div>
                    </div>
                </details>

                <!-- Content -->
                <details open class="rounded-xl border border-gray-200 p-3">
                    <summary class="cursor-pointer text-sm font-bold text-gray-900">{m.price_menu_section_content()}</summary>
                    <div class="mt-3 space-y-3">
                        <div class="space-y-0.5">
                            {@render toggleRow(m.price_menu_group_sections(), settings.groupBySection, (v) => (settings.groupBySection = v))}
                            {@render toggleRow(m.price_menu_show_item_descriptions(), settings.showItemDescriptions, (v) => (settings.showItemDescriptions = v))}
                            {@render toggleRow(m.price_menu_show_portions(), settings.showPortions, (v) => (settings.showPortions = v))}
                            {@render toggleRow(m.price_menu_show_vat(), settings.showVatNote, (v) => (settings.showVatNote = v))}
                        </div>
                        {#if settings.showVatNote}
                            <label class="block space-y-1">
                                <span class="text-xs font-medium text-gray-600">{m.price_menu_vat_text()}</span>
                                <input id="price-menu-vat" type="text" class={inputClass} bind:value={settings.vatNote} />
                            </label>
                        {/if}
                        <label class="block space-y-1">
                            <span class="text-xs font-medium text-gray-600">{m.price_menu_footer_note()}</span>
                            <textarea id="price-menu-footer" rows="2" class={inputClass} bind:value={settings.footerNote}></textarea>
                        </label>
                    </div>
                </details>

                <!-- Tallies -->
                <details open class="rounded-xl border border-gray-200 p-3">
                    <summary class="cursor-pointer text-sm font-bold text-gray-900">{m.price_menu_section_tallies()}</summary>
                    <div class="mt-2 space-y-0.5">
                        {@render toggleRow(
                            m.price_menu_show_tallies(),
                            settings.showSaleTallies,
                            (v) => (settings.showSaleTallies = v),
                            m.price_menu_show_tallies_desc(),
                        )}
                        {@render toggleRow(
                            m.price_menu_show_stats(),
                            settings.showStatistics,
                            (v) => (settings.showStatistics = v),
                            m.price_menu_show_stats_desc(),
                        )}
                    </div>
                </details>

                <!-- Sponsors -->
                <details class="rounded-xl border border-gray-200 p-3" open={settings.showSponsors}>
                    <summary class="cursor-pointer text-sm font-bold text-gray-900">{m.price_menu_section_sponsors()}</summary>
                    <div class="mt-2 space-y-3">
                        {@render toggleRow(m.price_menu_show_sponsors(), settings.showSponsors, (v) => (settings.showSponsors = v))}
                        {#if settings.showSponsors}
                            <label class="block space-y-1">
                                <span class="text-xs font-medium text-gray-600">{m.price_menu_sponsor_title()}</span>
                                <input
                                    id="price-menu-sponsor-title"
                                    type="text"
                                    class={inputClass}
                                    bind:value={settings.sponsorTitle}
                                    placeholder={m.price_menu_sponsor_default()}
                                />
                            </label>
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-xs font-medium text-gray-600">{m.price_menu_sponsor_position()}</span>
                                {@render segmented(
                                    [
                                        { value: "header", label: m.price_menu_position_header() },
                                        { value: "footer", label: m.price_menu_position_footer() },
                                    ],
                                    settings.sponsorPosition,
                                    (value) => (settings.sponsorPosition = value),
                                )}
                            </div>

                            {#each settings.sponsors as sponsor (sponsor.id)}
                                <div class="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
                                    <div class="flex items-center gap-2">
                                        <input
                                            type="text"
                                            class={inputClass}
                                            bind:value={sponsor.name}
                                            placeholder={m.price_menu_sponsor_name()}
                                            aria-label={m.price_menu_sponsor_name()}
                                        />
                                        <button
                                            type="button"
                                            class="shrink-0 cursor-pointer rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                            onclick={() => removeSponsor(sponsor.id)}
                                            title={m.remove()}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        {#if sponsor.logoUrl}
                                            <img src={sponsor.logoUrl} alt={sponsor.name} class="h-8 max-w-20 rounded border border-gray-200 bg-white object-contain p-0.5" />
                                        {/if}
                                        <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                                            <Upload size={13} />
                                            {m.price_menu_upload_logo()}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                class="hidden"
                                                onchange={(e) => handleLogoUpload(e.currentTarget, sponsor.id)}
                                            />
                                        </label>
                                    </div>
                                </div>
                            {/each}

                            <button
                                type="button"
                                class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900"
                                onclick={addSponsor}
                            >
                                <Plus size={14} />
                                {m.price_menu_add_sponsor()}
                            </button>
                        {/if}
                    </div>
                </details>
            </aside>

            <!-- Paper preview -->
            <main class="flex-1 overflow-auto p-4 sm:p-8 print:overflow-visible print:p-0">
                {#if prices.length === 0}
                    <p class="py-20 text-center text-sm text-gray-500 print:hidden">{m.price_menu_no_prices()}</p>
                {:else if visibleLists.length === 0}
                    <p class="py-20 text-center text-sm text-gray-500 print:hidden">{m.price_menu_no_selection()}</p>
                {:else}
                    <div class="zoomed" style="--zoom: {zoom};">
                        <div class="paper mx-auto w-fit shadow-xl ring-1 ring-black/5 print:shadow-none print:ring-0">
                            <PriceMenuSheet {event} lists={visibleLists} {settings} />
                        </div>
                    </div>
                {/if}
            </main>
        </div>
    </div>
{:else if eventQuery.current === null}
    <ErrorSection
        headline={m.event_not_found()}
        message={m.event_not_found_message()}
        href={getLastListUrl("events", "/events")}
        button={m.back_to_events()}
    />
{:else if eventQuery.error}
    <ErrorSection
        headline={m.error()}
        message={eventQuery.error?.message || m.failed_to_load_event()}
        href={getLastListUrl("events", "/events")}
        button={m.back_to_events()}
    />
{/if}

<style>
    .zoomed {
        zoom: var(--zoom);
    }

    @media print {
        .zoomed {
            zoom: 1;
        }
    }
</style>
