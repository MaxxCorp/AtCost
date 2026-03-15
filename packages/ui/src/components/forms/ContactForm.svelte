<script lang="ts">
    import {
        Plus,
        Trash2,
        Mail,
        Phone,
        MapPin,
        Link as LinkIcon,
        User,
        Search,
    } from "@lucide/svelte";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { onMount, type Snippet } from "svelte";

    import Button from "../button/button.svelte";
    import AsyncButton from "../AsyncButton.svelte";
    import TagInput from "../TagInput.svelte";

    interface Props {
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

    const i18n = $derived({
        basicInformation: labels?.basicInformation ?? "Basic Information",
        displayName: labels?.displayName ?? "Display Name",
        givenName: labels?.givenName ?? "Given Name",
        familyName: labels?.familyName ?? "Family Name",
        birthday: labels?.birthday ?? "Birthday",
        company: labels?.company ?? "Company",
        department: labels?.department ?? "Department",
        role: labels?.role ?? "Role",
        notes: labels?.notes ?? "Notes",
        isPublicLabel: labels?.isPublicLabel ?? "Public Profile",
        isPublicDescription: labels?.isPublicDescription ?? "Allow unauthenticated viewing",
        tagsPlaceholder: labels?.tagsPlaceholder ?? "e.g. Customer, Lead, Priority",
        relations: labels?.relations ?? "Relations",
        contactSearchPlaceholder: labels?.contactSearchPlaceholder ?? "Search for a contact to link...",
        emailAddresses: labels?.emailAddresses ?? "Email Addresses",
        addEmail: labels?.addEmail ?? "Add Email",
        emailPlaceholder: labels?.emailPlaceholder ?? "Email Address",
        home: labels?.home ?? "Home",
        work: labels?.work ?? "Work",
        mobile: labels?.mobile ?? "Mobile",
        other: labels?.other ?? "Other",
        primary: labels?.primary ?? "Primary",
        phoneNumbers: labels?.phoneNumbers ?? "Phone Numbers",
        addPhone: labels?.addPhone ?? "Add Phone",
        phonePlaceholder: labels?.phonePlaceholder ?? "Phone Number",
        saveContact: labels?.saveContact ?? "Save Contact",
        cancel: labels?.cancel ?? "Cancel",
        saving: labels?.saving ?? "Saving...",
        errorSomethingWentWrong: labels?.errorSomethingWentWrong ?? "Oh no! Something went wrong",
        successfullySaved: labels?.successfullySaved ?? "Successfully Saved!",
        reportsTo: labels?.reportsTo ?? "reports to",
        cooperatesWith: labels?.cooperatesWith ?? "cooperates with",
        managerOf: labels?.managerOf ?? "manager of",
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
        company: d(initialData.contact?.company, ""),
        role: d(initialData.contact?.role, ""),
        department: d(initialData.contact?.department, ""),
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
    let tagsInput = $state(
        (initialData.tags || tags || [])
            .map((t: any) => t.name || t)
            .join(", ") || (!contactId ? "Customer" : ""),
    );
    let contactSearch = $state("");
    let allContacts = $state<any[]>([]);

    let filteredContacts = $derived(
        contactSearch.length > 1
            ? allContacts.filter(
                  (c) =>
                      c.id !== contactId &&
                      (c.displayName
                          ?.toLowerCase()
                          .includes(contactSearch.toLowerCase()) ||
                          c.givenName
                              ?.toLowerCase()
                              .includes(contactSearch.toLowerCase()) ||
                          c.familyName
                              ?.toLowerCase()
                              .includes(contactSearch.toLowerCase()) ||
                          (c.email &&
                              c.email
                                  .toLowerCase()
                                  .includes(contactSearch.toLowerCase()))),
              )
            : [],
    );

    onMount(async () => {
        try {
            allContacts = await listContactsRemote();
        } catch (e) {
            console.error("Failed to load contacts for relations", e);
        }
    });

    $effect(() => {
        if (initialData.tags) {
            tagsInput = initialData.tags.map((t: any) => t.name).join(", ");
        }
    });

    function addEmail() {
        emails = [...emails, { value: "", type: "work", primary: false }];
    }
    function removeEmail(index: number) {
        emails = emails.filter((_, i) => i !== index);
    }

    function addPhone() {
        phones = [...phones, { value: "", type: "mobile", primary: false }];
    }
    function removePhone(index: number) {
        phones = phones.filter((_, i) => i !== index);
    }

    function addRelation(targetContact: any) {
        if (relations.find((r: any) => r.targetContactId === targetContact.id))
            return;
        relations = [
            ...relations,
            {
                targetContactId: targetContact.id,
                relationType: i18n.cooperatesWith,
                targetContact,
            },
        ];
        contactSearch = "";
    }

    function removeRelation(index: number) {
        relations = relations.filter((_, i) => i !== index);
    }

    const emailsJson = $derived(JSON.stringify(emails.filter((e) => e.value)));
    const phonesJson = $derived(JSON.stringify(phones.filter((p) => p.value)));
    const relationsJson = $derived(JSON.stringify(relations));
    const tagsJson = $derived(
        JSON.stringify(
            tagsInput
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );

    function getField(name: string) {
        if (!remoteFunction?.fields) return {};
        const parts = name.split(".");
        let current: any = remoteFunction.fields;
        for (const part of parts) {
            if (!current?.[part]) return {};
            current = current[part];
        }
        return current;
    }

    const prefix = $derived(contactId ? "data.contact" : "contact");
</script>

<form
    {...remoteFunction.preflight(schema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = (remoteFunction as any).result;
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
    <input {...getField("tagsJson").as("hidden", tagsJson ?? "[]")} />

    <div class="space-y-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
            <User size={20} class="text-blue-500" />
            {i18n.basicInformation}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label
                    for="displayName"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.displayName} <span class="text-red-500">*</span></label
                >
                <input
                    {...getField(`${prefix}.displayName`).as("text")}
                    bind:value={contactData.displayName}
                    class="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                />
            </div>
            <div>
                <label
                    for="givenName"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.givenName}</label
                >
                <input
                    {...getField(`${prefix}.givenName`).as("text")}
                    bind:value={contactData.givenName}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="familyName"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.familyName}</label
                >
                <input
                    {...getField(`${prefix}.familyName`).as("text")}
                    bind:value={contactData.familyName}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="birthday"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.birthday}</label
                >
                <input
                    {...getField(`${prefix}.birthday`).as("date")}
                    bind:value={contactData.birthday}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="company"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.company}</label
                >
                <input
                    {...getField(`${prefix}.company`).as("text")}
                    bind:value={contactData.company}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="department"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.department}</label
                >
                <input
                    {...getField(`${prefix}.department`).as("text")}
                    bind:value={contactData.department}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="role"
                    class="block text-sm font-medium text-gray-700">{i18n.role}</label
                >
                <input
                    {...getField(`${prefix}.role`).as("text")}
                    bind:value={contactData.role}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
        <div>
            <label for="notes" class="block text-sm font-medium text-gray-700"
                >{i18n.notes}</label
            >
            <textarea
                {...getField(`${prefix}.notes`).as("textarea")}
                bind:value={contactData.notes}
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-2">
            <input
                {...getField(`${prefix}.isPublic`).as("checkbox")}
                checked={contactData.isPublic}
                onchange={(e) =>
                    (contactData.isPublic = e.currentTarget.checked)}
                class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label for="isPublic" class="text-sm font-medium text-gray-700">
                {i18n.isPublicLabel} ({i18n.isPublicDescription})
            </label>
        </div>

        <div>
            <TagInput
                bind:value={tagsInput}
                placeholder={i18n.tagsPlaceholder}
            />
        </div>
    </div>

    <div class="space-y-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
            <LinkIcon size={20} class="text-pink-500" />
            {i18n.relations}
        </h3>

        <div class="space-y-4">
            <div class="relative">
                <div
                    class="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500"
                >
                    <Search size={18} class="text-gray-400" />
                    <input
                        type="text"
                        placeholder={i18n.contactSearchPlaceholder}
                        bind:value={contactSearch}
                        class="flex-1 outline-none"
                    />
                </div>

                {#if filteredContacts.length > 0}
                    <div
                        class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                    >
                        {#each filteredContacts as c}
                            <button
                                type="button"
                                class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                                onclick={() => addRelation(c)}
                            >
                                <span
                                    >{c.displayName ||
                                        `${c.givenName || ""} ${c.familyName || ""}`.trim()}</span
                                >
                                <Plus size={14} class="text-gray-400" />
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if relations.length > 0}
                <div class="space-y-2">
                    {#each relations as rel, i}
                        <div
                            class="flex items-center gap-2 bg-gray-50 p-2 rounded-md border border-gray-100"
                        >
                            <div class="flex-1 text-sm">
                                <span class="font-medium">
                                    {rel.targetContact?.displayName ||
                                        `${rel.targetContact?.givenName || ""} ${rel.targetContact?.familyName || ""}`.trim() ||
                                        rel.targetContactId}
                                </span>
                            </div>
                            <div class="w-48">
                                <select
                                    bind:value={rel.relationType}
                                    class="block w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="reports to"
                                        >{i18n.reportsTo}</option
                                    >
                                    <option value="cooperates with"
                                        >{i18n.cooperatesWith}</option
                                    >
                                    <option value="manager of"
                                        >{i18n.managerOf}</option
                                    >
                                    <option value="other">{i18n.other}</option>
                                </select>
                            </div>
                            <AsyncButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="text-red-500"
                                onclick={() => removeRelation(i)}
                            >
                                <Trash2 size={16} />
                            </AsyncButton>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="space-y-4">
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium flex items-center gap-2">
                <Mail size={20} class="text-green-500" />
                {i18n.emailAddresses}
            </h3>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addEmail}
            >
                <Plus size={16} class="mr-1" /> {i18n.addEmail}
            </Button>
        </div>
        {#each emails as email, i}
            <div class="flex gap-2 items-end">
                <div class="flex-1">
                    <input
                        type="email"
                        placeholder={i18n.emailPlaceholder}
                        bind:value={email.value}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div class="w-32">
                    <select
                        onclick={addEmail}
                    >
                        <option value="home">{i18n.home}</option>
                        <option value="work">{i18n.work}</option>
                        <option value="other">{i18n.other}</option>
                    </select>
                </div>
                <label class="flex items-center gap-1 mb-2">
                    <input
                        type="checkbox"
                        bind:checked={email.primary}
                        class="rounded text-blue-600"
                    />
                    <span class="text-sm text-gray-500">{i18n.primary}</span>
                </label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="text-red-500 mb-1"
                    onclick={() => removeEmail(i)}
                >
                    <Trash2 size={16} />
                </Button>
            </div>
        {/each}
    </div>

    <div class="space-y-4">
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium flex items-center gap-2">
                <Phone size={20} class="text-purple-500" />
                {i18n.phoneNumbers}
            </h3>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addPhone}
            >
                <Plus size={16} class="mr-1" /> {i18n.addPhone}
            </Button>
        </div>
        {#each phones as phone, i}
            <div class="flex gap-2 items-end">
                <div class="flex-1">
                    <input
                        type="text"
                        placeholder={i18n.phonePlaceholder}
                        bind:value={phone.value}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div class="w-32">
                    <select
                        bind:value={phone.type}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="mobile">{i18n.mobile}</option>
                        <option value="home">{i18n.home}</option>
                        <option value="work">{i18n.work}</option>
                        <option value="other">{i18n.other}</option>
                    </select>
                </div>
                <label class="flex items-center gap-1 mb-2">
                    <input
                        type="checkbox"
                        bind:checked={phone.primary}
                        class="rounded text-blue-600"
                    />
                    <span class="text-sm text-gray-500">{i18n.primary}</span>
                </label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="text-red-500 mb-1"
                    onclick={() => removePhone(i)}
                >
                    <Trash2 size={16} />
                </Button>
            </div>
        {/each}
    </div>

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
            loading={(remoteFunction && remoteFunction.pending) || loading}
            loadingLabel={i18n.saving}
        >
            {i18n.saveContact}
        </AsyncButton>
    </div>
</form>
