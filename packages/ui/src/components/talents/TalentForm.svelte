<script lang="ts">
    import { untrack } from "svelte";
    import { Briefcase, DollarSign, Calendar, FileText, User } from "@lucide/svelte";

    import { toast } from "svelte-sonner";
    import AsyncButton from "../../components/AsyncButton.svelte";
    import Button from "../../components/button/button.svelte";

    interface Props {
        initialData?: any;
        remoteFunction: any;
        schema: any;
        onSuccess: (result: any) => void;
        onCancel: () => void;
        id?: string;
        systemUsers?: any[];
    }

    let {
        initialData = {},
        remoteFunction,
        schema,
        onSuccess,
        onCancel,
        id,
        systemUsers = [],
    }: Props = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(typeof remoteFunction === "function" ? (remoteFunction as any)() : remoteFunction);

    const d = (val: any, def: any) =>
        val === undefined || val === null ? def : val;

    // svelte-ignore state_referenced_locally
    let talentData = $state({
        id: id || d(initialData.id, undefined),
        contactId: d(initialData.contactId, ""),
        status: d(initialData.status, "applicant"),
        jobTitle: d(initialData.jobTitle, ""),
        salaryExpectation: d(initialData.salaryExpectation, ""),
        availabilityDate: d(
            initialData.availabilityDate
                ? String(initialData.availabilityDate).split("T")[0]
                : "",
            "",
        ),
        onboardingStatus: d(initialData.onboardingStatus, ""),
        resumeUrl: d(initialData.resumeUrl, ""),
        source: d(initialData.source, ""),
        internalNotes: d(initialData.internalNotes, ""),
    });


</script>

<form
    class="space-y-6"
    {...(rf as any).preflight(schema).enhance(async ({ submit }: { submit: any }) => {
        const handle = rf;
        try {
            await submit();
            const result = untrack(() => (handle as any).result);
            if (result?.success === false || result?.error) {
                toast.error(result?.error?.message || result?.error || "Failed to save talent");
                return;
            }


            toast.success("Talent successfully saved!");
            onSuccess(result);
        } catch (error: any) {
            toast.error(error.message || "An unexpected error occurred");
        }
    })}
>
    {#if id || talentData.id}
        <input {...rf.fields.id.as("hidden", id || talentData.id)} />
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block col-span-2">
            <span class="block text-sm font-medium text-gray-700 mb-1">Target Job Title</span>
            <div class="relative">
                <Briefcase size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...rf.fields.data.fields.jobTitle.as("text")}
                    bind:value={talentData.jobTitle}
                    placeholder="e.g. Senior Frontend Engineer"
                    class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
            </div>
            {#each rf.fields.data.fields.jobTitle.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Status</span>
            <select
                {...rf.fields.data.fields.status.as("select")}
                bind:value={talentData.status}
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
                <option value="applicant">Applicant</option>
                <option value="lead">Lead</option>
                <option value="interview">Interviewing</option>
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
            </select>
            {#each rf.fields.data.fields.status.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Salary Expectation</span>
            <div class="relative">
                <DollarSign size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...rf.fields.data.fields.salaryExpectation.as("text")}
                    bind:value={talentData.salaryExpectation}
                    placeholder="e.g. 85k / year"
                    class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>
            {#each rf.fields.data.fields.salaryExpectation.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Availability Date</span>
            <div class="relative">
                <Calendar size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...rf.fields.data.fields.availabilityDate.as("date")}
                    type="date"
                    bind:value={talentData.availabilityDate}
                    class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>
            {#each rf.fields.data.fields.availabilityDate.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Onboarding Status</span>
            <input
                {...rf.fields.data.fields.onboardingStatus.as("text")}
                bind:value={talentData.onboardingStatus}
                placeholder="e.g. Pending background check"
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {#each rf.fields.data.fields.onboardingStatus.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>
        
        <label class="block col-span-2">
            <span class="block text-sm font-medium text-gray-700 mb-1">Internal Notes</span>
            <div class="relative">
                <FileText size={16} class="absolute left-3 top-3 text-gray-400" />
                <textarea
                    {...rf.fields.data.fields.internalNotes.as("textarea")}
                    bind:value={talentData.internalNotes}
                    rows="4"
                    placeholder="Candidate insights, evaluation notes, etc."
                    class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                ></textarea>
            </div>
            {#each rf.fields.data.fields.internalNotes.issues() as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </label>
    </div>

    <div class="flex justify-end gap-3 pt-6 border-t">
        <Button variant="secondary" onclick={onCancel}>Cancel</Button>
        <AsyncButton type="submit" loading={(rf as any).pending}>
            Save Talent
        </AsyncButton>
    </div>
</form>
