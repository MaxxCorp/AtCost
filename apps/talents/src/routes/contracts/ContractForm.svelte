<script lang="ts">
    import AsyncButton from "@ac/ui/components/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "@ac/ui/components/button";
    import { goto } from "$app/navigation";
    import { untrack, onMount } from "svelte";
    import { listContractFrameworks } from "../contract-frameworks/frameworks.remote";
    import * as m from "#lib/paraglide/messages.js";
    import { translateIssue } from "@ac/ui";
    import {
        AWO_BERLIN_DEFAULTS,
        TV_L_DEFAULTS,
        SGB2_16I_DEFAULTS,
        SGB2_16D_DEFAULTS,
        TARIFEINIGUNG_RAISE_PRESET,
        AENDERUNGSTARIFVERTRAG_PRESET,
    } from "@ac/validations/contracts";
    import {
        ChevronDown,
        ChevronUp,
        Sparkles,
        Sliders,
        Layers,
        Clock,
        FileText,
        TrendingUp,
        Info,
        Shield,
        DollarSign,
        GraduationCap,
        HeartHandshake,
    } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/contracts",
    }: any = $props();

    const rf = $derived((typeof remoteFunction === "function" ? remoteFunction() : remoteFunction) as any);

    let frameworks = $state<{ id: string; name: string }[]>([]);
    let showAdvanced = $state(false);

    // Default values if creating a new contract (based on AWO Berlin MTV)
    const todayStr = new Date().toISOString().split("T")[0];
    const defaultData = $derived(
        initialData ?? {
            ...AWO_BERLIN_DEFAULTS,
            startDate: todayStr,
            precedence: 1,
            isActive: true,
        }
    );

    onMount(async () => {
        try {
            const data = await listContractFrameworks({ page: 1, limit: 100 });
            frameworks = (data.data as any) ?? [];
        } catch (err) {
            console.error("Failed to load generic framework data.");
        }
    });

    let prevIssuesLength = 0;
    $effect(() => {
        const issues = rf?.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });

    // Preset Applicator: populates form fields with standard Tarifvertrag values
    function applyPresetValues(preset: Record<string, any>) {
        if (!rf?.fields) return;
        for (const [key, val] of Object.entries(preset)) {
            if (rf.fields[key] && typeof rf.fields[key].value === "function") {
                rf.fields[key].value(val);
            }
        }
        toast.info("Preset loaded");
    }

    // Toggle multi-select utility helper
    function handleFrameworkSelection(id: string, currentSelections: string[], e: any) {
        if (e.target.checked) {
            return [...currentSelections, id];
        }
        return currentSelections.filter((c) => c !== id);
    }
</script>

<form
    class="space-y-6"
    {...rf.preflight(validationSchema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = untrack(() => rf.result);
            if (untrack(() => rf.error)) {
                toast.error(untrack(() => rf.error.message) || m.something_went_wrong());
                return;
            }

            toast.success(m.successfully_saved());
            if (onSuccess) onSuccess(result);
            else await goto(cancelHref);
        } catch (error: any) {
            toast.error(error?.message || m.something_went_wrong());
        }
    })}
>
    {#if rf?.fields}
        {#if isUpdating && initialData?.id && rf.fields.id}
            <input {...rf.fields.id.as("hidden", initialData.id)} />
        {/if}
    {/if}

    <!-- Quick Presets Header -->
    <div class="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 transition-all">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
                <Sparkles class="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                    <h4 class="text-sm font-semibold text-blue-900">
                        {m.apply_awo_preset()}
                    </h4>
                    <p class="text-xs text-blue-700">
                        Quickly populate standard specifications based on AWO Berlin (our organization default) or TV-L.
                    </p>
                </div>
            </div>
            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    onclick={() => applyPresetValues(AWO_BERLIN_DEFAULTS)}
                >
                    <span>🌟</span>
                    <span>{m.apply_awo_preset ? m.apply_awo_preset() : "AWO Berlin Standard"}</span>
                </button>
                <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-blue-300 text-blue-900 hover:bg-blue-100 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    onclick={() => applyPresetValues(TV_L_DEFAULTS)}
                >
                    <span>🏛️</span>
                    <span>{m.apply_tvl_preset ? m.apply_tvl_preset() : "TV-L Berlin"}</span>
                </button>
                <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    onclick={() => applyPresetValues(SGB2_16I_DEFAULTS)}
                >
                    <span>🤝</span>
                    <span>§ 16i SGB II (TaAM)</span>
                </button>
                <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    onclick={() => applyPresetValues(SGB2_16D_DEFAULTS)}
                >
                    <span>🛠️</span>
                    <span>§ 16d SGB II (AGH)</span>
                </button>
                <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    onclick={() => applyPresetValues(TARIFEINIGUNG_RAISE_PRESET)}
                >
                    <TrendingUp class="w-3.5 h-3.5 text-amber-600" />
                    <span>{m.apply_raise_preset ? m.apply_raise_preset() : "Tarifeinigung (+5.5% / +200€)"}</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Section 1: Core Contract Information -->
    <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
        <div class="flex items-center gap-2 border-b border-gray-100 pb-3">
            <FileText class="w-4 h-4 text-gray-500" />
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide">
                1. {m.contracts_order ? m.contracts_order() : "Contract Hierarchy & Identification"}
            </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Contract Title -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.contract_title ? m.contract_title() : "Contract Title"}</span>
                {#if rf?.fields?.title}
                    <input
                        {...rf.fields.title.as("text")}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        placeholder={m.contract_title_placeholder ? m.contract_title_placeholder() : "e.g. Arbeitsvertrag AWO Berlin"}
                        value={defaultData?.title ?? ""}
                    />
                {/if}
            </label>

            <!-- Talent ID -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.talent_id ? m.talent_id() : "Talent ID"}</span>
                {#if rf?.fields?.talentId}
                    <input
                        {...rf.fields.talentId.as("text")}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm {(rf.fields.talentId.issues?.() ?? []).length > 0 ? 'border-red-500' : 'border-gray-300'}"
                        placeholder={m.talent_id_placeholder ? m.talent_id_placeholder() : "UUID"}
                        value={defaultData?.talentId ?? ""}
                    />
                    {#each rf.fields.talentId.issues?.() ?? [] as issue (issue.message)}
                        <p class="mt-1 text-xs text-red-600">{translateIssue(issue.message, m)}</p>
                    {/each}
                {/if}
            </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Contract Type -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.contract_type ? m.contract_type() : "Contract Type"}</span>
                {#if rf?.fields?.contractType}
                    <select
                        {...rf.fields.contractType.as("select")}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm border-gray-300"
                    >
                        <option value="base_contract" selected={defaultData?.contractType === "base_contract"}>
                            {m.contract_type_base ? m.contract_type_base() : "Base / Collective Agreement"}
                        </option>
                        <option value="amendment" selected={defaultData?.contractType === "amendment"}>
                            {m.contract_type_amendment ? m.contract_type_amendment() : "Amendment Agreement (ÄTV)"}
                        </option>
                        <option value="settlement" selected={defaultData?.contractType === "settlement"}>
                            {m.contract_type_settlement ? m.contract_type_settlement() : "Settlement / Raise (Tarifeinigung)"}
                        </option>
                        <option value="addendum" selected={defaultData?.contractType === "addendum"}>
                            {m.contract_type_addendum ? m.contract_type_addendum() : "Addendum / House Agreement"}
                        </option>
                    </select>
                {/if}
            </label>

            <!-- Precedence Rank -->
            <label class="block">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.precedence ? m.precedence() : "Precedence Rank"}</span>
                    <span class="text-[10px] text-gray-500">Higher = Supercedes</span>
                </div>
                {#if rf?.fields?.precedence}
                    <input
                        {...rf.fields.precedence.as("number")}
                        type="number"
                        min="1"
                        max="99"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.precedence ?? 1}
                    />
                {/if}
            </label>

            <!-- Active Status Toggle -->
            <div class="flex flex-col justify-end pb-1.5">
                <label class="flex items-center gap-3 cursor-pointer p-2 border rounded-lg border-gray-200 hover:bg-gray-50 transition-colors">
                    {#if rf?.fields?.isActive}
                        <input
                            {...rf.fields.isActive.as("checkbox")}
                            class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            checked={defaultData?.isActive ?? true}
                        />
                    {/if}
                    <div>
                        <span class="text-sm font-medium text-gray-800">{m.is_active ? m.is_active() : "Contract is Active"}</span>
                        <p class="text-[11px] text-gray-500">Participates in effective terms calculation</p>
                    </div>
                </label>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Start Date -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.start_date ? m.start_date() : "Start Date"}</span>
                {#if rf?.fields?.startDate}
                    <input
                        {...rf.fields.startDate.as("text")}
                        type="date"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.startDate ? defaultData.startDate.split("T")[0] : todayStr}
                    />
                {/if}
            </label>

            <!-- End Date -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.end_date_optional ? m.end_date_optional() : "End Date (Optional)"}</span>
                {#if rf?.fields?.endDate}
                    <input
                        {...rf.fields.endDate.as("text")}
                        type="date"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.endDate ? defaultData.endDate.split("T")[0] : ""}
                    />
                {/if}
            </label>
        </div>
    </div>

    <!-- Section 2: Core Remuneration & Work Hours (Always visible) -->
    <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
        <div class="flex items-center gap-2 border-b border-gray-100 pb-3">
            <DollarSign class="w-4 h-4 text-gray-500" />
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide">
                2. {m.wage_amount()} & {m.work_hours()}
            </h3>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <!-- Wage Type -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.wage_type ? m.wage_type() : "Wage Type"}</span>
                {#if rf?.fields?.wageType}
                    <select
                        {...rf.fields.wageType.as("select")}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm border-gray-300"
                    >
                        <option value="monthly" selected={defaultData?.wageType !== "hourly"}>
                            {m.monthly ? m.monthly() : "Monthly Gross"}
                        </option>
                        <option value="hourly" selected={defaultData?.wageType === "hourly"}>
                            {m.hourly ? m.hourly() : "Hourly"}
                        </option>
                    </select>
                {/if}
            </label>

            <!-- Wage Amount -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.wage_amount ? m.wage_amount() : "Wage Amount (€)"}</span>
                {#if rf?.fields?.wageAmount}
                    <input
                        {...rf.fields.wageAmount.as("number")}
                        type="number"
                        step="0.01"
                        placeholder="e.g. 3850.00"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.wageAmount ?? ""}
                    />
                {/if}
            </label>

            <!-- Entgeltgruppe -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.entgeltgruppe ? m.entgeltgruppe() : "Entgeltgruppe"}</span>
                {#if rf?.fields?.entgeltgruppe}
                    <input
                        {...rf.fields.entgeltgruppe.as("text")}
                        placeholder={m.entgeltgruppe_placeholder ? m.entgeltgruppe_placeholder() : "e.g. E 9b"}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300 font-medium"
                        value={defaultData?.entgeltgruppe ?? "E 9b"}
                    />
                {/if}
            </label>

            <!-- Erfahrungsstufe -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">{m.erfahrungsstufe ? m.erfahrungsstufe() : "Erfahrungsstufe (1-6)"}</span>
                {#if rf?.fields?.erfahrungsstufe}
                    <input
                        {...rf.fields.erfahrungsstufe.as("number")}
                        type="number"
                        min="1"
                        max="6"
                        placeholder={m.erfahrungsstufe_placeholder ? m.erfahrungsstufe_placeholder() : "1"}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.erfahrungsstufe ?? 1}
                    />
                {/if}
            </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
            <!-- Weekly Work Hours (AWO Berlin default: 39.0 h) -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {m.work_hours ? m.work_hours() : "Work Hours"} ({m.per_week ? m.per_week() : "Per Week"})
                </span>
                {#if rf?.fields?.workHoursPerWeek}
                    <input
                        {...rf.fields.workHoursPerWeek.as("number")}
                        type="number"
                        step="0.1"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.workHoursPerWeek ?? 39.0}
                    />
                {/if}
            </label>

            <!-- Holiday Allotment Days (AWO Berlin default: 30 days) -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {m.holiday_allotment_days ? m.holiday_allotment_days() : "Holiday Days (Year)"}
                </span>
                {#if rf?.fields?.holidayAllotmentDays}
                    <input
                        {...rf.fields.holidayAllotmentDays.as("number")}
                        type="number"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        value={defaultData?.holidayAllotmentDays ?? 30}
                    />
                {/if}
            </label>

            <!-- Pay Scale Table Name -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {m.wage_table ? m.wage_table() : "Pay Scale Table"}
                </span>
                {#if rf?.fields?.wageTable}
                    <input
                        {...rf.fields.wageTable.as("text")}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm border-gray-300"
                        placeholder="e.g. AWO Berlin (E-Tabelle)"
                        value={defaultData?.wageTable ?? "AWO Berlin (E-Tabelle)"}
                    />
                {/if}
            </label>
        </div>
    </div>

    <!-- Section 3: SGB II Funding & Jobcenter Measures (§ 16i & § 16d) -->
    <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
            <div class="flex items-center gap-2">
                <HeartHandshake class="w-4 h-4 text-teal-600" />
                <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    3. SGB II Förderprogramm & Jobcenter-Konditionen
                </h3>
            </div>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                § 16i TaAM · § 16d AGH
            </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Funding Program Selection -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Förderprogramm (SGB II)
                </span>
                {#if rf?.fields?.fundingProgram}
                    <select
                        {...rf.fields.fundingProgram.as("select")}
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-sm border-gray-300 font-medium"
                    >
                        <option value="none" selected={defaultData?.fundingProgram === "none" || !defaultData?.fundingProgram}>
                            Keine Förderung (Regulärer Arbeitsvertrag)
                        </option>
                        <option value="sgb2_16i" selected={defaultData?.fundingProgram === "sgb2_16i"}>
                            🤝 § 16i SGB II (Teilhabe am Arbeitsmarkt / TaAM)
                        </option>
                        <option value="sgb2_16d" selected={defaultData?.fundingProgram === "sgb2_16d"}>
                            🛠️ § 16d SGB II (Arbeitsgelegenheit / AGH / MAE)
                        </option>
                    </select>
                {/if}
            </label>

            <!-- Jobcenter Reference / Aktenzeichen -->
            <label class="block">
                <span class="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Jobcenter Referenz / Maßnahmenummer
                </span>
                {#if rf?.fields?.jobcenterReference}
                    <input
                        {...rf.fields.jobcenterReference.as("text")}
                        placeholder="z.B. Jobcenter Berlin - Maßnahmenummer / BG-Nummer"
                        class="mt-1.5 w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm border-gray-300"
                        value={defaultData?.jobcenterReference ?? ""}
                    />
                {/if}
            </label>
        </div>

        <!-- § 16i Configuration Card -->
        <div class="rounded-xl border border-teal-200 bg-linear-to-br from-teal-50/60 via-emerald-50/30 to-white p-4 space-y-4">
            <div class="flex items-start gap-3">
                <GraduationCap class="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div class="space-y-1">
                    <div class="font-bold text-teal-950 text-xs sm:text-sm flex items-center gap-2">
                        <span>Spezifikationen gem. § 16i SGB II (Teilhabe am Arbeitsmarkt)</span>
                        <span class="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold">ALV-Frei (BGR 1101)</span>
                    </div>
                    <p class="text-[11px] text-teal-800 leading-relaxed">
                        Förderung mit Lohnkostenzuschuss (100% in J. 1–2, 90% in J. 3, 80% in J. 4, 70% in J. 5). Gesetzlicher Anspruch auf Weiterbildungsbudget von bis zu 3.000 € (§ 16i Abs. 5 SGB II) sowie verpflichtende bezahlte Freistellung für ganzheitliches Coaching im 1. Beschäftigungsjahr.
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-teal-100">
                <label class="block">
                    <span class="text-[11px] font-semibold text-gray-700">Lohnkostenzuschuss (%)</span>
                    {#if rf?.fields?.fundingSubsidyPercentage}
                        <input
                            {...rf.fields.fundingSubsidyPercentage.as("number")}
                            type="number"
                            min="0"
                            max="100"
                            class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-teal-200 bg-white"
                            value={defaultData?.fundingSubsidyPercentage ?? 100}
                        />
                    {/if}
                    <span class="text-[10px] text-gray-500 block mt-0.5">J. 1-2: 100%, J. 3: 90%...</span>
                </label>

                <label class="block">
                    <span class="text-[11px] font-semibold text-gray-700">Weiterbildungsbudget (€)</span>
                    {#if rf?.fields?.furtherTrainingBudget}
                        <input
                            {...rf.fields.furtherTrainingBudget.as("number")}
                            type="number"
                            step="50"
                            class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-teal-200 bg-white"
                            value={defaultData?.furtherTrainingBudget ?? 3000.0}
                        />
                    {/if}
                    <span class="text-[10px] text-gray-500 block mt-0.5">Gesamtbudget (§ 16i Abs. 5)</span>
                </label>

                <label class="block">
                    <span class="text-[11px] font-semibold text-gray-700">Budget verbraucht (€)</span>
                    {#if rf?.fields?.furtherTrainingUsed}
                        <input
                            {...rf.fields.furtherTrainingUsed.as("number")}
                            type="number"
                            step="10"
                            class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-teal-200 bg-white"
                            value={defaultData?.furtherTrainingUsed ?? 0.0}
                        />
                    {/if}
                    <span class="text-[10px] text-gray-500 block mt-0.5">Bisherige Qualifizierung</span>
                </label>

                <label class="block">
                    <span class="text-[11px] font-semibold text-gray-700">Coaching-Freistellung (Std./Mo)</span>
                    {#if rf?.fields?.coachingHoursPerMonth}
                        <input
                            {...rf.fields.coachingHoursPerMonth.as("number")}
                            type="number"
                            step="0.5"
                            class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-teal-200 bg-white"
                            value={defaultData?.coachingHoursPerMonth ?? 2.0}
                        />
                    {/if}
                    <span class="text-[10px] text-gray-500 block mt-0.5">Bezahlte Freistellungspflicht</span>
                </label>
            </div>
        </div>

        <!-- § 16d Specification Notice -->
        <div class="rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50/60 via-teal-50/30 to-white p-3.5 space-y-2">
            <div class="flex items-start gap-2.5">
                <Shield class="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div class="space-y-0.5">
                    <div class="font-bold text-emerald-950 text-xs flex items-center gap-2">
                        <span>Hinweis zu § 16d SGB II (Arbeitsgelegenheiten / AGH):</span>
                        <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">Steuer- & SV-frei (§ 3 Nr. 2 EStG)</span>
                    </div>
                    <p class="text-[11px] text-emerald-800 leading-relaxed">
                        Kein Arbeitsverhältnis i.S.d. Arbeitsrechts (§ 16d Abs. 7 SGB II). Die Mehraufwandsentschädigung (MAE, Preset: 2,00 €/Std.) ist steuerfrei und unterliegt keinen SV-Beiträgen (DEÜV BGR 0000, PGR 190). Die Abrechnung erfolgt automatisch anhand der erfassten Teilnehmerstunden.
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Section 4: Progressive Disclosure: Advanced Specifications & Tarif Details -->
    <div class="border border-gray-200 rounded-xl bg-white shadow-xs overflow-hidden">
        <button
            type="button"
            class="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors cursor-pointer select-none"
            onclick={() => (showAdvanced = !showAdvanced)}
        >
            <div class="flex items-center gap-3">
                <Sliders class="w-4 h-4 text-blue-600" />
                <div>
                    <h3 class="text-sm font-bold text-gray-900">
                        {m.advanced_specifications ? m.advanced_specifications() : "Advanced Specifications & Tarif Details"}
                    </h3>
                    <p class="text-xs text-gray-500">
                        {showAdvanced
                            ? (m.hide_advanced_specifications ? m.hide_advanced_specifications() : "Click to collapse detailed clauses")
                            : (m.show_advanced_specifications ? m.show_advanced_specifications() : "Click to show detailed clauses (Surcharges, Jahressonderzahlung, Differential raises, etc.)")}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {showAdvanced ? "Expanded" : "6 Categories"}
                </span>
                {#if showAdvanced}
                    <ChevronUp class="w-5 h-5 text-gray-400" />
                {:else}
                    <ChevronDown class="w-5 h-5 text-gray-400" />
                {/if}
            </div>
        </button>

        {#if showAdvanced}
            <div class="p-5 border-t border-gray-200 bg-gray-50/50 space-y-6 animate-in fade-in duration-150">
                <!-- Advanced 1: Schedule & Work Time Details -->
                <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Clock class="w-4 h-4 text-blue-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Detailed Working Time & Schedule
                        </h4>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.per_day ? m.per_day() : "Daily Hours"}</span>
                            {#if rf?.fields?.workHoursPerDay}
                                <input
                                    {...rf.fields.workHoursPerDay.as("number")}
                                    type="number"
                                    step="0.05"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.workHoursPerDay ?? 7.8}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.per_month ? m.per_month() : "Monthly Hours"}</span>
                            {#if rf?.fields?.workHoursPerMonth}
                                <input
                                    {...rf.fields.workHoursPerMonth.as("number")}
                                    type="number"
                                    step="0.1"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.workHoursPerMonth ?? 169.65}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.work_days_per_week ? m.work_days_per_week() : "Days Per Week"}</span>
                            {#if rf?.fields?.workDaysPerWeek}
                                <input
                                    {...rf.fields.workDaysPerWeek.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.workDaysPerWeek ?? 5}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.flextime_model ? m.flextime_model() : "Flextime Model"}</span>
                            {#if rf?.fields?.flextimeModel}
                                <select
                                    {...rf.fields.flextimeModel.as("select")}
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300 bg-white"
                                >
                                    <option value="standard">{m.flextime_standard ? m.flextime_standard() : "Standard Hours"}</option>
                                    <option value="gleitzeit">{m.flextime_gleitzeit ? m.flextime_gleitzeit() : "Gleitzeit"}</option>
                                    <option value="vertrauen">{m.flextime_vertrauen ? m.flextime_vertrauen() : "Vertrauensarbeitszeit"}</option>
                                    <option value="schicht">{m.flextime_schicht ? m.flextime_schicht() : "Schichtdienst"}</option>
                                </select>
                            {/if}
                        </label>
                    </div>
                    <div class="pt-2">
                        <label class="flex items-center gap-2 cursor-pointer">
                            {#if rf?.fields?.eveDaysFree}
                                <input
                                    {...rf.fields.eveDaysFree.as("checkbox")}
                                    class="w-4 h-4 text-blue-600 rounded border-gray-300"
                                    checked={defaultData?.eveDaysFree ?? true}
                                />
                            {/if}
                            <span class="text-xs font-medium text-gray-700">
                                {m.eve_days_free ? m.eve_days_free() : "Dec 24 & Dec 31 Work-free (Tarifvertrag Standard)"}
                            </span>
                        </label>
                    </div>
                </div>

                <!-- Advanced 2: Tarif Step Advancement & Probation -->
                <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Layers class="w-4 h-4 text-blue-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Tarif Step Advancement (Stufenlaufzeit) & Probation
                        </h4>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.stufenlaufzeit_months ? m.stufenlaufzeit_months() : "Step Duration (Months)"}</span>
                            {#if rf?.fields?.stufenlaufzeitMonths}
                                <input
                                    {...rf.fields.stufenlaufzeitMonths.as("number")}
                                    type="number"
                                    placeholder="e.g. 12"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.stufenlaufzeitMonths ?? 12}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.next_stufenaufstieg_date ? m.next_stufenaufstieg_date() : "Next Step Upgrade Date"}</span>
                            {#if rf?.fields?.nextStufenaufstiegDate}
                                <input
                                    {...rf.fields.nextStufenaufstiegDate.as("text")}
                                    type="date"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.nextStufenaufstiegDate ? defaultData.nextStufenaufstiegDate.split("T")[0] : ""}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.probation_period_months ? m.probation_period_months() : "Probation (Months)"}</span>
                            {#if rf?.fields?.probationPeriodMonths}
                                <input
                                    {...rf.fields.probationPeriodMonths.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.probationPeriodMonths ?? 6}
                                />
                            {/if}
                        </label>
                    </div>
                </div>

                <!-- Advanced 3: Zeitzuschläge & Zulagen (§ 8 TV-L / AWO) -->
                <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <DollarSign class="w-4 h-4 text-emerald-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Zeitzuschläge & Zulagen (§ 8 TV-L / AWO Berlin)
                        </h4>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.overtime_surcharge_percent ? m.overtime_surcharge_percent() : "Overtime %"}</span>
                            {#if rf?.fields?.overtimeSurchargePercent}
                                <input
                                    {...rf.fields.overtimeSurchargePercent.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.overtimeSurchargePercent ?? 30}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.night_surcharge_percent ? m.night_surcharge_percent() : "Night (21-6h) %"}</span>
                            {#if rf?.fields?.nightSurchargePercent}
                                <input
                                    {...rf.fields.nightSurchargePercent.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.nightSurchargePercent ?? 20}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.sunday_surcharge_percent ? m.sunday_surcharge_percent() : "Sunday %"}</span>
                            {#if rf?.fields?.sundaySurchargePercent}
                                <input
                                    {...rf.fields.sundaySurchargePercent.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.sundaySurchargePercent ?? 25}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.holiday_surcharge_percent ? m.holiday_surcharge_percent() : "Holiday %"}</span>
                            {#if rf?.fields?.holidaySurchargePercent}
                                <input
                                    {...rf.fields.holidaySurchargePercent.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.holidaySurchargePercent ?? 35}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.saturday_surcharge_percent ? m.saturday_surcharge_percent() : "Saturday %"}</span>
                            {#if rf?.fields?.saturdaySurchargePercent}
                                <input
                                    {...rf.fields.saturdaySurchargePercent.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.saturdaySurchargePercent ?? 20}
                                />
                            {/if}
                        </label>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.capital_allowance ? m.capital_allowance() : "Hauptstadtzulage Berlin (€/Month)"}</span>
                            {#if rf?.fields?.capitalAllowance}
                                <input
                                    {...rf.fields.capitalAllowance.as("number")}
                                    type="number"
                                    step="0.01"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.capitalAllowance ?? 150.0}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.capital_forming_benefits ? m.capital_forming_benefits() : "Vermögenswirksame Leistungen (VWL €/Month)"}</span>
                            {#if rf?.fields?.capitalFormingBenefits}
                                <input
                                    {...rf.fields.capitalFormingBenefits.as("number")}
                                    type="number"
                                    step="0.01"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.capitalFormingBenefits ?? 6.65}
                                />
                            {/if}
                        </label>
                    </div>
                </div>

                <!-- Advanced 4: Jahressonderzahlung & Boni (§ 20) -->
                <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Sparkles class="w-4 h-4 text-purple-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Jahressonderzahlung & Boni (§ 20 TV-L / AWO)
                        </h4>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.yearly_bonus_percentage ? m.yearly_bonus_percentage() : "Bonus % (of monthly salary)"}</span>
                            {#if rf?.fields?.yearlyBonusPercentage}
                                <input
                                    {...rf.fields.yearlyBonusPercentage.as("number")}
                                    type="number"
                                    step="0.1"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.yearlyBonusPercentage ?? 80.0}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.yearly_bonus_month ? m.yearly_bonus_month() : "Payout Month (1-12)"}</span>
                            {#if rf?.fields?.yearlyBonusMonth}
                                <input
                                    {...rf.fields.yearlyBonusMonth.as("number")}
                                    type="number"
                                    min="1"
                                    max="12"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.yearlyBonusMonth ?? 11}
                                />
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.special_leave_days ? m.special_leave_days() : "Special / Educational Leave (Days)"}</span>
                            {#if rf?.fields?.specialLeaveDays}
                                <input
                                    {...rf.fields.specialLeaveDays.as("number")}
                                    type="number"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.specialLeaveDays ?? 0}
                                />
                            {/if}
                        </label>
                    </div>
                    <div class="pt-1">
                        <label class="flex items-center gap-2 cursor-pointer">
                            {#if rf?.fields?.yearlyBonusLeaveConversion}
                                <input
                                    {...rf.fields.yearlyBonusLeaveConversion.as("checkbox")}
                                    class="w-4 h-4 text-purple-600 rounded border-gray-300"
                                    checked={defaultData?.yearlyBonusLeaveConversion ?? false}
                                />
                            {/if}
                            <span class="text-xs font-medium text-gray-700">
                                {m.yearly_bonus_leave_conversion ? m.yearly_bonus_leave_conversion() : "Allow converting bonus into free days (Entgeltumwandlung)"}
                            </span>
                        </label>
                    </div>
                </div>

                <!-- Advanced 5: Notice Periods (Kündigungsfristen) -->
                <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Shield class="w-4 h-4 text-gray-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Kündigungsfristen (§ 34 TV-L / AWO Berlin)
                        </h4>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.notice_period_rule ? m.notice_period_rule() : "Notice Period Rule"}</span>
                            {#if rf?.fields?.noticePeriodRule}
                                <select
                                    {...rf.fields.noticePeriodRule.as("select")}
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300 bg-white"
                                >
                                    <option value="tv_standard">{m.notice_period_tv_standard ? m.notice_period_tv_standard() : "Tarifvertrag Standard (graduated by tenure)"}</option>
                                    <option value="statutory">{m.notice_period_statutory ? m.notice_period_statutory() : "Statutory (§ 622 BGB)"}</option>
                                    <option value="custom">{m.notice_period_custom ? m.notice_period_custom() : "Custom Clause"}</option>
                                </select>
                            {/if}
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.custom_notice_period ? m.custom_notice_period() : "Custom Notice Period Specification"}</span>
                            {#if rf?.fields?.customNoticePeriod}
                                <input
                                    {...rf.fields.customNoticePeriod.as("text")}
                                    placeholder={m.custom_notice_period_placeholder ? m.custom_notice_period_placeholder() : "e.g. 3 months to month end"}
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.customNoticePeriod ?? ""}
                                />
                            {/if}
                        </label>
                    </div>
                </div>

                <!-- Advanced 6: Differential Agreements & Raises (Änderungstarifvertrag / Tarifeinigung) -->
                <div class="bg-white p-4 rounded-xl border border-amber-200/80 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-amber-100">
                        <TrendingUp class="w-4 h-4 text-amber-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            {m.differential_adjustments ? m.differential_adjustments() : "Differential Adjustments & Conditional Raises"}
                        </h4>
                    </div>
                    <p class="text-xs text-gray-500">
                        Specify supplemental incremental raises or lump-sum payments when creating an Änderungstarifvertrag or Tarifeinigung. These compound or supersede the underlying base contract according to precedence order.
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.base_raise_percent ? m.base_raise_percent() : "Linear Raise (%)"}</span>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="e.g. 5.5"
                                class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                value={defaultData?.differentialAdjustments?.baseRaisePercent ?? ""}
                                oninput={(e: any) => {
                                    const current = rf?.fields?.differentialAdjustments?.value() || {};
                                    rf.fields.differentialAdjustments.value({
                                        ...current,
                                        baseRaisePercent: e.target.value ? parseFloat(e.target.value) : undefined,
                                    });
                                }}
                            />
                        </label>
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.base_raise_amount ? m.base_raise_amount() : "Base Amount Bump (€ / Sockelbetrag)"}</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 200.00"
                                class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                value={defaultData?.differentialAdjustments?.baseRaiseAmount ?? ""}
                                oninput={(e: any) => {
                                    const current = rf?.fields?.differentialAdjustments?.value() || {};
                                    rf.fields.differentialAdjustments.value({
                                        ...current,
                                        baseRaiseAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                                    });
                                }}
                            />
                        </label>
                    </div>
                    <label class="block">
                        <span class="text-xs text-gray-600">{m.differential_notes ? m.differential_notes() : "Settlement & Amendment Notes"}</span>
                        {#if rf?.fields?.notes}
                            <textarea
                                {...rf.fields.notes.as("text")}
                                rows="2"
                                placeholder="Notes about this collective agreement revision or differential change..."
                                class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                value={defaultData?.notes ?? ""}
                            ></textarea>
                        {/if}
                    </label>
                </div>

                <!-- Advanced 7: Parent Contract & Framework Junctions -->
                <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <div class="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Layers class="w-4 h-4 text-blue-600" />
                        <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Parent Contract Reference & Associated Frameworks
                        </h4>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label class="block">
                            <span class="text-xs text-gray-600">{m.parent_contract ? m.parent_contract() : "Parent / Referenced Contract UUID"}</span>
                            {#if rf?.fields?.parentContractId}
                                <input
                                    {...rf.fields.parentContractId.as("text")}
                                    placeholder="UUID of base contract (if this is an amendment)"
                                    class="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm border-gray-300"
                                    value={defaultData?.parentContractId ?? ""}
                                />
                            {/if}
                        </label>
                        <div class="block">
                            <span class="text-xs text-gray-600">{m.frameworks ? m.frameworks() : "Contract Frameworks"}</span>
                            <div class="mt-1 flex flex-col gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-lg border-gray-300 bg-gray-50">
                                {#if frameworks.length === 0}
                                    <span class="text-xs text-gray-400 italic">No frameworks registered yet.</span>
                                {/if}
                                {#each frameworks as fw (fw.id)}
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        {#if rf?.fields?.frameworkIds}
                                            <input
                                                type="checkbox"
                                                checked={defaultData?.frameworkIds?.includes(fw.id) ?? false}
                                                oninput={(e) => {
                                                    const currentValue = rf.fields.frameworkIds.value();
                                                    const newArray = handleFrameworkSelection(
                                                        fw.id,
                                                        Array.isArray(currentValue) ? currentValue : defaultData?.frameworkIds || [],
                                                        e
                                                    );
                                                    rf.fields.frameworkIds.value(newArray);
                                                }}
                                                class="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                        {/if}
                                        <span class="text-xs text-gray-700">{fw.name}</span>
                                    </label>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Form Actions -->
    <div class="flex justify-end gap-3 pt-3">
        {#if onCancel}
            <Button variant="secondary" type="button" size="default" onclick={onCancel}>
                {m.cancel ? m.cancel() : "Cancel"}
            </Button>
        {:else}
            <Button variant="secondary" href={cancelHref} size="default">
                {m.cancel ? m.cancel() : "Cancel"}
            </Button>
        {/if}
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? (m.saving ? m.saving() : "Saving...") : (m.saving ? m.saving() : "Creating...")}
            loading={rf && rf.pending}
        >
            {isUpdating ? (m.save_changes ? m.save_changes() : "Save Contract") : (m.create_contract ? m.create_contract() : "Create Contract")}
        </AsyncButton>
    </div>
</form>
