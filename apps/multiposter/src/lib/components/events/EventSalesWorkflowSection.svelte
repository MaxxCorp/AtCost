<script lang="ts">
	import { toast } from 'svelte-sonner';
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
	}[] = [
		{
			value: 'fifo',
			label: 'FIFO (First-In, First-Out)',
			description: 'Deducts from the oldest purchased stock batches first'
		},
		{
			value: 'fefo',
			label: 'FEFO (First-Expired, First-Out)',
			description: 'Deducts from batches with the earliest expiration date first'
		},
		{
			value: 'lifo',
			label: 'LIFO (Last-In, First-Out)',
			description: 'Deducts from the most recently purchased stock batches first'
		},
		{
			value: 'lowest_cost',
			label: 'Lowest Cost First',
			description: 'Deducts from the lowest unit-cost stock batches first'
		},
		{
			value: 'highest_cost',
			label: 'Highest Cost First',
			description: 'Deducts from the highest unit-cost stock batches first'
		},
		{
			value: 'none',
			label: 'No Inventory Deduction',
			description: 'Records financial sales only without modifying consumable stock'
		}
	];

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
			toast.error('Please enter a sold quantity greater than 0 for at least one item.');
			return;
		}

		isRecordingSales = true;
		try {
			await recordSalesCommand({
				eventId,
				retrievalMode,
				deductInventory: retrievalMode !== 'none',
				mode: replaceExistingSales ? 'replace' : 'append',
				source: 'manual',
				notes: saleNotes.trim() || undefined,
				items: entries
			});
			await refreshAll();
			manualQuantities = {};
			saleNotes = '';
			activeTab = 'financials';
			toast.success('Sales recorded and inventory updated.');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to record sales');
		} finally {
			isRecordingSales = false;
		}
	}

	async function handleDeleteSale(saleId: string) {
		if (!eventId) return;
		deletingSaleId = saleId;
		try {
			await deleteSaleCommand({
				eventId,
				saleId,
				restoreInventory: true
			});
			await refreshAll();
			toast.success('Sale record removed and inventory restored.');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete sale record');
		} finally {
			deletingSaleId = null;
		}
	}

	async function handleRestockShortfall() {
		if (!eventId || !shoppingList) return;
		const shortfallItems = shoppingList.items.filter((i) => i.toBuyAmount > 0);
		if (shortfallItems.length === 0) {
			toast.info('All required ingredients are already in stock!');
			return;
		}

		isRestocking = true;
		try {
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
			});
			await refreshAll();
			toast.success(`Restocked ${res.insertedCount} consumable item(s) into inventory.`);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to restock shopping list items');
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
		const rowsHtml = shoppingList.items
			.map(
				(item) => `
				<tr>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${item.name}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;">${item.usages.map((u) => `${u.priceItemName} (${u.priceListName})`).join(', ')}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${item.requiredTotal} ${item.unit}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${item.inStockValid} ${item.unit}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;font-weight:700;color:${item.toBuyAmount > 0 ? '#b45309' : '#047857'};">${item.toBuyAmount > 0 ? `${item.toBuyAmount} ${item.unit}` : 'In Stock'}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${formatCurrency(item.estimatedPurchaseCost, shoppingList.currency)}</td>
				</tr>`
			)
			.join('');

		win.document.write(`<!doctype html>
<html>
<head>
	<title>Shopping List – ${shoppingList.eventSummary}</title>
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
	<h1>Shopping List: ${shoppingList.eventSummary}</h1>
	<p class="meta">Calculated for ${shoppingList.participantsCount} participants • Event ID: ${shoppingList.eventId.slice(0, 8)}</p>
	<table>
		<thead>
			<tr>
				<th>Consumable / Ingredient</th>
				<th>Used In</th>
				<th style="text-align:right">Required</th>
				<th style="text-align:right">In Stock</th>
				<th style="text-align:right">To Buy</th>
				<th style="text-align:right">Est. Cost</th>
			</tr>
		</thead>
		<tbody>${rowsHtml}</tbody>
	</table>
	<div class="total">Total Estimated Purchase Cost: ${formatCurrency(shoppingList.totalEstimatedPurchaseCost, shoppingList.currency)}</div>
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
			toast.error('Please upload an image file (JPEG, PNG, WebP).');
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
				toast.error(res.error || 'Failed to scan price list');
				return;
			}
			scanResult = res.data;
			const nextQuantities: Record<string, number> = {};
			for (const item of res.data.items) {
				nextQuantities[item.priceItemId] = item.countedMarks;
			}
			scannedQuantities = nextQuantities;
			toast.success('Price list scanned! Review the counted pencil marks below.');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to scan price list with Gemini');
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
			toast.error('No sold items with count > 0 to record.');
			return;
		}

		isRecordingSales = true;
		try {
			await recordSalesCommand({
				eventId,
				retrievalMode: scanRetrievalMode,
				deductInventory: scanRetrievalMode !== 'none',
				mode: scanReplaceExisting ? 'replace' : 'append',
				source: 'scan',
				notes: scanResult?.rawNotes
					? `Gemini tally scan: ${scanResult.rawNotes}`
					: 'Scanned from printed price list with pencil tallies',
				items: entries
			});
			await refreshAll();
			scanResult = null;
			scanPreviewUrl = null;
			scanImageBase64 = null;
			scannedQuantities = {};
			activeTab = 'financials';
			toast.success('Scanned tally sales recorded and inventory updated!');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to record scanned sales');
		} finally {
			isRecordingSales = false;
		}
	}

	async function copyText(key: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedEndpoint = key;
			toast.success('Copied to clipboard');
			setTimeout(() => {
				if (copiedEndpoint === key) copiedEndpoint = null;
			}, 2000);
		} catch {
			toast.error('Failed to copy');
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
		<span>Save this event first to generate shopping lists, track POS/scanned sales, and compute actual financial results.</span>
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
							Event Sales, Shopping List & Financial Result
						</h4>
						{#if financials && financials.salesHistory.length > 0}
							<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
								{financials.totalPortionsSold} portions sold
							</span>
						{:else}
							<span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300">
								No sales recorded yet
							</span>
						{/if}
					</div>
					<p class="text-xs text-slate-300">
						Actual sales tracking, stock-aware shopping list ({participantsCount} participants), Gemini tally sheet scanner & POS API
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={refreshAll}
						class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
						title="Refresh stock and sales data"
					>
						<RefreshCw size={13} class={salesQuery?.loading || shoppingQuery?.loading ? 'animate-spin' : ''} />
						<span>Refresh</span>
					</button>
				</div>
			</div>

			{#if financials}
				<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Actual Revenue</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono text-white">
							{formatCurrency(financials.actualTotalRevenue, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							Planned: <span class="font-mono">{formatCurrency(financials.plannedTotalRevenue, currency)}</span> ({financials.revenueAttainmentPercent}%)
						</div>
					</div>

					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Actual COGS (Inventory)</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono text-amber-300">
							{formatCurrency(financials.actualTotalCost, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							Planned Cost: <span class="font-mono">{formatCurrency(financials.plannedTotalCost, currency)}</span>
						</div>
					</div>

					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Actual Net Profit</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono {financials.actualTotalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">
							{financials.actualTotalProfit >= 0 ? '+' : ''}{formatCurrency(financials.actualTotalProfit, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							Margin: <span class="font-mono font-semibold text-emerald-300">{financials.actualMarginPercent}%</span> (Planned: {formatCurrency(financials.plannedTotalProfit, currency)})
						</div>
					</div>

					<div class="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
						<div class="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Shopping Shortfall</div>
						<div class="mt-1 text-lg sm:text-xl font-bold font-mono text-sky-300">
							{formatCurrency(shoppingList?.totalEstimatedPurchaseCost ?? 0, currency)}
						</div>
						<div class="mt-0.5 text-[11px] text-slate-300">
							{shoppingList?.itemsToBuyCount ?? 0} of {shoppingList?.totalRequiredItemsCount ?? 0} ingredients to buy
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
				<span>Financial Result & Sales</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'shopping')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'shopping'
					? 'border-emerald-600 bg-white text-emerald-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<ShoppingCart size={14} />
				<span>Shopping List</span>
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
				<span>Record Sales (Manual / POS)</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'scan')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'scan'
					? 'border-violet-600 bg-white text-violet-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<ScanLine size={14} />
				<span>Scan Printed Price List (Gemini)</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'pos_api')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer {activeTab === 'pos_api'
					? 'border-blue-600 bg-white text-blue-800 shadow-2xs'
					: 'border-transparent text-slate-600 hover:text-slate-900'}"
			>
				<Code2 size={14} />
				<span>POS API & OpenAPI</span>
			</button>
		</div>

		<!-- Tab Panels -->
		<div class="p-4 sm:p-5">
			{#if activeTab === 'financials'}
				{#if salesQuery?.loading && !financials}
					<div class="py-8 text-center text-sm text-slate-500">Loading financial results...</div>
				{:else if financials}
					<div class="space-y-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<h5 class="text-sm font-bold text-slate-900">Per-Item Sales & Margin Breakdown</h5>
								<p class="text-xs text-slate-500">
									Comparison of planned portions ({financials.participantsCount} participants) vs. actual sold portions and deducted inventory cost.
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
									<Plus size={13} class="mr-1" /> Record Sales
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (activeTab = 'scan')}
									class="h-8 text-xs text-violet-700 border-violet-200 hover:bg-violet-50"
								>
									<ScanLine size={13} class="mr-1" /> Scan Tally Sheet
								</Button>
							</div>
						</div>

						<div class="overflow-x-auto rounded-xl border border-slate-200">
							<table class="w-full text-left text-xs">
								<thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
									<tr>
										<th class="py-2.5 px-3 font-semibold">Item</th>
										<th class="py-2.5 px-3 font-semibold text-right">Portion Price</th>
										<th class="py-2.5 px-3 font-semibold text-right">Planned</th>
										<th class="py-2.5 px-3 font-semibold text-right">Sold</th>
										<th class="py-2.5 px-3 font-semibold text-right">Actual Revenue</th>
										<th class="py-2.5 px-3 font-semibold text-right">Actual COGS</th>
										<th class="py-2.5 px-3 font-semibold text-right">Net Profit</th>
										<th class="py-2.5 px-3 font-semibold text-right">Stock Avail.</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each financials.itemSummaries as item (item.priceItemId)}
										<tr class="hover:bg-slate-50/80">
											<td class="py-2.5 px-3">
												<div class="font-semibold text-slate-900">{item.name}</div>
												<div class="text-[11px] text-slate-500">{item.priceListName} • {item.portionAmount} {item.unit || 'piece'}</div>
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
													<span class="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-semibold">0 left</span>
												{:else}
													<span class="text-slate-700">{item.availablePortionsInStock} portions</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot class="bg-slate-50 font-semibold border-t border-slate-200 text-slate-900">
									<tr>
										<td class="py-2.5 px-3" colspan="2">Total Financial Result</td>
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
										Recorded Sales Transactions ({financials.salesHistory.length})
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
															{sale.source}
														</span>
														<span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
															Stock: {sale.retrievalMode.toUpperCase()}
														</span>
													</div>
													<div class="text-[11px] text-slate-500">
														{new Date(sale.createdAt).toLocaleString()}
														{#if sale.notes}
															• {sale.notes}
														{/if}
													</div>
												</div>

												<div class="flex items-center gap-3">
													<div class="text-right font-mono">
														<div class="font-semibold text-slate-900">Rev: {formatCurrency(sale.totalRevenue, currency)}</div>
														<div class="text-[11px] text-amber-700">COGS: {formatCurrency(sale.totalCost, currency)}</div>
													</div>
													<button
														type="button"
														disabled={deletingSaleId === sale.id}
														onclick={() => handleDeleteSale(sale.id)}
														class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
														title="Delete sale and restore deducted inventory"
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
					<div class="py-8 text-center text-sm text-slate-500">Computing shopping list against consumable stock...</div>
				{:else if shoppingList}
					<div class="space-y-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h5 class="text-sm font-bold text-slate-900">
									Event Shopping List ({shoppingList.participantsCount} Participants)
								</h5>
								<p class="text-xs text-slate-500">
									Automatically aggregates direct consumables and recipe ingredients across all event price lists and subtracts valid stock on hand.
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
									<span>Only show shortfall to buy ({shoppingList.itemsToBuyCount})</span>
								</label>

								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={printShoppingList}
									class="h-8 text-xs"
								>
									<Printer size={13} class="mr-1.5" /> Print Shopping List
								</Button>
							</div>
						</div>

						{#if shoppingList.items.length === 0}
							<div class="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
								No consumables or recipe ingredients are linked to the items on this event's price lists yet.
							</div>
						{:else}
							<div class="overflow-x-auto rounded-xl border border-slate-200">
								<table class="w-full text-left text-xs">
									<thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
										<tr>
											<th class="py-2.5 px-3 font-semibold">Consumable / Ingredient</th>
											<th class="py-2.5 px-3 font-semibold">Used In</th>
											<th class="py-2.5 px-3 font-semibold text-right">Required</th>
											<th class="py-2.5 px-3 font-semibold text-right">In Stock (Valid)</th>
											<th class="py-2.5 px-3 font-semibold text-right">To Buy (Shortfall)</th>
											<th class="py-2.5 px-3 font-semibold text-right">Est. Purchase Cost</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100">
										{#each filteredShoppingItems as item (item.key)}
											<tr class="hover:bg-slate-50/80">
												<td class="py-2.5 px-3">
													<div class="font-semibold text-slate-900">{item.name}</div>
													{#if item.inStockExpired > 0}
														<div class="text-[11px] text-amber-600">
															+{item.inStockExpired} {item.unit} expired in stock (excluded)
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
															<CheckCircle2 size={13} /> Covered
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
												Total Estimated Restock Cost ({shoppingList.itemsToBuyCount} shortfall items)
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
											Restock Purchased Shortfall into Consumables Inventory
										</div>
										<p class="text-[11px] text-emerald-800">
											Creates new stock batches for all {shoppingList.itemsToBuyCount} shortfall items so they are ready for FIFO/FEFO deduction.
										</p>
									</div>
									<div class="flex flex-wrap items-center gap-2">
										<input
											type="text"
											placeholder="Storage location (optional)"
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
											{isRestocking ? 'Restocking...' : `Restock ${shoppingList.itemsToBuyCount} Item(s)`}
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
									Inventory Retrieval & Deduction Mode
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
								<span class="block text-xs font-bold text-slate-800">Recording Mode & Notes</span>
								<div class="flex flex-wrap items-center gap-3">
									<label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
										<input
											type="checkbox"
											checked={replaceExistingSales}
											onchange={(e) => (replaceExistingSales = e.currentTarget.checked)}
											class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
										/>
										<span>Replace previous sales (restores old stock first)</span>
									</label>
									<button
										type="button"
										onclick={prefillManualFromExistingSales}
										class="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
									>
										Load current sold counts
									</button>
								</div>
								<input
									type="text"
									placeholder="Optional note (e.g., Bar Register 1, Evening shift)"
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
										<th class="py-2.5 px-3 font-semibold">Item</th>
										<th class="py-2.5 px-3 font-semibold text-right">Portion Price</th>
										<th class="py-2.5 px-3 font-semibold text-right">Already Sold</th>
										<th class="py-2.5 px-3 font-semibold text-center">Quantity to Record</th>
										<th class="py-2.5 px-3 font-semibold text-right">Line Revenue</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each financials.itemSummaries as item (item.priceItemId)}
										{@const qty = Number(manualQuantities[item.priceItemId] || 0)}
										<tr class="hover:bg-slate-50/80">
											<td class="py-2.5 px-3">
												<div class="font-semibold text-slate-900">{item.name}</div>
												<div class="text-[11px] text-slate-500">
													{item.priceListName} • Stock: {item.availablePortionsInStock} portions
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
								<span class="font-bold">{manualDraftSummary.totalPortions} portions</span> selected •
								Est. Revenue: <span class="font-mono font-bold">{formatCurrency(manualDraftSummary.estRevenue, currency)}</span> •
								Est. Profit: <span class="font-mono font-bold text-emerald-700">+{formatCurrency(manualDraftSummary.estProfit, currency)}</span>
							</div>
							<Button
								type="button"
								disabled={isRecordingSales || manualDraftSummary.totalPortions <= 0}
								onclick={handleRecordManualSales}
								class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
							>
								<Receipt size={14} class="mr-1.5" />
								{isRecordingSales ? 'Recording & Updating Stock...' : 'Record Sales & Deduct Inventory'}
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
									Gemini Printed Price List Tally Scanner
								</h5>
							</div>
							<p class="text-xs text-violet-800">
								Upload or photograph a printed price menu that has manual pencil tally marks in the designated box below each item. Gemini Vision counts the tally marks and verifies the event QR code / ID.
							</p>
						</div>

						<div class="flex items-center gap-2">
							<label class="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer">
								<Upload size={14} />
								<span>{isScanning ? 'Scanning with Gemini...' : 'Upload / Capture Tally Sheet'}</span>
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
							Note: <code>GEMINI_API_KEY</code> is not configured in the server environment. Configure <code>GEMINI_API_KEY</code> to enable AI tally recognition.
						</div>
					{/if}

					{#if isScanning}
						<div class="flex flex-col items-center justify-center py-10 space-y-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/30">
							<RefreshCw size={24} class="animate-spin text-violet-600" />
							<p class="text-xs font-semibold text-violet-900">Analyzing printed price list and counting pencil tally marks with Gemini...</p>
						</div>
					{/if}

					{#if scanResult && financials}
						<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
							{#if scanPreviewUrl}
								<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
									<div class="text-xs font-bold text-slate-700 flex items-center justify-between">
										<span>Scanned Sheet Preview</span>
										<button
											type="button"
											onclick={runGeminiScan}
											class="text-[11px] text-violet-700 hover:underline cursor-pointer"
										>
											Re-scan
										</button>
									</div>
									<img
										src={scanPreviewUrl}
										alt="Scanned Price List"
										class="w-full max-h-80 object-contain rounded-lg border border-slate-200 bg-white"
									/>
									{#if qrVerificationStatus}
										<div class="p-2 rounded-lg text-[11px] flex items-center gap-1.5 {qrVerificationStatus.matches ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}">
											<QrCode size={14} class="shrink-0" />
											{#if qrVerificationStatus.matches}
												<span>Event QR / ID verified ({eventId.slice(0, 8)})</span>
											{:else}
												<span>Detected ID "{qrVerificationStatus.raw}" differs from this event ({eventId.slice(0, 8)})</span>
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
												<th class="py-2 px-3 font-semibold">Item</th>
												<th class="py-2 px-3 font-semibold">Detected Pencil Marks</th>
												<th class="py-2 px-3 font-semibold text-center">Confidence</th>
												<th class="py-2 px-3 font-semibold text-center">Counted Sales</th>
												<th class="py-2 px-3 font-semibold text-right">Revenue</th>
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
														{scannedItem?.markBreakdown || 'No marks detected'}
													</td>
													<td class="py-2 px-3 text-center">
														{#if scannedItem}
															<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {scannedItem.confidence === 'high' ? 'bg-emerald-50 text-emerald-700' : scannedItem.confidence === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}">
																{scannedItem.confidence}
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
											<span>Retrieval:</span>
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
											<span>Replace existing sales</span>
										</label>
									</div>

									<div class="flex items-center gap-3">
										<span class="text-xs font-mono font-bold text-violet-950">
											{scannedDraftSummary.totalPortions} sold • {formatCurrency(scannedDraftSummary.estRevenue, currency)}
										</span>
										<Button
											type="button"
											disabled={isRecordingSales || scannedDraftSummary.totalPortions <= 0}
											onclick={handleConfirmScannedSales}
											class="bg-violet-600 hover:bg-violet-700 text-white text-xs h-9"
										>
											<CheckCircle2 size={14} class="mr-1.5" />
											{isRecordingSales ? 'Saving...' : 'Confirm & Record Scanned Sales'}
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
							<h5 class="text-sm font-bold text-slate-900">Point of Sale (POS) REST API & OpenAPI 3.1</h5>
							<p class="text-xs text-slate-500">
								External POS apps can retrieve sellable items for this event and post sales transactions with automatic inventory deduction.
							</p>
						</div>
						<a
							href="/api/pos/openapi.json"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
						>
							<ExternalLink size={13} />
							<span>Open OpenAPI 3.1 Spec (JSON)</span>
						</a>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
						{#each [
							{ key: 'openapi', method: 'GET', label: 'OpenAPI 3.1 Specification', path: '/api/pos/openapi.json' },
							{ key: 'items', method: 'GET', label: 'Retrieve Event Items & Stock', path: `/api/pos/events/${eventId}/items` },
							{ key: 'sales', method: 'POST', label: 'Record POS Sales & Deduct Stock', path: `/api/pos/events/${eventId}/sales` }
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
										title="Copy full URL"
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
