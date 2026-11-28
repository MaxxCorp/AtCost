<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { markLocalEntityMutation } from '@ac/ui';
	import * as m from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import {
		ShoppingCart,
		TrendingUp,
		ScanLine,
		Plus,
		Minus,
		Trash2,
		RefreshCw,
		CheckCircle2,
		AlertTriangle,
		PackagePlus,
		Printer,
		Code2,
		ExternalLink,
		Copy,
		Check,
		Sparkles,
		Layers,
		Receipt,
		History,
		QrCode,
		Upload,
		ChevronDown,
		ChevronUp
	} from '@lucide/svelte';
	import Button from '#lib/components/ui/button/button.svelte';
	import { formatCurrency } from '#lib/utils/price-menu.js';
	import type {
		InventoryRetrievalMode,
		PriceListScanResult,
		EventItemSalesSummary
	} from '@ac/validations';
	import {
		getEventShoppingList,
		getEventSales,
		recordSalesCommand,
		deleteSaleCommand,
		restockEventShoppingList,
		isPriceListScanAvailable,
		scanPriceListTallies
	} from '../../../routes/prices/sales.remote';
	import { readEvent, readEventLive } from '../../../routes/events/[id]/read.remote';
	import { listEvents, listEventsLive } from '../../../routes/events/list.remote';

	let {
		eventId,
		eventSummary = '',
		participantsCount = 1,
		eventCurrency = 'EUR',
		hasPrices = false
	}: {
		eventId?: string | null;
		eventSummary?: string;
		participantsCount?: number;
		eventCurrency?: string;
		hasPrices?: boolean;
	} = $props();

	type ActiveTab = 'financials' | 'shopping' | 'record' | 'scan' | 'pos_api';
	let activeTab = $state<ActiveTab>('financials');
	let showHistory = $state(false);
	let showOnlyShortfall = $state(false);
	let restockStorageLocation = $state('');
	let isRestocking = $state(false);
	let isRecordingSales = $state(false);
	let deletingSaleId = $state<string | null>(null);

	// Manual / POS entry state
	let retrievalMode = $state<InventoryRetrievalMode>('fifo');
	let replaceExistingSales = $state(false);
	let saleNotes = $state('');
	let manualQuantities = $state<Record<string, number>>({});

	// Gemini Scanner state
	let scanImageBase64 = $state<string | null>(null);
	let scanMimeType = $state<string>('image/jpeg');
	let scanPreviewUrl = $state<string | null>(null);
	let isScanning = $state(false);
	let scanResult = $state<PriceListScanResult | null>(null);
	let scannedQuantities = $state<Record<string, number>>({});
	let scanRetrievalMode = $state<InventoryRetrievalMode>('fifo');
	let scanReplaceExisting = $state(false);
	let detectedClientQr = $state<string | null>(null);

	// Copy state for POS API
	let copiedEndpoint = $state<string | null>(null);

	const retrievalModeOptions: {
		value: InventoryRetrievalMode;
		label: string;
		description: string;
	}[] = $derived([
		{
			value: 'fifo',
			label: m.inventory_mode_fifo(),
			description: m.inventory_mode_fifo_desc()
		},
		{
			value: 'fefo',
			label: m.inventory_mode_fefo(),
			description: m.inventory_mode_fefo_desc()
		},
		{
			value: 'lifo',
			label: m.inventory_mode_lifo(),
			description: m.inventory_mode_lifo_desc()
		},
		{
			value: 'lowest_cost',
			label: m.inventory_mode_lowest_cost(),
			description: m.inventory_mode_lowest_cost_desc()
		},
		{
			value: 'highest_cost',
			label: m.inventory_mode_highest_cost(),
			description: m.inventory_mode_highest_cost_desc()
		},
		{
			value: 'none',
			label: m.inventory_mode_none(),
			description: m.inventory_mode_none_desc()
		}
	]);

	// Remote Queries (using Svelte 5 .current reactivity per repository rules)
	const salesQuery = $derived(
		eventId
			? getEventSales({
					eventId,
					participantsCount: Math.max(1, Number(participantsCount) || 1)
				})
			: null
	);
	const shoppingQuery = $derived(
		eventId
			? getEventShoppingList({
					eventId,
					participantsCount: Math.max(1, Number(participantsCount) || 1)
				})
			: null
	);
	const scanAvailableQuery = isPriceListScanAvailable();

	const financials = $derived(salesQuery?.current ?? null);
	const shoppingList = $derived(shoppingQuery?.current ?? null);
	const currency = $derived(
		financials?.currency || shoppingList?.currency || eventCurrency || 'EUR'
	);

	const filteredShoppingItems = $derived.by(() => {
		const items = shoppingList?.items ?? [];
		if (!showOnlyShortfall) return items;
		return items.filter((item) => item.toBuyAmount > 0);
	});

	function getPortionPrice(item: EventItemSalesSummary): number {
		return Math.round((Number(item.unitPrice) || 0) * (Number(item.portionAmount) || 1) * 100) / 100;
	}

	function getPortionCost(item: EventItemSalesSummary): number {
		return Math.round((Number(item.baseCostPrice) || 0) * (Number(item.portionAmount) || 1) * 100) / 100;
	}

	const manualDraftSummary = $derived.by(() => {
		const items = financials?.itemSummaries ?? [];
		let totalPortions = 0;
		let estRevenue = 0;
		let estCost = 0;
		for (const item of items) {
			const qty = Number(manualQuantities[item.priceItemId] || 0);
			if (qty > 0) {
				totalPortions += qty;
				estRevenue += qty * getPortionPrice(item);
				estCost += qty * getPortionCost(item);
			}
		}
		return {
			totalPortions,
			estRevenue: Math.round(estRevenue * 100) / 100,
			estCost: Math.round(estCost * 100) / 100,
			estProfit: Math.round((estRevenue - estCost) * 100) / 100
		};
	});

	const scannedDraftSummary = $derived.by(() => {
		const items = financials?.itemSummaries ?? [];
		let totalPortions = 0;
		let estRevenue = 0;
		let estCost = 0;
		for (const item of items) {
			const qty = Number(scannedQuantities[item.priceItemId] || 0);
			if (qty > 0) {
				totalPortions += qty;
				estRevenue += qty * getPortionPrice(item);
				estCost += qty * getPortionCost(item);
			}
		}
		return {
			totalPortions,
			estRevenue: Math.round(estRevenue * 100) / 100,
			estCost: Math.round(estCost * 100) / 100,
			estProfit: Math.round((estRevenue - estCost) * 100) / 100
		};
	});

	async function refreshAll() {
		await Promise.all([salesQuery?.refresh(), shoppingQuery?.refresh()]);
	}

	function setManualQuantity(priceItemId: string, value: number) {
		const clean = Math.max(0, Math.round(Number(value) * 100) / 100);
		manualQuantities = {
			...manualQuantities,
			[priceItemId]: clean
		};
	}

	function adjustManualQuantity(priceItemId: string, delta: number) {
		const current = Number(manualQuantities[priceItemId] || 0);
		setManualQuantity(priceItemId, Math.max(0, current + delta));
	}

	function prefillManualFromExistingSales() {
		if (!financials) return;
		const next: Record<string, number> = {};
		for (const item of financials.itemSummaries) {
			next[item.priceItemId] = item.soldQuantity;
		}
		manualQuantities = next;
		replaceExistingSales = true;
	}

	async function handleRecordManualSales() {
		if (!eventId || !financials) return;
		const entries = financials.itemSummaries
			.map((item) => ({
				priceItemId: item.priceItemId,
				quantity: Number(manualQuantities[item.priceItemId] || 0)
			}))
			.filter((e) => e.quantity > 0);

		if (entries.length === 0) {
			toast.error(m.sales_enter_qty_toast());
			return;
		}

		isRecordingSales = true;
		try {
			markLocalEntityMutation('event', [eventId]);
			await recordSalesCommand({
				eventId,
				retrievalMode,
				deductInventory: retrievalMode !== 'none',
				mode: replaceExistingSales ? 'replace' : 'append',
				source: 'manual',
				notes: saleNotes.trim() || undefined,
				items: entries
			}).updates(getEventSales, getEventShoppingList, readEvent, readEventLive, listEvents, listEventsLive);
			manualQuantities = {};
			saleNotes = '';
			activeTab = 'financials';
			toast.success(m.sales_recorded_toast());
		} catch (err: any) {
			toast.error(err?.message || m.sales_record_failed_toast());
		} finally {
			isRecordingSales = false;
		}
	}

	async function handleDeleteSale(saleId: string) {
		if (!eventId) return;
		if (!window.confirm(m.sales_delete_confirm())) return;
		deletingSaleId = saleId;
		try {
			markLocalEntityMutation('event', [eventId]);
			await deleteSaleCommand({
				eventId,
				saleId,
				restoreInventory: true
			}).updates(getEventSales, getEventShoppingList, readEvent, readEventLive, listEvents, listEventsLive);
			toast.success(m.sales_deleted_toast());
		} catch (err: any) {
			toast.error(err?.message || m.sales_delete_failed_toast());
		} finally {
			deletingSaleId = null;
		}
	}

	async function handleRestockShortfall() {
		if (!eventId || !shoppingList) return;
		const shortfallItems = shoppingList.items.filter((i) => i.toBuyAmount > 0);
		if (shortfallItems.length === 0) {
			toast.info(m.shopping_all_in_stock_toast());
			return;
		}

		isRestocking = true;
		try {
			markLocalEntityMutation('event', [eventId]);
			const res = await restockEventShoppingList({
				eventId,
				items: shortfallItems.map((item) => ({
					consumableId: item.consumableId,
					name: item.name,
					amount: item.toBuyAmount,
					unit: item.unit,
					purchasePrice: item.estimatedPurchaseCost,
					currency: item.currency,
					storageLocation: restockStorageLocation.trim() || undefined
				}))
			}).updates(getEventSales, getEventShoppingList, readEvent, readEventLive, listEvents, listEventsLive);
			toast.success(m.shopping_restocked_toast({ count: res.insertedCount }));
		} catch (err: any) {
			toast.error(err?.message || m.shopping_restock_failed_toast());
		} finally {
			isRestocking = false;
		}
	}

	function printShoppingList() {
		if (!shoppingList) return;
		const win = window.open('', '_blank', 'width=850,height=900');
		if (!win) {
			window.print();
			return;
		}
		const inStockLabel = m.shopping_in_stock_short();
		const rowsHtml = shoppingList.items
			.map(
				(item) => `
				<tr>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${item.name}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;">${item.usages.map((u) => `${u.priceItemName} (${u.priceListName})`).join(', ')}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${item.requiredTotal} ${item.unit}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${item.inStockValid} ${item.unit}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;font-weight:700;color:${item.toBuyAmount > 0 ? '#b45309' : '#047857'};">${item.toBuyAmount > 0 ? `${item.toBuyAmount} ${item.unit}` : inStockLabel}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${formatCurrency(item.estimatedPurchaseCost, shoppingList.currency)}</td>
				</tr>`
			)
			.join('');

		win.document.write(`<!doctype html>
<html>
<head>
	<title>${m.sales_tab_shopping()} – ${shoppingList.eventSummary}</title>
	<style>
		body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111827; }
		h1 { margin: 0 0 4px; font-size: 22px; }
		p.meta { margin: 0 0 16px; color: #4b5563; font-size: 13px; }
		table { width: 100%; border-collapse: collapse; margin-top: 12px; }
		th { text-align: left; padding: 8px; border-bottom: 2px solid #111827; font-size: 12px; text-transform: uppercase; color: #374151; }
		.total { margin-top: 16px; text-align: right; font-size: 16px; font-weight: 700; }
	</style>
</head>
<body>
	<h1>${m.sales_tab_shopping()}: ${shoppingList.eventSummary}</h1>
	<p class="meta">${m.shopping_print_meta({ count: shoppingList.participantsCount, id: shoppingList.eventId.slice(0, 8) })}</p>
	<table>
		<thead>
			<tr>
				<th>${m.shopping_col_ingredient()}</th>
				<th>${m.shopping_col_used_in()}</th>
				<th style="text-align:right">${m.shopping_col_required()}</th>
				<th style="text-align:right">${m.shopping_print_col_in_stock()}</th>
				<th style="text-align:right">${m.shopping_print_col_to_buy()}</th>
				<th style="text-align:right">${m.shopping_print_col_est_cost()}</th>
			</tr>
		</thead>
		<tbody>${rowsHtml}</tbody>
	</table>
	<div class="total">${m.shopping_print_total()} ${formatCurrency(shoppingList.totalEstimatedPurchaseCost, shoppingList.currency)}</div>
	<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`);
		win.document.close();
	}

	async function handleScanFileSelect(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.error(m.tally_scan_invalid_image_toast());
			return;
		}

		scanMimeType = file.type || 'image/jpeg';
		detectedClientQr = null;

		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});

		scanPreviewUrl = dataUrl;
		const commaIdx = dataUrl.indexOf(',');
		scanImageBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

		// Optional browser-native QR detection if BarcodeDetector is available
		try {
			if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
				const img = new Image();
				img.src = dataUrl;
				await new Promise((r) => (img.onload = r));
				const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
				const codes = await detector.detect(img);
				if (codes && codes.length > 0 && codes[0]?.rawValue) {
					detectedClientQr = String(codes[0].rawValue);
				}
			}
		} catch {
			// Fallback to Gemini QR/ID detection
		}

		await runGeminiScan();
	}

	async function runGeminiScan() {
		if (!eventId || !scanImageBase64) return;
		isScanning = true;
		try {
			const res = await scanPriceListTallies({
				eventId,
				imageBase64: scanImageBase64,
				mimeType: scanMimeType
			});
			if (!res.success) {
				toast.error(res.error || m.tally_scan_failed_toast());
				return;
			}
			scanResult = res.data;
			const nextQuantities: Record<string, number> = {};
			for (const item of res.data.items) {
				nextQuantities[item.priceItemId] = item.countedMarks;
			}
			scannedQuantities = nextQuantities;
			toast.success(m.tally_scan_success_toast());
		} catch (err: any) {
			toast.error(err?.message || m.tally_scan_failed_toast());
		} finally {
			isScanning = false;
		}
	}

	async function handleConfirmScannedSales() {
		if (!eventId || !financials) return;
		const entries = financials.itemSummaries
			.map((item) => ({
				priceItemId: item.priceItemId,
				quantity: Number(scannedQuantities[item.priceItemId] || 0)
			}))
			.filter((e) => e.quantity > 0);

		if (entries.length === 0) {
			toast.error(m.tally_scan_no_items_toast());
			return;
		}

		isRecordingSales = true;
		try {
			markLocalEntityMutation('event', [eventId]);
			await recordSalesCommand({
				eventId,
				retrievalMode: scanRetrievalMode,
				deductInventory: scanRetrievalMode !== 'none',
				mode: scanReplaceExisting ? 'replace' : 'append',
				source: 'scan',
				notes: scanResult?.rawNotes
					? m.tally_scan_gemini_note({ notes: scanResult.rawNotes })
					: m.tally_scan_default_note(),
				items: entries
			}).updates(getEventSales, getEventShoppingList, readEvent, readEventLive, listEvents, listEventsLive);
			scanResult = null;
			scanPreviewUrl = null;
			scanImageBase64 = null;
			scannedQuantities = {};
			activeTab = 'financials';
			toast.success(m.tally_scan_recorded_toast());
		} catch (err: any) {
			toast.error(err?.message || m.tally_scan_record_failed_toast());
		} finally {
			isRecordingSales = false;
		}
	}

	async function copyText(key: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedEndpoint = key;
			toast.success(m.copied_to_clipboard());
			setTimeout(() => {
				if (copiedEndpoint === key) copiedEndpoint = null;
			}, 2000);
		} catch {
			toast.error(m.failed_to_copy());
		}
	}

	const qrVerificationStatus = $derived.by(() => {
		if (!eventId) return null;
		const shortId = eventId.slice(0, 8).toLowerCase();
		const qrText = (detectedClientQr || scanResult?.detectedEventId || '').toLowerCase();
		if (!qrText) return null;
		const matches = qrText.includes(shortId) || qrText.includes(eventId.toLowerCase());
		return {
			matches,
			raw: detectedClientQr || scanResult?.detectedEventId || ''
		};
	});
</script>

{#if !eventId}
	<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 flex items-center gap-2">
		<AlertTriangle size={16} class="shrink-0 text-amber-600" />
		<span>{m.sales_save_event_first()}</span>
	</div>
{:else if hasPrices || (financials && financials.itemSummaries.length > 0)}
	<div class="mt-3 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
		<!-- Top Financial Result Banner (Directly below Total Price Calculation) -->
		<div class="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="space-y-0.5">
					<div class="flex items-center gap-2">
						<TrendingUp size={18} class="text-emerald-400" />
						<h4 class="text-sm sm:text-base font-bold tracking-tight">
							{m.sales_workflow_title()}
						</h4>
						{#if financials && financials.salesHistory.length > 0}
							<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
								{m.sales_portions_sold_badge({ count: financials.totalPortionsSold })}
							</span>
						{:else}
							<span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300">
								{m.sales_no_sales_yet()}
							</span>
						{/if}
					</div>
					<p class="text-xs text-slate-300">
						{m.sales_workflow_subtitle({ count: participantsCount })}
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={refreshAll}
						class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
						title={m.sales_refresh_title()}
					>
						<RefreshCw size={13} class={salesQuery?.loading || shoppingQuery?.loading ? 'animate-spin' : ''} />
						<span>{m.refresh()}</span>
					</button>
				</div>
			</div>

			{#if financials}
				<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">{m.sales_actual_revenue()}</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono text-white">
							{formatCurrency(financials.actualTotalRevenue, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							{m.sales_planned_label()} <span class="font-mono">{formatCurrency(financials.plannedTotalRevenue, currency)}</span> ({financials.revenueAttainmentPercent}%)
						</div>
					</div>

					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">{m.sales_actual_cogs()}</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono text-amber-300">
							{formatCurrency(financials.actualTotalCost, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							{m.sales_planned_cost_label()} <span class="font-mono">{formatCurrency(financials.plannedTotalCost, currency)}</span>
						</div>
					</div>

					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">{m.sales_actual_net_profit()}</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono {financials.actualTotalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">
							{financials.actualTotalProfit >= 0 ? '+' : ''}{formatCurrency(financials.actualTotalProfit, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							{m.sales_margin_label()} <span class="font-mono font-semibold text-emerald-300">{financials.actualMarginPercent}%</span> ({m.sales_planned_short()} {formatCurrency(financials.plannedTotalProfit, currency)})
						</div>
					</div>

					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">{m.sales_shopping_shortfall()}</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono text-sky-300">
							{formatCurrency(shoppingList?.totalEstimatedPurchaseCost ?? 0, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							{m.sales_ingredients_to_buy({ toBuy: shoppingList?.itemsToBuyCount ?? 0, total: shoppingList?.totalRequiredItemsCount ?? 0 })}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Navigation Tabs -->
		<div class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2">
			<button
				type="button"
				onclick={() => (activeTab = 'financials')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'financials'
					? 'border-emerald-600 bg-white text-emerald-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<TrendingUp size={14} />
				<span>{m.sales_tab_financials()}</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'shopping')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'shopping'
					? 'border-emerald-600 bg-white text-emerald-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<ShoppingCart size={14} />
				<span>{m.sales_tab_shopping()}</span>
				{#if (shoppingList?.itemsToBuyCount ?? 0) > 0}
					<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
						{shoppingList?.itemsToBuyCount}
					</span>
				{/if}
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'record')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'record'
					? 'border-emerald-600 bg-white text-emerald-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<Layers size={14} />
				<span>{m.sales_tab_record()}</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'scan')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'scan'
					? 'border-violet-600 bg-white text-violet-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<ScanLine size={14} />
				<span>{m.sales_tab_scan()}</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'pos_api')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'pos_api'
					? 'border-blue-600 bg-white text-blue-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<Code2 size={14} />
				<span>{m.sales_tab_pos_api()}</span>
			</button>
		</div>

		<!-- Tab Panels -->
		<div class="p-4 sm:p-5">
			{#if activeTab === 'financials'}
				{#if salesQuery?.loading && !financials}
					<div class="py-8 text-center text-sm text-slate-500">{m.sales_loading_financials()}</div>
				{:else if financials}
					<div class="space-y-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<h5 class="text-sm font-bold text-slate-900">{m.sales_breakdown_title()}</h5>
								<p class="text-xs text-slate-500">
									{m.sales_breakdown_subtitle({ count: financials.participantsCount })}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (activeTab = 'record')}
									class="h-8 text-xs"
								>
									<Plus size={13} class="mr-1" /> {m.sales_record_btn()}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (activeTab = 'scan')}
									class="h-8 text-xs text-violet-700 border-violet-200 hover:bg-violet-50"
								>
									<ScanLine size={13} class="mr-1" /> {m.sales_scan_tally_btn()}
								</Button>
							</div>
						</div>

						<div class="overflow-x-auto rounded-xl border border-slate-200">
							<table class="w-full text-left text-xs">
								<thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
									<tr>
										<th class="py-2.5 px-3 font-semibold">{m.item_label()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_portion_price()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_planned()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_sold()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_actual_revenue()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_actual_cogs()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_net_profit()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_stock_avail()}</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each financials.itemSummaries as item (item.priceItemId)}
										<tr class="hover:bg-slate-50/80">
											<td class="py-2.5 px-3">
												<div class="font-semibold text-slate-900">{item.name}</div>
												<div class="text-[11px] text-slate-500">{item.priceListName} • {item.portionAmount} {item.unit || m.unit_fallback()}</div>
											</td>
											<td class="py-2.5 px-3 text-right font-mono text-slate-700">
												{formatCurrency(getPortionPrice(item), currency)}
											</td>
											<td class="py-2.5 px-3 text-right font-mono text-slate-500">
												{item.plannedQuantity} ({formatCurrency(item.plannedRevenue, currency)})
											</td>
											<td class="py-2.5 px-3 text-right font-mono font-bold {item.soldQuantity > 0 ? 'text-emerald-700' : 'text-slate-400'}">
												{item.soldQuantity}
											</td>
											<td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
												{formatCurrency(item.actualRevenue, currency)}
											</td>
											<td class="py-2.5 px-3 text-right font-mono text-amber-700">
												{formatCurrency(item.actualCost, currency)}
											</td>
											<td class="py-2.5 px-3 text-right font-mono font-bold {item.actualProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}">
												{item.actualProfit >= 0 ? '+' : ''}{formatCurrency(item.actualProfit, currency)}
											</td>
											<td class="py-2.5 px-3 text-right font-mono">
												{#if item.availablePortionsInStock <= 0}
													<span class="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-semibold">{m.sales_stock_zero()}</span>
												{:else}
													<span class="text-slate-700">{m.sales_stock_portions({ count: item.availablePortionsInStock })}</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot class="bg-slate-50 font-semibold border-t border-slate-200 text-slate-900">
									<tr>
										<td class="py-2.5 px-3" colspan="2">{m.sales_total_financial_result()}</td>
										<td class="py-2.5 px-3 text-right font-mono text-slate-600">
											{formatCurrency(financials.plannedTotalRevenue, currency)}
										</td>
										<td class="py-2.5 px-3 text-right font-mono text-emerald-700">
											{financials.totalPortionsSold}
										</td>
										<td class="py-2.5 px-3 text-right font-mono">
											{formatCurrency(financials.actualTotalRevenue, currency)}
										</td>
										<td class="py-2.5 px-3 text-right font-mono text-amber-800">
											{formatCurrency(financials.actualTotalCost, currency)}
										</td>
										<td class="py-2.5 px-3 text-right font-mono text-emerald-700">
											{financials.actualTotalProfit >= 0 ? '+' : ''}{formatCurrency(financials.actualTotalProfit, currency)} ({financials.actualMarginPercent}%)
										</td>
										<td></td>
									</tr>
								</tfoot>
							</table>
						</div>

						<!-- Sales History Log -->
						{#if financials.salesHistory.length > 0}
							<div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
								<button
									type="button"
									onclick={() => (showHistory = !showHistory)}
									class="flex w-full items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
								>
									<span class="flex items-center gap-1.5">
										<History size={14} class="text-slate-500" />
										{m.sales_history_title({ count: financials.salesHistory.length })}
									</span>
									{#if showHistory}
										<ChevronUp size={15} />
									{:else}
										<ChevronDown size={15} />
									{/if}
								</button>

								{#if showHistory}
									<div class="mt-3 space-y-2">
										{#each financials.salesHistory as sale (sale.id)}
											<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
												<div class="space-y-0.5">
													<div class="flex items-center gap-2 flex-wrap">
														<span class="font-semibold text-slate-900">{sale.itemName}</span>
														<span class="font-mono font-bold text-emerald-700">× {sale.quantity}</span>
														<span class="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
															{sale.source === 'pos' ? m.sale_source_pos() : sale.source === 'scan' ? m.sale_source_scan() : m.sale_source_manual()}
														</span>
														<span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
															{m.sales_stock_mode_badge({ mode: sale.retrievalMode.toUpperCase() })}
														</span>
													</div>
													<div class="text-[11px] text-slate-500">
														{new Date(sale.createdAt).toLocaleString(getLocale())}
														{#if sale.notes}
															• {sale.notes}
														{/if}
													</div>
												</div>

												<div class="flex items-center gap-3">
													<div class="text-right font-mono">
														<div class="font-semibold text-slate-900">{m.sales_rev_short()} {formatCurrency(sale.totalRevenue, currency)}</div>
														<div class="text-[11px] text-amber-700">{m.sales_cogs_short()} {formatCurrency(sale.totalCost, currency)}</div>
													</div>
													<button
														type="button"
														disabled={deletingSaleId === sale.id}
														onclick={() => handleDeleteSale(sale.id)}
														class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
														title={m.sales_delete_title()}
													>
														<Trash2 size={14} />
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

			{:else if activeTab === 'shopping'}
				{#if shoppingQuery?.loading && !shoppingList}
					<div class="py-8 text-center text-sm text-slate-500">{m.shopping_computing()}</div>
				{:else if shoppingList}
					<div class="space-y-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h5 class="text-sm font-bold text-slate-900">
									{m.shopping_title({ count: shoppingList.participantsCount })}
								</h5>
								<p class="text-xs text-slate-500">
									{m.shopping_subtitle()}
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer mr-2">
									<input
										type="checkbox"
										class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
										checked={showOnlyShortfall}
										onchange={(e) => (showOnlyShortfall = e.currentTarget.checked)}
									/>
									<span>{m.shopping_only_shortfall({ count: shoppingList.itemsToBuyCount })}</span>
								</label>

								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={printShoppingList}
									class="h-8 text-xs"
								>
									<Printer size={13} class="mr-1.5" /> {m.shopping_print_btn()}
								</Button>
							</div>
						</div>

						{#if shoppingList.items.length === 0}
							<div class="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
								{m.shopping_empty()}
							</div>
						{:else}
							<div class="overflow-x-auto rounded-xl border border-slate-200">
								<table class="w-full text-left text-xs">
									<thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
										<tr>
											<th class="py-2.5 px-3 font-semibold">{m.shopping_col_ingredient()}</th>
											<th class="py-2.5 px-3 font-semibold">{m.shopping_col_used_in()}</th>
											<th class="py-2.5 px-3 font-semibold text-right">{m.shopping_col_required()}</th>
											<th class="py-2.5 px-3 font-semibold text-right">{m.shopping_col_in_stock()}</th>
											<th class="py-2.5 px-3 font-semibold text-right">{m.shopping_col_to_buy()}</th>
											<th class="py-2.5 px-3 font-semibold text-right">{m.shopping_col_est_cost()}</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100">
										{#each filteredShoppingItems as item (item.key)}
											<tr class="hover:bg-slate-50/80">
												<td class="py-2.5 px-3">
													<div class="font-semibold text-slate-900">{item.name}</div>
													{#if item.inStockExpired > 0}
														<div class="text-[11px] text-amber-600">
															{m.shopping_expired_excluded({ amount: item.inStockExpired, unit: item.unit })}
														</div>
													{/if}
												</td>
												<td class="py-2.5 px-3 text-slate-600">
													<div class="flex flex-wrap gap-1">
														{#each item.usages as src, idx (idx)}
															<span class="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700">
																{src.priceItemName} ({src.priceListName}): {src.totalAmountForEvent} {item.unit}
															</span>
														{/each}
													</div>
												</td>
												<td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
													{item.requiredTotal} {item.unit}
												</td>
												<td class="py-2.5 px-3 text-right font-mono text-slate-700">
													{item.inStockValid} {item.unit}
												</td>
												<td class="py-2.5 px-3 text-right font-mono font-bold">
													{#if item.toBuyAmount > 0}
														<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
															{item.toBuyAmount} {item.unit}
														</span>
													{:else}
														<span class="inline-flex items-center gap-1 text-emerald-700">
															<CheckCircle2 size={13} /> {m.shopping_covered()}
														</span>
													{/if}
												</td>
												<td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
													{item.toBuyAmount > 0 ? formatCurrency(item.estimatedPurchaseCost, currency) : '—'}
												</td>
											</tr>
										{/each}
									</tbody>
									<tfoot class="bg-slate-50 font-semibold border-t border-slate-200">
										<tr>
											<td colspan="4" class="py-2.5 px-3 text-slate-700">
												{m.shopping_total_restock_cost({ count: shoppingList.itemsToBuyCount })}
											</td>
											<td colspan="2" class="py-2.5 px-3 text-right font-mono text-sm text-amber-900">
												{formatCurrency(shoppingList.totalEstimatedPurchaseCost, currency)}
											</td>
										</tr>
									</tfoot>
								</table>
							</div>

							{#if shoppingList.itemsToBuyCount > 0}
								<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
									<div class="space-y-0.5">
										<div class="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
											<PackagePlus size={15} class="text-emerald-700" />
											{m.shopping_restock_title()}
										</div>
										<p class="text-[11px] text-emerald-800">
											{m.shopping_restock_desc({ count: shoppingList.itemsToBuyCount })}
										</p>
									</div>
									<div class="flex flex-wrap items-center gap-2">
										<input
											type="text"
											placeholder={m.shopping_restock_location_placeholder()}
											value={restockStorageLocation}
											oninput={(e) => (restockStorageLocation = e.currentTarget.value)}
											class="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
										/>
										<Button
											type="button"
											size="sm"
											disabled={isRestocking}
											onclick={handleRestockShortfall}
											class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
										>
											<PackagePlus size={14} class="mr-1.5" />
											{isRestocking ? m.shopping_restocking() : m.shopping_restock_btn({ count: shoppingList.itemsToBuyCount })}
										</Button>
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/if}

			{:else if activeTab === 'record'}
				{#if financials}
					<div class="space-y-4">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
							<div class="space-y-1.5">
								<span class="block text-xs font-bold text-slate-800">
									{m.sales_retrieval_mode_label()}
								</span>
								<select
									value={retrievalMode}
									onchange={(e) => (retrievalMode = e.currentTarget.value as InventoryRetrievalMode)}
									class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
								>
									{#each retrievalModeOptions as opt (opt.value)}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
								<p class="text-[11px] text-slate-500">
									{retrievalModeOptions.find((o) => o.value === retrievalMode)?.description}
								</p>
							</div>

							<div class="space-y-2">
								<span class="block text-xs font-bold text-slate-800">{m.sales_recording_mode_label()}</span>
								<div class="flex flex-wrap items-center gap-3">
									<label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
										<input
											type="checkbox"
											checked={replaceExistingSales}
											onchange={(e) => (replaceExistingSales = e.currentTarget.checked)}
											class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
										/>
										<span>{m.sales_replace_previous()}</span>
									</label>
									<button
										type="button"
										onclick={prefillManualFromExistingSales}
										class="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
									>
										{m.sales_load_current_counts()}
									</button>
								</div>
								<input
									type="text"
									placeholder={m.sales_notes_placeholder()}
									value={saleNotes}
									oninput={(e) => (saleNotes = e.currentTarget.value)}
									class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
								/>
							</div>
						</div>

						<div class="overflow-x-auto rounded-xl border border-slate-200">
							<table class="w-full text-left text-xs">
								<thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
									<tr>
										<th class="py-2.5 px-3 font-semibold">{m.item_label()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_portion_price()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_already_sold()}</th>
										<th class="py-2.5 px-3 font-semibold text-center">{m.sales_col_qty_to_record()}</th>
										<th class="py-2.5 px-3 font-semibold text-right">{m.sales_col_line_revenue()}</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each financials.itemSummaries as item (item.priceItemId)}
										{@const qty = Number(manualQuantities[item.priceItemId] || 0)}
										<tr class="hover:bg-slate-50/80">
											<td class="py-2.5 px-3">
												<div class="font-semibold text-slate-900">{item.name}</div>
												<div class="text-[11px] text-slate-500">
													{item.priceListName} • {m.sales_stock_inline({ count: item.availablePortionsInStock })}
												</div>
											</td>
											<td class="py-2.5 px-3 text-right font-mono text-slate-700">
												{formatCurrency(getPortionPrice(item), currency)}
											</td>
											<td class="py-2.5 px-3 text-right font-mono text-slate-500">
												{item.soldQuantity}
											</td>
											<td class="py-2.5 px-3">
												<div class="flex items-center justify-center gap-1">
													<button
														type="button"
														onclick={() => adjustManualQuantity(item.priceItemId, -1)}
														class="h-7 w-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
													>
														<Minus size={12} />
													</button>
													<input
														type="number"
														min="0"
														step="1"
														value={qty}
														oninput={(e) => setManualQuantity(item.priceItemId, Number(e.currentTarget.value))}
														class="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs font-bold"
													/>
													<button
														type="button"
														onclick={() => adjustManualQuantity(item.priceItemId, 1)}
														class="h-7 w-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
													>
														<Plus size={12} />
													</button>
													<button
														type="button"
														onclick={() => adjustManualQuantity(item.priceItemId, 5)}
														class="px-2 h-7 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-[11px] font-mono font-semibold text-slate-700 cursor-pointer"
													>
														+5
													</button>
												</div>
											</td>
											<td class="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
												{qty > 0 ? formatCurrency(qty * getPortionPrice(item), currency) : '—'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
							<div class="text-xs text-emerald-950">
								<span class="font-bold">{m.sales_portions_selected({ count: manualDraftSummary.totalPortions })}</span> {m.sales_selected_suffix()} •
								{m.sales_est_revenue()} <span class="font-mono font-bold">{formatCurrency(manualDraftSummary.estRevenue, currency)}</span> •
								{m.sales_est_profit()} <span class="font-mono font-bold text-emerald-700">+{formatCurrency(manualDraftSummary.estProfit, currency)}</span>
							</div>
							<Button
								type="button"
								disabled={isRecordingSales || manualDraftSummary.totalPortions <= 0}
								onclick={handleRecordManualSales}
								class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
							>
								<Receipt size={14} class="mr-1.5" />
								{isRecordingSales ? m.sales_recording_btn() : m.sales_record_submit_btn()}
							</Button>
						</div>
					</div>
				{/if}

			{:else if activeTab === 'scan'}
				<div class="space-y-4">
					<div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
						<div class="space-y-1 max-w-2xl">
							<div class="flex items-center gap-2">
								<Sparkles size={16} class="text-violet-600" />
								<h5 class="text-sm font-bold text-violet-950">
									{m.tally_scan_title()}
								</h5>
							</div>
							<p class="text-xs text-violet-800">
								{m.tally_scan_desc()}
							</p>
						</div>

						<div class="flex items-center gap-2">
							<label class="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer">
								<Upload size={14} />
								<span>{isScanning ? m.tally_scan_scanning() : m.tally_scan_upload_btn()}</span>
								<input
									type="file"
									accept="image/*"
									capture="environment"
									class="hidden"
									disabled={isScanning}
									onchange={(e) => handleScanFileSelect(e.currentTarget)}
								/>
							</label>
						</div>
					</div>

					{#if scanAvailableQuery.current === false}
						<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
							{m.tally_scan_api_key_missing({ envVar: 'GEMINI_API_KEY' })}
						</div>
					{/if}

					{#if isScanning}
						<div class="flex flex-col items-center justify-center py-10 space-y-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/30">
							<RefreshCw size={24} class="animate-spin text-violet-600" />
							<p class="text-xs font-semibold text-violet-900">{m.tally_scan_analyzing()}</p>
						</div>
					{/if}

					{#if scanResult && financials}
						<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
							{#if scanPreviewUrl}
								<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
									<div class="text-xs font-bold text-slate-700 flex items-center justify-between">
										<span>{m.tally_scan_preview_title()}</span>
										<button
											type="button"
											onclick={runGeminiScan}
											class="text-[11px] text-violet-700 hover:underline cursor-pointer"
										>
											{m.tally_scan_rescan()}
										</button>
									</div>
									<img
										src={scanPreviewUrl}
										alt={m.tally_scan_preview_title()}
										class="w-full max-h-80 object-contain rounded-lg border border-slate-200 bg-white"
									/>
									{#if qrVerificationStatus}
										<div class="p-2 rounded-lg text-[11px] flex items-center gap-1.5 {qrVerificationStatus.matches ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}">
											<QrCode size={14} class="shrink-0" />
											{#if qrVerificationStatus.matches}
												<span>{m.tally_scan_qr_verified({ id: eventId.slice(0, 8) })}</span>
											{:else}
												<span>{m.tally_scan_qr_mismatch({ detected: qrVerificationStatus.raw, expected: eventId.slice(0, 8) })}</span>
											{/if}
										</div>
									{/if}
									{#if scanResult.rawNotes}
										<p class="text-[11px] text-slate-600 italic">{scanResult.rawNotes}</p>
									{/if}
								</div>
							{/if}

							<div class="{scanPreviewUrl ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3">
								<div class="overflow-x-auto rounded-xl border border-slate-200">
									<table class="w-full text-left text-xs">
										<thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
											<tr>
												<th class="py-2 px-3 font-semibold">{m.item_label()}</th>
												<th class="py-2 px-3 font-semibold">{m.tally_scan_col_marks()}</th>
												<th class="py-2 px-3 font-semibold text-center">{m.tally_scan_col_confidence()}</th>
												<th class="py-2 px-3 font-semibold text-center">{m.tally_scan_col_counted()}</th>
												<th class="py-2 px-3 font-semibold text-right">{m.tally_scan_col_revenue()}</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each financials.itemSummaries as item (item.priceItemId)}
												{@const scannedItem = scanResult.items.find((s) => s.priceItemId === item.priceItemId)}
												{@const qty = Number(scannedQuantities[item.priceItemId] || 0)}
												<tr>
													<td class="py-2 px-3 font-semibold text-slate-900">
														{item.name}
													</td>
													<td class="py-2 px-3 text-[11px] text-slate-600">
														{scannedItem?.markBreakdown || m.tally_scan_no_marks()}
													</td>
													<td class="py-2 px-3 text-center">
														{#if scannedItem}
															<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {scannedItem.confidence === 'high' ? 'bg-emerald-50 text-emerald-700' : scannedItem.confidence === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}">
																{scannedItem.confidence === 'high' ? m.tally_scan_confidence_high() : scannedItem.confidence === 'medium' ? m.tally_scan_confidence_medium() : m.tally_scan_confidence_low()}
															</span>
														{/if}
													</td>
													<td class="py-2 px-3 text-center">
														<input
															type="number"
															min="0"
															step="1"
															value={qty}
															oninput={(e) => {
																scannedQuantities = {
																	...scannedQuantities,
																	[item.priceItemId]: Math.max(0, Number(e.currentTarget.value))
																};
															}}
															class="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs font-bold"
														/>
													</td>
													<td class="py-2 px-3 text-right font-mono font-semibold text-slate-900">
														{formatCurrency(qty * getPortionPrice(item), currency)}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3.5">
									<div class="flex flex-wrap items-center gap-3 text-xs">
										<label class="inline-flex items-center gap-1.5 font-medium text-slate-800">
											<span>{m.tally_scan_retrieval_label()}</span>
											<select
												value={scanRetrievalMode}
												onchange={(e) => (scanRetrievalMode = e.currentTarget.value as InventoryRetrievalMode)}
												class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
											>
												{#each retrievalModeOptions as opt (opt.value)}
													<option value={opt.value}>{opt.label}</option>
												{/each}
											</select>
										</label>
										<label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
											<input
												type="checkbox"
												checked={scanReplaceExisting}
												onchange={(e) => (scanReplaceExisting = e.currentTarget.checked)}
												class="rounded border-slate-300 text-violet-600"
											/>
											<span>{m.tally_scan_replace_existing()}</span>
										</label>
									</div>

									<div class="flex items-center gap-3">
										<span class="text-xs font-mono font-bold text-violet-950">
											{m.tally_scan_sold_count({ count: scannedDraftSummary.totalPortions })} • {formatCurrency(scannedDraftSummary.estRevenue, currency)}
										</span>
										<Button
											type="button"
											disabled={isRecordingSales || scannedDraftSummary.totalPortions <= 0}
											onclick={handleConfirmScannedSales}
											class="bg-violet-600 hover:bg-violet-700 text-white text-xs h-9"
										>
											<CheckCircle2 size={14} class="mr-1.5" />
											{isRecordingSales ? m.saving() : m.tally_scan_confirm_btn()}
										</Button>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'pos_api'}
				<div class="space-y-3 text-xs">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h5 class="text-sm font-bold text-slate-900">{m.pos_api_title()}</h5>
							<p class="text-xs text-slate-500">
								{m.pos_api_desc()}
							</p>
						</div>
						<a
							href="/api/pos/openapi.json"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
						>
							<ExternalLink size={13} />
							<span>{m.pos_api_open_spec()}</span>
						</a>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
						{#each [
							{ key: 'openapi', method: 'GET', label: m.pos_api_ep_openapi(), path: '/api/pos/openapi.json' },
							{ key: 'items', method: 'GET', label: m.pos_api_ep_items(), path: `/api/pos/events/${eventId}/items` },
							{ key: 'sales', method: 'POST', label: m.pos_api_ep_sales(), path: `/api/pos/events/${eventId}/sales` }
						] as ep (ep.key)}
							<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
								<div class="flex items-center justify-between">
									<span class="font-bold text-slate-800">{ep.label}</span>
									<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold {ep.method === 'POST' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
										{ep.method}
									</span>
								</div>
								<div class="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
									<span class="truncate">{ep.path}</span>
									<button
										type="button"
										onclick={() => copyText(ep.key, `${window.location.origin}${ep.path}`)}
										class="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
										title={m.pos_api_copy_url()}
									>
										{#if copiedEndpoint === ep.key}
											<Check size={13} class="text-emerald-600" />
										{:else}
											<Copy size={13} />
										{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
