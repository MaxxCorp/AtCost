<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import SharedContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Location, type Contact } from "@ac/validations";

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
        children?: Snippet<[{ onLocationsChange: (ids: string[]) => void }]>;
    }

    let {
        initialData = {},
        remoteFunction,
        schema,
        onSuccess,
        onCancel,
        cancelHref = "/contacts",
        contactId,
        loading = false,
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
    }}
/>
