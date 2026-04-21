<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import SharedContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Location, type Contact } from "@ac/validations";
    import { listTags as listTagsRoute } from "../../../routes/tags/list.remote";
    import { createTag as createTagRoute } from "../../../routes/tags/new/create.remote";
    import { updateTag as updateTagRoute } from "../../../routes/tags/[id]/update.remote";
    import { deleteTag as deleteTagRoute } from "../../../routes/tags/[id]/delete.remote";

    import type { Snippet } from "svelte";

    interface Props {
        initialData?: any;
        remoteFunction?: any;
        schema?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        contactId?: string;
        loading?: boolean;
        listTagsRemote?: any;
        createTagRemote?: any;
        updateTagRemote?: any;
        deleteTagRemote?: any;
        children?: Snippet<[{ onLocationsChange: (ids: string[]) => void }]>;
    }

    const listTagsHandle = listTagsRoute;
    const createTagHandle = createTagRoute;
    const updateTagHandle = updateTagRoute;
    const deleteTagHandle = deleteTagRoute;

    let {
        initialData = {},
        remoteFunction,
        schema,
        onSuccess,
        onCancel,
        cancelHref = "/contacts",
        contactId,
        loading = false,
        listTagsRemote = listTagsHandle,
        createTagRemote = createTagHandle,
        updateTagRemote = updateTagHandle,
        deleteTagRemote = deleteTagHandle,
        children,
    }: Props = $props();
</script>

<SharedContactForm
    {initialData}
    {remoteFunction}
    {schema}
    {onSuccess}
    {onCancel}
    {cancelHref}
    {contactId}
    {loading}
    {children}
    listContactsRemote={listContacts as any}
    labels={{
        basicInformation: m.basic_information(),
        displayName: m.display_name(),
        givenName: m.given_name(),
        familyName: m.family_name(),
        birthday: m.birthday(),
        company: m.company(),
        department: m.department(),
        role: m.role(),
        notes: m.notes(),
        isPublicLabel: m.public_profile(),
        isPublicDescription: m.public_profile_description(),
        tagsPlaceholder: m.tag_placeholder(),
        relations: m.relations(),
        contactSearchPlaceholder: m.search_contact_to_link(),
        emailAddresses: m.email_addresses(),
        addEmail: m.add_email(),
        emailPlaceholder: m.email_address(),
        home: m.home_label(),
        work: m.work_label(),
        mobile: m.mobile_label(),
        other: m.other_label(),
        primary: m.primary(),
        phoneNumbers: m.phone_numbers(),
        addPhone: m.add_phone(),
        phonePlaceholder: m.phone_number(),
        saveContact: m.save_contact(),
        cancel: m.cancel(),
        saving: m.loading(),
        errorSomethingWentWrong: m.something_went_wrong(),
        successfullySaved: m.successfully_saved(),
        reportsTo: m.reports_to(),
        cooperatesWith: m.cooperates_with(),
        managerOf: m.manager_of(),
        tags: m.tags(),
        linkTag: m.link_item_label({ item: m.tags() }),
        associatedTags: m.associated_item_label({ item: m.tags() }),
        searchTags: m.search_placeholder({ item: m.tags() }),
        noTags: m.no_items_associated_label({ item: m.tags() }),
        quickCreateTag: m.quick_create(),
        tag: "tag",
    }}
    {listTagsRemote}
    {createTagRemote}
    {updateTagRemote}
    {deleteTagRemote}
/>
