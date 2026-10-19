<script lang="ts">
    import { issueDifferentialContractUpdate, listTasks, listCompletedTasks } from '../../../routes/tasks.remote.js';
    import { listContracts } from '../../../routes/contracts/list.remote.js';
    import { issueDifferentialContractUpdateSchema } from '@ac/validations';
    import { AsyncButton, useFormValidationFeedback } from '@ac/ui';
    import { toast } from 'svelte-sonner';
    import { X, TrendingUp, Calendar, FileText, CheckCircle2, AlertCircle, Sparkles } from '@lucide/svelte';
    import { format } from 'date-fns';

    let {
        task,
        open = false,
        onClose,
        onIssued,
    }: {
        task: any;
        open: boolean;
        onClose: () => void;
        onIssued?: () => void;
    } = $props();

    const idcu = issueDifferentialContractUpdate.preflight(issueDifferentialContractUpdateSchema);
    const feedback = useFormValidationFeedback(() => idcu);

    const taskData = $derived(task?.data || {});
    const talentName = $derived(taskData.talentName || 'Mitarbeiter/in');
    const entgeltgruppe = $derived(taskData.entgeltgruppe || 'E 9b');
    const currentStufe = $derived(Number(taskData.currentStufe) || 1);
    const nextStufe = $derived(Number(taskData.nextStufe) || currentStufe + 1);
    const currentWage = $derived(Number(taskData.currentWage) || 0);
    const initialNextWage = $derived(Number(taskData.nextWage) || currentWage);
    const initialEffectiveDate = $derived(
        taskData.effectiveDate ? String(taskData.effectiveDate).split('T')[0] : format(new Date(), 'yyyy-MM-dd')
    );

    let effectiveDate = $state('');
    let newWageAmount = $state(0);
    let notes = $state('Regulärer tariflicher Stufenaufstieg gem. Stufenlaufzeit');
    let scheduleReport = $state(true);

    $effect(() => {
        effectiveDate = initialEffectiveDate;
        newWageAmount = initialNextWage;
    });

    const calculatedDelta = $derived(Math.round((newWageAmount - currentWage) * 100) / 100);
    const deltaPercent = $derived(
        currentWage > 0 ? ((calculatedDelta / currentWage) * 100).toFixed(1) : '0.0'
    );
</script>

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div class="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="p-6 md:p-8 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white relative">
                <button
                    type="button"
                    onclick={onClose}
                    class="absolute top-6 right-6 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
                >
                    <X class="w-5 h-5" />
                </button>

                <div class="flex items-center gap-3 mb-2">
                    <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp class="w-3.5 h-3.5" />
                        Tariflicher Stufenaufstieg
                    </span>
                    <span class="text-xs text-indigo-200 font-bold tracking-wider uppercase">
                        Änderungsvereinbarung
                    </span>
                </div>
                <h2 class="text-2xl font-black tracking-tight">{talentName}</h2>
                <p class="text-xs text-indigo-200/80 mt-1">
                    Übernahme der neuen Erfahrungsstufe und automatische Ausfertigung des differenziellen Änderungsvertrags.
                </p>
            </div>

            <!-- Body -->
            <form
                {...idcu.preflight(issueDifferentialContractUpdateSchema).enhance(async ({ submit }) => {
                    const res = await submit() as any;
                    if (res?.success) {
                        toast.success('Änderungsvereinbarung erfolgreich erstellt!', {
                            description: `Neues Entgelt: ${newWageAmount.toFixed(2)} € (+${calculatedDelta.toFixed(2)} €).`
                        });
                        void listTasks().refresh();
                        void listCompletedTasks().refresh();
                        void listContracts().refresh();
                        if (onIssued) onIssued();
                        onClose();
                    }
                })}
                class="p-6 md:p-8 space-y-6 overflow-y-auto flex-1"
            >
                {#if task?.id}
                    <input {...idcu.fields.taskId.as('hidden', task.id)} />
                {/if}
                {#if taskData.contractId}
                    <input {...idcu.fields.contractId.as('hidden', taskData.contractId)} />
                {/if}
                {#if taskData.talentId}
                    <input {...idcu.fields.talentId.as('hidden', taskData.talentId)} />
                {/if}
                {#if entgeltgruppe}
                    <input {...idcu.fields.newEntgeltgruppe.as('hidden', entgeltgruppe)} />
                {/if}
                {#if nextStufe}
                    <input {...idcu.fields.newStufe.as('hidden', nextStufe)} />
                {/if}

                <!-- Stage Progression Visual Card -->
                <div class="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between gap-4">
                    <div class="space-y-1">
                        <span class="text-[10px] font-black uppercase tracking-wider text-indigo-600">Bisherige Stufe</span>
                        <div class="text-xl font-black text-gray-800">
                            {entgeltgruppe} <span class="text-indigo-600">Stufe {currentStufe}</span>
                        </div>
                        <div class="text-xs font-semibold text-gray-500">
                            {currentWage.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € / Monat
                        </div>
                    </div>

                    <div class="w-10 h-10 rounded-full bg-white shadow-sm border border-indigo-100 flex items-center justify-center text-indigo-600">
                        ➔
                    </div>

                    <div class="space-y-1 text-right">
                        <span class="text-[10px] font-black uppercase tracking-wider text-emerald-600">Neue Stufe (Aufstieg)</span>
                        <div class="text-xl font-black text-gray-900">
                            {entgeltgruppe} <span class="text-emerald-600">Stufe {nextStufe}</span>
                        </div>
                        <div class="text-xs font-bold text-emerald-700">
                            +{calculatedDelta.toFixed(2)} € ({deltaPercent}%)
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Effective Date -->
                    <label class="block">
                        <span class="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                            <Calendar class="w-3.5 h-3.5 text-indigo-600" />
                            Wirksamkeitsdatum
                        </span>
                        <input
                            {...idcu.fields.effectiveDate.as('text')}
                            type="date"
                            value={effectiveDate}
                            oninput={(e) => effectiveDate = e.currentTarget.value}
                            class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        {#each idcu.fields.effectiveDate.issues() ?? [] as issue}
                            <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                        {/each}
                    </label>

                    <!-- New Wage Amount (editable) -->
                    <label class="block">
                        <span class="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                            <TrendingUp class="w-3.5 h-3.5 text-emerald-600" />
                            Neues Monatsbrutto (€)
                        </span>
                        <input
                            {...idcu.fields.newWageAmount.as('number')}
                            type="number"
                            step="0.01"
                            value={newWageAmount}
                            oninput={(e) => newWageAmount = Number(e.currentTarget.value)}
                            class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        {#each idcu.fields.newWageAmount.issues() ?? [] as issue}
                            <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                        {/each}
                    </label>
                </div>

                <!-- Notes -->
                <label class="block">
                    <span class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">
                        Hinweise / Begründung zur Änderungsvereinbarung
                    </span>
                    <textarea
                        {...idcu.fields.notes.as('text')}
                        rows="2"
                        value={notes}
                        oninput={(e) => notes = e.currentTarget.value}
                        class="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Optionale Notizen für das Personalakten-Audit..."
                    ></textarea>
                </label>

                <!-- Reporting Feature Prompt Hook -->
                <div class="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-3">
                    <input
                        {...idcu.fields.scheduleReport.as('checkbox')}
                        id="reporting_checkbox"
                        checked={scheduleReport}
                        onchange={(e) => scheduleReport = e.currentTarget.checked}
                        class="mt-1 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label for="reporting_checkbox" class="text-xs text-amber-950 font-medium cursor-pointer">
                        <span class="font-bold flex items-center gap-1.5 text-amber-900">
                            <Sparkles class="w-3.5 h-3.5 text-amber-600" />
                            Berichtsvormerkung für das Reporting-Modul aktivieren
                        </span>
                        Registriert diese Entgeltänderung für den automatisierten Monats- und Quartalsbericht (Betriebsrat / Geschäftsführung) im zukünftigen Reporting-Feature.
                    </label>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onclick={onClose}
                        class="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all uppercase tracking-wider"
                    >
                        Abbrechen
                    </button>

                    <AsyncButton
                        type="submit"
                        loading={idcu.pending}
                        class="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
                    >
                        <CheckCircle2 class="w-4 h-4" />
                        Änderungsvertrag ausstellen
                    </AsyncButton>
                </div>
            </form>
        </div>
    </div>
{/if}
