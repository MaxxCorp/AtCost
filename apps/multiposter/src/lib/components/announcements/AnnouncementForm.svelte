<script lang="ts">
    import { goto } from "$app/navigation";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { toast } from "svelte-sonner";
    import { deleteAnnouncements as deleteAnnouncementAction } from "../../../routes/announcements/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import EntityManager from "$lib/components/ui/EntityManager.svelte";
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
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Contact } from "$lib/validations/contacts";
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

    const type = "announcement";

    let contentValue = $state("");
    let tagsString = $state("");
    let selectedContactIds = $state<string[]>([]);
    let isPublic = $state(false);
    let locations = $state<Location[]>([]);
    let selectedLocationIds = $state<string[]>([]);

    $effect(() => {
        contentValue =
            getField("content").value() ?? initialData?.content ?? "";
        tagsString =
            isUpdating && initialData?.tagNames
                ? initialData.tagNames.join(", ")
                : "News";
        selectedContactIds = initialData?.contactIds || [];
        isPublic = initialData?.isPublic ?? false;
        selectedLocationIds = initialData?.locationIds || [];
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
        if (!(remoteFunction as any).fields) return {};
        const parts = name.split(".");
        let current = (remoteFunction as any).fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }
</script>

<div class="max-w-3xl mx-auto px-4 py-8">
    <Breadcrumb
        feature="announcements"
        current={initialData?.title ?? "New Announcement"}
    />

    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">
            {isUpdating ? "Edit Announcement" : "New Announcement"}
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
                        itemName: "announcement",
                    });
                    goto("/announcements");
                }}
            >
                Delete
            </AsyncButton>
        {/if}
    </div>

    <form
        {...remoteFunction
            .preflight(validationSchema)
            .enhance(async ({ submit }: any) => {
                try {
                    const result: any = await submit();
                    if (result?.error) {
                        toast.error(
                            result.error.message ||
                                "Oh no! Something went wrong",
                        );
                        return;
                    }
                    toast.success("Successfully Saved!");
                    goto("/announcements");
                } catch (error: any) {
                    toast.error(
                        error?.message || "Oh no! Something went wrong",
                    );
                }
            })}
        class="space-y-6"
    >
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
                Basic Information
            </h2>

            <div>
                <label
                    for="title"
                    class="block text-sm font-medium text-gray-700 mb-1"
                >
                    Title <span class="text-red-500">*</span>
                </label>
                <input
                    {...getField("title").as("text")}
                    required
                    value={getField("title").value() ??
                        initialData?.title ??
                        ""}
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    placeholder="Announcement Title"
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
                    Content <span class="text-red-500">*</span>
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
                <TagInput bind:value={tagsString} />
            </div>

            <div>
                <EntityManager
                    title="Locations"
                    icon={MapPin}
                    {type}
                    entityId={initialData?.id}
                    initialItems={locations.filter((l: any) =>
                        selectedLocationIds.includes(l.id),
                    )}
                    onchange={(ids: string[]) => (selectedLocationIds = ids)}
                    embedded={true}
                    listItemsRemote={listLocations as any}
                    deleteItemRemote={async (id: string) => {
                        return await handleDelete({
                            ids: [id],
                            deleteFn: deleteLocation,
                            itemName: "location",
                        });
                    }}
                    createRemote={createLocation}
                    createSchema={createLocationSchema}
                    updateRemote={updateLocation}
                    updateSchema={updateLocationSchema}
                    getFormData={(l: Location) => l}
                    searchPredicate={(l: Location, q: string) => {
                        return (
                            l.name.toLowerCase().includes(q.toLowerCase()) ||
                            (l.roomId
                                ?.toLowerCase()
                                .includes(q.toLowerCase()) ??
                                false)
                        );
                    }}
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
                    >Make this announcement public</label
                >
            </div>
        </div>

        <EntityManager
            title="Contacts"
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
            deleteItemRemote={async (id: string) => {
                return await handleDelete({
                    ids: [id],
                    deleteFn: deleteExistingContact,
                    itemName: "contact",
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

        <div class="flex justify-end pt-4">
            <AsyncButton
                type="submit"
                loading={remoteFunction.pending}
                class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
                {isUpdating ? "Save Changes" : "Create Announcement"}
            </AsyncButton>
            <Button
                variant="secondary"
                href="/announcements"
                size="default"
                class="ml-3"
            >
                Cancel
            </Button>
        </div>
    </form>
</div>
