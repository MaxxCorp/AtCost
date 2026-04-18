<script lang="ts">
    import {
        Briefcase,
        DollarSign,
        Calendar,
        FileText,
        MapPin,
    } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import {
        upsertTalent,
        listTalents,
        listSystemUsers,
    } from "../../../routes/talents/talents.remote";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import {
        unifiedTalentSchema,
        createLocationSchema,
        updateLocationSchema,
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
        listContactsRemote?: any;
    }

    let {
        initialData = {},
        talentId,
        cancelHref = "/talents",
        onSuccess,
        onCancel,
        remoteFunction = upsertTalent,
        listContactsRemote = listTalents,
    }: Props = $props();

    const rf = $derived(typeof remoteFunction === "function" ? remoteFunction() : remoteFunction);

    const d = (val: any, def: any) =>
        val === undefined || val === null ? def : val;

    // Initialize state from initialData directly
    let systemUsers = $state<any[]>([]);
    let allLocations = $state<any[]>([]);
    
    // Helper to get nested initial data
    const getInitial = (path: string, defaultValue: any) => {
        const parts = path.split('.');
        let current = initialData;
        for (const part of parts) {
            if (current === undefined || current === null) return defaultValue;
            current = current[part];
        }
        return current === undefined || current === null ? defaultValue : current;
    };

    // svelte-ignore state_referenced_locally
    let emails = $state<any[]>(getInitial('contact.emails', [{ value: "", type: "work", primary: true }]));
    // svelte-ignore state_referenced_locally
    let phones = $state<any[]>(getInitial('contact.phones', []));
    // svelte-ignore state_referenced_locally
    let relations = $state<any[]>(getInitial('contact.relations', []));
    // svelte-ignore state_referenced_locally
    let tagsInput = $state((getInitial('contact.tags', []) as string[]).join(", "));
    // svelte-ignore state_referenced_locally
    let locationIds = $state<string[]>((getInitial('contact.locationAssociations', []) as any[]).map((la: any) => la.locationId));
    // svelte-ignore state_referenced_locally
    let addresses = $state<any[]>(getInitial('contact.addresses', []));
    let autoLinked = $state(false);
    // svelte-ignore state_referenced_locally
    let linkedUserId = $state(getInitial('contact.linkedUserId', ""));

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
        birthday: d(initialData?.contact?.birthday ? String(initialData.contact.birthday).split("T")[0] : "", ""),
        notes: d(initialData?.contact?.notes, ""),
        isPublic: d(initialData?.contact?.isPublic, false),
    });

    // svelte-ignore state_referenced_locally
    let talentData = $state({
        id: talentId || d(initialData?.id, undefined),
        status: d(initialData?.status, "applicant"),
        jobTitle: d(initialData?.jobTitle, ""),
        salaryExpectation: d(initialData?.salaryExpectation, ""),
        availabilityDate: d(initialData?.availabilityDate ? String(initialData.availabilityDate).split("T")[0] : "", ""),
        onboardingStatus: d(initialData?.onboardingStatus, ""),
        resumeUrl: d(initialData?.resumeUrl, ""),
        source: d(initialData?.source, ""),
        internalNotes: d(initialData?.internalNotes, ""),
    });



    const emailsJson = $derived(JSON.stringify(emails.filter((e: any) => e.value)));
    const phonesJson = $derived(JSON.stringify(phones.filter((p: any) => p.value)));
    const relationsJson = $derived(JSON.stringify(relations.map((r: any) => ({ targetContactId: r.targetContactId, relationType: r.relationType }))));
    const addressesJson = $derived(JSON.stringify(addresses.filter((a: any) => a.street || a.city)));
    const tagsJson = $derived(JSON.stringify(tagsInput.split(",").map((t: string) => t.trim()).filter(Boolean)));
    const locationIdsJson = $derived(JSON.stringify(locationIds));

    onMount(async () => {
        if (!initialData?.id && !talentId) {
            if (!tagsInput) tagsInput = "Applicant";
        }
        try {
            const [users, locations] = await Promise.all([
                listSystemUsers(),
                listLocations()
            ]);
            systemUsers = users;
            allLocations = locations;
        } catch (e) {
            console.error("Failed to load system users", e);
        }
    });

    function tryAutoLink() {
        if (!talentData.id && !linkedUserId && !autoLinked && emails.length > 0 && emails[0]?.value && systemUsers.length > 0) {
            const primaryEmail = emails[0].value.toLowerCase();
            const match = systemUsers.find((u: any) => u.email.toLowerCase() === primaryEmail);
            if (match) {
                linkedUserId = match.id;
                autoLinked = true;
                toast.success(`Automatically linked to system user: ${match.name}`);
            }
        }
    }

    import * as m from "$lib/paraglide/messages";

    function getFieldMetadata(name: string) {
        if (!rf?.fields) return { as: () => ({}), issues: () => [] };
        const parts = name.split(".");
        let current = rf.fields;
        for (const part of parts) {
            if (!current?.[part]) return { as: () => ({}), issues: () => [] };
            current = current[part];
        }
        return current;
    }

    let prevIssuesLength = $state(0);
    function handleStatusChange(newStatus: string) {
        if (newStatus === "hired" && talentData.id) {
            toast.success("Talent marked as hired! Starting onboarding...");
            talentData.onboardingStatus = "not_started";
        }
    }
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
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
                toast.error(result?.error?.message || result?.error || "Save Failed");
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
        <input {...getFieldMetadata("talent.id").as("hidden", talentId || talentData.id)} />
    {/if}
    {#if contactData.id}
        <input {...getFieldMetadata("contact.id").as("hidden", contactData.id)} />
    {/if}
    {#if emailsJson}
        <input {...getFieldMetadata("emailsJson").as("hidden", emailsJson)} />
    {/if}
    {#if phonesJson}
        <input {...getFieldMetadata("phonesJson").as("hidden", phonesJson)} />
    {/if}
    {#if relationsJson}
        <input {...getFieldMetadata("relationsJson").as("hidden", relationsJson)} />
    {/if}
    {#if tagsJson}
        <input {...getFieldMetadata("tagsJson").as("hidden", tagsJson)} />
    {/if}
    {#if addressesJson}
        <input {...getFieldMetadata("addressesJson").as("hidden", addressesJson)} />
    {/if}
    {#if locationIdsJson}
        <input {...getFieldMetadata("locationIdsJson").as("hidden", locationIdsJson)} />
    {/if}
    {#if linkedUserId}
        <input {...getFieldMetadata("linkedUserId").as("hidden", linkedUserId)} />
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- LEFT: Contact Information -->
        <div class="space-y-6">
            <div class="bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                <ContactFields
                    bind:contactData
                    bind:emails
                    bind:phones
                    bind:relations
                    bind:tagsInput
                    bind:locationIds
                    bind:addresses
                    listContactsRemote={listContactsRemote}
                    getField={getFieldMetadata}
                    onEmailChange={tryAutoLink}
                />

                <div class="mt-8 pt-8 border-t border-gray-100 flex justify-between items-center">
                    <p class="text-sm text-gray-500">Manage associated locations and branch offices.</p>
                    <EntityManager
                        title="Locations"
                        icon={MapPin}
                        initialItems={allLocations.filter(l => locationIds.includes(l.id))}
                        listItemsRemote={listLocations}
                        onchange={(ids: string[]) => { locationIds = ids; }}
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
                            item.name.toLowerCase().includes(term.toLowerCase())}
                    >
                        {#snippet renderItemLabel(l: any)}
                            <span>{l.name}</span>
                            {#if l.city}
                                <span class="text-gray-400 text-xs ml-1">({l.city})</span>
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

        <!-- RIGHT: Talent Details -->
        <div class="space-y-8">
            <div class="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 space-y-6">
                <h3 class="text-lg font-bold text-indigo-900 flex items-center gap-2">
                    <Briefcase size={20} class="text-indigo-500" />
                    Talent Information
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label for="jobTitle" class="block text-sm font-medium text-gray-700">Job Title</label>
                        <div class="mt-1 relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Briefcase size={16} class="text-gray-400" />
                            </div>
                            <input
                                {...getFieldMetadata("talent.jobTitle").as("text")}
                                bind:value={talentData.jobTitle}
                                placeholder="e.g. Senior Software Engineer"
                                class="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
                        <select
                            {...getFieldMetadata("talent.status").as("select")}
                            bind:value={talentData.status}
                            onchange={(e) => handleStatusChange(e.currentTarget.value)}
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="applicant">Applicant</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <div>
                        <label for="salaryExpectation" class="block text-sm font-medium text-gray-700">Salary Expectation</label>
                        <div class="mt-1 relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <DollarSign size={16} class="text-gray-400" />
                            </div>
                            <input
                                {...getFieldMetadata("talent.salaryExpectation").as("text")}
                                bind:value={talentData.salaryExpectation}
                                placeholder="e.g. 85,000"
                                class="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="availabilityDate" class="block text-sm font-medium text-gray-700">Availability</label>
                        <input
                            type="date"
                            {...getFieldMetadata("talent.availabilityDate").as("date")}
                            bind:value={talentData.availabilityDate}
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label for="onboardingStatus" class="block text-sm font-medium text-gray-700">Onboarding</label>
                        <input
                            {...getFieldMetadata("talent.onboardingStatus").as("text")}
                            bind:value={talentData.onboardingStatus}
                            placeholder="Status..."
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-4">
                <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={20} class="text-gray-500" />
                    Internal Notes
                </h3>
                <textarea
                    {...getFieldMetadata("talent.internalNotes").as("textarea")}
                    bind:value={talentData.internalNotes}
                    rows="4"
                    placeholder="Private notes for recruitment team..."
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
            </div>
        </div>
    </div>

    <div class="flex justify-end gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
        <Button variant="outline" onclick={() => (onCancel ? onCancel() : goto(cancelHref))}>Cancel</Button>
        <AsyncButton type="submit" loading={rf.pending}>Register Talent</AsyncButton>
    </div>
</form>
