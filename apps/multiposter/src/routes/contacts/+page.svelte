<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { listContacts } from "./list.remote";
    import { deleteExistingContact } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { User, Pencil, Trash2, Eye, Phone, Mail, MapPin } from "@lucide/svelte";

    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import BulkActionToolbar from "$lib/components/ui/BulkActionToolbar.svelte";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import EmptyState from "$lib/components/ui/EmptyState.svelte";

    // Type definition for the list items
    type Contact = Awaited<ReturnType<typeof listContacts>>[number];

    const query = listContacts();
    let selectedIds = $state<Set<string>>(new Set());

    function isSelected(id: string) {
        return selectedIds.has(id);
    }
    function toggleSelection(id: string) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        // Force reactivity
        selectedIds = new Set(selectedIds);
    }
    function selectAll(items: Contact[]) {
        selectedIds = new Set(items.map((item) => item.id).filter((id): id is string => !!id));
    }

    function deselectAll() {
        selectedIds = new Set();
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="contacts" />
        <div class="bg-white shadow rounded-lg p-6">
            <div
                class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
            >
                <h1 class="text-3xl font-bold flex-shrink-0">
                    {m.feature_contacts_title()}
                </h1>
                <div class="flex-1 flex justify-end w-full md:w-auto">
                    <BulkActionToolbar
                        selectedCount={selectedIds.size}
                        totalCount={query.current?.length ?? 0}
                        onSelectAll={() => selectAll(query.current ?? [])}
                        onDeselectAll={deselectAll}
                        onDelete={async () => {
                            await handleDelete({
                                ids: [...selectedIds],
                                deleteFn: deleteExistingContact,
                                itemName: m.feature_contacts_title().toLowerCase(),
                            });
                            deselectAll();
                        }}
                        newItemHref="/contacts/new"
                        newItemLabel={"+ " +
                            m.create_item({ item: m.feature_contacts_title() })}
                    />
                </div>
            </div>

            {#if query.loading}
                <LoadingSection
                    message={m.loading_item({ item: m.feature_contacts_title() })}
                />
            {:else if query.error}
                <ErrorSection
                    headline={m.failed_to_load({
                        item: m.feature_contacts_title(),
                    })}
                    message={query.error?.message || m.something_went_wrong()}
                    href="/contacts"
                    button={m.retry()}
                />
            {:else if query.current}
                <div class="grid gap-4">
                    {#if query.current.length === 0}
                        <EmptyState
                            icon={User}
                            title={m.no_items({
                                items: m.feature_contacts_title(),
                            })}
                            description={m.get_started_creating({
                                item: m.feature_contacts_title(),
                            })}
                            actionLabel={m.create_first({
                                item: m.feature_contacts_title(),
                            })}
                            actionHref="/contacts/new"
                        />
                    {:else}
                        {#each query.current as contact (contact.id)}
                            <div
                                class="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow"
                            >
                                <input
                                    type="checkbox"
                                    checked={contact.id ? isSelected(contact.id) : false}
                                    onchange={() => contact.id && toggleSelection(contact.id)}
                                    class="mt-1 w-4 h-4 text-blue-600 rounded"
                                />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-start gap-3 mb-2">
                                        <div
                                            class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0"
                                        >
                                            <User size={20} />
                                        </div>
                                        <div class="min-w-0">
                                            <h2
                                                class="text-xl font-semibold break-words"
                                            >
                                                <a
                                                    href={`/contacts/${contact.id}/view`}
                                                    class="hover:underline text-blue-600"
                                                >
                                                    {contact.displayName ||
                                                        `${contact.givenName || ""} ${contact.familyName || ""}` ||
                                                        m.unnamed_contact()}
                                                </a>
                                            </h2>
                                            {#if contact.role || contact.company}
                                                <p
                                                    class="text-sm text-gray-500"
                                                >
                                                    {[
                                                        contact.role,
                                                        contact.company,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" at ")}
                                                </p>
                                            {/if}
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        {#if contact.emails && contact.emails.length > 0}
                                            <div class="flex items-start gap-2">
                                                <Mail size={16} class="text-gray-400 mt-1" />
                                                <div class="flex flex-col">
                                                    {#each contact.emails as email}
                                                        <span class="text-sm text-gray-700">
                                                            {email.value}
                                                            <span class="text-xs text-gray-400">({email.type})</span>
                                                        </span>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}

                                        {#if contact.phones && contact.phones.length > 0}
                                            <div class="flex items-start gap-2">
                                                <Phone size={16} class="text-gray-400 mt-1" />
                                                <div class="flex flex-col">
                                                    {#each contact.phones as phone}
                                                        <span class="text-sm text-gray-700">
                                                            {phone.value}
                                                            <span class="text-xs text-gray-400">({phone.type})</span>
                                                        </span>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>

                                    {#if contact.addresses && contact.addresses.length > 0}
                                        <div class="flex items-start gap-2 mt-4">
                                            <MapPin size={16} class="text-gray-400 mt-1" />
                                            <div class="flex flex-col">
                                                {#each contact.addresses as addr}
                                                    <span class="text-sm text-gray-700">
                                                        {addr.street} {addr.houseNumber}, {addr.zip} {addr.city}
                                                    </span>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>

                                <div class="flex flex-col gap-2 shrink-0">
                                    <Button
                                        href={`/contacts/${contact.id}/view`}
                                        variant="outline"
                                        size="default"
                                        class="flex items-center gap-2 w-[120px] justify-center"
                                    >
                                        <Eye size={16} /> {m.view()}
                                    </Button>
                                    <Button
                                        href={`/contacts/${contact.id}`}
                                        variant="default"
                                        size="default"
                                        class="flex items-center gap-2 w-[120px] justify-center"
                                    >
                                        <Pencil size={16} /> {m.edit()}
                                    </Button>
                                    <AsyncButton
                                        variant="destructive"
                                        size="default"
                                        loading={false}
                                        loadingLabel={m.deleting()}
                                        class="flex items-center gap-2 w-[120px] justify-center"
                                        onclick={async () => {
                                            const success = await handleDelete({
                                                ids: contact.id ? [contact.id] : [],
                                                deleteFn: deleteExistingContact,
                                                itemName: m.feature_contacts_title().toLowerCase(),
                                            });
                                            if (success) {
                                                deselectAll();
                                            }
                                        }}
                                    >
                                        <Trash2 size={16} /> {m.delete()}
                                    </AsyncButton>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
