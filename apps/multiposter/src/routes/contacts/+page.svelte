<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { listContacts } from "./list.remote";
    import { listLocations } from "../locations/list.remote";
    import { listTags } from "../tags/list.remote";
    import { deleteContact } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { User, Pencil, Trash2, Eye, Phone, Mail, MapPin } from "@lucide/svelte";

    import { EntityManager } from "@ac/ui";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";

    // Type definition for the list items
    type Contact = Awaited<ReturnType<typeof listContacts>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="contacts" />
        <div class="bg-white shadow rounded-lg p-6">
            <h1 class="text-2xl font-black mb-6 text-gray-900">{m.feature_contacts_title()}</h1>
            <EntityManager 
                title={m.feature_contacts_title()} 
                icon={User} 
                mode="standalone"
                listItemsRemote={listContacts as any}
                filterAssociations={[
                    {
                        id: "locationId",
                        label: m.locations(),
                        listRemote: listLocations as any,
                        getOptionLabel: (l: any) => l.name,
                    },
                    {
                        id: "tagId",
                        label: m.tags(),
                        listRemote: listTags as any,
                        getOptionLabel: (t: any) => t.name,
                    },
                ]}
                createHref="/contacts/new"
                createLabel={m.create_item({ item: m.contact() })}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteContact,
                        itemName: m.feature_contacts_title().toLowerCase(),
                    });
                }}
                loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
                noItemsFoundLabel={m.no_items({ items: m.feature_contacts_title() })}
                searchPredicate={(c: Contact, q: string) => {
                    const name = (c.displayName || `${c.givenName || ""} ${c.familyName || ""}`).toLowerCase();
                    return name.includes(q.toLowerCase());
                }}
            >
                {#snippet renderListItem(contact: Contact, { isSelected, toggleSelection, deleteItem })}
                    <div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onchange={() => contact.id && toggleSelection(contact.id)}
                            class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start gap-3 mb-2">
                                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                    <User size={20} />
                                </div>
                                <div class="min-w-0">
                                    <h2 class="text-xl font-semibold break-words">
                                        <a
                                            href={`/contacts/${contact.id}/view`}
                                            class="hover:underline text-blue-600"
                                        >
                                            {contact.displayName || `${contact.givenName || ""} ${contact.familyName || ""}` || m.unnamed_contact()}
                                        </a>
                                    </h2>
                                    {#if contact.role || contact.company || contact.department}
                                        <p class="text-sm text-gray-500">
                                            {[contact.role, contact.department, contact.company].filter(Boolean).join(" · ")}
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
                                onclick={() => deleteItem(contact)}
                            >
                                <Trash2 size={16} /> {m.delete()}
                            </AsyncButton>
                        </div>
                    </div>
                {/snippet}
            </EntityManager>
        </div>
    </div>
</div>
