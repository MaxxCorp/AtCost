<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";

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

    const i18n = {
        get name() {
            return labels?.name ?? "Name";
        },
        get description() {
            return labels?.description ?? "Description";
        },
        get capacity() {
            return labels?.capacity ?? "Capacity";
        },
        get street() {
            return labels?.street ?? "Street";
        },
        get houseNumber() {
            return labels?.houseNumber ?? "House Number";
        },
        get addressSuffix() {
            return labels?.addressSuffix ?? "Address Suffix";
        },
        get zip() {
            return labels?.zip ?? "ZIP Code";
        },
        get city() {
            return labels?.city ?? "City";
        },
        get state() {
            return labels?.state ?? "State/Region";
        },
        get country() {
            return labels?.country ?? "Country";
        },
        get roomId() {
            return labels?.roomId ?? "Room ID";
        },
        get latitude() {
            return labels?.latitude ?? "Latitude";
        },
        get longitude() {
            return labels?.longitude ?? "Longitude";
        },
        get what3words() {
            return labels?.what3words ?? "what3words";
        },
        get inclusivitySupport() {
            return labels?.inclusivitySupport ?? "Inclusivity Support";
        },
        get isPublic() {
            return labels?.isPublic ?? "Public";
        },
        get saveChanges() {
            return labels?.saveChanges ?? "Save Changes";
        },
        get createLocation() {
            return labels?.createLocation ?? "Create Location";
        },
        get cancel() {
            return labels?.cancel ?? "Cancel";
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
            return (
                labels?.errorSomethingWentWrong ?? "Oh no! Something went wrong"
            );
        },
        get enterLocationName() {
            return labels?.enterLocationName ?? "Enter location name";
        },
        get streetName() {
            return labels?.streetName ?? "Street name";
        },
        get houseNumberPlaceholder() {
            return labels?.houseNumberPlaceholder ?? "e.g. 10A";
        },
        get addressSuffixPlaceholder() {
            return (
                labels?.addressSuffixPlaceholder ?? "e.g. Backyard, 2nd floor"
            );
        },
        get zipCodePlaceholder() {
            return labels?.zipCodePlaceholder ?? "Postal code";
        },
        get cityNamePlaceholder() {
            return labels?.cityNamePlaceholder ?? "City name";
        },
        get statePlaceholder() {
            return labels?.statePlaceholder ?? "State";
        },
        get countryPlaceholder() {
            return labels?.countryPlaceholder ?? "Country";
        },
        get enterRoomId() {
            return labels?.enterRoomId ?? "Enter room ID (e.g. 101)";
        },
        get latitudePlaceholder() {
            return labels?.latitudePlaceholder ?? "Latitude";
        },
        get longitudePlaceholder() {
            return labels?.longitudePlaceholder ?? "Longitude";
        },
        get what3wordsPlaceholder() {
            return labels?.what3wordsPlaceholder ?? "e.g. filled.count.soap";
        },
        get inclusivitySupportPlaceholder() {
            return (
                labels?.inclusivitySupportPlaceholder ??
                "Accessibility and inclusivity information"
            );
        },
        get heroImage() {
            return labels?.heroImage ?? "Hero Image";
        },
        get pleaseFixValidation() {
            return (
                labels?.pleaseFixValidation ??
                "Please fix the validation errors in the form."
            );
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

    function initializeFields() {
        const data = initialData || {};
        for (const key in remoteFunction.fields) {
            const field = remoteFunction.fields[key];
            const value = data[key];

            if (key === "isPublic") {
                field.checked(value ?? true);
            } else if (key === "id") {
                field.value(value ?? "");
            } else {
                field.set(value ?? "");
            }
        }
    }

    // Initialize immediately for first render
    initializeFields();

    $effect.pre(() => {
        // Re-initialize when props change
        initializeFields();
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
        <input {...remoteFunction.fields.id.as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{i18n.name}</span>
        <input
            {...remoteFunction.fields.name.as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(remoteFunction.fields.name.issues()
                ?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={i18n.enterLocationName}
            onblur={() => remoteFunction.validate()}
        />
        {#each remoteFunction.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{i18n.description}</span
        >
        <textarea
            {...remoteFunction.fields.description.as("text")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the location..."
            rows="2"
        ></textarea>
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{i18n.capacity}</span
        >
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
            {...remoteFunction.fields.isPublic.as("checkbox")}
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
