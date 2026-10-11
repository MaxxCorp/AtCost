<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button/index.js";
    import { goto } from "$app/navigation";
    import { translateIssue } from "../../utils.js";
    import { Shield, Globe } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        categories = [],
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
        categories?: Array<{ id: string; name: string; color?: string }>;
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

    let selectedVisibility = $state(initialData?.visibility || "internal");
    let selectedColor = $state(initialData?.color || "indigo");
    let selectedCategoryId = $state(initialData?.categoryId || "");

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
        if (remoteFunction.fields.name && data.name) {
            remoteFunction.fields.name.set(data.name);
        }
        if (remoteFunction.fields.visibility && data.visibility) {
            remoteFunction.fields.visibility.set(data.visibility);
            selectedVisibility = data.visibility;
        }
        if (remoteFunction.fields.categoryId) {
            remoteFunction.fields.categoryId.set(data.categoryId || null);
            selectedCategoryId = data.categoryId || "";
        }
        if (remoteFunction.fields.color && data.color) {
            remoteFunction.fields.color.set(data.color);
            selectedColor = data.color;
        }
        if (remoteFunction.fields.description && data.description) {
            remoteFunction.fields.description.set(data.description);
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

                toast.success("Tag erfolgreich gespeichert!");
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

    <!-- Name -->
    <div>
        <label for="tag-name" class="block font-semibold text-gray-700 mb-1">
            Tag-Bezeichnung *
        </label>
        <input
            id="tag-name"
            {...remoteFunction.fields.name.as("text")}
            placeholder="z.B. Gehaltsempfänger, Barista, VIP, Festangestellt"
            class="w-full px-3.5 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden {(remoteFunction.fields.name.issues() ?? []).length > 0 ? 'border-rose-500' : 'border-gray-200'}"
            onblur={() => remoteFunction.validate()}
        />
        {#each remoteFunction.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-[11px] text-rose-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <!-- Visibility: Internal vs External -->
    <div>
        <span class="block font-semibold text-gray-700 mb-1">
            Sichtbarkeit (Visibility) *
        </span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
                class="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all {selectedVisibility === 'internal' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-gray-200 bg-white hover:bg-gray-50'}"
            >
                <input
                    type="radio"
                    name="visibility"
                    value="internal"
                    checked={selectedVisibility === 'internal'}
                    onchange={() => {
                        selectedVisibility = 'internal';
                        if (remoteFunction.fields.visibility) remoteFunction.fields.visibility.set('internal');
                    }}
                    class="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                    <div class="font-bold text-gray-900 flex items-center gap-1">
                        <Shield class="w-3.5 h-3.5 text-indigo-600" />
                        Intern (Standard)
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                        Nur für interne Zwecke (Abrechnung, Payroll, HR, interne Filter). Niemals auf Kiosken oder öffentlichen Ansichten sichtbar.
                    </p>
                </div>
            </label>

            <label
                class="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all {selectedVisibility === 'external' ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600' : 'border-gray-200 bg-white hover:bg-gray-50'}"
            >
                <input
                    type="radio"
                    name="visibility"
                    value="external"
                    checked={selectedVisibility === 'external'}
                    onchange={() => {
                        selectedVisibility = 'external';
                        if (remoteFunction.fields.visibility) remoteFunction.fields.visibility.set('external');
                    }}
                    class="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                    <div class="font-bold text-gray-900 flex items-center gap-1">
                        <Globe class="w-3.5 h-3.5 text-emerald-600" />
                        Öffentlich (External)
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                        Sichtbar auf öffentlichen Displays, Kiosken und Event-Webseiten für externe Besucher.
                    </p>
                </div>
            </label>
        </div>
        <input {...remoteFunction.fields.visibility.as("text", selectedVisibility)} class="hidden" />
    </div>

    <!-- Category -->
    <div>
        <label for="tag-category" class="block font-semibold text-gray-700 mb-1">
            Kategorie
        </label>
        <select
            id="tag-category"
            value={selectedCategoryId}
            onchange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                selectedCategoryId = val;
                if (remoteFunction.fields.categoryId) {
                    remoteFunction.fields.categoryId.set(val || null);
                }
            }}
            class="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
        >
            <option value="">Keine Kategorie (Allgemein)</option>
            {#each categories as cat}
                <option value={cat.id}>{cat.name}</option>
            {/each}
        </select>
        {#if remoteFunction.fields.categoryId}
            <input {...remoteFunction.fields.categoryId.as("text", selectedCategoryId)} class="hidden" />
        {/if}
    </div>

    <!-- Color Preset -->
    <div>
        <label class="block font-semibold text-gray-700 mb-1.5">
            Farbe / Tag-Pill
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
        {#if remoteFunction.fields.color}
            <input {...remoteFunction.fields.color.as("text", selectedColor)} class="hidden" />
        {/if}
    </div>

    <!-- Description -->
    <div>
        <label for="tag-desc" class="block font-semibold text-gray-700 mb-1">
            Beschreibung (optional)
        </label>
        <textarea
            id="tag-desc"
            {...remoteFunction.fields.description.as("text", "")}
            rows="2"
            placeholder="Optionale Beschreibung des Tags..."
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
            {isUpdating ? "Änderungen speichern" : "Tag anlegen"}
        </AsyncButton>
    </div>
</form>
