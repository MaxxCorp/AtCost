<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { reviewTimeOffRequest } from "../../../routes/time-off/time-off.remote";
    import TalentAbsenceContext from "./TalentAbsenceContext.svelte";
    import TeamSurroundingAbsences from "./TeamSurroundingAbsences.svelte";
    import * as Dialog from "@ac/ui/components/dialog";
    import { Button, AsyncButton } from "@ac/ui";
    import { toast } from "svelte-sonner";
    import {
        CheckCircle2,
        XCircle,
        ShieldCheck,
        Calendar,
        Users,
        MessageSquare,
        Clock
    } from "@lucide/svelte";

    interface Props {
        open: boolean;
        request: any | null;
        onClose: () => void;
        onSuccess?: () => void;
    }

    let { open = $bindable(false), request, onClose, onSuccess }: Props = $props();

    // Tab state: 'talent' (context & balances) or 'team' (coverage & overlaps)
    let activeTab = $state<'talent' | 'team'>('talent');

    // Manager comment state
    let managerComment = $state("");
    let prevRequestId = $state<string | undefined>(undefined);
    let prevOpen = $state(false);

    // Sync manager comment when request or dialog open state changes
    $effect(() => {
        const isNowOpen = open;
        const currentId = request?.id;
        if ((isNowOpen && !prevOpen) || currentId !== prevRequestId) {
            prevRequestId = currentId;
            prevOpen = isNowOpen;
            managerComment = request?.managerComment ?? "";
        } else {
            prevOpen = isNowOpen;
        }
    });

    // Form submission states
    let isSubmitting = $state(false);
    let actionType = $state<'approve' | 'reject' | null>(null);

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

    function toDateString(d: string | Date | null | undefined): string {
        if (!d) return '';
        if (d instanceof Date) return d.toISOString().split('T')[0];
        if (typeof d === 'string') return d.split('T')[0];
        return String(d);
    }

    const talentName = $derived(request?.talentName || 'Colleague');
    const startDateStr = $derived(toDateString(request?.startDate));
    const endDateStr = $derived(toDateString(request?.endDate));

    const durationDays = $derived.by(() => {
        if (!request?.startDate || !request?.endDate) return 0;
        try {
            const start = new Date(request.startDate).getTime();
            const end = new Date(request.endDate).getTime();
            if (isNaN(start) || isNaN(end)) return 0;
            return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
        } catch {
            return 0;
        }
    });

    async function handleApprove() {
        if (!request) return;
        isSubmitting = true;
        actionType = 'approve';
        try {
            await reviewTimeOffRequest({
                requestId: request.id,
                action: 'approve',
                comment: managerComment || undefined
            });
            toast.success((m as any).request_approved?.() ?? "Absence request approved");
            open = false;
            onSuccess?.();
        } catch (e: any) {
            toast.error(e?.message || "Failed to approve request");
        } finally {
            isSubmitting = false;
            actionType = null;
        }
    }

    async function handleReject() {
        if (!request) return;
        isSubmitting = true;
        actionType = 'reject';
        try {
            await reviewTimeOffRequest({
                requestId: request.id,
                action: 'reject',
                comment: managerComment || undefined
            });
            toast.success((m as any).request_rejected?.() ?? "Absence request rejected");
            open = false;
            onSuccess?.();
        } catch (e: any) {
            toast.error(e?.message || "Failed to reject request");
        } finally {
            isSubmitting = false;
            actionType = null;
        }
    }
</script>

<Dialog.Root
    bind:open
    onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
            onClose();
        }
    }}
>
    <Dialog.Content class="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <!-- Header -->
        <Dialog.Header class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <ShieldCheck class="w-5 h-5" />
                </div>
                <div>
                    <Dialog.Title class="text-lg font-bold text-gray-900 dark:text-white">
                        {(m as any).review_absence_request?.() ?? "Review Absence Request"}
                    </Dialog.Title>
                    <Dialog.Description class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {"Review talent balances, team impact, and approve or reject this leave request."}
                    </Dialog.Description>
                </div>
            </div>
        </Dialog.Header>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {#if request}
                <!-- Request Overview Card -->
                <div class="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3.5">
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-base">
                            {talentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-gray-900 dark:text-white text-base">
                                    {talentName}
                                </span>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                                    {request.type}
                                </span>
                            </div>
                            <div class="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-1">
                                <div class="flex items-center gap-1.5">
                                    <Calendar class="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>{formatDate(request.startDate)} – {formatDate(request.endDate)}</span>
                                </div>
                                {#if durationDays > 0}
                                    <div class="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                                        <Clock class="w-3.5 h-3.5 shrink-0" />
                                        <span>{durationDays} {durationDays === 1 ? 'day' : 'days'}</span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    {#if request.reason}
                        <div class="max-w-md text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800/80 px-3.5 py-2.5 rounded-xl border border-amber-100 dark:border-gray-700 italic">
                            "{request.reason}"
                        </div>
                    {/if}
                </div>

                <!-- Tab Navigation -->
                <div class="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <button
                        type="button"
                        onclick={() => (activeTab = 'talent')}
                        class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all {activeTab === 'talent' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}"
                    >
                        <Calendar class="w-4 h-4 text-amber-500" />
                        <span>Talent Context & Balances</span>
                    </button>
                    <button
                        type="button"
                        onclick={() => (activeTab = 'team')}
                        class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all {activeTab === 'team' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}"
                    >
                        <Users class="w-4 h-4 text-indigo-500" />
                        <span>Team Coverage & Overlaps</span>
                    </button>
                </div>

                <!-- Tab Content Panel -->
                <div class="min-h-[280px]">
                    {#if activeTab === 'talent'}
                        <TalentAbsenceContext
                            talentId={request.talentId}
                            currentRequestId={request.id}
                            selectedStartDate={startDateStr}
                            selectedEndDate={endDateStr}
                            selectedType={request.type}
                            compact={true}
                        />
                    {:else}
                        <TeamSurroundingAbsences
                            startDate={startDateStr}
                            endDate={endDateStr}
                            excludeTalentId={request.talentId}
                        />
                    {/if}
                </div>

                <!-- Manager Note / Decision Comment Section -->
                <div class="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <label for="manager-comment" class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <MessageSquare class="w-3.5 h-3.5 text-gray-400" />
                        <span>Manager Note / Decision Comment</span>
                    </label>
                    <textarea
                        id="manager-comment"
                        bind:value={managerComment}
                        rows={3}
                        placeholder="Add an optional comment or explanation for this decision..."
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-gray-900 transition-all resize-none"
                    ></textarea>
                </div>
            {:else}
                <div class="py-12 text-center text-gray-400 dark:text-gray-500">
                    <Clock class="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p class="text-sm font-medium">No request selected.</p>
                </div>
            {/if}
        </div>

        <!-- Dialog Footer -->
        <Dialog.Footer class="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/40 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onclick={() => {
                    open = false;
                    onClose();
                }}
            >
                {m.cancel ? m.cancel() : "Cancel"}
            </Button>

            <div class="flex items-center gap-2">
                <AsyncButton
                    type="button"
                    variant="destructive"
                    loading={isSubmitting && actionType === 'reject'}
                    disabled={isSubmitting || !request}
                    onclick={handleReject}
                    class="bg-rose-600 hover:bg-rose-700 text-white"
                >
                    <XCircle class="w-4 h-4 mr-1.5" />
                    <span>{(m as any).reject?.() ?? m.status_rejected?.() ?? "Reject"}</span>
                </AsyncButton>

                <AsyncButton
                    type="button"
                    loading={isSubmitting && actionType === 'approve'}
                    disabled={isSubmitting || !request}
                    onclick={handleApprove}
                    class="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    <CheckCircle2 class="w-4 h-4 mr-1.5" />
                    <span>{(m as any).approve?.() ?? m.status_approved?.() ?? "Approve"}</span>
                </AsyncButton>
            </div>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
