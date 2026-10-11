<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { FileText } from "@lucide/svelte";
    import { EntityManager } from "@ac/ui";
    import ContractForm from "./ContractForm.svelte";
    import { listContracts } from "./list.remote";
    import { deleteContract } from "./delete.remote";
    import { createContract } from "./new/create.remote";
    import { readContract } from "./[id]/read.remote";
    import { updateContract } from "./[id]/update.remote";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { contractSchema, updateContractSchema } from "@ac/validations/contracts";
    import { getContractFilterGroups } from "#lib/filters/index.js";

    breadcrumbState.set({ feature: "contracts" });
</script>

<div class="space-y-6">
    <h1 class="text-2xl font-black text-gray-900 px-1">{m.contracts ? m.contracts() : "Contracts"}</h1>
    <EntityManager
        title={m.contracts ? m.contracts() : "Contracts"}
        icon={FileText}
        mode="standalone"
        listItemsRemote={listContracts as any}
        filters={getContractFilterGroups(m)}
        deleteItemRemote={deleteContract}
        createHref="/contracts/new"
        createLabel={m.create_contract ? m.create_contract() : "Create Contract"}
        createRemote={createContract}
        createSchema={contractSchema}
        updateRemote={updateContract}
        updateSchema={updateContractSchema}
        readItemRemote={(id: string) => readContract({ id })}
        searchPredicate={(c: any, q: any) => {
            return (c.entgeltgruppe?.toLowerCase() || '').includes(q.toLowerCase());
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
                {initialData}
                {onSuccess}
                {onCancel}
            />
        {/snippet}
    </EntityManager>
</div>
