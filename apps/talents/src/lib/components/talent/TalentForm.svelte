<script lang="ts">
    import {
        Briefcase,
        DollarSign,
        Calendar,
        FileText,
        MapPin,
        X,
        User,
    } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import {
        upsertTalent,
        listSystemUsers,
    } from "../../../routes/talents/talents.remote";
    import { createTalent } from "../../../routes/talents/new/create.remote";
    import { listTalents as listContacts } from "../../../routes/talents/list.remote";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { listTags as listTagsRemote } from "../../../routes/tags/list.remote";
    import { createTag as createTagRemote } from "../../../routes/tags/new/create.remote";
    import { updateTag as updateTagRemote } from "../../../routes/tags/[id]/update.remote";
    import { deleteTag as deleteTagRemote } from "../../../routes/tags/[id]/delete.remote";
    import {
        unifiedTalentSchema,
        createLocationSchema,
        updateLocationSchema,
        createTalentSchema,
    } from "@ac/validations";
    import {
        Button,
        AsyncButton,
        ContactFields,
        EntityManager,
        LocationForm,
        handleDelete,
    } from "@ac/ui";

    interface Props {
        initialData?: any;
        talentId?: string;
        cancelHref?: string;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        remoteFunction?: any;
    }

    let {
        initialData = {},
        talentId,
        cancelHref = "/talents",
        onSuccess,
        onCancel,
        remoteFunction = upsertTalent,
    }: Props = $props();

    const rf = $derived(remoteFunction);

    const listTagsHandle = listTagsRemote;
    const createTagHandle = createTagRemote;
    const updateTagHandle = updateTagRemote;
    const deleteTagHandle = deleteTagRemote;

    const d = (val: any, def: any) =>
        val === undefined || val === null ? def : val;

    // Initialize state from initialData directly
    let systemUsers = $state<any[]>([]);
    let allLocations = $state<any[]>([]);

    // Helper to get nested initial data
    const getInitial = (path: string, defaultValue: any) => {
        const parts = path.split(".");
        let current = initialData;
        for (const part of parts) {
            if (current === undefined || current === null) return defaultValue;
            current = current[part];
        }
        return current === undefined || current === null
            ? defaultValue
            : current;
    };

    // svelte-ignore state_referenced_locally
    let emails = $state<any[]>(
        getInitial("contact.emails", [
            { value: "", type: "work", primary: true },
        ]),
    );
    // svelte-ignore state_referenced_locally
    let phones = $state<any[]>(getInitial("contact.phones", []));
    // svelte-ignore state_referenced_locally
    let relations = $state<any[]>(getInitial("contact.relations", []));
    // svelte-ignore state_referenced_locally
    let tagsInput = $state(
        (getInitial("contact.tags", []) as string[]).join(", "),
    );
    // svelte-ignore state_referenced_locally
    let locationIds = $state<string[]>(
        (getInitial("contact.locationAssociations", []) as any[]).map(
            (la: any) => la.locationId,
        ),
    );
    // svelte-ignore state_referenced_locally
    let addresses = $state<any[]>(getInitial("contact.addresses", []));
    let autoLinked = $state(false);
    // svelte-ignore state_referenced_locally
    let linkedUserId = $state<string | null>(
        getInitial("linkedUser.id", getInitial("contact.linkedUserId", null)),
    );

    // svelte-ignore state_referenced_locally
    let contactData = $state({
        id: d(initialData?.contactId || initialData?.contact?.id, undefined),
        displayName: d(initialData?.contact?.displayName, ""),
        givenName: d(initialData?.contact?.givenName, ""),
        middleName: d(initialData?.contact?.middleName, ""),
        familyName: d(initialData?.contact?.familyName, ""),
        honorificPrefix: d(initialData?.contact?.honorificPrefix, ""),
        honorificSuffix: d(initialData?.contact?.honorificSuffix, ""),
        company: d(initialData?.contact?.company, ""),
        role: d(initialData?.contact?.role, ""),
        department: d(initialData?.contact?.department, ""),
        gender: d(initialData?.contact?.gender, ""),
        birthday: d(
            initialData?.contact?.birthday
                ? String(initialData.contact.birthday).split("T")[0]
                : "",
            "",
        ),
        notes: d(initialData?.contact?.notes, ""),
        isPublic: d(initialData?.contact?.isPublic, false),
    });

    // svelte-ignore state_referenced_locally
    let talentData = $state({
        id: talentId || d(initialData?.id, undefined),
        status: d(initialData?.status, "applicant"),
        jobTitle: d(initialData?.jobTitle, ""),
        salaryExpectation: d(initialData?.salaryExpectation, ""),
        availabilityDate: d(
            initialData?.availabilityDate
                ? String(initialData.availabilityDate).split("T")[0]
                : "",
            "",
        ),
        onboardingStatus: d(initialData?.onboardingStatus, ""),
        resumeUrl: d(initialData?.resumeUrl, ""),
        source: d(initialData?.source, ""),
        internalNotes: d(initialData?.internalNotes, ""),
    });

    // Track selected contact for EntityManager list
    // svelte-ignore state_referenced_locally
    let selectedContactList = $state<any[]>(
        initialData?.contact ? [initialData.contact] : [],
    );

    function handleContactSelect(c: any) {
        if (!c) return;

        selectedContactList = [c];
        contactData.id = c.id;
        contactData.displayName = c.displayName || "";
        contactData.givenName = c.givenName || "";
        contactData.familyName = c.familyName || "";
        contactData.middleName = c.middleName || "";
        contactData.honorificPrefix = c.honorificPrefix || "";
        contactData.honorificSuffix = c.honorificSuffix || "";
        contactData.company = c.company || "";
        contactData.role = c.role || "";
        contactData.department = c.department || "";
        contactData.gender = c.gender || "";
        contactData.birthday = c.birthday
            ? String(c.birthday).split("T")[0]
            : "";
        contactData.notes = c.notes || "";
        contactData.isPublic = !!c.isPublic;

        emails =
            c.emails?.length > 0
                ? c.emails.map((e: any) => ({
                      value: e.value,
                      type: e.type,
                      primary: e.primary,
                  }))
                : [{ value: "", type: "work", primary: true }];

        phones =
            c.phones?.length > 0
                ? c.phones.map((p: any) => ({
                      value: p.value,
                      type: p.type,
                      primary: p.primary,
                  }))
                : [];

        addresses =
            c.addresses?.length > 0
                ? c.addresses.map((a: any) => ({ ...a }))
                : [];

        relations =
            c.relations?.length > 0
                ? c.relations.map((r: any) => ({ ...r }))
                : [];

        tagsInput = (c.tags || [])
            .map((t: any) => (typeof t === "string" ? t : t.name))
            .join(", ");

        locationIds = (c.locationAssociations || []).map(
            (la: any) => la.locationId,
        );

        linkedUserId = c.linkedUser?.id || null;

        toast.success(`Loaded contact: ${contactData.displayName}`);
    }

    function clearContactSelection() {
        selectedContactList = [];
        contactData.id = undefined;
        // Optionally clear other fields too?
        // User likely wants to start fresh if unlinking.
        contactData.displayName = "";
        contactData.givenName = "";
        contactData.familyName = "";
        contactData.middleName = "";
        contactData.honorificPrefix = "";
        contactData.honorificSuffix = "";
        contactData.company = "";
        contactData.role = "";
        contactData.department = "";
        contactData.gender = "";
        contactData.birthday = "";
        contactData.notes = "";
        contactData.isPublic = false;

        emails = [{ value: "", type: "work", primary: true }];
        phones = [];
        addresses = [];
        relations = [];
        tagsInput = "";
        locationIds = [];
        linkedUserId = null;

        toast.info("Contact selection cleared.");
    }

    const emailsJson = $derived(
        JSON.stringify(emails.filter((e: any) => e.value)),
    );
    const phonesJson = $derived(
        JSON.stringify(phones.filter((p: any) => p.value)),
    );
    const relationsJson = $derived(
        JSON.stringify(
            relations.map((r: any) => ({
                targetContactId: r.targetContactId,
                relationType: r.relationType,
            })),
        ),
    );
    const addressesJson = $derived(
        JSON.stringify(addresses.filter((a: any) => a.street || a.city)),
    );
    const tagsJson = $derived(
        JSON.stringify(
            tagsInput
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
        ),
    );
    const locationIdsJson = $derived(JSON.stringify(locationIds));

    onMount(async () => {
        if (!initialData?.id && !talentId) {
            if (!tagsInput) tagsInput = "Applicant";
        }
        try {
            const [usersResult, locationsResult] = await Promise.all([
                listSystemUsers(), // Internal query still returns array? Let's check.
                listLocations({}),
            ]);
            systemUsers = Array.isArray(usersResult)
                ? usersResult
                : (usersResult as any).data;
            allLocations = locationsResult.data;
        } catch (e) {
            console.error("Failed to load system users or locations", e);
        }
    });

    function tryAutoLink() {
        if (
            !talentData.id &&
            !linkedUserId &&
            !autoLinked &&
            emails.length > 0 &&
            emails[0]?.value &&
            systemUsers.length > 0
        ) {
            const primaryEmail = emails[0].value.toLowerCase();
            const match = systemUsers.find(
                (u: any) => u.email.toLowerCase() === primaryEmail,
            );
            if (match) {
                linkedUserId = match.id;
                autoLinked = true;
                toast.success(
                    `Automatically linked to system user: ${match.name}`,
                );
            }
        }
    }

    import * as m from "$lib/paraglide/messages";



    let prevIssuesLength = $state(0);
    function handleStatusChange(newStatus: string) {
        if (newStatus === "hired" && talentData.id) {
            toast.success("Talent marked as hired! Starting onboarding...");
            talentData.onboardingStatus = "not_started";
        }
    }
    $effect(() => {
        const issues = (rf as any)?.allIssues ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });
</script>

<form
    class="space-y-8"
    {...rf.preflight(unifiedTalentSchema).enhance(async ({ submit }: any) => {
        try {
            await submit();
            const result = rf.result;
            if (result?.success === false || result?.error) {
                toast.error(
                    result?.error?.message || result?.error || "Save Failed",
                );
                return;
            }
            toast.success(talentId ? "Talent updated!" : "Talent registered!");
            if (onSuccess) onSuccess(result);
            else goto(cancelHref);
        } catch (error: any) {
            toast.error(error.message || "Error");
        }
    })}
>
    <!-- RPC-based hidden inputs with {#if} guards as requested by USER -->
    {#if talentId || talentData.id}
        <input
            {...rf.fields.talent.fields.id.as(
                "hidden",
                talentId || talentData.id,
            )}
        />
    {/if}

    <!-- Talent Details -->
        <div class="space-y-6">
            <div
                class="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 space-y-6"
            >
                <h3
                    class="text-lg font-bold text-indigo-900 flex items-center gap-2"
                >
                    <Briefcase size={20} class="text-indigo-500" />
                    Talent Information
                </h3>

                <div class="grid grid-cols-1 gap-4">
                    <div class="md:col-span-2">
                        <label
                            for="jobTitle"
                            class="block text-sm font-medium text-gray-700"
                            >Job Title</label
                        >
                        <div class="mt-1 relative">
                            <div
                                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                            >
                                <Briefcase size={16} class="text-gray-400" />
                            </div>
                            <input
                                {...rf.fields.talent.fields.jobTitle.as(
                                    "text",
                                )}
                                bind:value={talentData.jobTitle}
                                placeholder="e.g. Senior Software Engineer"
                                class="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            for="status"
                            class="block text-sm font-medium text-gray-700"
                            >Status</label
                        >
                        <select
                            {...rf.fields.talent.fields.status.as("select")}
                            bind:value={talentData.status}
                            onchange={(e) =>
                                handleStatusChange(e.currentTarget.value)}
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="applicant">Applicant</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <div>
                        <label
                            for="salaryExpectation"
                            class="block text-sm font-medium text-gray-700"
                            >Salary Expectation</label
                        >
                        <div class="mt-1 relative">
                            <div
                                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                            >
                                <DollarSign size={16} class="text-gray-400" />
                            </div>
                            <input
                                {...rf.fields.talent.fields.salaryExpectation.as("text")}
                                bind:value={talentData.salaryExpectation}
                                placeholder="e.g. 85,000"
                                class="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            for="availabilityDate"
                            class="block text-sm font-medium text-gray-700"
                            >Availability</label
                        >
                        <input
                            type="date"
                            {...rf.fields.talent.fields.availabilityDate.as(
                                "date",
                            )}
                            bind:value={talentData.availabilityDate}
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label
                            for="onboardingStatus"
                            class="block text-sm font-medium text-gray-700"
                            >Onboarding</label
                        >
                        <input
                            {...rf.fields.talent.fields.onboardingStatus.as(
                                "text",
                            )}
                            bind:value={talentData.onboardingStatus}
                            placeholder="Status..."
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <div
                class="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-4"
            >
                <h3
                    class="text-lg font-bold text-gray-900 flex items-center gap-2"
                >
                    <FileText size={20} class="text-gray-500" />
                    Internal Notes
                </h3>
                <textarea
                    {...rf.fields.talent.fields.internalNotes.as("textarea")}
                    bind:value={talentData.internalNotes}
                    rows="4"
                    placeholder="Private notes for recruitment team..."
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
            </div>
        </div>

    {#if contactData.id}
        <input
            {...rf.fields.contact.fields.id.as("hidden", contactData.id)}
        />
    {/if}
    {#if contactData.displayName}
        <input
            {...rf.fields.contact.fields.displayName.as(
                "hidden",
                contactData.displayName,
            )}
        />
    {/if}
    {#if contactData.givenName}
        <input
            {...rf.fields.contact.fields.givenName.as(
                "hidden",
                contactData.givenName,
            )}
        />
    {/if}
    {#if contactData.familyName}
        <input
            {...rf.fields.contact.fields.familyName.as(
                "hidden",
                contactData.familyName,
            )}
        />
    {/if}
    {#if contactData.middleName}
        <input
            {...rf.fields.contact.fields.middleName.as(
                "hidden",
                contactData.middleName,
            )}
        />
    {/if}
    {#if contactData.honorificPrefix}
        <input
            {...rf.fields.contact.fields.honorificPrefix.as(
                "hidden",
                contactData.honorificPrefix,
            )}
        />
    {/if}
    {#if contactData.honorificSuffix}
        <input
            {...rf.fields.contact.fields.honorificSuffix.as(
                "hidden",
                contactData.honorificSuffix,
            )}
        />
    {/if}
    {#if contactData.birthday}
        <input
            {...rf.fields.contact.fields.birthday.as(
                "hidden",
                contactData.birthday,
            )}
        />
    {/if}
    {#if contactData.gender}
        <input
            {...rf.fields.contact.fields.gender.as(
                "hidden",
                contactData.gender,
            )}
        />
    {/if}
    {#if contactData.company}
        <input
            {...rf.fields.contact.fields.company.as(
                "hidden",
                contactData.company,
            )}
        />
    {/if}
    {#if contactData.role}
        <input
            {...rf.fields.contact.fields.role.as(
                "hidden",
                contactData.role,
            )}
        />
    {/if}
    {#if contactData.department}
        <input
            {...rf.fields.contact.fields.department.as(
                "hidden",
                contactData.department,
            )}
        />
    {/if}
    {#if contactData.notes}
        <input
            {...rf.fields.contact.fields.notes.as(
                "hidden",
                contactData.notes,
            )}
        />
    {/if}
    {#if contactData.isPublic}
        <input
            {...rf.fields.contact.fields.isPublic.as(
                "hidden",
                contactData.isPublic,
            )}
        />
    {/if}
    {#if emailsJson}
        <input {...rf.fields.emailsJson.as("hidden", emailsJson)} />
    {/if}
    {#if phonesJson}
        <input {...rf.fields.phonesJson.as("hidden", phonesJson)} />
    {/if}
    {#if relationsJson}
        <input
            {...rf.fields.relationsJson.as("hidden", relationsJson)}
        />
    {/if}
    {#if tagsJson}
        <input {...rf.fields.tagsJson.as("hidden", tagsJson)} />
    {/if}
    {#if addressesJson}
        <input
            {...rf.fields.addressesJson.as("hidden", addressesJson)}
        />
    {/if}
    {#if locationIdsJson}
        <input
            {...rf.fields.locationIdsJson.as(
                "hidden",
                locationIdsJson,
            )}
        />
    {/if}
    <input
        {...rf.fields.linkedUserId.as("hidden", linkedUserId || "")}
    />

    <div class="grid grid-cols-1 gap-6">
        <!-- Contact Information -->
        <div class="space-y-4">
            <div
                class="bg-gray-50/50 p-4 sm:p-6 rounded-xl border border-gray-100 space-y-4"
            >
                <h3
                    class="text-lg font-bold text-gray-900 flex items-center gap-2"
                >
                    <User size={20} class="text-indigo-500" />
                    {m.contacts()}
                </h3>
                <EntityManager
                    title="Contact"
                    icon={User}
                    mode="embedded"
                    singleSelect
                    initialItems={selectedContactList}
                    listItemsRemote={listContacts}
                    onchange={(_ids: string[], items: any[]) => {
                        if (items.length > 0) {
                            handleContactSelect(items[0]);
                        } else {
                            clearContactSelection();
                        }
                    }}
                    createRemote={createTalent}
                    createSchema={createTalentSchema}
                    linkItemLabel="Search Existing"
                    associatedItemLabel="Selected Contact"
                    searchPlaceholder="Search contacts by name..."
                    noItemsLabel="No contact selected yet."
                    searchPredicate={(item: any, term: string) =>
                        item.displayName
                            ?.toLowerCase()
                            .includes(term.toLowerCase()) ||
                        item.givenName
                            ?.toLowerCase()
                            .includes(term.toLowerCase()) ||
                        item.familyName
                            ?.toLowerCase()
                            .includes(term.toLowerCase())}
                >
                    {#snippet renderItemLabel(item)}
                        <div class="flex flex-col">
                            <span class="text-sm font-medium"
                                >{item.displayName}</span
                            >
                            {#if item.emails?.[0]}
                                <span class="text-xs text-gray-500"
                                    >{item.emails[0].value}</span
                                >
                            {/if}
                        </div>
                    {/snippet}

                    {#snippet renderForm({
                        remoteFunction: crf,
                        schema,
                        initialData: formData,
                        onSuccess: os,
                        onCancel: oc,
                    }: any)}
                        <form
                            {...crf.preflight(schema).enhance(async ({ submit }: { submit: any }) => {
                                try {
                                    const result = await submit();
                                    if (result && result.success !== false) {
                                        os(result.data);
                                    } else {
                                        toast.error(
                                            result?.error || "Failed to create contact"
                                        );
                                    }
                                } catch (err) {
                                    console.error("[TalentForm] Contact Quick Create Error:", err);
                                    toast.error("An unexpected error occurred");
                                }
                            })}
                            class="p-4 space-y-4"
                        >
                            <ContactFields
                                bind:contactData
                                bind:emails
                                bind:phones
                                bind:relations
                                bind:tagsInput
                                bind:locationIds
                                bind:addresses
                                listContactsRemote={async () => {
                                    const res = await listContacts();
                                    return res.data;
                                }}
                                rf={crf}
                                onEmailChange={tryAutoLink}
                                listTagsRemote={listTagsHandle}
                                createTagRemote={createTagHandle}
                                deleteTagRemote={deleteTagHandle}
                                updateTagRemote={updateTagHandle}
                                initialTags={getInitial("contact.tags", [])}
                            />

                            <!-- Hidden fields for the remote function payload -->
                            {#if crf.fields?.contact}
                                <input {...crf.fields.contact.as("hidden", contactData)} />
                            {/if}
                            {#if crf.fields?.emailsJson}
                                <input {...crf.fields.emailsJson.as("hidden", JSON.stringify(emails))} />
                            {/if}
                            {#if crf.fields?.phonesJson}
                                <input {...crf.fields.phonesJson.as("hidden", JSON.stringify(phones))} />
                            {/if}
                            {#if crf.fields?.relationsJson}
                                <input {...crf.fields.relationsJson.as("hidden", JSON.stringify(relations))} />
                            {/if}
                            {#if crf.fields?.tagsJson}
                                <input {...crf.fields.tagsJson.as("hidden", JSON.stringify(tagsInput.split(",").map(t => t.trim()).filter(Boolean)))} />
                            {/if}
                            {#if crf.fields?.addressesJson}
                                <input {...crf.fields.addressesJson.as("hidden", JSON.stringify(addresses))} />
                            {/if}
                            {#if crf.fields?.locationIdsJson}
                                <input {...crf.fields.locationIdsJson.as("hidden", JSON.stringify(locationIds))} />
                            {/if}

                            <div class="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onclick={oc}>Cancel</Button>
                                <AsyncButton
                                    type="submit"
                                    loading={crf.pending}
                                >
                                    Create Contact
                                </AsyncButton>
                            </div>
                        </form>
                    {/snippet}
                </EntityManager>

                <div class="mt-6 pt-6 border-t border-gray-100 space-y-4">
                    <h3
                        class="text-lg font-bold text-gray-900 flex items-center gap-2"
                    >
                        <MapPin size={20} class="text-indigo-500" />
                        {m.locations()}
                    </h3>
                    <p class="text-sm text-gray-500">
                        Manage associated locations and branch offices.
                    </p>
                    <EntityManager
                        title="Locations"
                        icon={MapPin}
                        mode="embedded"
                        initialItems={allLocations.filter((l) =>
                            locationIds.includes(l.id),
                        )}
                        listItemsRemote={listLocations}
                        onchange={(ids: string[]) => {
                            locationIds = ids;
                        }}
                        createRemote={createLocation}
                        createSchema={createLocationSchema}
                        updateRemote={updateLocation}
                        updateSchema={updateLocationSchema}
                        getFormData={(l: any) => l}
                        deleteItemRemote={async (ids: string[]) => {
                            return await handleDelete({
                                ids,
                                deleteFn: deleteLocation,
                                itemName: "location",
                            });
                        }}
                        searchPredicate={(item: any, term: string) =>
                            item.name
                                .toLowerCase()
                                .includes(term.toLowerCase())}
                    >
                        {#snippet renderItemLabel(l: any)}
                            <span>{l.name}</span>
                            {#if l.city}
                                <span class="text-gray-400 text-xs ml-1"
                                    >({l.city})</span
                                >
                            {/if}

                        {/snippet}

                        {#snippet renderForm({
                            remoteFunction: rf,
                            schema,
                            initialData: formData,
                            onSuccess: os,
                            onCancel: oc,
                            id: lid,
                        }: any)}
                            <LocationForm
                                remoteFunction={rf}
                                validationSchema={schema}
                                initialData={formData}
                                onSuccess={os}
                                onCancel={oc}
                                isUpdating={!!lid}
                            />
                        {/snippet}
                    </EntityManager>
                </div>
            </div>
        </div>
    </div>

        

    <div
        class="flex justify-end gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100"
    >
        <Button
            variant="outline"
            onclick={() => (onCancel ? onCancel() : goto(cancelHref))}
            >Cancel</Button
        >
        <AsyncButton type="submit" loading={rf.pending}
            >Register Talent</AsyncButton
        >
    </div>
</form>
