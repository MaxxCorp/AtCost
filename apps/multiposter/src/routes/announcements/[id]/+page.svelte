<script lang="ts">
    import AnnouncementForm from "#lib/components/announcements/AnnouncementForm.svelte";
    import { updateAnnouncement } from "./update.remote";
    import { updateAnnouncementSchema } from "#lib/validations/announcements.js";
    import { readAnnouncement } from "./read.remote";
    import { page } from "$app/state";
    import { browser } from '$app/env';
    import { authClient } from "#lib/auth.js";
    import {
        createCollaborationRoom,
        CollaboratorAvatarStack,
        RemoteChangeBanner,
        type CollaborationRoom
    } from "#lib/client/collaboration/index.js";
    import { toast } from "svelte-sonner";

    import { onMount } from "svelte";

    let id = $derived(page.params.id || "");
    let collab = $state<CollaborationRoom | null>(null);

    onMount(() => {
        if (!id) return;

        let isCancelled = false;
        let room: CollaborationRoom | null = null;

        authClient.getSession().then((session) => {
            if (isCancelled) return;
            const user = session?.data?.user;
            if (!user) return;

            room = createCollaborationRoom({
                entityType: 'announcement',
                entityId: id,
                currentUser: {
                    id: user.id,
                    name: user.name || user.email,
                    email: user.email,
                    avatar: user.image ?? undefined
                },
                onRemoteChange: (change) => {
                    const name = change.updatedBy?.name || change.updatedBy?.email || 'A collaborator';
                    toast.info(`${name} updated this announcement.`);
                }
            });
            collab = room;
        });

        return () => {
            isCancelled = true;
            if (room) {
                room.destroy();
            }
            collab = null;
        };
    });
</script>

{#await readAnnouncement(id)}
    <div class="p-8 text-center text-gray-500">Loading...</div>
{:then announcement}
    <div class="max-w-3xl mx-auto px-4 py-8 text-left">
        <div class="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h1 class="text-3xl font-bold">Edit Announcement</h1>
            <CollaboratorAvatarStack
                peers={collab?.peers ?? []}
                connected={collab?.connected ?? false}
                provider={collab?.provider ?? 'none'}
                offlineReason={collab?.offlineReason ?? null}
            />
        </div>

        {#if collab}
            <RemoteChangeBanner
                remoteChange={collab.remoteChange}
                onRefresh={async () => {
                    await readAnnouncement(id).refresh();
                }}
                onDismiss={() => collab?.dismissRemoteChange()}
            />
        {/if}

        <AnnouncementForm
            remoteFunction={updateAnnouncement.for(id)}
            validationSchema={updateAnnouncementSchema}
            isUpdating={true}
            initialData={announcement}
            collab={collab}
        />
    </div>
{:catch}
    <div class="p-8 text-center text-red-500">Error loading announcement</div>
{/await}
