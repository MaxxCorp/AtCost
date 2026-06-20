<script lang="ts">
    import AnnouncementForm from "$lib/components/announcements/AnnouncementForm.svelte";
    import { updateAnnouncement } from "./update.remote";
    import { updateAnnouncementSchema } from "$lib/validations/announcements";
    import { readAnnouncement } from "./read.remote";
    import { page } from "$app/state";

    let id = $derived(page.params.id || "");
</script>

{#await readAnnouncement(id)}
    <div class="p-8 text-center text-gray-500">Loading...</div>
{:then announcement}
        <AnnouncementForm
        remoteFunction={updateAnnouncement.for(id)}
        validationSchema={updateAnnouncementSchema}
        isUpdating={true}
        initialData={announcement}
    />
    {:catch}
    <div class="p-8 text-center text-red-500">Error loading announcement</div>
{/await}
