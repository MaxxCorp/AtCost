<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import SyncCheckboxBlock from "$lib/components/sync/SyncCheckboxBlock.svelte";
    import { toast } from "svelte-sonner";
    import { deleteAnnouncements as deleteAnnouncementAction } from "../../../routes/announcements/[id]/delete.remote";
    import { EntityManager, LocationManager, handleDelete, translateIssue, matchContactSearch } from "@ac/ui";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { listTags as listTagsRemote } from "../../../routes/tags/list.remote";
    import { createTag as createTagRemote } from "../../../routes/tags/new/create.remote";
    import { updateTag as updateTagRemote } from "../../../routes/tags/[id]/update.remote";
    import { deleteTag as deleteTagRemote } from "../../../routes/tags/[id]/delete.remote";
    import * as v from "valibot";


    import { Tag as TagIcon } from "@lucide/svelte";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { type Location } from "@ac/validations";

    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import {
        fetchEntityLocations,
        addLocationAssociation,
        removeLocationAssociation,
    } from "../../../routes/locations/associate.remote";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Contact } from "@ac/validations";

    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../../routes/contacts/associate.remote";
    import { createContact } from "../../../routes/contacts/new/create.remote";
    import { updateContact } from "../../../routes/contacts/[id]/update.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "@ac/validations";
    import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";
    import { onMount, untrack } from "svelte";
    import { MapPin, User } from "@lucide/svelte";

    import RichTextEditor from "$lib/components/cms/RichTextEditor.svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
    } = $props();

    // Initialize form state
    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);

    const type = "announcement";


    // svelte-ignore state_referenced_locally
    let tagsString = $state(
        untrack(() => isUpdating && initialData?.tags
            ? initialData.tags.map((t: any) => t.name).join(", ")
            : "News")
    );
    // svelte-ignore state_referenced_locally
    let selectedContactIds = $state<string[]>(untrack(() => initialData?.contactIds || []));
    // svelte-ignore state_referenced_locally
    let isPublic = $state(untrack(() => initialData?.isPublic ?? false));
    // svelte-ignore state_referenced_locally
    let selectedLocationIds = $state<string[]>(untrack(() => initialData?.locationIds || []));




    // Derived JSON for submission
    let tagNamesJson = $derived(
        JSON.stringify(
            tagsString
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );



    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });
</script>

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

    <form {...rf.enhance(async ({ submit }: { submit: any }) => {
        try {
            const result = await submit();
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
    })} class="space-y-6">
        {#if isUpdating && initialData?.id}
            <input {...rf.fields.id.as("text", initialData.id)} class="hidden" />
        {/if}

        <input {...rf.fields.isPublic.as("text", isPublic.toString())} class="hidden" />
        <!-- Send tagNames as JSON string -->
        <input {...rf.fields.tagNames.as("text", tagNamesJson)} class="hidden" />
        <!-- We no longer strictly need tagIds for submission if using names -->

        <input
            {...rf.fields.contactIds.as(
                "text",
                JSON.stringify(selectedContactIds),
            )}
            class="hidden"
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
                    {...rf.fields.title.as("text", initialData?.title ?? "")}
                    required
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    placeholder={m.announcement_title_placeholder()}
                />
                {#each (rf.fields.title.issues() ?? []) as issue}
                    <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
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
                    <RichTextEditor 
                        value={rf.fields.content.value() ?? initialData?.content ?? ""}
                        onchange={(v) => rf.fields.content.set(v)}
                    />
                    {#if (rf.fields.content.value() ?? initialData?.content) !== undefined && (rf.fields.content.value() ?? initialData?.content) !== null}
                        <input
                            {...rf.fields.content.as("text", initialData?.content ?? "")}
                            class="hidden"
                        />
                    {/if}
                </div>
                {#each (rf.fields.content.issues() ?? []) as issue}
                    <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
                {/each}
            </div>

            <div>
                <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
                    <TagIcon size={18} class="text-blue-600" />
                    {m.tags()}
                </h3>
                {#key initialData?.id || "new"}
                    <EntityManager {m}
                        title={m.tags()}
                        icon={TagIcon}
                        mode="embedded"
                        initialItems={initialData?.tags || []}
                        listItemsRemote={listTagsRemote}
                        onchange={(ids: any, items: any[]) => {
                            tagsString = items.map((i) => i.name).join(", ");
                        }}
                        deleteItemRemote={deleteTagRemote}
                        createRemote={createTagRemote}
                        createSchema={v.object({
                            name: v.pipe(v.string(), v.minLength(1)),
                        })}
                        updateRemote={updateTagRemote}
                        updateSchema={v.object({
                            name: v.pipe(v.string(), v.minLength(1)),
                        })}
                        getFormData={(t: any) => t}
                        searchPredicate={(t: any, q: string) =>
                            t.name.toLowerCase().includes(q.toLowerCase())}
                        loadingLabel={m.loading_item({ item: m.tags() })}
                        noItemsLabel={m.no_items_associated_label({
                            item: m.tags(),
                        })}
                        noItemsFoundLabel={m.no_items_found({ item: m.tags() })}
                        searchPlaceholder={m.search_placeholder({
                            item: m.tags(),
                        })}
                        linkItemLabel={m.link_item_label({ item: m.tags() })}
                        associatedItemLabel={m.associated_item_label({
                            item: m.tags(),
                        })}
                        quickCreateLabel={m.quick_create()}
                        closeSearchLabel={m.close_search()}
                        editLabel={m.edit()}
                        deleteLabel={m.delete()}
                        unlinkLabel={m.unlink()}
                        selectAllLabel={m.select_all()}
                        deselectAllLabel={m.deselect_all()}
                    >
                        {#snippet renderItemLabel(tag: any)}
                            {tag.name}
                        {/snippet}
                        {#snippet renderForm({
                            remoteFunction,
                            schema,
                            initialData: formData,
                            onSuccess,
                            onCancel,
                            id,
                        }: any)}
                            {@const rfState = remoteFunction.preflight(schema)}
                            <form
                                {...rfState.enhance(
                                    async ({ submit }: { submit: any }) => {
                                        try {
                                            const res = await submit();
                                            if (res && res.success !== false) {
                                                onSuccess(res);
                                            }
                                        } catch (err) {
                                            console.error(
                                                "[AnnouncementForm] Quick Create Error:",
                                                err,
                                            );
                                        }
                                    },
                                )}
                                class="space-y-4 p-4"
                            >
                                {#if id && rfState.fields?.id}
                                    <input
                                        {...rfState.fields.id.as("text", id)}
                                        class="hidden"
                                    />
                                {/if}
                                <div>
                                    <label
                                        for="tag-name"
                                        class="block text-sm font-medium text-gray-700"
                                        >{m.summary()}</label
                                    >
                                    <input
                                        {...rfState.fields.name.as("text")}
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={formData?.name ?? ""}
                                    />
                                    {#each (rfState.fields.name.issues() ?? []) as issue}
                                        <p class="mt-1 text-sm text-red-600">
                                            {translateIssue(issue.message, m)}
                                        </p>
                                    {/each}
                                </div>
                                <div
                                    class="flex justify-end gap-2 pt-4 border-t"
                                >
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onclick={onCancel}
                                        >{m.cancel()}</Button
                                    >
                                    <AsyncButton
                                        type="submit"
                                        loading={rfState.pending}
                                    >
                                        {id
                                            ? m.save_changes()
                                            : m.create_item({ item: "Tag" })}
                                    </AsyncButton>
                                </div>
                            </form>
                        {/snippet}
                    </EntityManager>
                {/key}
            </div>

            <div>
                {#await listLocations()}
                    <div
                        class="p-4 border border-dashed rounded-lg text-sm text-gray-500 text-center"
                    >
                        {m.loading_item({ item: m.locations() })}
                    </div>
                {:then locs}
                    <h3
                        class="text-lg font-semibold mb-2 flex items-center gap-2"
                    >
                        <MapPin size={18} class="text-blue-600" />
                        {m.locations()}
                    </h3>
                    {#key initialData?.id || "new"}
                        <LocationManager {m}
                            {type}
                            entityId={initialData?.id}
                            initialItems={locs.data.filter((l: any) =>
                                selectedLocationIds.includes(l.id),
                            )}
                            onchange={(ids: string[]) =>
                                (selectedLocationIds = ids)}
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
                        />
                    {/key}
                {:catch error}
                    <div
                        class="p-4 border border-dashed rounded-lg text-sm text-red-500 text-center"
                    >
                        {error.message || m.something_went_wrong()}
                    </div>
                {/await}
                <input
                    {...rf.fields.locationIds.as(
                        "text",
                        JSON.stringify(selectedLocationIds),
                    )}
                    class="hidden"
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

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
                <User size={18} class="text-blue-600" />
                {m.contacts()}
            </h3>
            {#key initialData?.id || "new"}
                <EntityManager {m}
                    title={m.contacts()}
                    icon={User}
                    mode="embedded"
                    {type}
                    entityId={initialData?.id}
                    onchange={(ids: string[]) => (selectedContactIds = ids)}
                    listItemsRemote={listContacts as any}
                    fetchAssociationsRemote={fetchEntityContacts as any}
                    addAssociationRemote={async (p: any) =>
                        addAssociation({ ...p, contactId: p.itemId } as any)}
                    removeAssociationRemote={async (p: any) =>
                        removeAssociation({ ...p, contactId: p.itemId } as any)}
                    deleteItemRemote={async (ids: string[]) => {
                        return await handleDelete({
                            ids,
                            deleteFn: deleteContact,
                            itemName: m.contact().toLowerCase(),
                        });
                    }}
                    createRemote={createContact}
                    createSchema={createContactSchema}
                    updateRemote={updateContact}
                    updateSchema={updateContactSchema}
                    getFormData={(c: Contact) => ({
                        contact: c,
                        emails: c.emails,
                        phones: c.phones,
                        addresses: c.addresses,
                        relations: c.relations,
                        tags: c.tags,
                    })}
                    searchPredicate={matchContactSearch}
                    loadingLabel={m.loading_item({ item: m.contacts() })}
                    noItemsLabel={m.no_items_associated_label({
                        item: m.contacts(),
                    })}
                    noItemsFoundLabel={m.no_items_found({ item: m.contacts() })}
                    searchPlaceholder={m.search_placeholder({
                        item: m.contacts(),
                    })}
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
                    confirmUnlinkLabel={m.confirm_unlink_label({
                        item: m.contact(),
                    })}
                >
                    {#snippet renderItemLabel(contact: any)}
                        {contact.displayName ||
                            `${contact.givenName || ""} ${contact.familyName || ""}`.trim() ||
                            contact.company ||
                            m.unnamed_contact()}
                    {/snippet}
                    {#snippet renderForm({
                        remoteFunction: rf,
                        schema,
                        initialData: formData,
                        onSuccess,
                        onCancel,
                        id,
                    }: any)}
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
            {/key}
    </div>

        <SyncCheckboxBlock
            syncFieldConfig={rf.fields.syncIds}
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
