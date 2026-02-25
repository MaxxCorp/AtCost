<script lang="ts">
    import { page } from "$app/state";
    import { readContact } from "../read.remote";

    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import ErrorSection from "@ac/ui/components/ErrorSection.svelte";
    import {
        Mail,
        Phone,
        MapPin,
        Tag,
        Calendar,
        User,
        ArrowLeft,
        Edit,
    } from "@lucide/svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { Button } from "@ac/ui/components/button";

    const id = $derived(page.params.id as string);

    const contactQuery = $derived(readContact(id) as any);

    $effect(() => {
        if (contactQuery.data?.contact) {
            breadcrumbState.set({
                feature: "contacts",
                current: `View: ${contactQuery.data.contact.displayName || `${contactQuery.data.contact.givenName} ${contactQuery.data.contact.familyName}`}`,
            });
        }
    });

    const contact = $derived(contactQuery.data?.contact);
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    <div class="mb-6 flex items-center justify-between">
        <a
            href="/contacts"
            class="flex items-center text-sm text-gray-500 hover:text-gray-900"
        >
            <ArrowLeft size={16} class="mr-1" /> Back to Personnel
        </a>
        <a href="/contacts/{id}">
            <Button variant="outline" size="sm">
                <Edit size={16} class="mr-2" /> Edit Contact
            </Button>
        </a>
    </div>

    {#if contactQuery.pending}
        <LoadingSection message="Loading contact details..." />
    {:else if contactQuery.error}
        <ErrorSection headline="Error" message={contactQuery.error.message} />
    {:else if contact}
        <div
            class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
            <!-- Header Header -->
            <div
                class="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10 text-white"
            >
                <div class="flex items-center gap-6">
                    <div
                        class="h-20 w-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-bold border-2 border-white/30"
                    >
                        {(
                            contact.displayName?.[0] ||
                            contact.givenName?.[0] ||
                            "?"
                        ).toUpperCase()}
                    </div>
                    <div>
                        <h1 class="text-3xl font-bold">
                            {contact.displayName ||
                                `${contact.givenName || ""} ${contact.familyName || ""}`}
                        </h1>
                        {#if contact.honorificPrefix || contact.honorificSuffix}
                            <p class="text-blue-100 mt-1 opacity-90">
                                {[
                                    contact.honorificPrefix,
                                    contact.honorificSuffix,
                                ]
                                    .filter(Boolean)
                                    .join(", ")}
                            </p>
                        {/if}
                        <div class="flex flex-wrap gap-2 mt-4">
                            {#each contactQuery.data.tags || [] as t}
                                <span
                                    class="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm"
                                >
                                    {t.tag.name}
                                </span>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-8 grid grid-cols-1 md:grid-cols-3 gap-10">
                <!-- Main Info -->
                <div class="md:col-span-2 space-y-8">
                    <!-- Contact Methods -->
                    <section>
                        <h2
                            class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                        >
                            Contact Information
                        </h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {#each contactQuery.data.emails || [] as email}
                                <div
                                    class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                                >
                                    <div
                                        class="p-2 bg-white rounded-md shadow-sm text-blue-600"
                                    >
                                        <Mail size={18} />
                                    </div>
                                    <div>
                                        <p
                                            class="text-sm font-medium text-gray-900"
                                        >
                                            {email.value}
                                        </p>
                                        <p
                                            class="text-xs text-gray-500 capitalize"
                                        >
                                            {email.type} email
                                        </p>
                                    </div>
                                </div>
                            {/each}

                            {#each contactQuery.data.phones || [] as phone}
                                <div
                                    class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                                >
                                    <div
                                        class="p-2 bg-white rounded-md shadow-sm text-green-600"
                                    >
                                        <Phone size={18} />
                                    </div>
                                    <div>
                                        <p
                                            class="text-sm font-medium text-gray-900"
                                        >
                                            {phone.value}
                                        </p>
                                        <p
                                            class="text-xs text-gray-500 capitalize"
                                        >
                                            {phone.type} phone
                                        </p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {#if !contactQuery.data.emails?.length && !contactQuery.data.phones?.length}
                            <p class="text-sm text-gray-400 italic">
                                No contact methods recorded
                            </p>
                        {/if}
                    </section>

                    <!-- Addresses -->
                    <section>
                        <h2
                            class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                        >
                            Addresses
                        </h2>
                        <div class="space-y-3">
                            {#each contactQuery.data.addresses || [] as addr}
                                <div
                                    class="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100"
                                >
                                    <div
                                        class="p-2 bg-white rounded-md shadow-sm text-orange-600"
                                    >
                                        <MapPin size={18} />
                                    </div>
                                    <div>
                                        <p
                                            class="text-sm font-medium text-gray-900"
                                        >
                                            {[addr.street, addr.houseNumber]
                                                .filter(Boolean)
                                                .join(" ")}
                                        </p>
                                        <p class="text-sm text-gray-600">
                                            {[
                                                addr.zip,
                                                addr.city,
                                                addr.state,
                                                addr.country,
                                            ]
                                                .filter(Boolean)
                                                .join(", ")}
                                        </p>
                                        <p
                                            class="text-xs text-gray-400 mt-1 capitalize"
                                        >
                                            {addr.type} address
                                        </p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {#if !contactQuery.data.addresses?.length}
                            <p class="text-sm text-gray-400 italic">
                                No addresses recorded
                            </p>
                        {/if}
                    </section>

                    <!-- Notes -->
                    {#if contact.notes}
                        <section>
                            <h2
                                class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                            >
                                Notes
                            </h2>
                            <div
                                class="p-4 rounded-lg bg-yellow-50/50 border border-yellow-100 text-gray-700 text-sm whitespace-pre-wrap italic"
                            >
                                "{contact.notes}"
                            </div>
                        </section>
                    {/if}
                </div>

                <!-- Sidebar -->
                <div class="space-y-8">
                    <!-- Personal Info -->
                    <section>
                        <h2
                            class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                        >
                            Details
                        </h2>
                        <div class="space-y-4">
                            {#if contact.birthday}
                                <div class="flex items-center gap-3">
                                    <Calendar size={18} class="text-gray-400" />
                                    <div>
                                        <p class="text-xs text-gray-500">
                                            Birthday
                                        </p>
                                        <p class="text-sm font-medium">
                                            {new Date(
                                                contact.birthday,
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            {/if}
                            <div class="flex items-center gap-3">
                                <User size={18} class="text-gray-400" />
                                <div>
                                    <p class="text-xs text-gray-500">Privacy</p>
                                    <p class="text-sm font-medium">
                                        {contact.isPublic
                                            ? "Public Contact"
                                            : "Private Record"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Locations -->
                    <section>
                        <h2
                            class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                        >
                            Locations
                        </h2>
                        <div class="space-y-2">
                            {#each contactQuery.data.locationAssociations || [] as la}
                                <div
                                    class="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    <div
                                        class="h-6 w-6 rounded bg-gray-100 flex items-center justify-center text-gray-500"
                                    >
                                        <MapPin size={14} />
                                    </div>
                                    <span
                                        class="text-sm font-medium text-gray-700"
                                        >{la.location.name}</span
                                    >
                                </div>
                            {/each}
                            {#if !contactQuery.data.locationAssociations?.length}
                                <p class="text-xs text-gray-400 italic">
                                    No locations associated
                                </p>
                            {/if}
                        </div>
                    </section>

                    <!-- Relations -->
                    <section>
                        <h2
                            class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                        >
                            Relations
                        </h2>
                        <div class="space-y-2">
                            {#each contactQuery.data.relations || [] as rel}
                                <div
                                    class="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    <div
                                        class="h-6 w-6 rounded bg-gray-100 flex items-center justify-center text-gray-500"
                                    >
                                        <User size={14} />
                                    </div>
                                    <div>
                                        <p
                                            class="text-sm font-medium text-gray-700"
                                        >
                                            {rel.targetContact.displayName ||
                                                `${rel.targetContact.givenName} ${rel.targetContact.familyName}`}
                                        </p>
                                        <p
                                            class="text-[10px] text-gray-400 uppercase font-bold"
                                        >
                                            {rel.relationType}
                                        </p>
                                    </div>
                                </div>
                            {/each}
                            {#if !contactQuery.data.relations?.length}
                                <p class="text-xs text-gray-400 italic">
                                    No relations recorded
                                </p>
                            {/if}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    {:else}
        <div
            class="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
        >
            <h2 class="text-xl font-semibold text-gray-900">
                Contact not found
            </h2>
            <p class="text-gray-500 mt-2">
                The person you're looking for doesn't exist.
            </p>
            <a
                href="/contacts"
                class="text-blue-600 hover:underline mt-4 inline-block"
                >Back to list</a
            >
        </div>
    {/if}
</div>
