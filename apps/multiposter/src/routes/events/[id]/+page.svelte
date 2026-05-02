<script lang="ts">
    import { readEvent, updateEvent, deleteEvent } from "../events.remote";
    import { updateEventSchema } from "$lib/validations/events";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { Trash2 } from "@lucide/svelte";
    import { Button } from "$lib/components/ui/button";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import EventsForm from "$lib/components/events/EventsForm.svelte";
    import { listLocations } from "../../locations/list.remote";
    import { listTags } from "../../tags/list.remote";
    import { listResourcesWithHierarchy } from "../../resources/list-with-hierarchy.remote";
    import { listContacts } from "../../contacts/list.remote";
    import { list as listSynchronizations } from "../../synchronizations/list.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import { onMount, untrack } from "svelte";

    const eventId = String(page.params.id);
    let rf = updateEvent;

    let isLoading = $state(true);
    let error = $state<string | null>(null);
    let initialData = $state<any>(null);

    let locations = $state<any[]>([]);
    let tags = $state<any[]>([]);
    let resources = $state<any[]>([]);
    let contacts = $state<any[]>([]);
    let synchronizations = $state<any[]>([]);

    onMount(async () => {
        try {
            console.log("Loading event data for ID:", eventId);
            const [eventRes, locRes, tagRes, resRes, conRes, syncRes] =
                await Promise.all([
                    readEvent(eventId),
                    listLocations({ page: 1, limit: 1000 }),
                    listTags({ page: 1, limit: 1000 }),
                    listResourcesWithHierarchy(),
                    listContacts({ page: 1, limit: 1000 }),
                    listSynchronizations({ page: 1, limit: 1000 }),
                ]);
            console.log("Event data loaded successfully:", eventRes);

            initialData = eventRes;
            locations = locRes.data;
            tags = tagRes;
            resources = resRes;
            contacts = conRes.data;
            synchronizations = syncRes.data;

            if (initialData) {
                untrack(() => {
                    rf.fields.id.set(initialData.id);
                    rf.fields.summary.set(initialData.summary);
                    rf.fields.description.set(initialData.description || "");
                    rf.fields.status.set(initialData.status);
                    rf.fields.ticketPrice.set(initialData.ticketPrice || "");
                    rf.fields.isAllDay.set(initialData.isAllDay);
                    rf.fields.startTimeZone.set(
                        initialData.startTimeZone || "UTC",
                    );
                    rf.fields.endTimeZone.set(initialData.endTimeZone || "UTC");
                    rf.fields.isPublic.set(initialData.isPublic);
                    rf.fields.guestsCanInviteOthers.set(
                        initialData.guestsCanInviteOthers,
                    );
                    rf.fields.guestsCanSeeOtherGuests.set(
                        initialData.guestsCanSeeOtherGuests,
                    );
                    rf.fields.heroImage.set(initialData.heroImage || "");
                    rf.fields.tagIds.set(initialData.tagIds || []);
                    rf.fields.locationIds.set(initialData.locationIds || []);
                    rf.fields.resourceIds.set(initialData.resourceIds || []);
                    rf.fields.contactIds.set(initialData.contactIds || []);
                    rf.fields.syncIds.set(initialData.syncIds || []);
                    rf.fields.categoryBerlinDotDe.set(initialData.categoryBerlinDotDe || "");
                    (rf.fields as any).recurrence?.set(initialData.recurrence || []);

                    // Date/Time
                    if (initialData.startDateTime) {
                        const start = new Date(initialData.startDateTime);
                        rf.fields.startDate.set(
                            start.toISOString().split("T")[0],
                        );
                        rf.fields.startTime.set(
                            start.toTimeString().split(" ")[0].substring(0, 5),
                        );
                    }
                    if (initialData.endDateTime) {
                        const end = new Date(initialData.endDateTime);
                        rf.fields.endDate.set(end.toISOString().split("T")[0]);
                        rf.fields.endTime.set(
                            end.toTimeString().split(" ")[0].substring(0, 5),
                        );
                    }
                });
            } else {
                console.warn("Event loaded but initialData is null");
            }

            isLoading = false;
        } catch (e: any) {
            console.error("Failed to load event data:", e);
            error = e.body?.message || e.message || String(e);
            isLoading = false;
        }
    });

    async function handleDelete() {
        if (
            !confirm(
                m.delete_confirm?.({ item: "Event" }) ??
                    "Are you sure you want to delete this event?",
            )
        )
            return;
        if (await deleteEvent({ id: eventId as string })) {
            toast.success(m.successfully_saved?.() ?? "Event deleted");
            goto("/events");
        }
    }

    const idValue = $derived.by(() => {
        const val = rf.fields.id.value();
        return typeof val === "string" ? val : "";
    });
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        {#if isLoading}
            <LoadingSection message={m.loading_event_data()} />
        {:else if error}
            <ErrorSection
                headline={m.error()}
                message={error}
                href="/events"
                button={m.back_to_events()}
            />
        {:else}
            <Breadcrumb feature="events" current={initialData?.summary} />

            <div class="flex items-center justify-between mb-8">
                <h1 class="text-3xl font-black text-gray-900">
                    {m.edit_item({ item: "Event" })}
                </h1>
                <AsyncButton
                    variant="destructive"
                    loading={deleteEvent.pending}
                    onclick={handleDelete}
                    class="flex items-center gap-2"
                >
                    <Trash2 size={16} />
                    {m.delete()}
                </AsyncButton>
            </div>

            <form
                {...rf
                    .preflight(updateEventSchema)
                    .enhance(async ({ submit }: { submit: any }) => {
                        if (await submit()) {
                            toast.success(m.successfully_saved());
                            goto("/events");
                        } else {
                            toast.error(m.please_fix_validation());
                        }
                    })}
                class="space-y-8"
            >
                <input {...rf.fields.id.as("hidden", idValue)} />
                
                <EventsForm
                    {rf}
                    {locations}
                    {tags}
                    {resources}
                    {contacts}
                    {synchronizations}
                    {isLoading}
                />

                <!-- Actions -->
                <div class="flex items-center justify-end gap-4 pt-4">
                    <Button variant="ghost" onclick={() => history.back()}
                        >{m.cancel()}</Button
                    >
                    <AsyncButton
                        type="submit"
                        loading={rf.pending}
                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        {m.save_changes()}
                    </AsyncButton>
                </div>
            </form>
        {/if}
    </div>
</div>
