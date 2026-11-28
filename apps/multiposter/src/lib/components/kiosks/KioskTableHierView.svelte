<script lang="ts">
	import {
		type Event,
		type Announcement,
		formatOpeningHours,
		type OpeningHoursData
	} from '@ac/validations';
	import { onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { RefreshCw, Ticket, Calendar, User } from '@lucide/svelte';
	import { formatRecurrenceText } from '#lib/utils/format-recurrence.js';
	import { formatTicketPrice, isEventFree } from '#lib/utils/format-ticket-price.js';
	import { getEventRooms } from '#lib/utils/format-rooms.js';
	import { isNonSeriesEvent } from '#lib/utils/event-series.js';
	import {
		isMultiDayEvent,
		getEventDurationDays,
		getEventDateParts
	} from '#lib/utils/format-event-date.js';
	import { getKioskSignUpText } from '#lib/utils/kiosk-signup.js';
	import * as m from '#lib/paraglide/messages.js';
	import HierLogo from './hier/HierLogo.svelte';
	import { HIER_PALETTE } from './hier/types.js';

	interface LocationInfo {
		id: string;
		name: string;
		street: string | null;
		houseNumber: string | null;
		zip: string | null;
		city: string | null;
		country: string | null;
		openingHours?: OpeningHoursData | string | null;
		inclusivitySupport?: string | null;
		contact: {
			name: string;
			email?: string;
			phone?: string;
			qrCodePath?: string;
			qrCodeDataUrl?: string;
			role?: string | null;
			roles?: string[] | null;
		} | null;
	}

	let {
		items,
		kiosk
	}: {
		items: (Event | Announcement)[];
		kiosk: {
			name?: string;
			loopDuration?: number;
			locations: LocationInfo[];
		};
	} = $props();

	let events = $derived(items.filter((item) => 'startDateTime' in item) as Event[]);

	let pages = $derived.by(() => {
		const result: { location: LocationInfo; items: Event[] }[] = [];
		const ITEMS_PER_PAGE = 5;

		if (!kiosk?.locations || kiosk.locations.length === 0) {
			for (let i = 0; i < events.length; i += ITEMS_PER_PAGE) {
				result.push({
					location: { name: kiosk?.name || 'All Events' } as any,
					items: events.slice(i, i + ITEMS_PER_PAGE)
				});
			}
			return result;
		}

		for (const loc of kiosk.locations) {
			const locEvents = events.filter(
				(e) =>
					e.locationIds?.includes(loc.id) ||
					e.locations?.some(
						(l: any) => l.locationId === loc.id || l.location?.id === loc.id || l.id === loc.id
					)
			);
			if (locEvents.length === 0) continue;

			for (let i = 0; i < locEvents.length; i += ITEMS_PER_PAGE) {
				result.push({
					location: loc,
					items: locEvents.slice(i, i + ITEMS_PER_PAGE)
				});
			}
		}
		return result;
	});

	let currentPage = $state(0);
	let totalPages = $derived(pages.length);
	let safePageIndex = $derived(totalPages > 0 ? currentPage % totalPages : 0);
	let currentPageData = $derived(pages[safePageIndex]);

	let timer: ReturnType<typeof setInterval> | undefined;

	function startTimer() {
		clearInterval(timer);
		if (totalPages <= 1) return;
		timer = setInterval(() => {
			currentPage = (currentPage + 1) % totalPages;
		}, (kiosk.loopDuration || 5) * 1000);
	}

	$effect(() => {
		startTimer();
		return () => clearInterval(timer);
	});

	onDestroy(() => {
		clearInterval(timer);
	});

	function formatDate(dateStr: string | null) {
		if (!dateStr) return '---';
		return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: '2-digit' });
	}

	function formatTime(dateStr: string | null) {
		if (!dateStr) return '---';
		return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div
	class="hier-ci-scope w-full h-full flex flex-col text-white p-8 md:p-10 overflow-hidden select-none"
	style="background-color: {HIER_PALETTE.navy};"
>
	{#if currentPageData}
		<!-- Rich HIER. Location Header -->
		<div
			class="relative mb-6 rounded-2xl p-6 shrink-0 overflow-hidden shadow-lg"
			style="background-color: {HIER_PALETTE.primaryDigital};"
		>
			<div class="flex justify-between items-start gap-6">
				<div class="space-y-3 min-w-0 flex-1">
					<div class="flex items-center gap-5 flex-wrap">
						<HierLogo variant="white" subtitle="in Marzahn-Süd" neonRays={true} class="h-16 w-auto shrink-0" />
						<div class="h-12 w-1 bg-white/30 rounded-full hidden sm:block"></div>
						<h1
							class="text-4xl md:text-5xl font-black tracking-tight uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[52vw]"
						>
							{currentPageData.location.name}
						</h1>
					</div>

					<div class="flex flex-wrap gap-6 text-lg text-white/90 font-medium pt-1">
						{#if currentPageData.location.contact?.qrCodePath || currentPageData.location.contact?.qrCodeDataUrl}
							<div class="bg-white p-1.5 rounded-xl shadow-md shrink-0 self-start">
								<img
									src={currentPageData.location.contact.qrCodeDataUrl ||
										currentPageData.location.contact.qrCodePath}
									alt="Location QR"
									class="w-16 h-16"
								/>
							</div>
						{/if}

						{#if currentPageData.location.street}
							<div class="leading-snug">
								{currentPageData.location.street}
								{currentPageData.location.houseNumber || ''}<br />
								{currentPageData.location.zip || ''}
								{currentPageData.location.city || ''}
							</div>
						{/if}

						{#if currentPageData.location.openingHours}
							<div class="border-l border-white/25 pl-6 space-y-1">
								<span
									class="uppercase text-xs font-extrabold tracking-widest block"
									style="color: {HIER_PALETTE.neonYellow};"
								>
									{m.opening_hours?.() ?? 'Öffnungszeiten'}
								</span>
								<div class="text-white text-base font-medium whitespace-pre-line leading-snug">
									{formatOpeningHours(currentPageData.location.openingHours)}
								</div>
								{#if currentPageData.location.inclusivitySupport}
									<div
										class="text-sm font-bold flex items-center gap-1.5 mt-1"
										style="color: {HIER_PALETTE.neonGreen};"
									>
										<span
											class="w-2 h-2 rounded-full"
											style="background-color: {HIER_PALETTE.neonGreen};"
										></span>
										<span>{currentPageData.location.inclusivitySupport}</span>
									</div>
								{/if}
							</div>
						{/if}

						{#if currentPageData.location.contact}
							<div class="border-l border-white/25 pl-6 space-y-1">
								<span
									class="uppercase text-xs font-extrabold tracking-widest block"
									style="color: {HIER_PALETTE.neonYellow};"
								>
									{m.contact()}
								</span>
								<div class="text-white text-xl font-bold leading-tight flex items-center gap-2 flex-wrap">
									<span>{currentPageData.location.contact.name}</span>
									{#if currentPageData.location.contact.roles && currentPageData.location.contact.roles.length > 0}
										<span
											class="px-2 py-0.5 bg-white/20 text-white rounded-md text-xs font-bold uppercase tracking-wider"
										>
											{currentPageData.location.contact.roles[0]}
										</span>
									{:else if currentPageData.location.contact.role}
										<span
											class="px-2 py-0.5 bg-white/20 text-white rounded-md text-xs font-bold uppercase tracking-wider"
										>
											{currentPageData.location.contact.role}
										</span>
									{/if}
								</div>
								<div class="flex flex-wrap gap-x-5 text-white/80 text-base font-medium">
									{#if currentPageData.location.contact.email}
										<span>@ {currentPageData.location.contact.email}</span>
									{/if}
									{#if currentPageData.location.contact.phone}
										<span># {currentPageData.location.contact.phone}</span>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-4 shrink-0 bg-[#29235c]/45 px-5 py-3 rounded-2xl border border-white/20">
					<div class="text-right">
						<div class="text-sm font-extrabold uppercase tracking-widest text-[#ffec00]">
							{m.page_uppercase()}
						</div>
						<div class="text-5xl font-black">
							{safePageIndex + 1} <span class="text-white/40">/</span> {totalPages}
						</div>
					</div>
				</div>
			</div>

			<!-- 3-Color Neon Accent Bar -->
			<div class="absolute bottom-0 inset-x-0 h-1.5 flex">
				<div class="flex-1" style="background-color: {HIER_PALETTE.neonPink};"></div>
				<div class="flex-1" style="background-color: {HIER_PALETTE.neonYellow};"></div>
				<div class="flex-1" style="background-color: {HIER_PALETTE.neonGreen};"></div>
			</div>
		</div>

		<!-- Event Table -->
		<div class="flex-1 overflow-hidden">
			<table class="w-full text-left border-collapse table-fixed">
				<thead>
					<tr
						class="text-white/65 text-base uppercase tracking-[0.2em] font-black border-b border-white/15"
					>
						<th class="py-3 px-5 w-[13%]">{m.date()}</th>
						<th class="py-3 px-5 w-[11%]">{m.time()}</th>
						<th class="py-3 px-5 w-[44%]">{m.event_detail()}</th>
						<th class="py-3 px-5 w-[20%]">{m.tags()}</th>
						<th class="py-3 px-5 w-[12%] text-right">{m.qr()}</th>
					</tr>
				</thead>
				<tbody>
					{#key safePageIndex}
						{#each currentPageData.items as item, i (item.id || `${safePageIndex}_${i}`)}
							{@const eventRooms = getEventRooms(item)}
							{@const itemRecurrenceRule =
								(Array.isArray((item as any).recurrence)
									? (item as any).recurrence[0]
									: typeof (item as any).recurrence === 'string'
										? (item as any).recurrence
										: null) ||
								(item as any).seriesMaster?.recurrence?.[0] ||
								null}
							{@const displayPrice = formatTicketPrice(
								(item as any).ticketPrice,
								(item as any).ticketPriceUnknown,
								{ currency: (item as any).currency || 'EUR' }
							)}
							{@const isSpecialNonSeries = isNonSeriesEvent(item)}
							{@const multiDay = isMultiDayEvent(item)}
							{@const durationDays = multiDay ? getEventDurationDays(item) : 1}
							{@const dateParts = getEventDateParts(item)}
							<tr
								class="border-b border-white/10 transition-all duration-300 h-[11.5vh] min-h-[96px] {isSpecialNonSeries ? 'bg-[#6950fc]/25 border-l-4 border-l-[#ffec00]' : 'hover:bg-white/5'}"
								in:fly={{ x: 20, duration: 600, delay: i * 80 }}
							>
								<td class="py-3.5 px-5 align-middle">
									{#if multiDay}
										<div class="text-2xl lg:text-3xl font-black whitespace-nowrap text-[#ffec00]">
											{dateParts.startDay}.–{dateParts.endDay}.
										</div>
										<div class="text-xs font-bold uppercase tracking-wider text-white/80">
											{dateParts.startMonth}{dateParts.startMonth !== dateParts.endMonth
												? ` / ${dateParts.endMonth}`
												: ''} • {m.days_count({ count: durationDays })}
										</div>
									{:else}
										<div
											class="text-3xl font-black whitespace-nowrap {isSpecialNonSeries ? 'text-[#ffec00]' : 'text-white'}"
										>
											{formatDate(item.startDateTime)}
										</div>
									{/if}
								</td>
								<td class="py-3.5 px-5 align-middle">
									{#if multiDay}
										{#if (item as any).isAllDay}
											<div class="text-lg font-bold text-[#09cc86] whitespace-nowrap uppercase tracking-wider">
												{m.all_day_label()}
											</div>
										{:else}
											<div class="text-xl font-bold text-white whitespace-nowrap">
												{formatTime(item.startDateTime)}
											</div>
											{#if item.endDateTime}
												<div class="text-xs font-semibold text-white/65 whitespace-nowrap">
													→ {formatTime(item.endDateTime)}
												</div>
											{/if}
										{/if}
									{:else}
										<div class="text-2xl font-bold text-white/85 whitespace-nowrap">
											{formatTime(item.startDateTime)}
										</div>
									{/if}
								</td>
								<td class="py-3.5 px-5 align-middle">
									<div class="space-y-1.5 overflow-hidden">
										<div class="text-2xl lg:text-3xl font-black leading-tight line-clamp-2 flex flex-wrap items-center gap-3">
											{#if multiDay}
												<span
													class="inline-flex items-center gap-1.5 bg-[#6950fc] text-white text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0"
												>
													<Calendar class="w-3.5 h-3.5 text-[#ffec00]" />
													{m.multi_day_badge()} ({m.days_count({ count: durationDays })})
												</span>
											{/if}
											{#if (item as any).status === 'cancelled'}
												<span
													class="inline-block text-white text-sm font-black px-3 py-1 rounded-full uppercase tracking-widest shrink-0"
													style="background-color: {HIER_PALETTE.neonPink};"
												>
													{m.cancelled()}
												</span>
											{/if}
											<span
												class={(item as any).status === 'cancelled'
													? 'line-through opacity-50 text-white/60'
													: isSpecialNonSeries
														? 'text-[#ffec00]'
														: 'text-white'}
											>
												{item.summary || m.untitled_event().toUpperCase()}
											</span>
										</div>
										<div class="flex flex-wrap items-center gap-1.5">
											{#each eventRooms as roomName (roomName)}
												<div
													class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 rounded-md text-white text-sm font-bold"
												>
													<div class="w-1.5 h-1.5 rounded-full bg-[#09cc86]"></div>
													{roomName}
												</div>
											{/each}
											{#if displayPrice && !isEventFree((item as any).ticketPrice, (item as any).ticketPriceUnknown)}
												<div
													class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#09cc86]/20 border border-[#09cc86]/40 rounded-md text-[#09cc86] text-sm font-bold"
												>
													<Ticket class="w-3.5 h-3.5" />
													<span>{displayPrice}</span>
												</div>
											{/if}
											{#if itemRecurrenceRule}
												<div
													class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#6950fc]/35 border border-[#6950fc] rounded-md text-white text-sm font-semibold"
												>
													<RefreshCw class="w-3.5 h-3.5 text-[#ffec00]" />
													<span>{formatRecurrenceText(itemRecurrenceRule, { short: true })}</span>
												</div>
											{/if}
											{#if (item as any).resolvedContact}
												{@const c = (item as any).resolvedContact}
												<div
													class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-md text-white/90 text-xs font-medium"
												>
													<User class="w-3.5 h-3.5 text-[#ffec00]" />
													<span>{c.name}</span>
												</div>
											{/if}
										</div>
									</div>
								</td>
								<td class="py-3.5 px-5 align-middle">
									<div class="flex flex-wrap gap-1.5 max-h-[8vh] overflow-hidden">
										{#if (item as any).signUpMode === 'required'}
											{@const compactSignUp = getKioskSignUpText(item as any, {
												showQrCode: Boolean((item as any).qrCodeDataUrl || (item as any).qrCodePath)
											})}
											{#if compactSignUp}
												<span
													class="px-2.5 py-0.5 bg-[#ffec00]/20 border border-[#ffec00]/50 rounded-full text-[#ffec00] text-xs font-bold inline-flex items-center gap-1"
												>
													{compactSignUp}
												</span>
											{/if}
										{/if}
										{#if isEventFree((item as any).ticketPrice, (item as any).ticketPriceUnknown)}
											<span
												class="px-2.5 py-0.5 rounded-full text-[#222222] text-xs font-black uppercase tracking-wider inline-flex items-center gap-1"
												style="background-color: {HIER_PALETTE.neonGreen};"
											>
												<Ticket class="w-3 h-3" />
												{m.ticket_price_free?.() || 'Free'}
											</span>
										{/if}
										{#each (item.tags || []).slice(0, 3) as tag, tIdx (typeof tag === 'string' ? `${tag}_${tIdx}` : tag.id || tag.name || tIdx)}
											<span
												class="px-2.5 py-0.5 bg-white/15 border border-white/25 rounded-full text-white text-xs font-bold uppercase tracking-wider"
											>
												{tag.name || tag}
											</span>
										{/each}
									</div>
								</td>
								<td class="py-2.5 px-5 align-middle text-right shrink-0">
									{#if (item as any).qrCodeDataUrl || (item as any).qrCodePath}
										<div class="inline-block bg-white p-1.5 rounded-xl shadow-lg">
											<img
												src={(item as any).qrCodeDataUrl || (item as any).qrCodePath}
												alt="QR"
												class="w-20 h-20 md:w-22 md:h-22"
											/>
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					{/key}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="h-full flex flex-col items-center justify-center text-white/75 space-y-6">
			<HierLogo variant="white" subtitle="in Marzahn-Süd" neonRays={true} class="h-28 w-auto" />
			<p class="text-4xl font-black uppercase tracking-tight">{m.no_scheduled_events()}</p>
		</div>
	{/if}

	{#if totalPages > 1}
		<div class="mt-4 pt-4 flex justify-center items-center gap-3 shrink-0">
			{#each pages as _, i (i)}
				<div
					class="h-2 rounded-full transition-all duration-700 {i === safePageIndex ? 'w-16 bg-[#ffec00]' : 'w-2 bg-white/25'}"
				></div>
			{/each}
		</div>
	{/if}
</div>
