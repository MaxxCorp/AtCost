<script lang="ts">
    import AsyncButton from "@ac/ui/components/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "@ac/ui/components/button";
    import { goto } from "$app/navigation";
    import { untrack } from "svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/contract-frameworks",
    }: any = $props();

    const rf = $derived(typeof remoteFunction === "function" ? remoteFunction() : remoteFunction);

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = rf.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error("Please fix the validation errors in the form.");
        }
        prevIssuesLength = issues.length;
    });

    function getField(name: string) {
        const def = { as: () => ({}), issues: () => [], value: () => undefined };
        if (!rf?.fields) return def;
        return rf.fields[name] ?? def;
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
        <input {...getField("id").as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Name</span>
        <input
            {...getField("name").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(getField('name').issues()?.length ?? 0) > 0 ? 'border-red-500' : 'border-gray-300'}"
            placeholder="e.g. AWO Berlin TV"
            onblur={() => rf.validate()}
            value={initialData?.name ?? ""}
        />
        {#each getField("name").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Description</span>
        <textarea
            {...getField("description").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
            placeholder="Describe the contract framework"
            rows="3"
            value={initialData?.description ?? ""}
        ></textarea>
    </label>

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton type="submit" loadingLabel={isUpdating ? "Saving..." : "Creating..."} loading={rf.pending}>
            {isUpdating ? "Save Changes" : "Create Framework"}
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
