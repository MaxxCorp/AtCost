<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
    import { browser } from "$app/environment";
	import { readSynchronization as read, getOperations } from "./read.remote";
	import {
		updateSynchronization as update,
		type UpdateSynchronizationInput as UpdateSyncInput,
	} from "./update.remote";
	import { updateSynchronizationSchema } from "$lib/validations/synchronizations";
	import { removeBulk } from "./delete.remote";
	import { sync } from "./sync.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import SynchronizationForm from "$lib/components/synchronizations/SynchronizationForm.svelte";
	import { handleDelete } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		Calendar,
		RefreshCw,
		Trash2,
		CircleCheck,
		CircleX,
		Clock,
		CircleAlert,
	} from "@lucide/svelte";

	const configId = $derived(page.params.id || "");
    const mainRf = $derived(update.for(configId));

	// Version tracker for re-fetching data after actions
	let version = $state(0);
	let isSyncing = $state(false);
	let syncError = $state<string | null>(null);

	let prevIssuesLength = $state(0);
	$effect(() => {
		const issues = (mainRf as any).allIssues?.() ?? [];
		if (issues.length > 0 && prevIssuesLength === 0) {
			toast.error(m.please_fix_validation());
		}
		prevIssuesLength = issues.length;
	});

	// Derived promises that re-fetch when version changes
	let configPromise = $derived.by(() => {
		version;
		return read(configId);
	});

	let operationsPromise = $derived.by(() => {
		version;
		return getOperations(configId);
	});

	async function triggerSync() {
		try {
			isSyncing = true;
			syncError = null;
			await sync(configId);
			version++; // Trigger re-fetch
			toast.success(m.sync_completed_successfully());
		} catch (e: any) {
			syncError = e.message;
			toast.error(m.sync_failed() + ": " + e.message);
		} finally {
			isSyncing = false;
		}
	}

	function formatDate(date: Date | null) {
		if (!date) return m.never();
		return new Date(date).toLocaleString();
	}

	function getProviderLabel(providerType: string) {
		if (providerType === "google-calendar") return "Google Calendar";
		if (providerType === "microsoft-calendar") return "Microsoft Calendar";
		return providerType;
	}

	function getStatusIcon(status: string) {
		if (status === "completed") return CircleCheck;
		if (status === "failed") return CircleX;
		if (status === "pending") return Clock;
		return CircleAlert;
	}
	function getStatusColor(status: string) {
		if (status === "completed") return "text-green-600";
		if (status === "failed") return "text-red-600";
		if (status === "pending") return "text-yellow-600";
		return "text-gray-600";
	}

	function getOperationLabel(operation: string) {
		if (operation === "pull") return m.pull();
		if (operation === "push") return m.push();
		if (operation === "delete") return m.delete();
		return operation;
	}

    function formatStatus(status: string) {
        if (status === "completed") return m.completed();
        if (status === "failed") return m.failed();
        if (status === "pending") return m.pending();
        return status;
    }
</script>

<svelte:head>
	<title>{m.feature_synchronizations_title()}</title>
</svelte:head>

{#if browser}
    <svelte:boundary>
        {#if $effect.pending()}
            <LoadingSection message={m.loading_item({ item: m.feature_synchronizations_title() })} />
        {/if}

        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#await configPromise then config}
                {#if config}
                    <div class="container mx-auto px-4 py-8">
                        <div class="max-w-4xl mx-auto">
                            <Breadcrumb
                                feature="synchronizations"
                                current={config.providerId ?? undefined}
                            />

                            <div class="space-y-4">
                                <!-- Header -->
                                <div class="bg-white shadow rounded-lg p-6 flex items-start justify-between">
                                    <div class="flex items-center gap-4">
                                        <div class="rounded-lg bg-blue-100 p-3">
                                            <Calendar class="h-8 w-8 text-blue-600" />
                                        </div>
                                        <div>
                                            <h1 class="text-3xl font-bold">
                                                {getProviderLabel(config.providerType)}
                                            </h1>
                                            <p class="text-gray-600">{config.providerId}</p>
                                        </div>
                                    </div>
                                    <div class="flex gap-2">
                                        <AsyncButton
                                            variant="default"
                                            loading={isSyncing}
                                            loadingLabel={m.syncing()}
                                            onclick={triggerSync}
                                        >
                                            <RefreshCw class="h-4 w-4 mr-2 {isSyncing ? 'animate-spin' : ''}" />
                                            {m.sync_now()}
                                        </AsyncButton>
                                        <AsyncButton
                                            variant={config.enabled ? "secondary" : "default"}
                                            loading={update.pending}
                                            loadingLabel={config.enabled ? m.disabling() : m.enabling()}
                                            class={config.enabled ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-green-600 text-white hover:bg-green-700"}
                                            onclick={async () => {
                                                try {
                                                    const result = await update({ id: configId, enabled: !config.enabled });
                                                    if (result?.error) {
                                                        toast.error(
                                                            result.error.message ||
                                                                m.failed_to_update_status(),
                                                        );
                                                        return;
                                                    }
                                                    version++; // Trigger re-fetch
                                                    toast.success(m.status_updated());
                                                } catch (e: any) {
                                                    toast.error(m.failed_to_update_status());
                                                }
                                            }}
                                        >
                                            {config.enabled ? m.disable() : m.enable()}
                                        </AsyncButton>
                                        <AsyncButton
                                            variant="destructive"
                                            loading={false}
                                            loadingLabel={m.deleting()}
                                            onclick={async () => {
                                                const success = await handleDelete({
                                                    ids: [configId],
                                                    deleteFn: removeBulk,
                                                    itemName: m.feature_synchronizations_title().toLowerCase(),
                                                });
                                                if (success) {
                                                    await goto("/synchronizations");
                                                }
                                            }}
                                        >
                                            <Trash2 class="h-4 w-4 mr-2" />
                                            {m.delete()}
                                        </AsyncButton>
                                    </div>
                                </div>

                                <!-- Edit Form & Status -->
                                <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
                                    <div>
                                        <form
                                            {...mainRf.preflight(updateSynchronizationSchema).enhance(async ({ submit }: any) => {
                                                const result: any = await submit();
                                                if (result?.error) {
                                                    toast.error(
                                                        result.error.message ||
                                                            "Failed to update synchronization",
                                                    );
                                                    return;
                                                }
                                                version++;
                                                toast.success("Synchronization updated successfully!");
                                            })}
                                            class="space-y-4"
                                        >
                                            <SynchronizationForm
                                                remoteFunction={mainRf}
                                                isUpdating={true}
                                                initialData={config}
                                            />
                                            <div class="flex items-center justify-end gap-3 pt-4">
                                                <AsyncButton
                                                    type="submit"
                                                    loadingLabel="Saving..."
                                                    loading={update.pending}
                                                >
                                                    Save Changes
                                                </AsyncButton>
                                            </div>
                                        </form>
                                    </div>

                                    <div class="space-y-6">
                                        <div class="bg-white shadow rounded-lg p-6 space-y-4">
                                            <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <Clock class="h-5 w-5" />
                                                {m.status()}
                                            </h2>
                                            <div class="space-y-3 text-sm">
                                                <div class="flex justify-between">
                                                    <span class="text-gray-600">{m.last_sync()}:</span>
                                                    <span class="font-medium">{formatDate(config.lastSyncAt)}</span>
                                                </div>
                                                <div class="flex justify-between">
                                                    <span class="text-gray-600">{m.next_sync()}:</span>
                                                    <span class="font-medium">{formatDate(config.nextSyncAt)}</span>
                                                </div>
                                                <div class="flex justify-between">
                                                    <span class="text-gray-600">{m.created()}:</span>
                                                    <span class="font-medium">{formatDate(config.createdAt)}</span>
                                                </div>
                                                <div class="flex justify-between">
                                                    <span class="text-gray-600">{m.updated()}:</span>
                                                    <span class="font-medium">{formatDate(config.updatedAt)}</span>
                                                </div>
                                                <div class="flex justify-between">
                                                    <span class="text-gray-600">{m.webhooks()}:</span>
                                                    <span class="font-medium {config.webhookId ? 'text-green-600' : 'text-gray-400'}">
                                                        {config.webhookId ? m.active() : m.inactive()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Sync Result Messages -->
                                {#if syncError}
                                    <div class="rounded-lg border border-red-200 bg-red-50 p-4">
                                        <div class="flex items-start gap-3 text-red-600">
                                            <CircleAlert class="h-5 w-5 flex-shrink-0 mt-0.5" />
                                            <div class="flex-1">
                                                <p class="font-semibold mb-1">{m.sync_failed()}</p>
                                                <p class="text-sm">{syncError}</p>
                                                {#if syncError.includes("refresh token") || syncError.includes("re-authenticate")}
                                                    <div class="mt-3 pt-3 border-t border-red-200">
                                                        <p class="text-sm font-medium mb-2">{m.how_to_fix_this()}</p>
                                                        <ol class="text-sm space-y-1 list-decimal list-inside">
                                                            <li>{m.delete_sync_step()}</li>
                                                            <li>{m.sign_out_in_google_step()}</li>
                                                            <li>{m.create_new_sync_step()}</li>
                                                        </ol>
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {/if}

                                <div class="bg-white shadow rounded-lg p-6 space-y-4">
                                    <h2 class="text-lg font-semibold mb-4">{m.recent_sync_operations()}</h2>
                                    {#await operationsPromise}
                                        <div class="flex justify-center py-8">
                                            <RefreshCw class="h-6 w-6 animate-spin text-gray-400" />
                                        </div>
                                    {:then operations}
                                        {#if operations && operations.length === 0}
                                            <p class="text-gray-500 text-center py-8">{m.no_sync_operations_yet()}</p>
                                        {:else if operations}
                                            <div class="space-y-2">
                                                {#each Array.from($state.snapshot(operations)) as operation}
                                                    {@const Icon = getStatusIcon(operation.status)}
                                                    {@const statusColor = getStatusColor(operation.status)}
                                                    <div class="border rounded-lg {operation.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}">
                                                        <div class="flex items-center justify-between p-3">
                                                            <div class="flex items-center gap-3">
                                                                <Icon class="h-5 w-5 {statusColor}" />
                                                                <div>
                                                                    <div class="font-medium">
                                                                        {getOperationLabel(operation.operation)} {operation.entityType}
                                                                    </div>
                                                                    <div class="text-xs text-gray-500">
                                                                        {formatDate(operation.startedAt)}
                                                                        {#if operation.completedAt}
                                                                            → {formatDate(operation.completedAt)}
                                                                        {/if}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div class="text-sm">
                                                                <span class={`font-medium ${statusColor}`}>
                                                                    {formatStatus(operation.status)}
                                                                </span>
                                                                {#if operation.retryCount > 0}
                                                                    <span class="text-gray-500 ml-2">
                                                                        ({m.retried_x_times({ count: operation.retryCount })})
                                                                    </span>
                                                                {/if}
                                                            </div>
                                                        </div>
                                                        {#if operation.error}
                                                            <div class="mx-3 mb-3 text-sm text-red-700 bg-red-100 p-3 rounded border border-red-200">
                                                                <div class="font-semibold mb-1">{m.error_details()}</div>
                                                                <pre class="whitespace-pre-wrap font-mono text-xs">{operation.error}</pre>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    {:catch error}
                                        <div class="flex items-center gap-2 text-red-600">
                                            <CircleAlert class="h-5 w-5" />
                                            <p>Failed to load operations: {error instanceof Error ? error.message : String(error)}</p>
                                        </div>
                                    {/await}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            {/await}
        </div>

        {#snippet failed(error: unknown)}
            <ErrorSection
                headline={m.sync_configuration_not_found()}
                message={error instanceof Error ? error.message : String(error)}
                href="/synchronizations"
                button={m.back_to_list()}
            />
        {/snippet}
    </svelte:boundary>
{:else}
    <LoadingSection message={m.loading_item({ item: m.feature_synchronizations_title() })} />
{/if}
