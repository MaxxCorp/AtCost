<script lang="ts">
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { browser } from '$app/env';
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
	import { readEvent } from "./read.remote";
	import { updateEvent } from "./update.remote";
    import { deleteEvents as deleteEventAction } from "../delete.remote";
	import { updateEventSchema } from "#lib/validations/events.js";
	import EventForm from "#lib/components/events/EventForm.svelte";
	import SeriesModeSelector from "#lib/components/events/SeriesModeSelector.svelte";
	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "#lib/components/ui/AsyncButton.svelte";
    import { Button } from "#lib/components/ui/button/index.js";
    import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
    import { handleDelete } from "@ac/ui";
    import {
        Trash2,
        ChevronDown,
        RefreshCw,
    } from "@lucide/svelte";
    import { authClient } from "#lib/auth.js";
    import {
        createCollaborationRoom,
        CollaboratorAvatarStack,
        RemoteChangeBanner,
        type CollaborationRoom
    } from "#lib/client/collaboration/index.js";

    import { onMount } from "svelte";

	const eventId = $derived(page.params.id || "");
    const eventRf = $derived(updateEvent.for(eventId));
    const eventQuery = $derived(readEvent(eventId));

    let collab = $state<CollaborationRoom | null>(null);

    onMount(() => {
        if (!eventId) return;

        let isCancelled = false;
        let room: CollaborationRoom | null = null;

        authClient.getSession().then((session) => {
            if (isCancelled) return;
            const user = session?.data?.user;
            if (!user) return;

            room = createCollaborationRoom({
                entityType: 'event',
                entityId: eventId,
                currentUser: {
                    id: user.id,
                    name: user.name || user.email,
                    email: user.email,
                    avatar: user.image ?? undefined
                },
                onRemoteChange: (change) => {
                    const name = change.updatedBy?.name || change.updatedBy?.email || 'A collaborator';
                    toast.info(`${name} updated this event.`);
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

{#if browser}
    <svelte:boundary>
        {#if deleteEventAction.pending || (eventQuery.loading && !eventQuery.current)}
            <LoadingSection message={m.loading_event_data()} />
        {:else if eventQuery.current}
            {@const event = eventQuery.current}
            <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
                <div class="max-w-3xl mx-auto px-4 py-8 text-left">
                    <Breadcrumb
                        feature="events"
                        current={event.summary ??
                            m.create_new({ item: m.feature_events_title() })}
                    />

                    <div class="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <div class="flex items-center gap-4 flex-wrap">
                            <h1 class="text-3xl font-bold">
                                {m.edit_item({ item: m.feature_events_title() })}
                            </h1>
                                <CollaboratorAvatarStack
                                    peers={collab?.peers ?? []}
                                    connected={collab?.connected ?? false}
                                    provider={collab?.provider ?? 'none'}
                                    offlineReason={collab?.offlineReason ?? null}
                                />
                            </div>

                            {#if event.recurrence && event.recurrence.length > 0 || event.seriesId || event.recurringEventId}
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger>
                                        <Button
                                            variant="destructive"
                                            class="flex items-center gap-2"
                                        >
                                            <Trash2 size={16} />
                                            {m.delete()} 
                                            <ChevronDown size={14} />
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="end">
                                        <DropdownMenu.Item
                                            onclick={async () => {
                                                await handleDelete({
                                                    ids: [event.id],
                                                    deleteFn: async (ids) => await deleteEventAction({ ids }),
                                                itemName: m.instance().toLowerCase(),
                                                });
                                                goto("/events");
                                            }}
                                        >
                                            <Trash2 size={14} class="mr-2" />
                                        {m.delete()}
                                        {m.instance()}
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            class="text-red-600"
                                            onclick={async () => {
                                                if (!confirm(m.delete_series_confirm())) return;
                                                try {
                                                    await deleteEventAction({ ids: [event.id], deleteSeries: true });
                                                    toast.success(m.series_deleted());
                                                    goto("/events");
                                            } catch (err: any) {
                                                toast.error(
                                                    err.message ||
                                                        "Failed to delete series",
                                                );
                                                }
                                            }}
                                        >
                                            <RefreshCw size={14} class="mr-2" />
                                        {m.delete()}
                                        {m.series()}
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            {:else}
                                <AsyncButton
                                    type="button"
                                    variant="destructive"
                                    loading={deleteEventAction.pending}
                                    onclick={async () => {
                                        await handleDelete({
                                            ids: [event.id],
                                            deleteFn: async (ids) => await deleteEventAction({ ids }),
                                        itemName: m.event_label(),
                                        });
                                        goto("/events");
                                    }}
                            >
                                {m.delete()}
                            </AsyncButton>
                            {/if}
                        </div>

                        <SeriesModeSelector event={event} variant="banner" />

                        {#if collab}
                            <RemoteChangeBanner
                                remoteChange={collab.remoteChange}
                                onRefresh={async () => {
                                    await readEvent(eventId).refresh();
                                }}
                                onDismiss={() => collab?.dismissRemoteChange()}
                            />
                        {/if}

                        <form
                            {...eventRf.preflight(updateEventSchema).enhance(async ({ submit }: any) => {
                                try {
                                    const result: any = await submit();
                                    if (result?.error) {
                                    toast.error(
                                        result.error.message || m.something_went_wrong(),
                                    );
                                        return;
                                    }
                                    toast.success(m.successfully_saved());
                                    goto("/events");
                            } catch (error: any) {
                                    toast.error(error?.message || m.something_went_wrong());
                                }
                            })}
                            class="space-y-6"
                        >
                            {#key event.id}
                                <EventForm
                                    remoteFunction={eventRf}
                                    validationSchema={updateEventSchema}
                                    isUpdating={true}
                                    initialData={event}
                                    collab={collab}
                                />
                            {/key}

                        <div class="flex gap-3 pt-4">
                            <AsyncButton
                                type="submit"
                                loadingLabel={m.saving()}
                                loading={eventRf.pending}
                                class="px-8"
                            >
                                {m.save_changes()}
                            </AsyncButton>
                            <Button variant="secondary" href="/events" size="default">
                                {m.cancel()}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        {:else if eventQuery.current === null}
            <ErrorSection
                headline={m.event_not_found()}
                message={m.event_not_found_message()}
                href="/events"
                button={m.back_to_events()}
            />
        {:else if eventQuery.error}
            <ErrorSection
                headline={m.event_not_found()}
                message={eventQuery.error?.message || m.event_not_found_message()}
                href="/events"
                button={m.back_to_events()}
            />
        {/if}
        {#snippet failed(error: unknown)}
            <ErrorSection
                headline={m.event_not_found()}
                message={m.event_not_found_message()}
                href="/events"
                button={m.back_to_events()}
            />
        {/snippet}
    </svelte:boundary>
{:else}
    <LoadingSection message={m.loading_event_data()} />
{/if}
