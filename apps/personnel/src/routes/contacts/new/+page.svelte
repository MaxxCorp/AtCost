<script lang="ts">
    import ContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import { createNewContact } from "./create.remote";
    import { createContactSchema } from "@ac/validations/contacts";
    import { listContacts } from "../list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    breadcrumbState.set({ feature: "contacts", current: "New Contact" });
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 line-clamp-1">
            Create Contact
        </h1>
        <p class="text-gray-500 mt-2">Add a new person to your network</p>
    </div>

    <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8"
    >
        <ContactForm
            remoteFunction={createNewContact}
            schema={createContactSchema}
            cancelHref="/contacts"
            listContactsRemote={listContacts}
        />
    </div>
</div>
