<script lang="ts">
    import AsyncButton from "@ac/ui/components/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "@ac/ui/components/button";
    import { goto } from "$app/navigation";
    import { untrack, onMount } from "svelte";
    import { listContractFrameworks } from "../contract-frameworks/frameworks.remote";

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
        const issues = rf.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error("Please fix the validation errors in the form.");
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
                toast.error(untrack(() => rf.error.message) || "Something went wrong.");
                return;
            }

            toast.success("Successfully Saved!");
            if (onSuccess) onSuccess(result);
            else await goto(cancelHref);
        } catch (error: any) {
            toast.error(error?.message || "Something went wrong.");
        }
    })}
>
    {#if isUpdating && initialData}
        <input {...rf.fields.id.as("hidden", initialData.id)} />
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Talent ID</span>
            <input
                {...rf.fields.talentId.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.talentId.issues()?.length ?? 0) > 0 ? 'border-red-500' : 'border-gray-300'}"
                placeholder="UUID of Talent"
                value={initialData?.talentId ?? ""}
            />
            {#each rf.fields.talentId.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>
        
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Frameworks</span>
            {#if frameworks.length === 0}
                <div class="mt-2 text-sm text-gray-500 italic">No frameworks found or loading...</div>
            {/if}
            <div class="mt-2 flex flex-col gap-2 max-h-40 overflow-y-auto p-2 border rounded-md border-gray-300">
                {#each frameworks as fw}
                    <label class="flex items-center gap-2 cursor-pointer">
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
                        <span class="text-sm text-gray-700">{fw.name}</span>
                    </label>
                {/each}
            </div>
            <!-- Hack to submit array natively -->
            {#each (rf.fields.frameworkIds.value() || initialData?.frameworkIds || []) as fwid}
                 <input type="hidden" name="frameworkIds" value={fwid} />
            {/each}
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Start Date</span>
            <input
                {...rf.fields.startDate.as("text")}
                type="date"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                value={initialData?.startDate?.split('T')[0] ?? ""}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">End Date (Optional)</span>
            <input
                {...rf.fields.endDate.as("text")}
                type="date"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                value={initialData?.endDate?.split('T')[0] ?? ""}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Probation Period (Months)</span>
            <input
                {...rf.fields.probationPeriodMonths.as("number")}
                type="number"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                value={initialData?.probationPeriodMonths ?? ""}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Holiday Allotment (Days)</span>
            <input
                {...rf.fields.holidayAllotmentDays.as("number")}
                type="number"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                value={initialData?.holidayAllotmentDays ?? ""}
            />
        </label>
    </div>

    <div class="p-4 border rounded-md space-y-4">
        <h3 class="font-medium text-gray-800">Work Hours</h3>
        <p class="text-xs text-red-600 font-semibold mt-1">
            {#each rf.fields.workHoursPerDay.issues() ?? [] as issue}
                {issue.message}
            {/each}
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label class="block text-sm">
                Per Day
                <input
                    {...rf.fields.workHoursPerDay.as("number")}
                    type="number" step="any"
                    class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                    value={initialData?.workHoursPerDay ?? ""}
                />
            </label>
            <label class="block text-sm">
                Per Week
                <input
                    {...rf.fields.workHoursPerWeek.as("number")}
                    type="number" step="any"
                    class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                    value={initialData?.workHoursPerWeek ?? ""}
                />
            </label>
            <label class="block text-sm">
                Per Month
                <input
                    {...rf.fields.workHoursPerMonth.as("number")}
                    type="number" step="any"
                    class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                    value={initialData?.workHoursPerMonth ?? ""}
                />
            </label>
            <label class="block text-sm">
                Per Year
                <input
                    {...rf.fields.workHoursPerYear.as("number")}
                    type="number" step="any"
                    class="mt-1 w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                    value={initialData?.workHoursPerYear ?? ""}
                />
            </label>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Wage Type</span>
            <select
                {...rf.fields.wageType.as("select")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
            >
                <option value="monthly" selected={(!initialData) || initialData?.wageType === 'monthly'}>Monthly</option>
                <option value="hourly" selected={initialData?.wageType === 'hourly'}>Hourly</option>
            </select>
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Wage Amount</span>
            <input
                {...rf.fields.wageAmount.as("number")}
                type="number" step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                value={initialData?.wageAmount ?? ""}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Entgeltgruppe</span>
            <input
                {...rf.fields.entgeltgruppe.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. E 9b"
                value={initialData?.entgeltgruppe ?? ""}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Erfahrungsstufe</span>
            <input
                {...rf.fields.erfahrungsstufe.as("number")}
                type="number"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1"
                value={initialData?.erfahrungsstufe ?? ""}
            />
        </label>
    </div>

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton type="submit" loadingLabel={isUpdating ? "Saving..." : "Creating..."} loading={rf.pending}>
            {isUpdating ? "Save Changes" : "Create Contract"}
        </AsyncButton>
        {#if onCancel}
            <Button variant="secondary" type="button" size="default" onclick={onCancel}>
                Cancel
            </Button>
        {:else}
            <Button variant="secondary" href={cancelHref} size="default">
                Cancel
            </Button>
        {/if}
    </div>
</form>
