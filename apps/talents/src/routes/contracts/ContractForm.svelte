<script lang="ts">
    import AsyncButton from "@ac/ui/components/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "@ac/ui/components/button";
    import { goto } from "$app/navigation";
    import { untrack, onMount } from "svelte";
    import { listContractFrameworks } from "../contract-frameworks/frameworks.remote";
    import * as m from "$lib/paraglide/messages";
    import { translateIssue } from "@ac/ui";

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

    let frameworks = $state<{id: string, name: string}[]>([]);
    
    onMount(async () => {
        try {
            const data = await listContractFrameworks({ page: 1, limit: 100 });
            frameworks = data.data as any;
        } catch (err) {
            console.error("Failed to load generic framework data.");
        }
    });

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = rf?.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });

    // Toggle multi-select utility helper
    function handleFrameworkSelection(id: string, currentSelections: string[], e: any) {
        if (e.target.checked) {
            return [...currentSelections, id];
        }
        return currentSelections.filter(c => c !== id);
    }
</script>

<form
    class="space-y-4"
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
        {#if isUpdating && initialData && rf.fields.id}
            <input {...rf.fields.id.as("hidden", initialData.id)} />
        {/if}
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{m.talent_id()}</span>
            {#if rf?.fields?.talentId}
                <input
                    {...rf.fields.talentId.as("text")}
                    class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.talentId.issues?.() ?? []).length > 0 ? 'border-red-500' : 'border-gray-300'}"
                    placeholder={m.talent_id_placeholder()}
                    value={initialData?.talentId ?? ""}
                />
                {#each rf.fields.talentId.issues?.() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
                {/each}
            {/if}
        </label>
        
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{m.frameworks()}</span>
            {#if frameworks.length === 0}
                <div class="mt-2 text-sm text-gray-500 italic">{m.no_frameworks_found()}</div>
            {/if}
            <div class="mt-2 flex flex-col gap-2 max-h-40 overflow-y-auto p-2 border rounded-md border-gray-300">
                {#each frameworks as fw}
                    <label class="flex items-center gap-2 cursor-pointer">
                        {#if rf?.fields?.frameworkIds}
                            <input
                                type="checkbox"
                                checked={initialData?.frameworkIds?.includes(fw.id) ?? false}
                                oninput={(e) => {
                                    const currentValue = rf.fields.frameworkIds.value();
                                    const newArray = handleFrameworkSelection(fw.id, Array.isArray(currentValue) ? currentValue : (initialData?.frameworkIds || []), e);
                                    // Workaround to push arrays to the custom standard fields properly
                                    // since .as('checkbox') is generally for simple booleans
                                    rf.fields.frameworkIds.value(newArray);
                                }}
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                        {/if}
                        <span class="text-sm text-gray-700">{fw.name}</span>
                    </label>
                {/each}
            </div>
            <!-- Hack to submit array natively -->
            {#if rf?.fields?.frameworkIds}
                {#each (rf.fields.frameworkIds.value() || initialData?.frameworkIds || []) as fwid}
                     <input type="hidden" name="frameworkIds" value={fwid} />
                {/each}
            {/if}
        </label>
    </div>

    {#if rf?.fields}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.start_date()}</span>
                {#if rf.fields.startDate}
                    <input
                        {...rf.fields.startDate.as("text")}
                        type="date"
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        value={initialData?.startDate?.split('T')[0] ?? ""}
                    />
                {/if}
            </label>
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.end_date_optional()}</span>
                {#if rf.fields.endDate}
                    <input
                        {...rf.fields.endDate.as("text")}
                        type="date"
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        value={initialData?.endDate?.split('T')[0] ?? ""}
                    />
                {/if}
            </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.probation_period_months()}</span>
                {#if rf.fields.probationPeriodMonths}
                    <input
                        {...rf.fields.probationPeriodMonths.as("number")}
                        type="number"
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        value={initialData?.probationPeriodMonths ?? ""}
                    />
                {/if}
            </label>
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.holiday_allotment_days()}</span>
                {#if rf.fields.holidayAllotmentDays}
                    <input
                        {...rf.fields.holidayAllotmentDays.as("number")}
                        type="number"
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        value={initialData?.holidayAllotmentDays ?? ""}
                    />
                {/if}
            </label>
        </div>

        <div class="p-4 border rounded-md space-y-4">
            <h3 class="font-medium text-gray-800">{m.work_hours()}</h3>
            {#if rf.fields.workHoursPerDay}
                <p class="text-xs text-red-600 font-semibold mt-1">
                    {#each rf.fields.workHoursPerDay.issues?.() ?? [] as issue}
                        {translateIssue(issue.message, m)}
                    {/each}
                </p>
            {/if}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label class="block text-sm">
                    {m.per_day()}
                    {#if rf.fields.workHoursPerDay}
                        <input
                            {...rf.fields.workHoursPerDay.as("number")}
                            type="number" step="any"
                            class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            value={initialData?.workHoursPerDay ?? ""}
                        />
                    {/if}
                </label>
                <label class="block text-sm">
                    {m.per_week()}
                    {#if rf.fields.workHoursPerWeek}
                        <input
                            {...rf.fields.workHoursPerWeek.as("number")}
                            type="number" step="any"
                            class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            value={initialData?.workHoursPerWeek ?? ""}
                        />
                    {/if}
                </label>
                <label class="block text-sm">
                    {m.per_month()}
                    {#if rf.fields.workHoursPerMonth}
                        <input
                            {...rf.fields.workHoursPerMonth.as("number")}
                            type="number" step="any"
                            class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            value={initialData?.workHoursPerMonth ?? ""}
                        />
                    {/if}
                </label>
                <label class="block text-sm">
                    {m.per_year()}
                    {#if rf.fields.workHoursPerYear}
                        <input
                            {...rf.fields.workHoursPerYear.as("number")}
                            type="number" step="any"
                            class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            value={initialData?.workHoursPerYear ?? ""}
                        />
                    {/if}
                </label>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.wage_type()}</span>
                {#if rf.fields.wageType}
                    <select
                        {...rf.fields.wageType.as("select")}
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="monthly" selected={(!initialData) || initialData?.wageType === 'monthly'}>{m.monthly()}</option>
                        <option value="hourly" selected={initialData?.wageType === 'hourly'}>{m.hourly()}</option>
                    </select>
                {/if}
            </label>
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.wage_amount()}</span>
                {#if rf.fields.wageAmount}
                    <input
                        {...rf.fields.wageAmount.as("number")}
                        type="number" step="any"
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        value={initialData?.wageAmount ?? ""}
                    />
                {/if}
            </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.entgeltgruppe()}</span>
                {#if rf.fields.entgeltgruppe}
                    <input
                        {...rf.fields.entgeltgruppe.as("text")}
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder={m.entgeltgruppe_placeholder()}
                        value={initialData?.entgeltgruppe ?? ""}
                    />
                {/if}
            </label>
            <label class="block">
                <span class="text-sm font-medium text-gray-700 mb-2">{m.erfahrungsstufe()}</span>
                {#if rf.fields.erfahrungsstufe}
                    <input
                        {...rf.fields.erfahrungsstufe.as("number")}
                        type="number"
                        class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder={m.erfahrungsstufe_placeholder()}
                        value={initialData?.erfahrungsstufe ?? ""}
                    />
                {/if}
            </label>
        </div>
    {/if}

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton type="submit" loadingLabel={isUpdating ? m.saving() : m.creating()} loading={(rf && rf.pending)}>
            {isUpdating ? m.save_changes() : m.create_contract()}
        </AsyncButton>
        {#if onCancel}
            <Button variant="secondary" type="button" size="default" onclick={onCancel}>
                {m.cancel()}
            </Button>
        {:else}
            <Button variant="secondary" href={cancelHref} size="default">
                {m.cancel()}
            </Button>
        {/if}
    </div>
</form>
