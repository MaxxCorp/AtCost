<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		type Event,
		type Announcement,
		formatOpeningHours,
		type OpeningHoursData
	} from '@ac/validations';
	import {
		Printer,
		Sparkles,
		RotateCcw,
		MapPin,
		Calendar,
		Clock,
		ZoomIn,
		ZoomOut,
		SlidersHorizontal,
		ChevronDown,
		QrCode,
		Ticket,
		Settings2,
		X,
		Plus,
		Trash2,
		Check,
		AlertCircle,
		Image as ImageIcon,
		Layers,
		Upload,
		CheckCircle2,
		Globe,
		Lock,
		Tag,
		RefreshCw,
		User,
		Users,
		UserCheck,
		FileImage,
		LayoutTemplate,
		Palette,
		FileText
	} from '@lucide/svelte';
	import HierHeaderBand from './hier/HierHeaderBand.svelte';
	import HierFooterBand from './hier/HierFooterBand.svelte';
	import HierSettingsModal from './hier/HierSettingsModal.svelte';
	import {
		DEFAULT_HIER_PRESETS,
		DEFAULT_HIER_PRINT_OPTIONS,
		HIER_PALETTE,
		type HierCiPreset
	} from './hier/types.js';
	import CardLayoutActionBar from './CardLayoutActionBar.svelte';
	import {
		DEFAULT_ELEMENT_SETTINGS,
		getElementPrintClasses,
		getCardPrintClasses,
		getDocumentTypographyStyle,
		getItemTypographyStyle,
		type CiPrintOptions,
		type CiSponsorItem,
		type KioskElementSettings,
		type CardPrintConfig
	} from './ci/types.js';
	import { uploadMedia } from '../../../routes/cms/media/create.remote';
	import { formatRecurrenceText } from '#lib/utils/format-recurrence.js';
	import { getKioskSignUpText } from '#lib/utils/kiosk-signup.js';
	import { formatTicketPrice, isEventFree } from '#lib/utils/format-ticket-price.js';
	import { getEventRooms } from '#lib/utils/format-rooms.js';
	import { isNonSeriesEvent } from '#lib/utils/event-series.js';
	import {
		isMultiDayEvent,
		getEventDurationDays,
		getEventDateParts
	} from '#lib/utils/format-event-date.js';
	import * as m from '#lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/env';
	import {
		type EnrichedEvent,
		type EnrichedAnnouncement,
		type VisibleComponentsState,
		defaultVisibleComponents,
		getAllEventContacts,
		getContactName,
		getContactRoles,
		getContactEmail,
		getContactPhone,
		compressSeriesEvents,
		formatDateDay,
		formatDateMonth,
		formatDateWeekday,
		formatTimeRange,
		formatFullDate,
		formatPosterProgrammeHeadline
	} from '#lib/utils/kiosk-flat-helpers.js';

	interface LocationContact {
		name: string;
		email?: string;
		phone?: string;
		qrCodePath?: string;
		qrCodeDataUrl?: string;
		role?: string | null;
	}

	interface LocationInfo {
		id: string;
		name: string;
		street?: string | null;
		houseNumber?: string | null;
		addressSuffix?: string | null;
		zip?: string | null;
		city?: string | null;
		state?: string | null;
		country?: string | null;
		roomId?: string | null;
		capacity?: string | null;
		inclusivitySupport?: string | null;
		openingHours?: OpeningHoursData | string | null;
		heroImage?: string | null;
		description?: string | null;
		contact?: LocationContact | null;
	}

	export interface HierCustomSectionItem {
		id: string;
		title: string;
		content: string;
		imageUrl?: string;
		slot: 'banner' | 'grid_top' | 'grid_bottom' | 'footer';
		accentColor?: 'purple' | 'pink' | 'yellow' | 'green';
		enabled: boolean;
	}

	interface SponsorItem {
		id: string;
		name: string;
		logoUrl: string;
	}

	type PosterDisplayItem = EnrichedEvent | EnrichedAnnouncement;

	let {
		items = [],
		kiosk
	}: {
		items: (Event | Announcement)[];
		kiosk: {
			id?: string;
			name?: string;
			description?: string;
			locations?: LocationInfo[];
			rangeMode?: string;
			startDate?: string | Date | null;
			endDate?: string | Date | null;
			showEventQrCodes?: boolean;
		};
	} = $props();

	let paperSize = $state<'A4' | 'A3'>('A4');
	let columns = $state<'auto' | '1' | '2' | '3'>('auto');
	let density = $state<'compact' | 'standard' | 'relaxed'>('standard');
	let zoomLevel = $state<number>(0.85);

	let posterLocations = $derived.by<LocationInfo[]>(() => {
		if (kiosk.locations && kiosk.locations.length > 0) return kiosk.locations;
		return [
			{
				id: 'default',
				name: kiosk.name || 'Standort / Location',
				street: null,
				houseNumber: null,
				addressSuffix: null,
				zip: null,
				city: null,
				state: null,
				country: null,
				roomId: null,
				capacity: null,
				heroImage: null,
				description: kiosk.description || null,
				contact: null
			}
		];
	});

	let activeLocationId = $state<string>('');
	let effectiveLocationId = $derived(
		activeLocationId && posterLocations.some((l) => l.id === activeLocationId)
			? activeLocationId
			: (posterLocations[0]?.id ?? 'default')
	);
	let currentLocation = $derived(
		posterLocations.find((l) => l.id === effectiveLocationId) || posterLocations[0]
	);

	let showLocationLogo = $state<boolean>(true);
	let customLocationLogoUrl = $state<string>('');
	let effectiveLocationLogo = $derived(
		customLocationLogoUrl.trim() || currentLocation?.heroImage || ''
	);

	let showSponsors = $state<boolean>(true);
	let sponsors = $state<SponsorItem[]>([]);

	let ciPreset = $state<HierCiPreset>({ ...DEFAULT_HIER_PRESETS[0] });
	let customPresets = $state<HierCiPreset[]>([]);
	let printOptions = $state<CiPrintOptions>({ ...DEFAULT_HIER_PRINT_OPTIONS });
	let elementSettings = $state<KioskElementSettings>({ ...DEFAULT_ELEMENT_SETTINGS });
	let isHierSettingsOpen = $state<boolean>(false);
	let isSettingsOpen = $state<boolean>(false);

	function handleSaveCustomPreset(newPreset: HierCiPreset) {
		customPresets = [...customPresets.filter((p) => p.id !== newPreset.id), newPreset];
		ciPreset = { ...newPreset };
		savePrefs();
		toast.success(`Preset "${newPreset.name}" gespeichert`);
	}

	function handleDeleteCustomPreset(id: string) {
		customPresets = customPresets.filter((p) => p.id !== id);
		if (ciPreset.id === id) ciPreset = { ...DEFAULT_HIER_PRESETS[0] };
		savePrefs();
		toast.info('Preset gelöscht');
	}

	let effectiveSponsors = $derived<CiSponsorItem[]>(
		!showSponsors
			? []
			: [
					...(ciPreset.sponsors || []).filter((s) => Boolean(s.logoUrl?.trim())),
					...sponsors
						.filter((s) => Boolean(s.logoUrl?.trim()))
						.map((s) => ({
							id: s.id,
							name: s.name,
							logoUrl: s.logoUrl,
							placement: 'center' as const
						}))
				]
	);

	let compressSeries = $state<boolean>(true);
	let descriptionStyle = $state<'short' | 'full' | 'none'>('short');
	let itemDescriptions = $state<Record<string, string>>({});
	let itemPercentages = $state<Record<string, number>>({});
	let selectedCardId = $state<string | null>(null);
	let cardSettings = $state<Record<string, CardPrintConfig>>({});
	let docFontFamily = $state<string>('default');
	let docFontScale = $state<number>(1);
	let showTimes = $state<boolean>(true);
	let customProgrammeTitle = $state<string>('');
	let customProgrammeSubtitle = $state<string>('');
	let visibleComponents = $state<VisibleComponentsState>({ ...defaultVisibleComponents });
	let isComponentsMenuOpen = $state<boolean>(false);
	let customSections = $state<HierCustomSectionItem[]>([]);

	let selectedItem = $derived.by(() => {
		if (!selectedCardId) return null;
		if (selectedCardId === 'location_logo') {
			return {
				id: 'location_logo',
				title: `${currentLocation?.name || 'Standort'} Logo`,
				description: undefined,
				isLogo: true
			};
		}
		if (selectedCardId === 'org_logo') {
			return { id: 'org_logo', title: 'Trägerlogo', description: undefined, isLogo: true };
		}
		if (selectedCardId === 'partner_logo') {
			return { id: 'partner_logo', title: 'Partnerlogo', description: undefined, isLogo: true };
		}
		const sp = effectiveSponsors.find((s) => s.id === selectedCardId);
		if (sp) {
			return {
				id: sp.id,
				title: sp.name ? `${sp.name} (Logo)` : 'Sponsor / Partner Logo',
				description: undefined,
				isLogo: true
			};
		}
		const sec = customSections.find((s) => s.id === selectedCardId);
		if (sec) {
			return { id: sec.id, title: sec.title || 'Abschnitt', description: sec.content };
		}
		const it = displayItems.find((i) => i.id === selectedCardId);
		if (!it) return null;
		const isEvt = 'startDateTime' in it;
		const evt = it as EnrichedEvent;
		const isCompressed = Boolean(
			isEvt &&
				evt.isCompressedSeries &&
				((evt.seriesInstances && evt.seriesInstances.length >= 1) ||
					(evt.seriesDates && evt.seriesDates.length >= 1))
		);
		const hasEndTime = Boolean(isEvt && (it as Event).endDateTime && !(it as Event).isAllDay);
		return {
			id: it.id,
			title: isEvt ? (it as Event).summary : (it as Announcement).title,
			description: isEvt ? (it as Event).description : (it as Announcement).content,
			hasSeriesDates: isCompressed,
			hasEndTime
		};
	});

	function toggleComponent(key: keyof VisibleComponentsState) {
		visibleComponents[key] = !visibleComponents[key];
		savePrefs();
	}

	function selectAllComponents() {
		visibleComponents = {
			contacts: true,
			participants: true,
			publicStatus: true,
			descriptions: true,
			qrCodes: true,
			ticketPrice: true,
			rooms: true,
			tags: true,
			internalNotes: true,
			heroImage: true,
			openingHours: true,
			endTimes: true
		};
		savePrefs();
	}

	function resetComponentsToDefault() {
		visibleComponents = { ...defaultVisibleComponents };
		savePrefs();
	}

	function addCustomSection(slot: HierCustomSectionItem['slot'] = 'banner') {
		customSections = [
			...customSections,
			{
				id: `sec-${Date.now()}`,
				title: 'Neuer Hinweis / Abschnitt',
				content: '',
				imageUrl: '',
				slot,
				accentColor: 'purple',
				enabled: true
			}
		];
		savePrefs();
	}

	function removeCustomSection(id: string) {
		customSections = customSections.filter((s) => s.id !== id);
		savePrefs();
	}

	function addOpeningHoursSection() {
		if (!currentLocation?.openingHours) return;
		const formatted = formatOpeningHours(currentLocation.openingHours);
		customSections = [
			...customSections,
			{
				id: `sec-hours-${Date.now()}`,
				title: 'Öffnungszeiten & Beratung',
				content: `${formatted}${currentLocation.inclusivitySupport ? '\n♿ ' + currentLocation.inclusivitySupport : ''}`,
				slot: 'banner',
				accentColor: 'yellow',
				enabled: true
			}
		];
		savePrefs();
		toast.success('Öffnungszeiten als Banner hinzugefügt');
	}

	let posterContentElement = $state<HTMLElement | null>(null);
	let isOverflowing = $state<boolean>(false);
	let overflowPercent = $state<number>(0);

	const storageKey = $derived(`kiosk_poster_hier_settings_${kiosk?.id || 'default'}`);

	onMount(() => {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(storageKey);
			if (raw) {
				const prefs = JSON.parse(raw);
				if (prefs.paperSize !== undefined) paperSize = prefs.paperSize;
				if (prefs.columns !== undefined) columns = prefs.columns;
				if (prefs.density !== undefined) density = prefs.density;
				if (prefs.showLocationLogo !== undefined) showLocationLogo = prefs.showLocationLogo;
				if (prefs.customLocationLogoUrl !== undefined)
					customLocationLogoUrl = prefs.customLocationLogoUrl;
				if (prefs.showSponsors !== undefined) showSponsors = prefs.showSponsors;
				if (Array.isArray(prefs.sponsors)) sponsors = prefs.sponsors;
				if (prefs.ciPreset) ciPreset = { ...DEFAULT_HIER_PRESETS[0], ...prefs.ciPreset };
				if (Array.isArray(prefs.customPresets)) customPresets = prefs.customPresets;
				if (prefs.printOptions) printOptions = { ...printOptions, ...prefs.printOptions };
				if (prefs.elementSettings)
					elementSettings = { ...DEFAULT_ELEMENT_SETTINGS, ...prefs.elementSettings };
				if (prefs.descriptionStyle !== undefined) descriptionStyle = prefs.descriptionStyle;
				if (prefs.itemDescriptions) itemDescriptions = prefs.itemDescriptions;
				if (prefs.itemPercentages) itemPercentages = prefs.itemPercentages;
				if (prefs.cardSettings && typeof prefs.cardSettings === 'object')
					cardSettings = prefs.cardSettings;
				if (typeof prefs.docFontFamily === 'string') docFontFamily = prefs.docFontFamily;
				if (typeof prefs.docFontScale === 'number') docFontScale = prefs.docFontScale;
				if (prefs.showTimes !== undefined) showTimes = prefs.showTimes;
				if (prefs.compressSeries !== undefined) compressSeries = prefs.compressSeries;
				if (prefs.customProgrammeTitle !== undefined)
					customProgrammeTitle = prefs.customProgrammeTitle;
				if (prefs.customProgrammeSubtitle !== undefined)
					customProgrammeSubtitle = prefs.customProgrammeSubtitle;
				if (prefs.activeLocationId && posterLocations.some((l) => l.id === prefs.activeLocationId)) {
					activeLocationId = prefs.activeLocationId;
				}
				if (prefs.visibleComponents && typeof prefs.visibleComponents === 'object') {
					visibleComponents = { ...visibleComponents, ...prefs.visibleComponents };
				}
				if (Array.isArray(prefs.customSections)) customSections = prefs.customSections;
			}
		} catch (e) {
			console.error('Failed to load HIER poster preferences', e);
		}
	});

	function savePrefs() {
		if (!browser) return;
		try {
			localStorage.setItem(
				storageKey,
				JSON.stringify({
					paperSize,
					columns,
					density,
					showLocationLogo,
					customLocationLogoUrl,
					showSponsors,
					sponsors,
					ciPreset,
					customPresets,
					printOptions,
					elementSettings,
					descriptionStyle,
					itemDescriptions,
					itemPercentages,
					cardSettings,
					showTimes,
					compressSeries,
					customProgrammeTitle,
					customProgrammeSubtitle,
					activeLocationId: effectiveLocationId,
					visibleComponents,
					customSections,
					docFontFamily,
					docFontScale
				})
			);
		} catch (e) {
			console.error('Failed to save HIER poster preferences', e);
		}
	}

	$effect(() => {
		const _ = [
			paperSize,
			columns,
			density,
			showLocationLogo,
			customLocationLogoUrl,
			showSponsors,
			sponsors,
			ciPreset,
			customPresets,
			printOptions,
			elementSettings,
			descriptionStyle,
			itemDescriptions,
			itemPercentages,
			cardSettings,
			showTimes,
			compressSeries,
			customProgrammeTitle,
			customProgrammeSubtitle,
			effectiveLocationId,
			visibleComponents.contacts,
			visibleComponents.participants,
			visibleComponents.publicStatus,
			visibleComponents.descriptions,
			visibleComponents.qrCodes,
			visibleComponents.ticketPrice,
			visibleComponents.rooms,
			visibleComponents.tags,
			visibleComponents.internalNotes,
			visibleComponents.heroImage,
			visibleComponents.openingHours,
			visibleComponents.endTimes,
			customSections,
			docFontFamily,
			docFontScale
		];
		savePrefs();
	});

	function getItemLocationIds(item: Event | Announcement): SvelteSet<string> {
		const ids = new SvelteSet<string>();
		if ('locations' in item && Array.isArray((item as any).locations)) {
			for (const l of (item as any).locations) {
				if (typeof l === 'string') ids.add(l);
				else if (l?.id) ids.add(l.id);
				else if (l?.locationId) ids.add(l.locationId);
				else if (l?.location?.id) ids.add(l.location.id);
			}
		}
		if ('locationIds' in item && Array.isArray((item as any).locationIds)) {
			for (const id of (item as any).locationIds) {
				if (id) ids.add(id);
			}
		}
		if ('resources' in item && Array.isArray((item as any).resources)) {
			for (const r of (item as any).resources) {
				if (r?.locationId) ids.add(r.locationId);
				else if (r?.resource?.locationId) ids.add(r.resource.locationId);
				else if (r?.location?.id) ids.add(r.location.id);
			}
		}
		return ids;
	}

	function itemBelongsToLocation(item: Event | Announcement, locId: string): boolean {
		if (!locId || locId === 'default') return true;
		const itemLocIds = getItemLocationIds(item);
		if (itemLocIds.size > 0) return itemLocIds.has(locId);
		return posterLocations.length <= 1;
	}

	let locationFilteredItems = $derived.by<(Event | Announcement)[]>(() => {
		const locId = currentLocation?.id || 'default';
		return items.filter((item) => itemBelongsToLocation(item, locId));
	});

	let displayItems = $derived.by<PosterDisplayItem[]>(() => {
		const rawEvents = locationFilteredItems.filter((i) => 'startDateTime' in i) as EnrichedEvent[];
		const rawAnnouncements = locationFilteredItems.filter(
			(i) => !('startDateTime' in i)
		) as EnrichedAnnouncement[];
		const processedEvents = compressSeries ? compressSeriesEvents(rawEvents, 'none') : rawEvents;

		const combined: PosterDisplayItem[] = [...processedEvents, ...rawAnnouncements];
		combined.sort((a, b) => {
			const timeA =
				'startDateTime' in a && a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
			const timeB =
				'startDateTime' in b && b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
			return timeA - timeB;
		});
		return combined;
	});

	let effectiveColumns = $derived.by<number>(() => {
		if (columns === '1') return 1;
		if (columns === '2') return 2;
		if (columns === '3') return 3;
		const count = displayItems.length;
		if (paperSize === 'A3') {
			if (count > 25) return 3;
			if (count > 10) return 2;
			return 1;
		}
		if (count > 9) return 2;
		return 1;
	});

	let wrapAroundQr = $derived(effectiveColumns <= 2);

	let programmeMonthTitle = $derived.by<string>(() => {
		return formatPosterProgrammeHeadline(kiosk, displayItems, customProgrammeTitle);
	});

	let programmeLocationSubtitle = $derived.by<string>(() => {
		if (customProgrammeSubtitle.trim()) return customProgrammeSubtitle.trim();
		const loc = currentLocation;
		if (!loc) return '';
		const parts = [
			loc.street && loc.houseNumber ? `${loc.street} ${loc.houseNumber}` : loc.street,
			loc.zip && loc.city ? `${loc.zip} ${loc.city}` : loc.city
		].filter(Boolean);
		return parts.join(', ');
	});

	function checkPageOverflow() {
		if (!posterContentElement || !browser) return;
		const targetMaxHeightMm = paperSize === 'A4' ? 297 : 420;
		const pxPerMm = 3.779528;
		const targetMaxPx = targetMaxHeightMm * pxPerMm;
		const currentPx = posterContentElement.scrollHeight;
		if (currentPx > targetMaxPx + 15) {
			isOverflowing = true;
			overflowPercent = Math.round(((currentPx - targetMaxPx) / targetMaxPx) * 100);
		} else {
			isOverflowing = false;
			overflowPercent = 0;
		}
	}

	$effect(() => {
		const _ = [
			displayItems.length,
			density,
			effectiveColumns,
			paperSize,
			descriptionStyle,
			compressSeries,
			visibleComponents.descriptions,
			visibleComponents.contacts,
			visibleComponents.participants,
			visibleComponents.heroImage,
			visibleComponents.internalNotes,
			visibleComponents.rooms,
			visibleComponents.ticketPrice,
			docFontFamily,
			docFontScale,
			cardSettings
		];
		const id = setTimeout(checkPageOverflow, 150);
		return () => clearTimeout(id);
	});

	function handleAutoFit() {
		columns = displayItems.length > 10 ? '2' : '1';
		density = 'compact';
		descriptionStyle = 'short';
		toast.success(m.poster_auto_fit());
	}

	async function triggerPrint() {
		if (!browser) return;
		const prevZoom = zoomLevel;
		zoomLevel = 1;
		await tick();
		window.print();
		setTimeout(() => {
			zoomLevel = prevZoom;
		}, 500);
	}

	function addSponsor() {
		sponsors = [
			...sponsors,
			{ id: `sponsor-${Date.now()}`, name: 'Neuer Partner / Sponsor', logoUrl: '' }
		];
	}

	function removeSponsor(id: string) {
		sponsors = sponsors.filter((s) => s.id !== id);
	}

	async function handleImageUpload(
		inputOrEvent: globalThis.Event | File,
		target: 'location' | { sponsorId: string } | { sectionId: string }
	) {
		const file =
			inputOrEvent instanceof File
				? inputOrEvent
				: (inputOrEvent.target as HTMLInputElement)?.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
			toast.error('Nur Bilddateien (PNG, JPG, SVG, WebP) erlaubt');
			return;
		}
		try {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = async () => {
				const base64 = reader.result as string;
				let url = base64;
				try {
					const res = await uploadMedia({
						filename: file.name,
						contentType: file.type,
						content: base64
					});
					if (res.success && res.urls?.default) url = res.urls.default;
				} catch {
					// fallback to base64
				}
				if (target === 'location') {
					customLocationLogoUrl = url;
				} else if ('sponsorId' in target) {
					sponsors = sponsors.map((sp) =>
						sp.id === target.sponsorId ? { ...sp, logoUrl: url } : sp
					);
				} else if ('sectionId' in target) {
					customSections = customSections.map((sc) =>
						sc.id === target.sectionId ? { ...sc, imageUrl: url } : sc
					);
				}
				toast.success('Bild erfolgreich hinzugefügt');
				savePrefs();
			};
		} catch (err) {
			console.error(err);
			toast.error('Upload fehlgeschlagen');
		}
	}
</script>

<svelte:head>
	<style>
		@media print {
			@page {
				size: {paperSize === 'A3' ? '297mm 420mm' : '210mm 297mm'};
				margin: 0 !important;
			}
			:global(html),
			:global(body) {
				width: {paperSize === 'A3' ? '297mm' : '210mm'} !important;
				max-width: {paperSize === 'A3' ? '297mm' : '210mm'} !important;
				height: {paperSize === 'A3' ? '420mm' : '297mm'} !important;
				max-height: {paperSize === 'A3' ? '420mm' : '297mm'} !important;
				margin: 0 !important;
				padding: 0 !important;
			}
		}
	</style>
</svelte:head>

{#snippet rightVisuals(item: PosterDisplayItem, evt: EnrichedEvent)}
	{#if visibleComponents.heroImage && (item as any).heroImage && elementSettings.heroImages.enabled}
		<div
			class="overflow-hidden rounded-md border border-[#6950fc]/20 bg-[#f0e7f3] shrink-0 {getElementPrintClasses(elementSettings.heroImages, printOptions.previewGreyscaleOnScreen)}"
		>
			<img
				src={(item as any).heroImage}
				alt={evt.summary || 'Event'}
				class="event-image {density === 'compact' ? 'w-14 h-10' : 'w-20 h-14'} object-cover"
				loading="lazy"
			/>
		</div>
	{/if}
{/snippet}

{#snippet customSectionCard(sec: HierCustomSectionItem, slotContext: string)}
	{@const colorBorder =
		sec.accentColor === 'pink'
			? 'border-l-[#da5096]'
			: sec.accentColor === 'yellow'
				? 'border-l-[#fcc505]'
				: sec.accentColor === 'green'
					? 'border-l-[#40b28f]'
					: 'border-l-[#6950fc]'}
	{@const colorBg =
		sec.accentColor === 'pink'
			? 'bg-[#fadfed]/45'
			: sec.accentColor === 'yellow'
				? 'bg-[#fffcf7]'
				: sec.accentColor === 'green'
					? 'bg-[#e3f0ea]/65'
					: 'bg-[#f0e7f3]/65'}
	<div
		role="button"
		tabindex="0"
		onclick={(e) => {
			e.stopPropagation();
			selectedCardId = selectedCardId === sec.id ? null : sec.id;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				selectedCardId = selectedCardId === sec.id ? null : sec.id;
			}
		}}
		class="hier-card-accent kiosk-item-typography {cardSettings[sec.id]?.fontFamily ? 'kiosk-has-custom-font' : ''} custom-section-item p-2.5 rounded-r-md border border-[#6950fc]/15 border-l-4 {colorBorder} {colorBg} break-inside-avoid {slotContext === 'banner' ? 'mb-2' : 'mb-3.5'} cursor-pointer transition-all outline-hidden {selectedCardId === sec.id ? 'ring-2 ring-amber-400 print:ring-0' : ''} {getCardPrintClasses(cardSettings[sec.id], elementSettings.customSections, printOptions.previewGreyscaleOnScreen)}"
		style={getItemTypographyStyle(cardSettings[sec.id]?.fontFamily, cardSettings[sec.id]?.fontScale)}
	>
		<div class="flex items-start gap-3">
			{#if sec.imageUrl}
				<img
					src={sec.imageUrl}
					alt={sec.title}
					class="max-h-16 max-w-[120px] object-contain rounded shrink-0 bg-white p-1 border border-slate-200"
				/>
			{/if}
			<div class="flex-1 min-w-0">
				{#if sec.title}
					<h4 class="font-bold text-[#29235c] text-xs sm:text-sm tracking-tight leading-snug mb-0.5">
						{sec.title}
					</h4>
				{/if}
				{#if sec.content}
					<div class="text-[11px] text-[#222222] leading-relaxed whitespace-pre-line rich-description">
						{@html itemDescriptions[sec.id] || sec.content}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<!-- Screen Toolbar -->
<header
	class="print:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2.5"
>
	<div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
		<div class="flex items-center gap-3">
			<a
				href="/kiosks/{kiosk?.id || ''}"
				class="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 font-medium transition-colors"
			>
				<Layers class="w-4 h-4 text-[#6950fc]" />
				<span class="font-bold">{m.poster_hier_badge()}</span>
			</a>

			{#if posterLocations.length > 1}
				<div class="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700">
					<MapPin class="w-3.5 h-3.5 text-[#6950fc]" />
					<select
						aria-label="Standort auswählen"
						value={effectiveLocationId}
						onchange={(e) => (activeLocationId = (e.target as HTMLSelectElement).value)}
						class="text-xs font-medium py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md"
					>
						{#each posterLocations as loc (loc.id)}
							<option value={loc.id}>{loc.name}</option>
						{/each}
					</select>
				</div>
			{:else if currentLocation}
				<span class="text-xs text-slate-500 flex items-center gap-1 pl-3 border-l border-slate-200">
					<MapPin class="w-3.5 h-3.5 text-[#6950fc]" />
					<strong class="text-slate-700 dark:text-slate-200">{currentLocation.name}</strong>
				</span>
			{/if}

			<div
				class="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium {isOverflowing ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-[#e3f0ea] text-[#29235c] border border-[#40b28f]/40'}"
			>
				{#if isOverflowing}
					<AlertCircle class="w-3 h-3 text-amber-600 animate-pulse" />
					<span>{m.poster_overflow_warning()} (+{overflowPercent}%)</span>
					<button
						type="button"
						onclick={handleAutoFit}
						class="ml-1 px-1.5 py-0.2 bg-amber-600 text-white text-[10px] rounded font-semibold"
					>
						Auto-Fit
					</button>
				{:else}
					<CheckCircle2 class="w-3 h-3 text-[#40b28f]" />
					<span>{m.poster_single_page_fit()} ({paperSize})</span>
				{/if}
			</div>
		</div>

		<div class="flex items-center flex-wrap gap-2">
			<div class="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
				<button
					type="button"
					onclick={() => (paperSize = 'A4')}
					class="px-2.5 py-1 text-xs font-semibold rounded {paperSize === 'A4' ? 'bg-[#6950fc] text-white' : 'text-slate-600'}"
				>
					A4
				</button>
				<button
					type="button"
					onclick={() => (paperSize = 'A3')}
					class="px-2.5 py-1 text-xs font-semibold rounded {paperSize === 'A3' ? 'bg-[#6950fc] text-white' : 'text-slate-600'}"
				>
					A3
				</button>
			</div>

			<div class="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
				<button
					type="button"
					onclick={() => (columns = 'auto')}
					class="px-2 py-1 text-xs font-medium rounded {columns === 'auto' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					Auto ({effectiveColumns})
				</button>
				<button
					type="button"
					onclick={() => (columns = '1')}
					class="px-2 py-1 text-xs font-medium rounded {columns === '1' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					1 Sp.
				</button>
				<button
					type="button"
					onclick={() => (columns = '2')}
					class="px-2 py-1 text-xs font-medium rounded {columns === '2' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					2 Sp.
				</button>
				<button
					type="button"
					onclick={() => (columns = '3')}
					class="px-2 py-1 text-xs font-medium rounded {columns === '3' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					3 Sp.
				</button>
			</div>

			<div class="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
				<button
					type="button"
					onclick={() => (density = 'compact')}
					class="px-2 py-1 text-xs font-medium rounded {density === 'compact' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					Kompakt
				</button>
				<button
					type="button"
					onclick={() => (density = 'standard')}
					class="px-2 py-1 text-xs font-medium rounded {density === 'standard' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					Standard
				</button>
				<button
					type="button"
					onclick={() => (density = 'relaxed')}
					class="px-2 py-1 text-xs font-medium rounded {density === 'relaxed' ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					Großzügig
				</button>
			</div>

			<div class="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
				<button
					type="button"
					onclick={() => (compressSeries = true)}
					class="px-2 py-1 text-xs font-medium rounded flex items-center gap-1 {compressSeries ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					<RefreshCw class="w-3 h-3" />
					<span>{m.series_compacted()}</span>
				</button>
				<button
					type="button"
					onclick={() => (compressSeries = false)}
					class="px-2 py-1 text-xs font-medium rounded flex items-center gap-1 {!compressSeries ? 'bg-white text-[#6950fc] font-semibold shadow-sm' : 'text-slate-600'}"
				>
					<Layers class="w-3 h-3" />
					<span>{m.series_unrolled()}</span>
				</button>
			</div>

			<div class="relative">
				<button
					type="button"
					onclick={() => (isComponentsMenuOpen = !isComponentsMenuOpen)}
					class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
				>
					<SlidersHorizontal class="w-3.5 h-3.5 text-[#6950fc]" />
					<span>{m.visible_components()}</span>
					<span class="px-1.5 py-0.2 bg-[#f0e7f3] text-[#6950fc] rounded-full text-[10px] font-bold">
						{Object.values(visibleComponents).filter(Boolean).length}
					</span>
					<ChevronDown class="w-3 h-3" />
				</button>
				{#if isComponentsMenuOpen}
					<div
						class="fixed inset-0 z-40"
						onclick={() => (isComponentsMenuOpen = false)}
						aria-hidden="true"
					></div>
					<div
						class="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50 space-y-2 text-xs"
					>
						<div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
							<span class="font-bold">{m.visible_components()}</span>
							<div class="flex items-center gap-2 text-[11px]">
								<button type="button" onclick={selectAllComponents} class="text-[#6950fc] font-medium">
									{m.select_all()}
								</button>
								<button type="button" onclick={resetComponentsToDefault} class="text-slate-500 font-medium">
									Reset
								</button>
							</div>
						</div>
						<div class="space-y-1 max-h-72 overflow-y-auto pr-1">
							{#each [
								{ key: 'contacts' as const, label: m.component_contacts() },
								{ key: 'participants' as const, label: m.component_participants() },
								{ key: 'publicStatus' as const, label: m.component_visibility() },
								{ key: 'descriptions' as const, label: m.show_descriptions() },
								{ key: 'qrCodes' as const, label: m.show_qr_codes() },
								{ key: 'ticketPrice' as const, label: m.ticket_price() },
								{ key: 'rooms' as const, label: `${m.room()} / ${m.location()}` },
								{ key: 'tags' as const, label: m.tags() },
								{ key: 'heroImage' as const, label: m.component_hero_image() },
								{ key: 'internalNotes' as const, label: m.component_internal_notes() },
								{ key: 'openingHours' as const, label: m.component_opening_hours?.() ?? 'Öffnungszeiten' },
								{ key: 'endTimes' as const, label: m.component_end_times?.() ?? 'Endzeiten' }
							] as opt (opt.key)}
								<button
									type="button"
									onclick={() => toggleComponent(opt.key)}
									class="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
								>
									<span class="font-semibold">{opt.label}</span>
									<span
										class="w-4 h-4 rounded border flex items-center justify-center {visibleComponents[opt.key] ? 'bg-[#6950fc] border-[#6950fc] text-white' : 'border-slate-300'}"
									>
										{#if visibleComponents[opt.key]}<Check class="w-3 h-3 stroke-[3]" />{/if}
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<button
				type="button"
				onclick={() => (showLocationLogo = !showLocationLogo)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border {showLocationLogo ? 'bg-[#f0e7f3] text-[#6950fc] border-[#6950fc]/30' : 'bg-slate-50 text-slate-500 border-slate-200 line-through'}"
			>
				<ImageIcon class="w-3.5 h-3.5" />
				<span>{m.poster_location_logo()}</span>
			</button>

			<button
				type="button"
				onclick={() => (showSponsors = !showSponsors)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border {showSponsors ? 'bg-[#f0e7f3] text-[#6950fc] border-[#6950fc]/30' : 'bg-slate-50 text-slate-500 border-slate-200 line-through'}"
			>
				<Sparkles class="w-3.5 h-3.5" />
				<span>{m.poster_sponsors()}</span>
			</button>

			<select
				bind:value={printOptions.printMode}
				class="text-xs font-semibold rounded-md border border-slate-300 bg-white dark:bg-slate-800 py-1 pl-2 pr-6"
			>
				<option value="all_color">🎨 Vollfarbe</option>
				<option value="greyscale_content">🖨️ Inhalt S/W (CI Farbe)</option>
				<option value="omit_ci">📄 Briefpapier (CI frei)</option>
				<option value="ci_only">🏛️ Nur CI</option>
				<option value="all_greyscale">⬛ Monochrom</option>
			</select>

			<select
				value={ciPreset.id}
				onchange={(e) => {
					const found = [...DEFAULT_HIER_PRESETS, ...customPresets].find(
						(p) => p.id === (e.target as HTMLSelectElement).value
					);
					if (found) ciPreset = { ...found };
				}}
				class="text-xs font-semibold rounded-md border border-slate-300 bg-white dark:bg-slate-800 py-1 pl-2 pr-6"
			>
				{#each [...DEFAULT_HIER_PRESETS, ...customPresets] as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={() => (isHierSettingsOpen = true)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#6950fc]/30 bg-[#f0e7f3] text-[#6950fc] hover:bg-[#fadfed]"
			>
				<Palette class="w-3.5 h-3.5" />
				<span>HIER. CI</span>
			</button>

			<button
				type="button"
				onclick={() => (isSettingsOpen = true)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100"
			>
				<LayoutTemplate class="w-3.5 h-3.5 text-[#6950fc]" />
				<span>{m.custom_sections?.() ?? 'Abschnitte'}</span>
			</button>
		</div>

		<div class="flex items-center gap-2">
			<div class="hidden md:inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
				<button
					type="button"
					onclick={() => (zoomLevel = Math.max(0.4, Number((zoomLevel - 0.1).toFixed(2))))}
					class="p-1 text-slate-500 hover:text-slate-800"
				>
					<ZoomOut class="w-3.5 h-3.5" />
				</button>
				<span class="px-1 text-[11px] font-mono min-w-[3rem] text-center">
					{Math.round(zoomLevel * 100)}%
				</span>
				<button
					type="button"
					onclick={() => (zoomLevel = Math.min(1.5, Number((zoomLevel + 0.1).toFixed(2))))}
					class="p-1 text-slate-500 hover:text-slate-800"
				>
					<ZoomIn class="w-3.5 h-3.5" />
				</button>
			</div>

			<button
				type="button"
				onclick={() => (isSettingsOpen = true)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md border border-slate-300"
			>
				<Settings2 class="w-4 h-4" />
				<span class="hidden lg:inline">{m.poster_settings()}</span>
			</button>

			<button
				type="button"
				onclick={triggerPrint}
				class="inline-flex items-center gap-2 px-3.5 py-1.5 text-white font-semibold rounded-md shadow transition hover:opacity-90"
				style="background-color: {HIER_PALETTE.primaryDigital};"
			>
				<Printer class="w-4 h-4" />
				<span>Drucken</span>
			</button>
		</div>
	</div>
</header>

<!-- Main Canvas -->
<main
	class="w-full min-h-[calc(100vh-60px)] bg-slate-200 dark:bg-slate-950 p-4 sm:p-8 pb-24 flex justify-center items-start overflow-auto print:block print:w-auto print:p-0 print:pb-0 print:m-0 print:bg-white print:min-h-0 print:overflow-visible"
>
	<div
		class="poster-preview-scaler transition-transform duration-150 origin-top flex justify-center print:block print:w-auto print:m-0 print:p-0 print:transform-none"
		style="transform: scale({zoomLevel});"
	>
		<article
			bind:this={posterContentElement}
			class="hier-ci-scope kiosk-typography-scope {docFontFamily && docFontFamily !== 'default' ? 'kiosk-has-custom-font' : ''} poster-sheet {paperSize === 'A3' ? 'paper-a3' : 'paper-a4'} {printOptions.printMode === 'all_greyscale' ? 'monochrome-mode' : ''} {printOptions.printMode === 'omit_ci' ? 'print-omit-ci' : ''} {printOptions.printMode === 'greyscale_content' ? 'print-greyscale-content' : ''} {printOptions.printMode === 'ci_only' ? 'print-ci-only' : ''} {printOptions.hideQrInPrint ? 'print-hide-qr' : ''} {printOptions.hideImagesInPrint ? 'print-hide-images' : ''} {printOptions.grayscaleImagesInPrint ? 'print-grayscale-images' : ''} bg-white text-[#222222] shadow-2xl print:shadow-none print:border-none print:m-0 print:p-0 relative flex flex-col justify-between overflow-hidden"
			style="background-color: {ciPreset.pageBg}; {getDocumentTypographyStyle(docFontFamily, docFontScale)}"
		>
			<!-- Top HIER. Header Band -->
			<div
				class="ci-area shrink-0 {getElementPrintClasses(elementSettings.ciTop, printOptions.previewGreyscaleOnScreen)} {printOptions.printMode === 'omit_ci' ? 'print:invisible' : ''}"
			>
				<HierHeaderBand
					preset={ciPreset}
					printMode={printOptions.printMode}
					locationName={currentLocation?.name || kiosk?.name}
					customLocationLogo={showLocationLogo ? effectiveLocationLogo : ''}
					customOrgLogo={ciPreset.orgLogoUrl}
					heightMm={paperSize === 'A3' ? 48 : 40}
					variant="poster"
					selectedCardId={selectedCardId}
					cardSettings={cardSettings}
					elementSettings={elementSettings}
					previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
					onSelect={(id) => {
						selectedCardId = selectedCardId === id ? null : id;
					}}
				/>
			</div>

			<!-- Middle Content Body -->
			<div
				class="ci-content-body flex-1 min-h-0 flex flex-col justify-between {printOptions.previewGreyscaleOnScreen ? 'card-greyscale' : ''} {printOptions.printMode === 'ci_only' ? 'print:invisible' : ''} {printOptions.printMode === 'greyscale_content' ? 'print:card-greyscale' : ''}"
			>
				<div class="poster-top-container shrink-0">
					<header
						class="poster-header px-8 pt-3 pb-1.5 flex items-end justify-between gap-4 {getElementPrintClasses(elementSettings.header, printOptions.previewGreyscaleOnScreen)}"
					>
						<div>
							<h2
								class="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none"
								style="color: {HIER_PALETTE.primaryDigital};"
							>
								{programmeMonthTitle}
							</h2>
							{#if programmeLocationSubtitle}
								<p class="text-xs font-bold mt-1" style="color: {HIER_PALETTE.navy};">
									{currentLocation?.name ? `${currentLocation.name} • ` : ''}{programmeLocationSubtitle}
								</p>
							{/if}
						</div>
					</header>
				</div>

				{#if customSections.some((s) => s.enabled && s.slot === 'banner')}
					<div class="px-8 pt-2 pb-1 space-y-2">
						{#each customSections.filter((s) => s.enabled && s.slot === 'banner') as sec (sec.id)}
							{@render customSectionCard(sec, 'banner')}
						{/each}
					</div>
				{/if}

				<div
					class="poster-events-grid flex-1 px-8 py-3"
					style="column-count: {effectiveColumns}; column-gap: 1.75rem; {effectiveColumns > 1 ? 'column-rule: 1px solid #edeff4;' : ''}"
				>
					{#if customSections.some((s) => s.enabled && s.slot === 'grid_top')}
						{#each customSections.filter((s) => s.enabled && s.slot === 'grid_top') as sec (sec.id)}
							{@render customSectionCard(sec, 'grid_top')}
						{/each}
					{/if}

					{#if displayItems.length === 0}
						<div class="py-16 text-center text-slate-400">
							<Calendar class="w-12 h-12 mx-auto mb-2 opacity-50" />
							<p class="font-bold text-base">Keine Termine für diesen Zeitraum ausgewählt.</p>
						</div>
					{:else}
						{#each displayItems as item, idx (item.id || idx)}
							{@const isEvt = 'startDateTime' in item}
							{@const evt = item as EnrichedEvent}
							{@const isSpecialNonSeries = isEvt && isNonSeriesEvent(item)}
							{@const isCompressed = Boolean(
								isEvt &&
									evt.isCompressedSeries &&
									((evt.seriesInstances && evt.seriesInstances.length >= 1) ||
										(evt.seriesDates && evt.seriesDates.length >= 1))
							)}
							{@const multiDay = isEvt && isMultiDayEvent(item as Event)}
							{@const durationDays = multiDay ? getEventDurationDays(item as Event) : 1}
							{@const dateParts = isEvt ? getEventDateParts(item as Event) : null}
							{@const dateStr = isEvt
								? (item as Event).startDateTime
								: (item as Announcement).createdAt}
							{@const rooms = isEvt ? getEventRooms(item as Event) : []}
							{@const priceStr = isEvt
								? formatTicketPrice((item as Event).ticketPrice, (item as Event).ticketPriceUnknown, {
										currency: (item as any).currency || 'EUR'
									})
								: ''}
							{@const isFree = isEvt
								? isEventFree((item as Event).ticketPrice, (item as Event).ticketPriceUnknown)
								: false}
							{@const totalInstances = evt.seriesInstances
								? evt.seriesInstances.length
								: evt.seriesDates
									? evt.seriesDates.length
									: 1}
							{@const showEventQr = Boolean(
								visibleComponents.qrCodes &&
									isEvt &&
									(evt.qrCodeDataUrl || evt.qrCodePath) &&
									elementSettings.qrCodes.enabled
							)}
							{@const hasRightVisuals = Boolean(
								visibleComponents.heroImage &&
									(item as any).heroImage &&
									elementSettings.heroImages.enabled
							)}
							{@const itemRecurrenceRule = isEvt
								? (Array.isArray((item as any).recurrence)
										? (item as any).recurrence[0]
										: typeof (item as any).recurrence === 'string'
											? (item as any).recurrence
											: null) ||
									(item as any).seriesMaster?.recurrence?.[0] ||
									null
								: null}

							<div
								role="button"
								tabindex="0"
								class="hier-card-accent kiosk-item-typography {cardSettings[item.id]?.fontFamily ? 'kiosk-has-custom-font' : ''} poster-event-item mb-3 pb-2 break-inside-avoid transition-all rounded-xl border p-2.5 shadow-2xs cursor-pointer {selectedCardId === item.id ? 'bg-amber-100/90 ring-2 ring-amber-400 print:bg-white print:ring-0' : isSpecialNonSeries ? 'border-l-4 border-l-[#fcc505] bg-[#fffcf7] border-[#fcc505]/45' : isCompressed ? 'border-l-4 border-l-[#6950fc] bg-[#f0e7f3]/50 border-[#6950fc]/25' : 'border-l-4 border-l-[#40b28f] bg-white border-[#edeff4]'} {getCardPrintClasses(cardSettings[item.id], elementSettings.events, printOptions.previewGreyscaleOnScreen)} {density === 'compact' ? 'mb-1.5 pb-1.5 text-[11px]' : density === 'relaxed' ? 'mb-4 pb-2.5 text-[13px]' : 'text-xs'}"
								style={getItemTypographyStyle(
									cardSettings[item.id]?.fontFamily,
									cardSettings[item.id]?.fontScale
								)}
								onclick={(e) => {
									e.stopPropagation();
									selectedCardId = selectedCardId === item.id ? null : item.id;
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										e.stopPropagation();
										selectedCardId = selectedCardId === item.id ? null : item.id;
									}
								}}
							>
								<div class="flex items-start gap-3">
									{#if showEventQr}
										<div
											class="flex flex-col items-center justify-center p-1 bg-white border border-[#6950fc]/20 rounded-lg shrink-0 {getElementPrintClasses(elementSettings.qrCodes, printOptions.previewGreyscaleOnScreen)}"
										>
											<img
												src={evt.qrCodeDataUrl || evt.qrCodePath}
												alt="QR"
												class="{density === 'compact' ? 'w-12 h-12' : density === 'relaxed' ? 'w-[66px] h-[66px]' : 'w-[54px] h-[54px]'} object-contain"
											/>
										</div>
									{:else if isCompressed}
										<div
											class="hier-date-pill shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded-lg bg-[#6950fc] text-white text-center"
										>
											<RefreshCw class="w-3.5 h-3.5 text-[#ffec00] mb-0.5" />
											<span class="text-sm font-black leading-tight">{totalInstances}×</span>
											<span class="text-[7.5px] uppercase opacity-85 leading-none">
												{m.series_badge()}
											</span>
										</div>
									{:else if multiDay && dateParts}
										<div
											class="hier-date-pill shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded-lg bg-[#29235c] text-white text-center"
										>
											<span class="text-[8px] font-extrabold uppercase text-[#fcc505] leading-none">
												{dateParts.startMonth}
											</span>
											<span class="text-xs font-black leading-tight my-0.5">
												{dateParts.startDay}–{dateParts.endDay}
											</span>
											<span class="text-[7.5px] uppercase opacity-80 leading-none">
												{m.days_count({ count: durationDays })}
											</span>
										</div>
									{:else}
										<div
											class="hier-date-pill shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded-lg text-center {isSpecialNonSeries ? 'bg-[#fcc505] text-[#222222]' : 'bg-[#29235c] text-white'}"
										>
											<span
												class="text-[8.5px] font-bold tracking-wider uppercase leading-none {isSpecialNonSeries ? 'text-[#222222]' : 'text-[#fcc505]'}"
											>
												{formatDateWeekday(dateStr)}
											</span>
											<span class="text-base font-black leading-none my-0.5">
												{formatDateDay(dateStr)}
											</span>
											<span class="text-[8px] uppercase tracking-wider opacity-85 leading-none">
												{formatDateMonth(dateStr)}
											</span>
										</div>
									{/if}

									<div class="flex-1 min-w-0 flow-root">
										{#if wrapAroundQr && hasRightVisuals}
											<div class="float-right ml-2 mb-1 flex items-start gap-1.5">
												{@render rightVisuals(item, evt)}
											</div>
										{/if}

										<div class="text-[#222222]/75 font-medium mb-0.5 text-[10px] [&>*]:mr-1.5 [&>*]:mb-0.5 [&>*]:align-middle">
											<h3
												class="inline mr-1.5 font-bold text-[#29235c] leading-snug tracking-tight {density === 'compact' ? 'text-xs' : density === 'relaxed' ? 'text-sm' : 'text-[13px]'} {evt.status === 'cancelled' ? 'line-through opacity-50' : ''}"
											>
												{isEvt ? (item as Event).summary : (item as Announcement).title}
											</h3>
											{#if isCompressed}
												<span class="hier-badge inline-flex items-center gap-1 bg-[#f0e7f3] text-[#6950fc] text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
													<RefreshCw class="w-2.5 h-2.5" />
													{evt.recurrenceText || m.series_badge()}
												</span>
											{:else if isEvt && itemRecurrenceRule}
												<span class="inline-flex items-center gap-1 text-[#6950fc] font-medium text-[9px]">
													<RefreshCw class="w-2.5 h-2.5" />
													{formatRecurrenceText(itemRecurrenceRule, {
														short: true,
														dtstart: (item as Event).startDateTime
													})}
												</span>
											{/if}
											{#if evt.status === 'cancelled'}
												<span class="bg-[#da5096] text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
													{m.cancelled()}
												</span>
											{:else if evt.status === 'tentative'}
												<span class="bg-[#fcc505] text-[#222222] text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
													{m.tentative()}
												</span>
											{/if}
											{#if showEventQr && !isCompressed && isEvt}
												<span class="hier-badge inline-flex items-center gap-0.5 bg-[#29235c] text-white px-1.5 py-0.2 rounded text-[8.5px] font-bold">
													{formatDateWeekday(dateStr)} {formatDateDay(dateStr)} {formatDateMonth(dateStr)}
												</span>
											{/if}
											{#if showTimes && isEvt}
												{@const showEnd =
													cardSettings[item.id]?.hideEndTime !== undefined
														? !cardSettings[item.id]!.hideEndTime
														: visibleComponents.endTimes}
												<span class="inline-flex items-center gap-1 font-bold text-[#29235c]">
													<Clock class="w-3 h-3 text-[#6950fc] shrink-0" />
													{formatTimeRange(
														(item as Event).startDateTime,
														(item as Event).endDateTime,
														(item as Event).isAllDay,
														showEnd
													)}
												</span>
											{/if}
											{#if visibleComponents.rooms && rooms.length > 0}
												<span class="inline-flex items-center gap-1 text-[#6950fc] bg-[#f0e7f3] px-1.5 py-0.2 rounded text-[9px] font-semibold">
													<MapPin class="w-2.5 h-2.5" />
													{rooms.join(', ')}
												</span>
											{/if}
											{#if visibleComponents.ticketPrice}
												{#if isFree}
													<span class="hier-badge inline-flex items-center font-bold text-[#29235c] bg-[#e3f0ea] border border-[#40b28f]/40 px-1.5 py-0.2 rounded text-[9px]">
														{m.ticket_price_free?.() || 'Kostenlos'}
													</span>
												{:else if priceStr}
													<span class="inline-flex items-center font-semibold text-[#29235c] bg-[#edeff4] px-1.5 py-0.2 rounded text-[9px]">
														{priceStr}
													</span>
												{/if}
											{/if}
										</div>

										{#if isCompressed && !cardSettings[item.id]?.hideSeriesDates && evt.seriesInstances && evt.seriesInstances.length >= 1}
											<div class="mt-1 [&>*]:mr-1 [&>*]:mb-0.5 [&>*]:align-middle">
												{#each evt.seriesInstances as inst (inst.id || inst.startDateTime)}
													{#if inst.status === 'cancelled'}
														<span class="inline-flex items-center gap-0.5 bg-[#fadfed] text-[#da5096] px-1.5 py-0.2 rounded text-[8.5px] font-bold line-through">
															{formatDateWeekday(inst.startDateTime)} {formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}
														</span>
													{:else}
														<span class="hier-badge inline-flex items-center gap-0.5 bg-[#29235c] text-white px-1.5 py-0.2 rounded text-[8.5px] font-bold">
															<span class="text-[#fcc505]">{formatDateWeekday(inst.startDateTime)}</span>
															<span>{formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}</span>
														</span>
													{/if}
												{/each}
											</div>
										{/if}

										{#if visibleComponents.contacts && isEvt}
											{@const allContacts = getAllEventContacts(item as Event)}
											{#if allContacts.length > 0}
												<div class="mt-1 flex flex-wrap gap-1">
													{#each allContacts as c (c.id || c.name || getContactName(c))}
														<span class="inline-flex items-center gap-1 bg-[#edeff4] px-1.5 py-0.2 rounded text-[9px] font-medium">
															<User class="w-2.5 h-2.5 text-[#6950fc]" />
															<span>{getContactName(c)}</span>
														</span>
													{/each}
												</div>
											{/if}
										{/if}

										{#if visibleComponents.descriptions && descriptionStyle !== 'none'}
											{@const rawDesc = isEvt
												? (item as Event).description
												: (item as Announcement).content}
											{@const compactSignUp = isEvt
												? getKioskSignUpText(item as any, { showQrCode: showEventQr })
												: ''}
											{#if (rawDesc && rawDesc.trim()) || compactSignUp}
												<div
													class="mt-0.5 text-[#222222]/85 leading-relaxed {itemPercentages[item.id] === undefined && descriptionStyle === 'short' ? (wrapAroundQr ? 'max-h-[3.25em] overflow-clip' : 'line-clamp-2') : ''} text-[10px]"
												>
													{#if compactSignUp}
														<span class="font-bold text-[#da5096] mr-1">{compactSignUp}.</span>
													{/if}
													{#if rawDesc && rawDesc.trim()}
														<span class="rich-description [&>p:first-child]:inline [&>p]:mb-0">
															{@html itemPercentages[item.id] === 100
																? rawDesc
																: (itemDescriptions[item.id] ?? rawDesc)}
														</span>
													{/if}
												</div>
											{/if}
										{/if}

										{#if visibleComponents.tags && (item as any).tags && (item as any).tags.length > 0}
											<div class="mt-0.5 flex flex-wrap gap-1">
												{#each (item as any).tags as t, tIdx (typeof t === 'string' ? `${t}_${tIdx}` : t.id || t.name || tIdx)}
													<span class="text-[8.5px] px-1 py-0.2 bg-[#edeff4] text-[#29235c] rounded">
														#{typeof t === 'string' ? t : t.name || t.tag?.name}
													</span>
												{/each}
											</div>
										{/if}
									</div>

									{#if !wrapAroundQr && hasRightVisuals}
										<div class="shrink-0 flex items-center gap-1.5 self-start pt-1">
											{@render rightVisuals(item, evt)}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{/if}

					{#if customSections.some((s) => s.enabled && s.slot === 'grid_bottom')}
						{#each customSections.filter((s) => s.enabled && s.slot === 'grid_bottom') as sec (sec.id)}
							{@render customSectionCard(sec, 'grid_bottom')}
						{/each}
					{/if}
				</div>

				{#if customSections.some((s) => s.enabled && s.slot === 'footer')}
					<div class="px-8 py-2 space-y-2">
						{#each customSections.filter((s) => s.enabled && s.slot === 'footer') as sec (sec.id)}
							{@render customSectionCard(sec, 'footer')}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Bottom HIER. Footer Band -->
			<div
				class="ci-area shrink-0 {getElementPrintClasses(elementSettings.ciBottom, printOptions.previewGreyscaleOnScreen)} {printOptions.printMode === 'omit_ci' ? 'print:invisible' : ''}"
			>
				<HierFooterBand
					preset={ciPreset}
					printMode={printOptions.printMode}
					locationName={currentLocation?.name}
					street={currentLocation?.street}
					houseNumber={currentLocation?.houseNumber}
					zip={currentLocation?.zip}
					city={currentLocation?.city}
					phone={currentLocation?.contact?.phone}
					inclusivityText={currentLocation?.inclusivitySupport}
					sponsors={effectiveSponsors}
					partnerLogoUrl={ciPreset.partnerLogoUrl}
					heightMm={paperSize === 'A3' ? 42 : 34}
					variant="poster"
					selectedCardId={selectedCardId}
					cardSettings={cardSettings}
					elementSettings={elementSettings}
					previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
					onSelect={(id) => {
						selectedCardId = selectedCardId === id ? null : id;
					}}
				/>
			</div>
		</article>
	</div>
</main>

<HierSettingsModal
	bind:open={isHierSettingsOpen}
	bind:preset={ciPreset}
	bind:printOptions={printOptions}
	bind:elementSettings={elementSettings}
	bind:customPresets={customPresets}
	isFlyer={false}
	onSavePreset={handleSaveCustomPreset}
	onDeletePreset={handleDeleteCustomPreset}
/>

<CardLayoutActionBar
	{selectedItem}
	kioskId={kiosk?.id || 'default'}
	scopeLabel="HIER. Plakat"
	{docFontFamily}
	{docFontScale}
	onDocFontFamilyChange={(fontFamily) => {
		docFontFamily = fontFamily;
		savePrefs();
	}}
	onDocFontScaleChange={(fontScale) => {
		docFontScale = fontScale;
		savePrefs();
	}}
	itemFontFamily={selectedItem ? (cardSettings[selectedItem.id]?.fontFamily ?? '') : ''}
	itemFontScale={selectedItem ? (cardSettings[selectedItem.id]?.fontScale ?? 1) : 1}
	onItemFontFamilyChange={(fontFamily) => {
		if (!selectedItem) return;
		cardSettings[selectedItem.id] = {
			...cardSettings[selectedItem.id],
			fontFamily: fontFamily || undefined
		};
		savePrefs();
	}}
	onItemFontScaleChange={(fontScale) => {
		if (!selectedItem) return;
		cardSettings[selectedItem.id] = {
			...cardSettings[selectedItem.id],
			fontScale
		};
		savePrefs();
	}}
	currentPercentage={selectedItem ? itemPercentages[selectedItem.id] : undefined}
	currentBehavior={selectedItem
		? (cardSettings[selectedItem.id]?.printBehavior ?? DEFAULT_ELEMENT_SETTINGS.events.printBehavior)
		: 'print'}
	currentColor={selectedItem
		? (cardSettings[selectedItem.id]?.printColor ?? DEFAULT_ELEMENT_SETTINGS.events.printColor)
		: 'color'}
	hideSeriesDates={selectedItem ? Boolean(cardSettings[selectedItem.id]?.hideSeriesDates) : false}
	hideEndTime={selectedItem
		? (cardSettings[selectedItem.id]?.hideEndTime ?? !visibleComponents.endTimes)
		: false}
	onPercentageChange={(percentage, text) => {
		if (!selectedItem) return;
		itemPercentages[selectedItem.id] = percentage;
		itemDescriptions[selectedItem.id] = text;
		savePrefs();
	}}
	onBehaviorChange={(behavior) => {
		if (!selectedItem) return;
		cardSettings[selectedItem.id] = {
			...cardSettings[selectedItem.id],
			printBehavior: behavior
		};
		savePrefs();
	}}
	onColorChange={(color) => {
		if (!selectedItem) return;
		cardSettings[selectedItem.id] = {
			...cardSettings[selectedItem.id],
			printColor: color
		};
		savePrefs();
	}}
	onToggleSeriesDates={(hide) => {
		if (!selectedItem) return;
		cardSettings[selectedItem.id] = {
			...cardSettings[selectedItem.id],
			hideSeriesDates: hide
		};
		savePrefs();
	}}
	onToggleEndTime={(hide) => {
		if (!selectedItem) return;
		cardSettings[selectedItem.id] = {
			...cardSettings[selectedItem.id],
			hideEndTime: hide
		};
		savePrefs();
	}}
	onClose={() => {
		selectedCardId = null;
	}}
/>

<!-- Poster Settings & Custom Sections Modal -->
{#if isSettingsOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print:hidden"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800"
		>
			<div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
				<div class="flex items-center gap-2">
					<Settings2 class="w-5 h-5 text-[#6950fc]" />
					<h2 class="text-lg font-bold">{m.poster_settings()}</h2>
				</div>
				<button
					type="button"
					onclick={() => (isSettingsOpen = false)}
					class="p-1 rounded-md text-slate-400 hover:text-slate-600"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
				<!-- Titles -->
				<section class="space-y-3">
					<h3 class="font-bold">Titel &amp; Untertitel anpassen</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="hierPosterTitle" class="block text-xs font-semibold text-slate-600 mb-1">
								Hauptüberschrift
							</label>
							<input
								id="hierPosterTitle"
								type="text"
								bind:value={customProgrammeTitle}
								placeholder={programmeMonthTitle}
								class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600"
							/>
						</div>
						<div>
							<label for="hierPosterSub" class="block text-xs font-semibold text-slate-600 mb-1">
								Standort-Untertitel / Adresse
							</label>
							<input
								id="hierPosterSub"
								type="text"
								bind:value={customProgrammeSubtitle}
								placeholder={programmeLocationSubtitle}
								class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600"
							/>
						</div>
					</div>
				</section>

				<!-- Location Logo Upload -->
				<section class="space-y-3 border-t border-slate-200 pt-4">
					<h3 class="font-bold">Standort-Logo</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label
							class="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 rounded-md hover:border-[#6950fc] cursor-pointer"
						>
							<Upload class="w-4 h-4 text-slate-400 mb-1" />
							<span class="text-xs font-medium">Logo hochladen</span>
							<input
								type="file"
								accept="image/*"
								class="hidden"
								onchange={(e) => handleImageUpload(e, 'location')}
							/>
						</label>
						<div>
							<label for="hierLocLogoUrl" class="block text-xs font-semibold text-slate-600 mb-1">
								Oder Logo-URL
							</label>
							<input
								id="hierLocLogoUrl"
								type="text"
								bind:value={customLocationLogoUrl}
								placeholder="/logos/location-suedspitze.png"
								class="w-full text-xs p-2 rounded border border-slate-300"
							/>
						</div>
					</div>
				</section>

				<!-- Sponsors -->
				<section class="space-y-3 border-t border-slate-200 pt-4">
					<div class="flex items-center justify-between">
						<h3 class="font-bold">Partner &amp; Förderer</h3>
						<button
							type="button"
							onclick={addSponsor}
							class="inline-flex items-center gap-1 text-xs font-semibold text-[#6950fc]"
						>
							<Plus class="w-3.5 h-3.5" />
							Sponsor hinzufügen
						</button>
					</div>
					{#each sponsors as s (s.id)}
						<div class="flex items-center gap-2">
							<input
								type="text"
								bind:value={s.name}
								placeholder="Name"
								class="w-1/3 text-xs p-1.5 rounded border border-slate-300"
							/>
							<input
								type="text"
								bind:value={s.logoUrl}
								placeholder="Logo URL"
								class="flex-1 text-xs p-1.5 rounded border border-slate-300"
							/>
							<button
								type="button"
								onclick={() => removeSponsor(s.id)}
								class="p-1 text-red-500"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					{/each}
				</section>

				<!-- Custom Sections -->
				<section class="space-y-3 border-t border-slate-200 pt-4">
					<div class="flex items-center justify-between">
						<h3 class="font-bold">{m.custom_sections?.() ?? 'Abschnitte & Zusatzbereiche'}</h3>
						<div class="flex items-center gap-2">
							{#if currentLocation?.openingHours}
								<button
									type="button"
									onclick={addOpeningHoursSection}
									class="px-2 py-1 text-xs rounded bg-[#fffcf7] border border-[#fcc505] font-medium"
								>
									+ Öffnungszeiten
								</button>
							{/if}
							<button
								type="button"
								onclick={() => addCustomSection('banner')}
								class="px-2.5 py-1 text-xs font-semibold rounded bg-[#6950fc] text-white"
							>
								+ Abschnitt
							</button>
						</div>
					</div>
					{#each customSections as sec (sec.id)}
						<div class="p-3 rounded-xl border border-slate-200 space-y-2">
							<div class="flex items-center gap-2">
								<input type="checkbox" bind:checked={sec.enabled} onchange={savePrefs} />
								<input
									type="text"
									bind:value={sec.title}
									oninput={savePrefs}
									class="flex-1 text-xs font-bold p-1 rounded border border-slate-300"
								/>
								<select
									bind:value={sec.slot}
									onchange={savePrefs}
									class="text-[11px] p-1 rounded border border-slate-300"
								>
									<option value="banner">Banner</option>
									<option value="grid_top">Vor Terminen</option>
									<option value="grid_bottom">Nach Terminen</option>
									<option value="footer">Fußbereich</option>
								</select>
								<select
									bind:value={sec.accentColor}
									onchange={savePrefs}
									class="text-[11px] p-1 rounded border border-slate-300"
								>
									<option value="purple">Lila (#6950fc)</option>
									<option value="pink">Pink (#da5096)</option>
									<option value="yellow">Gelb (#fcc505)</option>
									<option value="green">Grün (#40b28f)</option>
								</select>
								<button
									type="button"
									onclick={() => removeCustomSection(sec.id)}
									class="p-1 text-slate-400 hover:text-red-600"
								>
									<Trash2 class="w-3.5 h-3.5" />
								</button>
							</div>
							<textarea
								bind:value={sec.content}
								oninput={savePrefs}
								rows="2"
								class="w-full text-xs p-2 rounded border border-slate-300"
							></textarea>
						</div>
					{/each}
				</section>
			</div>

			<div class="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-xl">
				<button
					type="button"
					onclick={() => {
						localStorage.removeItem(storageKey);
						toast.info('Einstellungen zurückgesetzt');
						window.location.reload();
					}}
					class="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
				>
					<RotateCcw class="w-3.5 h-3.5" />
					Zurücksetzen
				</button>
				<button
					type="button"
					onclick={() => (isSettingsOpen = false)}
					class="px-4 py-2 text-white font-medium rounded-md text-xs"
					style="background-color: {HIER_PALETTE.primaryDigital};"
				>
					Fertig
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.paper-a4 {
		width: 210mm;
		min-height: 297mm;
		max-height: 297mm;
		box-sizing: border-box;
	}

	.paper-a3 {
		width: 297mm;
		min-height: 420mm;
		max-height: 420mm;
		box-sizing: border-box;
	}

	.rich-description :global(p) {
		margin-top: 0;
		margin-bottom: 0.25rem;
	}
	.rich-description :global(p:last-child) {
		margin-bottom: 0;
	}

	@media print {
		@page {
			size: portrait;
			margin: 0 !important;
		}
		:global(html),
		:global(body) {
			margin: 0 !important;
			padding: 0 !important;
			background: #ffffff !important;
			color: #000000 !important;
			overflow: visible !important;
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
		}
		:global(body > *),
		:global(main),
		main,
		.poster-preview-scaler {
			display: block !important;
			float: none !important;
			position: static !important;
			margin: 0 !important;
			padding: 0 !important;
			width: auto !important;
			max-width: none !important;
			height: auto !important;
			min-height: 0 !important;
			background: #ffffff !important;
			transform: none !important;
			overflow: visible !important;
			box-sizing: border-box !important;
		}
		.poster-sheet {
			display: flex !important;
			flex-direction: column !important;
			justify-content: space-between !important;
			margin: 0 !important;
			padding: 0 !important;
			box-shadow: none !important;
			border: none !important;
			border-radius: 0 !important;
			overflow: hidden !important;
			page-break-after: avoid !important;
			break-after: avoid !important;
			page-break-inside: avoid !important;
			break-inside: avoid !important;
			box-sizing: border-box !important;
		}
		.paper-a4 {
			width: 210mm !important;
			height: 297mm !important;
			max-height: 297mm !important;
		}
		.paper-a3 {
			width: 297mm !important;
			height: 420mm !important;
			max-height: 420mm !important;
		}
		.print-omit-ci .ci-area,
		.print-omit-ci :global(.ci-top-triangle-container),
		.print-omit-ci :global(.ci-bottom-triangle-container) {
			visibility: hidden !important;
		}
		.print-ci-only .ci-content-body {
			visibility: hidden !important;
		}
		.poster-event-item {
			page-break-inside: avoid !important;
			break-inside: avoid !important;
		}
	}
</style>
