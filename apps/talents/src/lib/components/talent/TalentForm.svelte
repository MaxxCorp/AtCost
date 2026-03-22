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
        Briefcase,
        DollarSign,
        Calendar,
        FileText,
        Info,
        Settings,
    } from "@lucide/svelte";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";
    import { upsertTalent, listTalents } from "../../../routes/talents/talents.remote";
    import { unifiedTalentSchema, createLocationSchema, updateLocationSchema } from "@ac/validations";
    import { Button, AsyncButton, TagInput, ContactFields, EntityManager, handleDelete, LocationForm } from "@ac/ui";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";

    interface Props {
        initialData?: any;
        talentId?: string;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        listContactsRemote: () => Promise<any[]>;
    }

    let {
        initialData = {},
        talentId,
        onSuccess,
        onCancel,
        cancelHref = "/talents",
        listContactsRemote,
    }: Props = $props();

    const d = (val: any, def: any) =>
        val === undefined || val === null ? def : val;

    // --- State for Talent (HR) Fields ---
    // svelte-ignore state_referenced_locally
    let talentData = $state({
        id: talentId || d(initialData.id, undefined),
        status: d(initialData.status, "applicant"),
        jobTitle: d(initialData.jobTitle, ""),
        salaryExpectation: d(initialData.salaryExpectation, ""),
        availabilityDate: d(
            initialData.availabilityDate
                ? String(initialData.availabilityDate).split("T")[0]
                : "",
            "",
        ),
        onboardingStatus: d(initialData.onboardingStatus, ""),
        resumeUrl: d(initialData.resumeUrl, ""),
        source: d(initialData.source, ""),
        internalNotes: d(initialData.internalNotes, ""),
    });

    // --- State for Contact Fields (Shared) ---
    // svelte-ignore state_referenced_locally
    let contactData = $state({
        id: d(initialData.contactId || initialData.contact?.id, undefined),
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
    let addresses = $state([...d(initialData.addresses || initialData.contact?.addresses, [])]);

    // svelte-ignore state_referenced_locally
    let emails = $state([...d(initialData.emails || initialData.contact?.emails, [])]);
    // svelte-ignore state_referenced_locally
    let phones = $state([...d(initialData.phones || initialData.contact?.phones, [])]);
    // svelte-ignore state_referenced_locally
    let relations = $state([...d(initialData.relations || initialData.contact?.relations, [])]);
    // svelte-ignore state_referenced_locally
    let tagsInput = $state(
        (initialData.tags || initialData.contact?.tags || [])
            .map((t: any) => t.name || t)
            .join(", ")
    );
    // svelte-ignore state_referenced_locally
    let locationIds = $state<string[]>(
        (initialData?.locationAssociations || initialData.contact?.locationAssociations || []).map(
            (la: any) => la.locationId || la.location?.id,
        ),
    );

    const emailsJson = $derived(JSON.stringify(emails.filter((e) => e.value)));
    const phonesJson = $derived(JSON.stringify(phones.filter((p) => p.value)));
    const relationsJson = $derived(JSON.stringify(relations.map(r => ({ targetContactId: r.targetContactId, relationType: r.relationType }))));
    const tagsJson = $derived(
        JSON.stringify(
            tagsInput
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );
    const addressesJson = $derived(JSON.stringify(addresses.filter(a => a.street || a.city)));
    const locationIdsJson = $derived(JSON.stringify(locationIds));

    const remote = upsertTalent as any;

    function getField(name: string) {
        if (!remote?.fields) return {};
        const parts = name.split(".");
        let current: any = remote.fields;
        for (const part of parts) {
            if (!current?.[part]) return {};
            current = current[part];
        }
        return current;
    }
    const formSetup = $derived(remote.preflight(unifiedTalentSchema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = remote.result;
            if (result?.success === false || result?.error) {
                toast.error(result?.error?.message || result?.error || "Failed to save talent");
                return;
            }

            toast.success("Talent successfully saved!");
            if (onSuccess) onSuccess(result);
            else goto(cancelHref);
        } catch (error: any) {
            toast.error(error.message || "An unexpected error occurred");
        }
    }));
</script>

<form
    {...formSetup}
    class="space-y-8"
>
    <!-- Hidden Fields for IDs and JSON sets -->
    {#if talentId || talentData.id}
        <input {...getField("talent.id").as("hidden", talentId || talentData.id)} />
    {/if}
    {#if contactData.id}
        <input {...getField("contact.id").as("hidden", contactData.id)} />
    {/if}
    <input {...getField("emailsJson").as("hidden", emailsJson)} />
    <input {...getField("phonesJson").as("hidden", phonesJson)} />
    <input {...getField("relationsJson").as("hidden", relationsJson)} />
    <input {...getField("tagsJson").as("hidden", tagsJson)} />
    <input {...getField("addressesJson").as("hidden", addressesJson)} />
    <input {...getField("locationIdsJson").as("hidden", locationIdsJson)} />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- LEFT: Contact Information (Shared UI) -->
        <div class="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-4">
            <ContactFields
                bind:contactData
                bind:emails
                bind:phones
                bind:relations
                bind:tagsInput
                bind:locationIds
                bind:addresses
                prefix="contact"
                contactId={contactData.id}
                {listContactsRemote}
            />

            <!-- Locations Manager (EntityManager) -->
            <div class="mt-8 pt-8 border-t border-gray-100">
                <EntityManager
                    title="Locations"
                    icon={MapPin}
                    type="location"
                    entityId={contactData.id}
                    initialItems={(initialData.contact?.locationAssociations || []).map((la: any) => la.location)}
                    embedded={true}
                    onchange={(ids: string[]) => (locationIds = ids)}
                    listItemsRemote={listLocations}
                    addAssociationRemote={async (p: any) => {
                        const { addAssociation } = await import("../../../routes/talents/associate.remote");
                        return await addAssociation({
                            type: "location",
                            entityId: p.itemId,
                            contactId: p.entityId,
                        });
                    }}
                    removeAssociationRemote={async (p: any) => {
                        const { removeAssociation } = await import("../../../routes/talents/associate.remote");
                        return await removeAssociation({
                            type: "location",
                            entityId: p.itemId,
                            contactId: p.entityId,
                        });
                    }}
                    deleteItemRemote={async (ids) => {
                        return await handleDelete({
                            ids: Array.isArray(ids) ? ids : [ids],
                            deleteFn: deleteLocation,
                            itemName: "location",
                        });
                    }}
                    createRemote={createLocation}
                    createSchema={createLocationSchema}
                    updateRemote={updateLocation}
                    updateSchema={updateLocationSchema}
                    getFormData={(l: any) => l}
                    searchPredicate={(l: any, q: string) => {
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
                    {#snippet renderForm({ remoteFunction: rf, schema, id, initialData: formData, onSuccess, onCancel })}
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
        </div>

        <!-- RIGHT: HR Information -->
        <div class="space-y-6">
            <div class="bg-indigo-50/30 p-6 rounded-xl border border-indigo-100 space-y-4">
                <h3 class="text-sm font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <Briefcase size={16} />
                    Talent & HR Data
                </h3>

                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label for="jobTitle" class="block text-xs font-semibold text-gray-600 mb-1">Target Job Title</label>
                        <input
                            {...getField("talent.jobTitle").as("text")}
                            bind:value={talentData.jobTitle}
                            placeholder="e.g. Senior Frontend Engineer"
                            class="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label for="status" class="block text-xs font-semibold text-gray-600 mb-1">Pipeline Status</label>
                        <select
                            {...getField("talent.status").as("select")}
                            bind:value={talentData.status}
                            class="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        >
                            <option value="applicant">Applicant</option>
                            <option value="active">Active Talent</option>
                            <option value="inactive">Inactive / Archived</option>
                        </select>
                    </div>
                    <div>
                        <label for="salary" class="block text-xs font-semibold text-gray-600 mb-1">Salary Expectation</label>
                        <div class="relative">
                            <DollarSign size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                {...getField("talent.salaryExpectation").as("text")}
                                bind:value={talentData.salaryExpectation}
                                placeholder="Yearly gross"
                                class="w-full pl-8 pr-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label for="availability" class="block text-xs font-semibold text-gray-600 mb-1">Available From</label>
                        <input
                            {...getField("talent.availabilityDate").as("date")}
                            bind:value={talentData.availabilityDate}
                            class="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label for="source" class="block text-xs font-semibold text-gray-600 mb-1">Source</label>
                        <input
                            {...getField("talent.source").as("text")}
                            bind:value={talentData.source}
                            placeholder="e.g. LinkedIn, Referral"
                            class="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>
                    <div class="col-span-2">
                        <label for="resumeUrl" class="block text-xs font-semibold text-gray-600 mb-1">Resume / CV URL</label>
                        <input
                            {...getField("talent.resumeUrl").as("text")}
                            bind:value={talentData.resumeUrl}
                            placeholder="Link to file storage or cloud CV"
                            class="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>
                    <div class="col-span-2">
                        <label for="internalNotes" class="block text-xs font-semibold text-gray-600 mb-1">Internal HR Notes</label>
                        <textarea
                            {...getField("talent.internalNotes").as("textarea")}
                            bind:value={talentData.internalNotes}
                            rows="4"
                            placeholder="Private notes for recruitment team..."
                            class="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="flex justify-end gap-3 pt-6 border-t border-gray-100">
        {#if onCancel}
            <Button variant="secondary" type="button" onclick={onCancel}>Cancel</Button>
        {:else}
            <Button href={cancelHref} variant="secondary" type="button">Cancel</Button>
        {/if}
        <AsyncButton
            type="submit"
            loading={remote.pending}
            class="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
            {talentId || talentData.id ? "Save Changes" : "Create Talent"}
        </AsyncButton>
    </div>
</form>
