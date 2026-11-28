<script lang="ts">
	import { onMount, untrack } from 'svelte';
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
		Phone,
		Mail,
		User,
		ArrowLeft,
		CheckCircle2,
		FoldVertical,
		ZoomIn,
		ZoomOut,
		RefreshCw,
		QrCode,
		Palette
	} from '@lucide/svelte';
	import HierHeaderBand from './hier/HierHeaderBand.svelte';
	import HierFooterBand from './hier/HierFooterBand.svelte';
	import HierRays from './hier/HierRays.svelte';
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
		type CardPrintConfig,
		type CiPrintOptions,
		type KioskElementSettings
	} from './ci/types.js';
	import { summarizeFlyerItems } from '../../../routes/kiosks/[id]/view/summarize.remote';
	import { getKioskSignUpText } from '#lib/utils/kiosk-signup.js';
	import type { FlyerItemSummary, FlyerDensity } from '#lib/validations/flyer.js';
	import { resolve } from '$app/paths';
	import { formatRecurrenceText } from '#lib/utils/format-recurrence.js';
	import { formatTicketPrice } from '#lib/utils/format-ticket-price.js';
	import { getEventRooms } from '#lib/utils/format-rooms.js';
	import { isSeriesItem, isNonSeriesEvent, getSeriesRootId } from '#lib/utils/event-series.js';
	import {
		isMultiDayEvent,
		getEventDurationDays,
		getEventDateParts
	} from '#lib/utils/format-event-date.js';
	import * as m from '#lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/env';

	interface LocationContact {
		name: string;
		email?: string;
		phone?: string;
		qrCodePath?: string;
		qrCodeDataUrl?: string;
		role?: string | null;
		roles?: string[] | null;
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
		what3words?: string | null;
		latitude?: number | null;
		longitude?: number | null;
		heroImage?: string | null;
		description?: string | null;
		contact?: LocationContact | null;
	}

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
			loopDuration?: number;
		};
	} = $props();

	let activeLocationId = $state<string>('all');
	let showFoldGuides = $state(true);
	let showQrCodes = $state(true);
	let showEventQrCodes = $state<boolean>(
		untrack(() => (kiosk as any)?.showEventQrCodes ?? false)
	);
	let showDescriptions = $state(true);
	let showFooters = $state(false);
	let showEndTimes = $state(true);
	let compressSeries = $state(true);
	let density = $state<FlyerDensity>('standard');
	let zoomLevel = $state<number>(0.85);
	let isSummarizing = $state(false);

	let ciPreset = $state<HierCiPreset>({ ...DEFAULT_HIER_PRESETS[0] });
	let customPresets = $state<HierCiPreset[]>([]);
	let printOptions = $state<CiPrintOptions>({ ...DEFAULT_HIER_PRINT_OPTIONS });
	let elementSettings = $state<KioskElementSettings>({ ...DEFAULT_ELEMENT_SETTINGS });
	let isHierSettingsOpen = $state<boolean>(false);
	let itemPercentages = $state<Record<string, number>>({});
	let selectedCardId = $state<string | null>(null);
	let cardSettings = $state<Record<string, CardPrintConfig>>({});
	let docFontFamily = $state<string>('default');
	let docFontScale = $state<number>(1);
	let aiSummaries = $state<Record<string, FlyerItemSummary>>({});
	let hasAiSummaries = $derived(Object.keys(aiSummaries).length > 0);

	let selectedItem = $derived.by(() => {
		if (!selectedCardId) return null;
		if (selectedCardId === 'org_logo') {
			return { id: 'org_logo', title: 'Trägerlogo', description: undefined, isLogo: true };
		}
		if (selectedCardId === 'location_logo') {
			return { id: 'location_logo', title: 'Standortlogo', description: undefined, isLogo: true };
		}
		if (selectedCardId === 'partner_logo') {
			return { id: 'partner_logo', title: 'Partnerlogo', description: undefined, isLogo: true };
		}
		const it = items.find((i) => i.id === selectedCardId);
		if (!it) return null;
		const isEvt = 'startDateTime' in it;
		const hasEndTime = Boolean(isEvt && (it as Event).endDateTime && !(it as Event).isAllDay);
		return {
			id: it.id,
			title: isEvt ? (it as Event).summary : (it as Announcement).title,
			description: isEvt ? (it as Event).description : (it as Announcement).content,
			hasSeriesDates: Boolean(
				(it as any).isCompressedSeries &&
					(it as any).seriesDates &&
					(it as any).seriesDates.length >= 1
			),
			hasEndTime
		};
	});

	const storageKeyCi = $derived(`kiosk_flyer_hier_settings_${kiosk?.id || 'default'}`);

	function handleSaveCustomPreset(newPreset: HierCiPreset) {
		customPresets = [...customPresets.filter((p) => p.id !== newPreset.id), newPreset];
		ciPreset = { ...newPreset };
		saveCiPrefs();
		toast.success(`Preset "${newPreset.name}" gespeichert`);
	}

	function handleDeleteCustomPreset(id: string) {
		customPresets = customPresets.filter((p) => p.id !== id);
		if (ciPreset.id === id) ciPreset = { ...DEFAULT_HIER_PRESETS[0] };
		saveCiPrefs();
		toast.info('Preset gelöscht');
	}

	function saveCiPrefs() {
		if (!browser) return;
		try {
			localStorage.setItem(
				storageKeyCi,
				JSON.stringify({
					ciPreset,
					customPresets,
					printOptions,
					elementSettings,
					itemPercentages,
					cardSettings,
					showFoldGuides,
					showQrCodes,
					showEventQrCodes,
					showDescriptions,
					showFooters,
					showEndTimes,
					compressSeries,
					density,
					docFontFamily,
					docFontScale
				})
			);
		} catch (e) {
			console.error('Failed to save HIER flyer preferences', e);
		}
	}

	$effect(() => {
		const _ = [
			ciPreset,
			customPresets,
			printOptions,
			elementSettings,
			itemPercentages,
			cardSettings,
			showFoldGuides,
			showQrCodes,
			showEventQrCodes,
			showDescriptions,
			showFooters,
			showEndTimes,
			compressSeries,
			density,
			docFontFamily,
			docFontScale
		];
		saveCiPrefs();
	});

	let flyerLocations = $derived.by<LocationInfo[]>(() => {
		if (kiosk.locations && kiosk.locations.length > 0) return kiosk.locations;
		return [
			{
				id: 'default',
				name: kiosk.name || m.community_center(),
				street: null,
				houseNumber: null,
				addressSuffix: null,
				zip: null,
				city: null,
				state: null,
				country: null,
				roomId: null,
				capacity: null,
				inclusivitySupport: null,
				what3words: null,
				latitude: null,
				longitude: null,
				heroImage: null,
				description: kiosk.description || null,
				contact: null
			}
		];
	});

	let displayedLocations = $derived(
		activeLocationId === 'all'
			? flyerLocations
			: flyerLocations.filter((l) => l.id === activeLocationId)
	);

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
		if (locId === 'default') return true;
		const itemLocIds = getItemLocationIds(item);
		if (itemLocIds.size > 0) return itemLocIds.has(locId);
		const isAnnouncement = !('startDateTime' in item);
		return isAnnouncement && flyerLocations.length <= 1;
	}

	onMount(() => {
		if (!browser || !kiosk.id) return;
		try {
			const cached = localStorage.getItem(`flyer_ai_summaries_${kiosk.id}`);
			if (cached) aiSummaries = JSON.parse(cached);
			const cachedCi = localStorage.getItem(storageKeyCi);
			if (cachedCi) {
				const parsed = JSON.parse(cachedCi);
				if (parsed.ciPreset) ciPreset = { ...DEFAULT_HIER_PRESETS[0], ...parsed.ciPreset };
				if (Array.isArray(parsed.customPresets)) customPresets = parsed.customPresets;
				if (parsed.printOptions) printOptions = { ...printOptions, ...parsed.printOptions };
				if (parsed.elementSettings)
					elementSettings = { ...DEFAULT_ELEMENT_SETTINGS, ...parsed.elementSettings };
				if (parsed.itemPercentages) itemPercentages = parsed.itemPercentages;
				if (parsed.cardSettings && typeof parsed.cardSettings === 'object')
					cardSettings = parsed.cardSettings;
				if (parsed.showFoldGuides !== undefined) showFoldGuides = parsed.showFoldGuides;
				if (parsed.showQrCodes !== undefined) showQrCodes = parsed.showQrCodes;
				if (parsed.showEventQrCodes !== undefined) showEventQrCodes = parsed.showEventQrCodes;
				if (parsed.showDescriptions !== undefined) showDescriptions = parsed.showDescriptions;
				if (parsed.showFooters !== undefined) showFooters = parsed.showFooters;
				if (parsed.showEndTimes !== undefined) showEndTimes = parsed.showEndTimes;
				if (parsed.compressSeries !== undefined) compressSeries = parsed.compressSeries;
				if (parsed.density) density = parsed.density;
				if (typeof parsed.docFontFamily === 'string') docFontFamily = parsed.docFontFamily;
				if (typeof parsed.docFontScale === 'number') docFontScale = parsed.docFontScale;
			}
		} catch (e) {
			console.error('Failed to load cached HIER flyer settings', e);
		}
	});

	function saveSummariesToCache(summaries: Record<string, FlyerItemSummary>) {
		if (!browser || !kiosk.id) return;
		try {
			localStorage.setItem(`flyer_ai_summaries_${kiosk.id}`, JSON.stringify(summaries));
		} catch (e) {
			console.error('Failed to save flyer summaries', e);
		}
	}

	async function handleAiSummarize() {
		if (isSummarizing || !kiosk.id || items.length === 0) return;
		isSummarizing = true;
		try {
			const flyerInputItems = items.map((item) => {
				const isEvt = 'startDateTime' in item;
				const title = isEvt ? (item as Event).summary : (item as Announcement).title;
				const desc = isEvt ? (item as Event).description : (item as Announcement).content;
				const locNames =
					'locations' in item && Array.isArray((item as any).locations)
						? (item as any).locations.map((l: any) => l.name || l.location?.name).filter(Boolean)
						: [];
				const roomNames = isEvt ? getEventRooms(item as Event) : [];
				return {
					id: item.id,
					title: title || 'Untitled',
					description: desc || null,
					startDateTime: isEvt ? (item as Event).startDateTime || null : null,
					endDateTime: isEvt ? (item as Event).endDateTime || null : null,
					type: isEvt ? ('event' as const) : ('announcement' as const),
					locationNames: locNames,
					roomNames
				};
			});
			const result = await summarizeFlyerItems({
				kioskId: kiosk.id,
				targetDensity: density,
				items: flyerInputItems
			});
			if (result.success && result.summaries) {
				aiSummaries = { ...aiSummaries, ...result.summaries };
				saveSummariesToCache(aiSummaries);
				toast.success(m.ai_summary_applied());
			} else if (result.error) {
				toast.error(result.error);
			}
		} catch (e: any) {
			console.error('Flyer summarization error', e);
			toast.error(e?.message || m.something_went_wrong());
		} finally {
			isSummarizing = false;
		}
	}

	function resetSummaries() {
		aiSummaries = {};
		if (browser && kiosk.id) localStorage.removeItem(`flyer_ai_summaries_${kiosk.id}`);
		toast.info(m.reset_original_text());
	}

	function triggerPrint() {
		if (browser) window.print();
	}

	function formatDay(dateStr?: string | null) {
		if (!dateStr) return '--';
		const d = new Date(dateStr);
		return isNaN(d.getTime()) ? '--' : d.toLocaleDateString(undefined, { day: '2-digit' });
	}

	function formatMonth(dateStr?: string | null) {
		if (!dateStr) return '---';
		const d = new Date(dateStr);
		return isNaN(d.getTime())
			? '---'
			: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
	}

	function formatTimeRange(
		startStr?: string | null,
		endStr?: string | null,
		isAllDay = false,
		showEndTime = true
	) {
		if (isAllDay) return m.all_day_label();
		if (!startStr) return '';
		const start = new Date(startStr);
		if (isNaN(start.getTime())) return '';
		const startFormatted = start.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit'
		});
		if (!endStr || !showEndTime) return startFormatted;
		const end = new Date(endStr);
		if (isNaN(end.getTime())) return startFormatted;
		const endFormatted = end.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${startFormatted} – ${endFormatted}`;
	}

	function getDateRangeTitle(): string {
		if (kiosk.startDate && kiosk.endDate) {
			const s = new Date(kiosk.startDate);
			const e = new Date(kiosk.endDate);
			if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
				const sStr = s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
				const eStr = e.toLocaleDateString(undefined, {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				});
				return `${sStr} – ${eStr}`;
			}
		}
		return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	function getItemTitle(item: Event | Announcement): string {
		if (aiSummaries[item.id]?.title) return aiSummaries[item.id].title;
		return 'startDateTime' in item ? (item as Event).summary : (item as Announcement).title;
	}

	function getItemSummary(item: Event | Announcement): string {
		const raw = 'startDateTime' in item ? (item as Event).description : (item as Announcement).content;
		if (itemPercentages[item.id] === 100) return raw ? raw.trim() : '';
		if (aiSummaries[item.id]?.summary) return aiSummaries[item.id].summary;
		return raw ? raw.trim() : '';
	}

	function handleInlineEdit(
		itemId: string,
		currentTitle: string,
		currentSummary: string,
		event: FocusEvent
	) {
		const el = event.target as HTMLElement;
		const newText = (el.innerHTML || el.innerText).trim();
		if (newText !== currentSummary) {
			aiSummaries[itemId] = { id: itemId, title: currentTitle, summary: newText };
			saveSummariesToCache(aiSummaries);
		}
	}

	type FlyerDisplayItem = (Event | Announcement) & {
		isCompressedSeries?: boolean;
		seriesDates?: string[];
		recurrenceText?: string;
		instanceCount?: number;
		qrCodePath?: string | null;
		qrCodeDataUrl?: string | null;
	};

	function compressSeriesEvents(eventList: Event[]): FlyerDisplayItem[] {
		if (!compressSeries) return eventList;
		const seriesGroups = new Map<string, Event[]>();
		const nonSeriesEvents: Event[] = [];
		for (const evt of eventList) {
			if (isSeriesItem(evt)) {
				const sKey = getSeriesRootId(evt) || evt.id;
				const group = seriesGroups.get(sKey) || [];
				group.push(evt);
				seriesGroups.set(sKey, group);
			} else {
				nonSeriesEvents.push(evt);
			}
		}
		const compressed: FlyerDisplayItem[] = [...nonSeriesEvents];
		for (const [sKey, group] of seriesGroups) {
			group.sort((a, b) => {
				const tA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
				const tB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
				return tA - tB;
			});
			const first = group[0];
			const dateSet = new Set<string>();
			const dates: string[] = [];
			for (const g of group) {
				if (g.startDateTime) {
					const d = new Date(g.startDateTime);
					if (!isNaN(d.getTime())) {
						const dTime = String(d.getTime());
						if (!dateSet.has(dTime)) {
							dateSet.add(dTime);
							dates.push(d.toISOString());
						}
					}
				}
			}
			let rruleStr: string | null = null;
			for (const g of group) {
				if (g.recurrence && Array.isArray(g.recurrence) && g.recurrence[0]) {
					rruleStr = g.recurrence[0];
					break;
				} else if (typeof (g as any).recurrence === 'string' && (g as any).recurrence.length > 0) {
					rruleStr = (g as any).recurrence;
					break;
				} else if ((g as any).seriesMaster?.recurrence?.[0]) {
					rruleStr = (g as any).seriesMaster.recurrence[0];
					break;
				}
			}
			const recText = formatRecurrenceText(rruleStr, { short: true, dtstart: first.startDateTime });
			if (dates.length >= 1) {
				compressed.push({
					...first,
					id: dates.length > 1 ? sKey : first.id || sKey,
					isCompressedSeries: true,
					seriesDates: dates,
					recurrenceText: recText,
					instanceCount: dates.length,
					qrCodePath: `/api/events/${sKey}/qr.png`,
					qrCodeDataUrl: undefined
				});
			} else {
				compressed.push({ ...first, recurrenceText: recText });
			}
		}
		compressed.sort((a, b) => {
			const timeA =
				'startDateTime' in a && a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
			const timeB =
				'startDateTime' in b && b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
			return timeA - timeB;
		});
		return compressed;
	}

	interface DistributedFlyerPanels {
		flapItems: FlyerDisplayItem[];
		backAnnouncements: Announcement[];
		backEvents: FlyerDisplayItem[];
		inside1: FlyerDisplayItem[];
		inside2: FlyerDisplayItem[];
		inside3: FlyerDisplayItem[];
		total: number;
	}

	function distributeItemsForFlyer(
		locationItems: (Event | Announcement)[]
	): DistributedFlyerPanels {
		const announcements = locationItems.filter((i) => !('startDateTime' in i)) as Announcement[];
		const rawEvents = (locationItems.filter((i) => 'startDateTime' in i) as Event[]).sort(
			(a, b) => {
				const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
				const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
				return timeA - timeB;
			}
		);
		const events = compressSeries ? compressSeriesEvents(rawEvents) : rawEvents;

		const flapItems: FlyerDisplayItem[] = [];
		const backAnnouncements: Announcement[] = [...announcements];
		const backEvents: FlyerDisplayItem[] = [];
		const inside1: FlyerDisplayItem[] = [];
		const inside2: FlyerDisplayItem[] = [];
		const inside3: FlyerDisplayItem[] = [];

		if (announcements.length > 0) {
			const perPanel = Math.ceil(events.length / 4);
			flapItems.push(...events.slice(0, perPanel));
			inside1.push(...events.slice(perPanel, perPanel * 2));
			inside2.push(...events.slice(perPanel * 2, perPanel * 3));
			inside3.push(...events.slice(perPanel * 3));
		} else if (events.length > 8) {
			const perPanel = Math.ceil(events.length / 5);
			flapItems.push(...events.slice(0, perPanel));
			backEvents.push(...events.slice(perPanel, perPanel * 2));
			inside1.push(...events.slice(perPanel * 2, perPanel * 3));
			inside2.push(...events.slice(perPanel * 3, perPanel * 4));
			inside3.push(...events.slice(perPanel * 4));
		} else {
			const perPanel = Math.ceil(events.length / 4);
			flapItems.push(...events.slice(0, perPanel));
			inside1.push(...events.slice(perPanel, perPanel * 2));
			inside2.push(...events.slice(perPanel * 2, perPanel * 3));
			inside3.push(...events.slice(perPanel * 3));
		}

		return {
			flapItems,
			backAnnouncements,
			backEvents,
			inside1,
			inside2,
			inside3,
			total: events.length + announcements.length
		};
	}
</script>

<div
	class="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 pb-24 px-2 sm:px-4 lg:px-6 text-slate-800 dark:text-slate-100 print:bg-white print:p-0 print:pb-0 print:m-0 print:min-h-0 print:h-auto print:text-black"
>
	<!-- Toolbar -->
	<header class="max-w-6xl mx-auto mb-6 print:hidden">
		<div
			class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<a
						href={resolve('kiosks')}
						class="p-2 text-slate-500 hover:text-slate-900 rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm font-medium"
						title={m.back_to_kiosks_btn()}
					>
						<ArrowLeft class="w-4 h-4" />
						<span class="hidden sm:inline">{m.back_to_kiosks_btn()}</span>
					</a>
					<div class="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
					<div class="flex items-center gap-2.5">
						<div class="p-1.5 bg-[#f0e7f3] text-[#6950fc] rounded-lg">
							<FoldVertical class="w-5 h-5" />
						</div>
						<div>
							<h1 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
								{m.folded_flyer_hier_template()}
							</h1>
							<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
								{m.flyer_specs_subtitle()}
							</p>
						</div>
					</div>
				</div>

				<button
					type="button"
					onclick={triggerPrint}
					class="inline-flex items-center gap-2 px-4 py-2 text-white font-semibold rounded-xl text-sm shadow-sm hover:opacity-90 transition-all"
					style="background-color: {HIER_PALETTE.primaryDigital};"
				>
					<Printer class="w-4 h-4" />
					<span>
						{activeLocationId === 'all' && flyerLocations.length > 1
							? m.print_all_flyers()
							: m.print_flyer()}
					</span>
				</button>
			</div>

			<div
				class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs"
			>
				{#if flyerLocations.length > 1}
					<div
						class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
					>
						<button
							type="button"
							onclick={() => (activeLocationId = 'all')}
							class="px-2.5 py-1 rounded-lg font-medium {activeLocationId === 'all' ? 'bg-white text-[#6950fc] shadow-xs' : 'text-slate-600'}"
						>
							{m.all_locations_flyers({ count: flyerLocations.length })}
						</button>
						{#each flyerLocations as loc (loc.id)}
							<button
								type="button"
								onclick={() => (activeLocationId = loc.id)}
								class="px-2.5 py-1 rounded-lg font-medium truncate max-w-[140px] {activeLocationId === loc.id ? 'bg-white text-[#6950fc] shadow-xs' : 'text-slate-600'}"
							>
								{loc.name}
							</button>
						{/each}
					</div>
				{/if}

				<div class="flex flex-wrap items-center gap-2">
					<div class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200">
						<button
							type="button"
							onclick={() => (density = 'compact')}
							class="px-2 py-1 rounded-lg font-medium {density === 'compact' ? 'bg-white text-[#6950fc] shadow-xs' : 'text-slate-500'}"
						>
							{m.ai_density_compact()}
						</button>
						<button
							type="button"
							onclick={() => (density = 'standard')}
							class="px-2 py-1 rounded-lg font-medium {density === 'standard' ? 'bg-white text-[#6950fc] shadow-xs' : 'text-slate-500'}"
						>
							{m.ai_density_standard()}
						</button>
						<button
							type="button"
							onclick={() => (density = 'detailed')}
							class="px-2 py-1 rounded-lg font-medium {density === 'detailed' ? 'bg-white text-[#6950fc] shadow-xs' : 'text-slate-500'}"
						>
							{m.ai_density_detailed()}
						</button>
					</div>

					<button
						type="button"
						onclick={handleAiSummarize}
						disabled={isSummarizing || items.length === 0}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6950fc] hover:opacity-90 text-white font-medium rounded-xl shadow-xs disabled:opacity-50"
					>
						<Sparkles class="w-3.5 h-3.5 {isSummarizing ? 'animate-spin' : ''}" />
						<span>{isSummarizing ? m.summarizing_with_ai() : m.summarize_with_ai()}</span>
					</button>

					{#if hasAiSummaries}
						<button
							type="button"
							onclick={resetSummaries}
							class="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
						>
							<RotateCcw class="w-3.5 h-3.5" />
							<span>{m.reset_original_text()}</span>
						</button>
					{/if}

					<label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
						<input type="checkbox" bind:checked={showFoldGuides} class="rounded text-[#6950fc] w-3.5 h-3.5" />
						<span>{m.fold_guides()}</span>
					</label>

					<label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
						<input type="checkbox" bind:checked={showQrCodes} class="rounded text-[#6950fc] w-3.5 h-3.5" />
						<span>{m.show_qr_codes()}</span>
					</label>

					<label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
						<input type="checkbox" bind:checked={showEventQrCodes} class="rounded text-[#6950fc] w-3.5 h-3.5" />
						<QrCode class="w-3.5 h-3.5 text-slate-500" />
						<span>{m.event_qr_codes()}</span>
					</label>

					<label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
						<input type="checkbox" bind:checked={compressSeries} class="rounded text-[#6950fc] w-3.5 h-3.5" />
						<RefreshCw class="w-3.5 h-3.5 text-slate-500" />
						<span>{m.compress_series()}</span>
					</label>

					<label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
						<input type="checkbox" bind:checked={showEndTimes} class="rounded text-[#6950fc] w-3.5 h-3.5" />
						<Clock class="w-3.5 h-3.5 text-slate-500" />
						<span>{m.component_end_times?.() || 'Endzeiten'}</span>
					</label>

					<label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
						<input type="checkbox" bind:checked={showFooters} class="rounded text-[#6950fc] w-3.5 h-3.5" />
						<span>{m.show_footers()}</span>
					</label>

					<select
						bind:value={printOptions.printMode}
						class="text-xs font-semibold rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-6"
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
						class="text-xs font-semibold rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-6"
					>
						{#each [...DEFAULT_HIER_PRESETS, ...customPresets] as p (p.id)}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>

					<button
						type="button"
						onclick={() => (isHierSettingsOpen = true)}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#6950fc]/30 bg-[#f0e7f3] text-[#6950fc] hover:bg-[#fadfed]"
					>
						<Palette class="w-3.5 h-3.5" />
						<span>HIER. CI</span>
					</button>

					<div class="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
						<button
							type="button"
							onclick={() => (zoomLevel = Math.max(0.5, zoomLevel - 0.1))}
							class="p-1 text-slate-500 hover:text-slate-900 rounded"
						>
							<ZoomOut class="w-3.5 h-3.5" />
						</button>
						<span class="px-1.5 text-[10px] font-mono text-slate-600">
							{Math.round(zoomLevel * 100)}%
						</span>
						<button
							type="button"
							onclick={() => (zoomLevel = Math.min(1.2, zoomLevel + 0.1))}
							class="p-1 text-slate-500 hover:text-slate-900 rounded"
						>
							<ZoomIn class="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- FLYER PRINT CANVAS -->
	<main
		class="max-w-6xl mx-auto flex flex-col items-center gap-10 print:m-0 print:p-0 print:gap-0 print:max-w-none print:w-auto {printOptions.printMode === 'all_greyscale' ? 'monochrome-mode' : ''} {printOptions.printMode === 'omit_ci' ? 'print-omit-ci' : ''} {printOptions.printMode === 'greyscale_content' ? 'print-greyscale-content' : ''} {printOptions.printMode === 'ci_only' ? 'print-ci-only' : ''} {printOptions.hideFoldGuidesInPrint ? 'print-hide-fold-guides' : ''} {printOptions.hideQrInPrint ? 'print-hide-qr' : ''}"
	>
		{#each displayedLocations as loc, locIdx (loc.id)}
			{@const locItems = items.filter((it) => itemBelongsToLocation(it, loc.id))}
			{@const {
				flapItems,
				backAnnouncements,
				backEvents,
				inside1,
				inside2,
				inside3,
				total: totalItems
			} = distributeItemsForFlyer(locItems)}

			<div class="flyer-document-pair w-full flex flex-col items-center gap-8 print:gap-0 print:m-0">
				{#if displayedLocations.length > 1}
					<div class="print:hidden w-full max-w-[297mm] flex items-center justify-between px-2 pt-2 border-t border-slate-300">
						<div class="flex items-center gap-2">
							<span class="bg-[#6950fc] text-white text-xs font-bold px-2 py-0.5 rounded-full">
								{m.flyer_number({ number: locIdx + 1 })}
							</span>
							<h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{loc.name}</h2>
						</div>
						<span class="text-xs text-slate-500 font-medium">
							{m.entry_count({ count: totalItems })}
						</span>
					</div>
				{/if}

				<!-- SHEET 1: OUTSIDE -->
				<div class="flyer-wrapper w-full flex justify-center overflow-x-auto print:overflow-visible">
					<div
						class="hier-ci-scope kiosk-typography-scope {docFontFamily && docFontFamily !== 'default' ? 'kiosk-has-custom-font' : ''} flyer-sheet side-outside bg-white text-[#222222] shadow-xl print:shadow-none relative"
						style="--zoom: {zoomLevel}; transform-origin: top center; {getDocumentTypographyStyle(docFontFamily, docFontScale)}"
					>
						{#if showFoldGuides && elementSettings.foldGuides.enabled}
							<div
								class="fold-line fold-line-1 {getElementPrintClasses(elementSettings.foldGuides, printOptions.previewGreyscaleOnScreen)}"
							>
								<span class="fold-indicator">{m.fold_here()}</span>
							</div>
							<div
								class="fold-line fold-line-2 {getElementPrintClasses(elementSettings.foldGuides, printOptions.previewGreyscaleOnScreen)}"
							>
								<span class="fold-indicator">{m.fold_here()}</span>
							</div>
						{/if}

						<div class="sheet-grid">
							<!-- PANEL 5: INSIDE FLAP -->
							<section class="panel panel-flap border-r border-[#edeff4]">
								<div
									class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden"
								>
									<div class="space-y-2 overflow-hidden">
										<div class="border-b-2 border-[#6950fc] pb-1.5 flex items-center justify-between">
											<div class="flex items-center gap-1.5">
												<Calendar class="w-3.5 h-3.5 text-[#6950fc]" />
												<h3 class="text-xs font-black uppercase tracking-wider text-[#29235c]">
													{m.events_overview()}
												</h3>
											</div>
											<span class="text-[9px] font-bold text-[#6950fc] uppercase tracking-widest">
												{m.flyer_inside_flap()}
											</span>
										</div>

										{#if loc.description && flapItems.length <= 3}
											<div
												class="rich-description text-[10px] text-[#222222] leading-snug p-1.5 rounded border border-[#6950fc]/15 line-clamp-2"
												style="background-color: {HIER_PALETTE.mutedLavender};"
											>
												{@html loc.description}
											</div>
										{/if}

										<div class="space-y-1.5 overflow-hidden">
											{#each flapItems as item (item.id)}
												{@render itemCard(item)}
											{/each}
											{#if flapItems.length === 0}
												<p class="text-xs text-slate-400 italic pt-4 text-center">
													{m.no_events_for_location()}
												</p>
											{/if}
										</div>
									</div>

									{#if showFooters}
										<div class="pt-2 border-t border-[#edeff4] text-[9px] text-slate-500 flex items-center justify-between shrink-0">
											<span>{getDateRangeTitle()}</span>
											<span class="font-mono text-slate-400">{m.flyer_inside_flap()}</span>
										</div>
									{/if}
								</div>
							</section>

							<!-- PANEL 6: BACK COVER -->
							<section class="panel panel-back border-r border-[#edeff4]">
								<div
									class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden"
								>
									<div class="space-y-2 overflow-hidden">
										<div
											class="border-b-2 pb-1.5 flex items-center justify-between"
											style="border-color: {backAnnouncements.length > 0 ? HIER_PALETTE.pink : HIER_PALETTE.primaryDigital};"
										>
											<div class="flex items-center gap-1.5">
												{#if backAnnouncements.length > 0}
													<Sparkles class="w-3.5 h-3.5 text-[#da5096]" />
													<h3 class="text-xs font-black uppercase tracking-wider text-[#29235c]">
														{m.feature_announcements_title()}
													</h3>
												{:else}
													<Calendar class="w-3.5 h-3.5 text-[#6950fc]" />
													<h3 class="text-xs font-black uppercase tracking-wider text-[#29235c]">
														{m.events_overview()}
													</h3>
												{/if}
											</div>
											<span class="text-[9px] font-bold text-[#6950fc] uppercase tracking-widest">
												{m.flyer_back_cover()}
											</span>
										</div>

										{#if backAnnouncements.length > 0}
											<div class="space-y-1.5 overflow-hidden">
												{#each backAnnouncements as ann (ann.id)}
													{@render itemCard(ann)}
												{/each}
											</div>
										{/if}

										{#if backEvents.length > 0}
											<div class="space-y-1.5 overflow-hidden">
												{#each backEvents as item (item.id)}
													{@render itemCard(item)}
												{/each}
											</div>
										{/if}

										{#if backAnnouncements.length === 0 && backEvents.length === 0}
											<div
												class="relative p-3 rounded-xl border border-[#6950fc]/20 text-xs text-[#222222] space-y-1.5 overflow-hidden"
												style="background-color: {HIER_PALETTE.mutedLavender};"
											>
												<div class="pointer-events-none absolute -right-3 -bottom-3 opacity-25">
													<HierRays class="w-16 h-16" />
												</div>
												<div class="font-extrabold uppercase text-[#6950fc]">
													{m.flyer_welcome_title()}
												</div>
												<p class="leading-relaxed text-[11px] relative z-10">
													{m.welcome_description()}
												</p>
											</div>
										{/if}
									</div>

									{#if showFooters}
										<div class="pt-2 border-t border-[#edeff4] text-[9px] text-slate-500 flex items-center justify-between shrink-0">
											<span>{kiosk.name || 'HIER. in Marzahn-Süd'}</span>
											<span class="font-mono text-slate-400">{m.flyer_back_cover()}</span>
										</div>
									{/if}
								</div>
							</section>

							<!-- PANEL 1: FRONT COVER (TITELSEITE) -->
							<section
								class="panel panel-front relative bg-white text-[#222222] overflow-hidden flex flex-col justify-between {printOptions.printMode === 'omit_ci' ? 'print-omit-ci' : ''}"
							>
								<div
									class="ci-area shrink-0 {getElementPrintClasses(elementSettings.ciTop, printOptions.previewGreyscaleOnScreen)} {printOptions.printMode === 'omit_ci' ? 'print:invisible' : ''}"
								>
									<HierHeaderBand
										preset={ciPreset}
										printMode={printOptions.printMode}
										locationName={loc.name}
										customLocationLogo={ciPreset.locationLogoUrl || loc.heroImage}
										customOrgLogo={ciPreset.orgLogoUrl}
										heightMm={32}
										variant="flyer"
										selectedCardId={selectedCardId}
										cardSettings={cardSettings}
										elementSettings={elementSettings}
										previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
										onSelect={(id) => {
											selectedCardId = selectedCardId === id ? null : id;
										}}
									/>
								</div>

								<div
									class="ci-content-body p-3 flex-1 flex flex-col justify-between relative z-10 space-y-2 overflow-hidden {printOptions.previewGreyscaleOnScreen ? 'card-greyscale' : ''} {printOptions.printMode === 'ci_only' ? 'print:invisible' : ''} {printOptions.printMode === 'greyscale_content' ? 'print:card-greyscale' : ''}"
								>
									<div class="space-y-2 overflow-hidden">
										<div class="space-y-1.5 {getElementPrintClasses(elementSettings.header, printOptions.previewGreyscaleOnScreen)}">
											<div
												class="hier-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
												style="border-color: {HIER_PALETTE.primaryDigital}; color: {HIER_PALETTE.primaryDigital}; background-color: {HIER_PALETTE.mutedLavender};"
											>
												<Calendar class="w-3 h-3" />
												<span>{getDateRangeTitle()}</span>
											</div>

											<h2 class="text-base font-black uppercase tracking-tight text-[#29235c] leading-tight">
												{loc.name}
											</h2>

											<p class="text-[10.5px] text-[#6950fc] font-bold leading-tight">
												{kiosk.name || m.program_and_schedule()}
											</p>
										</div>

										<div
											class="space-y-1 text-[10.5px] text-[#222222] p-2 rounded-lg border border-[#6950fc]/15 {getElementPrintClasses(elementSettings.locationDetails, printOptions.previewGreyscaleOnScreen)}"
											style="background-color: {HIER_PALETTE.mutedCream};"
										>
											{#if loc.street || loc.houseNumber}
												<div class="flex items-start gap-1.5">
													<MapPin class="w-3 h-3 text-[#6950fc] shrink-0 mt-0.5" />
													<span>
														{loc.street || ''} {loc.houseNumber || ''}{loc.addressSuffix ? ` ${loc.addressSuffix}` : ''}
													</span>
												</div>
											{/if}
											{#if loc.zip || loc.city}
												<div class="pl-4 text-[10px] text-[#222222]/70">
													{loc.zip || ''} {loc.city || ''}
												</div>
											{/if}
											{#if loc.openingHours}
												<div
													class="flex items-start gap-1.5 pt-1 border-t border-[#edeff4] {getElementPrintClasses(elementSettings.openingHours, printOptions.previewGreyscaleOnScreen)}"
												>
													<Clock class="w-3 h-3 text-[#6950fc] shrink-0 mt-0.5" />
													<div class="text-[10px] text-[#222222]/85">
														<span class="font-bold text-[#29235c] block text-[9.5px] uppercase">
															{m.opening_hours?.() ?? 'Öffnungszeiten'}:
														</span>
														<span class="whitespace-pre-line leading-tight">
															{formatOpeningHours(loc.openingHours)}
														</span>
													</div>
												</div>
											{/if}
										</div>

										{#if loc.contact}
											<div
												class="p-2 rounded-lg border border-[#6950fc]/15 text-[10px] text-[#222222] space-y-1"
												style="background-color: {HIER_PALETTE.mutedLavender};"
											>
												<div class="font-bold text-[#29235c] flex items-center gap-1.5 flex-wrap">
													<User class="w-3 h-3 text-[#6950fc]" />
													<span>{loc.contact.name}</span>
												</div>
												{#if loc.contact.phone}
													<div class="flex items-center gap-1 text-[#222222]/85">
														<Phone class="w-2.5 h-2.5 text-[#6950fc]" />
														<span>{loc.contact.phone}</span>
													</div>
												{/if}
												{#if loc.contact.email}
													<div class="flex items-center gap-1 text-[#222222]/85">
														<Mail class="w-2.5 h-2.5 text-[#6950fc]" />
														<span class="truncate">{loc.contact.email}</span>
													</div>
												{/if}
											</div>
										{/if}

										{#if loc.inclusivitySupport}
											<div
												class="text-[9px] text-[#29235c] font-semibold flex items-start gap-1 p-1.5 rounded border border-[#40b28f]/35"
												style="background-color: {HIER_PALETTE.mutedMint};"
											>
												<CheckCircle2 class="w-3 h-3 text-[#40b28f] shrink-0 mt-0.5" />
												<span class="line-clamp-2">{loc.inclusivitySupport}</span>
											</div>
										{/if}
									</div>

									<div
										class="pt-2 border-t border-[#edeff4] flex items-center justify-between gap-2 shrink-0 {getElementPrintClasses(elementSettings.qrCodes, printOptions.previewGreyscaleOnScreen)}"
									>
										<div>
											<div class="text-[10px] font-bold text-[#29235c] tracking-wide uppercase">
												{m.event_calendar()}
											</div>
											<div class="text-[8px] text-[#222222]/70 leading-tight">
												{m.scan_flyer_schedule_qr()}
											</div>
										</div>
										{#if showQrCodes && elementSettings.qrCodes.enabled}
											<div class="bg-white p-1 rounded-md shrink-0 border border-[#6950fc]/20">
												{#if loc.contact?.qrCodeDataUrl}
													<img
														src={loc.contact.qrCodeDataUrl}
														alt="Calendar QR"
														class="w-10 h-10 object-contain image-pixelated"
													/>
												{:else if (locItems[0] as any)?.qrCodeDataUrl}
													<img
														src={(locItems[0] as any).qrCodeDataUrl}
														alt="Calendar QR"
														class="w-10 h-10 object-contain image-pixelated"
													/>
												{:else}
													<div class="w-10 h-10 bg-slate-100 flex items-center justify-center text-[8px] font-bold">
														QR
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</div>

								<div
									class="ci-area shrink-0 {getElementPrintClasses(elementSettings.ciBottom, printOptions.previewGreyscaleOnScreen)} {printOptions.printMode === 'omit_ci' ? 'print:invisible' : ''}"
								>
									<HierFooterBand
										preset={ciPreset}
										printMode={printOptions.printMode}
										locationName={loc.name}
										street={loc.street}
										houseNumber={loc.houseNumber}
										zip={loc.zip}
										city={loc.city}
										phone={loc.contact?.phone}
										inclusivityText={loc.inclusivitySupport}
										sponsors={ciPreset.sponsors || []}
										partnerLogoUrl={ciPreset.partnerLogoUrl}
										heightMm={28}
										variant="flyer"
										selectedCardId={selectedCardId}
										cardSettings={cardSettings}
										elementSettings={elementSettings}
										previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
										onSelect={(id) => {
											selectedCardId = selectedCardId === id ? null : id;
										}}
									/>
								</div>
							</section>
						</div>
					</div>
				</div>

				<!-- SHEET 2: INSIDE SPREAD -->
				<div class="flyer-wrapper w-full flex justify-center overflow-x-auto print:overflow-visible">
					<div
						class="hier-ci-scope kiosk-typography-scope {docFontFamily && docFontFamily !== 'default' ? 'kiosk-has-custom-font' : ''} flyer-sheet side-inside bg-white text-[#222222] shadow-xl print:shadow-none relative"
						style="--zoom: {zoomLevel}; transform-origin: top center; {getDocumentTypographyStyle(docFontFamily, docFontScale)}"
					>
						{#if showFoldGuides && elementSettings.foldGuides.enabled}
							<div
								class="fold-line fold-line-1 {getElementPrintClasses(elementSettings.foldGuides, printOptions.previewGreyscaleOnScreen)}"
							>
								<span class="fold-indicator">{m.fold_here()}</span>
							</div>
							<div
								class="fold-line fold-line-2 {getElementPrintClasses(elementSettings.foldGuides, printOptions.previewGreyscaleOnScreen)}"
							>
								<span class="fold-indicator">{m.fold_here()}</span>
							</div>
						{/if}

						<div class="sheet-grid">
							<section class="panel panel-inside-1 border-r border-[#edeff4]">
								<div
									class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden"
								>
									<div class="space-y-2 overflow-hidden">
										<div class="flex items-center justify-between border-b-2 border-[#da5096] pb-1.5">
											<div class="flex items-center gap-1.5">
												<Calendar class="w-3.5 h-3.5 text-[#da5096]" />
												<h3 class="text-xs font-black uppercase tracking-wider text-[#29235c]">
													{m.events_overview()}
												</h3>
											</div>
											<span class="text-[10px] font-bold text-[#6950fc] truncate max-w-[120px]">
												{loc.name}
											</span>
										</div>
										<div class="space-y-1.5 overflow-hidden">
											{#each inside1 as item (item.id)}
												{@render itemCard(item)}
											{/each}
										</div>
									</div>
									{#if showFooters}
										<div class="text-[9px] font-mono text-slate-400 text-right pt-2 border-t border-[#edeff4] shrink-0">
											{m.flyer_panel_1()}
										</div>
									{/if}
								</div>
							</section>

							<section class="panel panel-inside-2 border-r border-[#edeff4]">
								<div
									class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden"
								>
									<div class="space-y-2 overflow-hidden">
										<div class="flex items-center justify-between border-b-2 border-[#fcc505] pb-1.5">
											<div class="flex items-center gap-1.5">
												<Calendar class="w-3.5 h-3.5 text-[#6950fc]" />
												<h3 class="text-xs font-black uppercase tracking-wider text-[#29235c]">
													{m.events_overview()}
												</h3>
											</div>
											<span class="text-[10px] font-bold text-[#29235c]">
												{getDateRangeTitle()}
											</span>
										</div>
										<div class="space-y-1.5 overflow-hidden">
											{#each inside2 as item (item.id)}
												{@render itemCard(item)}
											{/each}
										</div>
									</div>
									{#if showFooters}
										<div class="text-[9px] font-mono text-slate-400 text-right pt-2 border-t border-[#edeff4] shrink-0">
											{m.flyer_panel_2()}
										</div>
									{/if}
								</div>
							</section>

							<section class="panel panel-inside-3">
								<div
									class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden"
								>
									<div class="space-y-2 overflow-hidden">
										<div class="flex items-center justify-between border-b-2 border-[#40b28f] pb-1.5">
											<div class="flex items-center gap-1.5">
												<Calendar class="w-3.5 h-3.5 text-[#40b28f]" />
												<h3 class="text-xs font-black uppercase tracking-wider text-[#29235c]">
													{m.events_overview()}
												</h3>
											</div>
											<span class="text-[10px] font-bold text-[#40b28f]">
												{m.entry_count({ count: totalItems })}
											</span>
										</div>
										<div class="space-y-1.5 overflow-hidden">
											{#each inside3 as item (item.id)}
												{@render itemCard(item)}
											{/each}
										</div>
									</div>
									{#if showFooters}
										<div class="text-[9px] font-mono text-slate-400 text-right pt-2 border-t border-[#edeff4] shrink-0">
											{m.flyer_panel_3()}
										</div>
									{/if}
								</div>
							</section>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</main>

	<HierSettingsModal
		bind:open={isHierSettingsOpen}
		bind:preset={ciPreset}
		bind:printOptions={printOptions}
		bind:elementSettings={elementSettings}
		bind:customPresets={customPresets}
		isFlyer={true}
		onSavePreset={handleSaveCustomPreset}
		onDeletePreset={handleDeleteCustomPreset}
	/>

	<CardLayoutActionBar
		{selectedItem}
		kioskId={kiosk?.id || 'default'}
		scopeLabel="HIER. Flyer"
		{docFontFamily}
		{docFontScale}
		onDocFontFamilyChange={(fontFamily) => {
			docFontFamily = fontFamily;
			saveCiPrefs();
		}}
		onDocFontScaleChange={(fontScale) => {
			docFontScale = fontScale;
			saveCiPrefs();
		}}
		itemFontFamily={selectedItem ? (cardSettings[selectedItem.id]?.fontFamily ?? '') : ''}
		itemFontScale={selectedItem ? (cardSettings[selectedItem.id]?.fontScale ?? 1) : 1}
		onItemFontFamilyChange={(fontFamily) => {
			if (!selectedItem) return;
			cardSettings[selectedItem.id] = {
				...cardSettings[selectedItem.id],
				fontFamily: fontFamily || undefined
			};
			saveCiPrefs();
		}}
		onItemFontScaleChange={(fontScale) => {
			if (!selectedItem) return;
			cardSettings[selectedItem.id] = {
				...cardSettings[selectedItem.id],
				fontScale
			};
			saveCiPrefs();
		}}
		currentPercentage={selectedItem ? itemPercentages[selectedItem.id] : undefined}
		currentBehavior={selectedItem
			? (cardSettings[selectedItem.id]?.printBehavior ?? elementSettings.events.printBehavior)
			: 'print'}
		currentColor={selectedItem
			? (cardSettings[selectedItem.id]?.printColor ?? elementSettings.events.printColor)
			: 'color'}
		hideSeriesDates={selectedItem ? Boolean(cardSettings[selectedItem.id]?.hideSeriesDates) : false}
		hideEndTime={selectedItem
			? (cardSettings[selectedItem.id]?.hideEndTime ?? !showEndTimes)
			: false}
		onPercentageChange={(percentage, text) => {
			if (!selectedItem) return;
			itemPercentages[selectedItem.id] = percentage;
			aiSummaries = {
				...aiSummaries,
				[selectedItem.id]: {
					id: selectedItem.id,
					title: selectedItem.title,
					summary: text
				}
			};
			saveSummariesToCache(aiSummaries);
			saveCiPrefs();
		}}
		onBehaviorChange={(behavior) => {
			if (!selectedItem) return;
			cardSettings[selectedItem.id] = {
				...cardSettings[selectedItem.id],
				printBehavior: behavior
			};
			saveCiPrefs();
		}}
		onColorChange={(color) => {
			if (!selectedItem) return;
			cardSettings[selectedItem.id] = {
				...cardSettings[selectedItem.id],
				printColor: color
			};
			saveCiPrefs();
		}}
		onToggleSeriesDates={(hide) => {
			if (!selectedItem) return;
			cardSettings[selectedItem.id] = {
				...cardSettings[selectedItem.id],
				hideSeriesDates: hide
			};
			saveCiPrefs();
		}}
		onToggleEndTime={(hide) => {
			if (!selectedItem) return;
			cardSettings[selectedItem.id] = {
				...cardSettings[selectedItem.id],
				hideEndTime: hide
			};
			saveCiPrefs();
		}}
		onClose={() => {
			selectedCardId = null;
		}}
	/>
</div>

{#snippet itemCard(item: FlyerDisplayItem)}
	{@const isEvent = 'startDateTime' in item}
	{@const isSpecialNonSeries = isNonSeriesEvent(item)}
	{@const title = getItemTitle(item)}
	{@const summary = getItemSummary(item)}
	{@const rawDesc = isEvent ? (item as Event).description : (item as Announcement).content}
	{@const rooms = isEvent ? getEventRooms(item as Event) : []}
	{@const eventQr = isEvent
		? (item as any).qrCodeDataUrl || (item as any).qrCodePath || `/api/events/${item.id}/qr.png`
		: null}
	{@const displayPrice = isEvent
		? formatTicketPrice((item as Event).ticketPrice, (item as Event).ticketPriceUnknown, {
				currency: (item as any).currency || 'EUR'
			})
		: null}

	<div
		role="button"
		tabindex="0"
		class="hier-card-accent kiosk-item-typography {cardSettings[item.id]?.fontFamily ? 'kiosk-has-custom-font' : ''} event-item-card p-2 rounded-lg transition-colors cursor-pointer space-y-1 print:break-inside-avoid {selectedCardId === item.id ? 'bg-amber-100/90 ring-2 ring-amber-400 print:bg-white print:ring-0' : isSpecialNonSeries ? 'border border-[#fcc505] bg-[#fffcf7] border-l-4 border-l-[#fcc505]' : 'border border-[#edeff4] bg-white hover:border-[#6950fc]/40'} {getCardPrintClasses(cardSettings[item.id], elementSettings.events, printOptions.previewGreyscaleOnScreen)}"
		style={getItemTypographyStyle(
			cardSettings[item.id]?.fontFamily,
			cardSettings[item.id]?.fontScale
		)}
		onclick={() => {
			selectedCardId = selectedCardId === item.id ? null : item.id;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				selectedCardId = selectedCardId === item.id ? null : item.id;
			}
		}}
	>
		{#if isEvent && item.isCompressedSeries && item.seriesDates && item.seriesDates.length >= 1}
			<div class="space-y-1">
				<div class="flex items-center justify-between gap-1.5 flex-wrap">
					<div class="flex items-center gap-1.5 flex-wrap">
						<span class="hier-badge text-[9px] font-bold bg-[#f0e7f3] text-[#6950fc] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
							<RefreshCw class="w-2.5 h-2.5" />
							<span>{item.recurrenceText || m.series_badge()}</span>
						</span>
						<div class="text-[9.5px] text-[#29235c] font-semibold flex items-center gap-0.5">
							<Clock class="w-2.5 h-2.5 text-[#6950fc]" />
							<span>
								{formatTimeRange(
									(item as Event).startDateTime,
									(item as Event).endDateTime,
									(item as Event).isAllDay,
									cardSettings[item.id]?.hideEndTime !== undefined
										? !cardSettings[item.id]!.hideEndTime
										: showEndTimes
								)}
							</span>
						</div>
						{#if displayPrice}
							<span class="text-[8.5px] font-bold bg-[#e3f0ea] text-[#29235c] px-1.5 py-0.5 rounded">
								{displayPrice}
							</span>
						{/if}
					</div>
					{#if rooms.length > 0}
						<span class="text-[8.5px] font-medium bg-[#edeff4] text-[#29235c] px-1.5 py-0.5 rounded truncate max-w-[80px]">
							{rooms[0]}
						</span>
					{/if}
				</div>
				{#if !cardSettings[item.id]?.hideSeriesDates}
					<div class="flex items-center gap-1 flex-wrap pt-0.5">
						{#each item.seriesDates as dateStr, dIdx (`${item.id}_${dateStr}_${dIdx}`)}
							<span class="hier-badge bg-[#29235c] text-white px-1.5 py-0.5 rounded text-[8.5px] font-bold">
								{formatDay(dateStr)} {formatMonth(dateStr)}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center justify-between gap-1.5">
				{#if isEvent}
					{@const multiDay = isMultiDayEvent(item as Event)}
					{@const durationDays = multiDay ? getEventDurationDays(item as Event) : 1}
					{@const dateParts = getEventDateParts(item as Event)}
					<div class="flex items-center gap-1.5 flex-wrap">
						{#if multiDay}
							<div class="hier-badge bg-[#29235c] text-white px-1.5 py-0.5 rounded text-[9.5px] font-bold">
								{dateParts.startDay}–{dateParts.endDay} {dateParts.endMonth} ({m.days_count({ count: durationDays })})
							</div>
						{:else}
							<div
								class="hier-badge {isSpecialNonSeries ? 'bg-[#fcc505] text-[#222222] font-black' : 'bg-[#29235c] text-white font-bold'} px-1.5 py-0.5 rounded text-[9.5px]"
							>
								{formatDay((item as Event).startDateTime)} {formatMonth((item as Event).startDateTime)}
							</div>
						{/if}
						<div class="text-[9.5px] text-[#29235c] font-semibold flex items-center gap-0.5">
							<Clock class="w-2.5 h-2.5 text-[#6950fc]" />
							<span>
								{formatTimeRange(
									(item as Event).startDateTime,
									(item as Event).endDateTime,
									(item as Event).isAllDay,
									cardSettings[item.id]?.hideEndTime !== undefined
										? !cardSettings[item.id]!.hideEndTime
										: showEndTimes
								)}
							</span>
						</div>
						{#if displayPrice}
							<span class="text-[8.5px] font-bold bg-[#e3f0ea] text-[#29235c] px-1.5 py-0.5 rounded">
								{displayPrice}
							</span>
						{/if}
					</div>
				{:else}
					<div class="bg-[#da5096] text-white px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase">
						{m.news_badge()}
					</div>
				{/if}

				{#if rooms.length > 0}
					<span class="text-[8.5px] font-medium bg-[#edeff4] text-[#29235c] px-1.5 py-0.5 rounded truncate max-w-[80px]">
						{rooms[0]}
					</span>
				{/if}
			</div>
		{/if}

		<div class="flex items-start justify-between gap-1.5">
			<div class="flex-1 min-w-0 space-y-0.5">
				<h4 class="text-[11.5px] font-bold text-[#29235c] leading-tight">{title}</h4>
				{#if showDescriptions && (rawDesc || summary)}
					{@const compactSignUp = getKioskSignUpText(item as any, {
						showQrCode: Boolean(showEventQrCodes && eventQr && elementSettings.qrCodes.enabled)
					})}
					<div
						class="text-[10px] text-[#222222]/85 leading-snug {itemPercentages[item.id] === undefined ? (density === 'compact' ? 'line-clamp-3' : density === 'standard' ? 'line-clamp-5' : 'line-clamp-10') : ''}"
					>
						{#if compactSignUp}
							<span class="font-bold text-[#da5096] mr-1">{compactSignUp}.</span>
						{/if}
						<span
							class="rich-description [&>p:first-child]:inline [&>p]:mb-0 outline-hidden focus:bg-amber-50 rounded cursor-text"
							contenteditable="true"
							onblur={(e) => handleInlineEdit(item.id, title, summary, e)}
							title={m.edit_summary_tooltip()}
						>
							{@html itemPercentages[item.id] === 100 ? (rawDesc || '') : summary}
						</span>
					</div>
				{/if}
				{#if item.tags && item.tags.length > 0}
					<div class="flex items-center gap-1 flex-wrap pt-0.5">
						{#each (item.tags ?? []).slice(0, 3) as tag, tIdx (typeof tag === 'string' ? `${tag}_${tIdx}` : tag.id || tag.name || tIdx)}
							<span class="text-[8px] font-medium bg-[#edeff4] text-[#29235c] px-1.5 py-0.5 rounded">
								#{typeof tag === 'string' ? tag : tag.name}
							</span>
						{/each}
					</div>
				{/if}
			</div>

			{#if showEventQrCodes && eventQr && elementSettings.qrCodes.enabled}
				<div
					class="shrink-0 flex flex-col items-center pt-0.5 {getElementPrintClasses(elementSettings.qrCodes, printOptions.previewGreyscaleOnScreen)}"
				>
					<div class="p-0.5 bg-white border border-[#6950fc]/20 rounded">
						<img
							src={eventQr}
							alt="Event QR"
							class="w-14 h-14 print:w-12 print:h-12 object-contain image-pixelated"
							loading="lazy"
						/>
					</div>
					<span class="text-[7.5px] text-[#6950fc] font-bold tracking-tight mt-0.5 print:hidden">
						{m.scan_info()}
					</span>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<style>
	.flyer-sheet {
		width: 297mm;
		height: 210mm;
		max-width: 297mm;
		max-height: 210mm;
		box-sizing: border-box;
		overflow: hidden;
		border-radius: 4px;
		transform: scale(var(--zoom, 1));
		margin-bottom: calc((1 - var(--zoom, 1)) * -100mm);
	}

	.sheet-grid {
		display: grid;
		grid-template-columns: 99mm 99mm 99mm;
		height: 210mm;
		max-height: 210mm;
		width: 297mm;
		box-sizing: border-box;
		overflow: hidden;
	}

	.panel {
		width: 99mm;
		height: 210mm;
		max-height: 210mm;
		box-sizing: border-box;
		overflow: hidden;
	}

	.image-pixelated {
		image-rendering: -webkit-optimize-contrast;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
	}

	.panel-inner {
		height: 210mm;
		max-height: 210mm;
		box-sizing: border-box;
		overflow: hidden;
	}

	.rich-description :global(p) {
		margin-top: 0;
		margin-bottom: 0.15rem;
		display: inline;
	}

	.fold-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		border-left: 1px dashed rgba(105, 80, 252, 0.35);
		pointer-events: none;
		z-index: 30;
	}
	.fold-line-1 {
		left: 99mm;
	}
	.fold-line-2 {
		left: 198mm;
	}
	.fold-indicator {
		position: absolute;
		top: 4px;
		left: 4px;
		font-size: 8px;
		font-family: ui-monospace, monospace;
		color: rgba(105, 80, 252, 0.7);
		text-transform: uppercase;
	}

	@media print {
		@page {
			size: 297mm 210mm;
			margin: 0;
		}
		:global(html),
		:global(body) {
			margin: 0 !important;
			padding: 0 !important;
			width: 297mm !important;
			height: auto !important;
			min-height: 100% !important;
			background: #ffffff !important;
			color: #000000 !important;
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
		}
		.flyer-document-pair,
		.flyer-wrapper {
			margin: 0 !important;
			padding: 0 !important;
			gap: 0 !important;
		}
		.flyer-wrapper {
			overflow: hidden !important;
			width: 297mm !important;
			height: 209.5mm !important;
			max-height: 209.5mm !important;
			page-break-inside: avoid !important;
			break-inside: avoid !important;
		}
		.flyer-sheet {
			width: 297mm !important;
			height: 209.5mm !important;
			max-width: 297mm !important;
			max-height: 209.5mm !important;
			margin: 0 !important;
			padding: 0 !important;
			transform: none !important;
			overflow: hidden !important;
			page-break-after: always !important;
			break-after: page !important;
			page-break-inside: avoid !important;
			break-inside: avoid !important;
			border: none !important;
			border-radius: 0 !important;
			box-shadow: none !important;
		}
		.flyer-document-pair:last-child .flyer-wrapper:last-child .flyer-sheet {
			page-break-after: auto !important;
			break-after: auto !important;
		}
		.sheet-grid {
			width: 297mm !important;
			height: 209.5mm !important;
			max-height: 209.5mm !important;
			grid-template-columns: 99mm 99mm 99mm !important;
		}
		.panel,
		.panel-inner {
			height: 209.5mm !important;
			max-height: 209.5mm !important;
		}
		.fold-indicator {
			display: none !important;
		}
		.event-item-card {
			page-break-inside: avoid !important;
			break-inside: avoid !important;
		}
		.print-omit-ci .ci-area,
		.print-omit-ci :global(.ci-top-triangle-container),
		.print-omit-ci :global(.ci-bottom-triangle-container) {
			visibility: hidden !important;
		}
		.print-ci-only .ci-content-body,
		.print-ci-only .side-inside,
		.print-ci-only .panel-flap,
		.print-ci-only .panel-back {
			visibility: hidden !important;
		}
		.print-hide-fold-guides .fold-line {
			display: none !important;
		}
		.print-hide-qr :global(img[alt*='QR']),
		.print-hide-qr :global(.image-pixelated) {
			display: none !important;
		}
	}
</style>
