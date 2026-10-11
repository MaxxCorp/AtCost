<script lang="ts">
    import { listMyPayslips } from "./my-payroll.remote.js";
    import { Button, LoadingSection, ErrorSection } from "@ac/ui";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { 
        FileText, 
        Calendar, 
        DollarSign, 
        Download, 
        Eye, 
        ShieldCheck, 
        Sparkles,
        ArrowRight
    } from "@lucide/svelte";
    import PayslipDetailModal from "#lib/components/payroll/PayslipDetailModal.svelte";

    breadcrumbState.set({
        feature: "my-payroll",
        current: "Meine Abrechnungen",
    });

    const query = $derived(listMyPayslips({}));
    const payslips = $derived(query.current?.data ?? []);

    let selectedPayslip = $state<any>(null);

    function formatCurrency(amount: number | null | undefined): string {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    }

    // Totals for this employee
    const totalPayoutSum = $derived(payslips.reduce((acc, p) => acc + (p.payoutAmount || 0), 0));
    const totalGrossSum = $derived(payslips.reduce((acc, p) => acc + (p.grossSalary || 0), 0));
    const totalTaxesSum = $derived(payslips.reduce((acc, p) => acc + (p.totalTax || 0), 0));
</script>

<div class="space-y-8 max-w-5xl mx-auto">
    <!-- Header banner -->
    <div class="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <div class="flex items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                    <ShieldCheck class="w-3.5 h-3.5" />
                    Offizieller Entgeltnachweis (§ 108 GewO)
                </span>
            </div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Meine Entgeltabrechnungen
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                Übersicht über Ihre monatlichen Gehaltsabrechnungen, Steuer- und Sozialversicherungsabzüge.
            </p>
        </div>
    </div>

    <!-- Personal Overview Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Erhaltene Auszahlungen</span>
            <div class="text-2xl font-black text-emerald-700 tracking-tight">
                {formatCurrency(totalPayoutSum)}
            </div>
            <span class="text-[11px] text-gray-500">Summe aller Nettoüberweisungen</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Gesamtbrutto</span>
            <div class="text-2xl font-black text-gray-900 tracking-tight">
                {formatCurrency(totalGrossSum)}
            </div>
            <span class="text-[11px] text-gray-500">Grundvergütung & Zuschläge</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Abgeführte Steuern</span>
            <div class="text-2xl font-black text-rose-800 tracking-tight">
                {formatCurrency(totalTaxesSum)}
            </div>
            <span class="text-[11px] text-gray-500">Lohnsteuer & ggf. Soli/KiSt</span>
        </div>
    </div>

    <!-- Payslip History List -->
    <div class="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
        <div class="flex items-center gap-2">
            <FileText class="w-5 h-5 text-indigo-600" />
            <h2 class="text-lg font-bold text-gray-900">
                Monatsabrechnungen ({payslips.length})
            </h2>
        </div>

        {#if query.loading && !query.current}
            <LoadingSection message="Lade Abrechnungen..." />
        {:else if query.error}
            <ErrorSection message={query.error.message || "Fehler beim Laden Ihrer Abrechnungen"} />
        {:else if payslips.length === 0}
            <div class="p-12 text-center space-y-3">
                <FileText class="w-10 h-10 text-gray-300 mx-auto" />
                <h3 class="text-base font-bold text-gray-900">Keine Abrechnungen vorhanden</h3>
                <p class="text-xs text-gray-500 max-w-sm mx-auto">
                    Sobald Ihr Arbeitgeber den monatlichen Abrechnungslauf durchführt und abschließt, erscheinen Ihre Entgeltnachweise hier.
                </p>
            </div>
        {:else}
            <div class="divide-y divide-gray-100">
                {#each payslips as p (p.id)}
                    <div class="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 p-3 rounded-xl transition-colors">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                                    {p.payrollRun?.period || 'Monat'}
                                </span>
                                <h3 class="text-sm font-bold text-gray-900">
                                    {p.payrollRun?.name || 'Gehaltsabrechnung'}
                                </h3>
                            </div>
                            <div class="flex items-center gap-4 text-xs text-gray-500 pt-0.5">
                                <span>Geleistet: {p.workedHours ?? 0} h</span>
                                <span>·</span>
                                <span>Gesamtbrutto: {formatCurrency(p.grossSalary)}</span>
                                <span>·</span>
                                <span>Gesetzl. Abzüge: {formatCurrency((p.totalTax || 0) + (p.totalEmployeeSocialSecurity || 0))}</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-4">
                            <div class="text-left sm:text-right">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">Auszahlung</span>
                                <span class="text-base font-extrabold text-emerald-700">{formatCurrency(p.payoutAmount)}</span>
                            </div>

                            <Button
                                size="sm"
                                variant="outline"
                                onclick={() => { selectedPayslip = p; }}
                                class="gap-1.5 text-xs bg-white"
                            >
                                <Eye class="w-4 h-4" />
                                Nachweis anzeigen
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Modal: Detailed Payslip Document View -->
{#if selectedPayslip}
    <PayslipDetailModal
        payslip={selectedPayslip}
        onClose={() => { selectedPayslip = null; }}
    />
{/if}
