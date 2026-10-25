<script lang="ts">
    import type { KioskElementSettings } from "./types.js";
    import { applyQuickPrintPreset } from "./types.js";
    import ElementSettingsRow from "./ElementSettingsRow.svelte";
    import {
        Palette,
        Compass,
        Calendar,
        Image as ImageIcon,
        QrCode,
        Building2,
        Clock,
        LayoutTemplate,
        FoldVertical,
        Sparkles,
        FileText,
        Printer,
        CheckCircle2,
        Eye
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    let {
        elementSettings = $bindable(),
        previewGreyscaleOnScreen = $bindable(false),
        isFlyer = false,
        onSettingsChange
    }: {
        elementSettings: KioskElementSettings;
        previewGreyscaleOnScreen?: boolean;
        isFlyer?: boolean;
        onSettingsChange?: () => void;
    } = $props();

    function triggerQuickPreset(presetKey: 'all_color' | 'letterhead_ci' | 'greyscale_content' | 'all_greyscale' | 'ci_only', label: string) {
        elementSettings = applyQuickPrintPreset(elementSettings, presetKey);
        onSettingsChange?.();
        toast.success(`Druckmodus „${label}“ angewendet`);
    }
</script>

<div class="space-y-6">
    <!-- Quick Presets Toolbar -->
    <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles class="w-3.5 h-3.5 text-amber-500" />
                    <span>Schnell-Aktionen & Druck-Modi</span>
                </h3>
                <p class="text-[11px] text-slate-500">
                    Wenden Sie vorkonfigurierte Druckprofile mit einem Klick auf alle Elemente an.
                </p>
            </div>

            <!-- On-Screen Greyscale Simulator Toggle -->
            <label class="inline-flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300">
                <input
                    type="checkbox"
                    bind:checked={previewGreyscaleOnScreen}
                    onchange={() => onSettingsChange?.()}
                    class="rounded text-purple-600 focus:ring-purple-500"
                />
                <Eye class="w-3.5 h-3.5 text-purple-600" />
                <span>Druck-Graustufen am Bildschirm simulieren</span>
            </label>
        </div>

        <div class="flex items-center gap-2 flex-wrap pt-1">
            <button
                type="button"
                onclick={() => triggerQuickPreset('all_color', 'Alles Vollfarbe')}
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
            >
                <span>🟢 Alles Farbe & Normal</span>
            </button>

            <button
                type="button"
                onclick={() => triggerQuickPreset('letterhead_ci', 'Vordruck-Briefpapier')}
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-500 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
            >
                <span>📄 Vordruck-Briefpapier (CI Raum frei)</span>
            </button>

            <button
                type="button"
                onclick={() => triggerQuickPreset('greyscale_content', 'Spartoner (CI farbig)')}
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
            >
                <span>💧 Spartoner (Inhalt S/W, CI Farbe)</span>
            </button>

            <button
                type="button"
                onclick={() => triggerQuickPreset('all_greyscale', '100% Schwarz/Weiß')}
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
            >
                <span>⚫ Alles Schwarz/Weiß</span>
            </button>

            <button
                type="button"
                onclick={() => triggerQuickPreset('ci_only', 'Nur CI drucken')}
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
            >
                <span>🎨 Nur CI drucken (Shells erstellen)</span>
            </button>
        </div>
    </div>

    <!-- Section 1: Corporate Identity & Branding -->
    <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Palette class="w-3.5 h-3.5 text-red-600" />
            <span>Corporate Identity & Branding</span>
        </h4>

        <div class="space-y-2">
            <!-- CI Top Triangle -->
            <ElementSettingsRow
                title="CI Kopfbereich (Oberes Dreieck)"
                description="Standort-Logo & BALL e.V. Logo im geometrischen Vektor-Dreieck"
                icon={Palette}
                bind:config={elementSettings.ciTop}
            />

            <!-- CI Bottom Triangle -->
            <ElementSettingsRow
                title="CI Fußbereich (Unteres Dreieck)"
                description="Inklusions-Hinweis, Sponsoren-Logos & Standort-Adressblock"
                icon={Building2}
                bind:config={elementSettings.ciBottom}
            />
        </div>
    </div>

    <!-- Section 2: Programme Content & Structure -->
    <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Calendar class="w-3.5 h-3.5 text-blue-600" />
            <span>Programm & Inhalte</span>
        </h4>

        <div class="space-y-2">
            <!-- Header & Headline -->
            <ElementSettingsRow
                title="Programm-Kopfzeile & Datumsbadge"
                description="Monats-Titel, Unterzeile und Datumsspanne"
                icon={FileText}
                bind:config={elementSettings.header}
            />

            <!-- Events Grid -->
            <ElementSettingsRow
                title="Veranstaltungsübersicht (Termine)"
                description="Termin-Karten mit Datumspille, Uhrzeiten, Räumen & Titeln"
                icon={Calendar}
                bind:config={elementSettings.events}
            />

            <!-- Location Details & Contacts -->
            <ElementSettingsRow
                title="Standort & Ansprechpartner"
                description="Kontaktkarte, Telefon, E-Mail und Adressdaten"
                icon={Compass}
                bind:config={elementSettings.locationDetails}
            />

            <!-- Opening Hours -->
            <ElementSettingsRow
                title="Öffnungszeiten"
                description="Reguläre Öffnungszeiten des Bürgerhauses"
                icon={Clock}
                bind:config={elementSettings.openingHours}
            />
        </div>
    </div>

    <!-- Section 3: Media & Graphics -->
    <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ImageIcon class="w-3.5 h-3.5 text-emerald-600" />
            <span>Medien, Bilder & QR-Codes</span>
        </h4>

        <div class="space-y-2">
            <!-- Hero Images -->
            <ElementSettingsRow
                title="Event-Vorschaubilder (Fotos)"
                description="Farbige Bilder bei Veranstaltungen (hoher Tonerverbrauch)"
                icon={ImageIcon}
                bind:config={elementSettings.heroImages}
            />

            <!-- QR Codes -->
            <ElementSettingsRow
                title="QR-Codes (Kalender & Termine)"
                description="Scanbare QR-Codes für Smartphones"
                icon={QrCode}
                bind:config={elementSettings.qrCodes}
            />

            <!-- Additional Sponsors -->
            <ElementSettingsRow
                title="Sponsoren & Förderer-Logos"
                description="Zusätzliche Förderer-Logos in Kopf- oder Fußzeilen"
                icon={Sparkles}
                bind:config={elementSettings.sponsors}
            />
        </div>
    </div>

    <!-- Section 4: Custom Sections & Guides -->
    <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <LayoutTemplate class="w-3.5 h-3.5 text-amber-600" />
            <span>Zusatzbereiche & Druckmarken</span>
        </h4>

        <div class="space-y-2">
            <!-- Custom Sections -->
            <ElementSettingsRow
                title="Eigene Abschnitte & Banner"
                description="Benutzerdefinierte Zusatzblöcke im Layout"
                icon={LayoutTemplate}
                bind:config={elementSettings.customSections}
            />

            <!-- Fold Guides (Flyer only) -->
            {#if isFlyer}
                <ElementSettingsRow
                    title="Falzmarken & Hilfslinien"
                    description="Gedruckte Markierungen für die Wickelfalz"
                    icon={FoldVertical}
                    bind:config={elementSettings.foldGuides}
                />
            {/if}
        </div>
    </div>
</div>
