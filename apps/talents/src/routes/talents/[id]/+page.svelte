<script lang="ts">
    import { page } from "$app/state";
    import * as m from "#lib/paraglide/messages.js";
    import { LoadingSection, ErrorSection, TalentTimeline, Button, EntityManager } from "@ac/ui";
    import { Calendar, ArrowLeft, ExternalLink, FileText, Layers, TrendingUp, Sparkles, CheckCircle, Shield, Scale, HeartHandshake, ShieldCheck } from "@lucide/svelte";
    import { 
        readTalent, 
    } from './read.remote';
    import {
        invokeAddTimelineEntry, 
        listEmployees 
    } from '../talents.remote';
    import { listContracts, readTalentEffectiveContract } from '../../contracts/list.remote';
    import { deleteContract } from '../../contracts/delete.remote';
    import { createContract } from '../../contracts/new/create.remote';
    import { readContract } from '../../contracts/[id]/read.remote';
    import { updateContract } from '../../contracts/[id]/update.remote';
    import ContractForm from '../../contracts/ContractForm.svelte';

    import { contractSchema, updateContractSchema } from "@ac/validations/contracts";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import TalentForm from "#lib/components/talent/TalentForm.svelte";
    import PayrollProfileForm from "#lib/components/payroll/PayrollProfileForm.svelte";
    import { getContractFilterGroups } from "#lib/filters/index.js";
    import TalentTagsCard from "#lib/components/talent/TalentTagsCard.svelte";

    const talentIdParam = $derived(page.params.id as string);
    const talentQuery = $derived(readTalent(talentIdParam));
    const talent = $derived(talentQuery.current);
    const effectiveContractQuery = $derived(readTalentEffectiveContract({ talentId: talentIdParam }));
    const effectiveResult = $derived(effectiveContractQuery.current?.resolution);

    $effect(() => {
        if (talent?.contact) {
            breadcrumbState.set({
                feature: "talents",
                current: `Edit: ${talent.contact.displayName}`,
            });
        }
    });

    let employees = $state<any[]>([]);

    $effect(() => {
        listEmployees().then(res => {
            employees = Array.isArray(res) ? res : [];
        });
    });

    const listTalentContracts = (params: any) => listContracts({ ...params, talentId: talentIdParam });
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    <svelte:boundary>
        {#if $effect.pending()}
            <LoadingSection message="Loading talent details..." />
        {/if}
        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#if talentQuery.loading && !talent}
                <LoadingSection message="Lade Mitarbeiterdaten..." />
            {:else if talentQuery.error}
                <ErrorSection headline="Fehler beim Laden" message={talentQuery.error.message} />
            {:else if talent}
                    <div class="mb-6">
                        <a
                            href="/talents"
                            class="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                        >
                            <ArrowLeft size={16} class="mr-1" />
                            Back to Talents
                        </a>
                        <div class="flex items-center justify-between">
                            <h1 class="text-3xl font-bold text-gray-900 tracking-tight">
                                Edit Talent Profile
                            </h1>
                            <div class="flex gap-2">
                                <a href="/talents/{talentIdParam}/view">
                                    <Button variant="outline" size="sm">
                                        <ExternalLink size={16} class="mr-2" />
                                        View Public Profile
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-8">
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                            <TalentForm
                                initialData={talent}
                                talentId={talentIdParam}
                            />
                        </div>

                        <div class="pt-8 border-t border-gray-100">
                            <h2 class="text-xl font-bold text-gray-900 mb-6">
                                Talent Timeline
                            </h2>
                            <TalentTimeline 
                                talentId={talentIdParam}
                                entries={(talent.timelineEntries || []) as any}
                                {employees}
                                onAddEntry={async (entry: any) => {
                                    await invokeAddTimelineEntry({
                                        talentId: talentIdParam,
                                        entry
                                    });
                                    // No need for refresh logic as Svelte 5 will re-derive when needed
                                    // or the page could be refreshed.
                                }}
                            />
                        </div>

                        <div class="pt-8 border-t border-gray-100">
                            <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText size={20} class="text-indigo-500" />
                                {m.contracts()}
                            </h3>

                            {#if effectiveResult}
                                <div class="mb-6 rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/70 via-indigo-50/30 to-white p-5 shadow-xs">
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
                                        <div class="flex items-center gap-2">
                                            <Sparkles class="w-5 h-5 text-blue-600" />
                                            <h4 class="font-bold text-gray-900 text-sm sm:text-base">
                                                {m.effective_terms ? m.effective_terms() : "Effective Contract Terms"} (Konsolidierte Bedingungen)
                                            </h4>
                                        </div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            {#if effectiveResult.effective?.fundingProgram === 'sgb2_16i'}
                                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                                                    <HeartHandshake class="w-3.5 h-3.5" />
                                                    § 16i SGB II (TaAM)
                                                </span>
                                            {:else if effectiveResult.effective?.fundingProgram === 'sgb2_16d'}
                                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    <ShieldCheck class="w-3.5 h-3.5" />
                                                    § 16d SGB II (AGH / MAE)
                                                </span>
                                            {/if}
                                            {#if effectiveResult.totalActive > 1}
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                    <Layers class="w-3.5 h-3.5" />
                                                    {effectiveResult.totalActive} Verträge aktiv · Rangfolge aktiv
                                                </span>
                                            {:else}
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    <CheckCircle class="w-3.5 h-3.5" />
                                                    1 Vertrag aktiv
                                                </span>
                                            {/if}
                                        </div>
                                    </div>

                                    <!-- KPI Grid -->
                                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                                        <div class="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-blue-100">
                                            <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Effektives Gehalt</span>
                                            <span class="text-base font-bold text-gray-900">
                                                {effectiveResult.effective?.wageAmount ? `€${Number(effectiveResult.effective.wageAmount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '-'}
                                            </span>
                                            <span class="text-[10px] text-gray-500 block">
                                                {effectiveResult.effective?.wageType === 'hourly' ? '/Std.' : '/Monat'} · {effectiveResult.effective?.entgeltgruppe ?? 'EG -'} {effectiveResult.effective?.erfahrungsstufe ? `Stufe ${effectiveResult.effective.erfahrungsstufe}` : ''}
                                            </span>
                                        </div>
                                        <div class="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-blue-100">
                                            <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Wochenstunden</span>
                                            <span class="text-base font-bold text-gray-900">{effectiveResult.effective?.workHoursPerWeek ?? 39} Std.</span>
                                            <span class="text-[10px] text-gray-500 block">{effectiveResult.effective?.workDaysPerWeek ?? 5} Tage/Woche</span>
                                        </div>
                                        <div class="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-blue-100">
                                            <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Jahresurlaub</span>
                                            <span class="text-base font-bold text-gray-900">{effectiveResult.effective?.holidayAllotmentDays ?? 30} Tage</span>
                                            <span class="text-[10px] text-gray-500 block">{effectiveResult.effective?.eveDaysFree ? '24./31.12. frei' : ''}</span>
                                        </div>
                                        <div class="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-blue-100">
                                            <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Jahressonderzahlung</span>
                                            <span class="text-base font-bold text-gray-900">{effectiveResult.effective?.yearlyBonusPercentage ?? 80}%</span>
                                            <span class="text-[10px] text-gray-500 block">Auszahlung: Monat {effectiveResult.effective?.yearlyBonusMonth ?? 11}</span>
                                        </div>
                                    </div>

                                    <!-- SGB II Funding Details Banner -->
                                    {#if effectiveResult.effective?.fundingProgram === 'sgb2_16i'}
                                        <div class="my-3 p-3.5 rounded-xl border border-teal-200 bg-teal-50/70 text-xs text-teal-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                            <div class="space-y-1">
                                                <div class="font-bold flex items-center gap-1.5 text-teal-900">
                                                    <HeartHandshake class="w-4 h-4 text-teal-600" />
                                                    <span>SGB II Teilhabe am Arbeitsmarkt (§ 16i)</span>
                                                </div>
                                                <p class="text-[11px] text-teal-800">
                                                    Lohnkostenzuschuss: <strong>{effectiveResult.effective.fundingSubsidyPercentage ?? 100}%</strong> zzgl. pauschalierte AG-SV-Erstattung.
                                                    Bezahlte Coachingfreistellung: <strong>{effectiveResult.effective.coachingHoursPerMonth ?? 2} Std./Monat</strong>.
                                                    {effectiveResult.effective.jobcenterReference ? `· AZ: ${effectiveResult.effective.jobcenterReference}` : ''}
                                                </p>
                                            </div>
                                            <div class="shrink-0 bg-white/90 px-3 py-1.5 rounded-lg border border-teal-200 text-right">
                                                <span class="text-[10px] text-gray-500 block">Weiterbildungsbudget (§ 16i Abs. 5)</span>
                                                <span class="font-bold text-teal-900 text-xs">
                                                    €{(Number(effectiveResult.effective.furtherTrainingBudget ?? 3000) - Number(effectiveResult.effective.furtherTrainingUsed ?? 0)).toLocaleString('de-DE')} frei
                                                </span>
                                                <span class="text-[10px] text-gray-400 block">von €{Number(effectiveResult.effective.furtherTrainingBudget ?? 3000).toLocaleString('de-DE')}</span>
                                            </div>
                                        </div>
                                    {:else if effectiveResult.effective?.fundingProgram === 'sgb2_16d'}
                                        <div class="my-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 flex items-center justify-between gap-3 shadow-2xs">
                                            <div class="space-y-1">
                                                <div class="font-bold flex items-center gap-1.5 text-emerald-900">
                                                    <ShieldCheck class="w-4 h-4 text-emerald-600" />
                                                    <span>SGB II Arbeitsgelegenheit (AGH § 16d)</span>
                                                </div>
                                                <p class="text-[11px] text-emerald-800">
                                                    Mehraufwandsentschädigung (MAE): Vollständig steuer- & sozialversicherungsfrei nach § 3 Nr. 2 EStG (DEÜV BGR 0000, PGR 190). Kein Arbeitsverhältnis i.S.d. Arbeitsrechts.
                                                </p>
                                            </div>
                                            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                                100% gefördert
                                            </span>
                                        </div>
                                    {/if}

                                    <!-- Hierarchy & Supersedence Explanation -->
                                    {#if effectiveResult.totalActive > 1}
                                        <div class="bg-white/90 p-3.5 rounded-xl border border-indigo-100 text-xs text-gray-700 space-y-2">
                                            <div class="font-semibold text-indigo-950 flex items-center gap-1.5">
                                                <TrendingUp class="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Rangfolge der aktiven Verträge (Hierarchie & Vorrang):</span>
                                            </div>
                                            <div class="flex flex-col gap-1.5">
                                                {#each effectiveResult.activeContracts as c, idx (c.id)}
                                                    <div class="flex items-center gap-2 text-xs flex-wrap">
                                                        <span class="font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Rang #{c.precedence ?? 1}</span>
                                                        <span class="font-medium text-gray-900">{c.title || c.id}</span>
                                                        <span class="text-gray-500">({c.contractType})</span>
                                                        {#if idx === effectiveResult.activeContracts.length - 1}
                                                            <span class="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                                                Höchster Rang (überstimmt darunterliegende Klauseln)
                                                            </span>
                                                        {:else}
                                                            <span class="text-gray-400">➡️ wird überstimmt von Rang #{effectiveResult.activeContracts[idx + 1].precedence}</span>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                            {#if effectiveResult.effective?.differentialRaisesApplied?.length > 0}
                                                <div class="pt-1.5 border-t border-gray-100 flex items-center gap-2 text-[11px] text-amber-900 flex-wrap">
                                                    <span class="font-semibold">Angewendete Tariferhöhungen:</span>
                                                    {#each effectiveResult.effective.differentialRaisesApplied as diff, dIdx (diff.fromContract + dIdx)}
                                                        <span class="bg-amber-100/80 px-2 py-0.5 rounded font-medium">
                                                            {diff.type === 'percent' ? `+${diff.value}% linear` : `+€${diff.value} Sockel`} ({diff.fromContract})
                                                        </span>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                            <EntityManager
                                title="Contracts"
                                icon={FileText}
                                mode="standalone"
                                filters={getContractFilterGroups(m)}
                                listItemsRemote={listTalentContracts}
                                deleteItemRemote={async (ids: string[]) => {
                                    const res = await deleteContract(ids);
                                    void effectiveContractQuery.refresh();
                                    return res;
                                }}
                                createRemote={createContract}
                                createSchema={contractSchema}
                                updateRemote={updateContract}
                                updateSchema={updateContractSchema}
                                readItemRemote={(id: string) => readContract({ id })}
                                searchPredicate={(c: any, q: any) => {
                                    return (c.title?.toLowerCase() || '').includes(q.toLowerCase()) ||
                                           (c.entgeltgruppe?.toLowerCase() || '').includes(q.toLowerCase()) ||
                                           (c.contractType?.toLowerCase() || '').includes(q.toLowerCase());
                                }}
                            >
                                {#snippet renderItemLabel(c: any)}
                                    <div class="flex flex-col gap-1 py-1">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-semibold text-gray-900">
                                                {c.title || "Arbeitsvertrag"}
                                            </span>
                                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full {c.contractType === 'amendment' ? 'bg-purple-100 text-purple-700' : c.contractType === 'settlement' ? 'bg-amber-100 text-amber-800' : c.contractType === 'addendum' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-700'}">
                                                {c.contractType === 'amendment' ? (m.contract_type_amendment ? m.contract_type_amendment() : 'ÄTV') : c.contractType === 'settlement' ? (m.contract_type_settlement ? m.contract_type_settlement() : 'Tarifeinigung') : c.contractType === 'addendum' ? (m.contract_type_addendum ? m.contract_type_addendum() : 'Zusatzvereinbarung') : (m.contract_type_base ? m.contract_type_base() : 'Hauptvertrag')}
                                            </span>
                                            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                {m.order_rank ? m.order_rank({ rank: c.precedence ?? 1 }) : `Rang #${c.precedence ?? 1}`}
                                            </span>
                                            {#if c.fundingProgram === 'sgb2_16i'}
                                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
                                                    § 16i TaAM
                                                </span>
                                            {:else if c.fundingProgram === 'sgb2_16d'}
                                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    § 16d AGH
                                                </span>
                                            {/if}
                                            {#if c.isActive !== false}
                                                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {m.is_active ? m.is_active() : "Aktiv"}
                                                </span>
                                            {:else}
                                                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                                                    Inaktiv
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                                            <span>{c.wageType === 'hourly' ? 'Stundenlohn' : 'Monatsgehalt'}: {c.wageAmount ? `€${Number(c.wageAmount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '-'}</span>
                                            <span>·</span>
                                            <span>{c.entgeltgruppe ? `Gruppe ${c.entgeltgruppe}` : 'Keine Gruppe'} {c.erfahrungsstufe ? `(Stufe ${c.erfahrungsstufe})` : ''}</span>
                                            <span>·</span>
                                            <span>{c.workHoursPerWeek ?? 39}h/Woche</span>
                                            <span>·</span>
                                            <span>{c.holidayAllotmentDays ?? 30} Urlaubstage</span>
                                            {#if c.differentialAdjustments?.baseRaisePercent}
                                                <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                    +{c.differentialAdjustments.baseRaisePercent}% Erhöhung
                                                </span>
                                            {/if}
                                            {#if c.differentialAdjustments?.baseRaiseAmount}
                                                <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                    +{c.differentialAdjustments.baseRaiseAmount}€ Sockel
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                {/snippet}

                                {#snippet renderForm({ remoteFunction, schema, initialData, onSuccess, onCancel, id }: any)}
                                    <ContractForm
                                        {remoteFunction}
                                        validationSchema={schema}
                                        isUpdating={!!id}
                                        initialData={{ ...initialData, talentId: talentIdParam }}
                                        onSuccess={(result: any) => {
                                            void effectiveContractQuery.refresh();
                                            onSuccess(result);
                                        }}
                                        {onCancel}
                                    />
                                {/snippet}
                            </EntityManager>
                        </div>

                        <div class="pt-8 border-t border-gray-100">
                            <div class="flex items-center gap-2 mb-6">
                                <Scale class="w-5 h-5 text-indigo-600" />
                                <h2 class="text-xl font-bold text-gray-900">
                                    Lohn- & Steuerstammdaten (Payroll)
                                </h2>
                            </div>
                            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                                <PayrollProfileForm talentId={talentIdParam} />
                            </div>
                        </div>

                        <div class="pt-8 border-t border-gray-100">
                            <TalentTagsCard
                                talentId={talentIdParam}
                                currentTags={talent.tags || []}
                                onUpdated={() => {
                                    void talentQuery.refresh();
                                }}
                            />
                        </div>
                    </div>
                {:else}
                    <div
                        class="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
                    >
                        <h2 class="text-2xl font-bold text-gray-900">
                            Talent not found
                        </h2>
                        <p class="text-gray-500 mt-2">
                            The talent profile you are looking for does not exist.
                        </p>
                        <a
                            href="/talents"
                            class="mt-6 inline-block text-indigo-600 font-semibold hover:underline"
                        >
                            Return to Talent List
                        </a>
                    </div>
                {/if}
        </div>
        {#snippet failed(error: unknown)}
            <ErrorSection headline="Error loading talent" message={error instanceof Error ? error.message : "An error occurred"} />
        {/snippet}
    </svelte:boundary>
</div>
