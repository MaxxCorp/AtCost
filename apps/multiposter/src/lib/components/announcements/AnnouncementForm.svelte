<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import SyncCheckboxBlock from "$lib/components/sync/SyncCheckboxBlock.svelte";
    import { toast } from "svelte-sonner";
    import { deleteAnnouncements as deleteAnnouncementAction } from "../../../routes/announcements/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import { EntityManager } from "@ac/ui";
    import TagInput from "$lib/components/ui/TagInput.svelte";
    import { listLocations } from "../../../routes/locations/list.remote";
    import type { Location } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import {
        fetchEntityLocations,
        addLocationAssociation,
        removeLocationAssociation,
    } from "../../../routes/locations/associate.remote";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import type { Contact } from "$lib/validations/contacts";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../../routes/contacts/associate.remote";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "$lib/validations/contacts";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import { onMount } from "svelte";
    import { MapPin, User } from "@lucide/svelte";

    import RichTextEditor from "$lib/components/cms/RichTextEditor.svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
    } = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(
        typeof remoteFunction === "function"
            ? (remoteFunction as any)()
            : remoteFunction,
    );

    const type = "announcement";

    // svelte-ignore state_referenced_locally
    let contentValue = $state(
        getField("content").value() ?? initialData?.content ?? "",
    );
    // svelte-ignore state_referenced_locally
    let tagsString = $state(
        isUpdating && initialData?.tagNames
            ? initialData.tagNames.join(", ")
            : "News",
    );
    // svelte-ignore state_referenced_locally
    let selectedContactIds = $state<string[]>(initialData?.contactIds || []);
    // svelte-ignore state_referenced_locally
    let isPublic = $state(initialData?.isPublic ?? false);
    let locations = $state<Location[]>([]);
    // svelte-ignore state_referenced_locally
    let selectedLocationIds = $state<string[]>(initialData?.locationIds || []);

    // Keep contentValue in sync with form state ONLY IF it's empty (initial load)
    $effect(() => {
        if (!contentValue && initialData?.content) {
            contentValue = initialData.content;
        }
    });

    onMount(async () => {
        try {
            locations = await listLocations();
        } catch (e) {
            console.error("Failed to load locations", e);
        }
    });

    // Derived JSON for submission
    let tagNamesJson = $derived(
        JSON.stringify(
            tagsString
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );

    function getField(name: string) {
        const def = {
            as: () => ({}),
            issues: () => [],
            value: () => undefined,
        };
        if (!(rf as any)?.fields) return def;
        const parts = name.split(".");
        let current: any = (rf as any).fields;
        for (const part of parts) {
            if (current?.[part] === undefined) return def;
            current = current[part];
        }
        return current ?? def;
    }

    const formSetup = $derived(
        (rf as any)
            .preflight(validationSchema)
            .enhance(async ({ submit }: { submit: any }) => {
                try {
                    await submit();
                    const result = (rf as any).result;
                    if (result?.error) {
                        toast.error(
                            result.error.message || m.something_went_wrong(),
                        );
                        return;
                    }

                    toast.success(m.successfully_saved());
                    goto("/announcements");
                } catch (error: any) {
                    toast.error(error.message || m.something_went_wrong());
                }
            }),
    );
</script>

-.
<div class="max-w-3xl mx-auto px-4 py-8">
    <Breadcrumb
        feature="announcements"
        current={initialData?.title ??
            m.create_item({ item: m.announcement() })}
    />

    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">
            {isUpdating
                ? m.edit_item({ item: m.announcement() })
                : m.create_item({ item: m.announcement() })}
        </h1>
        {#if isUpdating && initialData}
            <AsyncButton
                type="button"
                variant="destructive"
                loading={deleteAnnouncementAction.pending}
                onclick={async () => {
                    await handleDelete({
                        ids: [initialData.id],
                        deleteFn: deleteAnnouncementAction,
                        itemName: m.announcement().toLowerCase(),
                    });
                    goto("/announcements");
                }}
            >
                {m.delete()}
            </AsyncButton>
        {/if}
    </div>

    <form {...formSetup} class="space-y-6">
        {#if isUpdating && initialData}
            <input {...getField("id").as("hidden", initialData.id)} />
        {/if}

        <input {...getField("isPublic").as("hidden", isPublic.toString())} />
        <!-- Send tagNames as JSON string -->
        <input name="tagNames" value={tagNamesJson} type="hidden" />
        <!-- We no longer strictly need tagIds for submission if using names -->

        <input
            {...getField("contactIds").as(
                "hidden",
                JSON.stringify(selectedContactIds),
            )}
        />

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 class="text-xl font-semibold mb-4 border-b pb-2">
                {m.basic_information()}
            </h2>

            <div>
                <label
                    for="title"
                    class="block text-sm font-medium text-gray-700 mb-1"
                >
                    {m.title()} <span class="text-red-500">*</span>
                </label>
                <input
                    {...getField("title").as("text")}
                    required
                    value={getField("title").value() ??
                        initialData?.title ??
                        ""}
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    placeholder={m.announcement_title_placeholder()}
                />
                {#each getField("title").issues() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                {/each}
            </div>

            <div>
                <label
                    for="content"
                    class="block text-sm font-medium text-gray-700 mb-1"
                >
                    {m.content()} <span class="text-red-500">*</span>
                </label>
                <div class="prose max-w-none">
                    <RichTextEditor bind:value={contentValue} />
                    {#if contentValue}
                        <input
                            {...getField("content").as("hidden", contentValue)}
                        />
                    {/if}
                </div>
                {#each getField("content").issues() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                {/each}
            </div>

            <div>
                <TagInput
                    bind:value={tagsString}
                    label={m.tags()}
                    placeholder={m.tags_comma_separated()}
                />
            </div>

            <div>
                {#if locations.length > 0}
                    <EntityManager
                        title={m.locations()}
                        icon={MapPin}
                        {type}
                        entityId={initialData?.id}
                        initialItems={locations.filter((l: any) =>
                            selectedLocationIds.includes(l.id),
                        )}
                        onchange={(ids: string[]) =>
                            (selectedLocationIds = ids)}
                        embedded={true}
                        listItemsRemote={listLocations as any}
                        fetchAssociationsRemote={fetchEntityLocations as any}
                        addAssociationRemote={async (p: any) =>
                            addLocationAssociation({
                                ...p,
                                locationId: p.itemId,
                                // @ts-ignore
                            } as any)}
                        removeAssociationRemote={async (p: any) =>
                            removeLocationAssociation({
                                ...p,
                                locationId: p.itemId,
                                // @ts-ignore
                            } as any)}
                        deleteItemRemote={async (ids: string[]) => {
                            return await handleDelete({
                                ids,
                                deleteFn: deleteLocation,
                                itemName: m.location().toLowerCase(),
                            });
                        }}
                        createRemote={createLocation}
                        createSchema={createLocationSchema}
                        updateRemote={updateLocation}
                        updateSchema={updateLocationSchema}
                        getFormData={(l: Location) => l}
                        searchPredicate={(l: Location, q: string) => {
                            return (
                                l.name
                                    .toLowerCase()
                                    .includes(q.toLowerCase()) ||
                                (l.roomId
                                    ?.toLowerCase()
                                    .includes(q.toLowerCase()) ??
                                    false)
                            );
                        }}
                        loadingLabel={m.loading_item({ item: m.locations() })}
                        noItemsLabel={m.no_items_associated_label({
                            item: m.locations(),
                        })}
                        noItemsFoundLabel={m.no_items_found({
                            item: m.locations(),
                        })}
                        searchPlaceholder={m.search_placeholder({
                            item: m.locations(),
                        })}
                        linkItemLabel={m.link_item_label({
                            item: m.locations(),
                        })}
                        associatedItemLabel={m.associated_item_label({
                            item: m.locations(),
                        })}
                        quickCreateLabel={m.quick_create()}
                        closeSearchLabel={m.close_search()}
                        editLabel={m.edit()}
                        deleteLabel={m.delete()}
                        unlinkLabel={m.unlink()}
                        deleteForeverLabel={m.delete_forever({
                            item: m.location(),
                        })}
                        bulkDeleteLabel={m.delete_selected({ count: 0 })}
                        selectAllLabel={m.select_all()}
                        deselectAllLabel={m.deselect_all()}
                        confirmUnlinkLabel={m.confirm_unlink_label({
                            item: m.location(),
                        })}
                    >
                        {#snippet renderItemLabel(location)}
                            {location.name}
                            {location.roomId ? `(${location.roomId})` : ""}
                        {/snippet}
                        {#snippet renderForm({
                            remoteFunction: rf,
                            schema,
                            id,
                            initialData: formData,
                            onSuccess,
                            onCancel,
                        })}
                            <LocationForm
                                remoteFunction={rf}
                                validationSchema={schema}
                                isUpdating={!!id}
                                initialData={formData}
                                {onSuccess}
                                {onCancel}
                            />
                        {/snippet}
                    </EntityManager>
                {:else}
                    <div
                        class="p-4 border border-dashed rounded-lg text-sm text-gray-500 text-center"
                    >
                        {m.loading_item({ item: m.locations() })}
                    </div>
                {/if}
                <input
                    {...getField("locationIds").as(
                        "hidden",
                        JSON.stringify(selectedLocationIds),
                    )}
                />
            </div>

            <div class="flex items-center gap-2 mt-4">
                <input
                    id="isPublic"
                    type="checkbox"
                    bind:checked={isPublic}
                    class="w-4 h-4 text-blue-600"
                />
                <label for="isPublic" class="text-sm text-gray-700"
                    >{m.make_announcement_public()}</label
                >
            </div>
        </div>

        <EntityManager
            title={m.contacts()}
            icon={User}
            {type}
            entityId={initialData?.id}
            onchange={(ids: string[]) => (selectedContactIds = ids)}
            embedded={true}
            listItemsRemote={listContacts as any}
            fetchAssociationsRemote={fetchEntityContacts as any}
            addAssociationRemote={async (p: any) =>
                addAssociation({ ...p, contactId: p.itemId } as any)}
            removeAssociationRemote={async (p: any) =>
                removeAssociation({ ...p, contactId: p.itemId } as any)}
            deleteItemRemote={async (ids: string[]) => {
                return await handleDelete({
                    ids,
                    deleteFn: deleteExistingContact,
                    itemName: m.contact().toLowerCase(),
                });
            }}
            createRemote={createNewContact}
            createSchema={createContactSchema}
            updateRemote={updateExistingContact}
            updateSchema={updateContactSchema}
            getFormData={(c: Contact) => ({
                contact: c,
                emails: c.emails,
                phones: c.phones,
                addresses: c.addresses,
                relations: c.relations,
                tags: c.tags,
            })}
            searchPredicate={(c: Contact, q: string) => {
                const name = (
                    c.displayName ||
                    `${c.givenName || ""} ${c.familyName || ""}`
                ).toLowerCase();
                return name.includes(q.toLowerCase());
            }}
            loadingLabel={m.loading_item({ item: m.contacts() })}
            noItemsLabel={m.no_items_associated_label({ item: m.contacts() })}
            noItemsFoundLabel={m.no_items_found({ item: m.contacts() })}
            searchPlaceholder={m.search_placeholder({ item: m.contacts() })}
            linkItemLabel={m.link_item_label({ item: m.contacts() })}
            associatedItemLabel={m.associated_item_label({
                item: m.contacts(),
            })}
            quickCreateLabel={m.quick_create()}
            closeSearchLabel={m.close_search()}
            editLabel={m.edit()}
            deleteLabel={m.delete()}
            unlinkLabel={m.unlink()}
            deleteForeverLabel={m.delete_forever({ item: m.contact() })}
            bulkDeleteLabel={m.delete_selected({ count: 0 })}
            selectAllLabel={m.select_all()}
            deselectAllLabel={m.deselect_all()}
            confirmUnlinkLabel={m.confirm_unlink_label({ item: m.contact() })}
        >
            {#snippet renderItemLabel(contact)}
                {contact.displayName ||
                    `${contact.givenName || ""} ${contact.familyName || ""}`}
            {/snippet}
            {#snippet renderForm({
                remoteFunction: rf,
                schema,
                initialData: formData,
                onSuccess,
                onCancel,
                id,
            })}
                <ContactForm
                    remoteFunction={rf}
                    {schema}
                    initialData={formData}
                    {onSuccess}
                    {onCancel}
                    contactId={id}
                />
            {/snippet}
        </EntityManager>

        <SyncCheckboxBlock
            syncFieldConfig={getField("syncIds")}
            initialSelectedIds={initialData?.syncIds || []}
        />

        <div class="flex justify-end pt-4">
            <AsyncButton
                type="submit"
                loading={(rf as any).pending}
                class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
                {isUpdating
                    ? m.save_changes()
                    : m.create_item({ item: m.announcement() })}
            </AsyncButton>
            <Button
                variant="secondary"
                href="/announcements"
                size="default"
                class="ml-3"
            >
                {m.cancel()}
            </Button>
        </div>
    </form>
</div>
