<script lang="ts">
    import { createEvent } from "../events.remote";
    import { createEventSchema } from "$lib/validations/events";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import EventsForm from "$lib/components/events/EventsForm.svelte";
    import { listLocations } from "../../locations/list.remote";
    import { listTags } from "../../tags/list.remote";
    import { listResourcesWithHierarchy } from "../../resources/list-with-hierarchy.remote";
    import { listContacts } from "../../contacts/list.remote";
    import { list as listSynchronizations } from "../../synchronizations/list.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { onMount } from "svelte";

    let rf = createEvent;

    let locations = $state<any[]>([]);
    let tags = $state<any[]>([]);
    let resources = $state<any[]>([]);
    let contacts = $state<any[]>([]);
    let synchronizations = $state<any[]>([]);

    onMount(async () => {
        const [locRes, tagRes, resRes, conRes, syncRes] = await Promise.all([
            listLocations({ page: 1, limit: 1000 }),
            listTags({ page: 1, limit: 1000 }),
            listResourcesWithHierarchy(),
            listContacts({ page: 1, limit: 1000 }),
            listSynchronizations({ page: 1, limit: 1000 }),
        ]);
        locations = locRes.data;
        tags = tagRes;
        resources = resRes;
        contacts = conRes.data;
        synchronizations = syncRes.data;
    });

    // Set defaults immediately to avoid singleton state persistence
    rf.fields.isPublic.set(true);
    rf.fields.guestsCanInviteOthers.set(true);
    rf.fields.guestsCanSeeOtherGuests.set(true);
    rf.fields.isAllDay.set(false);
    rf.fields.status.set("confirmed");

    // Local Timezone
    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    rf.fields.startTimeZone.set(localTimezone);
    rf.fields.endTimeZone.set(localTimezone);

    // Current Local Time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    rf.fields.startDate.set(`${year}-${month}-${day}`);
    rf.fields.startTime.set(`${hours}:${minutes}`);

    // End Time (1 hour later)
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    const endYear = end.getFullYear();
    const endMonth = String(end.getMonth() + 1).padStart(2, "0");
    const endDay = String(end.getDate()).padStart(2, "0");
    const endHours = String(end.getHours()).padStart(2, "0");
    const endMinutes = String(end.getMinutes()).padStart(2, "0");

    rf.fields.endDate.set(`${endYear}-${endMonth}-${endDay}`);
    rf.fields.endTime.set(`${endHours}:${endMinutes}`);
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb
            feature="events"
            current={m.create_item({ item: "Event" })}
        />

        <div class="flex items-center justify-between mb-8">
            <h1 class="text-3xl font-black text-gray-900">
                {m.create_item({ item: "Event" })}
            </h1>
        </div>

        <form
            {...rf
                .preflight(createEventSchema)
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
            <EventsForm
                {rf}
                {locations}
                {tags}
                {resources}
                {contacts}
                {synchronizations}
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
                    {m.create_item({ item: "Event" })}
                </AsyncButton>
            </div>
        </form>
    </div>
</div>
