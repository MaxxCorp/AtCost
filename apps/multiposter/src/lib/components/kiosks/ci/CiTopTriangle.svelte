<script lang="ts">
    import { getCardPrintClasses, type CiPreset, type PrintMode, type CardPrintConfig, type KioskElementSettings } from "./types.js";

    let {
        preset,
        printMode = "all_color",
        locationName = "Bürgerhaus Südspitze",
        customLocationLogo = "",
        customOrgLogo = "",
        showLocationTitle = false,
        heightMm: explicitHeightMm,
        variant = "auto",
        class: extraClass = "",
        selectedCardId = null,
        cardSettings = {},
        elementSettings,
        previewGreyscaleOnScreen = false,
        onSelect
    }: {
        preset: CiPreset;
        printMode?: PrintMode;
        locationName?: string;
        customLocationLogo?: string | null;
        customOrgLogo?: string | null;
        showLocationTitle?: boolean;
        heightMm?: number;
        variant?: "auto" | "flyer" | "poster";
        class?: string;
        selectedCardId?: string | null;
        cardSettings?: Record<string, CardPrintConfig>;
        elementSettings?: KioskElementSettings;
        previewGreyscaleOnScreen?: boolean;
        onSelect?: (id: string) => void;
    } = $props();

    let effectiveLocationLogo = $derived(customLocationLogo || preset.locationLogoUrl || "/logos/location-suedspitze.jpg");
    let effectiveOrgLogo = $derived(customOrgLogo || preset.orgLogoUrl || "/logos/org-ball.png");

    let heightMm = $derived(explicitHeightMm || preset.topHeightMm || 36);
    let isPoster = $derived(variant === "poster" || (variant === "auto" && heightMm >= 40));
    let isA3 = $derived(isPoster && heightMm >= 50);
</script>

<div
    class="ci-top-triangle-container relative w-full overflow-hidden shrink-0 {extraClass} {printMode === 'omit_ci' ? 'print:invisible' : ''}"
    style="height: {heightMm}mm;"
    data-ci-area="top"
>
    <!-- SVG Vector Shape for Crisp Print -->
    <svg
        class="absolute inset-0 w-full h-full pointer-events-none ci-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
    >
        <defs>
            {#if preset.bgStyle === "brick"}
                <pattern
                    id="ci-top-brick-pattern-{preset.id}"
                    width="16"
                    height="8"
                    patternUnits="userSpaceOnUse"
                >
                    <rect width="16" height="8" fill={preset.bgColor} />
                    <path
                        d="M 0 4 L 16 4 M 8 0 L 8 4 M 0 8 L 16 8 M 0 4 L 16 4 M 8 0 L 8 4 M 0 8 L 16 8"
                        stroke={preset.lineColor}
                        stroke-width="0.6"
                        stroke-opacity="0.25"
                        fill="none"
                    />
                </pattern>
            {/if}
        </defs>

        <!-- Pure Right-Angled Triangle: (0,0) -> (100,0) -> (0,100) -> Z -->
        <polygon
            points="0,0 100,0 0,100"
            fill={preset.bgStyle === "brick" ? `url(#ci-top-brick-pattern-${preset.id})` : preset.bgColor}
        />

        <!-- High-DPI Dividing Stroke Line along hypotenuse from (0, 100) to (100, 0) -->
        <line
            x1="0"
            y1="100"
            x2="100"
            y2="0"
            stroke={preset.lineColor}
            stroke-width="2"
            vector-effect="non-scaling-stroke"
        />
    </svg>

    <!-- Overlay Content positioned strictly inside the triangle bounds -->
    <div class="relative z-10 w-full h-full select-text">
        <!-- Zone 1: Location Logo & Location Name (Left edge: x = 2.5% to ~40%) -->
        {#if preset.showLocationLogo}
            <div
                class="absolute left-[2.5%] sm:left-[3%] top-[3%] flex flex-col items-start"
                style="max-width: {isPoster ? '42%' : '44%'}; max-height: 94%;"
            >
                {#if effectiveLocationLogo}
                    <div
                        role="button"
                        tabindex="0"
                        onclick={(e) => { e.stopPropagation(); onSelect?.('location_logo'); }}
                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect?.('location_logo'); } }}
                        class="transition-all rounded-sm p-0.5 outline-hidden {onSelect ? 'cursor-pointer hover:ring-1 hover:ring-amber-300/70' : ''} {selectedCardId === 'location_logo' ? 'ring-2 ring-amber-400 bg-amber-500/10 print:ring-0 print:bg-transparent' : ''} {getCardPrintClasses(cardSettings?.['location_logo'], elementSettings?.header, previewGreyscaleOnScreen)}"
                        title="Standortlogo (Klicken für Druck- & Farbeinstellungen)"
                    >
                        <img
                            src={effectiveLocationLogo}
                            alt={locationName}
                            class="{isA3 ? 'h-[30mm] max-h-[115px] max-w-[240px]' : isPoster ? 'h-[25mm] max-h-[96px] max-w-[200px]' : 'h-[17mm] max-h-[66px] max-w-[140px]'} w-auto object-contain object-left-top"
                        />
                    </div>
                {/if}
                {#if (showLocationTitle || !effectiveLocationLogo) && locationName}
                    <span
                        class="{isPoster ? 'text-[12px] sm:text-[14px]' : 'text-[9px] sm:text-[10px]'} font-bold tracking-tight font-serif leading-tight mt-0.5 truncate max-w-full"
                        style="color: {preset.textColor};"
                    >
                        {locationName}
                    </span>
                {/if}
            </div>
        {/if}

        <!-- Zone 2: Org Logo (BALL e.V.), horizontally positioned in upper triangle wedge -->
        {#if preset.showOrgLogo && effectiveOrgLogo}
            <div
                class="absolute {isPoster ? 'left-[38%] sm:left-[40%]' : 'left-[45%] sm:left-[46%]'} top-[3%] flex items-start justify-start"
                style="max-width: {isPoster ? '25%' : '22%'};"
            >
                <div
                    role="button"
                    tabindex="0"
                    onclick={(e) => { e.stopPropagation(); onSelect?.('org_logo'); }}
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect?.('org_logo'); } }}
                    class="transition-all rounded-sm p-0.5 outline-hidden {onSelect ? 'cursor-pointer hover:ring-1 hover:ring-amber-300/70' : ''} {selectedCardId === 'org_logo' ? 'ring-2 ring-amber-400 bg-amber-500/10 print:ring-0 print:bg-transparent' : ''} {getCardPrintClasses(cardSettings?.['org_logo'], elementSettings?.header, previewGreyscaleOnScreen)}"
                    title="Organisationslogo (Klicken für Druck- & Farbeinstellungen)"
                >
                    <img
                        src={effectiveOrgLogo}
                        alt="Organisation Logo"
                        class="{isA3 ? 'h-[20mm] max-h-[78px] max-w-[150px]' : isPoster ? 'h-[17mm] max-h-[66px] max-w-[130px]' : 'h-[11mm] max-h-[44px] max-w-[85px]'} w-auto object-contain object-left-top"
                    />
                </div>
            </div>
        {/if}

        <!-- Zone 3: (x = 65% to 100%) tapers to 0 at top-right corner, kept cleanly empty -->
    </div>

    <!-- On-screen indicator when in Pre-printed Stationery mode -->
    {#if printMode === "omit_ci"}
        <div class="print:hidden absolute inset-0 flex items-center justify-center bg-purple-900/10 border-b border-dashed border-purple-500/50 text-purple-700 dark:text-purple-300 text-[10px] font-mono select-none pointer-events-none">
            <span>✂️ Vorgedruckter Briefkopf (wird beim Drucken freigelassen)</span>
        </div>
    {/if}
</div>

<style>
    @media print {
        :global(.print-omit-ci) .ci-top-triangle-container {
            visibility: hidden !important;
        }
    }
</style>
