<script lang="ts">
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { goto } from "$app/navigation";
    import { FEATURES } from "$lib/features";
    import type { updateUser } from "../../../routes/users/[id]/update.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { EntityManager } from "@ac/ui";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import type { Contact } from "$lib/validations/contacts";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../../routes/contacts/associate.remote";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "$lib/validations/contacts";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import { User } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
    }: {
        remoteFunction: typeof updateUser;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
    } = $props();

    function getField(name: string) {
        if (!(remoteFunction as any).fields) return {};
        const parts = name.split(".");
        let current = (remoteFunction as any).fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (remoteFunction as any).allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });

    // svelte-ignore state_referenced_locally
    const initialRoles =
        initialData?.roles && Array.isArray(initialData.roles)
            ? initialData.roles
            : [];

    // svelte-ignore state_referenced_locally
    const initialIsAdmin = initialRoles.includes("admin");

    // svelte-ignore state_referenced_locally
    const initialClaims =
        initialData?.claims && typeof initialData.claims === "object"
            ? (initialData.claims as Record<string, unknown>)
            : {};

    // svelte-ignore state_referenced_locally
    const initialClaimsMap: Record<string, any> = {};
    FEATURES.forEach((f) => {
        if (initialClaims[f.key]) initialClaimsMap[f.key] = initialClaims[f.key];
    });

    // svelte-ignore state_referenced_locally
    let isAdmin = $state(initialIsAdmin);
    // svelte-ignore state_referenced_locally
    let claimsMap = $state(initialClaimsMap);

    let claimsJson = $derived.by(() => {
        const c: Record<string, any> = {};
        for (const [k, v] of Object.entries(claimsMap)) {
            if (v) c[k] = v;
        }
        return JSON.stringify(c);
    });
</script>

<form
    class="space-y-4"
    {...remoteFunction
        .preflight(validationSchema)
        .enhance(async ({ submit }: any) => {
            try {
                await submit();
                const result = (remoteFunction as any).result;
                if (result?.error) {
                    toast.error(
                        result.error.message || m.something_went_wrong(),
                    );
                    return;
                }
                toast.success(m.successfully_saved());
                await goto("/users");
            } catch (error: unknown) {
                const err = error as { message?: string };
                toast.error(err?.message || m.something_went_wrong());
            }
        })}
>
    {#if isUpdating && initialData}
        <input {...getField("id").as("hidden", initialData.id)} />
    {/if}

    <input {...getField("claims").as("hidden", claimsJson)} />

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.summary()}</span>
        <input
            {...getField("name").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'name',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            value={initialData?.name ?? ""}
            onblur={() => remoteFunction.validate()}
        />
        {#each getField("name").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.email_address()}</span>
        <input
            {...getField("email").as("email")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'email',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            value={initialData?.email ?? ""}
            onblur={() => remoteFunction.validate()}
        />
        {#each getField("email").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <div class="border-t pt-4 mt-4">
        <h3 class="text-lg font-medium text-gray-900 mb-2">{m.roles()}</h3>
        <label class="flex items-center space-x-2">
            <input
                {...getField("roles").as("checkbox", "admin")}
                value="admin"
                checked={isAdmin}
                onchange={(e) => (isAdmin = e.currentTarget.checked)}
                class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span class="text-sm text-gray-700">{m.admin()}</span>
        </label>
    </div>

    <div class="border-t pt-4 mt-4">
        <h3 class="text-lg font-medium text-gray-900 mb-2">
            {m.claims_access()}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {#each FEATURES as feature}
                <div class="space-y-2">
                    <span class="text-sm font-medium text-gray-900">{feature.title}</span>
                    {#if feature.key === 'synchronizations'}
                        <select
                            value={claimsMap[feature.key] === true ? 'admin' : (claimsMap[feature.key] || 'none')}
                            onchange={(e) => {
                                const val = e.currentTarget.value;
                                if (val === 'none') {
                                    const next = { ...claimsMap };
                                    delete next[feature.key];
                                    claimsMap = next;
                                } else {
                                    claimsMap[feature.key] = val;
                                }
                            }}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="none">{m.none_access()}</option>
                            <option value="use">{m.use_only_access()}</option>
                            <option value="admin">{m.administrator_access()}</option>
                        </select>
                    {:else}
                        <label class="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 border border-transparent cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!claimsMap[feature.key]}
                                onchange={(e) => {
                                    claimsMap[feature.key] = e.currentTarget.checked;
                                }}
                                class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
                            <span class="text-sm text-gray-700">{m.enabled()}</span>
                        </label>
                    {/if}
                </div>
            {/each}
        </div>

    </div>

    {#if isUpdating && initialData?.id}
        <EntityManager
            title={m.feature_contacts_title()}
            icon={User}
            type="user"
            entityId={initialData.id}
            listItemsRemote={listContacts as any}
            fetchAssociationsRemote={fetchEntityContacts as any}
            addAssociationRemote={async (p: any) =>
                addAssociation({ ...p, contactId: p.itemId } as any)}
            removeAssociationRemote={async (p: any) =>
                removeAssociation({ ...p, contactId: p.itemId } as any)}
            deleteItemRemote={async (ids: string[]) => {
                return await handleDelete({
                    ids,
                    deleteFn: deleteExistingContact,
                    itemName: m.feature_contacts_title(),
                });
            }}
            createRemote={createNewContact}
            createSchema={createContactSchema}
            updateRemote={updateExistingContact}
            updateSchema={updateContactSchema}
            getFormData={(c: Contact) => ({
                contact: c,
                emails: c.emails,
                phones: c.phones,
                addresses: c.addresses,
                relations: c.relations,
                tags: c.tags,
            })}
            searchPredicate={(c: Contact, q: string) => {
                const name = (
                    c.displayName ||
                    `${c.givenName || ""} ${c.familyName || ""}`
                ).toLowerCase();
                return name.includes(q.toLowerCase());
            }}
            loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
            noItemsLabel={m.no_items_associated_label({ item: m.feature_contacts_title() })}
            noItemsFoundLabel={m.no_items_found({ item: m.feature_contacts_title() })}
            searchPlaceholder={m.search_placeholder({ item: m.feature_contacts_title() })}
            linkItemLabel={m.link_item_label({ item: m.feature_contacts_title() })}
            associatedItemLabel={m.associated_item_label({ item: m.feature_contacts_title() })}
            quickCreateLabel={m.quick_create()}
            closeSearchLabel={m.close_search()}
            editLabel={m.edit()}
            deleteLabel={m.delete()}
            unlinkLabel={m.unlink()}
            deleteForeverLabel={m.delete_forever({ item: m.contact() })}
            bulkDeleteLabel={m.delete_selected({ count: 0 })}
            selectAllLabel={m.select_all()}
            deselectAllLabel={m.deselect_all()}
            confirmUnlinkLabel={m.confirm_unlink_label({ item: m.contact() })}
        >
            {#snippet renderItemLabel(contact)}
                {contact.displayName ||
                    `${contact.givenName || ""} ${contact.familyName || ""}`}
            {/snippet}
            {#snippet renderForm({
                remoteFunction: rf,
                schema,
                initialData: formData,
                onSuccess,
                onCancel,
                id,
            })}
                <ContactForm
                    remoteFunction={rf}
                    {schema}
                    initialData={formData}
                    {onSuccess}
                    {onCancel}
                    contactId={id}
                />
            {/snippet}
        </EntityManager>
    {/if}

    <div class="flex gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? m.loading() : m.creating()}
            loading={remoteFunction.pending}
        >
            {isUpdating ? m.save_changes() : m.create_user()}
        </AsyncButton>
        <Button variant="secondary" href="/users" size="default">{m.cancel()}</Button>
    </div>
</form>
