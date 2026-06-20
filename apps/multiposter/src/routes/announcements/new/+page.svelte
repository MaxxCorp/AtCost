<script lang="ts">
    import AnnouncementForm from "$lib/components/announcements/AnnouncementForm.svelte";
    import { createAnnouncement } from "./create.remote";
    import { createAnnouncementSchema } from "$lib/validations/announcements";

    const formId = crypto.randomUUID();
    const rf = createAnnouncement.for(formId);
</script>

<AnnouncementForm
    remoteFunction={rf}
    validationSchema={createAnnouncementSchema}
/>
