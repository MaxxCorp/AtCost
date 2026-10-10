<script lang="ts">
    import { LoadingSection, ErrorSection, AsyncButton, LocationForm, handleDelete } from "../../index.js";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";

    interface Props {
        locationId: string;
        readLocationRemote: (id: string) => any;
        updateLocationRemote: any;
        deleteLocationRemote?: any;
        validationSchema?: any;
        cancelHref?: string;
        m?: any;
        labels?: any;
        onDeleted?: () => void;
        onLocationLoaded?: (location: any) => void;
        breadcrumb?: Snippet<[{ location: any }]>;
        children?: Snippet<[{ location: any }]>;
    }

    let {
        locationId,
        readLocationRemote,
        updateLocationRemote,
        deleteLocationRemote = undefined,
        validationSchema = undefined,
        cancelHref = "/locations",
        m = undefined,
        labels = {},
        onDeleted = undefined,
        onLocationLoaded = undefined,
        breadcrumb = undefined,
        children = undefined,
    }: Props = $props();

    const locationQuery = $derived(readLocationRemote(locationId));
    const location = $derived(locationQuery?.current);

    $effect(() => {
        if (location && onLocationLoaded) {
            onLocationLoaded(location);
        }
    });

    const rf = $derived(updateLocationRemote.for(locationId));

    const i18n = {
        get notFoundHeadline() {
            return labels?.notFoundHeadline ?? m?.not_found?.({ item: m?.feature_locations_title?.() ?? "Location" }) ?? "Location not found";
        },
        get notFoundMessage() {
            return labels?.notFoundMessage ?? m?.not_found_message?.({ item: m?.feature_locations_title?.() ?? "Location" }) ?? "The location you're looking for doesn't exist.";
        },
        get backToList() {
            return labels?.backToList ?? m?.back_to_list?.() ?? "Back to list view";
        },
        get loadingMessage() {
            return labels?.loadingMessage ?? m?.loading_item?.({ item: m?.feature_locations_title?.() ?? "Location" }) ?? "Loading location details...";
        },
        get deleteLabel() {
            return labels?.delete ?? m?.delete?.() ?? "Delete";
        },
        get deletingLabel() {
            return labels?.deleting ?? m?.deleting?.() ?? "Deleting...";
        },
        get editLocation() {
            return labels?.editLocation ?? m?.edit_item?.({ item: m?.feature_locations_title?.() ?? "Location" }) ?? "Edit Location";
        },
        get subtitle() {
            return labels?.subtitle ?? "Update location details and settings";
        },
        get created() {
            return labels?.created ?? m?.created?.() ?? "Created";
        },
        get updated() {
            return labels?.updated ?? m?.updated?.() ?? "Updated";
        },
    };

    let isDeleting = $state(false);

    async function onDelete() {
        if (!deleteLocationRemote || !location) return;
        isDeleting = true;
        try {
            await handleDelete({
                ids: [location.id],
                deleteFn: deleteLocationRemote,
                itemName: m?.location?.()?.toLowerCase() ?? "location",
            });
            if (onDeleted) {
                onDeleted();
            } else {
                await goto(cancelHref);
            }
        } finally {
            isDeleting = false;
        }
    }
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#if locationQuery?.loading && !location}
        <LoadingSection message={i18n.loadingMessage} />
    {:else if locationQuery?.error}
        <ErrorSection
            headline={i18n.notFoundHeadline}
            message={locationQuery.error?.message ?? i18n.notFoundMessage}
            href={cancelHref}
            button={i18n.backToList}
        />
    {:else if location}
        {#if breadcrumb}
            <div class="mb-4">
                {@render breadcrumb({ location })}
            </div>
        {/if}
        <div class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                    {location.name}
                </h1>
                <p class="text-gray-500 text-sm mt-1">
                    {i18n.created}: {new Date(location.createdAt).toLocaleString()}
                    {#if location.updatedAt && location.updatedAt !== location.createdAt}
                        • {i18n.updated}: {new Date(location.updatedAt).toLocaleString()}
                    {/if}
                </p>
            </div>
            {#if deleteLocationRemote}
                <div class="flex items-center gap-2">
                    <AsyncButton
                        type="button"
                        loadingLabel={i18n.deletingLabel}
                        loading={isDeleting || (deleteLocationRemote as any)?.pending}
                        variant="destructive"
                        onclick={onDelete}
                    >
                        {i18n.deleteLabel}
                    </AsyncButton>
                </div>
            {/if}
        </div>

        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8 space-y-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {i18n.editLocation}
            </h2>

            <LocationForm
                remoteFunction={rf}
                {validationSchema}
                initialData={location}
                isUpdating={true}
                {cancelHref}
                {m}
                {labels}
            >
                {#snippet children()}
                    {#if children}
                        {@render children({ location })}
                    {/if}
                {/snippet}
            </LocationForm>
        </div>
    {:else}
        <ErrorSection
            headline={i18n.notFoundHeadline}
            message={i18n.notFoundMessage}
            href={cancelHref}
            button={i18n.backToList}
        />
    {/if}
</div>
