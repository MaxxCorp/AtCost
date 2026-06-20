<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
	import { readEvent } from "./read.remote";
	import { updateEvent } from "./update.remote";
    import { deleteEvents as deleteEventAction } from "../delete.remote";
	import { updateEventSchema } from "$lib/validations/events";
	import EventForm from "$lib/components/events/EventForm.svelte";
		    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { handleDelete } from "@ac/ui";
    import {
        Trash2,
        ChevronDown,
        RefreshCw,
    } from "@lucide/svelte";

	const eventId = $derived(page.params.id || "");
    const eventRf = $derived(updateEvent.for(eventId));
</script>

{#if browser}
    <svelte:boundary>
        {#if $effect.pending()}
            <LoadingSection message={m.loading_event_data()} />
        {/if}

        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#await readEvent(eventId) then event}
                {#if event}
                <div class="max-w-3xl mx-auto px-4 py-8 text-left">
                    <Breadcrumb
                feature="events"
                current={event.summary ??
                    m.create_new({ item: m.feature_events_title() })}
            />

            <div class="flex justify-between items-center mb-6">
                <h1 class="text-3xl font-bold">
                    {m.edit_item({ item: m.feature_events_title() })}
                </h1>
                
                {#if event.recurrence && (event.recurrence).length > 0 || event.seriesId || event.recurringEventId}
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
                                        await deleteEventAction({ ids: [event.id] });
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
                    <EventForm
                        remoteFunction={eventRf}
                        validationSchema={updateEventSchema}
                        isUpdating={true}
                        initialData={event}
                    />

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
        {/if}
            {/await}
        </div>
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
