<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { type Snippet } from "svelte";

    import Button from "../button/button.svelte";
    import AsyncButton from "../AsyncButton.svelte";
    import ContactFields from "./ContactFields.svelte";

    export interface Props {
        initialData?: any;
        remoteFunction?: any;
        schema?: any;

        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        contactId?: string;
        loading?: boolean;

        tags?: string[];

        // Injected dependencies to keep it shared
        listContactsRemote: () => Promise<any[]>;
        // Optional snippet for additional sections
        children?: Snippet<[{ onLocationsChange: (ids: string[]) => void }]>;

        labels?: {
            basicInformation?: string;
            displayName?: string;
            givenName?: string;
            familyName?: string;
            birthday?: string;
            company?: string;
            department?: string;
            role?: string;
            notes?: string;
            isPublicLabel?: string;
            isPublicDescription?: string;
            tagsPlaceholder?: string;
            relations?: string;
            contactSearchPlaceholder?: string;
            emailAddresses?: string;
            addEmail?: string;
            emailPlaceholder?: string;
            home?: string;
            work?: string;
            mobile?: string;
            other?: string;
            primary?: string;
            phoneNumbers?: string;
            addPhone?: string;
            phonePlaceholder?: string;
            saveContact?: string;
            cancel?: string;
            saving?: string;
            errorSomethingWentWrong?: string;
            successfullySaved?: string;
            reportsTo?: string;
            cooperatesWith?: string;
            managerOf?: string;
            pleaseFixValidation?: string;
        };
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
        listContactsRemote,
        children,
        tags = $bindable(),
        labels,
    }: Props = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(typeof remoteFunction === "function" ? (remoteFunction as any)() : remoteFunction);

    const i18n = $derived({
        saveContact: labels?.saveContact ?? "Save Contact",
        cancel: labels?.cancel ?? "Cancel",
        saving: labels?.saving ?? "Saving...",
        errorSomethingWentWrong:
            labels?.errorSomethingWentWrong ?? "Oh no! Something went wrong",
        successfullySaved: labels?.successfullySaved ?? "Successfully Saved!",
        pleaseFixValidation: labels?.pleaseFixValidation ?? "Please fix the validation errors in the form.",
    });

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(i18n.pleaseFixValidation);
        }
        prevIssuesLength = issues.length;
    });

    const d = (val: any, def: any) =>
        val === undefined || val === null ? def : val;

    // svelte-ignore state_referenced_locally
    let locationIds = $state<string[]>(
        (initialData?.locationAssociations || []).map(
            (la: any) => la.locationId || la.location?.id,
        ),
    );
    const locationIdsJson = $derived(JSON.stringify(locationIds));

    // svelte-ignore state_referenced_locally
    let contactData = $state({
        displayName: d(initialData.contact?.displayName, ""),
        givenName: d(initialData.contact?.givenName, ""),
        familyName: d(initialData.contact?.familyName, ""),
        middleName: d(initialData.contact?.middleName, ""),
        honorificPrefix: d(initialData.contact?.honorificPrefix, ""),
        honorificSuffix: d(initialData.contact?.honorificSuffix, ""),
        company: d(initialData.contact?.company, ""),
        role: d(initialData.contact?.role, ""),
        department: d(initialData.contact?.department, ""),
        gender: d(initialData.contact?.gender, ""),
        birthday: d(
            initialData.contact?.birthday
                ? initialData.contact.birthday instanceof Date
                    ? initialData.contact.birthday.toISOString().split("T")[0]
                    : String(initialData.contact.birthday).split("T")[0]
                : "",
            "",
        ),
        notes: d(initialData.contact?.notes, ""),
        isPublic: d(initialData.contact?.isPublic, false),
    });

    // svelte-ignore state_referenced_locally
    let emails = $state([...d(initialData.emails, [])]);
    // svelte-ignore state_referenced_locally
    let phones = $state([...d(initialData.phones, [])]);
    // svelte-ignore state_referenced_locally
    let relations = $state([...d(initialData.relations, [])]);
    // svelte-ignore state_referenced_locally
    let addresses = $state([...d(initialData.addresses, [])]);
    // svelte-ignore state_referenced_locally
    let tagsInput = $state(
        (initialData.tags || tags || [])
            .map((t: any) => t.name || t)
            .join(", ") || (!contactId ? "Customer" : ""),
    );

    $effect(() => {
        if (initialData.tags) {
            tagsInput = initialData.tags.map((t: any) => t.name).join(", ");
        }
    });

    const emailsJson = $derived(JSON.stringify(emails.filter((e) => e.value)));
    const phonesJson = $derived(JSON.stringify(phones.filter((p) => p.value)));
    const relationsJson = $derived(JSON.stringify(relations));
    const addressesJson = $derived(
        JSON.stringify(addresses.filter((a) => a.street || a.city)),
    );
    const tagsJson = $derived(
        JSON.stringify(
            tagsInput
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );

    function getField(name: string) {
        const def = { as: () => ({}), issues: () => [], value: () => undefined };
        if (!(rf as any)?.fields) return def;
        const parts = name.split(".");
        let current: any = (rf as any).fields;
        for (const part of parts) {
            if (!current?.[part]) return def;
            current = current[part];
        }
        return current ?? def;
    }

    const prefix = $derived(contactId ? "data.contact" : "contact");
</script>

<form
    {...(rf as any).preflight(schema).enhance(async ({ submit }: { submit: any }) => {
        try {
            await submit();
            const result = (rf as any).result;
            if (result?.success === false || result?.error) {
                const msg =
                    result?.error?.message ||
                    result?.error ||
                    i18n.errorSomethingWentWrong;
                toast.error(msg);
                return;
            }

            toast.success(i18n.successfullySaved);
            if (onSuccess) onSuccess(result);
            else goto(cancelHref);
        } catch (error: any) {
            toast.error(error.message || i18n.errorSomethingWentWrong);
        }
    })}
    class="space-y-8"
>
    {#if contactId}
        <input {...getField("id").as("hidden", contactId)} />
    {/if}

    <input {...getField("emailsJson").as("hidden", emailsJson ?? "[]")} />
    <input {...getField("phonesJson").as("hidden", phonesJson ?? "[]")} />
    <input {...getField("relationsJson").as("hidden", relationsJson ?? "[]")} />
    <input {...getField("addressesJson").as("hidden", addressesJson ?? "[]")} />
    <input {...getField("tagsJson").as("hidden", tagsJson ?? "[]")} />

    <ContactFields
        bind:contactData
        bind:emails
        bind:phones
        bind:relations
        bind:tagsInput
        bind:locationIds
        bind:addresses
        {prefix}
        {contactId}
        {listContactsRemote}
        {labels}
        {getField}
    />

    {#if children}
        {@render children({
            onLocationsChange: (ids: string[]) => (locationIds = ids),
        })}
    {/if}

    <input {...getField("locationIdsJson").as("hidden", locationIdsJson)} />

    <div class="flex justify-end gap-3 pt-6 border-t">
        {#if onCancel}
            <Button variant="secondary" type="button" onclick={onCancel}
                >{i18n.cancel}</Button
            >
        {:else}
            <Button href={cancelHref} variant="secondary" type="button"
                >{i18n.cancel}</Button
            >
        {/if}
        <AsyncButton
            type="submit"
            loading={(rf && rf.pending) || loading}
            loadingLabel={i18n.saving}
        >
            {i18n.saveContact}
        </AsyncButton>
    </div>
</form>
