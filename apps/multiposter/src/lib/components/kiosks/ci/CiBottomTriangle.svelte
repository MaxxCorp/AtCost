<script lang="ts">
    import type { CiPreset, PrintMode, CiSponsorItem } from "./types.js";

    let {
        preset,
        printMode = "all_color",
        locationName = "Bürgerhaus Südspitze",
        street = "Marchwitzastraße 24-26",
        houseNumber = "",
        zip = "12681",
        city = "Berlin",
        phone = "030 / 5422155",
        inclusivityText = "",
        sponsors = [],
        partnerLogoUrl = "",
        heightMm: explicitHeightMm,
        variant = "auto",
        class: extraClass = ""
    }: {
        preset: CiPreset;
        printMode?: PrintMode;
        locationName?: string;
        street?: string | null;
        houseNumber?: string | null;
        zip?: string | null;
        city?: string | null;
        phone?: string | null;
        inclusivityText?: string | null;
        sponsors?: CiSponsorItem[];
        partnerLogoUrl?: string | null;
        heightMm?: number;
        variant?: "auto" | "flyer" | "poster";
        class?: string;
    } = $props();

    let effectiveInclusivity = $derived(
        inclusivityText?.trim() || preset.inclusivityText || "Barrierefreies Haus"
    );

    let effectiveStreet = $derived(
        street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}` : "Marchwitzastraße 24-26"
    );
    let effectiveCity = $derived(zip || city ? `${zip || ""} ${city || ""}`.trim() : "12681 Berlin");
    let effectivePhone = $derived(phone || "Tel. 030 / 5422155");

    let heightMm = $derived(explicitHeightMm || preset.bottomHeightMm || 34);
    let isPoster = $derived(variant === "poster" || (variant === "auto" && heightMm >= 38));

    let centerSponsors = $derived(
        sponsors.filter((s) => Boolean(s.logoUrl?.trim()) && s.placement !== "above_address")
    );
    let aboveAddressSponsors = $derived(
        sponsors.filter((s) => Boolean(s.logoUrl?.trim()) && s.placement === "above_address")
    );
</script>

<div
    class="ci-bottom-triangle-container relative w-full overflow-hidden shrink-0 {extraClass} {printMode === 'omit_ci' ? 'print:invisible' : ''}"
    style="height: {heightMm}mm;"
    data-ci-area="bottom"
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
                    id="ci-bottom-brick-pattern-{preset.id}"
                    width="16"
                    height="8"
                    patternUnits="userSpaceOnUse"
                >
                    <rect width="16" height="8" fill={preset.bgColor} />
                    <path
                        d="M 0 4 L 16 4 M 8 0 L 8 4 M 0 8 L 16 8 M 0 4 L 0 8 M 16 4 L 16 8"
                        stroke={preset.lineColor}
                        stroke-width="0.6"
                        stroke-opacity="0.25"
                        fill="none"
                    />
                </pattern>
            {/if}
        </defs>

        <!-- Pure Right-Angled Triangle: (0,100) -> (100,0) -> (100,100) -> Z -->
        <polygon
            points="0,100 100,0 100,100"
            fill={preset.bgStyle === "brick" ? `url(#ci-bottom-brick-pattern-${preset.id})` : preset.bgColor}
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

    <!-- Overlay Content strictly fitted inside triangle bounds -->
    <div class="relative z-10 w-full h-full select-text">
        <!-- Zone 1 & 2: Inclusivity Support (starts at left: 14%, bottom: 1.5mm, fits in lower-left wedge) -->
        <div
            class="absolute left-[12%] sm:left-[15%] bottom-[1.5mm] flex items-center gap-1 max-w-[30%]"
        >
            {#if preset.showInclusivityIcon}
                <svg
                    class="{isPoster ? 'w-3 h-3' : 'w-2.5 h-2.5'} shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={preset.lineColor}
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="12" cy="4" r="2" />
                    <path d="m18 19 1-7-6 1" />
                    <path d="m5 8 3-3 5.5 3-2.36 3.5" />
                    <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
                    <path d="M13.76 17.5a5 5 0 0 0-1.76-3.5" />
                </svg>
            {/if}
            <span
                class="{isPoster ? 'text-[9.5px] sm:text-[10.5px]' : 'text-[7.5px] sm:text-[8px]'} font-semibold leading-none tracking-tight truncate"
                style="color: {preset.textColor};"
            >
                {effectiveInclusivity}
            </span>
        </div>

        <!-- Zone 3: Center Corporate & Partner Sponsors (left: 45% to 66%, bottom: 1.5mm) -->
        {#if centerSponsors.length > 0}
            <div
                class="absolute left-[44%] sm:left-[46%] bottom-[1.5mm] flex items-end justify-center gap-2 max-w-[22%] overflow-hidden"
            >
                {#each centerSponsors as sponsor (sponsor.id)}
                    {#if sponsor.logoUrl}
                        <img
                            src={sponsor.logoUrl}
                            alt={sponsor.name}
                            class="{isPoster ? 'h-[10mm] max-h-[38px] max-w-[85px]' : 'h-[6.5mm] max-h-[25px] max-w-[55px]'} w-auto object-contain {sponsor.grayscaleInPrint ? 'print:grayscale' : ''} {sponsor.hideInPrint ? 'print:hidden' : ''}"
                        />
                    {/if}
                {/each}
            </div>
        {/if}

        <!-- Zone 4: Right Corner (tallest area: right: 2.5%, bottom: 1.5mm) -->
        <div
            class="absolute right-[2.5%] sm:right-[3%] bottom-[1.5mm] sm:bottom-[2mm] flex flex-col items-end gap-0.5 max-w-[42%] sm:max-w-[40%] text-right"
        >
            <!-- Partner Logo above address -->
            {#if partnerLogoUrl || aboveAddressSponsors.length > 0}
                <div class="flex items-center justify-end gap-1.5 pb-0.5">
                    {#if partnerLogoUrl}
                        <img
                            src={partnerLogoUrl}
                            alt="Partner Logo"
                            class="{isPoster ? 'h-[9mm] max-h-[34px] max-w-[90px]' : 'h-[6mm] max-h-[22px] max-w-[65px]'} w-auto object-contain object-right"
                        />
                    {/if}
                    {#each aboveAddressSponsors as s (s.id)}
                        {#if s.logoUrl}
                            <img
                                src={s.logoUrl}
                                alt={s.name}
                                class="{isPoster ? 'h-[9mm] max-h-[34px] max-w-[85px]' : 'h-[6mm] max-h-[22px] max-w-[60px]'} w-auto object-contain object-right {s.grayscaleInPrint ? 'print:grayscale' : ''} {s.hideInPrint ? 'print:hidden' : ''}"
                            />
                        {/if}
                    {/each}
                </div>
            {/if}

            <!-- Address Block (enlarged by 50%) -->
            <div
                class="{isPoster ? 'text-[13.5px] sm:text-[15px] space-y-0.5' : 'text-[10px] sm:text-[11px] space-y-0.5'} font-medium leading-[1.25] select-text"
                style="color: {preset.textColor};"
            >
                {#if locationName}
                    <div class="font-bold truncate max-w-full">{locationName}</div>
                {/if}
                {#if effectiveStreet}
                    <div class="truncate max-w-full">{effectiveStreet}</div>
                {/if}
                {#if effectiveCity}
                    <div class="truncate max-w-full">{effectiveCity}</div>
                {/if}
                {#if effectivePhone}
                    <div class="truncate max-w-full">{effectivePhone}</div>
                {/if}
            </div>
        </div>
    </div>

    <!-- On-screen indicator when in Pre-printed Stationery mode -->
    {#if printMode === "omit_ci"}
        <div class="print:hidden absolute inset-0 flex items-center justify-center bg-purple-900/10 border-t border-dashed border-purple-500/50 text-purple-700 dark:text-purple-300 text-[10px] font-mono select-none pointer-events-none">
            <span>✂️ Vorgedruckter Fußbereich (wird beim Drucken freigelassen)</span>
        </div>
    {/if}
</div>

<style>
    @media print {
        :global(.print-omit-ci) .ci-bottom-triangle-container {
            visibility: hidden !important;
        }
    }
</style>
