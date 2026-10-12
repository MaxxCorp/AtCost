<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button/index.js";
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

    const rf = $derived(
        validationSchema
            ? (remoteFunction as any).preflight(validationSchema)
            : remoteFunction,
    );

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

    let prevIssuesLength = 0;
    $effect(() => {
        const issues = (rf as any)?.allIssues?.() ?? (rf as any)?.fields?.allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(i18n.pleaseFixValidation);
        }
        prevIssuesLength = issues.length;
    });
</script>

<form
    class="space-y-4"
    {...rf.enhance(async ({ submit }: { submit: any }) => {
        try {
            await submit();
            const result = (rf as any).result;
            const error = (rf as any).error;

            if (error || (result && result.success === false)) {
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
            const err = error as { message?: string };
            toast.error(err?.message || i18n.errorSomethingWentWrong);
        }
    })}
>
    {#if isUpdating && initialData?.id}
        <input {...rf.fields.id.as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.name}</span>
        <input
            {...rf.fields.name.as("text", initialData?.name ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.name.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.enterLocationName}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.name.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.description}</span>
        <textarea
            {...rf.fields.description.as("text", initialData?.description ?? "")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the location..."
            rows="2"
        ></textarea>
        {#each rf.fields.description.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.capacity}</span>
        <input
            {...rf.fields.capacity.as("text", initialData?.capacity ?? "")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. 50 people"
        />
        {#each rf.fields.capacity.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    {#if heroImageSlot}
        {@render heroImageSlot()}
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.street}</span>
        <input
            {...rf.fields.street.as("text", initialData?.street ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.street.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.streetName}
        />
        {#each rf.fields.street.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.houseNumber}</span
            >
            <input
                {...rf.fields.houseNumber.as("text", initialData?.houseNumber ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.houseNumber.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.houseNumberPlaceholder}
            />
            {#each rf.fields.houseNumber.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.addressSuffix}</span
            >
            <input
                {...rf.fields.addressSuffix.as("text", initialData?.addressSuffix ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.addressSuffix.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.addressSuffixPlaceholder}
            />
            {#each rf.fields.addressSuffix.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.zip}</span
            >
            <input
                {...rf.fields.zip.as("text", initialData?.zip ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.zip.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.zipCodePlaceholder}
            />
            {#each rf.fields.zip.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block col-span-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.city}</span
            >
            <input
                {...rf.fields.city.as("text", initialData?.city ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.city.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.cityNamePlaceholder}
            />
            {#each rf.fields.city.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.state}</span
            >
            <input
                {...rf.fields.state.as("text", initialData?.state ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.state.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.statePlaceholder}
            />
            {#each rf.fields.state.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.country}</span
            >
            <input
                {...rf.fields.country.as("text", initialData?.country ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.country.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.countryPlaceholder}
            />
            {#each rf.fields.country.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.roomId}</span
        >
        <input
            {...rf.fields.roomId.as("text", initialData?.roomId ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.roomId.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.enterRoomId}
        />
        {#each rf.fields.roomId.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <div class="grid grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.latitude}</span
            >
            <input
                {...rf.fields.latitude.as("text", initialData?.latitude != null ? String(initialData.latitude) : "")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.latitude.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.latitudePlaceholder}
            />
            {#each rf.fields.latitude.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.longitude}</span
            >
            <input
                {...rf.fields.longitude.as("text", initialData?.longitude != null ? String(initialData.longitude) : "")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.longitude.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.longitudePlaceholder}
            />
            {#each rf.fields.longitude.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >{i18n.what3words}</span
        >
        <input
            {...rf.fields.what3words.as("text", initialData?.what3words ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.what3words.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.what3wordsPlaceholder}
        />
        {#each rf.fields.what3words.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >{i18n.inclusivitySupport}</span
        >
        <textarea
            {...rf.fields.inclusivitySupport.as("text", initialData?.inclusivitySupport ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.inclusivitySupport.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.inclusivitySupportPlaceholder}
            rows="3"
        ></textarea>
        {#each rf.fields.inclusivitySupport.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="flex items-center gap-2 cursor-pointer py-2">
        <input
            {...rf.fields.isPublic.as("checkbox", initialData?.isPublic ?? true)}
            type="checkbox"
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.isPublic}</span>
        {#each rf.fields.isPublic.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
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
