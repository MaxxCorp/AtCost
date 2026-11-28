<script lang="ts">
	import {
		HIER_PALETTE,
		isHierGreyscaleActive,
		type HierCiPreset
	} from './types.js';
	import {
		getCardPrintClasses,
		type CardPrintConfig,
		type CiSponsorItem,
		type KioskElementSettings,
		type PrintMode
	} from '../ci/types.js';

	let {
		preset,
		printMode = 'all_color',
		locationName = '',
		street = '',
		houseNumber = '',
		zip = '',
		city = '',
		phone = '',
		inclusivityText = '',
		sponsors = [],
		partnerLogoUrl = '',
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
		street?: string | null;
		houseNumber?: string | null;
		zip?: string | null;
		city?: string | null;
		phone?: string | null;
		inclusivityText?: string | null;
		sponsors?: CiSponsorItem[];
		partnerLogoUrl?: string | null;
		heightMm?: number;
		variant?: 'flyer' | 'poster' | 'list';
		class?: string;
		selectedCardId?: string | null;
		cardSettings?: Record<string, CardPrintConfig>;
		elementSettings?: KioskElementSettings;
		previewGreyscaleOnScreen?: boolean;
		onSelect?: (id: string) => void;
	} = $props();

	let isMono = $derived(
		isHierGreyscaleActive(printMode, elementSettings?.ciBottom?.printColor ?? 'color')
	);
	let effectiveInclusivity = $derived(
		inclusivityText?.trim() || preset.inclusivityText?.trim() || 'Barrierefreies Haus'
	);
	let effectiveStreet = $derived(
		street ? `${street}${houseNumber ? ` ${houseNumber}` : ''}` : ''
	);
	let effectiveCity = $derived(zip || city ? `${zip || ''} ${city || ''}`.trim() : '');
	let defaultHeightMm = $derived(variant === 'flyer' ? 28 : variant === 'list' ? 24 : 34);
	let heightMm = $derived(explicitHeightMm ?? defaultHeightMm);
	let isFlyer = $derived(variant === 'flyer');

	let centerSponsors = $derived(
		sponsors.filter((s) => Boolean(s.logoUrl?.trim()) && s.placement !== 'above_address')
	);
	let aboveAddressSponsors = $derived(
		sponsors.filter((s) => Boolean(s.logoUrl?.trim()) && s.placement === 'above_address')
	);
</script>

<div
	class="ci-bottom-triangle-container relative w-full overflow-hidden shrink-0 {extraClass} {printMode === 'omit_ci' ? 'print:invisible' : ''}"
	style="min-height: {heightMm}mm; background-color: {isMono ? '#f8fafc' : preset.surfaceBg}; color: {isMono ? '#111827' : HIER_PALETTE.charcoal};"
	data-ci-area="hier-bottom"
>
	<!-- Signature 3-Color Top Accent Rule -->
	<div class="w-full h-[3px] flex">
		<div class="flex-1" style="background-color: {isMono ? '#333333' : HIER_PALETTE.pink};"></div>
		<div class="flex-1" style="background-color: {isMono ? '#777777' : HIER_PALETTE.yellow};"></div>
		<div class="flex-1" style="background-color: {isMono ? '#555555' : HIER_PALETTE.green};"></div>
	</div>

	<div
		class="w-full h-full flex items-center justify-between gap-3 {isFlyer ? 'px-3.5 py-2' : 'px-7 py-3'}"
	>
		<!-- Left: Inclusivity Pill -->
		<div class="flex flex-col items-start gap-1 max-w-[34%]">
			<div
				class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold leading-none border {isFlyer ? 'text-[8px]' : 'text-[10px]'}"
				style={isMono
					? 'background-color: #ffffff; border-color: #cbd5e1; color: #111827;'
					: `background-color: ${HIER_PALETTE.mutedMint}; border-color: ${HIER_PALETTE.green}; color: ${HIER_PALETTE.navy};`}
			>
				{#if preset.showInclusivityIcon}
					<svg
						class="{isFlyer ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke={isMono ? '#111827' : HIER_PALETTE.green}
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="4" r="2" />
						<path d="m18 19 1-7-6 1" />
						<path d="m5 8 3-3 5.5 3-2.36 3.5" />
						<path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
						<path d="M13.76 17.5a5 5 0 0 0-1.76-3.5" />
					</svg>
				{/if}
				<span class="truncate">{effectiveInclusivity}</span>
			</div>
			{#if !isFlyer}
				<span
					class="text-[9px] font-bold uppercase tracking-wider"
					style="color: {isMono ? '#475569' : preset.primaryColor};"
				>
					HIER. {preset.subtitle || 'in Marzahn-Süd'}
				</span>
			{/if}
		</div>

		<!-- Center: Partner & Sponsor Logos -->
		{#if centerSponsors.length > 0}
			<div class="flex items-center justify-center gap-2.5 flex-wrap max-w-[32%]">
				{#each centerSponsors as sponsor (sponsor.id)}
					{#if sponsor.logoUrl}
						<div
							role="button"
							tabindex="0"
							onclick={(e) => {
								e.stopPropagation();
								onSelect?.(sponsor.id);
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									e.stopPropagation();
									onSelect?.(sponsor.id);
								}
							}}
							class="cursor-pointer rounded bg-white/90 p-1 border border-black/5 transition-all outline-hidden shrink-0 {selectedCardId === sponsor.id ? 'ring-2 ring-amber-400 print:ring-0' : 'hover:ring-1 hover:ring-purple-400'} {getCardPrintClasses(cardSettings?.[sponsor.id], elementSettings?.sponsors, previewGreyscaleOnScreen)}"
							title="{sponsor.name || 'Sponsor'} (Klicken für Druck- & Farbeinstellungen)"
						>
							<img
								src={sponsor.logoUrl}
								alt={sponsor.name}
								class="{isFlyer ? 'h-[6.5mm] max-w-[55px]' : 'h-[10mm] max-w-[85px]'} w-auto object-contain"
							/>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Right: Above-address Logos + Location Address Block -->
		<div class="flex flex-col items-end text-right gap-0.5 max-w-[42%]">
			{#if partnerLogoUrl || aboveAddressSponsors.length > 0}
				<div class="flex items-center justify-end gap-1.5 pb-0.5">
					{#if partnerLogoUrl}
						<div
							role="button"
							tabindex="0"
							onclick={(e) => {
								e.stopPropagation();
								onSelect?.('partner_logo');
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									e.stopPropagation();
									onSelect?.('partner_logo');
								}
							}}
							class="cursor-pointer rounded bg-white/90 p-0.5 transition-all outline-hidden shrink-0 {selectedCardId === 'partner_logo' ? 'ring-2 ring-amber-400 print:ring-0' : 'hover:ring-1 hover:ring-purple-400'} {getCardPrintClasses(cardSettings?.['partner_logo'], elementSettings?.sponsors, previewGreyscaleOnScreen)}"
							title="Partnerlogo"
						>
							<img
								src={partnerLogoUrl}
								alt="Partner Logo"
								class="{isFlyer ? 'h-[6mm] max-w-[60px]' : 'h-[8.5mm] max-w-[85px]'} w-auto object-contain"
							/>
						</div>
					{/if}
					{#each aboveAddressSponsors as s (s.id)}
						{#if s.logoUrl}
							<div
								role="button"
								tabindex="0"
								onclick={(e) => {
									e.stopPropagation();
									onSelect?.(s.id);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										e.stopPropagation();
										onSelect?.(s.id);
									}
								}}
								class="cursor-pointer rounded bg-white/90 p-0.5 transition-all outline-hidden shrink-0 {selectedCardId === s.id ? 'ring-2 ring-amber-400 print:ring-0' : 'hover:ring-1 hover:ring-purple-400'} {getCardPrintClasses(cardSettings?.[s.id], elementSettings?.sponsors, previewGreyscaleOnScreen)}"
								title={s.name || 'Sponsor'}
							>
								<img
									src={s.logoUrl}
									alt={s.name}
									class="{isFlyer ? 'h-[6mm] max-w-[60px]' : 'h-[8.5mm] max-w-[85px]'} w-auto object-contain"
								/>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<div class="{isFlyer ? 'text-[9.5px]' : 'text-[12px]'} leading-snug">
				{#if locationName}
					<div
						class="font-extrabold uppercase tracking-wide truncate max-w-full"
						style="color: {isMono ? '#111827' : HIER_PALETTE.navy};"
					>
						{locationName}
					</div>
				{/if}
				{#if effectiveStreet}
					<div class="font-medium truncate max-w-full">{effectiveStreet}</div>
				{/if}
				{#if effectiveCity}
					<div class="font-medium truncate max-w-full">{effectiveCity}</div>
				{/if}
				{#if phone}
					<div
						class="font-bold truncate max-w-full"
						style="color: {isMono ? '#334155' : preset.primaryColor};"
					>
						{phone}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if printMode === 'omit_ci'}
		<div
			class="print:hidden absolute inset-0 z-30 flex items-center justify-center bg-purple-900/15 border-t border-dashed border-purple-500/60 text-purple-900 dark:text-purple-200 text-[10px] font-mono select-none pointer-events-none"
		>
			<span>✂️ Vorgedruckter HIER.-Fußbereich (wird beim Drucken freigelassen)</span>
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
