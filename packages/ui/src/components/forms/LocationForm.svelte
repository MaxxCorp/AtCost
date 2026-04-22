<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";
    import { untrack } from "svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
        children,
        heroImageSlot,
        labels = {},
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        children?: Snippet<[]>;
        heroImageSlot?: Snippet<[]>;
        labels?: any;
    } = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(typeof remoteFunction === "function" ? (remoteFunction as any)() : remoteFunction);

    const i18n = $derived({
        name: labels?.name ?? "Name",
        street: labels?.street ?? "Street",
        houseNumber: labels?.houseNumber ?? "House Number",
        addressSuffix: labels?.addressSuffix ?? "Address Suffix",
        zip: labels?.zip ?? "ZIP Code",
        city: labels?.city ?? "City",
        state: labels?.state ?? "State/Region",
        country: labels?.country ?? "Country",
        roomId: labels?.roomId ?? "Room ID",
        latitude: labels?.latitude ?? "Latitude",
        longitude: labels?.longitude ?? "Longitude",
        what3words: labels?.what3words ?? "what3words",
        inclusivitySupport: labels?.inclusivitySupport ?? "Inclusivity Support",
        isPublic: labels?.isPublic ?? "Public",
        saveChanges: labels?.saveChanges ?? "Save Changes",
        createLocation: labels?.createLocation ?? "Create Location",
        cancel: labels?.cancel ?? "Cancel",
        saving: labels?.saving ?? "Saving...",
        creating: labels?.creating ?? "Creating...",
        successfullySaved: labels?.successfullySaved ?? "Successfully Saved!",
        errorSomethingWentWrong: labels?.errorSomethingWentWrong ?? "Oh no! Something went wrong",
        enterLocationName: labels?.enterLocationName ?? "Enter location name",
        streetName: labels?.streetName ?? "Street name",
        houseNumberPlaceholder: labels?.houseNumberPlaceholder ?? "e.g. 10A",
        addressSuffixPlaceholder: labels?.addressSuffixPlaceholder ?? "e.g. Backyard, 2nd floor",
        zipCodePlaceholder: labels?.zipCodePlaceholder ?? "Postal code",
        cityNamePlaceholder: labels?.cityNamePlaceholder ?? "City name",
        statePlaceholder: labels?.statePlaceholder ?? "State",
        countryPlaceholder: labels?.countryPlaceholder ?? "Country",
        enterRoomId: labels?.enterRoomId ?? "Enter room ID (e.g. 101)",
        latitudePlaceholder: labels?.latitudePlaceholder ?? "Latitude",
        longitudePlaceholder: labels?.longitudePlaceholder ?? "Longitude",
        what3wordsPlaceholder: labels?.what3wordsPlaceholder ?? "e.g. filled.count.soap",
        inclusivitySupportPlaceholder: labels?.inclusivitySupportPlaceholder ?? "Accessibility and inclusivity information",
        heroImage: labels?.heroImage ?? "Hero Image",
        pleaseFixValidation: labels?.pleaseFixValidation ?? "Please fix the validation errors in the form.",
    });

    let submissionTriggered = $state(false);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        if (submissionTriggered && issues.length > 0) {
            toast.error(i18n.pleaseFixValidation);
            submissionTriggered = false;
        }
    });

    function getField(name: string) {
        const def = { as: (type: string, value?: any) => ({ name, type, value }), issues: () => [], value: () => undefined };
        if (!(rf as any)?.fields) return def;
        const parts = name.split(".");
        let current: any = (rf as any).fields;
        for (const part of parts) {
            if (current?.[part] === undefined) return def;
            current = current[part];
        }
        return current ?? def;
    }
</script>

<form
    class="space-y-4"
    {...remoteFunction.preflight(validationSchema).enhance(async ({ submit }: { submit: any }) => {
            const handle = rf;
            submissionTriggered = false;
            try {
                await submit();
                const result = untrack(() => (handle as any).result);
                if (untrack(() => (handle as any).error) || (result && result.success === false)) {
                    submissionTriggered = true;
                    toast.error(
                        untrack(() => (handle as any).error?.message) || result?.error?.message || result?.error || i18n.errorSomethingWentWrong,
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
    {#if isUpdating && initialData}
        <input {...getField("id").as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.name}</span>
        <input
            {...getField("name").as("text", initialData?.name ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'name',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={i18n.enterLocationName}
            onblur={() => rf.validate()}
        />
        {#each getField("name").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    {#if heroImageSlot}
        {@render heroImageSlot()}
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.street}</span>
        <input
            {...getField("street").as("text", initialData?.street ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.streetName}
        />
    </label>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.houseNumber}</span
            >
            <input
                {...getField("houseNumber").as("text", initialData?.houseNumber ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.houseNumberPlaceholder}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.addressSuffix}</span
            >
            <input
                {...getField("addressSuffix").as("text", initialData?.addressSuffix ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.addressSuffixPlaceholder}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{i18n.zip}</span>
            <input
                {...getField("zip").as("text", initialData?.zip ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.zipCodePlaceholder}
            />
        </label>
        <label class="block col-span-2">
            <span class="text-sm font-medium text-gray-700 mb-2">{i18n.city}</span>
            <input
                {...getField("city").as("text", initialData?.city ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.cityNamePlaceholder}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.state}</span
            >
            <input
                {...getField("state").as("text", initialData?.state ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.statePlaceholder}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{i18n.country}</span>
            <input
                {...getField("country").as("text", initialData?.country ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.countryPlaceholder}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.roomId}</span>
        <input
            {...getField("roomId").as("text", initialData?.roomId ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.enterRoomId}
        />
    </label>

    <div class="grid grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{i18n.latitude}</span>
            <input
                {...getField("latitude").as("text", initialData?.latitude ?? "")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.latitudePlaceholder}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">{i18n.longitude}</span
            >
            <input
                {...getField("longitude").as("text", initialData?.longitude ?? "")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.longitudePlaceholder}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.what3words}</span>
        <input
            {...getField("what3words").as("text", initialData?.what3words ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.what3wordsPlaceholder}
        />
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{i18n.inclusivitySupport}</span
        >
        <textarea
            {...getField("inclusivitySupport").as("text", initialData?.inclusivitySupport ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.inclusivitySupportPlaceholder}
            rows="3"
        ></textarea>
    </label>

    <label class="flex items-center gap-2 cursor-pointer py-2">
        <input
            {...getField("isPublic").as("checkbox", initialData?.isPublic ?? true)}
            type="checkbox"
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span class="text-sm font-medium text-gray-700">{i18n.isPublic}</span>
    </label>

    {#if children}
        {@render children()}
    {/if}

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? i18n.saving : i18n.creating}
            loading={(rf as any).pending}
        >
            {isUpdating ? i18n.saveChanges : i18n.createLocation}
        </AsyncButton>
        {#if onCancel}
            <Button
                variant="secondary"
                type="button"
                size="default"
                onclick={onCancel}
            >
                {i18n.cancel}
            </Button>
        {:else}
            <Button variant="secondary" href={cancelHref} size="default">
                {i18n.cancel}
            </Button>
        {/if}
    </div>
</form>
