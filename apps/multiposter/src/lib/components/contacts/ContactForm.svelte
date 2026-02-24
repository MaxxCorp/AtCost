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
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { toast } from "svelte-sonner";
    import TagInput from "../ui/TagInput.svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    import LocationForm from "../locations/LocationForm.svelte";
    import { listLocations } from "../../../routes/locations/list.remote";
    import type { Location } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import { onMount } from "svelte";

    import Button from "../ui/button/button.svelte";
    import AsyncButton from "../ui/AsyncButton.svelte";

    interface Props {
        initialData?: any;
        remoteFunction?: any;
        schema?: any;

        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        contactId?: string;
        loading?: boolean;
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
    }: Props = $props();

    // Default values
    const d = (val: any, def: any) =>
        val === undefined || val === null ? def : val;

    // Use derived state for initial values if we want them to react to prop changes,
    // but for a form, usually we want to initialize once.
    // To silence warnings, we can use a rune to track if we've initialized, or just accept that it's initial state.
    // However, for "editing mode", if contactId changes, we might want to reset form.
    // But typically the parent component (page) remounts or handles keying.

    // svelte-ignore state_referenced_locally
    let contactData = $state({
        displayName: d(initialData.contact?.displayName, ""),
        givenName: d(initialData.contact?.givenName, ""),
        familyName: d(initialData.contact?.familyName, ""),
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
    let selectedLocationIds = $state<string[]>([
        ...d(initialData.locationIds, []),
    ]);
    let locations = $state<Location[]>([]);
    // svelte-ignore state_referenced_locally
    let relations = $state([...d(initialData.relations, [])]);
    // svelte-ignore state_referenced_locally
    let tagsInput = $state(
        (initialData.tags || []).map((t: any) => t.name).join(", ") ||
            (!contactId ? "Customer" : ""),
    );

    // Relations search state
    let contactSearch = $state("");
    let allContacts = $state<any[]>([]);

    // Use async derived or a proper resource if possible, or just onMount.
    // With Svelte 5 resources (experimental), but for now standard effect is okay if guarded.
    // We'll leave the effect but make sure it handles errors gracefully.

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

    $effect(() => {
        listContacts().then((res) => {
            allContacts = res || [];
        });
    });

    onMount(async () => {
        try {
            locations = await listLocations();
        } catch (e) {
            console.error("Failed to load locations", e);
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
        if (relations.find((r) => r.targetContactId === targetContact.id))
            return;
        relations = [
            ...relations,
            {
                targetContactId: targetContact.id,
                relationType: "cooperates with",
                targetContact,
            },
        ];
        contactSearch = "";
    }

    function removeRelation(index: number) {
        relations = relations.filter((_, i) => i !== index);
    }

    // JSON derived values for form submission
    const emailsJson = $derived(JSON.stringify(emails.filter((e) => e.value)));
    const phonesJson = $derived(JSON.stringify(phones.filter((p) => p.value)));
    const locationIdsJson = $derived(JSON.stringify(selectedLocationIds));
    const relationsJson = $derived(JSON.stringify(relations));
    const tagsJson = $derived(
        JSON.stringify(
            tagsInput
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );

    // --- Submission Handling ---

    // Superforms Enhance
    // The remote object is spread onto the form.
    // It handles the enhance action internally via the spread attributes/action.

    function getField(name: string) {
        if (!remoteFunction?.fields) return {};
        const parts = name.split(".");
        let current = remoteFunction.fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }

    // Determine name attributes based on mode
    const prefix = $derived(contactId ? "data.contact" : "contact");
</script>

<form
    {...remoteFunction.preflight(schema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = (remoteFunction as any).result;

            console.log(
                "--- ContactForm submit() finished --- captured result:",
                result,
            );

            if (result?.success === false || result?.error) {
                const msg =
                    result?.error?.message ||
                    result?.error ||
                    "Oh no! Something went wrong";
                toast.error(msg);
                return;
            }

            toast.success("Successfully Saved!");
            if (onSuccess) onSuccess(result);
            else goto(cancelHref);
        } catch (error: any) {
            console.error("--- ContactForm submit() catch ---", error);
            toast.error(error.message || "Oh no! Something went wrong");
        }
    })}
    class="space-y-8"
    method="POST"
>
    <!-- Hidden ID field for updates (Remote functions) -->
    {#if contactId}
        <input type="hidden" name="id" value={contactId} />
    {/if}

    <!-- Hidden JSON fields for arrays (Remote functions) -->
    <input type="hidden" name="emailsJson" value={emailsJson} />
    <input type="hidden" name="phonesJson" value={phonesJson} />
    <input type="hidden" name="locationIdsJson" value={locationIdsJson} />
    <input type="hidden" name="relationsJson" value={relationsJson} />
    <input type="hidden" name="tagsJson" value={tagsJson} />

    <div class="space-y-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
            <User size={20} class="text-blue-500" />
            Basic Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label
                    for="displayName"
                    class="block text-sm font-medium text-gray-700"
                    >Display Name <span class="text-red-500">*</span></label
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
                    >Given Name</label
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
                    >Family Name</label
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
                    >Birthday</label
                >
                <input
                    {...getField(`${prefix}.birthday`).as("date")}
                    bind:value={contactData.birthday}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
        <div>
            <label for="notes" class="block text-sm font-medium text-gray-700"
                >Notes</label
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
                Public Profile (Allow unauthenticated viewing)
            </label>
        </div>

        <div>
            <TagInput
                bind:value={tagsInput}
                placeholder="e.g. Customer, Lead, Priority"
            />
        </div>
    </div>

    <div class="space-y-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
            <LinkIcon size={20} class="text-pink-500" />
            Relations
        </h3>

        <div class="space-y-4">
            <!-- Search for contacts -->
            <div class="relative">
                <div
                    class="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500"
                >
                    <Search size={18} class="text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search for a contact to link..."
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

            <!-- List of relations -->
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
                                        >reports to</option
                                    >
                                    <option value="cooperates with"
                                        >cooperates with</option
                                    >
                                    <option value="manager of"
                                        >manager of</option
                                    >
                                    <option value="other">other</option>
                                </select>
                            </div>
                            {#if rel.relationType === "other"}
                                <input
                                    type="text"
                                    placeholder="Type relation..."
                                    value={rel.relationType}
                                    class="w-32 text-xs px-2 py-1 border border-gray-300 rounded"
                                    onchange={(e) =>
                                        (rel.relationType = (
                                            e.target as HTMLInputElement
                                        ).value)}
                                />
                            {/if}
                            <button
                                type="button"
                                class="text-red-500 hover:text-red-700"
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
                Email Addresses
            </h3>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addEmail}
            >
                <Plus size={16} class="mr-1" /> Add Email
            </Button>
        </div>
        {#each emails as email, i}
            <div class="flex gap-2 items-end">
                <div class="flex-1">
                    <input
                        type="email"
                        placeholder="Email Address"
                        bind:value={email.value}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Email ${i + 1}`}
                    />
                </div>
                <div class="w-32">
                    <select
                        bind:value={email.type}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Email type ${i + 1}`}
                    >
                        <option value="home">Home</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <label class="flex items-center gap-1 mb-2 cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={email.primary}
                        class="rounded text-blue-600"
                    />
                    <span class="text-xs text-gray-500">Primary</span>
                </label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="text-red-500 mb-1"
                    onclick={() => removeEmail(i)}
                    aria-label={`Remove email ${i + 1}`}
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
                Phone Numbers
            </h3>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addPhone}
            >
                <Plus size={16} class="mr-1" /> Add Phone
            </Button>
        </div>
        {#each phones as phone, i}
            <div class="flex gap-2 items-end">
                <div class="flex-1">
                    <input
                        type="text"
                        placeholder="Phone Number"
                        bind:value={phone.value}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Phone ${i + 1}`}
                    />
                </div>
                <div class="w-32">
                    <select
                        bind:value={phone.type}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Phone type ${i + 1}`}
                    >
                        <option value="mobile">Mobile</option>
                        <option value="home">Home</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <label class="flex items-center gap-1 mb-2 cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={phone.primary}
                        class="rounded text-blue-600"
                    />
                    <span class="text-xs text-gray-500">Primary</span>
                </label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="text-red-500 mb-1"
                    onclick={() => removePhone(i)}
                    aria-label={`Remove phone ${i + 1}`}
                >
                    <Trash2 size={16} />
                </Button>
            </div>
        {/each}
    </div>

    <div>
        <EntityManager
            title="Locations"
            icon={MapPin}
            type="contact"
            entityId={contactId}
            initialItems={locations.filter((l) =>
                selectedLocationIds.includes(l.id),
            )}
            onchange={(ids) => (selectedLocationIds = ids)}
            embedded={true}
            listItemsRemote={listLocations}
            deleteItemRemote={async (id) => {
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
            getFormData={(l) => l}
            searchPredicate={(l, q) => {
                return (
                    l.name.toLowerCase().includes(q.toLowerCase()) ||
                    (l.roomId?.toLowerCase().includes(q.toLowerCase()) ?? false)
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
    </div>

    <div class="flex justify-end gap-3 pt-6 border-t">
        {#if onCancel}
            <Button variant="secondary" type="button" onclick={onCancel}
                >Cancel</Button
            >
        {:else}
            <Button href={cancelHref} variant="secondary" type="button"
                >Cancel</Button
            >
        {/if}
        <AsyncButton
            type="submit"
            loading={(remoteFunction && remoteFunction.pending) || loading}
            loadingLabel="Saving..."
        >
            Save Contact
        </AsyncButton>
    </div>
</form>
