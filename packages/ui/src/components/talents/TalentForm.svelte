<script lang="ts">
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

    function getField(name: string) {
        if (!remoteFunction?.fields) return {};
        const parts = name.split(".");
        let current: any = remoteFunction.fields;
        for (const part of parts) {
            if (!current?.[part]) return {};
            current = current[part];
        }
        return current;
    }

    const formSetup = $derived(remoteFunction.preflight(schema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = remoteFunction.result;
            if (result?.success === false || result?.error) {
                toast.error(result?.error?.message || result?.error || "Failed to save talent");
                return;
            }

            toast.success("Talent successfully saved!");
            onSuccess(result);
        } catch (error: any) {
            toast.error(error.message || "An unexpected error occurred");
        }
    }));
</script>

<form
    {...formSetup}
    class="space-y-6"
>
    {#if id || talentData.id}
        <input {...getField("id").as("hidden", id || talentData.id)} />
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block col-span-2">
            <span class="block text-sm font-medium text-gray-700 mb-1">Target Job Title</span>
            <div class="relative">
                <Briefcase size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...getField("data.jobTitle").as("text")}
                    bind:value={talentData.jobTitle}
                    placeholder="e.g. Senior Frontend Engineer"
                    class="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
            </div>
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Status</span>
            <select
                {...getField("data.status").as("select")}
                bind:value={talentData.status}
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
                <option value="applicant">Applicant</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Salary Expectation</span>
            <div class="relative">
                <DollarSign size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...getField("data.salaryExpectation").as("text")}
                    bind:value={talentData.salaryExpectation}
                    placeholder="Yearly gross"
                    class="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
            </div>
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Availability</span>
            <div class="relative">
                <Calendar size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...getField("data.availabilityDate").as("date")}
                    bind:value={talentData.availabilityDate}
                    class="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
            </div>
        </label>

        <label class="block">
            <span class="block text-sm font-medium text-gray-700 mb-1">Source</span>
            <input
                {...getField("data.source").as("text")}
                bind:value={talentData.source}
                placeholder="LinkedIn, Referral..."
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
        </label>

        <label class="block col-span-2">
            <span class="block text-sm font-medium text-gray-700 mb-1">Resume URL</span>
            <div class="relative">
                <FileText size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    {...getField("data.resumeUrl").as("text")}
                    bind:value={talentData.resumeUrl}
                    placeholder="Link to CV..."
                    class="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
            </div>
        </label>

        <label class="block col-span-2">
            <span class="block text-sm font-medium text-gray-700 mb-1">Internal Notes</span>
            <textarea
                {...getField("data.internalNotes").as("textarea")}
                bind:value={talentData.internalNotes}
                rows="3"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            ></textarea>
        </label>
    </div>

    <div class="flex justify-end gap-3 pt-4">
        <Button variant="secondary" type="button" onclick={onCancel}>Cancel</Button>
        <AsyncButton
            type="submit"
            loading={remoteFunction.pending}
        >
            {id ? "Save Changes" : "Create Talent"}
        </AsyncButton>
    </div>
</form>
