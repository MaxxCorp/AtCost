<script lang="ts">
    import { listPayrollRuns, createPayrollRunAction, deletePayrollRunAction } from "./runs.remote.js";
    import { createPayrollRunSchema } from "@ac/validations";
    import { Button, LoadingSection, ErrorSection } from "@ac/ui";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { 
        Plus, 
        Calendar, 
        DollarSign, 
        Users, 
        CheckCircle2, 
        Clock, 
        TrendingUp, 
        FileText, 
        Trash2, 
        ArrowRight, 
        Sparkles,
        ShieldCheck,
        Building2
    } from "@lucide/svelte";

    breadcrumbState.set({
        feature: "payroll",
        current: "Abrechnungsläufe",
    });

    let search = $state("");
    let statusFilter = $state<string | undefined>(undefined);
    let isCreateModalOpen = $state(false);
    let isSubmitting = $state(false);

    // Current month formatted as YYYY-MM
    const today = new Date();
    const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const defaultName = `Gehaltsabrechnung ${today.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}`;

    const createRunForm = createPayrollRunAction.preflight(createPayrollRunSchema);

    let prevIssuesLength = 0;
    $effect(() => {
        const issues = createRunForm.fields.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error("Bitte korrigieren Sie die Formularfehler");
        }
        prevIssuesLength = issues.length;
    });

    const query = $derived(
        listPayrollRuns({
            search: search.trim() || undefined,
            status: statusFilter,
            limit: 50,
        })
    );

    const runs = $derived(query.current?.data ?? []);
    const totalRuns = $derived(query.current?.total ?? 0);

    // Aggregate statistics from current runs
    const totalGrossSum = $derived(runs.reduce((acc, r) => acc + (r.totalGross || 0), 0));
    const totalNetSum = $derived(runs.reduce((acc, r) => acc + (r.totalNet || 0), 0));
    const totalCostSum = $derived(runs.reduce((acc, r) => acc + (r.totalEmployerCost || 0), 0));

    function formatCurrency(amount: number | null | undefined): string {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    }

    async function handleDelete(runId: string, name: string) {
        if (!confirm(`Möchten Sie den Abrechnungslauf "${name}" wirklich löschen?`)) return;
        try {
            await deletePayrollRunAction({ runId });
            toast.success("Abrechnungslauf gelöscht");
            await query.refresh();
        } catch (err: any) {
            toast.error(err.message || "Fehler beim Löschen");
        }
    }
</script>

<div class="space-y-8">
    <!-- Header banner -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs">
        <div>
            <div class="flex items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Deutsche Entgeltabrechnung
                </span>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                    <ShieldCheck class="w-3.5 h-3.5" />
                    § 3b EStG & SGB IV
                </span>
            </div>
            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
                Payroll Management
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                Monatliche Abrechnungsläufe, Steuer- und SV-Berechnungen sowie digitale Entgeltnachweise.
            </p>
        </div>

        <div>
            <Button
                onclick={() => { isCreateModalOpen = true; }}
                class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm gap-2"
            >
                <Plus class="w-4 h-4" />
                Neuer Abrechnungslauf
            </Button>
        </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Gesamtaufwand (Arbeitgeber)</span>
            <div class="text-2xl font-black text-gray-900 tracking-tight">
                {formatCurrency(totalCostSum)}
            </div>
            <span class="text-[11px] text-gray-500">Inkl. AG-Anteile & Umlagen</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Gesamtbrutto</span>
            <div class="text-2xl font-black text-indigo-950 tracking-tight">
                {formatCurrency(totalGrossSum)}
            </div>
            <span class="text-[11px] text-gray-500">Grundvergütung, SFN & Zulagen</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Nettoauszahlung</span>
            <div class="text-2xl font-black text-emerald-700 tracking-tight">
                {formatCurrency(totalNetSum)}
            </div>
            <span class="text-[11px] text-gray-500">Zur Überweisung an Mitarbeiter</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Abrechnungsperioden</span>
            <div class="text-2xl font-black text-gray-900 tracking-tight">
                {totalRuns}
            </div>
            <span class="text-[11px] text-gray-500">{runs.filter(r => r.status === 'finalized').length} Abgeschlossen</span>
        </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
                onclick={() => { statusFilter = undefined; }}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all {statusFilter === undefined ? 'bg-gray-900 text-white shadow-2xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
            >
                Alle ({totalRuns})
            </button>
            <button
                onclick={() => { statusFilter = 'draft'; }}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all {statusFilter === 'draft' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
            >
                Entwurf
            </button>
            <button
                onclick={() => { statusFilter = 'calculated'; }}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all {statusFilter === 'calculated' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
            >
                Berechnet
            </button>
            <button
                onclick={() => { statusFilter = 'approved'; }}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all {statusFilter === 'approved' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
            >
                Genehmigt
            </button>
            <button
                onclick={() => { statusFilter = 'finalized'; }}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all {statusFilter === 'finalized' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
            >
                Abgeschlossen
            </button>
        </div>

        <div class="w-full sm:w-72">
            <input
                type="text"
                bind:value={search}
                placeholder="Abrechnungslauf suchen..."
                class="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
            />
        </div>
    </div>

    <!-- Runs List -->
    {#if query.loading && !query.current}
        <LoadingSection message="Lade Abrechnungsläufe..." />
    {:else if query.error}
        <ErrorSection message={query.error.message || "Fehler beim Laden"} />
    {:else if runs.length === 0}
        <div class="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-3">
            <Calendar class="w-10 h-10 text-gray-300 mx-auto" />
            <h3 class="text-base font-bold text-gray-900">Keine Abrechnungsläufe gefunden</h3>
            <p class="text-xs text-gray-500 max-w-sm mx-auto">
                Erstellen Sie einen neuen monatlichen Abrechnungslauf, um Gehaltsabrechnungen für Mitarbeiter zu generieren.
            </p>
            <Button
                onclick={() => { isCreateModalOpen = true; }}
                variant="outline"
                size="sm"
                class="gap-1.5"
            >
                <Plus class="w-4 h-4" />
                Ersten Lauf anlegen
            </Button>
        </div>
    {:else}
        <div class="grid grid-cols-1 gap-4">
            {#each runs as run (run.id)}
                <div class="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="space-y-2">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                                {run.period}
                            </span>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-full {run.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : run.status === 'approved' ? 'bg-indigo-100 text-indigo-800' : run.status === 'calculated' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">
                                {run.status === 'finalized' ? 'Abgeschlossen' : run.status === 'approved' ? 'Genehmigt' : run.status === 'calculated' ? 'Berechnet' : 'Entwurf'}
                            </span>
                            <span class="text-[11px] text-gray-400 font-medium">
                                Rechtskreis: {run.jurisdiction}
                            </span>
                        </div>

                        <h3 class="text-lg font-bold text-gray-900">
                            {run.name}
                        </h3>

                        {#if run.notes}
                            <p class="text-xs text-gray-500">{run.notes}</p>
                        {/if}

                        <div class="flex items-center gap-4 text-xs text-gray-500 pt-1">
                            <span class="flex items-center gap-1">
                                <Users class="w-3.5 h-3.5 text-gray-400" />
                                {run.totalEmployees ?? 0} Mitarbeiter
                            </span>
                            <span>·</span>
                            <span>Erstellt: {new Date(run.createdAt).toLocaleDateString('de-DE')}</span>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <!-- Key metrics in pill form -->
                        <div class="grid grid-cols-3 gap-4 text-left sm:text-right">
                            <div>
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-medium">Brutto</span>
                                <span class="text-sm font-bold text-gray-900">{formatCurrency(run.totalGross)}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-medium">Netto</span>
                                <span class="text-sm font-bold text-emerald-700">{formatCurrency(run.totalNet)}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-medium">AG-Kosten</span>
                                <span class="text-sm font-bold text-indigo-950">{formatCurrency(run.totalEmployerCost)}</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <a href="/payroll/{run.id}">
                                <Button size="sm" class="gap-1.5 bg-gray-900 hover:bg-gray-800 text-white">
                                    Details & Abrechnungen
                                    <ArrowRight class="w-4 h-4" />
                                </Button>
                            </a>

                            {#if run.status !== 'finalized'}
                                <button
                                    onclick={() => handleDelete(run.id, run.name)}
                                    class="p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                    title="Löschen"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Modal: Neuer Abrechnungslauf -->
{#if isCreateModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <Calendar class="w-5 h-5 text-indigo-600" />
                    <h2 class="text-base font-bold text-gray-900">Neuen Abrechnungslauf anlegen</h2>
                </div>
                <button
                    onclick={() => { isCreateModalOpen = false; }}
                    class="text-gray-400 hover:text-gray-600 text-sm font-bold"
                >
                    ✕
                </button>
            </div>

            <form
                {...createRunForm
                    .preflight(createPayrollRunSchema)
                    .enhance(async ({ submit }) => {
                        isSubmitting = true;
                        try {
                            const success = await submit();
                            if (success) {
                                toast.success("Abrechnungslauf erfolgreich erstellt");
                                isCreateModalOpen = false;
                                await query.refresh();
                            }
                        } catch (err: any) {
                            toast.error(err?.message || "Fehler beim Erstellen");
                        } finally {
                            isSubmitting = false;
                        }
                    })}
                class="p-6 space-y-4 text-xs"
            >
                <div>
                    <label for="period" class="block font-semibold text-gray-700 mb-1">
                        Abrechnungsmonat (YYYY-MM) *
                    </label>
                    <input
                        id="period"
                        type="month"
                        {...createRunForm.fields.period.as('text', defaultPeriod)}
                        required
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each createRunForm.fields.period.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="name" class="block font-semibold text-gray-700 mb-1">
                        Bezeichnung des Laufs *
                    </label>
                    <input
                        id="name"
                        type="text"
                        {...createRunForm.fields.name.as('text', defaultName)}
                        required
                        placeholder="z.B. Gehaltsabrechnung Oktober 2026"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each createRunForm.fields.name.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="jurisdiction" class="block font-semibold text-gray-700 mb-1">
                        Rechtskreis / Steuerjurisdiktion
                    </label>
                    <select
                        id="jurisdiction"
                        {...createRunForm.fields.jurisdiction.as('select', 'DE')}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
                    >
                        <option value="DE">Deutschland (DE - LSt gem. § 32a EStG & SGB-Beiträge)</option>
                        <option value="AT">Österreich (AT - Entwurf)</option>
                        <option value="CH">Schweiz (CH - Entwurf)</option>
                    </select>
                    {#each createRunForm.fields.jurisdiction.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="notes" class="block font-semibold text-gray-700 mb-1">
                        Notizen (optional)
                    </label>
                    <textarea
                        id="notes"
                        {...createRunForm.fields.notes.as('text', '')}
                        rows="2"
                        placeholder="Optionale Bemerkungen zum Lauf..."
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    ></textarea>
                    {#each createRunForm.fields.notes.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onclick={() => { isCreateModalOpen = false; }}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={isSubmitting}
                        class="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isSubmitting ? "Wird angelegt..." : "Lauf anlegen"}
                    </Button>
                </div>
            </form>
        </div>
    </div>
{/if}
