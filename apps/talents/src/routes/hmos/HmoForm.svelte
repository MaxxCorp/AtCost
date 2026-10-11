<script lang="ts">
    import { AsyncButton } from "@ac/ui";
    import { Button } from "@ac/ui/components/button";
    import { toast } from "svelte-sonner";
    import { untrack } from "svelte";
    import { HeartPulse, ShieldAlert, PiggyBank, Building2, Globe, FileText, Sparkles, Check } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/hmos",
    }: any = $props();

    const rf = $derived((typeof remoteFunction === "function" ? remoteFunction() : remoteFunction) as any);

    let category = $state<string>("health");
    $effect(() => {
        if (initialData?.category) {
            category = initialData.category;
        }
    });

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = rf?.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error("Bitte korrigieren Sie die Formularfehler");
        }
        prevIssuesLength = issues.length;
    });

    function handleCategoryChange(e: Event) {
        const val = (e.currentTarget as HTMLSelectElement).value;
        category = val;
    }
</script>

<form
    class="space-y-6"
    {...rf.preflight(validationSchema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = untrack(() => rf.result);
            if (untrack(() => rf.error)) {
                toast.error(untrack(() => rf.error.message) || "Fehler beim Speichern");
                return;
            }

            toast.success(isUpdating ? "Versicherungsträger erfolgreich aktualisiert" : "Versicherungsträger erfolgreich erstellt");
            if (onSuccess) onSuccess(result);
        } catch (error: any) {
            toast.error(error?.message || "Fehler beim Speichern");
        }
    })}
>
    {#if isUpdating && initialData?.id && rf?.fields?.id}
        <input {...rf.fields.id.as("hidden", initialData.id)} />
    {/if}

    <!-- Provider Category Selector -->
    <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-2xs">
        <label for="provider-category" class="block text-xs font-bold text-gray-800 uppercase tracking-wider">
            Träger-Kategorie *
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
                type="button"
                onclick={() => { category = "health"; }}
                class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer {category === 'health' ? 'bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-xs' : 'bg-white/60 border-slate-200 hover:bg-white'}"
            >
                <div class="p-2 rounded-lg {category === 'health' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">
                    <HeartPulse size={18} />
                </div>
                <div>
                    <span class="block text-xs font-bold text-gray-900">Krankenkasse</span>
                    <span class="block text-[10px] text-gray-500">GKV / PKV (U1–U3)</span>
                </div>
            </button>

            <button
                type="button"
                onclick={() => { category = "accident"; }}
                class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer {category === 'accident' ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs' : 'bg-white/60 border-slate-200 hover:bg-white'}"
            >
                <div class="p-2 rounded-lg {category === 'accident' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}">
                    <ShieldAlert size={18} />
                </div>
                <div>
                    <span class="block text-xs font-bold text-gray-900">Berufsgenossenschaft</span>
                    <span class="block text-[10px] text-gray-500">Unfallversicherung (DGUV)</span>
                </div>
            </button>

            <button
                type="button"
                onclick={() => { category = "pension"; }}
                class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer {category === 'pension' ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs' : 'bg-white/60 border-slate-200 hover:bg-white'}"
            >
                <div class="p-2 rounded-lg {category === 'pension' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}">
                    <PiggyBank size={18} />
                </div>
                <div>
                    <span class="block text-xs font-bold text-gray-900">Zusatzversorgung</span>
                    <span class="block text-[10px] text-gray-500">ZVK / VBL / bAV</span>
                </div>
            </button>
        </div>

        <!-- Hidden select for form submission -->
        <select
            id="provider-category"
            {...rf.fields.category.as("select", category)}
            onchange={handleCategoryChange}
            class="hidden"
        >
            <option value="health">Krankenkasse (GKV/PKV)</option>
            <option value="accident">Berufsgenossenschaft (Unfallversicherung)</option>
            <option value="pension">Zusatzversorgungskasse (ZVK/VBL)</option>
            <option value="other">Sonstiger Träger</option>
        </select>
        {#each rf.fields.category?.issues?.() ?? [] as issue}
            <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
        {/each}
    </div>

    <!-- General Provider Info -->
    <div class="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-2xs">
        <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={15} class="text-indigo-600" />
            <span>Stammdaten & Kennzeichnungen</span>
        </h3>

        <div class="space-y-1">
            <label for="hmo-name" class="block text-xs font-semibold text-gray-700">
                Name des Trägers / der Organisation *
            </label>
            <input
                id="hmo-name"
                {...rf.fields.name.as("text", initialData?.name ?? "")}
                placeholder="z.B. Techniker Krankenkasse (TK), BGW, VBL.Klassik"
                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden transition-all bg-white"
            />
            {#each rf.fields.name.issues?.() ?? [] as issue}
                <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
            {/each}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="space-y-1">
                <label for="hmo-code" class="block text-xs font-semibold text-gray-700">
                    Kürzel / Code
                </label>
                <input
                    id="hmo-code"
                    {...rf.fields.code.as("text", initialData?.code ?? "")}
                    placeholder="z.B. TK, BGW, VBL"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden transition-all bg-white"
                />
                {#each rf.fields.code?.issues?.() ?? [] as issue}
                    <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
                {/each}
            </div>

            <div class="space-y-1">
                <label for="hmo-bbnr" class="block text-xs font-semibold text-gray-700">
                    Betriebsnummer (BBNR)
                </label>
                <input
                    id="hmo-bbnr"
                    {...rf.fields.betriebsnummer.as("text", initialData?.betriebsnummer ?? "")}
                    placeholder="8-stellig, z.B. 98765432"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden transition-all bg-white"
                />
                {#each rf.fields.betriebsnummer?.issues?.() ?? [] as issue}
                    <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
                {/each}
            </div>

            <div class="space-y-1">
                <label for="hmo-ik" class="block text-xs font-semibold text-gray-700">
                    Institutskennzeichen (IK)
                </label>
                <input
                    id="hmo-ik"
                    {...rf.fields.ikNumber.as("text", initialData?.ikNumber ?? "")}
                    placeholder="9-stellig, z.B. 101575519"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden transition-all bg-white"
                />
                {#each rf.fields.ikNumber?.issues?.() ?? [] as issue}
                    <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
                {/each}
            </div>
        </div>
    </div>

    <!-- Category 1: Health Insurance Specific Fields -->
    {#if category === "health"}
        <div class="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-5 space-y-4 shadow-2xs">
            <h3 class="text-xs font-bold text-rose-950 uppercase tracking-wider flex items-center gap-2">
                <HeartPulse size={15} class="text-rose-600" />
                <span>Krankenkasse: Zusatzbeitrag & Gesetzliche Umlagen (U1–U3)</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label for="hmo-type" class="block text-xs font-semibold text-gray-700">
                        Versicherungsart
                    </label>
                    <select
                        id="hmo-type"
                        {...rf.fields.type.as("select", initialData?.type ?? "statutory")}
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden transition-all bg-white"
                    >
                        <option value="statutory">Gesetzliche Krankenkasse (GKV)</option>
                        <option value="private">Private Krankenversicherung (PKV)</option>
                    </select>
                    {#each rf.fields.type?.issues?.() ?? [] as issue}
                        <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
                    {/each}
                </div>

                <div class="space-y-1">
                    <label for="hmo-rate" class="block text-xs font-semibold text-gray-700">
                        Kassenindiv. Zusatzbeitrag (%) *
                    </label>
                    <input
                        id="hmo-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        {...rf.fields.additionalContributionPercent.as("number", initialData?.additionalContributionPercent ?? 2.50)}
                        placeholder="z.B. 2.69"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden transition-all bg-white"
                    />
                    {#each rf.fields.additionalContributionPercent?.issues?.() ?? [] as issue}
                        <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
                    {/each}
                </div>
            </div>

            <!-- U1, U2, U3 Levy Rates -->
            <div class="rounded-xl border border-rose-100 bg-white p-4 space-y-3">
                <h4 class="text-xs font-bold text-gray-800">Umlagesätze der Einzugsstelle (Arbeitgeberkosten)</h4>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="space-y-1">
                        <label for="hmo-u1-def" class="block text-[11px] font-semibold text-gray-600">
                            U1 Standard Erstattung (%)
                        </label>
                        <select
                            id="hmo-u1-def"
                            {...rf.fields.u1DefaultCompensationPercent.as("select", initialData?.u1DefaultCompensationPercent ?? 70.0)}
                            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden bg-white"
                        >
                            <option value="50">50% Erstattungssatz</option>
                            <option value="65">65% Erstattungssatz</option>
                            <option value="70">70% Erstattungssatz (Standard)</option>
                            <option value="80">80% Erstattungssatz</option>
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label for="hmo-u2" class="block text-[11px] font-semibold text-gray-600">
                            U2 Umlage Mutterschutz (%)
                        </label>
                        <input
                            id="hmo-u2"
                            type="number"
                            step="0.01"
                            min="0"
                            {...rf.fields.u2Rate.as("number", initialData?.u2Rate ?? 0.44)}
                            placeholder="z.B. 0.44"
                            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden bg-white"
                        />
                    </div>

                    <div class="space-y-1">
                        <label for="hmo-u3" class="block text-[11px] font-semibold text-gray-600">
                            U3 Insolvenzgeldumlage (%)
                        </label>
                        <input
                            id="hmo-u3"
                            type="number"
                            step="0.01"
                            min="0"
                            {...rf.fields.u3Rate.as("number", initialData?.u3Rate ?? 0.15)}
                            placeholder="z.B. 0.15"
                            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 outline-hidden bg-white"
                        />
                    </div>
                </div>
                <p class="text-[10px] text-gray-500">
                    U1: Erstattung bei Entgeltfortzahlung (Wahltarif). U2: Mutterschutzumlage (100% erstattungsfähig). U3: Gesetzlich bundeseinheitlich 0,15%.
                </p>
            </div>
        </div>
    {/if}

    <!-- Category 2: Accident Insurance Specific Fields -->
    {#if category === "accident"}
        <div class="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-5 space-y-4 shadow-2xs">
            <h3 class="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={15} class="text-amber-600" />
                <span>Gesetzliche Unfallversicherung (Berufsgenossenschaft / DGUV)</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="space-y-1">
                    <label for="hmo-gefahrklasse" class="block text-xs font-semibold text-gray-700">
                        Gefahrklasse
                    </label>
                    <input
                        id="hmo-gefahrklasse"
                        type="number"
                        step="0.01"
                        min="0"
                        {...rf.fields.accidentGefahrklasse.as("number", initialData?.accidentGefahrklasse ?? 1.25)}
                        placeholder="z.B. 1.25"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all bg-white"
                    />
                </div>

                <div class="space-y-1">
                    <label for="hmo-beitragsfuss" class="block text-xs font-semibold text-gray-700">
                        Beitragsfuß (€ je 1.000 €)
                    </label>
                    <input
                        id="hmo-beitragsfuss"
                        type="number"
                        step="0.01"
                        min="0"
                        {...rf.fields.accidentBeitragsfuss.as("number", initialData?.accidentBeitragsfuss ?? 3.50)}
                        placeholder="z.B. 3.50"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all bg-white"
                    />
                </div>

                <div class="space-y-1">
                    <label for="hmo-tarifstelle" class="block text-xs font-semibold text-gray-700">
                        Gefahrtarifstelle
                    </label>
                    <input
                        id="hmo-tarifstelle"
                        {...rf.fields.accidentGefahrtarifstelle.as("text", initialData?.accidentGefahrtarifstelle ?? "01")}
                        placeholder="z.B. 01"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all bg-white"
                    />
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label for="hmo-bg-member" class="block text-xs font-semibold text-gray-700">
                        Mitgliedsnummer der Berufsgenossenschaft
                    </label>
                    <input
                        id="hmo-bg-member"
                        {...rf.fields.accidentMemberNumber.as("text", initialData?.accidentMemberNumber ?? "")}
                        placeholder="z.B. BGW-1049285"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all bg-white"
                    />
                </div>

                <div class="space-y-1">
                    <label for="hmo-bg-pin" class="block text-xs font-semibold text-gray-700">
                        DGUV PIN / Meldecode
                    </label>
                    <input
                        id="hmo-bg-pin"
                        {...rf.fields.accidentPin.as("text", initialData?.accidentPin ?? "")}
                        placeholder="z.B. 9481"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all bg-white"
                    />
                </div>
            </div>

            <!-- Additional Industry Component / Surcharge (e.g. BGW Ausgleichsumlage Wohlfahrtspflege) -->
            <div class="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3">
                <div class="flex items-center gap-2">
                    <Sparkles size={15} class="text-amber-700" />
                    <div>
                        <h4 class="text-xs font-bold text-amber-950">Branchenkomponente & Ausgleichsumlage (z.B. BGW Wohlfahrtspflege)</h4>
                        <p class="text-[11px] text-amber-800">
                            Für bestimmte Branchen wie Sozialunternehmen und Einrichtungen der Freien Wohlfahrtspflege (AWO, Diakonie, Caritas) erhebt z.B. die BGW eine separate Ausgleichsumlage von 0,08 € je 1.000 € Entgelt.
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div class="space-y-1">
                        <label for="hmo-accident-additional-rate" class="block font-semibold text-gray-800">
                            Zusatzumlage / Ausgleichsumlage (€ je 1.000 € Entgelt)
                        </label>
                        <input
                            id="hmo-accident-additional-rate"
                            type="number"
                            step="0.01"
                            min="0"
                            {...rf.fields.accidentAdditionalRate.as("number", initialData?.accidentAdditionalRate ?? 0)}
                            placeholder="z.B. 0.08"
                            class="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden bg-white"
                        />
                        <p class="text-[10px] text-gray-500">Standard für BGW Wohlfahrtspflege: 0,08 €</p>
                    </div>

                    <div class="space-y-1">
                        <label for="hmo-accident-additional-label" class="block font-semibold text-gray-800">
                            Bezeichnung der Ausgleichsumlage
                        </label>
                        <input
                            id="hmo-accident-additional-label"
                            {...rf.fields.accidentAdditionalLabel.as("text", initialData?.accidentAdditionalLabel ?? "Ausgleichsumlage Wohlfahrtspflege")}
                            placeholder="z.B. Ausgleichsumlage Wohlfahrtspflege"
                            class="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden bg-white"
                        />
                        <p class="text-[10px] text-gray-500">Erscheint transparent auf dem Entgeltnachweis</p>
                    </div>
                </div>
            </div>
            <p class="text-[10px] text-gray-500">
                Formel: (SV-Brutto × Gefahrklasse × Beitragsfuß) / 1.000. 100% vom Arbeitgeber getragener gesetzlicher Unfallschutz.
            </p>
        </div>
    {/if}

    <!-- Category 3: Pension Fund Specific Fields -->
    {#if category === "pension"}
        <div class="rounded-2xl border border-purple-200/80 bg-purple-50/30 p-5 space-y-4 shadow-2xs">
            <h3 class="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-2">
                <PiggyBank size={15} class="text-purple-600" />
                <span>Zusatzversorgung & Betriebliche Altersvorsorge (ZVK / VBL)</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label for="hmo-pension-ag" class="block text-xs font-semibold text-gray-700">
                        Arbeitgeber-Umlage (%)
                    </label>
                    <input
                        id="hmo-pension-ag"
                        type="number"
                        step="0.01"
                        min="0"
                        {...rf.fields.pensionEmployerPercent.as("number", initialData?.pensionEmployerPercent ?? 4.00)}
                        placeholder="z.B. 4.00 oder 6.45 (VBL)"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-hidden transition-all bg-white"
                    />
                </div>

                <div class="space-y-1">
                    <label for="hmo-pension-an" class="block text-xs font-semibold text-gray-700">
                        Arbeitnehmer-Eigenanteil (%)
                    </label>
                    <input
                        id="hmo-pension-an"
                        type="number"
                        step="0.01"
                        min="0"
                        {...rf.fields.pensionEmployeePercent.as("number", initialData?.pensionEmployeePercent ?? 1.81)}
                        placeholder="z.B. 1.81"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-hidden transition-all bg-white"
                    />
                </div>
            </div>

            <div class="space-y-1">
                <label for="hmo-pension-member" class="block text-xs font-semibold text-gray-700">
                    Abrechnungskonto / Trägermitgliedsnummer
                </label>
                <input
                    id="hmo-pension-member"
                    {...rf.fields.pensionMemberNumber.as("text", initialData?.pensionMemberNumber ?? "")}
                    placeholder="z.B. VBL-559021, ZVK-BE-9941"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-hidden transition-all bg-white"
                />
            </div>
            <p class="text-[10px] text-gray-500">
                Tarifliche Zusatzversorgung (z.B. TVöD / TV-L / AWO Tarifvertrag).
            </p>
        </div>
    {/if}

    <!-- Common Links & Notes -->
    <div class="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-2xs">
        <div class="space-y-1">
            <label for="hmo-website" class="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Globe size={13} class="text-gray-500" />
                <span>Webseite / Arbeitgeber-Portal</span>
            </label>
            <input
                id="hmo-website"
                {...rf.fields.website.as("text", initialData?.website ?? "")}
                placeholder="https://..."
                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden transition-all bg-white"
            />
            {#each rf.fields.website?.issues?.() ?? [] as issue}
                <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
            {/each}
        </div>

        <div class="space-y-1">
            <label for="hmo-notes" class="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText size={13} class="text-gray-500" />
                <span>Hinweise, Satzung & Abrechnungsdetails</span>
            </label>
            <textarea
                id="hmo-notes"
                {...rf.fields.notes.as("text", initialData?.notes ?? "")}
                placeholder="Besonderheiten, Tarifregelungen, Ansprechpartner..."
                rows="3"
                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden transition-all bg-white"
            ></textarea>
            {#each rf.fields.notes?.issues?.() ?? [] as issue}
                <p class="text-xs text-rose-600 font-medium">{issue.message}</p>
            {/each}
        </div>

        <div class="flex items-center gap-2.5 pt-2 border-t border-gray-100">
            <input
                id="hmo-active"
                type="checkbox"
                {...rf.fields.isActive.as("checkbox", initialData?.isActive ?? true)}
                class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
            />
            <label for="hmo-active" class="text-xs font-bold text-gray-800 select-none cursor-pointer">
                Aktiv (steht in Auswahllisten für Lohnabrechnung und Personalprofile zur Verfügung)
            </label>
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-end gap-3 pt-2">
        {#if onCancel}
            <Button type="button" variant="outline" onclick={onCancel}>
                Abbrechen
            </Button>
        {:else}
            <a href={cancelHref}>
                <Button type="button" variant="outline">
                    Abbrechen
                </Button>
            </a>
        {/if}

        <AsyncButton
            type="submit"
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md text-sm cursor-pointer"
        >
            {isUpdating ? "Änderungen speichern" : "Träger anlegen"}
        </AsyncButton>
    </div>
</form>
