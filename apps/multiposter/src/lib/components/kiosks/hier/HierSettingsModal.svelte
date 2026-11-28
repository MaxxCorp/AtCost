<script lang="ts">
	import { X, Palette, Building2, Save, Trash2, LayoutTemplate } from '@lucide/svelte';
	import ElementManager from '../ci/ElementManager.svelte';
	import {
		DEFAULT_ELEMENT_SETTINGS,
		type CiPrintOptions,
		type KioskElementSettings
	} from '../ci/types.js';
	import {
		DEFAULT_HIER_PRESETS,
		HIER_PALETTE,
		HIER_SWATCH_GROUPS,
		type HierCiPreset
	} from './types.js';

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
		preset: HierCiPreset;
		printOptions: CiPrintOptions;
		elementSettings?: KioskElementSettings;
		customPresets: HierCiPreset[];
		isFlyer?: boolean;
		onSavePreset?: (preset: HierCiPreset) => void;
		onDeletePreset?: (presetId: string) => void;
	} = $props();

	let activeTab = $state<'elements' | 'ci' | 'logos'>('elements');
	let newPresetName = $state('');
	let isSavingPreset = $state(false);

	let allPresets = $derived([...DEFAULT_HIER_PRESETS, ...customPresets]);

	function selectPreset(presetId: string) {
		const found = allPresets.find((p) => p.id === presetId);
		if (found) {
			preset = { ...found, sponsors: found.sponsors ? [...found.sponsors] : [] };
		}
	}

	function handleSaveCustomPreset() {
		if (!newPresetName.trim()) return;
		const newPreset: HierCiPreset = {
			...preset,
			id: `hier_custom_${Date.now()}`,
			name: newPresetName.trim()
		};
		onSavePreset?.(newPreset);
		newPresetName = '';
		isSavingPreset = false;
	}

	function addSponsor() {
		if (!preset.sponsors) preset.sponsors = [];
		preset.sponsors = [
			...preset.sponsors,
			{
				id: `sponsor_${Date.now()}`,
				name: '',
				logoUrl: '',
				placement: 'center'
			}
		];
	}

	function removeSponsor(index: number) {
		if (!preset.sponsors) return;
		preset.sponsors = preset.sponsors.filter((_, idx) => idx !== index);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs print:hidden animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-labelledby="hier-settings-title"
	>
		<div
			class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
		>
			<!-- Modal Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800"
				style="background-color: {HIER_PALETTE.mutedLavender};"
			>
				<div class="flex items-center gap-2.5">
					<div
						class="w-8 h-8 rounded-lg text-white flex items-center justify-center"
						style="background-color: {HIER_PALETTE.primaryDigital};"
					>
						<Palette class="w-4 h-4" />
					</div>
					<div>
						<h2
							id="hier-settings-title"
							class="text-base font-bold leading-tight"
							style="color: {HIER_PALETTE.navy};"
						>
							HIER. in Marzahn-Süd — Brand CI &amp; Layout
						</h2>
						<p class="text-[11px] text-slate-600">
							Markenfarben, Träger-Logos und Druckoptionen für soziale Träger im Ortsteil
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/70 transition"
					aria-label="Schließen"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Tab Navigation -->
			<div
				class="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/50 px-6 gap-2 overflow-x-auto"
			>
				<button
					type="button"
					onclick={() => (activeTab = 'elements')}
					class="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap {activeTab === 'elements' ? 'border-[#6950fc] text-[#6950fc] bg-white dark:bg-slate-900' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
				>
					<LayoutTemplate class="w-4 h-4" />
					<span>Elemente &amp; Druckoptionen</span>
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'ci')}
					class="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap {activeTab === 'ci' ? 'border-[#6950fc] text-[#6950fc] bg-white dark:bg-slate-900' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
				>
					<Palette class="w-4 h-4" />
					<span>HIER. Farbpaletten &amp; Presets</span>
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'logos')}
					class="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap {activeTab === 'logos' ? 'border-[#6950fc] text-[#6950fc] bg-white dark:bg-slate-900' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
				>
					<Building2 class="w-4 h-4" />
					<span>Logos &amp; Sozialer Träger</span>
				</button>
			</div>

			<!-- Tab Content -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				{#if activeTab === 'elements'}
					<ElementManager
						bind:elementSettings
						bind:previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
						{isFlyer}
						ciTopTitle="HIER. Kopfbereich (Markenband)"
						ciTopDescription="HIER.-Logo, Träger-/Standortlogo & 3-Farb-Akzentstreifen"
						ciBottomTitle="HIER. Fußbereich (Träger- & Adressleiste)"
						ciBottomDescription="Inklusions-Badge, Partner-Logos & Standort-Adressblock"
					/>
				{/if}

				{#if activeTab === 'ci'}
					<div class="space-y-6">
						<!-- Presets -->
						<div
							class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3"
						>
							<div class="flex items-center justify-between">
								<span class="text-sm font-bold text-slate-800 dark:text-slate-200">
									HIER. Markenvorlagen / Presets
								</span>
								{#if !isSavingPreset}
									<button
										type="button"
										onclick={() => (isSavingPreset = true)}
										class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-[#f0e7f3] text-[#6950fc] border border-[#6950fc]/30 hover:bg-[#fadfed]"
									>
										<Save class="w-3.5 h-3.5" />
										<span>Aktuelles Preset speichern</span>
									</button>
								{/if}
							</div>

							{#if isSavingPreset}
								<div class="flex items-center gap-2 pt-1">
									<input
										type="text"
										bind:value={newPresetName}
										placeholder="Preset-Name eingeben..."
										class="flex-1 text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900"
									/>
									<button
										type="button"
										onclick={handleSaveCustomPreset}
										class="px-3 py-1.5 text-xs font-bold rounded bg-[#40b28f] text-white hover:opacity-90"
									>
										Speichern
									</button>
									<button
										type="button"
										onclick={() => {
											isSavingPreset = false;
											newPresetName = '';
										}}
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
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') selectPreset(p.id);
										}}
										class="flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition {preset.id === p.id ? 'border-[#6950fc] bg-[#f0e7f3]/70 dark:bg-indigo-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'}"
									>
										<div class="flex items-center gap-2.5 min-w-0">
											<div
												class="w-5 h-5 rounded-full border border-black/20 shrink-0"
												style="background-color: {p.headerBg};"
											></div>
											<div class="truncate">
												<div class="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
													{p.name}
												</div>
												<div class="text-[10px] text-slate-500">
													Kopf: {p.headerBg} • Fläche: {p.surfaceBg}
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

						<!-- Brand Color Swatches -->
						<div class="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
							<h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
								Offizielle HIER.-Farbpaletten (Klick setzt Kopffarbe / Hintergrund)
							</h3>
							{#each HIER_SWATCH_GROUPS as group (group.label)}
								<div class="space-y-1.5">
									<div class="text-[11px] font-semibold text-slate-500">{group.label}</div>
									<div class="flex flex-wrap gap-2">
										{#each group.colors as swatch (swatch.hex)}
											<button
												type="button"
												onclick={() => {
													if (group.label.includes('Gedeckte')) {
														preset.surfaceBg = swatch.hex;
													} else {
														preset.headerBg = swatch.hex;
														preset.headerText =
															swatch.hex === HIER_PALETTE.yellow ||
															swatch.hex === HIER_PALETTE.neonYellow
																? HIER_PALETTE.primaryDigital
																: '#ffffff';
													}
												}}
												class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:border-[#6950fc] transition bg-white dark:bg-slate-800"
												title="{swatch.name} ({swatch.hex})"
											>
												<span
													class="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
													style="background-color: {swatch.hex};"
												></span>
												<span class="font-mono text-[10px]">{swatch.hex}</span>
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>

						<!-- Fine Color Pickers -->
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div class="space-y-1.5">
								<div class="text-xs font-bold text-slate-700 dark:text-slate-300">Kopfbereich</div>
								<div class="flex items-center gap-2">
									<input
										type="color"
										bind:value={preset.headerBg}
										class="w-9 h-9 p-0.5 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
									/>
									<input
										type="text"
										bind:value={preset.headerBg}
										class="flex-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase"
									/>
								</div>
							</div>

							<div class="space-y-1.5">
								<div class="text-xs font-bold text-slate-700 dark:text-slate-300">
									Gedeckte Fläche
								</div>
								<div class="flex items-center gap-2">
									<input
										type="color"
										bind:value={preset.surfaceBg}
										class="w-9 h-9 p-0.5 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
									/>
									<input
										type="text"
										bind:value={preset.surfaceBg}
										class="flex-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase"
									/>
								</div>
							</div>

							<div class="space-y-1.5">
								<div class="text-xs font-bold text-slate-700 dark:text-slate-300">
									Akzent / Hauptton
								</div>
								<div class="flex items-center gap-2">
									<input
										type="color"
										bind:value={preset.primaryColor}
										class="w-9 h-9 p-0.5 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
									/>
									<input
										type="text"
										bind:value={preset.primaryColor}
										class="flex-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase"
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if activeTab === 'logos'}
					<div class="space-y-5">
						<div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
							<div class="text-xs font-bold text-slate-800 dark:text-slate-200">
								HIER.-Logo Untertitel (Standard: „in Marzahn-Süd“)
							</div>
							<input
								type="text"
								bind:value={preset.subtitle}
								placeholder="in Marzahn-Süd"
								class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
							/>
						</div>

						<div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
							<div class="flex items-center justify-between">
								<div class="text-xs font-bold text-slate-800 dark:text-slate-200">
									Standort-Logo (Kopfbereich rechts)
								</div>
								<label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
									<input
										type="checkbox"
										bind:checked={preset.showLocationLogo}
										class="rounded text-[#6950fc]"
									/>
									<span>Anzeigen</span>
								</label>
							</div>
							<input
								type="text"
								bind:value={preset.locationLogoUrl}
								placeholder="/logos/location-suedspitze.png oder URL"
								class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
							/>
						</div>

						<div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
							<div class="flex items-center justify-between">
								<div class="text-xs font-bold text-slate-800 dark:text-slate-200">
									Träger- / Organisations-Logo (z. B. Sozialer Träger im Ortsteil)
								</div>
								<label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
									<input
										type="checkbox"
										bind:checked={preset.showOrgLogo}
										class="rounded text-[#6950fc]"
									/>
									<span>Anzeigen</span>
								</label>
							</div>
							<input
								type="text"
								bind:value={preset.orgLogoUrl}
								placeholder="/logos/org-ball.png oder Träger-Logo-URL"
								class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
							/>
						</div>

						<div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
							<div class="flex items-center justify-between">
								<div class="text-xs font-bold text-slate-800 dark:text-slate-200">
									Inklusions-Hinweis (Fußbereich links)
								</div>
								<label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
									<input
										type="checkbox"
										bind:checked={preset.showInclusivityIcon}
										class="rounded text-[#6950fc]"
									/>
									<span>Icon anzeigen</span>
								</label>
							</div>
							<input
								type="text"
								bind:value={preset.inclusivityText}
								placeholder="Barrierefreies Haus"
								class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5"
							/>
						</div>

						<div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
							<div class="flex items-center justify-between">
								<div class="text-xs font-bold text-slate-800 dark:text-slate-200">
									Partner- &amp; Förderer-Logos (Fußbereich)
								</div>
								<button
									type="button"
									onclick={addSponsor}
									class="px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
								>
									+ Logo hinzufügen
								</button>
							</div>

							<div class="space-y-2">
								{#each preset.sponsors || [] as sponsor, i (sponsor.id)}
									<div
										class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
									>
										<input
											type="text"
											bind:value={sponsor.name}
											placeholder="Name"
											class="w-1/3 text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1"
										/>
										<input
											type="text"
											bind:value={sponsor.logoUrl}
											placeholder="Logo Bild-URL"
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
			<div
				class="flex items-center justify-end px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800"
			>
				<button
					type="button"
					onclick={() => (open = false)}
					class="px-5 py-2 text-white font-semibold rounded-lg text-xs transition shadow-2xs"
					style="background-color: {HIER_PALETTE.primaryDigital};"
				>
					Fertig
				</button>
			</div>
		</div>
	</div>
{/if}
