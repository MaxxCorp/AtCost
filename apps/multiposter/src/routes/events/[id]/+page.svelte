<script lang="ts">
    import { LoadingSection, ErrorSection, getLastListUrl, recordActiveItem, markLocalEntityMutation } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { browser } from '$app/env';
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
	import { readEvent, readEventLive } from "./read.remote";
	import { updateEvent } from "./update.remote";
    import { listEvents, listEventsLive } from "../list.remote";
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
        RotateCcw,
    } from "@lucide/svelte";
    import { isMaterializedException } from "#lib/utils/event-series.js";
    import { authClient } from "#lib/auth.js";
    import {
        createCollaborationRoom,
        CollaboratorAvatarStack,
        RemoteChangeBanner,
        type CollaborationRoom
    } from "#lib/client/collaboration/index.js";
    import {
        isRealtimeCapabilityReady,
        preferLiveQuery,
        refreshRemoteResource
    } from "#lib/client/realtime/client.svelte.js";

    import { onMount } from "svelte";

	const eventId = $derived(page.params.id || "");
    const eventRf = $derived(updateEvent.for(eventId));
    const eventQuery = $derived(
        isRealtimeCapabilityReady()
            ? (preferLiveQuery() ? readEventLive(eventId) : readEvent(eventId))
            : null
    );

    let collab = $state<CollaborationRoom | null>(null);
    let isFormDirty = $state(false);
    let lockedUpdatedAt = $state<string | null>(null);
    let formResetNonce = $state(0);

    function handleFormDirtyChange(dirty: boolean) {
        if (dirty && !isFormDirty) {
            lockedUpdatedAt = String(eventQuery?.current?.updatedAt ?? "");
        }
        if (!dirty) {
            lockedUpdatedAt = null;
        }
        isFormDirty = dirty;
    }

    async function refreshEventAndForm() {
        isFormDirty = false;
        lockedUpdatedAt = null;
        formResetNonce += 1;
        if (!eventQuery) return;
        if (!preferLiveQuery()) {
            await refreshRemoteResource(eventQuery);
        } else if ('reconnect' in eventQuery && (eventQuery.error || eventQuery.done || !eventQuery.connected)) {
            await eventQuery.reconnect();
        }
    }

    onMount(() => {
        if (!eventId) return;
        recordActiveItem("events", eventId);

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
                onRemoteChange: async (change) => {
                    const name = change.updatedBy?.name || change.updatedBy?.email || 'A collaborator';
                    if (!isFormDirty) {
                        room?.dismissRemoteChange();
                        await refreshEventAndForm();
                        toast.info(`${name} updated this event.`);
                    } else {
                        toast.info(`${name} updated this event while you are editing.`);
                    }
                },
                onReconnect: async () => {
                    if (!isFormDirty) {
                        await refreshEventAndForm();
                    }
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
        {#if deleteEventAction.pending || !eventQuery || (eventQuery.loading && !eventQuery.current)}
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
                                                const ok = await handleDelete({
                                                    ids: [event.id],
                                                    deleteFn: async (ids) => {
                                                        markLocalEntityMutation("event", ids);
                                                        return await deleteEventAction({ ids }).updates(listEvents, listEventsLive, readEvent, readEventLive);
                                                    },
                                                itemName: m.instance().toLowerCase(),
                                                });
                                                if (ok) await goto(getLastListUrl("events", "/events"));
                                            }}
                                        >
                                            <Trash2 size={14} class="mr-2" />
                                        {m.delete()}
                                        {m.instance()}
                                        </DropdownMenu.Item>
                                        {#if isMaterializedException(event)}
                                            <DropdownMenu.Item
                                                onclick={async () => {
                                                    if (!confirm(m.delete_exception_confirm())) return;
                                                    try {
                                                        markLocalEntityMutation("event", [event.id, eventId]);
                                                        const res = await deleteEventAction({
                                                            ids: [event.id],
                                                            deleteException: true,
                                                        }).updates(listEvents, listEventsLive, readEvent, readEventLive);
                                                        toast.success(m.exception_deleted());
                                                        const targetVirtualId = res?.revertedVirtualIds?.[0];
                                                        if (targetVirtualId) {
                                                            if (eventId === targetVirtualId) {
                                                                await refreshEventAndForm();
                                                            } else {
                                                                await goto(`/events/${targetVirtualId}`);
                                                            }
                                                        } else {
                                                            await goto(getLastListUrl("events", "/events"));
                                                        }
                                                    } catch (err: any) {
                                                        toast.error(
                                                            err?.message || m.failed_to_delete_exception(),
                                                        );
                                                    }
                                                }}
                                            >
                                                <RotateCcw size={14} class="mr-2" />
                                                {m.delete_exception()}
                                            </DropdownMenu.Item>
                                        {/if}
                                        <DropdownMenu.Item
                                            class="text-red-600"
                                            onclick={async () => {
                                                if (!confirm(m.delete_series_confirm())) return;
                                                try {
                                                    markLocalEntityMutation("event", [event.id, eventId]);
                                                    await deleteEventAction({ ids: [event.id], deleteSeries: true }).updates(listEvents, listEventsLive, readEvent, readEventLive);
                                                    toast.success(m.series_deleted());
                                                    await goto(getLastListUrl("events", "/events"));
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
                                        const ok = await handleDelete({
                                            ids: [event.id],
                                            deleteFn: async (ids) => {
                                                markLocalEntityMutation("event", ids);
                                                return await deleteEventAction({ ids }).updates(listEvents, listEventsLive, readEvent, readEventLive);
                                            },
                                        itemName: m.event_label(),
                                        });
                                        if (ok) await goto(getLastListUrl("events", "/events"));
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
                                onRefresh={refreshEventAndForm}
                                onDismiss={() => collab?.dismissRemoteChange()}
                            />
                        {/if}

                        <form
                            oninput={() => handleFormDirtyChange(true)}
                            onchange={() => handleFormDirtyChange(true)}
                            {...eventRf.preflight(updateEventSchema).enhance(async ({ submit }: any) => {
                                try {
                                    markLocalEntityMutation("event", [event.id, eventId]);
                                    const ok: any = await submit().updates(listEvents, listEventsLive, readEvent, readEventLive);
                                    const result: any = (eventRf as any).result;
                                    if (ok === false || result?.error || result?.success === false) {
                                        toast.error(
                                            result?.error?.message || result?.error || m.something_went_wrong(),
                                        );
                                        return;
                                    }
                                    handleFormDirtyChange(false);
                                    toast.success(m.successfully_saved());
                                    await goto(getLastListUrl("events", "/events"));
                                } catch (error: any) {
                                    toast.error(error?.message || m.something_went_wrong());
                                }
                            })}
                            class="space-y-6"
                        >
                            {#key `${event.id}:${isFormDirty ? (lockedUpdatedAt ?? "") : String(event.updatedAt ?? "")}:${formResetNonce}`}
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
                            <Button variant="secondary" href={getLastListUrl("events", "/events")} size="default">
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
                href={getLastListUrl("events", "/events")}
                button={m.back_to_events()}
            />
        {:else if eventQuery.error}
            <ErrorSection
                headline={m.event_not_found()}
                message={eventQuery.error?.message || m.event_not_found_message()}
                href={getLastListUrl("events", "/events")}
                button={m.back_to_events()}
            />
        {/if}
        {#snippet failed(error: unknown)}
            <ErrorSection
                headline={m.event_not_found()}
                message={m.event_not_found_message()}
                href={getLastListUrl("events", "/events")}
                button={m.back_to_events()}
            />
        {/snippet}
    </svelte:boundary>
{:else}
    <LoadingSection message={m.loading_event_data()} />
{/if}
