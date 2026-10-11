<script lang="ts">
    import {
        HeartPulse,
        RefreshCw,
        ShieldAlert,
        PiggyBank,
        ExternalLink,
        CheckCircle2,
        Building2,
        Sparkles
    } from "@lucide/svelte";
    import { EntityManager, AsyncButton, Button } from "@ac/ui";
    import HmoForm from "./HmoForm.svelte";
    import {
        listHmos,
        readHmo,
        createHmo,
        updateHmo,
        deleteHmo,
        checkUpdatedTerms
    } from "./hmos.remote.js";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { createHmoSchema, updateHmoSchema, syncConditionsSchema } from "@ac/validations";
    import { toast } from "svelte-sonner";

    breadcrumbState.set({ feature: "hmos" });

    let isCheckingTerms = $state(false);
    let selectedCategory = $state<string>("all");

    async function handleCheckTerms() {
        isCheckingTerms = true;
        try {
            const result = await checkUpdatedTerms({ force: true }) as any;
            if (result?.changed) {
                toast.success(
                    `Konditionenprüfung abgeschlossen: ${result.conditionsCount ?? 1} neue Aktualisierung(en) erkannt! Prüfaufgabe im Objective Center erstellt.`
                );
            } else {
                toast.info("Konditionenprüfung abgeschlossen: Alle Träger-Konditionen, Zusatzbeiträge und gesetzlichen Tarife sind aktuell.");
            }
            void listHmos().refresh();
            void listHmos({}).refresh();
        } catch (err: any) {
            toast.error(err?.message || "Fehler bei der Prüfung der Konditionen");
        } finally {
            isCheckingTerms = false;
        }
    }
</script>

<div class="space-y-6">
    <!-- Top Hero Banner -->
    <div class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-xl">
        <div class="absolute -right-10 -bottom-10 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl pointer-events-none"></div>
        <div class="absolute right-40 -top-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-2">
                <div class="flex items-center gap-3">
                    <span class="h-8 w-2.5 rounded-full bg-rose-500"></span>
                    <h1 class="text-3xl font-black uppercase italic tracking-tight text-white flex items-center gap-3">
                        <HeartPulse class="h-8 w-8 text-rose-400" />
                        Versicherer & Versorgungsträger
                    </h1>
                </div>
                <p class="ml-5 max-w-2xl text-xs font-medium text-slate-300">
                    Zentrale Verwaltung aller Träger für Arbeitgeber- und Arbeitnehmeranteile: Krankenkassen (GKV/PKV mit U1–U3 Umlagen), 
                    Berufsgenossenschaften (Gesetzliche Unfallversicherung / DGUV) sowie betriebliche Zusatzversorgungskassen (ZVK / VBL).
                </p>
            </div>

            <!-- Quick Action: Monthly Terms & Conditions Check -->
            <div class="relative z-10 shrink-0">
                <AsyncButton
                    type="button"
                    onclick={handleCheckTerms}
                    loading={isCheckingTerms}
                    class="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-900/40 transition-all cursor-pointer"
                >
                    <RefreshCw size={15} class={isCheckingTerms ? "animate-spin" : ""} />
                    <span>Konditionen & Sätze prüfen</span>
                </AsyncButton>
            </div>
        </div>
    </div>

    <!-- Category Filter Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <button
            type="button"
            onclick={() => { selectedCategory = "all"; }}
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {selectedCategory === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
        >
            <Building2 size={14} />
            <span>Alle Träger</span>
        </button>
        <button
            type="button"
            onclick={() => { selectedCategory = "health"; }}
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {selectedCategory === 'health' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}"
        >
            <HeartPulse size={14} />
            <span>Krankenkassen (GKV/PKV)</span>
        </button>
        <button
            type="button"
            onclick={() => { selectedCategory = "accident"; }}
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {selectedCategory === 'accident' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'}"
        >
            <ShieldAlert size={14} />
            <span>Berufsgenossenschaften (BG)</span>
        </button>
        <button
            type="button"
            onclick={() => { selectedCategory = "pension"; }}
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {selectedCategory === 'pension' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 text-purple-900 hover:bg-purple-100'}"
        >
            <PiggyBank size={14} />
            <span>Zusatzversorgung (ZVK/VBL)</span>
        </button>
    </div>

    <!-- Unified Entity Manager -->
    {#key selectedCategory}
        <EntityManager
            title="Versicherer & Versorgungsträger"
            icon={HeartPulse}
            mode="standalone"
            listItemsRemote={(params: any) => listHmos({ ...params, category: selectedCategory })}
            deleteItemRemote={deleteHmo}
            createLabel="Neuen Träger anlegen"
            createRemote={createHmo}
            createSchema={createHmoSchema}
            updateRemote={updateHmo}
            updateSchema={updateHmoSchema}
            readItemRemote={(id: string) => readHmo({ id })}
            searchPredicate={(item: any, q: string) => {
                if (selectedCategory !== "all" && item.category !== selectedCategory) {
                    return false;
                }
                const query = q.toLowerCase();
                return (
                    (item.name?.toLowerCase() || "").includes(query) ||
                    (item.code?.toLowerCase() || "").includes(query) ||
                    (item.betriebsnummer || "").includes(query) ||
                    (item.ikNumber || "").includes(query) ||
                    (item.category?.toLowerCase() || "").includes(query)
                );
            }}
        >
            {#snippet toolbarActions()}
                <Button
                    variant="outline"
                    size="sm"
                    onclick={handleCheckTerms}
                    disabled={isCheckingTerms}
                    class="h-9 px-3.5 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center gap-2 text-xs font-bold cursor-pointer"
                    title="Monatliche Überprüfung aller Beitragssätze und gesetzlichen Konditionen starten"
                >
                    <Sparkles size={14} class="text-rose-500" />
                    <span>Konditionen-Prüflauf</span>
                </Button>
            {/snippet}

            {#snippet renderItemLabel(item: any)}
                <div class="flex flex-col gap-1.5 py-1 w-full">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="font-bold text-gray-900 text-sm">
                            {item.name}
                        </span>

                        {#if item.code}
                            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                {item.code}
                            </span>
                        {/if}

                        <!-- Category Badge -->
                        {#if item.category === 'accident'}
                            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <ShieldAlert size={10} />
                                <span>Berufsgenossenschaft</span>
                            </span>
                            {#if item.accidentGefahrklasse !== undefined && item.accidentGefahrklasse !== null}
                                <span class="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100/60 text-amber-900 border border-amber-200">
                                    GK {Number(item.accidentGefahrklasse).toFixed(2)} · Fuß {Number(item.accidentBeitragsfuss ?? 3.5).toFixed(2)} €
                                </span>
                            {/if}
                            {#if Number(item.accidentAdditionalRate ?? 0) > 0}
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                                    +{Number(item.accidentAdditionalRate).toFixed(2)} €/1.000 € ({item.accidentAdditionalLabel || 'Ausgleichsumlage'})
                                </span>
                            {/if}
                        {:else if item.category === 'pension'}
                            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                                <PiggyBank size={10} />
                                <span>Zusatzversorgung</span>
                            </span>
                            {#if item.pensionEmployerPercent !== undefined && item.pensionEmployerPercent !== null}
                                <span class="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100/60 text-purple-900 border border-purple-200">
                                    AG: {Number(item.pensionEmployerPercent).toFixed(2)}% · AN: {Number(item.pensionEmployeePercent ?? 1.81).toFixed(2)}%
                                </span>
                            {/if}
                        {:else}
                            <!-- Health Insurance (GKV / PKV) -->
                            <span class="text-[11px] font-black font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {Number(item.additionalContributionPercent ?? 0).toFixed(2)}% Zusatzbeitrag
                            </span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full {item.type === 'private' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                                {item.type === 'private' ? 'Private KV (PKV)' : 'Gesetzliche KV (GKV)'}
                            </span>
                            {#if item.u2Rate !== undefined && item.u2Rate !== null}
                                <span class="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200">
                                    U1 {item.u1DefaultCompensationPercent ?? 70}% / U2 {Number(item.u2Rate).toFixed(2)}% / U3 {Number(item.u3Rate ?? 0.15).toFixed(2)}%
                                </span>
                            {/if}
                        {/if}

                        <!-- Active state -->
                        {#if item.isActive !== false}
                            <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Aktiv
                            </span>
                        {:else}
                            <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                Inaktiv
                            </span>
                        {/if}
                    </div>

                    <div class="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                        {#if item.betriebsnummer}
                            <span class="font-mono text-[11px] text-gray-600">BBNR: {item.betriebsnummer}</span>
                        {/if}
                        {#if item.ikNumber}
                            <span class="font-mono text-[11px] text-gray-600">IK: {item.ikNumber}</span>
                        {/if}
                        {#if item.accidentMemberNumber}
                            <span class="font-mono text-[11px] text-amber-800">Mitgl.-Nr: {item.accidentMemberNumber}</span>
                        {/if}
                        {#if item.pensionMemberNumber}
                            <span class="font-mono text-[11px] text-purple-800">Konto: {item.pensionMemberNumber}</span>
                        {/if}
                        {#if item.notes}
                            <span class="truncate max-w-md">{item.notes}</span>
                        {/if}
                        {#if item.website}
                            <a
                                href={item.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px] font-medium ml-auto"
                            >
                                <span>Webseite</span>
                                <ExternalLink size={11} />
                            </a>
                        {/if}
                    </div>
                </div>
            {/snippet}

            {#snippet renderForm({ remoteFunction, schema, initialData, onSuccess, onCancel, id }: any)}
                <HmoForm
                    {remoteFunction}
                    validationSchema={schema}
                    isUpdating={!!id}
                    initialData={initialData}
                    {onSuccess}
                    {onCancel}
                />
            {/snippet}
        </EntityManager>
    {/key}
</div>
