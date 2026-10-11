<script lang="ts">
    import { page } from "$app/state";
    import { 
        readPayrollRun, 
        calculatePayrollRunAction, 
        approvePayrollRunAction, 
        finalizePayrollRunAction 
    } from "../runs.remote.js";
    import { listRunPayslips } from "../payslips.remote.js";
    import { Button, LoadingSection, ErrorSection } from "@ac/ui";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { toast } from "svelte-sonner";
    import { 
        ArrowLeft, 
        Calculator, 
        CheckCircle2, 
        Lock, 
        Download, 
        FileText, 
        Users, 
        Clock, 
        DollarSign, 
        Sparkles,
        ShieldCheck,
        Search,
        Eye
    } from "@lucide/svelte";
    import PayslipDetailModal from "#lib/components/payroll/PayslipDetailModal.svelte";

    const runId = $derived(page.params.id as string);

    const runQuery = $derived(readPayrollRun({ id: runId }));
    const run = $derived(runQuery.current);

    const payslipsQuery = $derived(listRunPayslips({ payrollRunId: runId, limit: 100 }));
    const payslips = $derived(payslipsQuery.current?.data ?? []);

    let search = $state("");
    let selectedPayslip = $state<any>(null);
    let isCalculating = $state(false);

    $effect(() => {
        if (run) {
            breadcrumbState.set({
                feature: "payroll",
                current: `${run.name} (${run.period})`,
            });
        }
    });

    const filteredPayslips = $derived(
        payslips.filter((p) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            const name = (
                p.talent?.contact?.displayName ||
                `${p.talent?.contact?.givenName ?? ''} ${p.talent?.contact?.familyName ?? ''}`
            ).toLowerCase();
            return name.includes(q);
        })
    );

    function formatCurrency(amount: number | null | undefined): string {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    }

    function formatNumber(val: number | null | undefined): string {
        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(val) || 0);
    }

    async function handleCalculate() {
        isCalculating = true;
        try {
            await calculatePayrollRunAction({ runId });
            toast.success("Abrechnungslauf erfolgreich berechnet!");
            await runQuery.refresh();
            await payslipsQuery.refresh();
        } catch (err: any) {
            toast.error(err.message || "Fehler bei der Berechnung");
        } finally {
            isCalculating = false;
        }
    }

    async function handleApprove() {
        try {
            await approvePayrollRunAction({ runId });
            toast.success("Abrechnungslauf als genehmigt markiert");
            await runQuery.refresh();
        } catch (err: any) {
            toast.error(err.message || "Fehler beim Genehmigen");
        }
    }

    async function handleFinalize() {
        if (!confirm("Abrechnungslauf final abschließen? Danach sind keine Änderungen mehr möglich.")) return;
        try {
            await finalizePayrollRunAction({ runId });
            toast.success("Abrechnungslauf erfolgreich abgeschlossen");
            await runQuery.refresh();
            await payslipsQuery.refresh();
        } catch (err: any) {
            toast.error(err.message || "Fehler beim Abschließen");
        }
    }

    function exportSepaCsv() {
        if (payslips.length === 0) {
            toast.error("Keine Abrechnungen zum Exportieren vorhanden");
            return;
        }

        const headers = ["Name", "IBAN", "BIC", "Betrag EUR", "Verwendungszweck"];
        const rows = payslips.map((p) => {
            const name = p.talent?.contact?.displayName || `${p.talent?.contact?.givenName ?? ''} ${p.talent?.contact?.familyName ?? ''}`.trim() || 'Mitarbeiter';
            const iban = (p.talent as any)?.payrollProfile?.iban || '';
            const bic = (p.talent as any)?.payrollProfile?.bic || '';
            const amount = Number(p.payoutAmount || 0).toFixed(2);
            const purpose = `Gehalt ${run?.period || ''}`;
            return [name, iban, bic, amount, purpose].map(v => `"${v}"`).join(";");
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `SEPA_Auszahlung_${run?.period || 'Payroll'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("SEPA-Überweisungsdatei exportiert");
    }
</script>

<div class="space-y-8">
    <!-- Breadcrumb back link -->
    <div>
        <a
            href="/payroll"
            class="inline-flex items-center text-xs text-gray-500 hover:text-gray-900 transition-colors gap-1"
        >
            <ArrowLeft class="w-3.5 h-3.5" />
            Zurück zu den Abrechnungsläufen
        </a>
    </div>

    {#if runQuery.loading && !run}
        <LoadingSection message="Lade Abrechnungslauf..." />
    {:else if runQuery.error || !run}
        <ErrorSection message={runQuery.error?.message || "Abrechnungslauf nicht gefunden"} />
    {:else}
        <!-- Run Top Card with Actions -->
        <div class="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-2">
                <div class="flex items-center gap-2.5 flex-wrap">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                        {run.period}
                    </span>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full {run.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : run.status === 'approved' ? 'bg-indigo-100 text-indigo-800' : run.status === 'calculated' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">
                        {run.status === 'finalized' ? 'Abgeschlossen & Fixiert' : run.status === 'approved' ? 'Genehmigt' : run.status === 'calculated' ? 'Berechnet' : 'Entwurf'}
                    </span>
                    <span class="text-xs text-gray-400 font-medium">
                        Rechtskreis: {run.jurisdiction} (Deutschland)
                    </span>
                </div>

                <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                    {run.name}
                </h1>

                {#if run.notes}
                    <p class="text-xs text-gray-500">{run.notes}</p>
                {/if}

                <div class="flex items-center gap-4 text-xs text-gray-400 pt-1">
                    <span>Zeitraum: {new Date(run.startDate).toLocaleDateString('de-DE')} bis {new Date(run.endDate).toLocaleDateString('de-DE')}</span>
                    {#if run.calculatedAt}
                        <span>· Zuletzt berechnet: {new Date(run.calculatedAt).toLocaleString('de-DE')}</span>
                    {/if}
                </div>
            </div>

            <!-- Action Toolbar -->
            <div class="flex flex-wrap items-center gap-2.5">
                {#if run.status !== 'finalized'}
                    <Button
                        onclick={handleCalculate}
                        disabled={isCalculating}
                        class="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-2xs"
                    >
                        <Calculator class="w-4 h-4" />
                        {isCalculating ? "Berechnet..." : run.status === 'draft' ? "Abrechnung jetzt durchführen" : "Neu berechnen"}
                    </Button>
                {/if}

                {#if run.status === 'calculated'}
                    <Button
                        onclick={handleApprove}
                        variant="outline"
                        class="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                        <CheckCircle2 class="w-4 h-4" />
                        Genehmigen
                    </Button>
                {/if}

                {#if run.status === 'approved'}
                    <Button
                        onclick={handleFinalize}
                        class="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                        <Lock class="w-4 h-4" />
                        Abschließen & Fixieren
                    </Button>
                {/if}

                {#if run.status !== 'draft'}
                    <Button
                        onclick={exportSepaCsv}
                        variant="outline"
                        class="gap-1.5"
                    >
                        <Download class="w-4 h-4" />
                        SEPA-CSV Export
                    </Button>
                {/if}
            </div>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Gesamtbrutto</span>
                <div class="text-xl font-black text-gray-900 tracking-tight">
                    {formatCurrency(run.totalGross)}
                </div>
                <span class="text-[10px] text-gray-500">Mitarbeiterbezüge</span>
            </div>

            <div class="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Auszahlungsbetrag</span>
                <div class="text-xl font-black text-emerald-700 tracking-tight">
                    {formatCurrency(run.totalNet)}
                </div>
                <span class="text-[10px] text-gray-500">Netto-Überweisungen</span>
            </div>

            <div class="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Gesamtaufwand AG</span>
                <div class="text-xl font-black text-indigo-950 tracking-tight">
                    {formatCurrency(run.totalEmployerCost)}
                </div>
                <span class="text-[10px] text-gray-500">Brutto + AG-Anteile</span>
            </div>

            <div class="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Abzüge (Gesamt)</span>
                <div class="text-xl font-black text-rose-800 tracking-tight">
                    {formatCurrency((run.totalGross || 0) - (run.totalNet || 0))}
                </div>
                <span class="text-[10px] text-gray-500">Steuern & SV-Beiträge AN</span>
            </div>

            <div class="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-2xs space-y-1 col-span-2 lg:col-span-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Mitarbeiter</span>
                <div class="text-xl font-black text-gray-900 tracking-tight">
                    {run.totalEmployees ?? 0}
                </div>
                <span class="text-[10px] text-gray-500">Abgerechnet</span>
            </div>
        </div>

        <!-- Payslips Table Section -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden space-y-4 p-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex items-center gap-2">
                    <FileText class="w-5 h-5 text-indigo-600" />
                    <h2 class="text-lg font-bold text-gray-900">
                        Entgeltnachweise der Mitarbeiter ({payslips.length})
                    </h2>
                </div>

                <div class="w-full sm:w-64">
                    <div class="relative">
                        <Search class="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            bind:value={search}
                            placeholder="Mitarbeiter suchen..."
                            class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                        />
                    </div>
                </div>
            </div>

            {#if payslipsQuery.loading && !payslipsQuery.current}
                <LoadingSection message="Lade Abrechnungen..." />
            {:else if payslips.length === 0}
                <div class="p-12 text-center space-y-3">
                    <Calculator class="w-10 h-10 text-gray-300 mx-auto" />
                    <h3 class="text-base font-bold text-gray-900">Noch keine Abrechnungen generiert</h3>
                    <p class="text-xs text-gray-500 max-w-sm mx-auto">
                        Klicken Sie oben auf "Abrechnung jetzt durchführen", um alle Mitarbeiter, Verträge, genehmigte Zeiterfassungen und Abwesenheiten automatisch zu berechnen.
                    </p>
                    <Button
                        onclick={handleCalculate}
                        disabled={isCalculating}
                        class="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs"
                    >
                        <Calculator class="w-4 h-4" />
                        {isCalculating ? "Wird berechnet..." : "Abrechnung jetzt starten"}
                    </Button>
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table class="w-full text-xs text-left">
                        <thead class="bg-slate-50 text-gray-500 border-y border-gray-100 uppercase tracking-wider text-[10px]">
                            <tr>
                                <th class="py-3 px-3">Mitarbeiter</th>
                                <th class="py-3 px-3">Tarif / Gruppe</th>
                                <th class="py-3 px-3 text-right">Stunden (Soll / Ist)</th>
                                <th class="py-3 px-3 text-right">Gesamtbrutto</th>
                                <th class="py-3 px-3 text-right">Steuern</th>
                                <th class="py-3 px-3 text-right">SV (AN)</th>
                                <th class="py-3 px-3 text-right">Auszahlungsbetrag</th>
                                <th class="py-3 px-3 text-right">AG-Kosten</th>
                                <th class="py-3 px-3 text-center">Aktion</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            {#each filteredPayslips as p (p.id)}
                                <tr class="hover:bg-slate-50/60 transition-colors">
                                    <td class="py-3 px-3">
                                        <div class="font-bold text-gray-900">
                                            {p.talent?.contact?.displayName || `${p.talent?.contact?.givenName ?? ''} ${p.talent?.contact?.familyName ?? ''}`.trim() || 'Mitarbeiter'}
                                        </div>
                                        <div class="text-[10px] text-gray-400">
                                            St.-Kl. {(p.calculationDetails as any)?.taxClass || '1'} · {p.talent?.contact?.role || 'Mitarbeiter'}
                                        </div>
                                    </td>
                                    <td class="py-3 px-3 text-gray-600">
                                        {#if p.contract?.entgeltgruppe}
                                            <span class="font-semibold text-indigo-900">{p.contract.entgeltgruppe}</span>
                                            <span class="text-[10px] text-gray-400 block">Stufe {p.contract.erfahrungsstufe ?? 1}</span>
                                        {:else}
                                            <span class="text-gray-400">Kein Tarif</span>
                                        {/if}
                                    </td>
                                    <td class="py-3 px-3 text-right text-gray-600">
                                        <div><strong>{formatNumber(p.workedHours)}</strong> / {formatNumber(p.contractHours)} h</div>
                                        {#if p.overtimeHours > 0}
                                            <span class="text-[10px] text-amber-600 font-medium">+{formatNumber(p.overtimeHours)}h Überstd.</span>
                                        {/if}
                                    </td>
                                    <td class="py-3 px-3 text-right font-semibold text-gray-900">
                                        {formatCurrency(p.grossSalary)}
                                    </td>
                                    <td class="py-3 px-3 text-right text-rose-700">
                                        {formatCurrency(p.totalTax)}
                                    </td>
                                    <td class="py-3 px-3 text-right text-sky-800">
                                        {formatCurrency(p.totalEmployeeSocialSecurity)}
                                    </td>
                                    <td class="py-3 px-3 text-right font-extrabold text-emerald-700 text-sm">
                                        {formatCurrency(p.payoutAmount)}
                                    </td>
                                    <td class="py-3 px-3 text-right text-indigo-950 font-medium">
                                        {formatCurrency(p.totalEmployerCost)}
                                    </td>
                                    <td class="py-3 px-3 text-center">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onclick={() => { selectedPayslip = p; }}
                                            class="gap-1 text-[11px] h-7 px-2"
                                        >
                                            <Eye class="w-3.5 h-3.5" />
                                            Nachweis
                                        </Button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    {/if}
</div>

<!-- Modal: Detailed Payslip Document View -->
{#if selectedPayslip}
    <PayslipDetailModal
        payslip={selectedPayslip}
        onClose={() => { selectedPayslip = null; }}
    />
{/if}
