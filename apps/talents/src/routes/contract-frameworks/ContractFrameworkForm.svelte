<script lang="ts">
    import AsyncButton from "@ac/ui/components/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "@ac/ui/components/button";
    import { goto } from "$app/navigation";
    import { untrack } from "svelte";
    import * as m from "$lib/paraglide/messages";
    import { translateIssue } from "@ac/ui";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/contract-frameworks",
    }: any = $props();

    const rf = $derived((typeof remoteFunction === "function" ? remoteFunction() : remoteFunction) as any);

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = rf?.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });


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

    {#if rf?.fields?.name}
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{m.name()}</span>
            <input
                {...rf.fields.name.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.name.issues?.() ?? []).length > 0 ? 'border-red-500' : 'border-gray-300'}"
                placeholder={m.enter_framework_name()}
                onblur={() => rf.validate()}
                value={initialData?.name ?? ""}
            />
            {#each rf.fields.name.issues?.() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    {/if}

    {#if rf?.fields?.description}
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{m.description()}</span>
            <textarea
                {...rf.fields.description.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                placeholder={m.describe_framework()}
                rows="3"
                value={initialData?.description ?? ""}
            ></textarea>
        </label>
    {/if}

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton type="submit" loadingLabel={isUpdating ? m.save_changes() : m.creating()} loading={rf && rf.pending}>
            {isUpdating ? m.save_changes() : m.create_framework()}
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
