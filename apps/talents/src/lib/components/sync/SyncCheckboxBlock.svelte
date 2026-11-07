<script lang="ts">
	import { onMount } from "svelte";
	import { list } from "../../../routes/synchronizations/list.remote";
	import { RefreshCw } from "@lucide/svelte";
	import * as m from "#lib/paraglide/messages.js";
	import { translateIssue } from "@ac/ui";

	let {
		syncFieldConfig,
		initialSelectedIds = [],
	}: {
		syncFieldConfig: any;
		initialSelectedIds?: string[];
	} = $props();

	// svelte-ignore state_referenced_locally
	let selectedIds = $state<string[]>(initialSelectedIds?.length ? [...initialSelectedIds] : []);
	const query = list();
	const configs = $derived(query.current?.data ?? []);

	onMount(async () => {
		if (!initialSelectedIds || initialSelectedIds.length === 0) {
			try {
				const res = await query;
				if (res?.data) {
					const defaultIds = res.data
						.filter(
							(c: any) =>
								c.enabled &&
								(c.settings?.isDefault === true ||
									c.settings?.isDefault === "true" ||
									c.settings?.isDefault === 1),
						)
						.map((c: any) => c.id);
					if (defaultIds.length > 0) {
						selectedIds = Array.from(new Set([...selectedIds, ...defaultIds]));
					}
				}
			} catch (err) {
				console.error("Failed to load default sync configurations:", err);
			}
		}
	});

	function toggleConfig(config: any) {
		if (selectedIds.includes(config.id)) {
			selectedIds = selectedIds.filter((x) => x !== config.id);
		} else {
			selectedIds = [...selectedIds, config.id];
		}
	}

	function getProviderLabel(providerType: string) {
		if (providerType === "microsoft-contacts") return "Microsoft 365 Contacts / Entra ID";
		if (providerType === "microsoft-calendar") return "Microsoft 365 Calendar";
		if (providerType === "google-calendar") return "Google Workspace";
		if (providerType === "email") return "Email / Brevo";
		return providerType;
	}

	function getTargetSubtitle(config: any): string {
		const settings = config.settings || {};
		if (config.providerType?.startsWith("microsoft-")) {
			const mailbox = settings.mailboxEmail || settings.tenantId;
			if (mailbox) return `${getProviderLabel(config.providerType)} • ${mailbox}`;
			return `${getProviderLabel(config.providerType)} • M365 NGO Tenant`;
		}
		return getProviderLabel(config.providerType);
	}

	const hiddenValue = $derived(JSON.stringify(selectedIds));
</script>

<div class="bg-white shadow-xs border border-gray-100 rounded-xl p-6 space-y-4">
	<div class="flex gap-2 items-center mb-2 border-b border-gray-100 pb-3">
		<RefreshCw class="w-5 h-5 text-indigo-600" />
		<h3 class="text-lg font-bold text-gray-900">
			{(m as any).synchronization ? (m as any).synchronization() : "Synchronizations (Per-Talent / Role)"}
		</h3>
	</div>

	<p class="text-sm text-gray-600">
		{(m as any).sync_description
			? (m as any).sync_description()
			: "Activate automatic external synchronization targets (e.g. Microsoft 365 Contacts, Entra ID, Calendar, Job Portals) for this record."}
	</p>

	{#if query.loading && !query.current}
		<p class="text-sm text-gray-500">Synchronisationsziele werden geladen...</p>
	{:else if configs.length === 0}
		<p class="text-sm text-gray-500 italic">
			Keine aktiven Synchronisations-Ziele konfiguriert (Microsoft 365 / Entra / Kalender können in den Synchronisations-Einstellungen hinterlegt werden).
		</p>
	{:else}
		<div class="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/70 max-h-60 overflow-y-auto">
			{#each configs as config (config.id)}
				{@const isDefaultTarget =
					(config.settings as any)?.isDefault === true ||
					(config.settings as any)?.isDefault === "true" ||
					(config.settings as any)?.isDefault === 1}
				{#if config.enabled}
					<label
						class="flex items-center gap-3 py-2 px-2.5 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors cursor-pointer"
					>
						<input
							type="checkbox"
							class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 focus:ring-2"
							checked={selectedIds.includes(config.id)}
							onchange={() => toggleConfig(config)}
						/>
						<div class="flex flex-col min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-semibold text-gray-900 truncate">
									{config.name || getProviderLabel(config.providerType)}
								</span>
								{#if isDefaultTarget}
									<span
										class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800"
									>
										Standard
									</span>
								{/if}
							</div>
							<span class="text-xs text-gray-500 font-mono truncate">
								{getTargetSubtitle(config)}
							</span>
						</div>
					</label>
				{/if}
			{/each}
		</div>
	{/if}

	{#if syncFieldConfig}
		<input {...syncFieldConfig.as("text", hiddenValue)} class="hidden" />
		{#each syncFieldConfig.issues?.() ?? [] as issue, idx (idx)}
			<p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
		{/each}
	{/if}
</div>
