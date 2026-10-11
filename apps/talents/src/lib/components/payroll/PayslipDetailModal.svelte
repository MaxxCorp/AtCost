<script lang="ts">
    import { X, Printer, CheckCircle, FileText, Building2, User, Clock, AlertCircle, HeartHandshake, Sparkles, GraduationCap, ShieldCheck } from "@lucide/svelte";
    import { Button } from "@ac/ui";

    let {
        payslip,
        onClose,
    }: {
        payslip: any;
        onClose: () => void;
    } = $props();

    function formatCurrency(amount: number | null | undefined): string {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    }

    function formatNumber(val: number | null | undefined): string {
        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val) || 0);
    }

    const talentName = $derived(
        payslip.talent?.contact?.displayName ||
        `${payslip.talent?.contact?.givenName ?? ''} ${payslip.talent?.contact?.familyName ?? ''}`.trim() ||
        'Mitarbeiter'
    );

    const calcDetails = $derived((payslip.calculationDetails as any) || {});
    const profile = $derived((payslip.talent as any)?.payrollProfile || {});
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
    <div class="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        <!-- Modal Top Bar -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/80 shrink-0 print:hidden">
            <div class="flex items-center gap-2">
                <FileText class="w-5 h-5 text-indigo-600" />
                <h2 class="text-lg font-bold text-gray-900">
                    Entgeltabrechnung gem. § 108 GewO
                </h2>
                <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 ml-2">
                    {payslip.jurisdiction ?? 'DE'}
                </span>
                {#if payslip.fundingProgram === 'sgb2_16i'}
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                        § 16i SGB II (TaAM)
                    </span>
                {:else if payslip.fundingProgram === 'sgb2_16d'}
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        § 16d SGB II (AGH / MAE)
                    </span>
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" onclick={() => window.print()} class="gap-1.5 text-xs">
                    <Printer class="w-4 h-4" />
                    Drucken / PDF
                </Button>
                <button
                    onclick={onClose}
                    class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200/60 transition-colors"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>
        </div>

        <!-- Scrollable Document Content -->
        <div class="p-6 md:p-8 space-y-6 overflow-y-auto print:p-0 print:overflow-visible">
            <!-- Header: Company & Employee Info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-xl bg-slate-50 border border-slate-100">
                <!-- Employer -->
                <div class="space-y-1.5 text-sm">
                    <div class="flex items-center gap-2 text-indigo-900 font-bold text-base">
                        <Building2 class="w-4 h-4" />
                        <span>Arbeitgeber: AtCost Organisation</span>
                    </div>
                    <p class="text-xs text-gray-500">Musterstraße 123, 10115 Berlin</p>
                    <p class="text-xs text-gray-600">Abrechnungszeitraum: <strong class="text-gray-900 font-semibold">{payslip.payrollRun?.period || 'Monatsabrechnung'}</strong></p>
                    <p class="text-xs text-gray-600">Rechtskreis: <strong class="text-gray-900 font-semibold">Deutschland (Ost/West vereinheitlicht)</strong></p>
                </div>

                <!-- Employee Header Data -->
                <div class="space-y-1.5 text-sm">
                    <div class="flex items-center gap-2 text-gray-900 font-bold text-base">
                        <User class="w-4 h-4 text-gray-600" />
                        <span>{talentName}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 pt-1">
                        <div>St.-Kl.: <strong class="text-gray-900">{calcDetails.taxClass || '1'}</strong></div>
                        <div>Ki.-Freibetrag: <strong class="text-gray-900">{formatNumber(profile.childCount ?? 0)}</strong></div>
                        <div>KiSt: <strong class="text-gray-900">{calcDetails.churchTaxType === 'none' ? 'Keine' : calcDetails.churchTaxType?.toUpperCase()}</strong></div>
                        <div>Bundesland: <strong class="text-gray-900">{calcDetails.state || 'Berlin (BE)'}</strong></div>
                        <div class="col-span-2 truncate">
                            Krankenkasse: <strong class="text-gray-900">{calcDetails.hmoName || profile.healthInsuranceName || 'Techniker Krankenkasse (TK)'}</strong>
                            {#if calcDetails.hmoAdditionalContributionPercent !== undefined}
                                <span class="text-indigo-700 font-semibold ml-1">({formatNumber(calcDetails.hmoAdditionalContributionPercent)}% Zusatzbeitrag)</span>
                            {/if}
                        </div>
                        <div class="col-span-2 truncate text-gray-600">
                            Unfallversicherung (BG): <strong class="text-gray-900">{calcDetails.accidentInsurerName || profile.accidentHmo?.name || 'BGW (Gesundheitsdienst & Wohlfahrtspflege)'}</strong>
                            {#if calcDetails.pensionFundName || profile.pensionHmo?.name}
                                <span class="ml-2">· ZVK: <strong class="text-gray-900">{calcDetails.pensionFundName || profile.pensionHmo?.name}</strong></span>
                            {/if}
                        </div>
                        {#if payslip.contract?.entgeltgruppe}
                            <div>Tarif: <strong class="text-indigo-900">{payslip.contract.entgeltgruppe} (Stufe {payslip.contract.erfahrungsstufe ?? 1})</strong></div>
                        {/if}
                        <div>Wochenstunden: <strong class="text-gray-900">{payslip.contract?.workHoursPerWeek ?? 39} h</strong></div>
                        {#if payslip.deuevPersonengruppe || payslip.deuevBeitragsgruppe}
                            <div class="col-span-2 text-indigo-900 bg-indigo-50/70 p-1.5 rounded-md border border-indigo-100 text-[11px]">
                                DEÜV: PGR <strong>{payslip.deuevPersonengruppe ?? '101'}</strong> / BGR <strong>{payslip.deuevBeitragsgruppe ?? '1111'}</strong>
                                {#if payslip.fundingProgram === 'sgb2_16i'}
                                    <span class="text-teal-700 font-semibold ml-1">(ALV-frei § 27 SGB III)</span>
                                {:else if payslip.fundingProgram === 'sgb2_16d'}
                                    <span class="text-emerald-700 font-semibold ml-1">(Steuer-/SV-frei § 3 EStG)</span>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Working Time Statistics (SFN & Hours) -->
            <div class="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <div class="flex items-center gap-2 mb-3">
                    <Clock class="w-4 h-4 text-blue-600" />
                    <h3 class="text-xs font-bold text-blue-900 uppercase tracking-wider">
                        Arbeitszeit- & Zuschlagsnachweis
                    </h3>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-center text-xs">
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Soll-Stunden</span>
                        <strong class="text-sm font-bold text-gray-900">{formatNumber(payslip.contractHours)} h</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Geleistet</span>
                        <strong class="text-sm font-bold text-emerald-700">{formatNumber(payslip.workedHours)} h</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Überstunden</span>
                        <strong class="text-sm font-bold {payslip.overtimeHours > 0 ? 'text-amber-700' : 'text-gray-900'}">{formatNumber(payslip.overtimeHours)} h</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Nachtstunden</span>
                        <strong class="text-sm font-bold text-indigo-700">{formatNumber(payslip.nightHours)} h</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Sonntagsstunden</span>
                        <strong class="text-sm font-bold text-purple-700">{formatNumber(payslip.sundayHours)} h</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Feiertagsstunden</span>
                        <strong class="text-sm font-bold text-rose-700">{formatNumber(payslip.holidayHours)} h</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span class="text-gray-500 block text-[11px]">Lohnfortzahlung</span>
                        <strong class="text-sm font-bold text-teal-700">{formatNumber(payslip.paidLeaveHours)} h</strong>
                    </div>
                </div>
            </div>

            <!-- Gross Components Table -->
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <div class="bg-slate-100/80 px-4 py-2.5 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider flex justify-between">
                    <span>Brutto-Bezüge (Lohnarten)</span>
                    <span>Betrag</span>
                </div>
                <table class="w-full text-xs text-left">
                    <thead class="bg-slate-50 text-gray-500 border-b border-gray-100 font-medium">
                        <tr>
                            <th class="p-3">Lohnart / Bezeichnung</th>
                            <th class="p-3 text-right">Menge/Std</th>
                            <th class="p-3 text-right">Satz (€)</th>
                            <th class="p-3 text-center">§ 3b Steuerfrei</th>
                            <th class="p-3 text-right">Gesamt (€)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        {#if Array.isArray(payslip.lineItems) && payslip.lineItems.length > 0}
                            {#each payslip.lineItems as item}
                                <tr class="hover:bg-slate-50/50">
                                    <td class="p-3 font-medium text-gray-900">
                                        {item.name}
                                        {#if item.legalReference}
                                            <span class="text-[10px] text-gray-400 block">{item.legalReference}</span>
                                        {/if}
                                    </td>
                                    <td class="p-3 text-right text-gray-600">{item.hours ? formatNumber(item.hours) : '-'}</td>
                                    <td class="p-3 text-right text-gray-600">{item.rate ? formatCurrency(item.rate) : '-'}</td>
                                    <td class="p-3 text-center">
                                        {#if item.taxExempt}
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Ja</span>
                                        {:else}
                                            <span class="text-gray-400">-</span>
                                        {/if}
                                    </td>
                                    <td class="p-3 text-right font-semibold text-gray-900">{formatCurrency(item.amount)}</td>
                                </tr>
                            {/each}
                        {:else}
                            <tr>
                                <td class="p-3 font-medium text-gray-900">Grundvergütung</td>
                                <td class="p-3 text-right text-gray-600">{formatNumber(payslip.contractHours)}</td>
                                <td class="p-3 text-right text-gray-600">{formatCurrency(payslip.hourlyWage)}</td>
                                <td class="p-3 text-center text-gray-400">-</td>
                                <td class="p-3 text-right font-semibold text-gray-900">{formatCurrency(payslip.baseSalary)}</td>
                            </tr>
                        {/if}
                    </tbody>
                    <tfoot class="bg-slate-50 font-semibold text-gray-900 border-t border-gray-200">
                        <tr>
                            <td colspan="4" class="p-3 text-right">Gesamtbrutto:</td>
                            <td class="p-3 text-right text-sm font-bold text-gray-900">{formatCurrency(payslip.grossSalary)}</td>
                        </tr>
                        <tr class="text-[11px] text-gray-600 border-t border-gray-100">
                            <td colspan="4" class="px-3 py-1.5 text-right">Steuer-Brutto:</td>
                            <td class="px-3 py-1.5 text-right font-medium">{formatCurrency(payslip.taxableGross)}</td>
                        </tr>
                        <tr class="text-[11px] text-gray-600">
                            <td colspan="4" class="px-3 py-1.5 text-right">SV-Brutto (KV/PV & RV/AV gedeckelt):</td>
                            <td class="px-3 py-1.5 text-right font-medium">{formatCurrency(payslip.socialSecurityGross)} / {formatCurrency(payslip.pensionGross)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Deductions Grid: Taxes & Social Security -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Taxes -->
                <div class="border border-rose-100 rounded-xl overflow-hidden bg-rose-50/20 shadow-2xs">
                    <div class="bg-rose-100/60 px-4 py-2 border-b border-rose-200 text-xs font-bold text-rose-950 uppercase tracking-wider">
                        Steuerabzüge (Finanzamt)
                    </div>
                    <div class="p-4 space-y-2 text-xs">
                        <div class="flex justify-between py-1 border-b border-rose-100/60">
                            <span class="text-gray-600">Lohnsteuer:</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.wageTax)}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-rose-100/60">
                            <span class="text-gray-600">Solidaritätszuschlag:</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.solidaritySurcharge)}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-rose-100/60">
                            <span class="text-gray-600">Kirchensteuer:</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.churchTax)}</span>
                        </div>
                        <div class="flex justify-between pt-2 font-bold text-rose-950 text-sm">
                            <span>Gesamt Steuern:</span>
                            <span>{formatCurrency(payslip.totalTax)}</span>
                        </div>
                    </div>
                </div>

                <!-- Social Security -->
                <div class="border border-sky-100 rounded-xl overflow-hidden bg-sky-50/20 shadow-2xs">
                    <div class="bg-sky-100/60 px-4 py-2 border-b border-sky-200 text-xs font-bold text-sky-950 uppercase tracking-wider">
                        Sozialversicherungsbeiträge (Arbeitnehmer)
                    </div>
                    <div class="p-4 space-y-2 text-xs">
                        <div class="flex justify-between py-1 border-b border-sky-100/60">
                            <span class="text-gray-600">Krankenversicherung (KV AN):</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.employeeHealthInsurance)}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-sky-100/60">
                            <span class="text-gray-600">Rentenversicherung (RV AN 9,3%):</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.employeePensionInsurance)}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-sky-100/60">
                            <span class="text-gray-600">Arbeitslosenversicherung (AV AN 1,3%):</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.employeeUnemploymentInsurance)}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-sky-100/60">
                            <span class="text-gray-600">Pflegeversicherung (PV AN):</span>
                            <span class="font-semibold text-gray-900">{formatCurrency(payslip.employeeLongTermCareInsurance)}</span>
                        </div>
                        {#if calcDetails.employeePensionFund && calcDetails.employeePensionFund > 0}
                            <div class="flex justify-between py-1 border-b border-sky-100/60 text-purple-900 font-medium">
                                <span>Zusatzversorgung (ZVK/VBL AN):</span>
                                <span class="font-semibold">{formatCurrency(calcDetails.employeePensionFund)}</span>
                            </div>
                        {/if}
                        <div class="flex justify-between pt-2 font-bold text-sky-950 text-sm">
                            <span>Gesamt SV-Arbeitnehmer:</span>
                            <span>{formatCurrency(payslip.totalEmployeeSocialSecurity)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Net & Payout Banner -->
            <div class="p-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div class="space-y-1 text-center md:text-left">
                    <span class="text-xs font-semibold tracking-wider text-emerald-100 uppercase block">Auszahlungsbetrag (Netto-Überweisung)</span>
                    <div class="text-3xl font-extrabold tracking-tight">
                        {formatCurrency(payslip.payoutAmount)}
                    </div>
                    <div class="text-xs text-emerald-100 pt-1 flex items-center gap-3">
                        <span>Nettoentgelt: {formatCurrency(payslip.netSalary)}</span>
                        {#if payslip.netDeductions > 0}
                            <span>· Netto-Abzug (VL): {formatCurrency(payslip.netDeductions)}</span>
                        {/if}
                    </div>
                </div>
                {#if profile.iban}
                    <div class="text-right text-xs bg-white/10 backdrop-blur-xs px-4 py-3 rounded-xl border border-white/20">
                        <span class="text-emerald-200 block text-[10px]">Bankverbindung</span>
                        <span class="font-mono font-bold tracking-wider">{profile.iban}</span>
                        <span class="text-emerald-200 block text-[11px]">{profile.bankName || 'Konto des Mitarbeiters'}</span>
                    </div>
                {/if}
            </div>

            <!-- Employer Cost Summary (Arbeitgeberaufwand) with full Insurer Breakdown -->
            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-gray-700 space-y-3">
                <div class="font-bold text-gray-900 flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                        <span class="text-sm font-extrabold text-slate-900">Arbeitgeberbelastung / Gesamtpersonalkosten</span>
                        <span class="text-[11px] text-gray-500 block font-normal">Gesetzliche AG-Anteile, Sozialkassen-Umlagen (U1–U3), Berufsgenossenschaft & Zusatzversorgung</span>
                    </div>
                    <span class="text-base font-black font-mono text-indigo-950">{formatCurrency(payslip.totalEmployerCost)}</span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div class="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span class="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">KV AG</span>
                        <strong class="text-xs text-gray-900 font-mono">{formatCurrency(payslip.employerHealthInsurance)}</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span class="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">RV AG (9,3%)</span>
                        <strong class="text-xs text-gray-900 font-mono">{formatCurrency(payslip.employerPensionInsurance)}</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span class="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">AV AG (1,3%)</span>
                        <strong class="text-xs text-gray-900 font-mono">{formatCurrency(payslip.employerUnemploymentInsurance)}</strong>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span class="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">PV AG</span>
                        <strong class="text-xs text-gray-900 font-mono">{formatCurrency(payslip.employerLongTermCareInsurance)}</strong>
                    </div>
                </div>

                <!-- Extended Levies & Specialized Providers -->
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[11px] pt-1">
                    <div class="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                        <span class="text-rose-800 block text-[10px] uppercase font-bold tracking-wider">
                            U1 Umlage {calcDetails.u1TierPercent ? `(${calcDetails.u1TierPercent}%)` : ''}
                        </span>
                        <strong class="text-xs text-rose-950 font-mono">{formatCurrency(calcDetails.u1Levy ?? 0)}</strong>
                        <span class="text-[10px] text-rose-700 block mt-0.5">Entgeltfortzahlung</span>
                    </div>

                    <div class="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                        <span class="text-rose-800 block text-[10px] uppercase font-bold tracking-wider">U2 Umlage</span>
                        <strong class="text-xs text-rose-950 font-mono">{formatCurrency(calcDetails.u2Levy ?? 0)}</strong>
                        <span class="text-[10px] text-rose-700 block mt-0.5">Mutterschutz</span>
                    </div>

                    <div class="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                        <span class="text-rose-800 block text-[10px] uppercase font-bold tracking-wider">U3 Insolvenz</span>
                        <strong class="text-xs text-rose-950 font-mono">{formatCurrency(calcDetails.u3Levy ?? 0)}</strong>
                        <span class="text-[10px] text-rose-700 block mt-0.5">Insolvenzgeld</span>
                    </div>

                    <div class="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/80">
                        <span class="text-amber-800 block text-[10px] uppercase font-bold tracking-wider truncate" title={calcDetails.accidentInsurerName || 'Berufsgenossenschaft'}>
                            BG (Unfallvers.)
                        </span>
                        <strong class="text-xs text-amber-950 font-mono">{formatCurrency(calcDetails.employerAccidentInsurance ?? 0)}</strong>
                        <span class="text-[10px] text-amber-700 block mt-0.5 truncate" title={calcDetails.accidentInsuranceAdditional ? `Inkl. ${formatCurrency(calcDetails.accidentInsuranceAdditional)} ${calcDetails.accidentAdditionalLabel || 'Ausgleichsumlage'}` : (calcDetails.accidentInsurerName || 'DGUV')}>
                            {calcDetails.accidentInsuranceAdditional ? `Inkl. Wohlfahrtspflege` : (calcDetails.accidentInsurerName || 'DGUV')}
                        </span>
                    </div>

                    <div class="bg-purple-50/60 p-2.5 rounded-lg border border-purple-200/80">
                        <span class="text-purple-800 block text-[10px] uppercase font-bold tracking-wider truncate" title={calcDetails.pensionFundName || 'ZVK / VBL'}>
                            Zusatzvers. (AG)
                        </span>
                        <strong class="text-xs text-purple-950 font-mono">{formatCurrency(calcDetails.employerPensionFund ?? 0)}</strong>
                        <span class="text-[10px] text-purple-700 block mt-0.5 truncate">{calcDetails.pensionFundName || 'Optional'}</span>
                    </div>
                </div>
            </div>

            <!-- SGB II Funding & Jobcenter Refund Details -->
            {#if payslip.fundingProgram === 'sgb2_16i' || (payslip.jobcenterSubsidy && payslip.jobcenterSubsidy > 0)}
                <div class="p-5 rounded-xl border border-teal-200 bg-teal-50/50 space-y-3 shadow-2xs">
                    <div class="flex items-center justify-between pb-2 border-b border-teal-100">
                        <div class="flex items-center gap-2 text-teal-950 font-bold text-sm">
                            <HeartHandshake class="w-4 h-4 text-teal-600" />
                            <span>Jobcenter-Zuschuss & Förderabrechnung (§ 16i SGB II)</span>
                        </div>
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                            Förderquote: {calcDetails.fundingSubsidyPercentage ?? 100}% (Jahr {calcDetails.fundingYear ?? 1})
                        </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div class="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                            <span class="text-gray-500 block text-[11px]">Gesamter Jobcenter-Zuschuss</span>
                            <strong class="text-base font-bold text-teal-800">{formatCurrency(payslip.jobcenterSubsidy)}</strong>
                            <span class="text-[10px] text-gray-500 block">Lohnkosten + pauschal. AG-SV-Anteil</span>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                            <span class="text-gray-500 block text-[11px]">Effektiver Netto-AG-Aufwand</span>
                            <strong class="text-base font-bold text-indigo-900">{formatCurrency(payslip.netEmployerCost)}</strong>
                            <span class="text-[10px] text-gray-500 block">Gesamtkosten abzüglich Erstattung</span>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                            <span class="text-gray-500 block text-[11px]">Weiterbildungsbudget (§ 16i Abs. 5)</span>
                            <strong class="text-base font-bold text-slate-800">{formatCurrency((calcDetails.furtherTrainingBudget ?? 3000) - (calcDetails.furtherTrainingUsed ?? 0))} frei</strong>
                            <span class="text-[10px] text-teal-700 block">{formatCurrency(calcDetails.furtherTrainingUsed ?? 0)} von {formatCurrency(calcDetails.furtherTrainingBudget ?? 3000)} beansprucht</span>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-teal-900 pt-1 border-t border-teal-100/60">
                        <div class="flex items-center gap-1.5">
                            <Clock class="w-3.5 h-3.5 text-teal-600" />
                            <span>Monatlich bezahlte Coaching-Freistellung: <strong>{calcDetails.coachingHoursPerMonth ?? 2} Stunden</strong> gem. § 16i Abs. 4 SGB II</span>
                        </div>
                        {#if profile.jobcenterReference || calcDetails.jobcenterReference}
                            <div class="font-mono text-gray-600">
                                Aktenzeichen: {profile.jobcenterReference || calcDetails.jobcenterReference}
                            </div>
                        {/if}
                    </div>
                </div>
            {:else if payslip.fundingProgram === 'sgb2_16d'}
                <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs text-emerald-950 space-y-2 shadow-2xs">
                    <div class="flex items-center justify-between font-bold">
                        <div class="flex items-center gap-2">
                            <ShieldCheck class="w-4 h-4 text-emerald-600" />
                            <span>Arbeitsgelegenheit mit Mehraufwandsentschädigung (AGH § 16d SGB II)</span>
                        </div>
                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                            100% öffentlich gefördert (Netto-AG: 0,00 €)
                        </span>
                    </div>
                    <p class="text-[11px] text-emerald-800">
                        Rechtscharakter: Kein Arbeitsverhältnis im Sinne des Arbeitsrechts (§ 16d Abs. 7 SGB II). Die Mehraufwandsentschädigung (MAE) ist nach § 3 Nr. 2 EStG vollständig einkommensteuerfrei und sozialversicherungsfrei (DEÜV Personengruppe 190, Beitragsgruppe 0000).
                    </p>
                </div>
            {/if}
        </div>
    </div>
</div>
