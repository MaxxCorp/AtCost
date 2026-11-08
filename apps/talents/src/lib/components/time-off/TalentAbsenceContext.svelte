<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { getTalentAbsenceAwareness } from "../../../routes/time-off/time-off.remote";
    import {
        Calendar,
        Clock,
        Umbrella,
        CheckCircle2,
        XCircle,
        AlertCircle,
        Sparkles,
        Briefcase,
        Tag,
        ChevronDown,
        ChevronUp,
        Info
    } from "@lucide/svelte";

    interface Props {
        talentId: string;
        currentRequestId?: string;
        selectedStartDate?: string;
        selectedEndDate?: string;
        selectedType?: string;
        compact?: boolean;
    }

    let {
        talentId,
        currentRequestId,
        selectedStartDate,
        selectedEndDate,
        selectedType,
        compact = false
    }: Props = $props();

    // Derived remote query (NEVER #await for remote functions)
    const awarenessQuery = $derived(
        talentId ? getTalentAbsenceAwareness({
            talentId,
            currentRequestId: currentRequestId || undefined,
            startDate: selectedStartDate || undefined,
            endDate: selectedEndDate || undefined,
        }) : null
    );
    const awareness = $derived(awarenessQuery?.current ?? null);
    const loading = $derived(awarenessQuery?.loading ?? false);

    // Local UI states
    let activeTab = $state<'planned' | 'previous'>('planned');
    let showYearHolidays = $state(false);

    // Balances & Progress computations
    const balances = $derived(awareness?.balances ?? null);
    const totalDays = $derived(balances?.totalDays || 1);
    const usedDays = $derived(balances?.usedDays || 0);
    const pendingDays = $derived(balances?.pendingDays || 0);
    const remainingDays = $derived(balances?.remainingDays || 0);

    const usedPercent = $derived.by(() => {
        if (!balances || balances.totalDays <= 0) return 0;
        return Math.min(100, Math.round((usedDays / totalDays) * 100));
    });

    const pendingPercent = $derived.by(() => {
        if (!balances || balances.totalDays <= 0) return 0;
        const maxPending = Math.max(0, 100 - usedPercent);
        return Math.min(maxPending, Math.round((pendingDays / totalDays) * 100));
    });

    const remainingPercent = $derived.by(() => {
        if (!balances || balances.totalDays <= 0) return 0;
        return Math.max(0, 100 - usedPercent - pendingPercent);
    });

    const impact = $derived(awareness?.requestedImpact ?? null);

    // Helpers
    function formatDate(d: string | Date | null | undefined): string {
        if (!d) return '—';
        try {
            const date = typeof d === 'string' ? new Date(d) : d;
            if (isNaN(date.getTime())) return String(d);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return String(d);
        }
    }

    function getStatusBadge(status: string) {
        switch (status.toLowerCase()) {
            case 'approved':
                return {
                    label: m.status_approved?.() ?? 'Approved',
                    icon: CheckCircle2,
                    class: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                };
            case 'pending':
                return {
                    label: m.status_pending?.() ?? 'Pending',
                    icon: Clock,
                    class: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                };
            case 'rejected':
                return {
                    label: m.status_rejected?.() ?? 'Rejected',
                    icon: XCircle,
                    class: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                };
            default:
                return {
                    label: status,
                    icon: Info,
                    class: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                };
        }
    }

    function getTypeBadge(type: string) {
        switch (type.toLowerCase()) {
            case 'vacation':
                return {
                    label: m.leave_vacation?.() ?? 'Vacation',
                    icon: Umbrella,
                    class: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                };
            case 'sick':
                return {
                    label: m.leave_sick?.() ?? 'Sick',
                    icon: AlertCircle,
                    class: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                };
            case 'unpaid':
                return {
                    label: m.leave_unpaid?.() ?? 'Unpaid',
                    icon: Briefcase,
                    class: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                };
            default:
                return {
                    label: m.leave_other?.() ?? type,
                    icon: Calendar,
                    class: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                };
        }
    }

    function getSourceIcon(type: string) {
        switch (type.toLowerCase()) {
            case 'vacation':
                return Umbrella;
            case 'special':
                return Briefcase;
            case 'tenure':
            case 'bonus_conversion':
                return Sparkles;
            default:
                return Calendar;
        }
    }
</script>

{#if !talentId}
    <div class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center text-gray-500">
        <Info class="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p class="text-sm font-medium">Please select a talent to load absence awareness.</p>
    </div>
{:else if loading && !awareness}
    <div class="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 animate-pulse space-y-4">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800"></div>
            <div class="space-y-2 flex-1">
                <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
                <div class="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
            </div>
        </div>
        <div class="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
        <div class="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
    </div>
{:else if awareness}
    <div class="space-y-4 text-gray-900 dark:text-gray-100 {compact ? 'text-sm' : ''}">
        
        <!-- HEADER: Talent Info & Tags -->
        <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-950 dark:to-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-base shadow-sm shrink-0">
                    {awareness.talent.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 class="font-bold text-gray-900 dark:text-white leading-tight {compact ? 'text-base' : 'text-lg'}">
                        {awareness.talent.displayName}
                    </h3>
                    <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <Briefcase class="w-3.5 h-3.5 text-gray-400" />
                        <span>{awareness.talent.jobTitle}</span>
                        {#if awareness.contract?.wageTable}
                            <span class="text-gray-300 dark:text-gray-700">•</span>
                            <span class="font-medium text-amber-600 dark:text-amber-400">{awareness.contract.wageTable}</span>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Tags -->
            {#if awareness.talent.tags && awareness.talent.tags.length > 0}
                <div class="flex flex-wrap items-center gap-1.5">
                    {#each awareness.talent.tags as t (t.id)}
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Tag class="w-3 h-3 text-amber-500" />
                            {t.name}
                        </span>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- ALLOTMENT & BALANCES OVERVIEW -->
        {#if balances}
            <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                            <Umbrella class="w-4 h-4" />
                        </div>
                        <h4 class="font-bold text-gray-900 dark:text-white {compact ? 'text-sm' : 'text-base'}">
                            Year {balances.year} Leave Balance
                        </h4>
                    </div>
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {balances.remainingDays} days available
                    </span>
                </div>

                <!-- Visual Progress Bar -->
                <div class="space-y-1.5">
                    <div class="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
                        {#if usedPercent > 0}
                            <div
                                class="bg-rose-500 h-full transition-all duration-300"
                                style="width: {usedPercent}%"
                                title={`Used: ${balances.usedDays} days (${usedPercent}%)`}
                            ></div>
                        {/if}
                        {#if pendingPercent > 0}
                            <div
                                class="bg-amber-400 h-full transition-all duration-300"
                                style="width: {pendingPercent}%"
                                title={`Pending: ${balances.pendingDays} days (${pendingPercent}%)`}
                            ></div>
                        {/if}
                        {#if remainingPercent > 0}
                            <div
                                class="bg-emerald-500 h-full transition-all duration-300"
                                style="width: {remainingPercent}%"
                                title={`Remaining: ${balances.remainingDays} days (${remainingPercent}%)`}
                            ></div>
                        {/if}
                    </div>

                    <div class="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-0.5">
                        <span>{usedDays + pendingDays} deducted</span>
                        <span>{balances.totalDays} days total entitlement</span>
                    </div>
                </div>

                <!-- Balance Breakdown Cards Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 text-center">
                        <div class="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Allotment</div>
                        <div class="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                            {balances.totalDays} <span class="text-xs font-normal text-gray-500">days</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-center">
                        <div class="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center justify-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-rose-500"></span> Used
                        </div>
                        <div class="text-lg font-bold text-rose-800 dark:text-rose-200 mt-0.5">
                            {balances.usedDays} <span class="text-xs font-normal text-rose-600 dark:text-rose-400">days</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-center">
                        <div class="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center justify-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-400"></span> Pending
                        </div>
                        <div class="text-lg font-bold text-amber-800 dark:text-amber-200 mt-0.5">
                            {balances.pendingDays} <span class="text-xs font-normal text-amber-600 dark:text-amber-400">days</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center">
                        <div class="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Remaining
                        </div>
                        <div class="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                            {balances.remainingDays} <span class="text-xs font-normal text-emerald-600 dark:text-emerald-400">days</span>
                        </div>
                    </div>
                </div>

                <!-- Breakdown of Allotment Sources -->
                {#if awareness.allotmentSources && awareness.allotmentSources.length > 0}
                    <div class="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Allotment Sources & Entitlements
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {#each awareness.allotmentSources as src (src.source)}
                                {@const SourceIcon = getSourceIcon(src.type)}
                                <div class="p-2.5 rounded-xl bg-gray-50/70 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 flex items-start gap-2.5">
                                    <div class="p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                                        <SourceIcon class="w-3.5 h-3.5" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">
                                                {src.source}
                                            </span>
                                            {#if src.days !== null}
                                                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100/80 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                                                    {src.days} days
                                                </span>
                                            {:else}
                                                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/80 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                                                    Eligible
                                                </span>
                                            {/if}
                                        </div>
                                        <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                            {src.description}
                                        </p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- LIVE REQUEST IMPACT & PUBLIC HOLIDAYS -->
        {#if impact}
            <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-gray-900 dark:to-amber-950/10 border border-amber-200/80 dark:border-amber-800/60 shadow-sm space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <div class="p-1.5 rounded-lg bg-amber-500 text-white shadow-sm">
                            <Clock class="w-4 h-4" />
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900 dark:text-white {compact ? 'text-sm' : 'text-base'}">
                                Request Working Day Impact
                            </h4>
                            {#if selectedStartDate && selectedEndDate}
                                <span class="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDate(selectedStartDate)} – {formatDate(selectedEndDate)}
                                </span>
                            {/if}
                        </div>
                    </div>
                    
                    <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-sm self-start sm:self-auto">
                        <span>{impact.workingDays} working {impact.workingDays === 1 ? 'day' : 'days'}</span>
                    </div>
                </div>

                <!-- Span Metrics Breakdown -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div class="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-gray-700">
                        <div class="text-gray-500 dark:text-gray-400">Calendar Span</div>
                        <div class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{impact.calendarDays} days</div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-gray-700">
                        <div class="text-gray-500 dark:text-gray-400">Weekend Days</div>
                        <div class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{impact.weekendDays} days</div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-gray-700">
                        <div class="text-gray-500 dark:text-gray-400">Public Holidays</div>
                        <div class="font-bold text-sm text-amber-600 dark:text-amber-400 mt-0.5">{impact.holidayDays} days</div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-gray-700">
                        <div class="text-gray-500 dark:text-gray-400">Eve Days Off</div>
                        <div class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{impact.eveDays} days</div>
                    </div>
                </div>

                <!-- Projected Balance Shift -->
                {#if balances}
                    <div class="p-3 rounded-xl bg-white dark:bg-gray-800/80 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs sm:text-sm">
                        <span class="font-medium text-gray-600 dark:text-gray-300">Projected Remaining Balance:</span>
                        <div class="flex items-center gap-2">
                            <span class="line-through text-gray-400">{balances.remainingDays} days</span>
                            <span class="font-bold text-base {impact.projectedRemainingDays <= 2 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                → {impact.projectedRemainingDays} days
                            </span>
                        </div>
                    </div>
                {/if}

                <!-- Holidays in Request Window -->
                {#if impact.holidays && impact.holidays.length > 0}
                    <div class="space-y-1.5 pt-1">
                        <div class="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                            <Calendar class="w-3.5 h-3.5 text-amber-500" />
                            <span>Public Holidays during requested period:</span>
                        </div>
                        <div class="space-y-1">
                            {#each impact.holidays as h (h.date + h.name)}
                                <div class="px-3 py-2 rounded-lg bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 flex items-center justify-between text-xs">
                                    <div class="flex items-center gap-2">
                                        <span class="font-semibold text-gray-900 dark:text-white">{h.name}</span>
                                        {#if h.nameDe && h.nameDe !== h.name}
                                            <span class="text-gray-500 dark:text-gray-400 italic">({h.nameDe})</span>
                                        {/if}
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        {#if h.isEveDay}
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                                Eve Day
                                            </span>
                                        {:else if h.isStateSpecific}
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                {h.state || 'State'}
                                            </span>
                                        {/if}
                                        <span class="font-mono text-gray-600 dark:text-gray-300">{formatDate(h.date)}</span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- STATUTORY PUBLIC HOLIDAYS (Collapsible) -->
        {#if awareness.publicHolidays && awareness.publicHolidays.length > 0}
            <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <button
                    type="button"
                    onclick={() => (showYearHolidays = !showYearHolidays)}
                    class="w-full px-4 py-3 text-left flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                    <div class="flex items-center gap-2">
                        <Calendar class="w-4 h-4 text-amber-500" />
                        <span>Statutory Public Holidays ({balances?.year ?? new Date().getFullYear()})</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            {awareness.publicHolidays.length}
                        </span>
                    </div>
                    {#if showYearHolidays}
                        <ChevronUp class="w-4 h-4 text-gray-400" />
                    {:else}
                        <ChevronDown class="w-4 h-4 text-gray-400" />
                    {/if}
                </button>

                {#if showYearHolidays}
                    <div class="p-3 pt-0 border-t border-gray-100 dark:border-gray-800 max-h-56 overflow-y-auto space-y-1">
                        {#each awareness.publicHolidays as h (h.date + h.name)}
                            <div class="px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 flex items-center justify-between text-xs transition-colors">
                                <div class="flex items-center gap-2 truncate">
                                    <span class="font-medium text-gray-800 dark:text-gray-200">{h.name}</span>
                                    {#if h.nameDe && h.nameDe !== h.name}
                                        <span class="text-gray-400 text-[11px] truncate">({h.nameDe})</span>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    {#if h.isEveDay}
                                        <span class="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300">Eve</span>
                                    {:else if h.isStateSpecific}
                                        <span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">{h.state || 'State'}</span>
                                    {/if}
                                    <span class="font-mono text-gray-500 dark:text-gray-400">{formatDate(h.date)}</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- ABSENCE HISTORY & SCHEDULE TABS -->
        <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    <button
                        type="button"
                        onclick={() => (activeTab = 'planned')}
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'planned' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}"
                    >
                        Planned Absences ({awareness.plannedAbsences?.length ?? 0})
                    </button>
                    <button
                        type="button"
                        onclick={() => (activeTab = 'previous')}
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'previous' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}"
                    >
                        Previous Absences ({awareness.previousAbsences?.length ?? 0})
                    </button>
                </div>
            </div>

            <!-- List Content -->
            {#if activeTab === 'planned'}
                {@const planned = awareness.plannedAbsences ?? []}
                {#if planned.length === 0}
                    <div class="py-8 text-center text-gray-400 dark:text-gray-500">
                        <Calendar class="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p class="text-xs font-medium">No planned absences scheduled.</p>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each planned as item (item.id)}
                            {@const tb = getTypeBadge(item.type)}
                            {@const sb = getStatusBadge(item.status)}
                            {@const TypeIcon = tb.icon}
                            {@const StatusIcon = sb.icon}
                            <div class="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div class="flex items-start gap-2.5">
                                    <div class="p-2 rounded-lg border {tb.class} shrink-0 mt-0.5">
                                        <TypeIcon class="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-xs uppercase tracking-wide text-gray-900 dark:text-white">{tb.label}</span>
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border {sb.class}">
                                                <StatusIcon class="w-3 h-3" />
                                                {sb.label}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                            <Calendar class="w-3.5 h-3.5 text-amber-500" />
                                            <span>{formatDate(item.startDate)} – {formatDate(item.endDate)}</span>
                                        </div>
                                        {#if item.reason}
                                            <p class="text-[11px] text-gray-500 dark:text-gray-400 italic mt-1 line-clamp-1">
                                                "{item.reason}"
                                            </p>
                                        {/if}
                                    </div>
                                </div>
                                <div class="shrink-0 self-end sm:self-center font-bold text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
                                    {item.days} {item.days === 1 ? 'day' : 'days'}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {:else}
                {@const previous = awareness.previousAbsences ?? []}
                {#if previous.length === 0}
                    <div class="py-8 text-center text-gray-400 dark:text-gray-500">
                        <Clock class="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p class="text-xs font-medium">No previous absences recorded.</p>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each previous as item (item.id)}
                            {@const tb = getTypeBadge(item.type)}
                            {@const sb = getStatusBadge(item.status)}
                            {@const TypeIcon = tb.icon}
                            {@const StatusIcon = sb.icon}
                            <div class="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div class="flex items-start gap-2.5">
                                    <div class="p-2 rounded-lg border {tb.class} shrink-0 mt-0.5">
                                        <TypeIcon class="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-xs uppercase tracking-wide text-gray-900 dark:text-white">{tb.label}</span>
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border {sb.class}">
                                                <StatusIcon class="w-3 h-3" />
                                                {sb.label}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                            <Calendar class="w-3.5 h-3.5 text-amber-500" />
                                            <span>{formatDate(item.startDate)} – {formatDate(item.endDate)}</span>
                                        </div>
                                        {#if item.reason}
                                            <p class="text-[11px] text-gray-500 dark:text-gray-400 italic mt-1 line-clamp-1">
                                                "{item.reason}"
                                            </p>
                                        {/if}
                                    </div>
                                </div>
                                <div class="shrink-0 self-end sm:self-center font-bold text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
                                    {item.days} {item.days === 1 ? 'day' : 'days'}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>

    </div>
{/if}
