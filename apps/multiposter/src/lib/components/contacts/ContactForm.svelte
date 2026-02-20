<script lang="ts">
    import {
        Plus,
        Trash2,
        Mail,
        Phone,
        Link as LinkIcon,
        User,
        Search,
    } from "@lucide/svelte";
    import { goto } from "$app/navigation";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { toast } from "svelte-sonner";
    import TagInput from "../ui/TagInput.svelte";
    import ResourceManager from "../resources/ResourceManager.svelte";
    import LocationForm from "../locations/LocationForm.svelte";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { listLocations } from "../../../routes/locations/list.remote";
    import {
        addLocationToContact,
        removeLocationFromContact,
        fetchContactLocations,
    } from "../../../routes/locations/associate.remote";

    import { Button } from "@ac/ui";
    import AsyncButton from "../ui/AsyncButton.svelte";
    import { type Contact } from "$lib/validations/contacts";

    let {
        initialData = {},
        remoteFunction,
        validationSchema, // Renamed from schema
        onSuccess,
        cancelHref = "/contacts",
        contactId,
        loading = false,
        isUpdating = false,
        onCancel: handleCancel, // Alias for internal use
    }: {
        initialData?: any;
        remoteFunction: any;
        validationSchema: any;
        onSuccess?: (result: any) => void;
        cancelHref?: string;
        contactId?: string;
        loading?: boolean;
        isUpdating?: boolean;
        onCancel?: () => void; // Reverted prop name
    } = $props();

    // -- State --
    // Handle both flat (from ResourceManager) and nested (from PageData) structures
    const c = initialData?.contact || initialData || {};
    const id = contactId || c.id || "";

    let displayName = $state(c.displayName || "");
    let givenName = $state(c.givenName || "");
    let familyName = $state(c.familyName || "");

    // Date handling
    const getInitialDate = (d: any) => {
        if (!d) return "";
        if (d instanceof Date) return d.toISOString().split("T")[0];
        return String(d).split("T")[0];
    };
    let birthday = $state(getInitialDate(c.birthday));

    let notes = $state(c.notes || "");
    let company = $state(c.company || "");
    let role = $state(c.role || "");
    let isPublic = $state(c.isPublic || false);

    let emails = $state<any[]>(initialData.emails || c.emails || []);
    let phones = $state<any[]>(initialData.phones || c.phones || []);
    let relations = $state<any[]>(initialData.relations || c.relations || []);

    // Tags
    let tagsInput = $state(
        (initialData.tags || c.tags || []).map((t: any) => t.name).join(", ") ||
            (!id ? "Customer" : ""),
    );

    // Location association handled by ResourceManager, but we might need to capture IDs if creating new
    let locationIds = $state<string[]>(
        initialData.locationIds || c.locationIds || [],
    );

    // Relations Search
    let contactSearch = $state("");
    let allContacts = $state<Contact[]>([]);

    // Helper for validation errors from the remote function wrapper
    // The wrapper usually exposes a way to get errors, but generic 'enhance' doesn't straightforwardly give field access
    // unless we use the 'value' or 'constraints' proxies from superforms/sveltekit-superforms.
    // Assuming 'remoteFunction' is a Superforms object or similar wrapper.
    // For now, we manually assume simple state or reliance on server response validation.
    // If 'remoteFunction' is just the raw function, we wrap it?
    // User logic suggests 'remoteFunction' has 'fields' etc property (classic Superforms).

    // If using standard SvelteKit remote functions library (as requested),
    // it typically returns a form object we can spread.

    // Load contacts for relation search
    $effect(() => {
        listContacts().then((res) => (allContacts = res || []));
    });

    let filteredContacts = $derived(
        contactSearch.length > 1
            ? allContacts.filter(
                  (c) =>
                      c.id !== contactId &&
                      (c.displayName || c.givenName || "")
                          .toLowerCase()
                          .includes(contactSearch.toLowerCase()),
              )
            : [],
    );

    // -- Actions --

    function addEmail() {
        emails.push({ value: "", type: "work", primary: false });
    }
    function removeEmail(i: number) {
        emails.splice(i, 1);
    }

    function addPhone() {
        phones.push({ value: "", type: "mobile", primary: false });
    }
    function removePhone(i: number) {
        phones.splice(i, 1);
    }

    function addRelation(target: Contact) {
        if (relations.find((r) => r.targetContactId === target.id)) return;
        relations.push({
            targetContactId: target.id,
            relationType: "cooperates with",
            targetContact: target,
        });
        contactSearch = "";
    }
    function removeRelation(i: number) {
        relations.splice(i, 1);
    }

    // -- Submission --
    // We construct the form handling.

    // Helper to get nested field props if using superforms
    function getField(name: string) {
        if (!remoteFunction?.fields) return {};
        // .. traversal logic similar to before if needed ..
        // But if we rewrite "cleanly", we might just use standard inputs
        // and rely on the enhance function to handle validation response.
        return {}; // Placeholder if not strictly superforms-proxy-bound
    }

    // JSON payloads for complex data
    let emailsJson = $derived(JSON.stringify(emails.filter((e) => e.value)));
    let phonesJson = $derived(JSON.stringify(phones.filter((p) => p.value)));
    let relationsJson = $derived(
        JSON.stringify(
            relations.map((r: any) => ({ ...r, targetContact: undefined })),
        ),
    ); // Avoid circular JSON
    let tagsJson = $derived(
        JSON.stringify(
            tagsInput
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean),
        ),
    );
    let locationIdsJson = $derived(JSON.stringify(locationIds));
</script>

<form
    method="POST"
    class="space-y-8"
    {...remoteFunction
        ?.preflight?.(validationSchema)
        .enhance(async (input: any) => {
            const { submit, form, data } = input;

            try {
                console.log("--- ContactForm submission started ---");
                const result = await submit();
                console.log("--- ContactForm submission result ---", result);

                if (
                    result?.success === false ||
                    result?.error ||
                    result?.type === "failure"
                ) {
                    const msg =
                        result?.error?.message ||
                        result?.data?.message ||
                        "Validation failed";
                    toast.error(msg);
                    return;
                }

                if (!result) {
                    // If standard submit returns nothing (void), assume success if no error thrown?
                    // Or error?
                    // The explicit infinite loop of 'undefined' earlier suggests we need a result.
                    toast.error("No response from server");
                    return;
                }

                toast.success("Successfully Saved!");
                if (onSuccess) onSuccess(result);
                else if (cancelHref) goto(cancelHref);
            } catch (error: any) {
                console.error("Submission error", error);
                toast.error(error?.message || "Unexpected error");
            }
        })}
>
    {#if id}
        <input type="hidden" name="id" value={id} />
    {/if}

    <input type="hidden" name="emailsJson" value={emailsJson} />
    <input type="hidden" name="phonesJson" value={phonesJson} />
    <input type="hidden" name="relationsJson" value={relationsJson} />
    <input type="hidden" name="tagsJson" value={tagsJson} />
    <input type="hidden" name="locationIdsJson" value={locationIdsJson} />

    <!-- Basic Info -->
    <div class="space-y-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
            <User size={20} class="text-blue-500" /> Basic Information
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Display Name *</label
                >
                <input
                    name="contact.displayName"
                    type="text"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={displayName}
                    required
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Given Name</label
                >
                <input
                    name="contact.givenName"
                    type="text"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={givenName}
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Family Name</label
                >
                <input
                    name="contact.familyName"
                    type="text"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={familyName}
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Birthday</label
                >
                <input
                    name="contact.birthday"
                    type="date"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={birthday}
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Company</label
                >
                <input
                    name="contact.company"
                    type="text"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={company}
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Role</label
                >
                <input
                    name="contact.role"
                    type="text"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={role}
                />
            </div>
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Notes</label
            >
            <textarea
                name="contact.notes"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                bind:value={notes}
            ></textarea>
        </div>

        <div class="flex items-center gap-2">
            <input
                name="contact.isPublic"
                type="checkbox"
                bind:checked={isPublic}
                class="rounded text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <label class="text-sm">Public Profile</label>
        </div>

        <TagInput bind:value={tagsInput} placeholder="Tags..." />
    </div>

    <!-- Relations -->
    <div class="space-y-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
            <LinkIcon size={20} class="text-pink-500" /> Relations
        </h3>

        <div class="relative">
            <div
                class="flex items-center gap-2 border rounded px-3 py-2 bg-white"
            >
                <Search size={18} class="text-gray-400" />
                <input
                    type="text"
                    placeholder="Search contact to link..."
                    class="flex-1 outline-none"
                    bind:value={contactSearch}
                />
            </div>
            {#if filteredContacts.length > 0}
                <div
                    class="absolute z-10 w-full bg-white border shadow-lg max-h-60 overflow-y-auto mt-1 rounded"
                >
                    {#each filteredContacts as c}
                        <button
                            type="button"
                            class="w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between"
                            onclick={() => addRelation(c)}
                        >
                            <span>{c.displayName || c.givenName}</span>
                            <Plus size={14} />
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        {#if relations.length > 0}
            <div class="space-y-2">
                {#each relations as rel, i}
                    <div
                        class="flex items-center gap-2 bg-gray-50 p-2 rounded border"
                    >
                        <span class="flex-1 text-sm font-medium"
                            >{rel.targetContact?.displayName || "Unknown"}</span
                        >
                        <select
                            bind:value={rel.relationType}
                            class="text-xs border rounded px-2 py-1"
                        >
                            <option value="reports to">reports to</option>
                            <option value="cooperates with"
                                >cooperates with</option
                            >
                            <option value="manager of">manager of</option>
                            <option value="other">other</option>
                        </select>
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

    <!-- Emails -->
    <div class="space-y-4">
        <div class="flex justify-between">
            <h3 class="text-lg font-medium flex items-center gap-2">
                <Mail size={20} class="text-green-500" /> Emails
            </h3>
            <Button type="button" size="sm" variant="outline" onclick={addEmail}
                ><Plus size={16} class="mr-1" /> Add</Button
            >
        </div>
        {#each emails as email, i}
            <div class="flex gap-2 items-end">
                <input
                    type="email"
                    bind:value={email.value}
                    placeholder="Email"
                    class="input flex-1"
                />
                <select bind:value={email.type} class="input w-32">
                    <option value="work">Work</option>
                    <option value="home">Home</option>
                    <option value="other">Other</option>
                </select>
                <label class="flex items-center gap-1 mb-2 cursor-pointer">
                    <input type="checkbox" bind:checked={email.primary} />
                    <span class="text-xs">Primary</span>
                </label>
                <button
                    type="button"
                    class="p-2 text-red-500 mb-1"
                    onclick={() => removeEmail(i)}><Trash2 size={16} /></button
                >
            </div>
        {/each}
    </div>

    <!-- Phones -->
    <div class="space-y-4">
        <div class="flex justify-between">
            <h3 class="text-lg font-medium flex items-center gap-2">
                <Phone size={20} class="text-purple-500" /> Phones
            </h3>
            <Button type="button" size="sm" variant="outline" onclick={addPhone}
                ><Plus size={16} class="mr-1" /> Add</Button
            >
        </div>
        {#each phones as phone, i}
            <div class="flex gap-2 items-end">
                <input
                    type="text"
                    bind:value={phone.value}
                    placeholder="Phone"
                    class="input flex-1"
                />
                <select bind:value={phone.type} class="input w-32">
                    <option value="mobile">Mobile</option>
                    <option value="work">Work</option>
                    <option value="home">Home</option>
                    <option value="other">Other</option>
                </select>
                <label class="flex items-center gap-1 mb-2 cursor-pointer">
                    <input type="checkbox" bind:checked={phone.primary} />
                    <span class="text-xs">Primary</span>
                </label>
                <button
                    type="button"
                    class="p-2 text-red-500 mb-1"
                    onclick={() => removePhone(i)}><Trash2 size={16} /></button
                >
            </div>
        {/each}
    </div>

    <!-- Locations -->
    {#if contactId}
        <ResourceManager
            type="location"
            entityId={contactId}
            remoteFunctions={{
                list: listLocations,
                create: createLocation,
                update: updateLocation,
                delete: async () => {}, // Not utilized by ResourceManager directly for deletion usually
                fetchAssociations: fetchContactLocations,
                associate: addLocationToContact,
                dissociate: removeLocationFromContact,
            }}
            FormComponent={LocationForm}
            schemas={{
                create: createLocationSchema,
                update: updateLocationSchema,
            }}
            bind:value={locationIds}
        />
    {:else}
        <!-- For new contacts, we can't associate yet, but we could select IDs to submit -->
        <ResourceManager
            type="location"
            remoteFunctions={{
                list: listLocations,
                create: createLocation,
                update: updateLocation,
                delete: async () => {},
            }}
            FormComponent={LocationForm}
            schemas={{
                create: createLocationSchema,
                update: updateLocationSchema,
            }}
            bind:value={locationIds}
        />
    {/if}

    <div class="flex justify-end gap-3 pt-6 border-t">
        <Button
            href={cancelHref}
            variant="secondary"
            type="button"
            onclick={handleCancel}>Cancel</Button
        >
        <AsyncButton type="submit" loading={remoteFunction.pending}>
            Save Contact
        </AsyncButton>
    </div>
</form>
