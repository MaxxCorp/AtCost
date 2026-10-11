<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button/index.js";
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

    const colorPresets = [
        { name: "Indigo", value: "indigo", bg: "bg-indigo-500" },
        { name: "Emerald", value: "emerald", bg: "bg-emerald-500" },
        { name: "Blue", value: "blue", bg: "bg-blue-500" },
        { name: "Amber", value: "amber", bg: "bg-amber-500" },
        { name: "Rose", value: "rose", bg: "bg-rose-500" },
        { name: "Purple", value: "purple", bg: "bg-purple-500" },
        { name: "Teal", value: "teal", bg: "bg-teal-500" },
        { name: "Slate", value: "slate", bg: "bg-slate-500" },
    ];

    let selectedColor = $state(initialData?.color || "indigo");

    let submissionTriggered = $state(false);
    $effect(() => {
        const issues = (remoteFunction as any).allIssues?.() ?? [];
        if (submissionTriggered && issues.length > 0) {
            toast.error("Bitte korrigieren Sie die Formularfehler");
            submissionTriggered = false;
        }
    });

    $effect(() => {
        const data = initialData || {};
        const keys = ["name", "slug", "description", "color", "icon"];
        for (const key of keys) {
            if (remoteFunction.fields[key] && data[key] !== undefined) {
                remoteFunction.fields[key].set(data[key]);
            }
        }
    });
</script>

<form
    class="space-y-4 text-xs"
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
                    toast.error(error?.message || result?.error || "Fehler beim Speichern");
                    return;
                }

                toast.success("Kategorie erfolgreich gespeichert!");
                if (onSuccess) onSuccess(result);
                else await goto(cancelHref);
            } catch (error: any) {
                submissionTriggered = true;
                toast.error(error?.message || "Fehler beim Speichern");
            }
        })}
>
    {#if isUpdating && initialData?.id}
        <input {...remoteFunction.fields.id.as("text", initialData.id)} class="hidden" />
    {/if}

    <div>
        <label for="cat-name" class="block font-semibold text-gray-700 mb-1">
            Kategoriename *
        </label>
        <input
            id="cat-name"
            {...remoteFunction.fields.name.as("text")}
            placeholder="z.B. Abrechnung & Vergütung, Abteilungen"
            class="w-full px-3.5 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden {(remoteFunction.fields.name.issues() ?? []).length > 0 ? 'border-rose-500' : 'border-gray-200'}"
            onblur={() => remoteFunction.validate()}
        />
        {#each remoteFunction.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-[11px] text-rose-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <div>
        <label for="cat-slug" class="block font-semibold text-gray-700 mb-1">
            Code / Slug (optional)
        </label>
        <input
            id="cat-slug"
            {...remoteFunction.fields.slug.as("text", "")}
            placeholder="z.B. payroll, department"
            class="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden font-mono"
        />
    </div>

    <div>
        <label class="block font-semibold text-gray-700 mb-1.5">
            Akzentfarbe
        </label>
        <div class="flex items-center gap-2 flex-wrap">
            {#each colorPresets as preset}
                <button
                    type="button"
                    onclick={() => {
                        selectedColor = preset.value;
                        if (remoteFunction.fields.color) {
                            remoteFunction.fields.color.set(preset.value);
                        }
                    }}
                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all {selectedColor === preset.value ? 'border-gray-900 bg-gray-900 text-white shadow-xs font-bold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                    <span class="w-2.5 h-2.5 rounded-full {preset.bg}"></span>
                    {preset.name}
                </button>
            {/each}
        </div>
        <input {...remoteFunction.fields.color.as("text", selectedColor)} class="hidden" />
    </div>

    <div>
        <label for="cat-desc" class="block font-semibold text-gray-700 mb-1">
            Beschreibung (optional)
        </label>
        <textarea
            id="cat-desc"
            {...remoteFunction.fields.description.as("text", "")}
            rows="2"
            placeholder="Verwendungszweck dieser Kategorie..."
            class="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
        ></textarea>
    </div>

    <div class="flex justify-end gap-2 mt-6 border-t pt-4">
        {#if onCancel}
            <Button variant="outline" type="button" size="sm" onclick={onCancel}>
                Abbrechen
            </Button>
        {:else}
            <Button variant="outline" href={cancelHref} size="sm">
                Abbrechen
            </Button>
        {/if}
        <AsyncButton
            type="submit"
            size="sm"
            loadingLabel={isUpdating ? "Wird gespeichert..." : "Wird angelegt..."}
            loading={(remoteFunction as any).pending}
            class="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
            {isUpdating ? "Änderungen speichern" : "Kategorie anlegen"}
        </AsyncButton>
    </div>
</form>
