<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { page } from "$app/state";
    import { authClient } from "$lib/auth";
    import { readContact } from "../read.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import { goto } from "$app/navigation";
    import {
        Mail,
        Phone,
        MapPin,
        Tag as TagIcon,
        Download,
        Pencil,
        Earth,
        Share2,
    } from "@lucide/svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { onMount } from "svelte";
    import { parseRoles } from "$lib/authorization";

    const contactId = page.params.id || "";
    let itemsPromise = $state(readContact(contactId));

    const session = authClient.useSession();
    // Check if the user is authorized to edit
    function checkCanEdit(contact: any) {
        const user = $session.data?.user;
        return (
            !!user &&
            (user.id === contact.userId || parseRoles(user as any).includes("admin"))
        );
    }

    let canShare = $state(false);
    onMount(() => {
        canShare = !!navigator.share;
    });

    async function handleShare(contact: any, fullName: string) {
        try {
            await navigator.share({
                title: fullName,
                text:
                    contact.notes || m.contact_details_for({ name: fullName }),
                url: window.location.href,
            });
        } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
                console.error("Error sharing:", err);
            }
        }
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-3xl mx-auto">
        {#await itemsPromise}
            <Breadcrumb feature="contacts" />
            <div
                class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
            >
                <LoadingSection
                    message={m.loading_item({ item: m.contact_profile() })}
                />
            </div>
        {:then contact}
            {#if !contact}
                <Breadcrumb feature="contacts" />
                <div
                    class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
                >
                    <ErrorSection
                        headline={m.not_found({ item: m.contact() })}
                        message={m.not_found_message({ item: m.contact() })}
                        href="/contacts"
                        button={m.back_to_list()}
                    />
                </div>
            {:else}
                {@const fullName =
                    contact.displayName ||
                    `${contact.givenName || ""} ${contact.familyName || ""}`.trim() ||
                    m.unnamed_contact()}
                <Breadcrumb
                    feature="contacts"
                    current={contact.displayName || undefined}
                />

                <div
                    class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
                >
                    <div class="space-y-8">
                        <!-- Header with Name and QR -->
                        <div
                            class="flex flex-col md:flex-row justify-between items-start gap-6"
                        >
                            <div class="flex-1">
                                <div
                                    class="flex items-center gap-3 mb-2 flex-wrap"
                                >
                                    <h1
                                        class="text-3xl font-bold text-gray-900"
                                    >
                                        {fullName}
                                    </h1>
                                    {#if contact.isPublic}
                                        <span
                                            class="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"
                                        >
                                            <Earth size={12} />
                                            {m.public()}
                                        </span>
                                    {/if}
                                    {#if contact.tags && contact.tags.length > 0}
                                        {#each contact.tags as t}
                                            <span
                                                class="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full flex items-center gap-1"
                                            >
                                                <TagIcon size={12} />
                                                {t.name}
                                            </span>
                                        {/each}
                                    {/if}
                                </div>
                                {#if contact.honorificPrefix || contact.honorificSuffix}
                                    <p class="text-gray-500 text-lg">
                                        {contact.honorificPrefix || ""}
                                        {contact.honorificSuffix || ""}
                                    </p>
                                {/if}
                                {#if contact.company}
                                    <p
                                        class="text-gray-900 text-lg font-semibold mt-1"
                                    >
                                        {contact.company}
                                    </p>
                                {/if}
                                {#if contact.role || contact.department}
                                    <p
                                        class="text-gray-600 text-lg font-medium {contact.company
                                            ? ''
                                            : 'mt-1'}"
                                    >
                                        {contact.role || ""}
                                        {#if contact.role && contact.department}
                                            -
                                        {/if}
                                        {contact.department || ""}
                                    </p>
                                {/if}
                                {#if contact.notes}
                                    <p class="mt-4 text-gray-600 italic">
                                        {contact.notes}
                                    </p>
                                {/if}
                            </div>

                            {#if contact.qrCodePath}
                                <div
                                    class="bg-white p-2 border rounded-xl shadow-sm"
                                >
                                    <img
                                        src={contact.qrCodePath}
                                        alt={m.scan_to_view_contact()}
                                        class="w-32 h-32"
                                    />
                                    <p
                                        class="text-[10px] text-center text-gray-400 mt-1 uppercase tracking-wider font-bold"
                                    >
                                        {m.scan_to_share()}
                                    </p>
                                </div>
                            {/if}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <!-- Emails & Phones -->
                            <div class="space-y-6">
                                {#if contact.emails && contact.emails.length > 0}
                                    <section>
                                        <h3
                                            class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                        >
                                            <Mail size={16} />
                                            {m.email_addresses()}
                                        </h3>
                                        <ul class="space-y-3">
                                            {#each contact.emails as email}
                                                <li
                                                    class="flex items-center justify-between group flex-wrap"
                                                >
                                                    <span
                                                        class="text-gray-700 break-all text-pretty"
                                                        ><a
                                                            href="mailto:{email.value}"
                                                            class="flex items-center gap-2 text-blue-600 hover:underline break-all text-pretty"
                                                        >
                                                            {email.value}
                                                        </a></span
                                                    >
                                                    <span
                                                        class="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded capitalize"
                                                        >{email.type}</span
                                                    >
                                                </li>
                                            {/each}
                                        </ul>
                                    </section>
                                {/if}

                                {#if contact.phones && contact.phones.length > 0}
                                    <section>
                                        <h3
                                            class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                        >
                                            <Phone size={16} />
                                            {m.phone_numbers()}
                                        </h3>
                                        <ul class="space-y-3">
                                            {#each contact.phones as phone}
                                                <li
                                                    class="flex items-center justify-between group flex-wrap"
                                                >
                                                    <span class="text-gray-700"
                                                        ><a
                                                            href="tel:{phone.value}"
                                                            class="flex items-center gap-2 text-blue-600 hover:underline break-all text-pretty"
                                                        >
                                                            {phone.value}
                                                        </a></span
                                                    >
                                                    <span
                                                        class="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded capitalize"
                                                        >{phone.type}</span
                                                    >
                                                </li>
                                            {/each}
                                        </ul>
                                    </section>
                                {/if}
                            </div>

                            <!-- Addresses -->
                            <div class="space-y-6">
                                {#if contact.addresses && contact.addresses.length > 0}
                                    <section>
                                        <h3
                                            class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                        >
                                            <MapPin size={16} />
                                            {m.addresses()}
                                        </h3>
                                        <div class="space-y-4">
                                            {#each contact.addresses as addr}
                                                <div
                                                    class="bg-gray-50 p-4 rounded-lg relative"
                                                >
                                                    <span
                                                        class="absolute top-2 right-2 text-[10px] font-bold text-gray-300 uppercase"
                                                        >{addr.type}</span
                                                    >
                                                    <p class="text-gray-800">
                                                        {addr.street || ""}
                                                        {addr.houseNumber || ""}
                                                    </p>
                                                    <p class="text-gray-600">
                                                        {addr.zip || ""}
                                                        {addr.city || ""}
                                                    </p>
                                                    {#if addr.state || addr.country}
                                                        <p
                                                            class="text-gray-500 text-sm"
                                                        >
                                                            {addr.state || ""}
                                                            {addr.country || ""}
                                                        </p>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    </section>
                                {/if}
                            </div>

                            <!-- Associated Locations -->
                            <div class="space-y-6">
                                {#if contact.locationAssociations && contact.locationAssociations.length > 0}
                                    <section>
                                        <h3
                                            class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                        >
                                            <MapPin size={16} />
                                            {m.locations()}
                                        </h3>
                                        <div class="space-y-4">
                                            {#each contact.locationAssociations as la}
                                                {@const loc = la.location}
                                                {#if loc}
                                                    <div
                                                        class="bg-gray-50 p-4 rounded-lg relative"
                                                    >
                                                        <div
                                                            class="flex items-center justify-between mb-1"
                                                        >
                                                            <span
                                                                class="font-medium text-gray-900"
                                                                >{loc.name}</span
                                                            >
                                                            {#if loc.isPublic}
                                                                <span
                                                                    class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold uppercase"
                                                                    >{m.public()}</span
                                                                >
                                                            {/if}
                                                        </div>
                                                        <p
                                                            class="text-gray-800 text-sm"
                                                        >
                                                            {loc.street || ""}
                                                            {loc.houseNumber ||
                                                                ""}
                                                        </p>
                                                        <p
                                                            class="text-gray-600 text-sm"
                                                        >
                                                            {loc.zip || ""}
                                                            {loc.city || ""}
                                                        </p>
                                                    </div>
                                                {/if}
                                            {/each}
                                        </div>
                                    </section>
                                {/if}
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex flex-wrap gap-4 pt-8 border-t">
                            {#if contact.vCardPath}
                                <Button
                                    href={contact.vCardPath}
                                    download={`${fullName.replace(/\s+/g, "_")}.vcf`}
                                    class="flex items-center gap-2"
                                    variant="outline"
                                >
                                    <Download size={18} />
                                    {m.download_vcard()}
                                </Button>
                            {/if}

                            {#if canShare}
                                <Button
                                    variant="outline"
                                    class="flex items-center gap-2"
                                    onclick={() =>
                                        handleShare(contact, fullName)}
                                >
                                    <Share2 size={18} />
                                    {m.share()}
                                </Button>
                            {/if}

                            {#if checkCanEdit(contact)}
                                <Button
                                    variant="default"
                                    class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                    onclick={() =>
                                        goto(`/contacts/${contact.id}`)}
                                >
                                    <Pencil size={18} />
                                    {m.edit_contact()}
                                </Button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}
        {:catch error}
            <Breadcrumb feature="contacts" />
            <div
                class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
            >
                <ErrorSection
                    headline={m.error_loading_item({ item: m.contact() })}
                    message={error.message}
                    href="/contacts"
                    button={m.back_to_list()}
                />
            </div>
        {/await}
    </div>
</div>
