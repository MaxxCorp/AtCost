<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button";
    import { goto } from "$app/navigation";
    import { translateIssue } from "../../utils.js";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/tags",
        labels = {},
        m = undefined,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        labels?: any;
        m?: any;
    } = $props();

    const i18n = {
        get name() {
            return labels?.name ?? m?.summary?.() ?? "Name";
        },
        get saveChanges() {
            return labels?.saveChanges ?? m?.save_changes?.() ?? "Save Changes";
        },
        get createTag() {
            return labels?.createTag ?? m?.create_item?.({ item: "Tag" }) ?? "Create Tag";
        },
        get cancel() {
            return labels?.cancel ?? m?.cancel?.() ?? "Cancel";
        },
        get saving() {
            return labels?.saving ?? "Saving...";
        },
        get creating() {
            return labels?.creating ?? "Creating...";
        },
        get successfullySaved() {
            return labels?.successfullySaved ?? "Successfully Saved!";
        },
        get errorSomethingWentWrong() {
            return labels?.errorSomethingWentWrong ?? "Oh no! Something went wrong";
        },
        get pleaseFixValidation() {
            return labels?.pleaseFixValidation ?? "Please fix the validation errors in the form.";
        },
    };

    let submissionTriggered = $state(false);
    $effect(() => {
        const issues = (remoteFunction as any).allIssues?.() ?? [];
        if (submissionTriggered && issues.length > 0) {
            toast.error(i18n.pleaseFixValidation);
            submissionTriggered = false;
        }
    });

    $effect(() => {
        const data = initialData || {};
        const getKeys = (s: any): string[] => {
            if (!s) return [];
            if (s.entries) return Object.keys(s.entries);
            if (s.options) return s.options.flatMap(getKeys);
            if (s.wrapped) return getKeys(s.wrapped);
            if (s.pipe && Array.isArray(s.pipe) && s.pipe.length > 0) return getKeys(s.pipe[0]);
            return [];
        };

        const schemaKeys = [...new Set(getKeys(validationSchema))];
        for (const key of schemaKeys) {
            const value = data[key];
            const finalValue = value ?? "";
            if (remoteFunction.fields[key]) {
                remoteFunction.fields[key].set(finalValue);
            }
        }
    });
</script>

<form
    class="space-y-4"
    {...remoteFunction
        .preflight(validationSchema)
        .enhance(async ({ submit }: { submit: any }) => {
            submissionTriggered = false;
            try {
                await submit();
                const result = (remoteFunction as any).result;
                const error = (remoteFunction as any).error;

                if (error || (result && result.success === false)) {
                    submissionTriggered = true;
                    toast.error(
                        error?.message ||
                            result?.error?.message ||
                            result?.error ||
                            i18n.errorSomethingWentWrong,
                    );
                    return;
                }

                toast.success(i18n.successfullySaved);
                if (onSuccess) onSuccess(result);
                else await goto(cancelHref);
            } catch (error: unknown) {
                submissionTriggered = true;
                const err = error as { message?: string };
                toast.error(err?.message || i18n.errorSomethingWentWrong);
            }
        })}
>
    {#if isUpdating && initialData?.id}
        <input {...remoteFunction.fields.id.as("text", initialData.id)} class="hidden" />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.name}</span>
        <input
            {...remoteFunction.fields.name.as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(remoteFunction.fields.name.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            onblur={() => remoteFunction.validate()}
        />
        {#each remoteFunction.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <div class="flex justify-end gap-3 mt-6 border-t pt-4">
        {#if onCancel}
            <Button
                variant="outline"
                type="button"
                size="default"
                onclick={onCancel}
            >
                {i18n.cancel}
            </Button>
        {:else}
            <Button variant="outline" href={cancelHref} size="default">
                {i18n.cancel}
            </Button>
        {/if}
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? i18n.saving : i18n.creating}
            loading={(remoteFunction as any).pending}
        >
            {isUpdating ? i18n.saveChanges : i18n.createTag}
        </AsyncButton>
    </div>
</form>
