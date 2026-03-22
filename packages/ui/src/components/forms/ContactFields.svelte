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
    import TagInput from "../TagInput.svelte";

    interface Props {
        // Bindable state
        contactData: {
            displayName: string;
            givenName: string;
            familyName: string;
            company: string;
            role: string;
            department: string;
            birthday: string;
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
        labels?: any;
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
        reportsTo: labels?.reportsTo ?? "reports to",
        cooperatesWith: labels?.cooperatesWith ?? "cooperates with",
        managerOf: labels?.managerOf ?? "manager of",
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
            allContacts = await listContactsRemote();
        } catch (e) {
            console.error("Failed to load contacts for relations", e);
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
                    name={`${prefix}.displayName`}
                    type="text"
                    bind:value={contactData.displayName}
                    required
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
                    name={`${prefix}.givenName`}
                    type="text"
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
                    name={`${prefix}.familyName`}
                    type="text"
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
                name={`${prefix}.notes`}
                bind:value={contactData.notes}
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-2">
            <input
                name={`${prefix}.isPublic`}
                type="checkbox"
                bind:checked={contactData.isPublic}
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
