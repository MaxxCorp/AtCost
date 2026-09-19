<script lang="ts">
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import * as m from "$lib/paraglide/messages.js";
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import { RefreshCw, Calendar, ChevronDown, Check } from "@lucide/svelte";

    interface Props {
        event: any;
        variant?: "banner" | "inline";
        viewMode?: boolean;
        isDirty?: boolean;
        onnavigate?: (targetId: string) => void;
    }

    let {
        event,
        variant = "inline",
        viewMode = false,
        isDirty = false,
        onnavigate,
    }: Props = $props();

    // Determine if this event is part of a series
    const isSeries = $derived(
        Boolean(
            event?.recurringEventId ||
            event?.seriesId ||
            (event?.recurrence && event.recurrence.length > 0) ||
            (event?.instances && event.instances.length > 0)
        )
    );

    const isMaster = $derived(!event?.recurringEventId);
    const masterId = $derived(event?.recurringEventId || event?.id || "");
    const instances = $derived<any[]>(event?.instances || []);
    const recurrenceRule = $derived<string | null>(
        (event?.recurrence?.[0] || event?.seriesMaster?.recurrence?.[0]) ?? null
    );
    const recurrenceDescription = $derived(
        recurrenceRule ? formatRecurrenceText(recurrenceRule) : ""
    );

    function formatDate(dateStr: string | null | undefined) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    function formatTime(dateTimeStr: string | null | undefined) {
        if (!dateTimeStr) return "";
        return new Date(dateTimeStr).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function getStatusBadgeClass(status?: string) {
        switch (status) {
            case "published":
                return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
            case "draft":
                return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
            case "cancelled":
                return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
        }
    }

    function formatEventStatus(status?: string) {
        if (!status) return "";
        switch (status) {
            case "published":
                return m.published ? m.published() : "Published";
            case "draft":
                return m.draft ? m.draft() : "Draft";
            case "cancelled":
                return m.cancelled ? m.cancelled() : "Cancelled";
            default:
                return status;
        }
    }

    function handleSwitch(targetId: string) {
        if (!targetId || targetId === event?.id) return;

        if (isDirty) {
            const confirmed = confirm(m.unsaved_changes_switch_confirm());
            if (!confirmed) return;
        }

        onnavigate?.(targetId);
        const targetUrl = viewMode ? `/events/${targetId}/view` : `/events/${targetId}`;
        goto(resolve(targetUrl as any));
    }
</script>

{#if isSeries}
    {#if variant === "banner"}
        <div
            class="rounded-xl p-4 sm:p-5 mb-6 border transition-colors {isMaster
                ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50'
                : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'}"
        >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <!-- Left: Mode Details -->
                <div class="flex items-start gap-3.5">
                    <div
                        class="p-2.5 rounded-lg shrink-0 mt-0.5 sm:mt-0 {isMaster
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}"
                    >
                        {#if isMaster}
                            <RefreshCw size={20} />
                        {:else}
                            <Calendar size={20} />
                        {/if}
                    </div>

                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span
                                class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider {isMaster
                                    ? 'bg-blue-200/80 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200'
                                    : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'}"
                            >
                                {isMaster ? m.series_mode_label() : m.instance_mode_label()}
                            </span>
                            <h3 class="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                {isMaster
                                    ? m.editing_series_title()
                                    : m.editing_instance_title()}
                            </h3>
                        </div>

                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
                            {#if isMaster}
                                {m.editing_series_desc()}
                            {:else}
                                {m.editing_instance_desc({
                                    date: formatDate(event.startDateTime),
                                })}
                            {/if}
                        </p>
                    </div>
                </div>

                <!-- Right: Switcher Dropdown -->
                <div class="shrink-0 flex items-center">
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                            <Button
                                variant="outline"
                                class="w-full sm:w-auto flex items-center justify-between gap-2.5 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium"
                            >
                                <div class="flex items-center gap-2 truncate">
                                    {#if isMaster}
                                        <RefreshCw size={14} class="text-blue-600 shrink-0" />
                                        <span>{m.entire_series_master()}</span>
                                    {:else}
                                        <Calendar size={14} class="text-amber-600 shrink-0" />
                                        <span>{formatDate(event.startDateTime)}</span>
                                    {/if}
                                </div>
                                <ChevronDown size={14} class="text-gray-500 shrink-0 opacity-70" />
                            </Button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content align="end" class="w-72 sm:w-80 p-1.5">
                            <DropdownMenu.Group>
                                <DropdownMenu.GroupHeading class="text-[11px] font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider">
                                    {m.switch_series_or_instance()}
                                </DropdownMenu.GroupHeading>

                                <!-- Option: Ganze Serie -->
                                <DropdownMenu.Item
                                    onclick={() => handleSwitch(masterId)}
                                    class="flex items-center justify-between p-2.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {isMaster
                                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-medium'
                                        : ''}"
                                >
                                    <div class="flex items-center gap-2.5 min-w-0">
                                        <RefreshCw size={15} class="text-blue-600 shrink-0" />
                                        <div class="min-w-0">
                                            <div class="text-xs font-medium truncate">{m.entire_series_master()}</div>
                                            {#if recurrenceDescription}
                                                <div class="text-[11px] text-gray-500 truncate">{recurrenceDescription}</div>
                                            {/if}
                                        </div>
                                    </div>
                                    {#if isMaster}
                                        <Check size={15} class="text-blue-600 shrink-0 ml-2" />
                                    {/if}
                                </DropdownMenu.Item>
                            </DropdownMenu.Group>

                            {#if instances.length > 0}
                                <DropdownMenu.Separator class="my-1.5" />

                                <DropdownMenu.Group>
                                    <DropdownMenu.GroupHeading class="text-[11px] font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider">
                                        {m.all_instances_count({ count: instances.length })}
                                    </DropdownMenu.GroupHeading>

                                    <div class="max-h-60 overflow-y-auto space-y-0.5 pr-1">
                                        {#each instances as inst (inst.id)}
                                            {@const isCurrent = inst.id === event.id}
                                            <DropdownMenu.Item
                                                onclick={() => handleSwitch(inst.id)}
                                                class="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {isCurrent
                                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium'
                                                    : ''}"
                                            >
                                                <div class="flex items-center gap-2 min-w-0">
                                                    <Calendar size={14} class="text-gray-400 shrink-0" />
                                                    <div class="min-w-0">
                                                        <div class="text-xs font-medium truncate">
                                                            {formatDate(inst.startDateTime)}
                                                        </div>
                                                        <div class="text-[11px] text-gray-500 flex items-center gap-1.5">
                                                            <span>
                                                                {formatTime(inst.startDateTime)}{inst.endDateTime ? ` – ${formatTime(inst.endDateTime)}` : ''}
                                                            </span>
                                                            {#if inst.status}
                                                                <span class="inline-block px-1.5 py-0.2 rounded text-[10px] font-normal {getStatusBadgeClass(inst.status)}">
                                                                    {formatEventStatus(inst.status)}
                                                                </span>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                </div>
                                                {#if isCurrent}
                                                    <Check size={14} class="text-amber-600 shrink-0 ml-2" />
                                                {/if}
                                            </DropdownMenu.Item>
                                        {/each}
                                    </div>
                                </DropdownMenu.Group>
                            {/if}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>
            </div>
        </div>
    {:else}
        <!-- Inline variant for Recurrence Row -->
        <div class="flex items-center gap-2.5 flex-wrap">
            <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium {isMaster
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}"
            >
                {#if isMaster}
                    <RefreshCw size={12} />
                    {m.series_mode_label()}
                {:else}
                    <Calendar size={12} />
                    {m.instance_mode_label()}
                {/if}
            </span>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5 text-xs font-medium bg-white dark:bg-gray-800"
                    >
                        {#if isMaster}
                            <RefreshCw size={13} class="text-blue-600 shrink-0" />
                            <span>{m.entire_series_master()}</span>
                            {#if instances.length > 0}
                                <span class="text-gray-500 font-normal">({instances.length})</span>
                            {/if}
                        {:else}
                            <Calendar size={13} class="text-amber-600 shrink-0" />
                            <span>{formatDate(event.startDateTime)}</span>
                        {/if}
                        <ChevronDown size={13} class="text-gray-500 opacity-70 ml-0.5" />
                    </Button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Content align="end" class="w-72 sm:w-80 p-1.5">
                    <DropdownMenu.Group>
                        <DropdownMenu.GroupHeading class="text-[11px] font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider">
                            {m.switch_series_or_instance()}
                        </DropdownMenu.GroupHeading>

                        <!-- Option: Ganze Serie -->
                        <DropdownMenu.Item
                            onclick={() => handleSwitch(masterId)}
                            class="flex items-center justify-between p-2.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {isMaster
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-medium'
                                : ''}"
                        >
                            <div class="flex items-center gap-2.5 min-w-0">
                                <RefreshCw size={15} class="text-blue-600 shrink-0" />
                                <div class="min-w-0">
                                    <div class="text-xs font-medium truncate">{m.entire_series_master()}</div>
                                    {#if recurrenceDescription}
                                        <div class="text-[11px] text-gray-500 truncate">{recurrenceDescription}</div>
                                    {/if}
                                </div>
                            </div>
                            {#if isMaster}
                                <Check size={15} class="text-blue-600 shrink-0 ml-2" />
                            {/if}
                        </DropdownMenu.Item>
                    </DropdownMenu.Group>

                    {#if instances.length > 0}
                        <DropdownMenu.Separator class="my-1.5" />

                        <DropdownMenu.Group>
                            <DropdownMenu.GroupHeading class="text-[11px] font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider">
                                {m.all_instances_count({ count: instances.length })}
                            </DropdownMenu.GroupHeading>

                            <div class="max-h-60 overflow-y-auto space-y-0.5 pr-1">
                                {#each instances as inst (inst.id)}
                                    {@const isCurrent = inst.id === event.id}
                                    <DropdownMenu.Item
                                        onclick={() => handleSwitch(inst.id)}
                                        class="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {isCurrent
                                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium'
                                            : ''}"
                                    >
                                        <div class="flex items-center gap-2 min-w-0">
                                            <Calendar size={14} class="text-gray-400 shrink-0" />
                                            <div class="min-w-0">
                                                <div class="text-xs font-medium truncate">
                                                    {formatDate(inst.startDateTime)}
                                                </div>
                                                <div class="text-[11px] text-gray-500 flex items-center gap-1.5">
                                                    <span>
                                                        {formatTime(inst.startDateTime)}{inst.endDateTime ? ` – ${formatTime(inst.endDateTime)}` : ''}
                                                    </span>
                                                    {#if inst.status}
                                                        <span class="inline-block px-1.5 py-0.2 rounded text-[10px] font-normal {getStatusBadgeClass(inst.status)}">
                                                            {formatEventStatus(inst.status)}
                                                        </span>
                                                    {/if}
                                                </div>
                                            </div>
                                        </div>
                                        {#if isCurrent}
                                            <Check size={14} class="text-amber-600 shrink-0 ml-2" />
                                        {/if}
                                    </DropdownMenu.Item>
                                {/each}
                            </div>
                        </DropdownMenu.Group>
                    {/if}
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>
    {/if}
{/if}
