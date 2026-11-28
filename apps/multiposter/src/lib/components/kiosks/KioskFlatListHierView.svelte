<script lang="ts">
	import { onMount } from 'svelte';
	import {
		type Event,
		type Announcement,
		formatOpeningHours,
		type OpeningHoursData
	} from '@ac/validations';
	import {
		Printer,
		Calendar,
		MapPin,
		RefreshCw,
		Megaphone,
		FileText,
		ArrowLeft,
		Clock,
		User,
		Users,
		UserCheck,
		Phone,
		Mail,
		Ticket,
		Globe,
		Lock,
		Tag,
		QrCode,
		SlidersHorizontal,
		ChevronDown,
		Check,
		CalendarDays,
		Layers,
		FileImage,
		Palette
	} from '@lucide/svelte';
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
	import { page } from '$app/state';
	import { authClient } from '#lib/auth.js';
	import { resolve } from '$app/paths';
	import { browser } from '$app/env';
	import { toast } from 'svelte-sonner';
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
		getDayKey,
		getMonthKey,
		getWeekInfo,
		compressSeriesEvents,
		formatDateDay,
		formatDateMonth,
		formatDateWeekday,
		formatTime,
		formatTimeRange,
		formatFullDate
	} from '#lib/utils/kiosk-flat-helpers.js';
	import CardLayoutActionBar from './CardLayoutActionBar.svelte';
	import {
		DEFAULT_ELEMENT_SETTINGS,
		getCardPrintClasses,
		getElementPrintClasses,
		getDocumentTypographyStyle,
		getItemTypographyStyle,
		type CardPrintConfig,
		type CiPrintOptions,
		type KioskElementSettings
	} from './ci/types.js';
	import HierHeaderBand from './hier/HierHeaderBand.svelte';
	import HierFooterBand from './hier/HierFooterBand.svelte';
	import HierSettingsModal from './hier/HierSettingsModal.svelte';
	import {
		DEFAULT_HIER_PRESETS,
		DEFAULT_HIER_PRINT_OPTIONS,
		HIER_PALETTE,
		type HierCiPreset
	} from './hier/types.js';

	const session = authClient.useSession();
	const isLoggedIn = $derived(Boolean(page.data?.user || $session.data?.user));

	interface LocationInfo {
		id: string;
		name: string;
		street: string | null;
		houseNumber: string | null;
		zip: string | null;
		city: string | null;
		country: string | null;
		heroImage?: string | null;
		openingHours?: OpeningHoursData | string | null;
		inclusivitySupport?: string | null;
		contact: {
			name: string;
			email?: string;
			phone?: string;
			qrCodePath?: string;
			qrCodeDataUrl?: string;
		} | null;
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
			startDate?: string | Date;
			endDate?: string | Date;
		};
	} = $props();

	let compressSeries = $state(true);
	let density = $state<'standard' | 'compact'>('standard');
	let activeFilter = $state<'all' | 'events' | 'news'>('all');
	let isComponentsMenuOpen = $state(false);
	let isGroupingMenuOpen = $state(false);
	let grouping = $state({ months: true, weeks: false, days: false });
	let visibleComponents = $state<VisibleComponentsState>({ ...defaultVisibleComponents });

	let ciPreset = $state<HierCiPreset>({ ...DEFAULT_HIER_PRESETS[0] });
	let customPresets = $state<HierCiPreset[]>([]);
	let printOptions = $state<CiPrintOptions>({ ...DEFAULT_HIER_PRINT_OPTIONS });
	let elementSettings = $state<KioskElementSettings>({ ...DEFAULT_ELEMENT_SETTINGS });
	let isHierSettingsOpen = $state(false);

	let docFontFamily = $state<string>('default');
	let docFontScale = $state<number>(1);
	let selectedCardId = $state<string | null>(null);
	let cardSettings = $state<Record<string, CardPrintConfig>>({});
	let itemDescriptions = $state<Record<string, string>>({});
	let itemPercentages = $state<Record<string, number>>({});

	let selectedItem = $derived.by(() => {
		if (!selectedCardId) return null;
		if (selectedCardId === 'org_logo') {
			return { id: 'org_logo', title: 'Träger-Logo', description: undefined, isLogo: true };
		}
		if (selectedCardId === 'location_logo') {
			return {
				id: 'location_logo',
				title: 'Standort-Logo',
				description: undefined,
				isLogo: true
			};
		}
		if (selectedCardId === 'partner_logo') {
			return {
				id: 'partner_logo',
				title: 'Partner-Logo',
				description: undefined,
				isLogo: true
			};
		}
		const it =
			events.find((i) => i.id === selectedCardId) ??
			items.find((i) => i.id === selectedCardId);
		if (!it) return null;
		const isEvt = 'startDateTime' in it;
		const evt = it as EnrichedEvent;
		const isCompressed = Boolean(
			isEvt &&
				evt.isCompressedSeries &&
				((evt.seriesInstances && evt.seriesInstances.length >= 1) ||
					(evt.seriesDates && evt.seriesDates.length >= 1))
		);
		const hasEndTime = Boolean(isEvt && evt.endDateTime && !evt.isAllDay);
		return {
			id: it.id,
			title: isEvt ? (it as Event).summary : (it as Announcement).title,
			description: isEvt ? (it as Event).description : (it as Announcement).content,
			hasSeriesDates: isCompressed,
			hasEndTime
		};
	});

	const storageKey = $derived(`kiosk_flat_list_hier_prefs_${kiosk?.id || 'default'}`);

	onMount(() => {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(storageKey);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (typeof parsed.compressSeries === 'boolean') compressSeries = parsed.compressSeries;
				if (parsed.density === 'standard' || parsed.density === 'compact')
					density = parsed.density;
				if (parsed.visibleComponents && typeof parsed.visibleComponents === 'object') {
					visibleComponents = { ...visibleComponents, ...parsed.visibleComponents };
				}
				if (parsed.grouping && typeof parsed.grouping === 'object') {
					grouping = {
						months: Boolean(parsed.grouping.months),
						weeks: Boolean(parsed.grouping.weeks),
						days: Boolean(parsed.grouping.days)
					};
				}
				if (parsed.ciPreset) ciPreset = { ...DEFAULT_HIER_PRESETS[0], ...parsed.ciPreset };
				if (Array.isArray(parsed.customPresets)) customPresets = parsed.customPresets;
				if (parsed.printOptions) printOptions = { ...printOptions, ...parsed.printOptions };
				if (parsed.elementSettings)
					elementSettings = { ...DEFAULT_ELEMENT_SETTINGS, ...parsed.elementSettings };
				if (typeof parsed.docFontFamily === 'string') docFontFamily = parsed.docFontFamily;
				if (typeof parsed.docFontScale === 'number') docFontScale = parsed.docFontScale;
				if (parsed.cardSettings && typeof parsed.cardSettings === 'object')
					cardSettings = parsed.cardSettings;
				if (parsed.itemDescriptions && typeof parsed.itemDescriptions === 'object')
					itemDescriptions = parsed.itemDescriptions;
				if (parsed.itemPercentages && typeof parsed.itemPercentages === 'object')
					itemPercentages = parsed.itemPercentages;
			}
		} catch (e) {
			console.error('Failed to restore HIER flat list preferences', e);
		}
	});

	function savePrefs() {
		if (!browser) return;
		try {
			localStorage.setItem(
				storageKey,
				JSON.stringify({
					compressSeries,
					density,
					visibleComponents,
					grouping,
					ciPreset,
					customPresets,
					printOptions,
					elementSettings,
					docFontFamily,
					docFontScale,
					cardSettings,
					itemDescriptions,
					itemPercentages
				})
			);
		} catch (e) {
			console.error('Failed to save HIER flat list preferences', e);
		}
	}

	$effect(() => {
		const _ = [ciPreset, customPresets, printOptions, elementSettings];
		savePrefs();
	});

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

	function toggleComponent(key: keyof typeof visibleComponents) {
		visibleComponents[key] = !visibleComponents[key];
		savePrefs();
	}

	function toggleGrouping(key: 'months' | 'weeks' | 'days') {
		grouping[key] = !grouping[key];
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

	let announcements = $derived(
		items.filter((item) => !('startDateTime' in item) && 'content' in item) as EnrichedAnnouncement[]
	);
	let rawEvents = $derived(
		items.filter((item) => 'startDateTime' in item) as EnrichedEvent[]
	);

	const smallestGrouping = $derived.by<'day' | 'week' | 'month' | 'none'>(() => {
		if (grouping.days) return 'day';
		if (grouping.weeks) return 'week';
		if (grouping.months) return 'month';
		return 'none';
	});

	const groupingBadgeText = $derived.by(() => {
		const parts: string[] = [];
		if (grouping.months) parts.push('M');
		if (grouping.weeks) parts.push('W');
		if (grouping.days) parts.push('D');
		return parts.length > 0 ? parts.join(' • ') : 'None';
	});

	let events = $derived.by(() => {
		if (!compressSeries) return rawEvents;
		return compressSeriesEvents(rawEvents, smallestGrouping, { includeEnd: true });
	});

	interface EventGroupNode {
		key: string;
		level: 'month' | 'week' | 'day' | 'none';
		title: string;
		subtitle?: string;
		itemCount: number;
		children?: EventGroupNode[];
		items?: EnrichedEvent[];
	}

	let groupedEventsTree = $derived.by<EventGroupNode[]>(() => {
		const activeLevels: ('month' | 'week' | 'day')[] = [];
		if (grouping.months) activeLevels.push('month');
		if (grouping.weeks) activeLevels.push('week');
		if (grouping.days) activeLevels.push('day');

		if (activeLevels.length === 0) {
			return [
				{
					key: 'all',
					level: 'none',
					title: String(m.feature_events_title()),
					itemCount: events.length,
					items: [...events].sort(
						(a, b) =>
							new Date(a.startDateTime || 0).getTime() - new Date(b.startDateTime || 0).getTime()
					)
				}
			];
		}

		function getLevelMeta(evt: EnrichedEvent, level: 'month' | 'week' | 'day') {
			const raw = evt.startDateTime;
			const d = raw ? new Date(raw) : new Date(0);
			const isValid = raw && !isNaN(d.getTime());

			if (!isValid) {
				return { key: '9999-99', title: 'Other / Undated', subtitle: '' };
			}
			if (level === 'month') {
				return {
					key: getMonthKey(d),
					title: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
					subtitle: ''
				};
			}
			if (level === 'week') {
				const winfo = getWeekInfo(d);
				const startFmt = winfo.startOfWeek.toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric'
				});
				const endFmt = winfo.endOfWeek.toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});
				return {
					key: winfo.weekKey,
					title: m.calendar_week_title({ week: winfo.week }),
					subtitle: `${startFmt} – ${endFmt}`
				};
			}
			return {
				key: getDayKey(d),
				title: d.toLocaleDateString(undefined, {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}),
				subtitle: ''
			};
		}

		function buildTree(eventItems: EnrichedEvent[], levelIdx: number): EventGroupNode[] {
			const level = activeLevels[levelIdx];
			const isLeafLevel = levelIdx === activeLevels.length - 1;
			const map = new Map<
				string,
				{ key: string; title: string; subtitle: string; events: EnrichedEvent[] }
			>();

			for (const evt of eventItems) {
				const meta = getLevelMeta(evt, level);
				const existing = map.get(meta.key) || {
					key: meta.key,
					title: meta.title,
					subtitle: meta.subtitle,
					events: []
				};
				existing.events.push(evt);
				map.set(meta.key, existing);
			}

			const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
			return sortedKeys.map((k) => {
				const entry = map.get(k)!;
				const sortedEvts = entry.events.sort(
					(a, b) =>
						new Date(a.startDateTime || 0).getTime() - new Date(b.startDateTime || 0).getTime()
				);
				if (isLeafLevel) {
					return {
						key: `${level}_${entry.key}`,
						level,
						title: entry.title,
						subtitle: entry.subtitle,
						itemCount: sortedEvts.length,
						items: sortedEvts
					};
				}
				return {
					key: `${level}_${entry.key}`,
					level,
					title: entry.title,
					subtitle: entry.subtitle,
					itemCount: sortedEvts.length,
					children: buildTree(sortedEvts, levelIdx + 1)
				};
			});
		}

		return buildTree(events, 0);
	});

	const primaryLoc = $derived(kiosk?.locations?.[0]);

	const generatedDateStr = new Date().toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	function triggerPrint() {
		if (browser) window.print();
	}
</script>

<div
	class="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 pb-24 px-3 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 print:bg-white print:p-0 print:pb-0 print:m-0 print:text-black"
>
	<!-- Screen-Only Toolbar -->
	<header class="max-w-5xl mx-auto mb-6 print:hidden">
		<div
			class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
		>
			<div class="flex items-center gap-3">
				<a
					href={resolve('kiosks')}
					class="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm font-medium"
					title={m.back_to_kiosks_btn()}
				>
					<ArrowLeft class="w-4 h-4" />
					<span class="hidden sm:inline">{m.back_to_kiosks_btn()}</span>
				</a>
				<div class="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
				<div>
					<div class="flex items-center gap-2">
						<FileText class="w-5 h-5 text-[#6950fc]" />
						<h1 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
							{m.flat_list_hier_template()}
						</h1>
					</div>
					<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
						{events.length}
						{events.length === 1 ? m.event_label() : m.feature_events_title()} •
						{announcements.length}
						{m.feature_announcements_title()}
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-xs">
				<!-- Filter Tabs -->
				<div
					class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
				>
					<button
						type="button"
						onclick={() => (activeFilter = 'all')}
						class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeFilter === 'all' ? 'bg-white dark:bg-slate-800 text-[#6950fc] shadow-xs' : 'text-slate-600 dark:text-slate-400'}"
					>
						{m.all_items_tab()} ({events.length + announcements.length})
					</button>
					{#if events.length > 0}
						<button
							type="button"
							onclick={() => (activeFilter = 'events')}
							class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeFilter === 'events' ? 'bg-white dark:bg-slate-800 text-[#6950fc] shadow-xs' : 'text-slate-600 dark:text-slate-400'}"
						>
							{m.feature_events_title()} ({events.length})
						</button>
					{/if}
					{#if announcements.length > 0}
						<button
							type="button"
							onclick={() => (activeFilter = 'news')}
							class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeFilter === 'news' ? 'bg-white dark:bg-slate-800 text-[#6950fc] shadow-xs' : 'text-slate-600 dark:text-slate-400'}"
						>
							{m.feature_announcements_title()} ({announcements.length})
						</button>
					{/if}
				</div>

				<!-- Density -->
				<div
					class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
				>
					<button
						type="button"
						onclick={() => {
							density = 'standard';
							savePrefs();
						}}
						class="px-2.5 py-1 rounded-lg font-medium transition-colors {density === 'standard' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500'}"
					>
						{m.layout_standard()}
					</button>
					<button
						type="button"
						onclick={() => {
							density = 'compact';
							savePrefs();
						}}
						class="px-2.5 py-1 rounded-lg font-medium transition-colors {density === 'compact' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500'}"
					>
						{m.layout_compact()}
					</button>
				</div>

				<!-- Series Mode -->
				<div
					class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
				>
					<button
						type="button"
						onclick={() => {
							compressSeries = true;
							savePrefs();
						}}
						class="px-2.5 py-1 rounded-lg font-medium transition-colors inline-flex items-center gap-1 {compressSeries ? 'bg-white dark:bg-slate-800 text-[#6950fc] shadow-xs' : 'text-slate-500'}"
					>
						<RefreshCw class="w-3 h-3" />
						<span>{m.series_compacted()}</span>
					</button>
					<button
						type="button"
						onclick={() => {
							compressSeries = false;
							savePrefs();
						}}
						class="px-2.5 py-1 rounded-lg font-medium transition-colors {!compressSeries ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500'}"
					>
						<span>{m.series_unrolled()}</span>
					</button>
				</div>

				<!-- Grouping Dropdown -->
				<div class="relative">
					<button
						type="button"
						onclick={() => (isGroupingMenuOpen = !isGroupingMenuOpen)}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium transition-colors bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
					>
						<Layers class="w-3.5 h-3.5 text-[#6950fc]" />
						<span>{m.grouping()}</span>
						<span class="px-1.5 py-0.2 bg-[#f0e7f3] text-[#6950fc] rounded-full text-[10px] font-bold">
							{groupingBadgeText}
						</span>
						<ChevronDown class="w-3 h-3" />
					</button>
					{#if isGroupingMenuOpen}
						<div
							class="fixed inset-0 z-40"
							onclick={() => (isGroupingMenuOpen = false)}
							aria-hidden="true"
						></div>
						<div
							class="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50 space-y-1 text-xs"
						>
							{#each [
								{ key: 'months' as const, label: m.grouping_months() },
								{ key: 'weeks' as const, label: m.grouping_weeks() },
								{ key: 'days' as const, label: m.grouping_days() }
							] as grp (grp.key)}
								<button
									type="button"
									onclick={() => toggleGrouping(grp.key)}
									class="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
								>
									<span class="font-semibold">{grp.label}</span>
									<span
										class="w-4 h-4 rounded border flex items-center justify-center {grouping[grp.key] ? 'bg-[#6950fc] border-[#6950fc] text-white' : 'border-slate-300'}"
									>
										{#if grouping[grp.key]}<Check class="w-3 h-3 stroke-[3]" />{/if}
									</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Visible Components Dropdown -->
				<div class="relative">
					<button
						type="button"
						onclick={() => (isComponentsMenuOpen = !isComponentsMenuOpen)}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
					>
						<SlidersHorizontal class="w-3.5 h-3.5 text-[#6950fc]" />
						<span>{m.visible_components()}</span>
						<span class="px-1.5 py-0.2 bg-[#f0e7f3] text-[#6950fc] rounded-full text-[10px] font-bold">
							{Object.values(visibleComponents).filter(Boolean).length}
						</span>
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

				<!-- Print Mode -->
				<select
					bind:value={printOptions.printMode}
					class="text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-2.5 pr-6"
					title="Druckmodus"
				>
					<option value="all_color">🎨 Vollfarbe</option>
					<option value="greyscale_content">🖨️ Inhalt S/W (CI Farbe)</option>
					<option value="omit_ci">📄 Briefpapier (CI frei)</option>
					<option value="ci_only">🏛️ Nur CI</option>
					<option value="all_greyscale">⬛ Monochrom</option>
				</select>

				<!-- Preset -->
				<select
					value={ciPreset.id}
					onchange={(e) => {
						const found = [...DEFAULT_HIER_PRESETS, ...customPresets].find(
							(p) => p.id === (e.target as HTMLSelectElement).value
						);
						if (found) ciPreset = { ...found };
					}}
					class="text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-2.5 pr-6"
				>
					{#each [...DEFAULT_HIER_PRESETS, ...customPresets] as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>

				<button
					type="button"
					onclick={() => (isHierSettingsOpen = true)}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#6950fc]/30 bg-[#f0e7f3] text-[#6950fc] font-semibold hover:bg-[#fadfed] transition"
				>
					<Palette class="w-3.5 h-3.5" />
					<span>HIER. CI</span>
				</button>

				<button
					type="button"
					onclick={triggerPrint}
					class="inline-flex items-center gap-2 px-4 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition hover:opacity-90"
					style="background-color: {HIER_PALETTE.primaryDigital};"
				>
					<Printer class="w-4 h-4" />
					<span>{m.print_export_btn()}</span>
				</button>
			</div>
		</div>
	</header>

	<!-- Document Paper Preview Container -->
	<main
		class="hier-ci-scope kiosk-typography-scope {docFontFamily && docFontFamily !== 'default' ? 'kiosk-has-custom-font' : ''} max-w-5xl mx-auto bg-white text-[#222222] shadow-xl print:shadow-none border border-slate-200 print:border-none rounded-2xl print:rounded-none overflow-hidden {printOptions.printMode === 'all_greyscale' ? 'monochrome-mode' : ''} {printOptions.printMode === 'omit_ci' ? 'print-omit-ci' : ''} {printOptions.printMode === 'greyscale_content' ? 'print-greyscale-content' : ''} {printOptions.printMode === 'ci_only' ? 'print-ci-only' : ''}"
		style={getDocumentTypographyStyle(docFontFamily, docFontScale)}
	>
		<!-- Top HIER. Brand Header Band -->
		<div
			class="ci-area {getElementPrintClasses(elementSettings.ciTop, printOptions.previewGreyscaleOnScreen)} {printOptions.printMode === 'omit_ci' ? 'print:invisible' : ''}"
		>
			<HierHeaderBand
				preset={ciPreset}
				printMode={printOptions.printMode}
				locationName={primaryLoc?.name || kiosk?.name || ''}
				customLocationLogo={ciPreset.locationLogoUrl || primaryLoc?.heroImage}
				customOrgLogo={ciPreset.orgLogoUrl}
				variant="list"
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
			class="ci-content-body p-6 sm:p-10 print:px-8 print:py-6 {printOptions.previewGreyscaleOnScreen ? 'card-greyscale' : ''} {printOptions.printMode === 'ci_only' ? 'print:invisible' : ''} {printOptions.printMode === 'greyscale_content' ? 'print:card-greyscale' : ''}"
		>
			<!-- Printable Document Header -->
			<div
				class="border-b-2 pb-5 mb-7 {getElementPrintClasses(elementSettings.header, printOptions.previewGreyscaleOnScreen)}"
				style="border-color: {HIER_PALETTE.primaryDigital};"
			>
				<div class="flex flex-col md:flex-row justify-between items-start gap-6">
					<div class="space-y-2 flex-1">
						<div class="flex items-center gap-3 flex-wrap">
							<span
								class="hier-badge px-2.5 py-0.5 text-white text-[11px] font-bold tracking-widest uppercase rounded-full"
								style="background-color: {HIER_PALETTE.primaryDigital};"
							>
								{m.document_badge()}
							</span>
							<span class="text-xs text-slate-500 font-medium">
								{m.generated_on({ date: generatedDateStr })}
							</span>
						</div>

						<h1
							class="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight"
							style="color: {HIER_PALETTE.navy};"
						>
							{kiosk?.name || m.monthly_events_overview()}
						</h1>

						{#if kiosk?.description}
							<div class="rich-description text-sm text-[#222222]/85 max-w-2xl leading-relaxed">
								{@html kiosk.description}
							</div>
						{/if}

						{#if kiosk?.locations && kiosk.locations.length > 0}
							<div class="flex flex-wrap items-center gap-3 pt-2 text-xs font-medium">
								{#each kiosk.locations as loc (loc.id)}
									<div
										class="inline-flex flex-col gap-1 px-3 py-1.5 rounded-xl border border-[#6950fc]/20"
										style="background-color: {HIER_PALETTE.mutedLavender};"
									>
										<div class="inline-flex items-center gap-1.5 font-bold text-[#29235c]">
											<MapPin class="w-3.5 h-3.5 text-[#6950fc] shrink-0" />
											<span>
												{loc.name}
												{#if loc.street}
													• {loc.street} {loc.houseNumber || ''}, {loc.zip || ''} {loc.city || ''}
												{/if}
											</span>
										</div>
										{#if visibleComponents.openingHours && (loc.openingHours || loc.inclusivitySupport)}
											<div class="pl-5 text-[11px] text-[#222222]/80 space-y-0.5">
												{#if loc.openingHours}
													<div class="flex items-start gap-1">
														<Clock class="w-3 h-3 text-[#6950fc] shrink-0 mt-0.5" />
														<span class="whitespace-pre-line font-mono text-[10.5px]">
															{formatOpeningHours(loc.openingHours)}
														</span>
													</div>
												{/if}
												{#if loc.inclusivitySupport}
													<div class="text-[10px] font-bold text-[#40b28f] flex items-center gap-1">
														<span class="w-1.5 h-1.5 rounded-full bg-[#40b28f]"></span>
														<span>{loc.inclusivitySupport}</span>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					{#if kiosk?.locations && kiosk.locations.some((l) => l.contact)}
						{@const contact = kiosk.locations.find((l) => l.contact)?.contact}
						{#if contact}
							<div
								class="shrink-0 border border-[#6950fc]/20 rounded-xl p-3.5 text-xs space-y-1.5 min-w-[220px]"
								style="background-color: {HIER_PALETTE.mutedCream};"
							>
								<div class="font-bold uppercase tracking-wider text-[10px] text-[#6950fc] flex items-center gap-1">
									<User class="w-3 h-3" />
									<span>{m.contact()}</span>
								</div>
								<div class="font-bold text-[#29235c] text-sm">{contact.name}</div>
								{#if contact.phone}
									<div class="flex items-center gap-1.5 text-[#222222]/80">
										<Phone class="w-3 h-3 text-[#6950fc]" />
										<span>{contact.phone}</span>
									</div>
								{/if}
								{#if contact.email}
									<div class="flex items-center gap-1.5 text-[#222222]/80">
										<Mail class="w-3 h-3 text-[#6950fc]" />
										<span>{contact.email}</span>
									</div>
								{/if}
								{#if visibleComponents.qrCodes && (contact.qrCodeDataUrl || contact.qrCodePath)}
									<div class="pt-1 flex items-center gap-2">
										<img
											src={contact.qrCodeDataUrl || contact.qrCodePath}
											alt="Contact QR"
											class="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shrink-0"
										/>
										<span class="text-[10px] text-slate-600 leading-tight">
											{m.scan_location_qr()}
										</span>
									</div>
								{/if}
							</div>
						{/if}
					{/if}
				</div>
			</div>

			{#if items.length === 0}
				<div
					class="text-center py-16 rounded-2xl border border-dashed border-[#6950fc]/30"
					style="background-color: {HIER_PALETTE.mutedLavender};"
				>
					<Calendar class="w-12 h-12 text-[#6950fc] mx-auto mb-3" />
					<p class="text-[#29235c] text-base font-bold">{m.no_events_or_news()}</p>
				</div>
			{:else}
				<!-- Announcements -->
				{#if (activeFilter === 'all' || activeFilter === 'news') && announcements.length > 0}
					<section class="mb-10 space-y-4 print:break-inside-avoid-page">
						<div
							class="flex items-center gap-2.5 border-b-2 pb-2"
							style="border-color: {HIER_PALETTE.pink};"
						>
							<Megaphone class="w-5 h-5 text-[#da5096]" />
							<h2 class="text-xl font-black uppercase tracking-wider text-[#29235c]">
								{m.news_and_announcements_heading()}
							</h2>
							<span
								class="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#fadfed] text-[#da5096]"
							>
								{announcements.length}
							</span>
						</div>

						<div class="grid grid-cols-1 {density === 'standard' ? 'gap-4' : 'gap-3'}">
							{#each announcements as announcement (announcement.id)}
								<div
									role="button"
									tabindex="0"
									onclick={() => {
										selectedCardId =
											selectedCardId === announcement.id ? null : announcement.id;
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											selectedCardId =
												selectedCardId === announcement.id ? null : announcement.id;
										}
									}}
									class="hier-card-accent kiosk-item-typography {cardSettings[announcement.id]?.fontFamily ? 'kiosk-has-custom-font' : ''} p-4 sm:p-5 rounded-xl border border-[#da5096]/30 border-l-4 border-l-[#da5096] print:break-inside-avoid flex flex-col sm:flex-row justify-between gap-4 cursor-pointer transition-all outline-hidden {selectedCardId === announcement.id ? 'ring-2 ring-amber-400 print:ring-0' : ''} {getCardPrintClasses(cardSettings[announcement.id], elementSettings.events, printOptions.previewGreyscaleOnScreen)}"
									style="background-color: {HIER_PALETTE.mutedBlush}; {getItemTypographyStyle(cardSettings[announcement.id]?.fontFamily, cardSettings[announcement.id]?.fontScale)}"
								>
									<div class="space-y-2 flex-1">
										<div class="flex items-center justify-between gap-3">
											<h3 class="text-base sm:text-lg font-bold text-[#29235c] leading-snug">
												{announcement.title}
											</h3>
											{#if announcement.createdAt}
												<span class="text-[11px] text-[#222222]/65 font-medium shrink-0">
													{formatFullDate(announcement.createdAt)}
												</span>
											{/if}
										</div>
										{#if visibleComponents.descriptions && announcement.content}
											<div class="rich-description text-xs sm:text-sm text-[#222222] leading-relaxed">
												{@html itemDescriptions[announcement.id] || announcement.content}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Events -->
				{#if (activeFilter === 'all' || activeFilter === 'events') && events.length > 0}
					<section class="space-y-8 print:space-y-6">
						{#each groupedEventsTree as rootGroup (rootGroup.key)}
							{@render renderGroupNode(rootGroup)}
						{/each}
					</section>
				{/if}
			{/if}
		</div>

		<!-- Bottom HIER. Footer Band -->
		<div
			class="ci-area {getElementPrintClasses(elementSettings.ciBottom, printOptions.previewGreyscaleOnScreen)} {printOptions.printMode === 'omit_ci' ? 'print:invisible' : ''}"
		>
			<HierFooterBand
				preset={ciPreset}
				printMode={printOptions.printMode}
				locationName={primaryLoc?.name || kiosk?.name || ''}
				street={primaryLoc?.street}
				houseNumber={primaryLoc?.houseNumber}
				zip={primaryLoc?.zip}
				city={primaryLoc?.city}
				phone={primaryLoc?.contact?.phone}
				inclusivityText={primaryLoc?.inclusivitySupport}
				sponsors={ciPreset.sponsors || []}
				partnerLogoUrl={ciPreset.partnerLogoUrl}
				variant="list"
				selectedCardId={selectedCardId}
				cardSettings={cardSettings}
				elementSettings={elementSettings}
				previewGreyscaleOnScreen={printOptions.previewGreyscaleOnScreen}
				onSelect={(id) => {
					selectedCardId = selectedCardId === id ? null : id;
				}}
			/>
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
		scopeLabel="HIER. Liste"
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
</div>

{#snippet renderEventsList(eventItems: EnrichedEvent[])}
	<div class="divide-y divide-[#edeff4]">
		{#each eventItems as event (event.id)}
			{@render renderEventRow(event)}
		{/each}
	</div>
{/snippet}

{#snippet renderMonthGroup(node: EventGroupNode)}
	<div class="space-y-4 print:space-y-3 print:break-inside-avoid-page">
		<div class="space-y-1">
			<div class="flex items-center gap-2.5">
				<Calendar class="w-5 h-5 text-[#6950fc]" />
				<h2 class="text-xl font-black uppercase tracking-wider text-[#6950fc]">
					{node.title}
				</h2>
				<span class="ml-auto text-xs font-bold bg-[#f0e7f3] text-[#29235c] px-2.5 py-0.5 rounded-full">
					{node.itemCount} {node.itemCount === 1 ? m.event_label() : m.feature_events_title()}
				</span>
			</div>
			<div class="h-0.5 w-full flex">
				<div class="flex-1 bg-[#da5096]"></div>
				<div class="flex-1 bg-[#fcc505]"></div>
				<div class="flex-1 bg-[#40b28f]"></div>
			</div>
		</div>
		{#if node.children}
			<div class="space-y-4 pl-0 sm:pl-2">
				{#each node.children as child (child.key)}
					{#if child.level === 'week'}
						{@render renderWeekGroup(child)}
					{:else if child.level === 'day'}
						{@render renderDayGroup(child)}
					{/if}
				{/each}
			</div>
		{:else if node.items}
			{@render renderEventsList(node.items)}
		{/if}
	</div>
{/snippet}

{#snippet renderWeekGroup(node: EventGroupNode)}
	<div class="space-y-2.5 print:break-inside-avoid-page">
		<div
			class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#6950fc]/20"
			style="background-color: {HIER_PALETTE.mutedIceBlue};"
		>
			<CalendarDays class="w-4 h-4 text-[#6950fc] shrink-0" />
			<div class="flex items-baseline gap-2 flex-wrap">
				<span class="font-bold text-sm text-[#29235c]">{node.title}</span>
				{#if node.subtitle}
					<span class="text-xs text-[#222222]/70 font-medium">{node.subtitle}</span>
				{/if}
			</div>
			<span class="ml-auto text-[11px] font-bold bg-white text-[#6950fc] px-2 py-0.5 rounded-full">
				{node.itemCount}
			</span>
		</div>
		{#if node.children}
			<div class="space-y-3 pl-0 sm:pl-2">
				{#each node.children as child (child.key)}
					{@render renderDayGroup(child)}
				{/each}
			</div>
		{:else if node.items}
			{@render renderEventsList(node.items)}
		{/if}
	</div>
{/snippet}

{#snippet renderDayGroup(node: EventGroupNode)}
	<div class="space-y-1.5 print:break-inside-avoid-page">
		<div class="flex items-center gap-2 border-l-4 border-l-[#6950fc] pl-2.5 py-1">
			<Clock class="w-3.5 h-3.5 text-[#6950fc] shrink-0" />
			<span class="font-bold text-xs uppercase tracking-wide text-[#29235c]">{node.title}</span>
			<span class="ml-auto text-[10px] font-bold text-[#6950fc]">{node.itemCount}</span>
		</div>
		{#if node.items}
			{@render renderEventsList(node.items)}
		{/if}
	</div>
{/snippet}

{#snippet renderGroupNode(node: EventGroupNode)}
	{#if node.level === 'month'}
		{@render renderMonthGroup(node)}
	{:else if node.level === 'week'}
		{@render renderWeekGroup(node)}
	{:else if node.level === 'day'}
		{@render renderDayGroup(node)}
	{:else if node.items}
		{@render renderEventsList(node.items)}
	{/if}
{/snippet}

{#snippet renderEventRow(event: EnrichedEvent)}
	{@const eventRooms = getEventRooms(event)}
	{@const eventRecurrenceRule =
		(Array.isArray((event as any).recurrence)
			? (event as any).recurrence[0]
			: typeof (event as any).recurrence === 'string'
				? (event as any).recurrence
				: null) ||
		(event as any).seriesMaster?.recurrence?.[0] ||
		null}
	{@const displayPrice = formatTicketPrice(event.ticketPrice, event.ticketPriceUnknown, {
		currency: (event as any).currency || 'EUR'
	})}
	{@const isSpecialNonSeries = isNonSeriesEvent(event)}
	{@const isCompressed = Boolean(
		event.isCompressedSeries &&
			((event.seriesInstances && event.seriesInstances.length >= 1) ||
				(event.seriesDates && event.seriesDates.length >= 1))
	)}
	{@const multiDay = isMultiDayEvent(event)}
	{@const durationDays = multiDay ? getEventDurationDays(event) : 1}
	{@const dateParts = getEventDateParts(event)}
	{@const totalInstances = event.seriesInstances
		? event.seriesInstances.length
		: event.seriesDates
			? event.seriesDates.length
			: (event.instanceCount ?? 1)}
	{@const showEnd =
		cardSettings[event.id]?.hideEndTime !== undefined
			? !cardSettings[event.id]!.hideEndTime
			: visibleComponents.endTimes}
	<div
		role="button"
		tabindex="0"
		onclick={() => {
			selectedCardId = selectedCardId === event.id ? null : event.id;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				selectedCardId = selectedCardId === event.id ? null : event.id;
			}
		}}
		class="hier-card-accent kiosk-item-typography {cardSettings[event.id]?.fontFamily ? 'kiosk-has-custom-font' : ''} {density === 'standard' ? 'py-4 sm:py-5' : 'py-2.5 sm:py-3'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:break-inside-avoid transition-all cursor-pointer outline-hidden {selectedCardId === event.id ? 'ring-2 ring-amber-400 bg-amber-50 rounded-xl px-2 print:ring-0 print:bg-transparent print:px-0' : ''} {isSpecialNonSeries ? 'border-l-4 border-l-[#fcc505] pl-3 sm:pl-4 bg-[#fffcf7] rounded-r-xl my-1.5' : isCompressed ? 'border-l-4 border-l-[#6950fc] pl-3 sm:pl-4 bg-[#f0e7f3]/45 rounded-r-xl my-1.5' : ''} {getCardPrintClasses(cardSettings[event.id], elementSettings.events, printOptions.previewGreyscaleOnScreen)}"
		style={getItemTypographyStyle(
			cardSettings[event.id]?.fontFamily,
			cardSettings[event.id]?.fontScale
		)}
	>
		<!-- Left Date & Time Column -->
		<div class="flex items-center gap-3 shrink-0 min-w-[130px]">
			{#if isCompressed}
				<div
					class="hier-date-pill flex flex-col items-center justify-center min-w-[56px] px-1.5 h-12 rounded-xl text-center text-white"
					style="background-color: {HIER_PALETTE.primaryDigital};"
				>
					<RefreshCw class="w-3.5 h-3.5 text-[#ffec00] mb-0.5" />
					<span class="text-sm font-black leading-tight">{totalInstances}×</span>
					<span class="text-[8px] font-bold uppercase opacity-85">{m.series_badge()}</span>
				</div>
			{:else if multiDay}
				<div
					class="hier-date-pill flex flex-col items-center justify-center min-w-[56px] px-1.5 h-12 rounded-xl text-center text-white"
					style="background-color: {HIER_PALETTE.navy};"
				>
					<span class="text-[9px] font-extrabold text-[#ffec00] uppercase leading-none">
						{dateParts.startMonth}{dateParts.startMonth !== dateParts.endMonth
							? `/${dateParts.endMonth}`
							: ''}
					</span>
					<span class="text-sm font-black leading-tight">
						{dateParts.startDay}–{dateParts.endDay}
					</span>
					<span class="text-[8px] font-bold uppercase opacity-80">
						{m.days_count({ count: durationDays })}
					</span>
				</div>
			{:else}
				<div
					class="hier-date-pill flex flex-col items-center justify-center w-12 h-12 rounded-xl text-center {isSpecialNonSeries ? 'bg-[#fcc505] text-[#222222]' : 'bg-[#f0e7f3] text-[#29235c] border border-[#6950fc]/20'}"
				>
					<span
						class="text-[10px] font-bold leading-none uppercase {isSpecialNonSeries ? 'text-[#222222]' : 'text-[#6950fc]'}"
					>
						{formatDateMonth(event.startDateTime)}
					</span>
					<span class="text-lg font-black leading-tight">
						{formatDateDay(event.startDateTime)}
					</span>
					<span class="text-[9px] leading-none uppercase opacity-75">
						{formatDateWeekday(event.startDateTime)}
					</span>
				</div>
			{/if}

			<div class="text-xs font-semibold text-[#222222]">
				{#if isCompressed}
					<div class="flex items-center gap-1 font-bold text-[#29235c]">
						<Clock class="w-3 h-3 text-[#6950fc]" />
						<span>{formatTimeRange(event.startDateTime, event.endDateTime, event.isAllDay, showEnd)}</span>
					</div>
				{:else if event.isAllDay}
					<span class="inline-block px-1.5 py-0.5 bg-[#f0e7f3] text-[#6950fc] rounded text-[11px] font-bold">
						{m.all_day_label()}
					</span>
				{:else}
					<div class="flex items-center gap-1 font-bold text-[#29235c]">
						<Clock class="w-3 h-3 text-[#6950fc]" />
						<span>{formatTime(event.startDateTime)}</span>
					</div>
					{#if showEnd && event.endDateTime}
						<div class="text-[#222222]/65 pl-4 text-[11px]">– {formatTime(event.endDateTime)}</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Center Event Details -->
		<div class="flex-1 space-y-1.5 min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				{#if isCompressed}
					<span class="hier-badge inline-flex items-center gap-1 bg-[#f0e7f3] text-[#6950fc] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
						<RefreshCw class="w-2.5 h-2.5" />
						{event.recurrenceText || m.series_badge()}
					</span>
				{:else if multiDay}
					<span class="hier-badge inline-flex items-center gap-1 bg-[#f0e7f3] text-[#6950fc] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
						<Calendar class="w-2.5 h-2.5" />
						{m.multi_day_badge()}
					</span>
				{/if}
				{#if event.status === 'cancelled'}
					<span class="bg-[#da5096] text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
						{m.cancelled()}
					</span>
				{:else if event.status === 'tentative'}
					<span class="bg-[#fcc505] text-[#222222] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
						{m.tentative()}
					</span>
				{/if}
				{#if visibleComponents.publicStatus}
					<span class="inline-flex items-center gap-1 bg-[#edeff4] text-[#29235c] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
						{#if event.isPublic}
							<Globe class="w-2.5 h-2.5 text-[#40b28f]" />
							<span>{m.public_label()}</span>
						{:else}
							<Lock class="w-2.5 h-2.5" />
							<span>{m.private_label()}</span>
						{/if}
					</span>
				{/if}
				<h3
					class="text-base sm:text-lg font-bold text-[#29235c] leading-snug {event.status === 'cancelled' ? 'line-through opacity-50' : ''}"
				>
					{event.summary || m.untitled_event()}
				</h3>
			</div>

			{#if isCompressed && !cardSettings[event.id]?.hideSeriesDates && event.seriesInstances && event.seriesInstances.length >= 1}
				<div class="flex items-center gap-1.5 flex-wrap pt-0.5">
					{#each event.seriesInstances as inst (inst.id || inst.startDateTime)}
						{#if inst.status === 'cancelled'}
							<span class="inline-flex items-center gap-1 bg-[#fadfed] text-[#da5096] px-2 py-0.5 rounded text-[10px] font-bold line-through">
								{formatDateWeekday(inst.startDateTime)} {formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}
							</span>
						{:else}
							<span class="hier-badge inline-flex items-center gap-1 bg-[#29235c] text-white px-2 py-0.5 rounded text-[10px] font-bold">
								<span class="text-[#fcc505]">{formatDateWeekday(inst.startDateTime)}</span>
								<span>{formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}</span>
							</span>
						{/if}
					{/each}
				</div>
			{/if}

			<div class="flex flex-wrap items-center gap-3 text-xs text-[#222222]/80">
				{#if visibleComponents.rooms && eventRooms.length > 0}
					{#each eventRooms as roomName (roomName)}
						<span class="inline-flex items-center gap-1 font-semibold text-[#6950fc]">
							<MapPin class="w-3.5 h-3.5 shrink-0" />
							{roomName}
						</span>
					{/each}
				{/if}
				{#if visibleComponents.ticketPrice && displayPrice && !isEventFree(event.ticketPrice, event.ticketPriceUnknown)}
					<span class="inline-flex items-center gap-1 font-bold text-[#40b28f]">
						<Ticket class="w-3.5 h-3.5" />
						{displayPrice}
					</span>
				{/if}
				{#if visibleComponents.participants && ((event as any).participantsCount != null || (event as any).maxOccupancy != null)}
					<span class="inline-flex items-center gap-1 bg-[#fffcf7] border border-[#fcc505] px-2 py-0.5 rounded text-[10.5px] font-semibold">
						<UserCheck class="w-3 h-3 text-[#6950fc]" />
						<span>
							{(event as any).participantsCount ?? 0}{(event as any).maxOccupancy != null
								? ` / ${(event as any).maxOccupancy}`
								: ''}
							{m.participants()}
						</span>
					</span>
				{/if}
				{#if !isCompressed && eventRecurrenceRule}
					<span class="inline-flex items-center gap-1 text-[#222222]/70 font-medium">
						<RefreshCw class="w-3 h-3 text-[#6950fc]" />
						{formatRecurrenceText(eventRecurrenceRule, { includeEnd: true })}
					</span>
				{/if}
			</div>

			{#if visibleComponents.contacts}
				{@const allContacts = getAllEventContacts(event)}
				{#if allContacts.length > 0}
					<div class="flex flex-wrap items-center gap-1.5 pt-1">
						{#each allContacts as c (c.id || c.name || getContactName(c))}
							<span class="inline-flex items-center gap-1 bg-[#edeff4] px-2 py-0.5 rounded-lg text-[11px] font-medium">
								<User class="w-3 h-3 text-[#6950fc]" />
								<span>{getContactName(c)}</span>
							</span>
						{/each}
					</div>
				{:else if event.resolvedContact}
					<div class="flex items-center gap-1.5 text-xs text-[#222222]/80">
						<User class="w-3.5 h-3.5 text-[#6950fc]" />
						<span class="font-semibold">{event.resolvedContact.name}</span>
					</div>
				{/if}
			{/if}

			{#if visibleComponents.descriptions && event.description}
				{@const compactSignUp = getKioskSignUpText(event, {
					showQrCode: Boolean(visibleComponents.qrCodes && (event.qrCodeDataUrl || event.qrCodePath))
				})}
				<div class="text-xs text-[#222222]/85 leading-relaxed pt-0.5">
					{#if compactSignUp}
						<span class="font-bold text-[#da5096] mr-1">{compactSignUp}.</span>
					{/if}
					<span class="rich-description [&>p:first-child]:inline [&>p]:mb-0">
						{@html itemDescriptions[event.id] || event.description}
					</span>
				</div>
			{/if}

			{#if visibleComponents.internalNotes && event.internalNotes}
				<div class="mt-2 p-2 rounded-xl bg-[#fffcf7] border border-[#fcc505] text-xs">
					<div class="font-bold text-[10px] uppercase text-[#29235c] mb-0.5">{m.internal_notes()}</div>
					<div class="rich-description">{@html event.internalNotes}</div>
				</div>
			{/if}

			{#if (visibleComponents.tags && event.tags && event.tags.length > 0) || (visibleComponents.ticketPrice && isEventFree(event.ticketPrice, event.ticketPriceUnknown))}
				<div class="flex flex-wrap items-center gap-1.5 pt-1">
					{#if visibleComponents.ticketPrice && isEventFree(event.ticketPrice, event.ticketPriceUnknown)}
						<span class="hier-badge px-2 py-0.5 bg-[#e3f0ea] text-[#29235c] border border-[#40b28f]/40 rounded text-[10px] font-bold inline-flex items-center gap-1">
							<Ticket class="w-2.5 h-2.5 text-[#40b28f]" />
							{m.ticket_price_free?.() || 'Free'}
						</span>
					{/if}
					{#if visibleComponents.tags && event.tags}
						{#each event.tags as tag, tIdx (typeof tag === 'string' ? `${tag}_${tIdx}` : tag.id || tag.name || tIdx)}
							<span class="px-1.5 py-0.5 bg-[#edeff4] text-[#29235c] rounded text-[10px] font-medium">
								#{typeof tag === 'string' ? tag : tag.name}
							</span>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Right Visuals -->
		{#if (visibleComponents.heroImage && event.heroImage) || (visibleComponents.qrCodes && (event.qrCodeDataUrl || event.qrCodePath))}
			<div class="shrink-0 flex items-center gap-2 self-end sm:self-center">
				{#if visibleComponents.heroImage && event.heroImage}
					<div class="overflow-hidden rounded-xl border border-[#6950fc]/20 bg-[#f0e7f3] shrink-0 {getElementPrintClasses(elementSettings.heroImages, printOptions.previewGreyscaleOnScreen)}">
						<img
							src={event.heroImage}
							alt={event.summary || 'Event'}
							class="{density === 'standard' ? 'w-24 h-16 sm:w-28 sm:h-18' : 'w-16 h-12'} object-cover"
							loading="lazy"
						/>
					</div>
				{/if}
				{#if visibleComponents.qrCodes && (event.qrCodeDataUrl || event.qrCodePath)}
					<div class="flex flex-col items-center justify-center p-2 bg-white border border-[#6950fc]/20 rounded-xl shadow-2xs {getElementPrintClasses(elementSettings.qrCodes, printOptions.previewGreyscaleOnScreen)}">
						<img
							src={event.qrCodeDataUrl || event.qrCodePath}
							alt="Event QR"
							class={density === 'standard' ? 'w-20 h-20' : 'w-16 h-16'}
						/>
						<span class="text-[8.5px] font-bold text-[#6950fc] mt-1 uppercase tracking-tight">
							{m.scan_event_qr()}
						</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

<style>
	.rich-description :global(p) {
		margin-top: 0;
		margin-bottom: 0.3rem;
	}
	.rich-description :global(p:last-child) {
		margin-bottom: 0;
	}

	@media print {
		@page {
			margin: 8mm 10mm;
			size: A4 portrait;
		}
		:global(body) {
			background-color: #ffffff !important;
			color: #000000 !important;
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
		}
		.print-omit-ci .ci-area {
			visibility: hidden !important;
		}
		.print-ci-only .ci-content-body {
			visibility: hidden !important;
		}
	}
</style>
