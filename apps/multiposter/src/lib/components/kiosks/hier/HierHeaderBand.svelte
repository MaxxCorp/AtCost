<script lang="ts">
	import HierLogo from './HierLogo.svelte';
	import HierRays from './HierRays.svelte';
	import {
		HIER_PALETTE,
		isHierGreyscaleActive,
		resolveHierLogoVariant,
		type HierCiPreset
	} from './types.js';
	import {
		getCardPrintClasses,
		type CardPrintConfig,
		type KioskElementSettings,
		type PrintMode
	} from '../ci/types.js';

	let {
		preset,
		printMode = 'all_color',
		locationName = '',
		customLocationLogo = '',
		customOrgLogo = '',
		heightMm: explicitHeightMm,
		variant = 'poster',
		class: extraClass = '',
		selectedCardId = null,
		cardSettings = {},
		elementSettings,
		previewGreyscaleOnScreen = false,
		onSelect
	}: {
		preset: HierCiPreset;
		printMode?: PrintMode;
		locationName?: string;
		customLocationLogo?: string | null;
		customOrgLogo?: string | null;
		heightMm?: number;
		variant?: 'flyer' | 'poster' | 'list';
		class?: string;
		selectedCardId?: string | null;
		cardSettings?: Record<string, CardPrintConfig>;
		elementSettings?: KioskElementSettings;
		previewGreyscaleOnScreen?: boolean;
		onSelect?: (id: string) => void;
	} = $props();

	let effectiveLocationLogo = $derived(
		customLocationLogo?.trim() || preset.locationLogoUrl?.trim() || ''
	);
	let effectiveOrgLogo = $derived(
		customOrgLogo?.trim() || preset.orgLogoUrl?.trim() || ''
	);
	let isMono = $derived(
		isHierGreyscaleActive(printMode, elementSettings?.ciTop?.printColor ?? 'color')
	);
	let effectiveHeaderBg = $derived(isMono ? '#f1f5f9' : preset.headerBg);
	let effectiveHeaderText = $derived(isMono ? '#111827' : preset.headerText);
	let effectiveLogoVariant = $derived(
		isMono ? 'mono' : resolveHierLogoVariant(preset.headerBg, false)
	);
	let defaultHeightMm = $derived(variant === 'flyer' ? 32 : variant === 'list' ? 28 : 40);
	let heightMm = $derived(explicitHeightMm ?? defaultHeightMm);
	let isFlyer = $derived(variant === 'flyer');
	let isList = $derived(variant === 'list');
</script>

<div
	class="ci-top-triangle-container relative w-full overflow-hidden shrink-0 {extraClass} {printMode === 'omit_ci' ? 'print:invisible' : ''}"
	style="height: {heightMm}mm; background-color: {effectiveHeaderBg}; color: {effectiveHeaderText};"
	data-ci-area="hier-top"
>
	<!-- Subtle geometric rays watermark in background -->
	<div class="pointer-events-none absolute -right-4 -top-4 opacity-20">
		<HierRays mono={isMono} class={isFlyer ? 'w-24 h-24' : 'w-36 h-36'} />
	</div>

	<!-- Header Content Row -->
	<div
		class="relative z-10 w-full h-full flex items-center justify-between {isFlyer ? 'px-3.5 py-2' : isList ? 'px-5 py-2.5' : 'px-7 py-3'}"
	>
		<!-- Left: Official HIER in Marzahn-Süd Logo -->
		<div class="flex items-center gap-3 min-w-0 h-full">
			<HierLogo
				variant={effectiveLogoVariant}
				subtitle={preset.subtitle}
				class="h-full w-auto max-h-[82%] shrink-0"
			/>
		</div>

		<!-- Right: Social Organization / Carrier Logo & Location Logo -->
		<div class="flex items-center gap-2.5 shrink-0 h-full">
			{#if preset.showOrgLogo && effectiveOrgLogo}
				<div
					role="button"
					tabindex="0"
					onclick={(e) => {
						e.stopPropagation();
						onSelect?.('org_logo');
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							e.stopPropagation();
							onSelect?.('org_logo');
						}
					}}
					class="rounded-lg bg-white/95 p-1.5 shadow-xs transition-all outline-hidden {onSelect ? 'cursor-pointer hover:ring-2 hover:ring-amber-300' : ''} {selectedCardId === 'org_logo' ? 'ring-2 ring-amber-400 print:ring-0' : ''} {getCardPrintClasses(cardSettings?.['org_logo'], elementSettings?.header, previewGreyscaleOnScreen)}"
					title="Träger- / Organisationslogo"
				>
					<img
						src={effectiveOrgLogo}
						alt="Träger Logo"
						class="{isFlyer ? 'h-[11mm] max-w-[68px]' : 'h-[16mm] max-w-[120px]'} w-auto object-contain"
					/>
				</div>
			{/if}

			{#if preset.showLocationLogo && effectiveLocationLogo}
				<div
					role="button"
					tabindex="0"
					onclick={(e) => {
						e.stopPropagation();
						onSelect?.('location_logo');
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							e.stopPropagation();
							onSelect?.('location_logo');
						}
					}}
					class="rounded-lg bg-white/95 p-1.5 shadow-xs transition-all outline-hidden {onSelect ? 'cursor-pointer hover:ring-2 hover:ring-amber-300' : ''} {selectedCardId === 'location_logo' ? 'ring-2 ring-amber-400 print:ring-0' : ''} {getCardPrintClasses(cardSettings?.['location_logo'], elementSettings?.header, previewGreyscaleOnScreen)}"
					title="Standortlogo"
				>
					<img
						src={effectiveLocationLogo}
						alt={locationName || 'Standortlogo'}
						class="{isFlyer ? 'h-[11mm] max-w-[74px]' : 'h-[16mm] max-w-[130px]'} w-auto object-contain"
					/>
				</div>
			{:else if locationName && !isFlyer}
				<div class="text-right max-w-[200px]">
					<div
						class="text-xs font-extrabold uppercase tracking-wider leading-tight line-clamp-2"
						style="color: {effectiveHeaderText};"
					>
						{locationName}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Signature 3-Color Accent Stripe along bottom edge -->
	<div class="absolute bottom-0 inset-x-0 h-[3.5px] flex z-20">
		<div class="flex-1" style="background-color: {isMono ? '#333333' : HIER_PALETTE.pink};"></div>
		<div class="flex-1" style="background-color: {isMono ? '#777777' : HIER_PALETTE.yellow};"></div>
		<div class="flex-1" style="background-color: {isMono ? '#555555' : HIER_PALETTE.green};"></div>
	</div>

	{#if printMode === 'omit_ci'}
		<div
			class="print:hidden absolute inset-0 z-30 flex items-center justify-center bg-purple-900/15 border-b border-dashed border-purple-500/60 text-purple-900 dark:text-purple-200 text-[10px] font-mono select-none pointer-events-none"
		>
			<span>✂️ Vorgedruckter HIER.-Briefkopf (wird beim Drucken freigelassen)</span>
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
