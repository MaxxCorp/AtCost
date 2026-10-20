<script lang="ts">
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { browser } from '$app/env';
    import { readSynchronization as read, getOperations } from "./read.remote";
    import { updateSynchronization as update } from "./update.remote";
	import { updateSynchronizationSchema, type UpdateSynchronizationInput as UpdateSyncInput } from "#lib/validations/synchronizations.js";
    import { removeBulk } from "./delete.remote";
    import { startBulkSync, processBulkSyncBatch, sync } from "./sync.remote";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "#lib/components/ui/AsyncButton.svelte";
    import SynchronizationForm from "#lib/components/synchronizations/SynchronizationForm.svelte";
    import { handleDelete, getLastListUrl, recordActiveItem, useFormValidationFeedback } from "@ac/ui";
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

    $effect(() => {
        if (configId) {
            recordActiveItem("synchronizations", configId);
        }
    });

    // Version tracker for re-fetching data after actions
    let version = $state(0);
    let isSyncing = $state(false);
    let syncProgress = $state<string | null>(null);
    let syncError = $state<string | null>(null);
    const feedback = useFormValidationFeedback(() => mainRf, {
        message: () => m.please_fix_validation(),
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

    async function triggerBulkSync() {
        try {
            isSyncing = true;
            syncError = null;
            syncProgress = null;

            const startRes = await startBulkSync(configId);
            if (startRes.done) {
                version++;
                toast.success(m.bulk_sync_completed({ pushed: 0, pulled: startRes.pulled || 0 }));
                return;
            }

            let done = false;
            let lastResult: any = null;
            while (!done) {
				const batchRes = await processBulkSyncBatch({
					configId,
					operationId: startRes.operationId,
					batchSize: 10
				});
                lastResult = batchRes;
                done = batchRes.done;
				syncProgress = m.bulk_sync_progress({
					current: batchRes.processed,
					total: batchRes.total
				});
            }

            version++;
            toast.success(m.bulk_sync_completed({
                pushed: lastResult?.pushed ?? 0,
                pulled: startRes.pulled ?? 0
            }));
		} catch (e: any) {
            syncError = e.message;
            toast.error(m.bulk_sync_failed() + ": " + (e.message || e));
        } finally {
            isSyncing = false;
            syncProgress = null;
        }
    }

    function formatDate(date: Date | null) {
        if (!date) return m.never();
        return new Date(date).toLocaleString();
    }

    function getProviderLabel(providerType: string) {
        if (providerType === "google-calendar") return "Google Calendar";
        if (providerType === "microsoft-calendar") return "Microsoft Calendar";
        if (providerType === "microsoft-contacts") return "Microsoft Contacts";
        if (providerType === "microsoft-resources") return "Microsoft Resources & Rooms";
        if (providerType === "email") return "E-Mail (Brevo)";
        if (providerType === "instagram") return "Instagram";
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
                                <div class="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div class="flex items-center gap-4 min-w-0">
                                        <div class="rounded-lg bg-blue-100 p-3 shrink-0">
                                            <Calendar class="h-8 w-8 text-blue-600" />
                                        </div>
                                        <div class="min-w-0">
                                            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                                                <h1 class="text-2xl sm:text-3xl font-bold">
                                                    {getProviderLabel(config.providerType)}
                                                </h1>
                                                {#if (config.settings as any)?.isDefault === true || (config.settings as any)?.isDefault === 'true' || (config.settings as any)?.isDefault === 1}
                                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                        {m.default_shared_target ? m.default_shared_target() : "Default Shared Target"}
                                                    </span>
                                                {/if}
                                            </div>
                                            <p class="text-gray-600 break-all">{config.providerId}</p>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                        <AsyncButton
                                            variant="default"
                                            loading={isSyncing}
                                            loadingLabel={syncProgress || m.bulk_syncing()}
                                            onclick={triggerBulkSync}
                                        >
                                            <RefreshCw class="h-4 w-4 mr-2 {isSyncing ? 'animate-spin' : ''}" />
                                            {m.bulk_sync()}
                                        </AsyncButton>
                                        <AsyncButton
                                            variant={config.enabled ? "secondary" : "default"}
                                            loading={update.pending}
                                            loadingLabel={config.enabled ? m.disabling() : m.enabling()}
                                            class={config.enabled ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-green-600 text-white hover:bg-green-700"}
                                            onclick={async () => {
                                                try {
                                                    const result = await (update as any)({ id: configId, enabled: !config.enabled });
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
                                                    await goto(getLastListUrl("synchronizations", "/synchronizations"));
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
                                            {#key version}
                                                <SynchronizationForm
                                                    remoteFunction={mainRf}
                                                    isUpdating={true}
                                                    initialData={config}
                                                />
                                            {/key}
                                            <div class="flex items-center justify-end gap-3 pt-4">
                                                <AsyncButton
                                                    type="submit"
                                                    loadingLabel="Saving..."
                                                    loading={mainRf.pending}
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
                                    <div>
                                        <h2 class="text-lg font-semibold">{m.recent_sync_operations()}</h2>
                                        <p class="text-xs text-gray-500 mt-0.5">{m.recent_sync_operations_retention_hint()}</p>
                                    </div>
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
                                                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
                                                            <div class="flex items-center gap-3 min-w-0">
                                                                <Icon class="h-5 w-5 {statusColor} shrink-0" />
                                                                <div class="min-w-0">
                                                                    <div class="font-medium break-words">
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
                                                            <div class="text-sm shrink-0">
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
                                                        <!-- Itemized Room Bookings (Microsoft Resources) -->
                                                        {#if (operation.results as any)?.roomBookings && (operation.results as any).roomBookings.length > 0}
                                                            <div class="mx-3 mb-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs">
                                                                <div class="font-semibold text-blue-900 mb-1.5 flex items-center gap-1.5">
                                                                    <span>Room Booking Statuses</span>
                                                                </div>
                                                                <div class="space-y-1">
                                                                    {#each (operation.results as any).roomBookings as rb}
                                                                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] py-1 border-b border-blue-100 last:border-b-0">
                                                                            <span class="font-mono text-gray-700 break-all">{rb.roomEmail || rb.roomId}</span>
                                                                            <div class="flex items-center gap-1.5">
                                                                                {#if rb.status === "booked"}
                                                                                    <span class="px-1.5 py-0.2 rounded bg-green-100 text-green-800 font-medium">Booked</span>
                                                                                {:else if rb.status === "failed"}
                                                                                    <span class="px-1.5 py-0.2 rounded bg-red-100 text-red-800 font-medium" title={rb.error}>Failed</span>
                                                                                {:else if rb.status === "unavailable"}
                                                                                    <span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">Unavailable</span>
                                                                                {:else}
                                                                                    <span class="text-gray-500">{rb.status}</span>
                                                                                {/if}
                                                                                {#if rb.error}
                                                                                    <span class="text-red-600 text-[10px]">({rb.error})</span>
                                                                                {/if}
                                                                            </div>
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            </div>
                                                        {/if}

                                                        <!-- Itemized Errors -->
                                                        {#if (operation.results as any)?.errors && (operation.results as any).errors.length > 0}
                                                            <div class="mx-3 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs">
                                                                <div class="font-semibold text-red-900 mb-1">Item Synchronization Errors:</div>
                                                                <div class="space-y-1">
                                                                    {#each (operation.results as any).errors as itemErr}
                                                                        <div class="text-[11px] text-red-800 border-b border-red-100 last:border-b-0 py-0.5">
                                                                            <span class="font-mono font-medium">Item {itemErr.itemId}:</span>
                                                                            <span class="ml-1">{itemErr.error}</span>
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            </div>
                                                        {/if}

                                                        <!-- General Operation Error -->
                                                        {#if operation.error}
                                                            <div class="mx-3 mb-3 text-sm text-red-700 bg-red-100 p-3 rounded border border-red-200">
                                                                <div class="font-semibold mb-1">{m.error_details()}</div>
                                                                <pre class="whitespace-pre-wrap font-mono text-xs break-all">{operation.error}</pre>
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
