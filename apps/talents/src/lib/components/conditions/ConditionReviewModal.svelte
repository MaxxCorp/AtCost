<script lang="ts">
    import { approveConditionUpdate, rejectConditionUpdate } from '../../../routes/conditions.remote.js';
    import { approveConditionSchema, rejectConditionSchema } from '@ac/validations';
    import { AsyncButton, useFormValidationFeedback } from '@ac/ui';
    import { toast } from 'svelte-sonner';
    import { 
        ShieldAlert, 
        CheckCircle2, 
        XCircle, 
        FileText, 
        Calendar, 
        Building2, 
        History, 
        Sparkles,
        ArrowRight,
        X,
        Info
    } from '@lucide/svelte';

    interface Props {
        condition: any;
        type: 'social_insurance' | 'union_contract';
        open: boolean;
        onClose: () => void;
        onApproved?: () => void;
    }

    let { condition, type, open = false, onClose, onApproved }: Props = $props();

    let showRejectReason = $state(false);
    let rejectionReason = $state('');

    const af = approveConditionUpdate.preflight(approveConditionSchema);
    const rf = rejectConditionUpdate.preflight(rejectConditionSchema);

    const approveFeedback = useFormValidationFeedback(() => af);
    const rejectFeedback = useFormValidationFeedback(() => rf);

    const changes = $derived<any[]>(condition?.changesDiff ?? []);
    const hmoList = $derived<any[]>(condition?.hmoRates ?? []);
    const wageGrid = $derived<Record<string, Record<string, number>>>(condition?.wageGrid ?? {});

    let hmoSearch = $state('');
    const filteredHmos = $derived(
        hmoSearch.trim() === ''
            ? hmoList
            : hmoList.filter(h => h.name.toLowerCase().includes(hmoSearch.toLowerCase()) || (h.code && h.code.toLowerCase().includes(hmoSearch.toLowerCase())))
    );

    function close() {
        showRejectReason = false;
        rejectionReason = '';
        onClose();
    }
</script>

{#if open && condition}
    <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
    >
        <div class="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden my-8">
            <!-- Modal Header -->
            <div class="p-8 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white relative overflow-hidden">
                <div class="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div class="flex items-start justify-between relative z-10">
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest {type === 'social_insurance' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}">
                                {type === 'social_insurance' ? 'Sozialversicherung & HMO' : 'Tarifvertrag & Entgelttabelle'}
                            </span>
                            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Review & Freigabe
                            </span>
                            <span class="text-xs font-semibold text-slate-400">
                                Gültig ab: {condition.effectivePeriod || 'N/A'}
                            </span>
                        </div>
                        <h2 id="review-modal-title" class="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                            {condition.name}
                        </h2>
                        <p class="text-xs text-slate-300 font-medium max-w-xl">
                            {condition.changeSummary || 'Automatisch erfasste Konditionenaktualisierung aus offiziellen Registern.'}
                        </p>
                    </div>

                    <button 
                        type="button"
                        onclick={close}
                        class="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <!-- Modal Content -->
            <div class="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                <!-- Change Highlights -->
                <div>
                    <div class="flex items-center gap-2 mb-4">
                        <Sparkles size={18} class="text-indigo-600" />
                        <h3 class="text-sm font-black uppercase tracking-wider text-gray-900">
                            Erkannte Änderungen & Differenzen
                        </h3>
                        <span class="px-2 py-0.5 text-[10px] font-black rounded-full bg-indigo-50 text-indigo-700">
                            {changes.length} {changes.length === 1 ? 'Punkt' : 'Punkte'}
                        </span>
                    </div>

                    {#if changes.length === 0}
                        <div class="p-6 rounded-2xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-500 font-medium">
                            Keine direkten Abweichungen zur aktiven Konfiguration festgestellt. Dies ist eine reguläre Monatsprüfung.
                        </div>
                    {:else}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {#each changes as diff}
                                <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100/80 shadow-sm space-y-2">
                                    <div class="text-xs font-black text-gray-900 flex items-center justify-between">
                                        <span>{diff.field}</span>
                                        {#if diff.unit}
                                            <span class="text-[10px] font-bold text-gray-400">{diff.unit}</span>
                                        {/if}
                                    </div>
                                    <div class="flex items-center gap-3 text-xs">
                                        <div class="px-2.5 py-1 rounded-xl bg-gray-100 text-gray-600 line-through font-mono">
                                            {diff.oldValue}
                                        </div>
                                        <ArrowRight size={14} class="text-indigo-500" />
                                        <div class="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black font-mono">
                                            {diff.newValue}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Detailed Breakdown Tabs / Accordions -->
                {#if type === 'social_insurance'}
                    <!-- Statutory Rates -->
                    <div class="space-y-4">
                        <h3 class="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                            <ShieldAlert size={18} class="text-emerald-600" />
                            Gesetzliche Rechengrößen & Beitragsbemessungsgrenzen
                        </h3>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">BBG KV / PV</span>
                                <span class="text-sm font-black text-gray-900">{condition.bbgKvPvMonthly?.toLocaleString('de-DE')} €</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">BBG RV / AV</span>
                                <span class="text-sm font-black text-gray-900">{condition.bbgRvAvMonthly?.toLocaleString('de-DE')} €</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">Minijob-Grenze</span>
                                <span class="text-sm font-black text-gray-900">{condition.minijobLimit?.toLocaleString('de-DE')} €</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">Rentenvers. (RV)</span>
                                <span class="text-sm font-black text-gray-900">{((condition.rvRateTotal ?? 0.186) * 100).toFixed(1)}% ({(condition.rvRateHalf * 100).toFixed(2)}%)</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">Arbeitslosenvers.</span>
                                <span class="text-sm font-black text-gray-900">{((condition.avRateTotal ?? 0.026) * 100).toFixed(1)}% ({(condition.avRateHalf * 100).toFixed(2)}%)</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">KV Grundbeitrag</span>
                                <span class="text-sm font-black text-gray-900">{((condition.kvBaseRateHalf * 2) * 100).toFixed(1)}% ({(condition.kvBaseRateHalf * 100).toFixed(1)}% je)</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">Pflegevers. (PV)</span>
                                <span class="text-sm font-black text-gray-900">AN {(condition.pvBaseRateAn * 100).toFixed(2)}% / AG {(condition.pvBaseRateAg * 100).toFixed(2)}%</span>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span class="text-[10px] text-gray-400 font-bold block uppercase">Umlagen U1 / U2</span>
                                <span class="text-sm font-black text-gray-900">U1 {(condition.u1Rate * 100).toFixed(2)}% / U2 {(condition.u2Rate * 100).toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- HMO Krankenkassen Table -->
                    <div class="space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h3 class="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                                <Building2 size={18} class="text-blue-600" />
                                Krankenkassen Zusatzbeitragssätze (HMOs)
                            </h3>
                            <input 
                                type="text"
                                bind:value={hmoSearch}
                                placeholder="Krankenkasse suchen (z.B. TK, Barmer)..."
                                class="px-4 py-2 rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                            />
                        </div>

                        <div class="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <div class="max-h-60 overflow-y-auto">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-gray-50 sticky top-0 border-b border-gray-100">
                                        <tr>
                                            <th class="p-3 font-black text-gray-600 uppercase text-[10px]">Krankenkasse</th>
                                            <th class="p-3 font-black text-gray-600 uppercase text-[10px]">Kürzel</th>
                                            <th class="p-3 font-black text-gray-600 uppercase text-[10px] text-right">Zusatzbeitrag</th>
                                            <th class="p-3 font-black text-gray-600 uppercase text-[10px] text-right">Gesamtbeitrag (AN + AG)</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-50">
                                        {#each filteredHmos as hmo}
                                            <tr class="hover:bg-gray-50/70 transition-colors">
                                                <td class="p-3 font-bold text-gray-900">{hmo.name}</td>
                                                <td class="p-3 text-gray-500 font-mono text-[10px]">{hmo.code || '-'}</td>
                                                <td class="p-3 font-mono font-black text-indigo-600 text-right">
                                                    {hmo.additionalContributionPercent.toFixed(2)}%
                                                </td>
                                                <td class="p-3 font-mono text-gray-600 text-right">
                                                    {(14.6 + hmo.additionalContributionPercent).toFixed(2)}%
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                {:else}
                    <!-- Union Contract Wage Grid -->
                    <div class="space-y-4">
                        <h3 class="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                            <Building2 size={18} class="text-cyan-600" />
                            Entgelttabelle (Monatliche Grundvergütung in €)
                        </h3>

                        <div class="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <div class="max-h-64 overflow-y-auto overflow-x-auto">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-gray-50 sticky top-0 border-b border-gray-100">
                                        <tr>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px]">Entgeltgruppe</th>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px] text-right">Stufe 1</th>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px] text-right">Stufe 2</th>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px] text-right">Stufe 3</th>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px] text-right">Stufe 4</th>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px] text-right">Stufe 5</th>
                                            <th class="p-3 font-black text-gray-700 uppercase text-[10px] text-right">Stufe 6</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-50">
                                        {#each Object.entries(wageGrid) as [eg, stufen]}
                                            <tr class="hover:bg-gray-50/70 transition-colors">
                                                <td class="p-3 font-black text-gray-900">{eg}</td>
                                                <td class="p-3 font-mono text-gray-600 text-right">{stufen['1']?.toLocaleString('de-DE') ?? '-'} €</td>
                                                <td class="p-3 font-mono text-gray-600 text-right">{stufen['2']?.toLocaleString('de-DE') ?? '-'} €</td>
                                                <td class="p-3 font-mono text-gray-600 text-right">{stufen['3']?.toLocaleString('de-DE') ?? '-'} €</td>
                                                <td class="p-3 font-mono text-gray-600 text-right">{stufen['4']?.toLocaleString('de-DE') ?? '-'} €</td>
                                                <td class="p-3 font-mono text-gray-600 text-right">{stufen['5']?.toLocaleString('de-DE') ?? '-'} €</td>
                                                <td class="p-3 font-mono text-gray-600 text-right">{stufen['6']?.toLocaleString('de-DE') ?? '-'} €</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Audit Statement Note -->
                <div class="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                    <Info size={18} class="text-amber-600 shrink-0 mt-0.5" />
                    <div class="text-xs text-amber-900 space-y-1">
                        <p class="font-bold">Revisionssichere Freigabe & Rückwirkende Berechnungen:</p>
                        <p class="text-amber-800 leading-relaxed">
                            Mit der Freigabe wird dieser Datensatz mit Ihrem Benutzerkonto und Zeitstempel als aktiver Stand dokumentiert. 
                            Alle historischen Versionen verbleiben in der Datenbank, sodass Rückrechnungen früherer Monate stets die damals gültigen Beitragssätze und Tabellen anwenden.
                        </p>
                    </div>
                </div>

                <!-- Rejection Reason Drawer (Conditional) -->
                {#if showRejectReason}
                    <div class="p-6 rounded-2xl bg-rose-50 border border-rose-100 space-y-3 animate-in fade-in duration-200">
                        <label for="rejection-reason-input" class="text-xs font-black text-rose-900 uppercase tracking-wider block">
                            Grund für die Ablehnung (wird im Revisionsprotokoll gespeichert):
                        </label>
                        <textarea 
                            id="rejection-reason-input"
                            data-field="reason"
                            bind:value={rejectionReason}
                            rows={3}
                            placeholder="z.B. Tarifabschluss ist noch strittig / Rücksprache mit der Geschäftsführung erforderlich..."
                            class="w-full p-3 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        ></textarea>
                    </div>
                {/if}
            </div>

            <!-- Modal Footer with Actions -->
            <div class="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                    type="button"
                    onclick={() => { showRejectReason = !showRejectReason; }}
                    class="text-xs font-bold text-gray-500 hover:text-rose-600 transition-colors"
                >
                    {showRejectReason ? 'Abbrechen' : 'Konditionen ablehnen...'}
                </button>

                <div class="flex items-center gap-3 w-full sm:w-auto">
                    {#if showRejectReason}
                        <form
                            {...rf.preflight(rejectConditionSchema).enhance(async ({ submit }) => {
                                const ok = await submit() as any;
                                if (ok) {
                                    toast.success('Konditionen abgelehnt und archiviert');
                                    close();
                                    onApproved?.();
                                }
                            })}
                        >
                            <input {...rf.fields.id.as('hidden', condition.id)} />
                            <input {...rf.fields.type.as('hidden', type)} />
                            <input {...rf.fields.reason.as('hidden', rejectionReason)} />
                            <AsyncButton
                                type="submit"
                                loading={rf.pending}
                                class="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                            >
                                Ablehnen
                            </AsyncButton>
                        </form>
                    {:else}
                        <button
                            type="button"
                            onclick={close}
                            class="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            Schließen
                        </button>

                        <form
                            {...af.preflight(approveConditionSchema).enhance(async ({ submit }) => {
                                const ok = await submit() as any;
                                if (ok) {
                                    toast.success('Konditionen erfolgreich freigegeben! Für künftige Abrechnungen aktiviert.');
                                    close();
                                    onApproved?.();
                                }
                            })}
                        >
                            <input {...af.fields.id.as('hidden', condition.id)} />
                            <input {...af.fields.type.as('hidden', type)} />
                            <AsyncButton
                                type="submit"
                                loading={af.pending}
                                class="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-500/20"
                            >
                                Jetzt freigeben & aktivieren
                            </AsyncButton>
                        </form>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}
