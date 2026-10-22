<script lang="ts">
    import { format } from 'date-fns';
    import { completeTask, listTasks, listCompletedTasks, executeGdprObfuscationTask } from '../../../routes/tasks.remote.js';
    import { invokeManageTimesheets } from '../../../routes/my-timesheet/timesheets.remote.js';
    import { readCondition } from '../../../routes/conditions.remote.js';
    import ConditionReviewModal from '../conditions/ConditionReviewModal.svelte';
    import DifferentialContractModal from './DifferentialContractModal.svelte';
    import { toast } from 'svelte-sonner';
    import { ShieldAlert, TrendingUp, Award, Clock, UserX } from '@lucide/svelte';

    let { task }: { task: any } = $props();

    let isReviewModalOpen = $state(false);
    let isDifferentialModalOpen = $state(false);
    let conditionData = $state<any>(null);
    let isLoadingCondition = $state(false);
    let isCompleting = $state(false);
    let isApprovingTimesheet = $state(false);
    let isRejectingTimesheet = $state(false);

    async function openReviewModal() {
        if (!task.data?.conditionId) {
            toast.error('Konditions-ID nicht gefunden.');
            return;
        }
        isLoadingCondition = true;
        try {
            const condition = await readCondition({
                id: task.data.conditionId,
                type: task.data.updateType || 'social_insurance'
            });
            conditionData = condition;
            isReviewModalOpen = true;
        } catch (err: any) {
            toast.error(err?.message || 'Fehler beim Laden der Konditionsdaten.');
        } finally {
            isLoadingCondition = false;
        }
    }

    const typeColors: Record<string, string> = {
        experience_step_increase: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        tenure_anniversary: 'bg-amber-50 text-amber-800 border-amber-200',
        condition_update_approval: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        timesheet_approval: 'bg-amber-50 text-amber-700 border-amber-100',
        profile_update: 'bg-blue-50 text-blue-700 border-blue-100',
        correction: 'bg-rose-50 text-rose-700 border-rose-100',
        manual: 'bg-gray-50 text-gray-700 border-gray-100',
        gdpr_obfuscation: 'bg-rose-50 text-rose-800 border-rose-200'
    };

    const typeLabels: Record<string, string> = {
        experience_step_increase: 'Tariflicher Stufenaufstieg',
        tenure_anniversary: 'Dienstjubiläum & Tenure',
        condition_update_approval: 'Tarif / HMO Freigabe',
        timesheet_approval: 'Zeiterfassung',
        profile_update: 'Profilaktualisierung',
        correction: 'Korrektur',
        manual: 'Aufgabe',
        gdpr_obfuscation: 'DSGVO Anonymisierung'
    };
</script>

<div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between gap-4">
    {#if task.type === 'experience_step_increase'}
        <div class="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-emerald-500/10 via-emerald-400/5 to-transparent rounded-bl-3xl pointer-events-none"></div>
    {:else if task.type === 'condition_update_approval'}
        <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-bl-3xl pointer-events-none"></div>
    {:else if task.type === 'tenure_anniversary'}
        <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-3xl pointer-events-none"></div>
    {/if}

    <div class="flex items-start justify-between gap-4">
        <div class="flex gap-4">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-all shrink-0">
                {#if task.type === 'experience_step_increase'}
                    <TrendingUp class="w-6 h-6 text-emerald-600" />
                {:else if task.type === 'tenure_anniversary'}
                    <Award class="w-6 h-6 text-amber-600" />
                {:else if task.type === 'condition_update_approval'}
                    <ShieldAlert class="w-6 h-6 text-indigo-600" />
                {:else if task.type === 'timesheet_approval'}
                    <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {:else if task.type === 'correction'}
                    <svg class="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                {:else if task.type === 'gdpr_obfuscation'}
                    <UserX class="w-6 h-6 text-rose-600" />
                {:else}
                    <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                {/if}
            </div>

            <div class="space-y-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border {typeColors[task.type] || typeColors.manual}">
                        {typeLabels[task.type] || task.type.replace('_', ' ')}
                    </span>
                    {#if task.targetRoles}
                        <span class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Shared Queue (Management & HR)
                        </span>
                    {/if}
                    {#if task.dueDate}
                        <span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock class="w-2.5 h-2.5" />
                            Fällig: {format(new Date(task.dueDate), 'dd.MM.yyyy')}
                        </span>
                    {:else}
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {format(new Date(task.createdAt), 'MMM d, HH:mm')}
                        </span>
                    {/if}
                </div>

                <h3 class="text-sm font-black text-gray-900 leading-snug">{task.title}</h3>
                <p class="text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>
                
                <!-- Extra badge pill for Step Increase -->
                {#if task.type === 'experience_step_increase' && task.data}
                    <div class="pt-1 flex items-center gap-2 flex-wrap">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {task.data.entgeltgruppe} Stufe {task.data.currentStufe} ➔ Stufe {task.data.nextStufe}
                        </span>
                        {#if task.data.deltaWage}
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-100/70 text-emerald-900">
                                +{Number(task.data.deltaWage).toFixed(2)} € / Monat
                            </span>
                        {/if}
                    </div>
                {:else if task.type === 'tenure_anniversary' && task.data}
                    <div class="pt-1 flex items-center gap-2 flex-wrap">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                            {task.data.milestoneYears} Jahre Jubiläum
                        </span>
                        {#if task.data.bonus}
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100/70 text-amber-900">
                                {task.data.bonus} € Jubiläumszuwendung
                            </span>
                        {/if}
                    </div>
                {/if}

                {#if task.assignee?.contact}
                    <div class="mt-2 flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600 uppercase">
                            {(task.assignee.contact.givenName || task.assignee.contact.displayName || 'U')[0]}
                        </div>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Zugewiesen an {task.assignee.contact.displayName || `${task.assignee.contact.givenName || ''} ${task.assignee.contact.familyName || ''}`.trim()}
                        </span>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2 shrink-0 self-start">
            {#if task.type === 'experience_step_increase'}
                <button
                    type="button"
                    onclick={() => isDifferentialModalOpen = true}
                    class="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 whitespace-nowrap"
                >
                    <TrendingUp class="w-3.5 h-3.5" />
                    Änderungsvertrag ausstellen
                </button>
            {:else if task.type === 'condition_update_approval'}
                <button
                    type="button"
                    onclick={openReviewModal}
                    disabled={isLoadingCondition}
                    class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 whitespace-nowrap"
                >
                    {isLoadingCondition ? 'Laden...' : 'Prüfen & Freigeben'}
                </button>
            {:else if task.type === 'timesheet_approval'}
                <button
                    type="button"
                    disabled={isApprovingTimesheet || isRejectingTimesheet}
                    onclick={async () => {
                        isApprovingTimesheet = true;
                        try {
                            await invokeManageTimesheets({ action: 'approve', entryId: task.data?.timesheetEntryId });
                            toast.success('Timesheet freigegeben');
                            void listTasks().refresh();
                            void listCompletedTasks().refresh();
                        } catch (err: any) {
                            toast.error(err?.message || 'Fehler bei der Freigabe');
                        } finally {
                            isApprovingTimesheet = false;
                        }
                    }}
                    class="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                    {isApprovingTimesheet ? 'Laden...' : 'Freigeben'}
                </button>

                <button
                    type="button"
                    disabled={isApprovingTimesheet || isRejectingTimesheet}
                    onclick={async () => {
                        isRejectingTimesheet = true;
                        try {
                            await invokeManageTimesheets({ action: 'reject', entryId: task.data?.timesheetEntryId, comment: 'Rejected via task manager' });
                            toast.success('Timesheet abgelehnt');
                            void listTasks().refresh();
                            void listCompletedTasks().refresh();
                        } catch (err: any) {
                            toast.error(err?.message || 'Fehler beim Ablehnen');
                        } finally {
                            isRejectingTimesheet = false;
                        }
                    }}
                    class="w-full px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                    {isRejectingTimesheet ? 'Laden...' : 'Ablehnen'}
                </button>
            {:else if task.type === 'gdpr_obfuscation'}
                <button
                    type="button"
                    disabled={isCompleting}
                    onclick={async () => {
                        if (!task.data?.contactId) {
                            toast.error('Kontakt-ID fehlt in dieser Aufgabe.');
                            return;
                        }
                        if (!confirm('Möchten Sie diesen Kontakt jetzt wirklich unwiderruflich obfuskieren / anonymisieren?')) {
                            return;
                        }
                        isCompleting = true;
                        try {
                            await executeGdprObfuscationTask({
                                contactId: task.data.contactId,
                                gdprRequestId: task.data.gdprRequestId,
                                notes: 'Über Objective Center (Task Manager) freigegeben und obfuskiert'
                            });
                            toast.success('Kontakt erfolgreich obfuskiert und Aufgabe erledigt');
                            void listTasks().refresh();
                            void listCompletedTasks().refresh();
                        } catch (err: any) {
                            toast.error(err?.message || 'Fehler bei der Obfuskierung');
                        } finally {
                            isCompleting = false;
                        }
                    }}
                    class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                    <UserX class="w-3.5 h-3.5" />
                    {isCompleting ? 'Wird obfuskiert...' : 'Jetzt Obfuskieren'}
                </button>
            {:else}
                <button
                    type="button"
                    disabled={isCompleting}
                    onclick={async () => {
                        isCompleting = true;
                        try {
                            await completeTask({ taskId: task.id });
                            toast.success('Aufgabe erledigt');
                            void listTasks().refresh();
                            void listCompletedTasks().refresh();
                        } catch (err: any) {
                            toast.error(err?.message || 'Fehler beim Abschließen der Aufgabe');
                        } finally {
                            isCompleting = false;
                        }
                    }}
                    class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap disabled:opacity-50"
                >
                    {isCompleting ? 'Wird erledigt...' : 'Erledigen'}
                </button>
            {/if}
        </div>
    </div>
</div>

{#if isReviewModalOpen && conditionData}
    <ConditionReviewModal
        condition={conditionData}
        type={task.data?.updateType || 'social_insurance'}
        open={true}
        onClose={() => { isReviewModalOpen = false; }}
        onApproved={async () => {
            isReviewModalOpen = false;
            void listTasks().refresh();
            void listCompletedTasks().refresh();
        }}
    />
{/if}

{#if isDifferentialModalOpen}
    <DifferentialContractModal
        {task}
        open={true}
        onClose={() => { isDifferentialModalOpen = false; }}
        onIssued={async () => {
            isDifferentialModalOpen = false;
            void listTasks().refresh();
            void listCompletedTasks().refresh();
        }}
    />
{/if}
