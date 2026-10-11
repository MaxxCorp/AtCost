<script lang="ts">
    import { saveTalentPayrollProfile, readTalentPayrollProfile } from "../../../routes/payroll/profile.remote.js";
    import {
        payrollProfileSchema,
        PAYROLL_PROFILE_SGB2_16I_PRESET,
        PAYROLL_PROFILE_SGB2_16D_PRESET,
    } from "@ac/validations";
    import { Button, LoadingSection } from "@ac/ui";
    import { toast } from "svelte-sonner";
    import {
        Shield,
        CreditCard,
        HeartPulse,
        Scale,
        Check,
        Save,
        Sparkles,
        HeartHandshake,
        GraduationCap,
    } from "@lucide/svelte";

    let {
        talentId,
    }: {
        talentId: string;
    } = $props();

    const profileQuery = $derived(readTalentPayrollProfile({ talentId }));
    const profile = $derived(profileQuery.current);

    const rf = saveTalentPayrollProfile.preflight(payrollProfileSchema);
    let isSubmitting = $state(false);

    let prevIssuesLength = 0;
    $effect(() => {
        const issues = rf.fields.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error("Bitte korrigieren Sie die Formularfehler");
        }
        prevIssuesLength = issues.length;
    });

    function applyProfilePreset(preset: Record<string, any>) {
        if (!rf?.fields) return;
        const fields = rf.fields as Record<string, any>;
        for (const [key, val] of Object.entries(preset)) {
            if (fields[key] && typeof fields[key].value === "function") {
                fields[key].value(val);
            }
        }
        toast.info("Abrechnungsvorlage angewendet");
    }
</script>

{#if profileQuery.loading && !profile}
    <LoadingSection message="Lade Abrechnungs- und Steuerstammdaten..." />
{:else if profile}
    <form
        {...rf.preflight(payrollProfileSchema).enhance(async ({ submit }) => {
            isSubmitting = true;
            try {
                const success = await submit();
                if (success) {
                    toast.success("Abrechnungs- und Steuerdaten erfolgreich gespeichert");
                }
            } catch (err: any) {
                toast.error(err?.message || "Fehler beim Speichern der Daten");
            } finally {
                isSubmitting = false;
            }
        })}
        class="space-y-6"
    >
        {#if talentId}
            <input {...rf.fields.talentId.as('hidden', talentId)} />
        {/if}
        {#if profile.id}
            <input {...rf.fields.id.as('hidden', profile.id)} />
        {/if}

        <!-- Quick Presets for SGB II & Standard -->
        <div class="rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 transition-all shadow-2xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <Sparkles class="w-5 h-5 text-teal-600 shrink-0" />
                    <div>
                        <h4 class="text-xs sm:text-sm font-bold text-teal-950">
                            Abrechnungsvorlagen & SGB II Schnellkonfiguration
                        </h4>
                        <p class="text-[11px] text-teal-800">
                            Übernehmen Sie vorkonfigurierte DEÜV- und Steuerstammdaten für § 16i (ALV-frei) oder § 16d (MAE-steuerfrei).
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        onclick={() => applyProfilePreset(PAYROLL_PROFILE_SGB2_16I_PRESET)}
                    >
                        <span>🤝</span>
                        <span>Preset: § 16i (1101)</span>
                    </button>
                    <button
                        type="button"
                        class="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        onclick={() => applyProfilePreset(PAYROLL_PROFILE_SGB2_16D_PRESET)}
                    >
                        <span>🛠️</span>
                        <span>Preset: § 16d (0000)</span>
                    </button>
                    <button
                        type="button"
                        class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        onclick={() => applyProfilePreset({
                            employmentType: 'regular',
                            fundingProgram: 'none',
                            unemploymentInsuranceExempt: false,
                            pensionInsuranceExempt: false,
                            deuevPersonengruppe: '101',
                            deuevBeitragsgruppe: '1111',
                        })}
                    >
                        <span>🌟</span>
                        <span>Regulär (1111)</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Section 1: Steuerliche Daten (Finanzamt) -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4">
            <div class="flex items-center gap-2 pb-2 border-b border-gray-100 text-gray-900 font-bold text-sm">
                <Scale class="w-4 h-4 text-indigo-600" />
                <span>Steuerdaten (Finanzamt & ELStAM)</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                    <label for="taxId" class="block font-semibold text-gray-700 mb-1">
                        Steuer-Identifikationsnummer (11 Ziffern)
                    </label>
                    <input
                        id="taxId"
                        type="text"
                        {...rf.fields.taxId.as('text', profile.taxId ?? '')}
                        placeholder="z.B. 12 345 678 901"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each rf.fields.taxId.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="taxClass" class="block font-semibold text-gray-700 mb-1">
                        Steuerklasse
                    </label>
                    <select
                        id="taxClass"
                        {...rf.fields.taxClass.as('select', profile.taxClass ?? '1')}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
                    >
                        <option value="1">Klasse I (Ledig, geschieden, getrennt lebend)</option>
                        <option value="2">Klasse II (Alleinerziehend mit Entlastungsbetrag)</option>
                        <option value="3">Klasse III (Verheiratet, Hauptverdiener)</option>
                        <option value="4">Klasse IV (Verheiratet, gleichverdienend)</option>
                        <option value="5">Klasse V (Verheiratet, geringer verdienend)</option>
                        <option value="6">Klasse VI (Zweit- oder Nebenarbeitsverhältnis)</option>
                    </select>
                    {#each rf.fields.taxClass.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="childCount" class="block font-semibold text-gray-700 mb-1">
                        Kinderfreibetrag (Zähler)
                    </label>
                    <input
                        id="childCount"
                        step="0.5"
                        min="0"
                        {...rf.fields.childCount.as('number', profile.childCount ?? 0)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each rf.fields.childCount.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="churchTax" class="block font-semibold text-gray-700 mb-1">
                        Kirchensteuerpflicht
                    </label>
                    <select
                        id="churchTax"
                        {...rf.fields.churchTax.as('select', profile.churchTax ?? 'none')}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
                    >
                        <option value="none">Keine Kirchensteuerpflicht (-)</option>
                        <option value="ev">Evangelisch (ev) - 9% (BY/BW 8%)</option>
                        <option value="rk">Römisch-Katholisch (rk) - 9% (BY/BW 8%)</option>
                    </select>
                    {#each rf.fields.churchTax.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="state" class="block font-semibold text-gray-700 mb-1">
                        Bundesland (Arbeitsort / Steuer)
                    </label>
                    <select
                        id="state"
                        {...rf.fields.state.as('select', profile.state ?? 'BE')}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
                    >
                        <option value="BE">Berlin (BE)</option>
                        <option value="BB">Brandenburg (BB)</option>
                        <option value="BW">Baden-Württemberg (BW)</option>
                        <option value="BY">Bayern (BY)</option>
                        <option value="HB">Bremen (HB)</option>
                        <option value="HH">Hamburg (HH)</option>
                        <option value="HE">Hessen (HE)</option>
                        <option value="MV">Mecklenburg-Vorpommern (MV)</option>
                        <option value="NI">Niedersachsen (NI)</option>
                        <option value="NW">Nordrhein-Westfalen (NW)</option>
                        <option value="RP">Rheinland-Pfalz (RP)</option>
                        <option value="SL">Saarland (SL)</option>
                        <option value="SN">Sachsen (SN)</option>
                        <option value="ST">Sachsen-Anhalt (ST)</option>
                        <option value="SH">Schleswig-Holstein (SH)</option>
                        <option value="TH">Thüringen (TH)</option>
                    </select>
                    {#each rf.fields.state.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="employmentType" class="block font-semibold text-gray-700 mb-1">
                        Beschäftigungsart
                    </label>
                    <select
                        id="employmentType"
                        {...rf.fields.employmentType.as('select', profile.employmentType ?? 'regular')}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
                    >
                        <option value="regular">Regulär sozialversicherungspflichtig (Voll-/Teilzeit)</option>
                        <option value="sgb2_16i">§ 16i SGB II (Teilhabe am Arbeitsmarkt - ALV-befreit)</option>
                        <option value="sgb2_16d">§ 16d SGB II (Arbeitsgelegenheit / AGH - MAE steuer- & SV-frei)</option>
                        <option value="minijob">Minijob bis 538 € (§ 8 SGB IV)</option>
                        <option value="midijob">Übergangsbereich / Midijob (538,01 - 2.000 €)</option>
                        <option value="student">Werkstudent (SV-befreit KV/PV/AV)</option>
                        <option value="freelance">Freiberuflich / Honorarkraft</option>
                    </select>
                    {#each rf.fields.employmentType.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Section 2: Sozialversicherung & DEÜV -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4">
            <div class="flex items-center gap-2 pb-2 border-b border-gray-100 text-gray-900 font-bold text-sm">
                <HeartPulse class="w-4 h-4 text-emerald-600" />
                <span>Sozialversicherung & DEÜV-Meldewesen</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div class="md:col-span-2">
                    <label for="socialSecurityNumber" class="block font-semibold text-gray-700 mb-1">
                        Sozialversicherungsnummer (Rentenversicherungsnummer)
                    </label>
                    <input
                        id="socialSecurityNumber"
                        type="text"
                        {...rf.fields.socialSecurityNumber.as('text', profile.socialSecurityNumber ?? '')}
                        placeholder="z.B. 12 150684 M 045"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each rf.fields.socialSecurityNumber.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="healthInsuranceName" class="block font-semibold text-gray-700 mb-1">
                        Krankenkasse
                    </label>
                    <input
                        id="healthInsuranceName"
                        type="text"
                        {...rf.fields.healthInsuranceName.as('text', profile.healthInsuranceName ?? 'Techniker Krankenkasse (TK)')}
                        placeholder="z.B. Techniker Krankenkasse, Barmer, AOK"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each rf.fields.healthInsuranceName.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="healthInsuranceAdditionalContributionPercent" class="block font-semibold text-gray-700 mb-1">
                        Kassenindiv. Zusatzbeitrag (%)
                    </label>
                    <input
                        id="healthInsuranceAdditionalContributionPercent"
                        step="0.1"
                        min="0"
                        {...rf.fields.healthInsuranceAdditionalContributionPercent.as('number', profile.healthInsuranceAdditionalContributionPercent ?? 2.5)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each rf.fields.healthInsuranceAdditionalContributionPercent.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="deuevPersonengruppe" class="block font-semibold text-gray-700 mb-1">
                        DEÜV Personengruppe
                    </label>
                    <input
                        id="deuevPersonengruppe"
                        type="text"
                        {...rf.fields.deuevPersonengruppe.as('text', profile.deuevPersonengruppe ?? '101')}
                        placeholder="101 (Regulär/16i) oder 190 (AGH/16d)"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    <p class="text-[10px] text-gray-500 mt-1">101 = SV-pflichtig / § 16i, 190 = AGH Maßnahme</p>
                    {#each rf.fields.deuevPersonengruppe.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="deuevBeitragsgruppe" class="block font-semibold text-gray-700 mb-1">
                        DEÜV Beitragsgruppenschlüssel (KV RV AV PV)
                    </label>
                    <input
                        id="deuevBeitragsgruppe"
                        type="text"
                        maxlength="4"
                        {...rf.fields.deuevBeitragsgruppe.as('text', profile.deuevBeitragsgruppe ?? '1111')}
                        placeholder="1101 (§ 16i ALV-frei) od. 0000 (§ 16d)"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    <p class="text-[10px] text-gray-500 mt-1">1101 = § 16i (§ 27 SGB III), 0000 = § 16d</p>
                    {#each rf.fields.deuevBeitragsgruppe.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div class="sm:col-span-2 md:col-span-4 flex flex-wrap gap-6 pt-2 border-t border-gray-50">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            {...rf.fields.hasChildren.as('checkbox', profile.hasChildren ?? false)}
                            class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span class="text-xs text-gray-700">Mitarbeiter hat Kind(er) (befreit vom PV-Kinderlosenzuschlag +0,6%)</span>
                    </label>

                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            {...rf.fields.pensionInsuranceExempt.as('checkbox', profile.pensionInsuranceExempt ?? false)}
                            class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span class="text-xs text-gray-700">RV-Befreiung (z.B. Minijob auf Antrag)</span>
                    </label>

                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            {...rf.fields.unemploymentInsuranceExempt.as('checkbox', profile.unemploymentInsuranceExempt ?? false)}
                            class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span class="text-xs text-gray-700">AV-Befreiung (gesetzlich bei § 16i TaAM & Werkstudenten)</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Section 3: SGB II Förderprogramm & Jobcenter-Abrechnung -->
        <div class="rounded-xl border border-teal-200 bg-teal-50/20 p-5 shadow-2xs space-y-4">
            <div class="flex items-center gap-2 pb-2 border-b border-teal-100 text-teal-950 font-bold text-sm">
                <HeartHandshake class="w-4 h-4 text-teal-600" />
                <span>SGB II Förderprogramm & Jobcenter-Abrechnung</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                    <label for="fundingProgram" class="block font-semibold text-gray-700 mb-1">
                        Förderprogramm / Rechtsgrundlage
                    </label>
                    <select
                        id="fundingProgram"
                        {...rf.fields.fundingProgram.as('select', profile.fundingProgram ?? 'none')}
                        class="w-full px-3 py-2 border border-teal-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    >
                        <option value="none">Keine SGB II Förderung (Regulär)</option>
                        <option value="sgb2_16i">§ 16i SGB II - Teilhabe am Arbeitsmarkt (TaAM)</option>
                        <option value="sgb2_16d">§ 16d SGB II - Arbeitsgelegenheit (AGH / MAE)</option>
                    </select>
                    {#each rf.fields.fundingProgram.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="fundingYear" class="block font-semibold text-gray-700 mb-1">
                        Förderjahr (§ 16i Staffel 1-5)
                    </label>
                    <input
                        id="fundingYear"
                        min="1"
                        max="5"
                        step="1"
                        {...rf.fields.fundingYear.as('number', profile.fundingYear ?? 1)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    />
                    <p class="text-[10px] text-gray-500 mt-1">J 1–2: 100%, J 3: 90%, J 4: 80%, J 5: 70%</p>
                    {#each rf.fields.fundingYear.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="fundingSubsidyPercentage" class="block font-semibold text-gray-700 mb-1">
                        Jobcenter Lohnkostenzuschuss (%)
                    </label>
                    <input
                        id="fundingSubsidyPercentage"
                        step="1"
                        min="0"
                        max="100"
                        {...rf.fields.fundingSubsidyPercentage.as('number', profile.fundingSubsidyPercentage ?? 100)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    />
                    <p class="text-[10px] text-gray-500 mt-1">Zzgl. Erstattung der pauschalierten AG-SV-Anteile</p>
                    {#each rf.fields.fundingSubsidyPercentage.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="jobcenterName" class="block font-semibold text-gray-700 mb-1">
                        Zuständiges Jobcenter / Träger
                    </label>
                    <input
                        id="jobcenterName"
                        type="text"
                        {...rf.fields.jobcenterName.as('text', profile.jobcenterName ?? '')}
                        placeholder="z.B. Jobcenter Berlin Mitte"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    />
                    {#each rf.fields.jobcenterName.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="jobcenterReference" class="block font-semibold text-gray-700 mb-1">
                        Jobcenter Förderaktenzeichen / Bewilligung
                    </label>
                    <input
                        id="jobcenterReference"
                        type="text"
                        {...rf.fields.jobcenterReference.as('text', profile.jobcenterReference ?? '')}
                        placeholder="z.B. JC-16i-2026-98124"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white font-mono"
                    />
                    {#each rf.fields.jobcenterReference.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="coachingHoursPerMonth" class="block font-semibold text-gray-700 mb-1">
                        Freigestellte Coachingzeit (Std/Monat)
                    </label>
                    <input
                        id="coachingHoursPerMonth"
                        step="0.5"
                        min="0"
                        {...rf.fields.coachingHoursPerMonth.as('number', profile.coachingHoursPerMonth ?? 2)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    />
                    <p class="text-[10px] text-gray-500 mt-1">Bezahlte Freistellung nach § 16i Abs. 4 SGB II</p>
                    {#each rf.fields.coachingHoursPerMonth.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="furtherTrainingBudget" class="block font-semibold text-gray-700 mb-1">
                        Weiterbildungsbudget gesamt (€)
                    </label>
                    <input
                        id="furtherTrainingBudget"
                        step="50"
                        min="0"
                        {...rf.fields.furtherTrainingBudget.as('number', profile.furtherTrainingBudget ?? 3000)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    />
                    <p class="text-[10px] text-teal-800 mt-1">Gesetzlicher Höchstbetrag: bis zu 3.000 € (§ 16i Abs. 5)</p>
                    {#each rf.fields.furtherTrainingBudget.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="furtherTrainingUsed" class="block font-semibold text-gray-700 mb-1">
                        Bereits genutztes Weiterbildungsbudget (€)
                    </label>
                    <input
                        id="furtherTrainingUsed"
                        step="10"
                        min="0"
                        {...rf.fields.furtherTrainingUsed.as('number', profile.furtherTrainingUsed ?? 0)}
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-hidden bg-white"
                    />
                    {#each rf.fields.furtherTrainingUsed.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Section 4: Auszahlungskonto (Bankverbindung / SEPA) -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4">
            <div class="flex items-center gap-2 pb-2 border-b border-gray-100 text-gray-900 font-bold text-sm">
                <CreditCard class="w-4 h-4 text-sky-600" />
                <span>Bankverbindung für Gehaltsauszahlung (SEPA)</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div class="sm:col-span-2">
                    <label for="iban" class="block font-semibold text-gray-700 mb-1">
                        IBAN
                    </label>
                    <input
                        id="iban"
                        type="text"
                        {...rf.fields.iban.as('text', profile.iban ?? '')}
                        placeholder="DE89 3704 0044 0532 0130 00"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono tracking-wider focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden uppercase"
                    />
                    {#each rf.fields.iban.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label for="bic" class="block font-semibold text-gray-700 mb-1">
                        BIC / SWIFT
                    </label>
                    <input
                        id="bic"
                        type="text"
                        {...rf.fields.bic.as('text', profile.bic ?? '')}
                        placeholder="COBADEFFXXX"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden uppercase"
                    />
                    {#each rf.fields.bic.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <div class="sm:col-span-3">
                    <label for="bankName" class="block font-semibold text-gray-700 mb-1">
                        Kreditinstitut / Bankname
                    </label>
                    <input
                        id="bankName"
                        type="text"
                        {...rf.fields.bankName.as('text', profile.bankName ?? '')}
                        placeholder="z.B. Commerzbank Berlin, DKB, Sparkasse"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    {#each rf.fields.bankName.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>
            </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} class="gap-2">
                <Save class="w-4 h-4" />
                {isSubmitting ? "Speichert..." : "Abrechnungsstammdaten speichern"}
            </Button>
        </div>
    </form>
{/if}
