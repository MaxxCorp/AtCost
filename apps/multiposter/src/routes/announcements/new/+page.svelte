<script lang="ts">
    import AnnouncementForm from "$lib/components/announcements/AnnouncementForm.svelte";
    import { createAnnouncement } from "./create.remote";
    import { createAnnouncementSchema } from "$lib/validations/announcements";
</script>

<AnnouncementForm
    remoteFunction={createAnnouncement}
    validationSchema={createAnnouncementSchema}
/>
