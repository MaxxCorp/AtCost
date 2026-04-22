<script lang="ts">
    import {
        Plus,
        Trash2,
        Mail,
        Phone,
        Link as LinkIcon,
        User,
        Search,
        MapPin,
    } from "@lucide/svelte";
    import { onMount, type Snippet } from "svelte";

    import Button from "../button/button.svelte";
    import AsyncButton from "../AsyncButton.svelte";
    import EntityManager from "../EntityManager.svelte";
    import { Tag as TagIcon } from "@lucide/svelte";
    import { handleDelete } from "../../hooks/handleDelete.svelte";

    interface Props {
        // Bindable state
        contactData: {
            displayName: string;
            givenName: string;
            familyName: string;
            middleName?: string;
            honorificPrefix?: string;
            honorificSuffix?: string;
            company: string;
            role: string;
            department: string;
            birthday: string;
            gender?: string;
            notes: string;
            isPublic: boolean;
        };
        emails: any[];
        phones: any[];
        relations: any[];
        tagsInput: string;
        locationIds: string[];
        addresses: any[];

        // Configuration
        prefix?: string;
        contactId?: string;
        listContactsRemote: () => Promise<any[]>;
        
        // Tags Configuration
        listTagsRemote?: any;
        createTagRemote?: any;
        deleteTagRemote?: any;
        updateTagRemote?: any;
        createTagSchema?: any;
        updateTagSchema?: any;
        initialTags?: any[];

        labels?: any;
        getField?: (name: string) => any;
        onEmailChange?: () => void;
    }

    let {
        contactData = $bindable(),
        emails = $bindable(),
        phones = $bindable(),
        relations = $bindable(),
        tagsInput = $bindable(),
        locationIds = $bindable(),
        addresses = $bindable(),
        prefix = "contact",
        contactId,
        listContactsRemote,

        listTagsRemote,
        createTagRemote,
        deleteTagRemote,
        updateTagRemote,
        createTagSchema,
        updateTagSchema,
        initialTags = [],

        labels,
        getField,
        onEmailChange,
    }: Props = $props();

    const i18n = $derived({
        summary: labels?.summary ?? "Name",
        tags: labels?.tags ?? "Tags",
        linkTag: labels?.linkTag ?? "Link Tag",
        associatedTags: labels?.associatedTags ?? "Associated Tags",
        searchTags: labels?.searchTags ?? "Search tags...",
        noTags: labels?.noTags ?? "No tags linked yet.",
        quickCreateTag: labels?.quickCreateTag ?? "Quick Create Tag",
        tag: labels?.tag ?? "Tag",
        basicInformation: labels?.basicInformation ?? "Basic Information",
        displayName: labels?.displayName ?? "Display Name",
        givenName: labels?.givenName ?? "Given Name",
        middleName: labels?.middleName ?? "Middle Name",
        familyName: labels?.familyName ?? "Family Name",
        honorificPrefix: labels?.honorificPrefix ?? "Prefix",
        honorificSuffix: labels?.honorificSuffix ?? "Suffix",
        birthday: labels?.birthday ?? "Birthday",
        gender: labels?.gender ?? "Gender",
        company: labels?.company ?? "Company",
        department: labels?.department ?? "Department",
        role: labels?.role ?? "Role",
        notes: labels?.notes ?? "Notes",
        isPublicLabel: labels?.isPublicLabel ?? "Make this contact public",
        isPublicDescription:
            labels?.isPublicDescription ??
            "Public contacts are visible to all users.",
        tagsPlaceholder: labels?.tagsPlaceholder ?? "Add tags...",
        relations: labels?.relations ?? "Relations",
        contactSearchPlaceholder:
            labels?.contactSearchPlaceholder ?? "Search for a contact...",
        emailAddresses: labels?.emailAddresses ?? "Email Addresses",
        addEmail: labels?.addEmail ?? "Add Email",
        emailPlaceholder: labels?.emailPlaceholder ?? "email@example.com",
        home: labels?.home ?? "Home",
        work: labels?.work ?? "Work",
        mobile: labels?.mobile ?? "Mobile",
        other: labels?.other ?? "Other",
        primary: labels?.primary ?? "Primary",
        phoneNumbers: labels?.phoneNumbers ?? "Phone Numbers",
        addPhone: labels?.addPhone ?? "Add Phone",
        phonePlaceholder: labels?.phonePlaceholder ?? "+1 (555) 000-0000",
        reportsTo: labels?.reportsTo ?? "Reports To",
        cooperatesWith: labels?.cooperatesWith ?? "Cooperates With",
        managerOf: labels?.managerOf ?? "Manager Of",
        addresses: labels?.addresses ?? "Addresses",
        addAddress: labels?.addAddress ?? "Add Address",
        street: labels?.street ?? "Street",
        houseNumber: labels?.houseNumber ?? "House No.",
        zip: labels?.zip ?? "ZIP Code",
        city: labels?.city ?? "City",
        state: labels?.state ?? "State/Province",
        country: labels?.country ?? "Country",
        addressType: labels?.addressType ?? "Address Type",
    });

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
            const res: any = await listContactsRemote();
            allContacts = res?.data ?? res ?? [];
        } catch (e) {
            console.error("Failed to load contacts for relations", e);
        }
    });

    function addEmail() {
        emails = [...emails, { value: "", type: "work", primary: false }];
        onEmailChange?.();
    }
    function removeEmail(index: number) {
        emails = emails.filter((_, i) => i !== index);
        onEmailChange?.();
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
    function addAddress() {
        addresses = [...addresses, { street: "", houseNumber: "", zip: "", city: "", state: "", country: "", type: "home", primary: false }];
    }
    function removeAddress(index: number) {
        addresses = addresses.filter((_, i) => i !== index);
    }
</script>

<div class="space-y-8">
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
                    {...getField?.(`${prefix}.displayName`).as("text")}
                    name={`${prefix}.displayName`}
                    type="text"
                    bind:value={contactData.displayName}
                    required
                    class="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 {(getField?.(`${prefix}.displayName`).issues()?.length ?? 0) > 0 ? 'border-red-500' : 'border-gray-300'}"
                />
                {#each getField?.(`${prefix}.displayName`).issues() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                {/each}
            </div>
            <div>
                <label
                    for="givenName"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.givenName}</label
                >
                <input
                    {...getField?.(`${prefix}.givenName`).as("text")}
                    name={`${prefix}.givenName`}
                    type="text"
                    bind:value={contactData.givenName}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="middleName"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.middleName}</label
                >
                <input
                    {...getField?.(`${prefix}.middleName`).as("text")}
                    name={`${prefix}.middleName`}
                    type="text"
                    bind:value={contactData.middleName}
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
                    {...getField?.(`${prefix}.familyName`).as("text")}
                    name={`${prefix}.familyName`}
                    type="text"
                    bind:value={contactData.familyName}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="honorificPrefix"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.honorificPrefix}</label
                >
                <input
                    {...getField?.(`${prefix}.honorificPrefix`).as("text")}
                    name={`${prefix}.honorificPrefix`}
                    type="text"
                    bind:value={contactData.honorificPrefix}
                    placeholder="e.g. Dr., Prof."
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="honorificSuffix"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.honorificSuffix}</label
                >
                <input
                    {...getField?.(`${prefix}.honorificSuffix`).as("text")}
                    name={`${prefix}.honorificSuffix`}
                    type="text"
                    bind:value={contactData.honorificSuffix}
                    placeholder="e.g. PhD, MD"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label
                    for="gender"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.gender}</label
                >
                <select
                    {...getField?.(`${prefix}.gender`).as("select")}
                    name={`${prefix}.gender`}
                    bind:value={contactData.gender}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div>
                <label
                    for="birthday"
                    class="block text-sm font-medium text-gray-700"
                    >{i18n.birthday}</label
                >
                <input
                    {...getField?.(`${prefix}.birthday`).as("date")}
                    name={`${prefix}.birthday`}
                    type="date"
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
                    {...getField?.(`${prefix}.company`).as("text")}
                    name={`${prefix}.company`}
                    type="text"
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
                    {...getField?.(`${prefix}.department`).as("text")}
                    name={`${prefix}.department`}
                    type="text"
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
                    {...getField?.(`${prefix}.role`).as("text")}
                    name={`${prefix}.role`}
                    type="text"
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
                {...getField?.(`${prefix}.notes`).as("textarea")}
                name={`${prefix}.notes`}
                bind:value={contactData.notes}
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-2">
            <input
                {...getField?.(`${prefix}.isPublic`).as("checkbox")}
                name={`${prefix}.isPublic`}
                type="checkbox"
                bind:checked={contactData.isPublic}
                class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label for="isPublic" class="text-sm font-medium text-gray-700">
                {i18n.isPublicLabel} ({i18n.isPublicDescription})
            </label>
        </div>

        {#if listTagsRemote}
            <div>
                <h3 class="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <TagIcon size={16} class="text-indigo-500" />
                    {labels?.tags ?? "Tags"}
                </h3>
                <EntityManager
                    title={labels?.tags ?? "Tag"}
                    icon={TagIcon}
                    mode="embedded"
                    initialItems={initialTags}
                    listItemsRemote={listTagsRemote}
                    onchange={(ids, items) => {
                        tagsInput = items.map(i => i.name || i).join(", ");
                    }}
                    createRemote={createTagRemote}
                    createSchema={createTagSchema}
                    updateRemote={updateTagRemote}
                    updateSchema={updateTagSchema}
                    deleteItemRemote={deleteTagRemote ? async (ids: string[]) => {
                        return await handleDelete({
                            ids,
                            deleteFn: deleteTagRemote,
                            itemName: labels?.tag ?? "tag",
                        });
                    } : undefined}
                    getFormData={(t: any) => t}
                    searchPredicate={(t: any, q: string) => t.name.toLowerCase().includes(q.toLowerCase())}
                    linkItemLabel={labels?.linkTag ?? "Link Tag"}
                    associatedItemLabel={labels?.associatedTags ?? "Associated Tags"}
                    searchPlaceholder={labels?.searchTags ?? "Search tags..."}
                    noItemsLabel={labels?.noTags ?? "No tags associated."}
                    quickCreateLabel={labels?.quickCreateTag ?? "Quick Create Tag"}
                >
                    {#snippet renderItemLabel(tag)}
                        {tag.name}
                    {/snippet}
                    {#snippet renderForm({ remoteFunction: state, schema, initialData: formData, onSuccess, onCancel, id })}
                        <form
                            {...state.preflight(schema).enhance(async ({ submit }: { submit: any }) => {
                                try {
                                    const res = await submit();
                                    if (res && res.success !== false) {
                                        onSuccess(res);
                                    }
                                } catch (err) {
                                    console.error("[ContactFields] Tag Quick Create Error:", err);
                                }
                            })}
                            class="space-y-4 p-4"
                        >
                            {#if id && state.fields?.id}
                                <input {...state.fields.id.as("hidden", id)} />
                            {/if}
                            <div>
                                <label for="tag-name" class="block text-sm font-medium text-gray-700">{i18n.summary}</label>
                                <input 
                                    {...state.fields.name.as("text")}
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={formData?.name ?? ""}
                                />
                                {#each state.fields.name.issues() as issue}
                                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                                {/each}
                            </div>
                            <div class="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onclick={onCancel}>Cancel</Button>
                                <AsyncButton 
                                    type="submit" 
                                    loading={state.pending}
                                >
                                    {id ? "Update" : "Create"}
                                </AsyncButton>
                            </div>
                        </form>
                    {/snippet}
                </EntityManager>
            </div>
        {:else}
            <div>
                <label
                    for="tags-input"
                    class="block text-sm font-medium text-gray-700 flex items-center gap-2 mb-1"
                >
                    <TagIcon size={16} class="text-indigo-500" />
                    {labels?.tags ?? "Tags"}
                </label>
                <input
                    type="text"
                    id="tags-input"
                    bind:value={tagsInput}
                    placeholder={i18n.tagsPlaceholder}
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        {/if}
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
                        class="flex-1 outline-none text-sm"
                    />
                </div>

                {#if filteredContacts.length > 0}
                    <div
                        class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                    >
                        {#each filteredContacts as c}
                            <button
                                type="button"
                                class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between text-sm"
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
                            <button
                                type="button"
                                class="text-red-500 p-1 hover:bg-red-50 rounded"
                                onclick={() => removeRelation(i)}
                            >
                                <Trash2 size={16} />
                            </button>
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
                        oninput={() => onEmailChange?.()}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>
                <div class="w-32">
                    <select
                        bind:value={email.type}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                <button
                    type="button"
                    class="text-red-500 p-2 hover:bg-red-50 rounded mb-1"
                    onclick={() => removeEmail(i)}
                >
                    <Trash2 size={16} />
                </button>
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
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>
                <div class="w-32">
                    <select
                        bind:value={phone.type}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                <button
                    type="button"
                    class="text-red-500 p-2 hover:bg-red-50 rounded mb-1"
                    onclick={() => removePhone(i)}
                >
                    <Trash2 size={16} />
                </button>
            </div>
        {/each}
    </div>

    <div class="space-y-4">
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium flex items-center gap-2">
                <MapPin size={20} class="text-orange-500" />
                {i18n.addresses}
            </h3>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addAddress}
            >
                <Plus size={16} class="mr-1" /> {i18n.addAddress}
            </Button>
        </div>
        {#each addresses as address, i}
            <div class="bg-gray-50/50 p-4 rounded-lg border border-gray-100 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-3">
                        <label for={`address-street-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.street}</label>
                        <input
                            id={`address-street-${i}`}
                            type="text"
                            placeholder={i18n.street}
                            bind:value={address.street}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label for={`address-house-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.houseNumber}</label>
                        <input
                            id={`address-house-${i}`}
                            type="text"
                            placeholder={i18n.houseNumber}
                            bind:value={address.houseNumber}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label for={`address-zip-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.zip}</label>
                        <input
                            id={`address-zip-${i}`}
                            type="text"
                            placeholder={i18n.zip}
                            bind:value={address.zip}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label for={`address-city-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.city}</label>
                        <input
                            id={`address-city-${i}`}
                            type="text"
                            placeholder={i18n.city}
                            bind:value={address.city}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                     <div>
                        <label for={`address-state-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.state}</label>
                        <input
                            id={`address-state-${i}`}
                            type="text"
                            placeholder={i18n.state}
                            bind:value={address.state}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-2">
                         <label for={`address-country-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.country}</label>
                        <input
                            id={`address-country-${i}`}
                            type="text"
                            placeholder={i18n.country}
                            bind:value={address.country}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label for={`address-type-${i}`} class="block text-xs font-semibold text-gray-500 mb-1">{i18n.addressType}</label>
                        <select
                            id={`address-type-${i}`}
                            bind:value={address.type}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="home">{i18n.home}</option>
                            <option value="work">{i18n.work}</option>
                            <option value="other">{i18n.other}</option>
                        </select>
                    </div>
                    <div class="flex items-end justify-between">
                         <label class="flex items-center gap-1 mb-2">
                            <input
                                type="checkbox"
                                bind:checked={address.primary}
                                class="rounded text-blue-600"
                            />
                            <span class="text-sm text-gray-500">{i18n.primary}</span>
                        </label>
                        <button
                            type="button"
                            class="text-red-500 p-2 hover:bg-red-50 rounded mb-1"
                            onclick={() => removeAddress(i)}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>
