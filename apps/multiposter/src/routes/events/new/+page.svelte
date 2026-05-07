<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
	import { createEvent } from "./create.remote";
	import { createEventSchema } from "$lib/validations/events";
	import EventForm from "$lib/components/events/EventForm.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { Button } from "$lib/components/ui/button";
</script>

<div class="max-w-3xl mx-auto px-4 py-8 text-left">
    <Breadcrumb
        feature="events"
        current={m.create_new({ item: m.feature_events_title() })}
    />

    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">
            {m.create_new({ item: m.feature_events_title() })}
        </h1>
    </div>

    <form
        {...createEvent
            .preflight(createEventSchema)
            .enhance(async ({ submit }: any) => {
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
            remoteFunction={createEvent}
        />

        <div class="flex gap-3 pt-4">
            <AsyncButton
                type="submit"
                loadingLabel={m.saving()}
                loading={createEvent.pending}
                class="px-8"
            >
                {m.create_item({ item: m.feature_events_title() })}
            </AsyncButton>
            <Button variant="secondary" href="/events" size="default">
                {m.cancel()}
            </Button>
        </div>
    </form>
</div>
