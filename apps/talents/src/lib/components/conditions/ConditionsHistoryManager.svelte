<script lang="ts">
    import { 
        listConditionsHistory, 
        listPendingConditions, 
        triggerSync 
    } from '../../../routes/conditions.remote.js';
    import { syncConditionsSchema } from '@ac/validations';
    import { AsyncButton, LoadingSection, useFormValidationFeedback } from '@ac/ui';
    import ConditionReviewModal from './ConditionReviewModal.svelte';
    import { toast } from 'svelte-sonner';
    import { 
        ShieldCheck, 
        History, 
        RefreshCw, 
        CheckCircle2, 
        Clock, 
        Building2, 
        FileText, 
        Sparkles,
        UserCheck,
        AlertCircle,
        ArrowRight
    } from '@lucide/svelte';

    const historyQuery = listConditionsHistory();
    const pendingQuery = listPendingConditions();

    const historyData = $derived(historyQuery.current ?? { socialConditions: [], unionConditions: [] });
    const pendingData = $derived(pendingQuery.current ?? { pendingSocial: [], pendingUnion: [], totalPending: 0 });

    let activeTab = $state<'social' | 'union'>('social');
    let reviewTarget = $state<{ condition: any; type: 'social_insurance' | 'union_contract' } | null>(null);

    const ts = triggerSync.preflight(syncConditionsSchema);
    const feedback = useFormValidationFeedback(() => ts);

    // Filter approved conditions
    const approvedSocial = $derived(historyData.socialConditions.filter(c => c.status === 'approved'));
    const activeSocialCondition = $derived(approvedSocial[0] || null);
    const historicalSocial = $derived(historyData.socialConditions.filter(c => c.status !== 'pending_review'));

    const approvedUnion = $derived(historyData.unionConditions.filter(c => c.status === 'approved'));
    const activeUnionCondition = $derived(approvedUnion[0] || null);
    const historicalUnion = $derived(historyData.unionConditions.filter(c => c.status !== 'pending_review'));
</script>

<div class="space-y-8">
    <!-- Header with Action -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="space-y-2 relative z-10">
            <div class="flex items-center gap-3">
                <span class="w-2.5 h-7 bg-indigo-500 rounded-full"></span>
                <h2 class="text-3xl font-black tracking-tight uppercase italic text-white">
                    Tarif- & Versicherungskonditionen
                </h2>
            </div>
            <p class="text-xs text-slate-300 font-medium max-w-2xl ml-5">
                Monatliche automatische Synchronisation von Krankenkassen-Zusatzbeiträgen (HMO), Beitragsbemessungsgrenzen und Tarifverträgen. Vollständige Revisionshistorie für rückwirkende Gehaltsberechnungen.
            </p>
        </div>

        <div class="flex items-center gap-3 relative z-10">
            <form
                {...ts.enhance(async ({ submit }) => {
                    const ok = await submit() as any;
                    if (ok) {
                        toast.success('Synchronisationslauf erfolgreich abgeschlossen!');
                        void historyQuery.refresh();
                        void pendingQuery.refresh();
                    }
                })}
            >
                <input {...ts.fields.force.as('hidden', true)} />
                <AsyncButton
                    type="submit"
                    loading={ts.pending}
                    class="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                    <RefreshCw size={14} class={ts.pending ? 'animate-spin' : ''} />
                    Jetzt prüfen
                </AsyncButton>
            </form>
        </div>
    </div>

    <!-- Pending Reviews Notification Banner if any -->
    {#if pendingData.totalPending > 0}
        <div class="p-6 rounded-3xl bg-amber-50 border border-amber-200/80 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 class="text-sm font-black text-amber-950 uppercase tracking-tight">
                            {pendingData.totalPending} ausstehende Freigabe(n) erfordern Überprüfung
                        </h3>
                        <p class="text-xs text-amber-800 font-medium">
                            Automatisch ermittelte Konditionsanpassungen warten auf Genehmigung durch Management / HR.
                        </p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {#each pendingData.pendingSocial as p}
                    <div class="p-4 bg-white rounded-2xl border border-amber-200 flex items-center justify-between shadow-sm">
                        <div>
                            <span class="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                Sozialversicherung & HMO
                            </span>
                            <h4 class="text-xs font-black text-gray-900 mt-1">{p.name}</h4>
                            <p class="text-[10px] text-gray-500">{p.changeSummary || 'Konditionsupdate'}</p>
                        </div>
                        <button
                            type="button"
                            onclick={() => reviewTarget = { condition: p, type: 'social_insurance' }}
                            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm"
                        >
                            Prüfen
                        </button>
                    </div>
                {/each}

                {#each pendingData.pendingUnion as u}
                    <div class="p-4 bg-white rounded-2xl border border-amber-200 flex items-center justify-between shadow-sm">
                        <div>
                            <span class="text-[9px] font-black uppercase tracking-wider text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-100">
                                Tarifvertrag & Tabelle
                            </span>
                            <h4 class="text-xs font-black text-gray-900 mt-1">{u.name}</h4>
                            <p class="text-[10px] text-gray-500">{u.changeSummary || 'Tarifupdate'}</p>
                        </div>
                        <button
                            type="button"
                            onclick={() => reviewTarget = { condition: u, type: 'union_contract' }}
                            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm"
                        >
                            Prüfen
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Tabs Toggle -->
    <div class="flex items-center justify-between border-b border-gray-100 pb-4">
        <div class="flex bg-gray-100/80 p-1 rounded-2xl border border-gray-200/50">
            <button
                type="button"
                onclick={() => activeTab = 'social'}
                class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all {activeTab === 'social' ? 'bg-white text-emerald-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-800'}"
            >
                Sozialversicherung & HMO (Krankenkassen)
            </button>
            <button
                type="button"
                onclick={() => activeTab = 'union'}
                class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all {activeTab === 'union' ? 'bg-white text-cyan-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-800'}"
            >
                Tarifverträge (AWO Berlin & TV-L)
            </button>
        </div>
    </div>

    <!-- TAB 1: SOCIAL INSURANCE & HMO -->
    {#if activeTab === 'social'}
        <div class="space-y-8">
            <!-- Currently Active Condition Card -->
            {#if activeSocialCondition}
                <div class="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-sm space-y-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    Aktiver Standard (Version {activeSocialCondition.version})
                                </span>
                                <span class="text-xs font-bold text-gray-400">
                                    Gültig ab {activeSocialCondition.effectivePeriod}
                                </span>
                            </div>
                            <h3 class="text-2xl font-black text-gray-900 tracking-tight">{activeSocialCondition.name}</h3>
                        </div>

                        {#if activeSocialCondition.approvedByUserName}
                            <div class="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-600">
                                <UserCheck size={18} class="text-emerald-600" />
                                <div>
                                    <span class="block font-black text-gray-900 text-[11px]">Freigegeben von {activeSocialCondition.approvedByUserName}</span>
                                    <span class="text-[10px] text-gray-400">{activeSocialCondition.approvedAt ? new Date(activeSocialCondition.approvedAt).toLocaleDateString('de-DE') : ''}</span>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- Rates Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">BBG Kranken/Pflege</span>
                            <span class="text-base font-black text-gray-900">{activeSocialCondition.bbgKvPvMonthly?.toLocaleString('de-DE')} €/Monat</span>
                        </div>
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">BBG Rente/Arbeitslos</span>
                            <span class="text-base font-black text-gray-900">{activeSocialCondition.bbgRvAvMonthly?.toLocaleString('de-DE')} €/Monat</span>
                        </div>
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">Minijob-Grenze</span>
                            <span class="text-base font-black text-gray-900">{activeSocialCondition.minijobLimit?.toLocaleString('de-DE')} €/Monat</span>
                        </div>
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">Rentenversicherung</span>
                            <span class="text-base font-black text-gray-900">{((activeSocialCondition.rvRateTotal ?? 0.186) * 100).toFixed(1)}% ({((activeSocialCondition.rvRateHalf ?? 0.093) * 100).toFixed(2)}%)</span>
                        </div>
                    </div>

                    <!-- HMO Rates List Preview -->
                    <div>
                        <h4 class="text-xs font-black text-gray-900 uppercase tracking-wider mb-3">
                            Krankenkassen Zusatzbeitragssätze (Auswahl)
                        </h4>
                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {#each (activeSocialCondition.hmoRates || []).slice(0, 10) as hmo}
                                <div class="p-3 bg-gray-50/60 rounded-xl border border-gray-100 text-xs">
                                    <span class="font-bold text-gray-900 block truncate">{hmo.name}</span>
                                    <span class="text-indigo-600 font-black font-mono">{hmo.additionalContributionPercent.toFixed(2)}% Zusatzb.</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {:else}
                <div class="p-8 rounded-[2rem] bg-white border border-gray-100 text-center py-12">
                    <p class="text-sm font-bold text-gray-400 uppercase tracking-widest">Keine aktiven Konditionen vorhanden. Bitte Prüfung ausführen.</p>
                </div>
            {/if}

            <!-- Version History Log (Retroactive Computations) -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <History size={18} class="text-gray-500" />
                    <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider">
                        Revisionshistorie & Rückrechnungsgrundlagen ({historicalSocial.length})
                    </h3>
                </div>

                <div class="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 uppercase font-black">
                            <tr>
                                <th class="p-4">Gültigkeitszeitraum</th>
                                <th class="p-4">Bezeichnung</th>
                                <th class="p-4">Status</th>
                                <th class="p-4">BBG KV / RV</th>
                                <th class="p-4">Freigabe durch</th>
                                <th class="p-4 text-right">Aktion</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            {#each historicalSocial as row}
                                <tr class="hover:bg-gray-50/50 transition-colors">
                                    <td class="p-4 font-mono font-bold text-gray-900">{row.effectivePeriod}</td>
                                    <td class="p-4 font-bold text-gray-900">{row.name}</td>
                                    <td class="p-4">
                                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider {row.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : row.status === 'superseded' ? 'bg-gray-100 text-gray-600' : 'bg-rose-50 text-rose-700'}">
                                            {row.status === 'approved' ? 'Aktiv' : row.status === 'superseded' ? 'Archiviert (Historie)' : row.status}
                                        </span>
                                    </td>
                                    <td class="p-4 font-mono text-gray-600">
                                        {row.bbgKvPvMonthly} € / {row.bbgRvAvMonthly} €
                                    </td>
                                    <td class="p-4 text-gray-500">
                                        {row.approvedByUserName || 'System'}
                                    </td>
                                    <td class="p-4 text-right">
                                        <button
                                            type="button"
                                            onclick={() => reviewTarget = { condition: row, type: 'social_insurance' }}
                                            class="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                                        >
                                            Details ansehen
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

    <!-- TAB 2: UNION CONTRACTS -->
    {:else}
        <div class="space-y-8">
            {#if activeUnionCondition}
                <div class="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-sm space-y-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100">
                                    Tarifwerk {activeUnionCondition.tariffCode} (Version {activeUnionCondition.version})
                                </span>
                                <span class="text-xs font-bold text-gray-400">
                                    Gültig ab {activeUnionCondition.effectivePeriod}
                                </span>
                            </div>
                            <h3 class="text-2xl font-black text-gray-900 tracking-tight">{activeUnionCondition.name}</h3>
                        </div>

                        {#if activeUnionCondition.approvedByUserName}
                            <div class="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-600">
                                <UserCheck size={18} class="text-cyan-600" />
                                <div>
                                    <span class="block font-black text-gray-900 text-[11px]">Freigegeben von {activeUnionCondition.approvedByUserName}</span>
                                    <span class="text-[10px] text-gray-400">{activeUnionCondition.approvedAt ? new Date(activeUnionCondition.approvedAt).toLocaleDateString('de-DE') : ''}</span>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- Tariff Allowances -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">Hauptstadtzulage</span>
                            <span class="text-base font-black text-gray-900">{activeUnionCondition.allowances?.capitalAllowance ?? 150.00} €/Monat</span>
                        </div>
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">Vermögenswirksame Leist.</span>
                            <span class="text-base font-black text-gray-900">{activeUnionCondition.allowances?.capitalFormingBenefits ?? 6.65} €/Monat</span>
                        </div>
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">Jahressonderzahlung</span>
                            <span class="text-base font-black text-gray-900">{activeUnionCondition.allowances?.yearlyBonusPercentage ?? 80}%</span>
                        </div>
                        <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block">Überstundenzuschlag</span>
                            <span class="text-base font-black text-gray-900">{activeUnionCondition.surcharges?.overtimePercent ?? 30}%</span>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Union Historical Log -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <History size={18} class="text-gray-500" />
                    <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider">
                        Tarifvertrags-Revisionshistorie ({historicalUnion.length})
                    </h3>
                </div>

                <div class="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 uppercase font-black">
                            <tr>
                                <th class="p-4">Tarifwerk</th>
                                <th class="p-4">Gültigkeitszeitraum</th>
                                <th class="p-4">Status</th>
                                <th class="p-4">Freigabe durch</th>
                                <th class="p-4 text-right">Aktion</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            {#each historicalUnion as row}
                                <tr class="hover:bg-gray-50/50 transition-colors">
                                    <td class="p-4 font-bold text-gray-900">{row.name}</td>
                                    <td class="p-4 font-mono text-gray-600">{row.effectivePeriod}</td>
                                    <td class="p-4">
                                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider {row.status === 'approved' ? 'bg-cyan-50 text-cyan-700' : 'bg-gray-100 text-gray-600'}">
                                            {row.status === 'approved' ? 'Aktiv' : 'Archiviert'}
                                        </span>
                                    </td>
                                    <td class="p-4 text-gray-500">
                                        {row.approvedByUserName || 'System'}
                                    </td>
                                    <td class="p-4 text-right">
                                        <button
                                            type="button"
                                            onclick={() => reviewTarget = { condition: row, type: 'union_contract' }}
                                            class="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                                        >
                                            Details ansehen
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    {/if}
</div>

<!-- Modal Dialog -->
{#if reviewTarget}
    <ConditionReviewModal
        condition={reviewTarget.condition}
        type={reviewTarget.type}
        open={true}
        onClose={() => reviewTarget = null}
        onApproved={() => {
            void historyQuery.refresh();
            void pendingQuery.refresh();
        }}
    />
{/if}
