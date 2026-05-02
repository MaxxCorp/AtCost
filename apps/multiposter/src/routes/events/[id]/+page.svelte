<script lang="ts">
    import { readEvent, updateEvent, deleteEvent } from "../events.remote";
    import { updateEventSchema } from "$lib/validations/events";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import {
        Calendar,
        Clock,
        MapPin,
        Tag,
        Users,
        Shield,
        Image as ImageIcon,
        Info,
        Trash2,
    } from "@lucide/svelte";
    import { Button } from "$lib/components/ui/button";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { listLocations } from "../../locations/list.remote";
    import { listTags } from "../../tags/list.remote";
    import { listResourcesWithHierarchy } from "../../resources/list-with-hierarchy.remote";
    import { listContacts } from "../../contacts/list.remote";
    import ImageUploader from "$lib/components/cms/ImageUploader.svelte";
    import RichTextEditor from "$lib/components/cms/RichTextEditor.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import * as Field from "$lib/components/ui/field";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
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

    onMount(async () => {
        try {
            console.log("Loading event data for ID:", eventId);
            const [eventRes, locRes, tagRes, resRes, conRes] =
                await Promise.all([
                    readEvent(eventId),
                    listLocations({ page: 1, limit: 1000 }),
                    listTags({ page: 1, limit: 1000 }),
                    listResourcesWithHierarchy(),
                    listContacts({ page: 1, limit: 1000 }),
                ]);
            console.log("Event data loaded successfully:", eventRes);

            initialData = eventRes;
            locations = locRes.data;
            tags = tagRes;
            resources = resRes;
            contacts = conRes.data;

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

    const timezones = Intl.supportedValuesOf
        ? Intl.supportedValuesOf("timeZone")
        : [];

    function toggleId(field: any, id: string) {
        const current = field.value || [];
        if (current.includes(id)) {
            field.set(current.filter((i: string) => i !== id));
        } else {
            field.set([...current, id]);
        }
    }

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

    // Safe accessors for reactive fields to avoid Proxy conversion issues
    const descriptionValue = $derived.by(() => {
        const v = rf.fields.description.value;
        const val = typeof v === "function" ? v() : v;
        return typeof val === "string" ? val : "";
    });
    const heroImageValue = $derived.by(() => {
        const v = rf.fields.heroImage.value;
        const val = typeof v === "function" ? v() : v;
        return typeof val === "string" ? val : "";
    });
    const isPublicValue = $derived(String(!!rf.fields.isPublic.value));
    const isAllDayValue = $derived(String(!!rf.fields.isAllDay.value));
    const guestsCanInviteOthersValue = $derived(
        !!(typeof rf.fields.guestsCanInviteOthers.value === "function"
            ? (rf.fields.guestsCanInviteOthers.value as any)()
            : rf.fields.guestsCanInviteOthers.value),
    );

    // Safe accessors for hidden fields
    const idValue = $derived.by(() => {
        const v = rf.fields.id.value;
        const val = typeof v === "function" ? v() : v;
        return typeof val === "string" ? val : "";
    });

    const recurrenceValue = $derived.by(() => {
        const v = (rf.fields as any).recurrence?.value;
        const val = typeof v === "function" ? v() : v;
        if (!val) return "";
        return Array.isArray(val) ? JSON.stringify(val) : String(val);
    });

    const remindersValue = $derived.by(() => {
        const v = (rf.fields as any).reminders?.value;
        const val = typeof v === "function" ? v() : v;
        if (!val) return "";
        return typeof val === "object" ? JSON.stringify(val) : String(val);
    });

    // Safe accessors for array fields
    const locationIdsValue = $derived.by(() => {
        const v = rf.fields.locationIds.value;
        const val = typeof v === "function" ? v() : v;
        return Array.isArray(val)
            ? val.map((id) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const tagIdsValue = $derived.by(() => {
        const v = rf.fields.tagIds.value;
        const val = typeof v === "function" ? v() : v;
        return Array.isArray(val)
            ? val.map((id) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const resourceIdsValue = $derived.by(() => {
        const v = rf.fields.resourceIds.value;
        const val = typeof v === "function" ? v() : v;
        return Array.isArray(val)
            ? val.map((id) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const contactIdsValue = $derived.by(() => {
        const v = rf.fields.contactIds.value;
        const val = typeof v === "function" ? v() : v;
        return Array.isArray(val)
            ? val.map((id) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const derivedEndDateTime = $derived.by(() => {
        const d = rf.fields.startDate.value;
        const t = rf.fields.startTime.value;
        if (!d || !t) return null;
        try {
            const date = new Date(`${d}T${t}`);
            date.setHours(date.getHours() + 1);
            return {
                date: date.toISOString().split("T")[0],
                time: date.toTimeString().split(" ")[0].substring(0, 5),
            };
        } catch (e) {
            return null;
        }
    });

    let hasAppliedInitialDerivation = $state(false);
    $effect(() => {
        if (isLoading) return;
        const current = derivedEndDateTime;
        if (!current) return;

        if (!hasAppliedInitialDerivation) {
            // Guard against overwriting initial data from DB on first load
            hasAppliedInitialDerivation = true;
            return;
        }

        untrack(() => {
            rf.fields.endDate.set(current.date);
            rf.fields.endTime.set(current.time);
        });
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
                <input
                    {...(rf.fields.isPublic as any).as("hidden", isPublicValue)}
                />
                <input
                    {...(rf.fields.isAllDay as any).as("hidden", isAllDayValue)}
                />
                <input
                    {...(rf.fields.guestsCanInviteOthers as any).as(
                        "hidden",
                        String(guestsCanInviteOthersValue),
                    )}
                />
                <input
                    {...(rf.fields.guestsCanSeeOtherGuests as any).as(
                        "hidden",
                        String(!!rf.fields.guestsCanSeeOtherGuests.value),
                    )}
                />

                {#if heroImageValue}
                    <input
                        {...(rf.fields.heroImage as any).as(
                            "hidden",
                            heroImageValue,
                        )}
                    />
                {/if}
                {#if descriptionValue}
                    <input
                        {...(rf.fields.description as any).as(
                            "hidden",
                            descriptionValue,
                        )}
                    />
                {/if}
                {#if recurrenceValue}
                    <input
                        {...(rf.fields as any).recurrence.as(
                            "hidden",
                            recurrenceValue,
                        )}
                    />
                {/if}
                {#if remindersValue}
                    <input
                        {...(rf.fields as any).reminders.as(
                            "hidden",
                            remindersValue,
                        )}
                    />
                {/if}

                {#each locationIdsValue as id, i}
                    {@const field = (rf.fields.locationIds as any)[i]}
                    {#if field}
                        <input {...field.as("hidden", id)} />
                    {/if}
                {/each}
                {#each tagIdsValue as id, i}
                    {@const field = (rf.fields.tagIds as any)[i]}
                    {#if field}
                        <input {...field.as("hidden", id)} />
                    {/if}
                {/each}
                {#each resourceIdsValue as id, i}
                    {@const field = (rf.fields.resourceIds as any)[i]}
                    {#if field}
                        <input {...field.as("hidden", id)} />
                    {/if}
                {/each}
                {#each contactIdsValue as id, i}
                    {@const field = (rf.fields.contactIds as any)[i]}
                    {#if field}
                        <input {...field.as("hidden", id)} />
                    {/if}
                {/each}

                <!-- Basic Information -->
                <section
                    class="bg-white shadow-sm border rounded-xl p-6 space-y-6"
                >
                    <div class="flex items-center gap-2 border-b pb-4 mb-4">
                        <Info size={20} class="text-blue-500" />
                        <h2 class="text-xl font-bold">
                            {m.basic_information()}
                        </h2>
                    </div>

                    <div class="space-y-4">
                        <Field.Field>
                            <Field.Label
                                >{m.title()}
                                <span class="text-red-500">*</span></Field.Label
                            >
                            <Input
                                {...rf.fields.summary.as("text")}
                                placeholder={m.title()}
                            />
                            <Field.Error errors={rf.fields.summary.issues()} />
                        </Field.Field>

                        <Field.Field>
                            <Field.Label>{m.description()}</Field.Label>
                            <RichTextEditor
                                value={descriptionValue}
                                onchange={(v) => rf.fields.description.set(v)}
                            />
                        </Field.Field>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field.Field>
                                <Field.Label>{m.status()}</Field.Label>
                                <select
                                    {...rf.fields.status.as("text")}
                                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="confirmed"
                                        >{m.confirmed()}</option
                                    >
                                    <option value="tentative"
                                        >{m.tentative()}</option
                                    >
                                    <option value="cancelled"
                                        >{m.cancelled()}</option
                                    >
                                </select>
                            </Field.Field>
                            <Field.Field>
                                <Field.Label>{m.ticket_price()}</Field.Label>
                                <Input
                                    {...rf.fields.ticketPrice.as("text")}
                                    placeholder="0.00"
                                />
                            </Field.Field>
                        </div>
                    </div>
                </section>

                <!-- Date and Time -->
                <section
                    class="bg-white shadow-sm border rounded-xl p-6 space-y-6"
                >
                    <div class="flex items-center gap-2 border-b pb-4 mb-4">
                        <Calendar size={20} class="text-green-500" />
                        <h2 class="text-xl font-bold">{m.date_and_time()}</h2>
                    </div>

                    <div class="space-y-4">
                        <div class="flex items-center gap-4">
                            <Label
                                class="flex items-center gap-2 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={isAllDayValue === "true"}
                                    onchange={(e) =>
                                        rf.fields.isAllDay.set(
                                            e.currentTarget.checked,
                                        )}
                                    class="w-4 h-4 rounded text-blue-600"
                                />
                                <span class="text-sm font-medium"
                                    >{m.all_day()}</span
                                >
                            </Label>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-4">
                                <h3
                                    class="text-sm font-black text-gray-500 uppercase tracking-wider"
                                >
                                    {m.start()}
                                </h3>
                                <div class="grid grid-cols-2 gap-2">
                                    <Field.Field>
                                        <Input
                                            {...rf.fields.startDate.as("date")}
                                        />
                                        <Field.Error
                                            errors={rf.fields.startDate.issues()}
                                        />
                                    </Field.Field>
                                    <Field.Field>
                                        <Input
                                            {...rf.fields.startTime.as("time")}
                                            disabled={isAllDayValue === "true"}
                                            class="disabled:bg-gray-100"
                                        />
                                    </Field.Field>
                                </div>
                                <select
                                    {...rf.fields.startTimeZone.as("text")}
                                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                >
                                    {#each timezones as tz}
                                        <option value={tz}>{tz}</option>
                                    {/each}
                                </select>
                            </div>

                            <div class="space-y-4">
                                <h3
                                    class="text-sm font-black text-gray-500 uppercase tracking-wider"
                                >
                                    {m.end()}
                                </h3>
                                <div
                                    class="grid grid-cols-1 md:grid-cols-2 gap-2"
                                >
                                    <Field.Field>
                                        <Input
                                            {...rf.fields.endDate.as("date")}
                                        />
                                    </Field.Field>
                                    <Field.Field>
                                        <Input
                                            {...rf.fields.endTime.as("time")}
                                            disabled={isAllDayValue === "true"}
                                            class="disabled:bg-gray-100"
                                        />
                                    </Field.Field>
                                </div>
                                <select
                                    {...rf.fields.endTimeZone.as("text")}
                                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                >
                                    {#each timezones as tz}
                                        <option value={tz}>{tz}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Media -->
                <section
                    class="bg-white shadow-sm border rounded-xl p-6 space-y-6"
                >
                    <div class="flex items-center gap-2 border-b pb-4 mb-4">
                        <ImageIcon size={20} class="text-purple-500" />
                        <h2 class="text-xl font-bold">{m.media()}</h2>
                    </div>

                    <Field.Field>
                        <ImageUploader
                            id="heroImage"
                            value={heroImageValue}
                            onchange={(v) => rf.fields.heroImage.set(v)}
                            label={m.hero_image()}
                        />
                    </Field.Field>
                </section>

                <!-- Associations -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Locations -->
                    <section
                        class="bg-white shadow-sm border rounded-xl p-6 space-y-4"
                    >
                        <div class="flex items-center gap-2 border-b pb-2">
                            <MapPin size={18} class="text-red-500" />
                            <h2 class="font-bold">{m.locations()}</h2>
                        </div>
                        <div class="max-h-48 overflow-y-auto space-y-2 pr-2">
                            {#each locations as loc}
                                <Label
                                    class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={locationIdsValue.includes(
                                            loc.id,
                                        )}
                                        onchange={() =>
                                            toggleId(
                                                rf.fields.locationIds,
                                                loc.id,
                                            )}
                                        class="w-4 h-4 rounded text-blue-600"
                                    />
                                    <span class="text-sm">{loc.name}</span>
                                </Label>
                            {/each}
                        </div>
                    </section>

                    <!-- Tags -->
                    <section
                        class="bg-white shadow-sm border rounded-xl p-6 space-y-4"
                    >
                        <div class="flex items-center gap-2 border-b pb-2">
                            <Tag size={18} class="text-indigo-500" />
                            <h2 class="font-bold">{m.tags()}</h2>
                        </div>
                        <div
                            class="max-h-48 overflow-y-auto flex flex-wrap gap-2 pr-2"
                        >
                            {#each tags as tag}
                                <button
                                    type="button"
                                    onclick={() =>
                                        toggleId(rf.fields.tagIds, tag.id)}
                                    class="px-3 py-1 rounded-full text-xs font-medium transition-all {tagIdsValue.includes(
                                        tag.id,
                                    )
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                                >
                                    {tag.name}
                                </button>
                            {/each}
                        </div>
                    </section>

                    <!-- Resources -->
                    <section
                        class="bg-white shadow-sm border rounded-xl p-6 space-y-4"
                    >
                        <div class="flex items-center gap-2 border-b pb-2">
                            <Shield size={18} class="text-orange-500" />
                            <h2 class="font-bold">
                                {m.feature_resources_title()}
                            </h2>
                        </div>
                        <div class="max-h-48 overflow-y-auto space-y-1 pr-2">
                            {#each resources as res}
                                <Label
                                    class="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                                    style="padding-left: {res.level * 1.5 +
                                        0.5}rem"
                                >
                                    <input
                                        type="checkbox"
                                        checked={resourceIdsValue.includes(
                                            res.id,
                                        )}
                                        onchange={() =>
                                            toggleId(
                                                rf.fields.resourceIds,
                                                res.id,
                                            )}
                                        class="w-4 h-4 rounded text-blue-600"
                                    />
                                    <span
                                        class="text-sm {res.level === 0
                                            ? 'font-bold'
                                            : 'text-gray-600'}">{res.name}</span
                                    >
                                </Label>
                            {/each}
                        </div>
                    </section>

                    <!-- Contacts -->
                    <section
                        class="bg-white shadow-sm border rounded-xl p-6 space-y-4"
                    >
                        <div class="flex items-center gap-2 border-b pb-2">
                            <Users size={18} class="text-cyan-500" />
                            <h2 class="font-bold">
                                {m.feature_contacts_title()}
                            </h2>
                        </div>
                        <div class="max-h-48 overflow-y-auto space-y-2 pr-2">
                            {#each contacts as con}
                                <Label
                                    class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={contactIdsValue.includes(
                                            con.id,
                                        )}
                                        onchange={() =>
                                            toggleId(
                                                rf.fields.contactIds,
                                                con.id,
                                            )}
                                        class="w-4 h-4 rounded text-blue-600"
                                    />
                                    <div class="flex flex-col">
                                        <span class="text-sm font-medium"
                                            >{con.displayName ||
                                                `${con.givenName || ""} ${con.familyName || ""}`}</span
                                        >
                                        {#if con.company}
                                            <span
                                                class="text-[10px] text-gray-400"
                                                >{con.company}</span
                                            >
                                        {/if}
                                    </div>
                                </Label>
                            {/each}
                        </div>
                    </section>
                </div>

                <!-- Settings -->
                <section
                    class="bg-white shadow-sm border rounded-xl p-6 space-y-6"
                >
                    <div class="flex items-center gap-2 border-b pb-4 mb-4">
                        <Shield size={20} class="text-red-500" />
                        <h2 class="text-xl font-bold">Settings</h2>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label
                            class="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <span class="text-sm font-bold text-gray-700"
                                >Public Event</span
                            >
                            <input
                                type="checkbox"
                                checked={isPublicValue === "true"}
                                onchange={(e) =>
                                    rf.fields.isPublic.set(
                                        e.currentTarget.checked,
                                    )}
                                class="w-5 h-5 rounded text-blue-600"
                            />
                        </Label>

                        <Label
                            class="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <span class="text-sm font-bold text-gray-700"
                                >Guests can invite others</span
                            >
                            <input
                                type="checkbox"
                                checked={guestsCanInviteOthersValue}
                                onchange={(e) =>
                                    rf.fields.guestsCanInviteOthers.set(
                                        e.currentTarget.checked,
                                    )}
                                class="w-5 h-5 rounded text-blue-600"
                            />
                        </Label>
                    </div>
                </section>

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
