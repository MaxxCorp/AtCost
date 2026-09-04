<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";
    import { translateIssue } from "../../utils.js";

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
        m = undefined,
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
        m?: any;
    } = $props();

    const i18n = {
        get name() {
            return labels?.name ?? m?.location_name?.() ?? m?.name?.() ?? "Name";
        },
        get description() {
            return labels?.description ?? m?.description?.() ?? "Description";
        },
        get capacity() {
            return labels?.capacity ?? m?.capacity?.() ?? "Capacity";
        },
        get street() {
            return labels?.street ?? m?.street?.() ?? "Street";
        },
        get houseNumber() {
            return labels?.houseNumber ?? m?.house_number?.() ?? "House Number";
        },
        get addressSuffix() {
            return labels?.addressSuffix ?? m?.address_suffix?.() ?? "Address Suffix";
        },
        get zip() {
            return labels?.zip ?? m?.zip_code?.() ?? "ZIP Code";
        },
        get city() {
            return labels?.city ?? m?.city?.() ?? "City";
        },
        get state() {
            return labels?.state ?? m?.state_region?.() ?? "State/Region";
        },
        get country() {
            return labels?.country ?? m?.country?.() ?? "Country";
        },
        get roomId() {
            return labels?.roomId ?? m?.room_id?.() ?? "Room ID";
        },
        get latitude() {
            return labels?.latitude ?? m?.latitude?.() ?? "Latitude";
        },
        get longitude() {
            return labels?.longitude ?? m?.longitude?.() ?? "Longitude";
        },
        get what3words() {
            return labels?.what3words ?? m?.what3words?.() ?? "what3words";
        },
        get inclusivitySupport() {
            return labels?.inclusivitySupport ?? m?.inclusivity_support?.() ?? "Inclusivity Support";
        },
        get isPublic() {
            return labels?.isPublic ?? m?.public?.() ?? "Public";
        },
        get saveChanges() {
            return labels?.saveChanges ?? m?.save_changes?.() ?? "Save Changes";
        },
        get createLocation() {
            return labels?.createLocation ?? m?.create_location?.() ?? "Create Location";
        },
        get cancel() {
            return labels?.cancel ?? m?.cancel?.() ?? "Cancel";
        },
        get saving() {
            return labels?.saving ?? m?.loading?.() ?? "Saving...";
        },
        get creating() {
            return labels?.creating ?? m?.creating?.() ?? "Creating...";
        },
        get successfullySaved() {
            return labels?.successfullySaved ?? m?.successfully_saved?.() ?? "Successfully Saved!";
        },
        get errorSomethingWentWrong() {
            return labels?.errorSomethingWentWrong ?? m?.something_went_wrong?.() ?? "Oh no! Something went wrong";
        },
        get enterLocationName() {
            return labels?.enterLocationName ?? m?.enter_location_name?.() ?? "Enter location name";
        },
        get streetName() {
            return labels?.streetName ?? m?.street_placeholder?.() ?? "Street name";
        },
        get houseNumberPlaceholder() {
            return labels?.houseNumberPlaceholder ?? m?.house_number_placeholder?.() ?? "e.g. 10A";
        },
        get addressSuffixPlaceholder() {
            return labels?.addressSuffixPlaceholder ?? m?.address_suffix_placeholder?.() ?? "e.g. Backyard, 2nd floor";
        },
        get zipCodePlaceholder() {
            return labels?.zipCodePlaceholder ?? m?.zip_code_placeholder?.() ?? "Postal code";
        },
        get cityNamePlaceholder() {
            return labels?.cityNamePlaceholder ?? m?.city_placeholder?.() ?? "City name";
        },
        get statePlaceholder() {
            return labels?.statePlaceholder ?? m?.state_placeholder?.() ?? "State";
        },
        get countryPlaceholder() {
            return labels?.countryPlaceholder ?? m?.country_placeholder?.() ?? "Country";
        },
        get enterRoomId() {
            return labels?.enterRoomId ?? m?.room_id_placeholder?.() ?? "Enter room ID (e.g. 101)";
        },
        get latitudePlaceholder() {
            return labels?.latitudePlaceholder ?? m?.latitude_placeholder?.() ?? "Latitude";
        },
        get longitudePlaceholder() {
            return labels?.longitudePlaceholder ?? m?.longitude_placeholder?.() ?? "Longitude";
        },
        get what3wordsPlaceholder() {
            return labels?.what3wordsPlaceholder ?? m?.what3words_placeholder?.() ?? "e.g. filled.count.soap";
        },
        get inclusivitySupportPlaceholder() {
            return labels?.inclusivitySupportPlaceholder ?? m?.accessibility_info?.() ?? "Accessibility and inclusivity information";
        },
        get heroImage() {
            return labels?.heroImage ?? m?.hero_image?.() ?? "Hero Image";
        },
        get pleaseFixValidation() {
            return labels?.pleaseFixValidation ?? m?.please_fix_validation?.() ?? "Please fix the validation errors in the form.";
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
        console.log("LocationForm initialData:", data);
        console.log("LocationForm validationSchema:", validationSchema);
        
        // Extract keys from Valibot schema (handles object, intersect, pipe, etc.)
        const getKeys = (s: any): string[] => {
            if (!s) return [];
            // Handle v.object
            if (s.entries) return Object.keys(s.entries);
            // Handle v.intersect, v.union
            if (s.options) return s.options.flatMap(getKeys);
            // Handle v.optional, v.nullable, etc.
            if (s.wrapped) return getKeys(s.wrapped);
            // Handle v.pipe
            if (s.pipe && Array.isArray(s.pipe) && s.pipe.length > 0) return getKeys(s.pipe[0]);
            return [];
        };

        const schemaKeys = [...new Set(getKeys(validationSchema))];
        console.log("LocationForm schemaKeys:", schemaKeys);
        console.log("LocationForm remoteFunction fields:", Object.keys(remoteFunction.fields || {}));
        
        for (const key of schemaKeys) {
            const value = data[key];
            const defaultValue = key === "isPublic" ? true : "";
            const finalValue = value ?? defaultValue;
            
            if (remoteFunction.fields[key]) {
                console.log(`Setting field ${key} to:`, finalValue);
                remoteFunction.fields[key].set(finalValue);
            } else {
                console.warn(`Field ${key} not found in remoteFunction.fields`);
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
            placeholder={i18n.enterLocationName}
            onblur={() => remoteFunction.validate()}
        />
        {#each remoteFunction.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.description}</span>
        <textarea
            {...remoteFunction.fields.description.as("text")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the location..."
            rows="2"
        ></textarea>
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.capacity}</span>
        <input
            {...remoteFunction.fields.capacity.as("text")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. 50 people"
        />
    </label>

    {#if heroImageSlot}
        {@render heroImageSlot()}
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.street}</span
        >
        <input
            {...remoteFunction.fields.street.as("text")}
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
                {...remoteFunction.fields.houseNumber.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.houseNumberPlaceholder}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.addressSuffix}</span
            >
            <input
                {...remoteFunction.fields.addressSuffix.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.addressSuffixPlaceholder}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.zip}</span
            >
            <input
                {...remoteFunction.fields.zip.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.zipCodePlaceholder}
            />
        </label>
        <label class="block col-span-2">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.city}</span
            >
            <input
                {...remoteFunction.fields.city.as("text")}
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
                {...remoteFunction.fields.state.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.statePlaceholder}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.country}</span
            >
            <input
                {...remoteFunction.fields.country.as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.countryPlaceholder}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.roomId}</span
        >
        <input
            {...remoteFunction.fields.roomId.as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.enterRoomId}
        />
    </label>

    <div class="grid grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.latitude}</span
            >
            <input
                {...remoteFunction.fields.latitude.as("text")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.latitudePlaceholder}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >{i18n.longitude}</span
            >
            <input
                {...remoteFunction.fields.longitude.as("text")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={i18n.longitudePlaceholder}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{i18n.what3words}</span
        >
        <input
            {...remoteFunction.fields.what3words.as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.what3wordsPlaceholder}
        />
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{i18n.inclusivitySupport}</span
        >
        <textarea
            {...remoteFunction.fields.inclusivitySupport.as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={i18n.inclusivitySupportPlaceholder}
            rows="3"
        ></textarea>
    </label>

    <label class="flex items-center gap-2 cursor-pointer py-2">
        <input
            {...remoteFunction.fields.isPublic.as("checkbox", initialData?.isPublic ?? true)}
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
            loading={(remoteFunction as any).pending}
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
