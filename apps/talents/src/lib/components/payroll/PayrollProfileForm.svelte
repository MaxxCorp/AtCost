<script lang="ts">
    import { saveTalentPayrollProfile, readTalentPayrollProfile } from "../../../routes/payroll/profile.remote.js";
    import { listHmos } from "../../../routes/hmos/hmos.remote.js";
    import {
        payrollProfileSchema,
        PAYROLL_PROFILE_SGB2_16I_PRESET,
        PAYROLL_PROFILE_SGB2_16D_PRESET,
    } from "@ac/validations";
    import { Button, AsyncButton, LoadingSection, useFormValidationFeedback } from "@ac/ui";
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
        ExternalLink,
        ShieldAlert,
        PiggyBank,
        Building2,
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

    const feedback = useFormValidationFeedback(() => rf, {
        message: () => "Bitte korrigieren Sie die Formularfehler",
    });

    let presetValues = $state<Record<string, any>>({});

    function applyProfilePreset(preset: Record<string, any>) {
        presetValues = { ...presetValues, ...preset };
        toast.info("Abrechnungsvorlage angewendet");
    }

    const hmosQuery = listHmos({ limit: 100 });
    const allProviders = $derived(hmosQuery.current?.data ?? []);

    const healthProviders = $derived(
        allProviders.filter((p: any) => p.category === 'health' || (!p.category && !p.accidentGefahrklasse && !p.pensionEmployerPercent))
    );
    const accidentProviders = $derived(
        allProviders.filter((p: any) => p.category === 'accident' || p.accidentGefahrklasse != null)
    );
    const pensionProviders = $derived(
        allProviders.filter((p: any) => p.category === 'pension' || p.pensionEmployerPercent != null)
    );

    let selectedHmoId = $state<string>('');
    let selectedAccidentHmoId = $state<string>('');
    let selectedPensionHmoId = $state<string>('');
    let selectedU1Tier = $state<number>(70);
    let u1Exempt = $state<boolean>(false);
    let u3Exempt = $state<boolean>(false);
    let accidentAdditionalApplicable = $state<boolean>(true);

    $effect(() => {
        if (profile?.hmoId) {
            selectedHmoId = profile.hmoId;
        } else if (profile?.healthInsuranceName && healthProviders.length > 0) {
            const found = healthProviders.find((h: any) => h.name === profile.healthInsuranceName);
            if (found) selectedHmoId = found.id;
        } else if (!selectedHmoId && healthProviders.length > 0) {
            selectedHmoId = healthProviders[0].id;
        }

        if (profile?.accidentHmoId) {
            selectedAccidentHmoId = profile.accidentHmoId;
        } else if (!selectedAccidentHmoId && accidentProviders.length > 0) {
            selectedAccidentHmoId = accidentProviders[0].id;
        }

        if (profile?.pensionHmoId) {
            selectedPensionHmoId = profile.pensionHmoId;
        }

        if (profile?.u1CompensationPercent !== undefined && profile?.u1CompensationPercent !== null) {
            selectedU1Tier = Number(profile.u1CompensationPercent);
        }

        if (profile?.u1Exempt !== undefined && profile?.u1Exempt !== null) {
            u1Exempt = Boolean(profile.u1Exempt);
        }

        if (profile?.u3Exempt !== undefined && profile?.u3Exempt !== null) {
            u3Exempt = Boolean(profile.u3Exempt);
        }

        if (profile?.accidentAdditionalApplicable !== undefined && profile?.accidentAdditionalApplicable !== null) {
            accidentAdditionalApplicable = Boolean(profile.accidentAdditionalApplicable);
        }
    });

    const effectiveHmo = $derived(
        healthProviders.find((h: any) => h.id === selectedHmoId) ??
        (profile?.hmoId ? healthProviders.find((h: any) => h.id === profile.hmoId) : null) ??
        healthProviders[0] ??
        null
    );

    const effectiveAccidentHmo = $derived(
        accidentProviders.find((h: any) => h.id === selectedAccidentHmoId) ??
        (profile?.accidentHmoId ? accidentProviders.find((h: any) => h.id === profile.accidentHmoId) : null) ??
        accidentProviders[0] ??
        null
    );

    const effectivePensionHmo = $derived(
        pensionProviders.find((h: any) => h.id === selectedPensionHmoId) ??
        (profile?.pensionHmoId ? pensionProviders.find((h: any) => h.id === profile.pensionHmoId) : null) ??
        null
    );

    function handleHmoSelect(e: Event) {
        const val = (e.target as HTMLSelectElement).value;
        selectedHmoId = val;
        const matched = healthProviders.find((h: any) => h.id === val);
        if (matched) {
            if (matched.u1DefaultCompensationPercent) {
                selectedU1Tier = Number(matched.u1DefaultCompensationPercent);
            }
            toast.info(`${matched.name} ausgewählt (${Number(matched.additionalContributionPercent).toFixed(2)}% Zusatzbeitrag)`);
        }
    }

    function handleAccidentHmoSelect(e: Event) {
        const val = (e.target as HTMLSelectElement).value;
        selectedAccidentHmoId = val;
        const matched = accidentProviders.find((h: any) => h.id === val);
        if (matched) {
            toast.info(`Berufsgenossenschaft ${matched.name} ausgewählt`);
        }
    }

    function handlePensionHmoSelect(e: Event) {
        const val = (e.target as HTMLSelectElement).value;
        selectedPensionHmoId = val;
        if (val) {
            const matched = pensionProviders.find((h: any) => h.id === val);
            if (matched) toast.info(`Zusatzversorgung ${matched.name} zugewiesen`);
        } else {
            toast.info("Keine Zusatzversorgungskasse zugewiesen");
        }
    }

    function handleU1TierSelect(e: Event) {
        const val = Number((e.target as HTMLSelectElement).value);
        selectedU1Tier = val;
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
                        {...rf.fields.taxClass.as('select', presetValues.taxClass ?? profile.taxClass ?? '1')}
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
                        {...rf.fields.employmentType.as('select', presetValues.employmentType ?? profile.employmentType ?? 'regular')}
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
                    <label for="deuevPersonengruppe" class="block font-semibold text-gray-700 mb-1">
                        DEÜV Personengruppe
                    </label>
                    <input
                        id="deuevPersonengruppe"
                        type="text"
                        {...rf.fields.deuevPersonengruppe.as('text', presetValues.deuevPersonengruppe ?? profile.deuevPersonengruppe ?? '101')}
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
                        DEÜV Beitragsgruppe (KV RV AV PV)
                    </label>
                    <input
                        id="deuevBeitragsgruppe"
                        type="text"
                        maxlength="4"
                        {...rf.fields.deuevBeitragsgruppe.as('text', presetValues.deuevBeitragsgruppe ?? profile.deuevBeitragsgruppe ?? '1111')}
                        placeholder="1101 (§ 16i ALV-frei) od. 0000 (§ 16d)"
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                    />
                    <p class="text-[10px] text-gray-500 mt-1">1101 = § 16i (§ 27 SGB III), 0000 = § 16d</p>
                    {#each rf.fields.deuevBeitragsgruppe.issues() ?? [] as issue}
                        <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                    {/each}
                </div>

                <!-- Unified Provider & Levies Section (Krankenkassen, Berufsgenossenschaften, Zusatzversorgung) -->
                <div class="sm:col-span-2 md:col-span-4 rounded-2xl border border-indigo-200/80 bg-slate-50/70 p-5 space-y-5 shadow-2xs">
                    <div class="flex items-center justify-between pb-3 border-b border-indigo-100">
                        <div class="flex items-center gap-2">
                            <Building2 class="w-4 h-4 text-indigo-700" />
                            <div>
                                <h4 class="font-bold text-gray-900 text-xs sm:text-sm">
                                    Versicherungsträger & Umlagen (Einzugsstelle, BG & ZVK)
                                </h4>
                                <p class="text-[11px] text-gray-500">
                                    Alle Beitragssätze und Berechnungsparameter werden direkt aus den Stammdaten geladen (keine manuelle Falscheingabe).
                                </p>
                            </div>
                        </div>
                        <a
                            href="/hmos"
                            target="_blank"
                            class="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-white border border-indigo-200 shadow-2xs"
                            title="Versicherer & Träger verwalten"
                        >
                            <span>Träger verwalten</span>
                            <ExternalLink size={12} />
                        </a>
                    </div>

                    <!-- 1. Krankenkasse (Einzugsstelle) -->
                    <div class="rounded-xl border border-rose-100 bg-white p-4 space-y-3.5 shadow-2xs">
                        <div class="flex items-center justify-between">
                            <label for="hmoId" class="block font-bold text-gray-900 text-xs flex items-center gap-2">
                                <HeartPulse size={15} class="text-rose-600" />
                                <span>Krankenkasse (Einzugsstelle für KV, RV, AV, PV & U1–U3) *</span>
                            </label>
                            {#if effectiveHmo}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide {effectiveHmo.type === 'private' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'}">
                                    {effectiveHmo.type === 'private' ? 'Privatversichert (PKV)' : 'Gesetzlich versichert (GKV)'}
                                </span>
                            {/if}
                        </div>

                        {#if hmosQuery.loading && healthProviders.length === 0}
                            <div class="p-2.5 text-xs text-gray-500 bg-slate-50 rounded-lg border border-gray-200">
                                Lade Krankenkassen-Stammdaten...
                            </div>
                        {:else}
                            <select
                                id="hmoId"
                                {...rf.fields.hmoId.as('select', selectedHmoId || profile.hmoId || '')}
                                onchange={handleHmoSelect}
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden bg-white shadow-2xs"
                            >
                                {#if !selectedHmoId && !profile.hmoId}
                                    <option value="" disabled>-- Bitte Krankenkasse auswählen --</option>
                                {/if}
                                {#each healthProviders as hmoItem (hmoItem.id)}
                                    <option value={hmoItem.id}>
                                        {hmoItem.name} ({Number(hmoItem.additionalContributionPercent).toFixed(2)}% Zusatzbeitrag){hmoItem.type === 'private' ? ' [PKV]' : ''}
                                    </option>
                                {/each}
                            </select>
                        {/if}
                        {#each rf.fields.hmoId?.issues?.() ?? [] as issue}
                            <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                        {/each}

                        {#if effectiveHmo}
                            <!-- HMO Rates breakdown & U1-U3 options -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div class="bg-rose-50/60 p-2.5 rounded-lg border border-rose-100">
                                    <span class="text-[10px] text-rose-800 block uppercase font-bold tracking-wider">Zusatzbeitrag</span>
                                    <span class="text-sm font-extrabold font-mono text-rose-950">
                                        {Number(effectiveHmo.additionalContributionPercent ?? 2.5).toFixed(2)} %
                                    </span>
                                    <span class="text-[10px] text-rose-700 block mt-0.5">Paritätisch 50/50</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <span class="text-[10px] text-gray-600 block uppercase font-bold tracking-wider">U2 Mutterschutz</span>
                                    <span class="text-sm font-extrabold font-mono text-gray-900">
                                        {Number(effectiveHmo.u2Rate ?? 0.44).toFixed(2)} %
                                    </span>
                                    <span class="text-[10px] text-gray-500 block mt-0.5">100% erstattungsfähig</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <span class="text-[10px] text-gray-600 block uppercase font-bold tracking-wider">U3 Insolvenzgeld</span>
                                    <span class="text-sm font-extrabold font-mono text-gray-900">
                                        {Number(effectiveHmo.u3Rate ?? 0.15).toFixed(2)} %
                                    </span>
                                    <span class="text-[10px] text-gray-500 block mt-0.5">Bundesweit einheitlich</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <span class="text-[10px] text-gray-600 block uppercase font-bold tracking-wider">Kennziffern</span>
                                    <span class="text-[11px] font-mono font-bold text-gray-800 block truncate">
                                        BBNR: {effectiveHmo.betriebsnummer || '—'}
                                    </span>
                                    <span class="text-[10px] text-gray-500 block truncate">IK: {effectiveHmo.ikNumber || '—'}</span>
                                </div>
                            </div>

                            <!-- U1 Erstattungssatz Wahltarif & Umlagen-Befreiungen -->
                            <div class="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                    <div>
                                        <label for="u1Tier" class="block font-bold text-gray-800 text-[11px] mb-1">
                                            U1 Wahltarif (Erstattungssatz bei Krankheit gem. AAG)
                                        </label>
                                        <select
                                            id="u1Tier"
                                            value={selectedU1Tier}
                                            onchange={handleU1TierSelect}
                                            disabled={u1Exempt}
                                            class="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                        >
                                            <option value={50}>50% Erstattungssatz (niedrigster Beitrag)</option>
                                            <option value={65}>65% Erstattungssatz</option>
                                            <option value={70}>70% Erstattungssatz (Standard)</option>
                                            <option value={80}>80% Erstattungssatz (höchste Absicherung)</option>
                                        </select>
                                        <input {...rf.fields.u1CompensationPercent.as('hidden', selectedU1Tier)} />
                                    </div>
                                    <div class="space-y-1.5 pt-1">
                                        <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
                                            <input
                                                {...rf.fields.u1Exempt.as('checkbox', u1Exempt)}
                                                onchange={(e) => { u1Exempt = e.currentTarget.checked; }}
                                                class="rounded border-gray-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                                            />
                                            <span class="font-semibold text-gray-800">U1-befreit (> 30 Mitarbeiter im Unternehmen)</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
                                            <input
                                                {...rf.fields.u3Exempt.as('checkbox', u3Exempt)}
                                                onchange={(e) => { u3Exempt = e.currentTarget.checked; }}
                                                class="rounded border-gray-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                                            />
                                            <span>Insolvenzgeldumlage (U3) befreit (z.B. öffentlicher Träger)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        {/if}

                        {#if effectiveHmo?.name}
                            <input {...rf.fields.healthInsuranceName.as('hidden', effectiveHmo.name)} />
                        {/if}
                        {#if effectiveHmo?.additionalContributionPercent !== undefined}
                            <input {...rf.fields.healthInsuranceAdditionalContributionPercent.as('hidden', Number(effectiveHmo.additionalContributionPercent))} />
                        {/if}
                        {#if effectiveHmo?.type}
                            <input {...rf.fields.healthInsuranceType.as('hidden', effectiveHmo.type)} />
                        {/if}
                    </div>

                    <!-- 2. Gesetzliche Unfallversicherung (Berufsgenossenschaft) -->
                    <div class="rounded-xl border border-amber-200/80 bg-white p-4 space-y-3.5 shadow-2xs">
                        <div class="flex items-center justify-between">
                            <label for="accidentHmoId" class="block font-bold text-gray-900 text-xs flex items-center gap-2">
                                <ShieldAlert size={15} class="text-amber-600" />
                                <span>Gesetzliche Unfallversicherung (Berufsgenossenschaft / DGUV) *</span>
                            </label>
                            {#if effectiveAccidentHmo}
                                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                                    GK {Number(effectiveAccidentHmo.accidentGefahrklasse ?? 1.25).toFixed(2)} · Fuß {Number(effectiveAccidentHmo.accidentBeitragsfuss ?? 3.5).toFixed(2)} €
                                </span>
                            {/if}
                        </div>

                        <select
                            id="accidentHmoId"
                            {...rf.fields.accidentHmoId.as('select', selectedAccidentHmoId || profile.accidentHmoId || '')}
                            onchange={handleAccidentHmoSelect}
                            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden bg-white shadow-2xs"
                        >
                            {#if !selectedAccidentHmoId && !profile.accidentHmoId}
                                <option value="" disabled>-- Bitte Berufsgenossenschaft auswählen --</option>
                            {/if}
                            {#each accidentProviders as bgItem (bgItem.id)}
                                <option value={bgItem.id}>
                                    {bgItem.name} {bgItem.accidentMemberNumber ? `(${bgItem.accidentMemberNumber})` : ''}
                                </option>
                            {/each}
                        </select>
                        {#each rf.fields.accidentHmoId?.issues?.() ?? [] as issue}
                            <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                        {/each}

                        {#if effectiveAccidentHmo}
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-amber-50/40 p-2.5 rounded-xl border border-amber-100">
                                <div>
                                    <span class="text-[10px] text-amber-800 block uppercase font-bold tracking-wider">Gefahrklasse</span>
                                    <span class="text-sm font-extrabold font-mono text-amber-950">
                                        {Number(effectiveAccidentHmo.accidentGefahrklasse ?? 1.25).toFixed(2)}
                                    </span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-amber-800 block uppercase font-bold tracking-wider">Beitragsfuß</span>
                                    <span class="text-sm font-extrabold font-mono text-amber-950">
                                        {Number(effectiveAccidentHmo.accidentBeitragsfuss ?? 3.50).toFixed(2)} €
                                    </span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-amber-800 block uppercase font-bold tracking-wider">Tarifstelle</span>
                                    <span class="text-sm font-bold text-gray-800">
                                        {effectiveAccidentHmo.accidentGefahrtarifstelle || '01'}
                                    </span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-amber-800 block uppercase font-bold tracking-wider">Mitgliedsnummer</span>
                                    <span class="text-xs font-mono font-bold text-amber-900 truncate block">
                                        {effectiveAccidentHmo.accidentMemberNumber || '—'}
                                    </span>
                                </div>
                            </div>

                            {#if Number(effectiveAccidentHmo.accidentAdditionalRate ?? 0) > 0}
                                <div class="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="space-y-0.5">
                                            <span class="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                                <Sparkles size={13} class="text-amber-700" />
                                                <span>{effectiveAccidentHmo.accidentAdditionalLabel || 'Ausgleichsumlage Wohlfahrtspflege'}</span>
                                            </span>
                                            <p class="text-[11px] text-amber-800">
                                                Gesetzliche Zusatzkomponente ({Number(effectiveAccidentHmo.accidentAdditionalRate).toFixed(2)} € je 1.000 € Arbeitsentgelt) für Mitgliedsbetriebe der Freien Wohlfahrtspflege & Sozialunternehmen gem. § 2 Abs. 1 Nr. 9 SGB VII.
                                            </p>
                                        </div>
                                        <span class="text-xs font-extrabold font-mono px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 shrink-0">
                                            +{Number(effectiveAccidentHmo.accidentAdditionalRate).toFixed(2)} € / 1.000 €
                                        </span>
                                    </div>
                                    <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-amber-950 pt-1 border-t border-amber-200/60">
                                        <input
                                            {...rf.fields.accidentAdditionalApplicable.as('checkbox', accidentAdditionalApplicable)}
                                            onchange={(e) => { accidentAdditionalApplicable = e.currentTarget.checked; }}
                                            class="rounded border-amber-300 text-amber-700 focus:ring-amber-500 w-4 h-4"
                                        />
                                        <span class="font-semibold">Ausgleichsumlage Wohlfahrtspflege für dieses Beschäftigungsverhältnis anwenden</span>
                                    </label>
                                </div>
                            {:else}
                                <input {...rf.fields.accidentAdditionalApplicable.as('hidden', accidentAdditionalApplicable)} />
                            {/if}
                        {:else}
                            <input {...rf.fields.accidentAdditionalApplicable.as('hidden', accidentAdditionalApplicable)} />
                        {/if}
                    </div>

                    <!-- 3. Tarifliche Zusatzversorgung (ZVK / VBL - optional) -->
                    <div class="rounded-xl border border-purple-200/80 bg-white p-4 space-y-3.5 shadow-2xs">
                        <div class="flex items-center justify-between">
                            <label for="pensionHmoId" class="block font-bold text-gray-900 text-xs flex items-center gap-2">
                                <PiggyBank size={15} class="text-purple-600" />
                                <span>Tarifliche Zusatzversorgung (ZVK / VBL / Pensionskasse - optional)</span>
                            </label>
                            {#if effectivePensionHmo}
                                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                                    AG: {Number(effectivePensionHmo.pensionEmployerPercent ?? 4).toFixed(2)}% · AN: {Number(effectivePensionHmo.pensionEmployeePercent ?? 1.81).toFixed(2)}%
                                </span>
                            {/if}
                        </div>

                        <select
                            id="pensionHmoId"
                            {...rf.fields.pensionHmoId.as('select', selectedPensionHmoId || profile.pensionHmoId || '')}
                            onchange={handlePensionHmoSelect}
                            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-hidden bg-white shadow-2xs"
                        >
                            <option value="">-- Keine tarifliche Zusatzversorgung (Standard) --</option>
                            {#each pensionProviders as pensionItem (pensionItem.id)}
                                <option value={pensionItem.id}>
                                    {pensionItem.name} {pensionItem.pensionEmployerPercent ? `(AG: ${pensionItem.pensionEmployerPercent}%)` : ''}
                                </option>
                            {/each}
                        </select>
                        {#each rf.fields.pensionHmoId?.issues?.() ?? [] as issue}
                            <p class="text-[11px] text-rose-600 mt-1">{issue.message}</p>
                        {/each}

                        {#if effectivePensionHmo}
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-purple-50/40 p-2.5 rounded-xl border border-purple-100">
                                <div>
                                    <span class="text-[10px] text-purple-800 block uppercase font-bold tracking-wider">AG-Umlage</span>
                                    <span class="text-sm font-extrabold font-mono text-purple-950">
                                        {Number(effectivePensionHmo.pensionEmployerPercent ?? 4.00).toFixed(2)} %
                                    </span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-purple-800 block uppercase font-bold tracking-wider">AN-Eigenanteil</span>
                                    <span class="text-sm font-extrabold font-mono text-purple-950">
                                        {Number(effectivePensionHmo.pensionEmployeePercent ?? 1.81).toFixed(2)} %
                                    </span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-purple-800 block uppercase font-bold tracking-wider">Konto / Mitglieds-Nr</span>
                                    <span class="text-xs font-mono font-bold text-purple-900 truncate block">
                                        {effectivePensionHmo.pensionMemberNumber || '—'}
                                    </span>
                                </div>
                            </div>
                        {/if}
                    </div>
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
                            {...rf.fields.pensionInsuranceExempt.as('checkbox', presetValues.pensionInsuranceExempt ?? profile.pensionInsuranceExempt ?? false)}
                            class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span class="text-xs text-gray-700">RV-Befreiung (z.B. Minijob auf Antrag)</span>
                    </label>

                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            {...rf.fields.unemploymentInsuranceExempt.as('checkbox', presetValues.unemploymentInsuranceExempt ?? profile.unemploymentInsuranceExempt ?? false)}
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
                        {...rf.fields.fundingProgram.as('select', presetValues.fundingProgram ?? profile.fundingProgram ?? 'none')}
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
                        {...rf.fields.fundingYear.as('number', presetValues.fundingYear ?? profile.fundingYear ?? 1)}
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
                        {...rf.fields.fundingSubsidyPercentage.as('number', presetValues.fundingSubsidyPercentage ?? profile.fundingSubsidyPercentage ?? 100)}
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
                        {...rf.fields.jobcenterName.as('text', presetValues.jobcenterName ?? profile.jobcenterName ?? '')}
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
                        {...rf.fields.jobcenterReference.as('text', presetValues.jobcenterReference ?? profile.jobcenterReference ?? '')}
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
                        {...rf.fields.coachingHoursPerMonth.as('number', presetValues.coachingHoursPerMonth ?? profile.coachingHoursPerMonth ?? 2)}
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
                        {...rf.fields.furtherTrainingBudget.as('number', presetValues.furtherTrainingBudget ?? profile.furtherTrainingBudget ?? 3000)}
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
                        {...rf.fields.furtherTrainingUsed.as('number', presetValues.furtherTrainingUsed ?? profile.furtherTrainingUsed ?? 0)}
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
            <AsyncButton
                type="submit"
                loading={rf.pending || isSubmitting}
                loadingLabel="Speichert..."
                class="gap-2"
            >
                <Save class="w-4 h-4" />
                Abrechnungsstammdaten speichern
            </AsyncButton>
        </div>
    </form>
{/if}
