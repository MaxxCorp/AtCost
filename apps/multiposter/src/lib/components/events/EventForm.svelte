<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { type Event, type Tag } from "@ac/validations";

    import AsyncButton from "#lib/components/ui/AsyncButton.svelte";
    import SyncCheckboxBlock from "#lib/components/sync/SyncCheckboxBlock.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "#lib/components/ui/button/index.js";
    import { handleDelete, EntityManager, LocationForm, translateIssue, matchContactSearch } from "@ac/ui";
    import { listResourcesWithHierarchy } from "../../../routes/resources/list-with-hierarchy.remote";
    import type { ResourceWithHierarchy } from "../../../routes/resources/list-with-hierarchy.remote";
    import ResourceForm from "#lib/components/resources/ResourceForm.svelte";
    import { createResource } from "../../../routes/resources/new/create.remote";
    import { updateResource } from "../../../routes/resources/[id]/update.remote";
    import { readResource } from "../../../routes/resources/[id]/read.remote";
    import { deleteResource as deleteResourceRemote } from "../../../routes/resources/[id]/delete.remote";
    import { listResources } from "../../../routes/resources/list.remote";
    import { createResourceSchema, updateResourceSchema } from "#lib/validations/resources.js";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { type Location } from "@ac/validations";

    import ContactForm from "#lib/components/contacts/ContactForm.svelte";
    import { onMount, type Snippet, untrack } from "svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Contact } from "@ac/validations";
    import TagForm from "@ac/ui/components/forms/TagForm.svelte";
    import { readTag } from "../../../routes/tags/[id]/read.remote";
        
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
        updateAssociationStatus as updateAssociationStatusRemote,
    } from "../../../routes/contacts/associate.remote";
    import { createContact } from "../../../routes/contacts/new/create.remote";
    import { updateContact } from "../../../routes/contacts/[id]/update.remote";
    import { readContact } from "../../../routes/contacts/[id]/read.remote";
    import { createContactSchema, updateContactSchema } from "@ac/validations";
    import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { readLocation } from "../../../routes/locations/[id]/read.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import {
        addLocationAssociation,
        removeLocationAssociation,
        fetchEntityLocations,
    } from "../../../routes/locations/associate.remote";
    import {
        addResourceAssociation,
        removeResourceAssociation,
        fetchEntityResources,
    } from "../../../routes/resources/associate.remote";
    import RichTextEditor from "#lib/components/cms/RichTextEditor.svelte";
    import ImageUploader from "#lib/components/cms/ImageUploader.svelte";
    import RecurrenceDialog from "#lib/components/events/RecurrenceDialog.svelte";
    import SeriesModeSelector from "#lib/components/events/SeriesModeSelector.svelte";
    import { formatRecurrenceText } from "#lib/utils/format-recurrence.js";
    import { isSeriesItem } from "#lib/utils/event-series.js";
    import {
        RefreshCw,
        CalendarClock,
        User,
        Users,
        Plus,
        Minus,
        MapPin,
        Tag as TagIcon,
        Database,
        Loader2,
        ExternalLink,
        Utensils,
        Calculator,
    } from "@lucide/svelte";
    import { listTags as listTagsRemote } from "../../../routes/tags/list.remote";
    import { createTag as createTagRemote } from "../../../routes/tags/new/create.remote";
    import { updateTag as updateTagRemote } from "../../../routes/tags/[id]/update.remote";
    import { deleteTag as deleteTagRemote } from "../../../routes/tags/[id]/delete.remote";
    import { listMenus } from "../../../routes/menus/list.remote";
    import {
        addMenuAssociation,
        removeMenuAssociation,
        fetchEntityMenus,
    } from "../../../routes/menus/associate.remote";
    import { createMenu } from "../../../routes/menus/new/create.remote";
    import { updateMenu } from "../../../routes/menus/[id]/update.remote";
    import { readMenu } from "../../../routes/menus/[id]/read.remote";
    import { deleteMenus } from "../../../routes/menus/[id]/delete.remote";
    import { createMenuSchema, updateMenuSchema } from "@ac/validations";
    import MenuForm from "#lib/components/menus/MenuForm.svelte";
    import * as v from "valibot";
    import { FieldCollaboratorBadge, type CollaborationRoom } from "#lib/client/collaboration/index.js";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        collab = null,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: Event | null;
        collab?: CollaborationRoom | null;
    } = $props();

    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);
    const type = "event";

    function getCollaboratorStyle(fieldName: string) {
        const peer = collab?.getFieldCollaborator(fieldName);
        if (!peer) return undefined;
        return `border-color: ${peer.color.border}; box-shadow: 0 0 0 2px ${peer.color.ring};`;
    }

    function getCollaboratorOutlineStyle(fieldName: string) {
        const peer = collab?.getFieldCollaborator(fieldName);
        if (!peer) return undefined;
        return `outline: 2px solid ${peer.color.border}; box-shadow: 0 0 0 3px ${peer.color.ring};`;
    }
    const BERLIN_DE_CATEGORIES = [
        "Ausstellung",
        "Berliner BÃ¼hnen",
        "Bildung",
        "Feste",
        "Freizeit",
        "Kinder",
        "Kino",
        "Klassik",
        "Konzerte",
        "Literatur",
        "Messen",
        "Party",
        "Rund ums Haus",
        "Sport",
        "Sonstiges",
    ];

    function parseDateTime(dt: string | null | undefined, timeZone?: string | null) {
        if (!dt) return { date: "", time: "" };
        try {
            const d = new Date(dt);
            if (isNaN(d.getTime())) return { date: "", time: "" };
            const tz = timeZone || browserTimezone;
            if (tz) {
                try {
                    const formatter = new Intl.DateTimeFormat("en-CA", {
                        timeZone: tz,
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                    });
                    const parts = formatter.formatToParts(d);
                    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
                    const year = getPart("year");
                    const month = getPart("month");
                    const day = getPart("day");
                    let hours = getPart("hour");
                    if (hours === "24") hours = "00";
                    const minutes = getPart("minute");
                    if (year && month && day && hours && minutes) {
                        return {
                            date: `${year}-${month}-${day}`,
                            time: `${hours}:${minutes}`,
                        };
                    }
                } catch {
                    // Fallback to local
                }
            }
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const hours = String(d.getHours()).padStart(2, "0");
            const minutes = String(d.getMinutes()).padStart(2, "0");
            return {
                date: `${year}-${month}-${day}`,
                time: `${hours}:${minutes}`,
            };
        } catch {
            return { date: "", time: "" };
        }
    }

    function getLocalNow() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
    }

    function getInitialEndDateTime(
        startParsed: any,
        endParsed: any,
        localNow: any,
    ) {
        if (endParsed.date)
            return { date: endParsed.date, time: endParsed.time || "" };

        const startDate = startParsed.date || localNow.date;
        const startTime = startParsed.time || localNow.time;
        const start = new Date(`${startDate}T${startTime}:00`);
        if (isNaN(start.getTime())) return { date: "", time: "" };

        const end = new Date(start.getTime() + 60 * 60000);
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, "0");
        const day = String(end.getDate()).padStart(2, "0");
        const hours = String(end.getHours()).padStart(2, "0");
        const minutes = String(end.getMinutes()).padStart(2, "0");

        return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
    }

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const startParsed = $derived(parseDateTime(initialData?.startDateTime, initialData?.startTimeZone));
    const endParsed = $derived(parseDateTime(initialData?.endDateTime, initialData?.endTimeZone || initialData?.startTimeZone));
    const localNow = getLocalNow();
    const initialEnd = $derived(
        getInitialEndDateTime(startParsed, endParsed, localNow),
    );

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        untrack(() => {
            if (issues.length > 0 && prevIssuesLength === 0) {
                toast.error(m.please_fix_validation());
            }
            prevIssuesLength = issues.length;
        });
    });

    let showRecurrenceDialog = $state(false);

    // Date/Time handling
    const timezones = Intl.supportedValuesOf
        ? Intl.supportedValuesOf("timeZone")
        : [];

    function updateEndDateTime(e: globalThis.Event, isDate: boolean) {
        const target = e.target as HTMLInputElement;
        const newVal = target.value;
        const currentStartDate = rf.fields.startDate.value() || startParsed.date || localNow.date;
        const currentStartTime = rf.fields.startTime.value() || startParsed.time || localNow.time;
        
        const startDate = isDate ? newVal : currentStartDate;
        const startTime = !isDate ? newVal : currentStartTime;
        
        if (!startDate || !startTime) return;

        const start = new Date(`${startDate}T${startTime}:00`);
        if (isNaN(start.getTime())) return;

        const end = new Date(start.getTime() + 60 * 60000);
        
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, "0");
        const day = String(end.getDate()).padStart(2, "0");
        const hours = String(end.getHours()).padStart(2, "0");
        const minutes = String(end.getMinutes()).padStart(2, "0");

        rf.fields.endDate.set(`${year}-${month}-${day}`);
        rf.fields.endTime.set(`${hours}:${minutes}`);
    }

    function getDefaultEndTime(rf: any) {
        const startDate = rf.fields.startDate.value();
        const startTime = rf.fields.startTime.value();
        if (!startDate || !startTime) return "";
        const start = new Date(`${startDate}T${startTime}:00`);
        const end = new Date(start.getTime() + 60 * 60000);
        return end.toTimeString().slice(0, 5);
    }

    function addReminder(rf: any) {
        const currentReminders =
            rf.fields.reminders.overrides.value() ?? [];
        rf.fields.reminders.overrides.set([
            ...currentReminders,
            { method: "popup", minutes: 10 },
        ]);
    }

    function removeReminder(rf: any, index: number) {
        const currentReminders =
            rf.fields.reminders.overrides.value() ?? [];
        rf.fields.reminders.overrides.set(
            currentReminders.filter((_: any, i: number) => i !== index),
        );
    }

    let recurrenceText = $derived(
        rf.fields.recurrence.value()
            ? formatRecurrenceText(rf.fields.recurrence.value() as string)
            : m.recurrence(),
    );

    let isSeries = $derived(
        Boolean(
            (rf.fields.recurrence.value() && String(rf.fields.recurrence.value()).trim() !== "") ||
            (initialData?.recurrence && initialData.recurrence.length > 0) ||
            initialData?.seriesId ||
            isSeriesItem(initialData)
        )
    );

    let isAllDay = $derived(
        rf.fields.isAllDay.value() !== undefined
            ? (rf.fields.isAllDay.value() === true ||
               rf.fields.isAllDay.value() === "true" ||
               rf.fields.isAllDay.value() === "on")
            : (initialData?.isAllDay ?? false),
    );

    let useDefaultReminders = $derived(
        rf.fields.reminders.useDefault.value() !== undefined
            ? (rf.fields.reminders.useDefault.value() === true ||
               rf.fields.reminders.useDefault.value() === "true" ||
               rf.fields.reminders.useDefault.value() === "on")
            : ((initialData?.reminders as any)?.useDefault ?? true),
    );
    let reminders = $derived(
        rf.fields.reminders.overrides.value() ?? [],
    );

    import { checkEventAvailability } from "../../../routes/events/availability/check.remote";

    let isTicketPriceUnknown = $derived(
        rf.fields.ticketPriceUnknown.value() !== undefined
            ? (rf.fields.ticketPriceUnknown.value() === true ||
               rf.fields.ticketPriceUnknown.value() === "true" ||
               rf.fields.ticketPriceUnknown.value() === "on")
            : (initialData?.id ? !!initialData.ticketPriceUnknown : true),
    );

    let resourceAvailability = $state<Record<string, { available: boolean; reason?: string; eventId?: string; eventTitle?: string }>>({});
    let contactAvailability = $state<Record<string, { available: boolean; reason?: string; eventId?: string; eventTitle?: string }>>({});
    let availabilityLoading = $state(false);

    function hasAllocationCalendars(resItem: any): boolean {
        if (!resItem || !resItem.allocationCalendars) return false;
        let cals = resItem.allocationCalendars;
        if (typeof cals === 'string') {
            try { cals = JSON.parse(cals); } catch { return false; }
        }
        return Array.isArray(cals) && cals.length > 0;
    }

    const currentStartDateVal = $derived(rf.fields.startDate.value() || startParsed.date || localNow.date);
    const currentStartTimeVal = $derived(rf.fields.startTime.value() || startParsed.time || localNow.time);
    const currentEndDateVal = $derived(rf.fields.endDate.value() || initialEnd.date || currentStartDateVal);
    const currentEndTimeVal = $derived(rf.fields.endTime.value() || initialEnd.time || currentStartTimeVal);

    const activeStartIso = $derived.by(() => {
        if (!currentStartDateVal) return '';
        const timeStr = isAllDay ? '00:00:00' : `${currentStartTimeVal || '00:00'}:00`;
        const d = new Date(`${currentStartDateVal}T${timeStr}`);
        return isNaN(d.getTime()) ? '' : d.toISOString();
    });

    const activeEndIso = $derived.by(() => {
        if (!currentEndDateVal) return '';
        const timeStr = isAllDay ? '23:59:59' : `${currentEndTimeVal || '23:59'}:00`;
        const d = new Date(`${currentEndDateVal}T${timeStr}`);
        return isNaN(d.getTime()) ? '' : d.toISOString();
    });

    let lastQueryKey = '';

    function refreshAvailability() {
        const startIso = activeStartIso;
        const endIso = activeEndIso;
        if (!startIso || !endIso) return;
        availabilityLoading = true;
        checkEventAvailability({
            startDateTime: startIso,
            endDateTime: endIso,
            eventId: initialData?.id
        }).then((res) => {
            if (res) {
                resourceAvailability = res.resourceAvailability || {};
                contactAvailability = res.contactAvailability || {};
            }
            availabilityLoading = false;
        }).catch((err) => {
            console.error('[EventForm] availability error:', err);
            availabilityLoading = false;
        });
    }

    $effect(() => {
        const startIso = activeStartIso;
        const endIso = activeEndIso;
        const queryKey = `${startIso}_${endIso}_${initialData?.id || 'new'}`;

        if (!startIso || !endIso || queryKey === lastQueryKey) return;
        lastQueryKey = queryKey;

        untrack(() => {
            refreshAvailability();
        });
    });

    $effect(() => {
        if (typeof window === 'undefined') return;
        const handleFocus = () => {
            refreshAvailability();
        };
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    });

    // svelte-ignore state_referenced_locally
    const initialContacts = (initialData?.contactIds ?? []) as string[];
    let currentContactIds = $state<string[]>(initialContacts);

    // svelte-ignore state_referenced_locally
    const rawInitialParticipants = initialData?.participantsCount;
    const initialParticipants = typeof rawInitialParticipants === 'number'
        ? rawInitialParticipants
        : (rawInitialParticipants ? parseInt(String(rawInitialParticipants), 10) : undefined);

    let baseline = $state<number>(
        initialParticipants !== undefined
            ? Math.max(0, initialParticipants - initialContacts.length)
            : 0
    );

    let totalParticipants = $derived(baseline + currentContactIds.length);
    // svelte-ignore state_referenced_locally
    let currentMenus = $state<any[]>(initialData?.menus || []);

    function updateBaseline(delta: number) {
        baseline = Math.max(0, baseline + delta);
        rf.fields.participantsCount.set(baseline + currentContactIds.length);
    }

    function handleParticipantsInput(e: globalThis.Event) {
        const target = e.target as HTMLInputElement;
        const val = parseInt(target.value, 10);
        if (!isNaN(val)) {
            baseline = Math.max(0, val - currentContactIds.length);
            rf.fields.participantsCount.set(baseline + currentContactIds.length);
        }
    }
</script>

<datalist id="timezones">
    {#each timezones as tz}
        <option value={tz}></option>
    {/each}
</datalist>

{#if initialData?.id}
    <input {...rf.fields.id.as("text", initialData.id)} class="hidden" />
{/if}

<input
    {...rf.fields.tags.as(
        "text",
        (initialData?.tags ?? []).map((t) => t.name).join(", "),
    )}
    class="hidden"
/>

<div class="bg-white shadow rounded-lg p-6 space-y-4">
    <h2 class="text-xl font-semibold mb-4 border-b pb-2">
        {m.basic_information()}
    </h2>

    <div>
        <div class="flex items-center justify-between mb-1">
            <label
                for="summary"
                class="block text-sm font-medium text-gray-700"
            >
                {m.title()} <span class="text-red-500">*</span>
            </label>
            <FieldCollaboratorBadge collaborator={collab?.getFieldCollaborator('summary')} />
        </div>
        <input
            {...rf.fields.summary.as("text", initialData?.summary ?? "")}
            required
            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.summary.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            style={getCollaboratorStyle('summary')}
            placeholder={m.title()}
            onfocus={() => collab?.setFocus('summary')}
            onblur={() => {
                collab?.setFocus(null);
                rf.validate();
            }}
        />
        {#each rf.fields.summary.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <div>
        <label
            for="status"
            class="block text-sm font-medium text-gray-700 mb-1"
        >
            {m.status()}
        </label>
        <select
            {...rf.fields.status.as("text", initialData?.status ?? "confirmed")}
            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
        >
            <option value="confirmed">{m.confirmed()}</option>
            <option value="tentative">{m.tentative()}</option>
            <option value="cancelled">{m.cancelled()}</option>
        </select>
    </div>

    <div class="border-t pt-4 space-y-4">
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">
            {m.date_and_time()}
        </h2>

        <div class="flex items-center gap-2">
            <input
                {...rf.fields.isAllDay.as(
                    "checkbox",
                    initialData?.isAllDay ?? false,
                )}
                id="isAllDay"
                class="w-4 h-4 text-blue-600"
            />
            <label for="isAllDay" class="text-sm font-medium text-gray-700"
                >{m.all_day_event()}</label
            >
        </div>

        <div class="grid grid-cols-1 gap-6">
            <!-- Start Block -->
            <div class="space-y-4">
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label
                            for="startDate"
                            class="block text-sm font-medium text-gray-700"
                            >{m.start_date()}
                            <span class="text-red-500">*</span></label
                        >
                        <FieldCollaboratorBadge collaborator={collab?.getFieldCollaborator('startDate')} />
                    </div>
                    <input
                        {...rf.fields.startDate.as(
                            "date",
                            startParsed.date || localNow.date,
                        )}
                        required
                        onfocus={() => collab?.setFocus('startDate')}
                        onblur={() => collab?.setFocus(null)}
                        oninput={(e) => updateEndDateTime(e, true)}
                        style={getCollaboratorStyle('startDate')}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
                {#if !isAllDay}
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label
                                for="startTime"
                                class="block text-sm font-medium text-gray-700"
                                >{m.start_time()}
                                <span class="text-red-500">*</span></label
                            >
                            <FieldCollaboratorBadge collaborator={collab?.getFieldCollaborator('startTime')} />
                        </div>
                        <input
                            {...rf.fields.startTime.as(
                                "time",
                                startParsed.time || localNow.time,
                            )}
                            required
                            onfocus={() => collab?.setFocus('startTime')}
                            onblur={() => collab?.setFocus(null)}
                            oninput={(e) => updateEndDateTime(e, false)}
                            style={getCollaboratorStyle('startTime')}
                            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        />
                    </div>
                {/if}
                <div>
                    <label
                        for="startTimeZone"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >{m.timezone()}</label
                    >
                    <input
                        {...rf.fields.startTimeZone.as(
                            "text",
                            initialData?.startTimeZone || browserTimezone,
                        )}
                        list="timezones"
                        placeholder={browserTimezone}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
            </div>

            <!-- End Block -->
            <div class="space-y-4">
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label
                            for="endDate"
                            class="block text-sm font-medium text-gray-700"
                            >{m.end_date()}
                            <span class="text-red-500">*</span></label
                        >
                        <FieldCollaboratorBadge collaborator={collab?.getFieldCollaborator('endDate')} />
                    </div>
                    <input
                        {...rf.fields.endDate.as("date", initialEnd.date)}
                        placeholder={rf.fields.startDate.value()}
                        required
                        onfocus={() => collab?.setFocus('endDate')}
                        onblur={() => collab?.setFocus(null)}
                        style={getCollaboratorStyle('endDate')}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
                {#if !isAllDay}
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label
                                for="endTime"
                                class="block text-sm font-medium text-gray-700"
                                >{m.end_time()}
                                <span class="text-red-500">*</span></label
                            >
                            <FieldCollaboratorBadge collaborator={collab?.getFieldCollaborator('endTime')} />
                        </div>
                        <input
                            {...rf.fields.endTime.as("time", initialEnd.time)}
                            placeholder={getDefaultEndTime(rf)}
                            required
                            onfocus={() => collab?.setFocus('endTime')}
                            onblur={() => collab?.setFocus(null)}
                            style={getCollaboratorStyle('endTime')}
                            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        />
                    </div>
                {/if}
                <div>
                    <label
                        for="endTimeZone"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >{m.end_time()} {m.timezone()}</label
                    >
                    <input
                        {...rf.fields.endTimeZone.as(
                            "text",
                            initialData?.endTimeZone ||
                                initialData?.startTimeZone ||
                                browserTimezone,
                        )}
                        list="timezones"
                        placeholder={rf.fields.startTimeZone.value()}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
            </div>
        </div>

        <!-- Recurrence Button -->
        <div class="pt-4 border-t flex flex-wrap items-center justify-between gap-4">
            <button
                type="button"
                class="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                onclick={() => (showRecurrenceDialog = true)}
            >
                <RefreshCw size={16} />
                <span class="text-left">{recurrenceText}</span>
            </button>

            {#if initialData}
                <SeriesModeSelector
                    event={initialData}
                    variant="inline"
                />
            {/if}
        </div>
    </div>

    <RecurrenceDialog
        bind:open={showRecurrenceDialog}
        value={rf.fields.recurrence.value() ?? initialData?.recurrence?.[0] ?? ""}
        onchange={(val: string) => rf.fields.recurrence.set(val)}
    />
    {#if (rf.fields.recurrence.value() ?? initialData?.recurrence?.[0]) !== undefined && (rf.fields.recurrence.value() ?? initialData?.recurrence?.[0]) !== null}
        <input
            {...rf.fields.recurrence.as("text", initialData?.recurrence?.[0] ?? "")}
            class="hidden"
        />
    {/if}

    <div>
        <ImageUploader
            value={rf.fields.heroImage.value() ?? initialData?.heroImage ?? ""}
            onchange={(val: string) => rf.fields.heroImage.set(val)}
            label={m.hero_image()}
        />
        {#if (rf.fields.heroImage.value() ?? initialData?.heroImage) !== undefined && (rf.fields.heroImage.value() ?? initialData?.heroImage) !== null}
            <input
                {...rf.fields.heroImage.as("text", initialData?.heroImage ?? "")}
                class="hidden"
            />
        {/if}
    </div>

    <div>
        <div class="flex items-center justify-between mb-1">
            <label
                for="description"
                class="block text-sm font-medium text-gray-700"
                >{m.description()}</label
            >
            <FieldCollaboratorBadge collaborator={collab?.getFieldCollaborator('description')} />
        </div>
        <div
            class="prose max-w-none rounded-md transition-shadow"
            style={getCollaboratorOutlineStyle('description')}
            onfocusin={() => collab?.setFocus('description')}
            onfocusout={() => collab?.setFocus(null)}
        >
            <RichTextEditor 
                value={rf.fields.description.value() ?? initialData?.description ?? ""} 
                onchange={(v: string) => rf.fields.description.set(v)}
            />
            {#if (rf.fields.description.value() ?? initialData?.description) !== undefined && (rf.fields.description.value() ?? initialData?.description) !== null}
                <input
                    {...rf.fields.description.as("text", initialData?.description ?? "")}
                    class="hidden"
                />
            {/if}
        </div>
    </div>

    <div>
        <label
            for="internalNotes"
            class="block text-sm font-medium text-gray-700 mb-1"
            >{m.internal_notes()}</label
        >
        <div class="prose max-w-none">
            <RichTextEditor 
                value={rf.fields.internalNotes.value() ?? initialData?.internalNotes ?? ""} 
                onchange={(v: string) => rf.fields.internalNotes.set(v)}
            />
            {#if (rf.fields.internalNotes.value() ?? initialData?.internalNotes) !== undefined && (rf.fields.internalNotes.value() ?? initialData?.internalNotes) !== null}
                <input
                    {...rf.fields.internalNotes.as("text", initialData?.internalNotes ?? "")}
                    class="hidden"
                />
            {/if}
        </div>
    </div>

    <div>
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <TagIcon size={18} class="text-blue-600" />
            {m.tags()}
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager {m}
            title={m.tags()}
            icon={TagIcon}
            mode="embedded"
            initialItems={initialData?.tags || []}
            listItemsRemote={listTagsRemote}
            onchange={(ids: any, items: any[]) => {
                rf.fields.tags.set(items.map((i: any) => i.name).join(", "));
            }}
            createRemote={createTagRemote}
            createSchema={v.object({
                name: v.pipe(v.string(), v.minLength(1)),
            })}
            updateRemote={updateTagRemote}
            updateSchema={v.object({
                name: v.pipe(v.string(), v.minLength(1)),
            })}
            deleteItemRemote={async (ids: string[]) => {
                return await handleDelete({
                    ids,
                    deleteFn: deleteTagRemote,
                    itemName: m.tags(),
                });
            }}
            readItemRemote={readTag}
            searchPredicate={(t: any, q: string) =>
                t.name.toLowerCase().includes(q.toLowerCase())}
            loadingLabel={m.loading_item({ item: m.tags() })}
            noItemsLabel={m.no_items_associated_label({ item: m.tags() })}
            noItemsFoundLabel={m.no_items_found({ item: m.tags() })}
            searchPlaceholder={m.search_placeholder({ item: m.tags() })}
            linkItemLabel={m.link_item_label({ item: m.tags() })}
            associatedItemLabel={m.associated_item_label({
                item: m.tags(),
            })}
            quickCreateLabel={m.quick_create()}
            closeSearchLabel={m.close_search()}
            editLabel={m.edit()}
            deleteLabel={m.delete()}
            unlinkLabel={m.unlink()}
            deleteForeverLabel={m.delete_forever({ item: m.tag() })}
            confirmUnlinkLabel={m.confirm_unlink_label({ item: m.tag() })}
            selectAllLabel={m.select_all()}
            deselectAllLabel={m.deselect_all()}
        >
            {#snippet renderItemLabel(tag: any)}
                {tag.name}
            {/snippet}
            {#snippet renderForm({
                remoteFunction: rfState,
                schema,
                initialData: formData,
                onSuccess,
                onCancel,
                id,
            }: any)}
                <TagForm
                    remoteFunction={rfState}
                    validationSchema={schema}
                    initialData={formData}
                    isUpdating={!!id}
                    {onSuccess}
                    {onCancel}
                    {m}
                />
            {/snippet}
        </EntityManager>
        {/key}
    </div>

    <div>
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <Database size={18} class="text-blue-600" />
            {m.feature_resources_title()} ({m.optional()})
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager {m}
                title={m.feature_resources_title()}
                icon={Database}
                mode="embedded"
                type="event"
                entityId={initialData?.id}
                initialItems={initialData?.resources || []}
                listItemsRemote={listResourcesWithHierarchy as any}
                fetchAssociationsRemote={fetchEntityResources as any}
                selectorGroupBy={(r: any) => (r.locationNames?.length ? r.locationNames : (r.locationName || m.no_location?.() || "No Location"))}
                selectorSortField="maxOccupancy"
                selectorSortOrder="desc"
                groupIcon={MapPin}
                addAssociationRemote={async (p: any) => {
                    const res = await addResourceAssociation({ ...p, resourceId: p.itemId } as any);
                    if (res?.success) toast.success(m.resource_synced_success());
                    else toast.error(m.resource_sync_failed());
                    return res;
                }}
                removeAssociationRemote={async (p: any) => {
                    const res = await removeResourceAssociation({ ...p, resourceId: p.itemId } as any);
                    if (res?.success) toast.success(m.resource_unlinked_sync_cleaned());
                    else toast.error(m.resource_sync_failed());
                    return res;
                }}
                onchange={(ids: string[]) =>
                    rf.fields.resourceIds.set(JSON.stringify(ids))}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteResourceRemote,
                        itemName: m.feature_resources_title().toLowerCase(),
                    });
                }}
                createRemote={createResource}
                createSchema={createResourceSchema}
                updateRemote={updateResource}
                updateSchema={updateResourceSchema}
                readItemRemote={readResource}
                searchPredicate={(r: any, q: string) =>
                    r.name.toLowerCase().includes(q.toLowerCase())}
                loadingLabel={m.loading_item({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                noItemsLabel={m.no_items_associated_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                noItemsFoundLabel={m.no_items_found({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                searchPlaceholder={m.search_placeholder({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                linkItemLabel={m.link_item_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                associatedItemLabel={m.associated_item_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                deleteForeverLabel={m.delete_forever({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                confirmUnlinkLabel={m.confirm_unlink_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
            >
                {#snippet renderItemLabel(resItem: any)}
                    {@const hasSyncs = hasAllocationCalendars(resItem)}
                    <span style="padding-left: {(resItem.level || 0) * 12}px" class="inline-flex items-center gap-2 flex-wrap">
                        <span
                            class="inline-block w-[3.5ch] text-right font-mono text-xs text-gray-500 tabular-nums shrink-0"
                            title={resItem.maxOccupancy != null ? `${m.max_occupancy()}: ${resItem.maxOccupancy}` : ""}
                        >
                            {resItem.maxOccupancy != null ? resItem.maxOccupancy : ""}
                        </span>
                        <span>{resItem.name}</span>
                        <span class="text-xs text-gray-500 font-normal">
                            ({resItem.type === "room"
                                ? m.room_type_suffix()
                                : m.equipment_type_suffix()})
                        </span>
                        {#if hasSyncs}
                            {@const avail = resourceAvailability[resItem.id]}
                            {#if availabilityLoading && !avail}
                                <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">
                                    <Loader2 size={12} class="animate-spin text-blue-600" />
                                    {m.checking_availability()}
                                </span>
                            {:else if avail && !avail.available}
                                {#if avail.eventId}
                                    <a
                                        href={`/events/${avail.eventId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium hover:bg-red-200 hover:text-red-900 transition-colors underline-offset-2 hover:underline"
                                        title={avail.reason || (avail.eventTitle ? `${m.busy_conflict()}: ${avail.eventTitle}` : m.conflict_details())}
                                        onclick={(e) => e.stopPropagation()}
                                    >
                                        <span>🔴</span>
                                        <span class="max-w-[200px] truncate">
                                            {avail.eventTitle || m.busy_conflict()}
                                        </span>
                                        <ExternalLink size={12} class="shrink-0 opacity-70" />
                                    </a>
                                {:else}
                                    <span
                                        class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium"
                                        title={avail.reason || (avail.eventTitle ? `${m.busy_conflict()}: ${avail.eventTitle}` : m.conflict_details())}
                                    >
                                        <span>🔴</span>
                                        <span class="max-w-[200px] truncate">
                                            {avail.eventTitle || m.busy_conflict()}
                                        </span>
                                    </span>
                                {/if}
                            {:else}
                                <span class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium" title={m.available()}>
                                    🟢 {m.available()}
                                </span>
                            {/if}
                        {/if}
                    </span>
                {/snippet}
                {#snippet renderForm({
                    remoteFunction: rfForm,
                    schema,
                    id,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                }: any)}
                    {#await Promise.all([listLocations(), listResources()])}
                        <div class="p-4 flex justify-center">
                            <LoadingSection />
                        </div>
                    {:then [locs, ress]}
                        <div class="p-4">
                            <ResourceForm
                                remoteFunction={rfForm}
                                validationSchema={schema}
                                isUpdating={!!id}
                                initialData={formData}
                                {onSuccess}
                                {onCancel}
                                locations={locs.data}
                                allResources={ress.data}
                            />
                        </div>
                    {:catch error}
                        <div class="p-4 border border-dashed rounded-lg text-sm text-red-500 text-center">
                            {error.message || m.something_went_wrong()}
                        </div>
                    {/await}
                {/snippet}
            </EntityManager>
        {/key}
        <input
            {...rf.fields.resourceIds.as(
                "text",
                JSON.stringify(initialData?.resourceIds || []),
            )}
            class="hidden"
        />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
            <label
                for="categoryBerlinDotDe"
                class="block text-sm font-medium text-gray-700 mb-1"
            >
                {m.berlin_de_category()}
            </label>
            <select
                {...rf.fields.categoryBerlinDotDe.as(
                    "text",
                    initialData?.categoryBerlinDotDe ?? "",
                )}
                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
            >
                <option value="">{m.select_category()}</option>
                {#each BERLIN_DE_CATEGORIES as cat}
                    <option value={cat}>{cat}</option>
                {/each}
            </select>
        </div>
        <div>
            <label
                for="ticketPrice"
                class="block text-sm font-medium text-gray-700 mb-1"
            >
                {m.ticket_price()} <span class="text-red-500">*</span>
            </label>
            <div class="flex items-center gap-4 min-h-[42px]">
                {#if !isTicketPriceUnknown}
                    <input
                        {...rf.fields.ticketPrice.as(
                            "text",
                            initialData?.ticketPrice?.toString() ?? "",
                        )}
                        class="flex-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.ticketPrice.issues() ?? []).length > 0
                            ? 'border-red-500'
                            : 'border-gray-300'}"
                        placeholder="e.g. 15.50"
                        onblur={() => rf.validate()}
                    />
                {:else}
                    <input {...rf.fields.ticketPrice.as("hidden", "0")} />
                {/if}
                <div class="flex items-center gap-2 whitespace-nowrap">
                    <input
                        {...rf.fields.ticketPriceUnknown.as("checkbox", initialData?.id ? !!initialData.ticketPriceUnknown : true)}
                        id="ticketPriceUnknown"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label for="ticketPriceUnknown" class="text-sm text-gray-700 cursor-pointer">{m.ticket_price_unknown()}</label>
                </div>
            </div>
            {#each rf.fields.ticketPrice.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </div>
    </div>

    <div>
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <MapPin size={18} class="text-blue-600" />
            {m.feature_locations_title()}
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager {m}
                title={m.feature_locations_title()}
                icon={MapPin}
                mode="embedded"
                {type}
                entityId={initialData?.id}
                initialItems={initialData?.locations || []}
                listItemsRemote={listLocations as any}
                fetchAssociationsRemote={fetchEntityLocations as any}
                addAssociationRemote={async (p: any) =>
                    addLocationAssociation({ ...p, locationId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeLocationAssociation({ ...p, locationId: p.itemId } as any)}
                onchange={(ids: string[]) =>
                    rf.fields.locationIds.set(JSON.stringify(ids))}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteLocation,
                        itemName: m.location_label().toLowerCase(),
                    });
                }}
                createRemote={createLocation}
                createSchema={createLocationSchema}
                updateRemote={updateLocation}
                updateSchema={updateLocationSchema}
                readItemRemote={readLocation}
                searchPredicate={(l: Location, q: string) => {
                    return (
                        l.name.toLowerCase().includes(q.toLowerCase()) ||
                        (l.roomId?.toLowerCase().includes(q.toLowerCase()) ?? false)
                    );
                }}
                loadingLabel={m.loading_item({
                    item: m.feature_locations_title(),
                })}
                noItemsLabel={m.no_items_associated_label({
                    item: m.feature_locations_title(),
                })}
                noItemsFoundLabel={m.no_items_found({
                    item: m.feature_locations_title(),
                })}
                searchPlaceholder={m.search_placeholder({
                    item: m.feature_locations_title(),
                })}
                linkItemLabel={m.link_item_label({
                    item: m.feature_locations_title(),
                })}
                associatedItemLabel={m.associated_item_label({
                    item: m.feature_locations_title(),
                })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                deleteForeverLabel={m.delete_forever({
                    item: m.location(),
                })}
                bulkDeleteLabel={m.delete_selected({ count: 0 })}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
                confirmUnlinkLabel={m.confirm_unlink_label({
                    item: m.location(),
                })}
            >
                {#snippet renderItemLabel(location: any)}
                    {location.name}
                    {location.roomId ? `(${location.roomId})` : ""}
                {/snippet}

                {#snippet renderForm({
                    remoteFunction: rf,
                    schema,
                    id,
                    initialData: formData = null,
                    onSuccess,
                    onCancel,
                }: any)}
                    <LocationForm
                        remoteFunction={rf}
                        validationSchema={schema}
                        isUpdating={!!id}
                        initialData={formData}
                        {onSuccess}
                        {onCancel}
                        labels={{
                            name: m.location_name(),
                            street: m.street(),
                            houseNumber: m.house_number(),
                            addressSuffix: m.address_suffix(),
                            zip: m.zip_code(),
                            city: m.city(),
                            state: m.state_region(),
                            country: m.country(),
                            roomId: m.room_id(),
                            latitude: m.latitude(),
                            longitude: m.longitude(),
                            what3words: m.what3words(),
                            inclusivitySupport: m.inclusivity_support(),
                            isPublic: m.public(),
                            heroImage: m.hero_image(),
                            saveChanges: m.save_changes(),
                            createLocation: m.create_location(),
                            cancel: m.cancel(),
                            saving: m.loading(),
                            creating: m.creating(),
                            successfullySaved: m.successfully_saved(),
                            errorSomethingWentWrong: m.something_went_wrong(),
                            enterLocationName: m.enter_location_name(),
                            streetName: m.street_placeholder(),
                            houseNumberPlaceholder: m.house_number_placeholder(),
                            addressSuffixPlaceholder:
                                m.address_suffix_placeholder(),
                            zipCodePlaceholder: m.zip_code_placeholder(),
                            cityNamePlaceholder: m.city_placeholder(),
                            statePlaceholder: m.state_placeholder(),
                            countryPlaceholder: m.country_placeholder(),
                            enterRoomId: m.room_id_placeholder(),
                            latitudePlaceholder: m.latitude_placeholder(),
                            longitudePlaceholder: m.longitude_placeholder(),
                            what3wordsPlaceholder: m.what3words_placeholder(),
                            inclusivitySupportPlaceholder: m.accessibility_info(),
                        }}
                    />
                {/snippet}
            </EntityManager>
        {/key}

        <input
            {...rf.fields.locationIds.as(
                "text",
                JSON.stringify(initialData?.locationIds ?? []),
            )}
            class="hidden"
        />
    </div>
</div>



<div class="bg-white shadow rounded-lg p-6 space-y-4">
    <h2 class="text-xl font-semibold mb-4 border-b pb-2">
        {m.guest_options()}
    </h2>

    <div class="space-y-3">
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.guestsCanInviteOthers.as(
                    "checkbox",
                    initialData?.guestsCanInviteOthers ?? false,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">{m.guests_invite()}</span>
        </label>
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.guestsCanModify.as(
                    "checkbox",
                    initialData?.guestsCanModify ?? false,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">{m.guests_modify()}</span>
        </label>
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.guestsCanSeeOtherGuests.as(
                    "checkbox",
                    initialData?.guestsCanSeeOtherGuests ?? false,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">{m.guests_see_others()}</span>
        </label>
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.isPublic.as(
                    "checkbox",
                    initialData?.isPublic ?? true,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700"
                >{m.public_event()}</span
            >
        </label>
    </div>

    <div class="mt-6">
        <h3 class="text-sm font-medium text-gray-700 mb-2">
            {m.reminders()}
        </h3>
        <label class="flex items-center gap-2 mb-4">
            <input
                {...rf.fields.reminders.useDefault.as(
                    "checkbox",
                    (initialData?.reminders as any)?.useDefault ?? true,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700"
                >{m.use_default_reminders()}</span
            >
        </label>

        {#if !useDefaultReminders}
            <div class="space-y-3">
                {#each reminders as _, i}
                    <div class="flex gap-2 items-center">
                        <div class="flex-1">
                            <select
                                {...rf.fields.reminders.overrides[i].method.as("text")}
                                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="popup">{m.notification()}</option
                                >
                                <option value="email">{m.email()}</option>
                            </select>
                        </div>
                        <div class="flex-1">
                            <input
                                {...rf.fields.reminders.overrides[i].minutes.as("number")}
                                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                min="0"
                            />
                        </div>
                        <button
                            type="button"
                            class="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            onclick={() => removeReminder(rf, i)}
                        >
                            &times;
                        </button>
                    </div>
                {/each}
                <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800"
                    onclick={() => addReminder(rf)}
                >
                    + {m.add_item({ item: m.reminder_label() })}
                </button>
            </div>
        {/if}
    </div>

    <!-- Participants Count Section -->
    <div class="border border-gray-200 bg-gray-50/70 rounded-lg p-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
                <label for="participants-count-input" class="text-base font-semibold flex items-center gap-2 text-gray-900">
                    <Users size={18} class="text-blue-600" />
                    {m.participants_count()}
                </label>
                <p class="text-xs text-gray-500 mt-1">
                    {m.participants_baseline_help({
                        contacts: String(currentContactIds.length),
                        baseline: String(baseline),
                    })}
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onclick={() => updateBaseline(-1)}
                    disabled={baseline <= 0}
                    aria-label={m.decrease_participants()}
                    class="h-9 w-9"
                >
                    <Minus size={16} />
                </Button>

                <input
                    id="participants-count-input"
                    {...rf.fields.participantsCount.as("number", totalParticipants)}
                    type="number"
                    min={currentContactIds.length}
                    oninput={handleParticipantsInput}
                    class="w-20 h-9 text-center font-bold text-lg border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onclick={() => updateBaseline(1)}
                    aria-label={m.increase_participants()}
                    class="h-9 w-9"
                >
                    <Plus size={16} />
                </Button>
            </div>
        </div>
    </div>

    <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
        <User size={18} class="text-blue-600" />
        {m.feature_contacts_title()}
    </h3>
    {#key initialData?.id || "new"}
    <EntityManager {m}
        title={m.feature_contacts_title()}
        icon={User}
        mode="embedded"
        type="event"
        entityId={initialData?.id}
        initialItems={initialData?.contacts || []}
        onchange={(ids: string[]) => {
            currentContactIds = ids;
            rf.fields.contactIds.set(JSON.stringify(ids));
            rf.fields.participantsCount.set(baseline + ids.length);
        }}
        listItemsRemote={listContacts as any}
        fetchAssociationsRemote={fetchEntityContacts as any}
        addAssociationRemote={async (p: any) =>
            addAssociation({ ...p, contactId: p.itemId } as any)}
        removeAssociationRemote={async (p: any) =>
            removeAssociation({ ...p, contactId: p.itemId } as any)}
        deleteItemRemote={async (ids: string[]) => {
            return await handleDelete({
                ids,
                deleteFn: deleteContact,
                itemName: m.contact_label().toLowerCase(),
            });
        }}
        createRemote={createContact}
        createSchema={createContactSchema}
        updateRemote={updateContact}
        updateSchema={updateContactSchema}
        readItemRemote={readContact}
        searchPredicate={matchContactSearch}
        loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
        noItemsLabel={m.no_items_associated_label({
            item: m.feature_contacts_title(),
        })}
        noItemsFoundLabel={m.no_items_found({
            item: m.feature_contacts_title(),
        })}
        searchPlaceholder={m.search_placeholder({
            item: m.feature_contacts_title(),
        })}
        linkItemLabel={m.link_item_label({
            item: m.feature_contacts_title(),
        })}
        associatedItemLabel={m.associated_item_label({
            item: m.feature_contacts_title(),
        })}
        quickCreateLabel={m.quick_create()}
        closeSearchLabel={m.close_search()}
        editLabel={m.edit()}
        deleteLabel={m.delete()}
        unlinkLabel={m.unlink()}
        deleteForeverLabel={m.delete_forever({ item: m.contact() })}
        bulkDeleteLabel={m.delete_selected({ count: 0 })}
        selectAllLabel={m.select_all()}
        deselectAllLabel={m.deselect_all()}
        confirmUnlinkLabel={m.confirm_unlink_label({ item: m.contact() })}
    >
        {#snippet renderItemLabel(contactItem: any)}
            {@const contactName = contactItem.displayName ||
                `${contactItem.givenName || ""} ${contactItem.familyName || ""}`.trim() ||
                contactItem.company ||
                m.unnamed_contact()}
            {@const contactTags = contactItem.tags || []}
            {@const isEmployee = contactTags.some((ct: any) => {
                const tagName = (ct.name || ct.tag?.name || '').toLowerCase();
                return tagName === 'employee' || tagName === 'employees';
            })}
            <span class="inline-flex items-center gap-2 flex-wrap">
                <span>{contactName}</span>
                {#if isEmployee}
                    {@const avail = contactAvailability[contactItem.id]}
                    {#if availabilityLoading && !avail}
                        <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">
                            <Loader2 size={12} class="animate-spin text-blue-600" />
                            {m.checking_availability()}
                        </span>
                    {:else if avail && !avail.available}
                        {#if avail.eventId}
                            <a
                                href={`/events/${avail.eventId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium hover:bg-red-200 hover:text-red-900 transition-colors underline-offset-2 hover:underline"
                                title={avail.reason || (avail.eventTitle ? `${m.busy_conflict()}: ${avail.eventTitle}` : m.conflict_details())}
                                onclick={(e) => e.stopPropagation()}
                            >
                                <span>🔴</span>
                                <span class="max-w-[200px] truncate">
                                    {avail.eventTitle || m.busy_conflict()}
                                </span>
                                <ExternalLink size={12} class="shrink-0 opacity-70" />
                            </a>
                        {:else}
                            <span
                                class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium"
                                title={avail.reason || (avail.eventTitle ? `${m.busy_conflict()}: ${avail.eventTitle}` : m.conflict_details())}
                            >
                                <span>🔴</span>
                                <span class="max-w-[200px] truncate">
                                    {avail.eventTitle || m.busy_conflict()}
                                </span>
                            </span>
                        {/if}
                    {:else}
                        <span class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium" title={m.available()}>
                            🟢 {m.available()}
                        </span>
                    {/if}
                {/if}
            </span>
        {/snippet}

        {#snippet participationSnippet(contact: any)}
            <select
                value={contact.participationStatus || "needsAction"}
                onchange={(e) => {
                    const newStatus = e.currentTarget.value;
                    if (initialData?.id) {
                        updateAssociationStatusRemote({
                            type: "event",
                            entityId: initialData.id,
                            contactId: contact.id,
                            status: newStatus,
                        } as any).catch((err: any) =>
                            toast.error(
                                err.message || m.failed_to_update_status(),
                            ),
                        );
                    }
                    contact.participationStatus = newStatus;
                }}
                class="text-xs bg-transparent border-0 focus:ring-0 cursor-pointer text-gray-500 hover:text-blue-600 font-medium"
            >
                <option value="needsAction">{m.needs_action()}</option>
                <option value="accepted">{m.accepted()}</option>
                <option value="declined">{m.declined()}</option>
                <option value="tentative">{m.tentative()}</option>
            </select>
        {/snippet}

        {#snippet renderForm({
            remoteFunction: rfContact,
            schema,
            initialData: formData = {},
            onSuccess,
            onCancel,
            id,
        }: any)}
            <ContactForm
                remoteFunction={rfContact}
                {schema}
                initialData={formData}
                {onSuccess}
                {onCancel}
                contactId={id}
            >
                {#snippet children({ onLocationsChange }: any)}
                    <div class="mt-8 border-t pt-8">
                        <h3
                            class="text-lg font-semibold mb-2 flex items-center gap-2"
                        >
                            <MapPin size={18} class="text-blue-600" />
                            {m.feature_locations_title()}
                        </h3>
                        {#key id || "new"}
                            <EntityManager {m}
                            title={m.feature_locations_title()}
                            icon={MapPin}
                            mode="embedded"
                            type="contact"
                            entityId={id}
                            initialItems={(
                                (formData as any)?.locationAssociations || []
                            ).map((la: any) => la.location).filter(Boolean)}
                            onchange={onLocationsChange}
                            listItemsRemote={listLocations as any}
                            fetchAssociationsRemote={fetchEntityLocations as any}
                            addAssociationRemote={async (p: any) =>
                                addLocationAssociation({
                                    ...p,
                                    locationId: p.itemId,
                                } as any)}
                            removeAssociationRemote={async (p: any) =>
                                removeLocationAssociation({
                                    ...p,
                                    locationId: p.itemId,
                                } as any)}
                            deleteItemRemote={async (ids: any) => {
                                return await handleDelete({
                                    ids: Array.isArray(ids) ? ids : [ids],
                                    deleteFn: deleteLocation,
                                    itemName: m.location().toLowerCase(),
                                });
                            }}
                            createRemote={createLocation}
                            createSchema={createLocationSchema}
                            updateRemote={updateLocation}
                            updateSchema={updateLocationSchema}
                            readItemRemote={readLocation}
                            searchPredicate={(l: any, q: string) => {
                                return (
                                    l.name
                                        .toLowerCase()
                                        .includes(q.toLowerCase()) ||
                                    (l.roomId
                                        ?.toLowerCase()
                                        .includes(q.toLowerCase()) ??
                                        false)
                                );
                            }}
                            loadingLabel={m.loading_item({
                                item: m.feature_locations_title(),
                            })}
                            noItemsLabel={m.no_items_associated_label({
                                item: m.feature_locations_title(),
                            })}
                            noItemsFoundLabel={m.no_items_found({
                                item: m.feature_locations_title(),
                            })}
                            searchPlaceholder={m.search_placeholder({
                                item: m.feature_locations_title(),
                            })}
                            linkItemLabel={m.link_item_label({
                                item: m.feature_locations_title(),
                            })}
                            associatedItemLabel={m.associated_item_label({
                                item: m.feature_locations_title(),
                            })}
                            quickCreateLabel={m.quick_create()}
                            closeSearchLabel={m.close_search()}
                            editLabel={m.edit()}
                            deleteLabel={m.delete()}
                            unlinkLabel={m.unlink()}
                            deleteForeverLabel={m.delete_forever({
                                item: m.location(),
                            })}
                            bulkDeleteLabel={m.delete_selected({
                                count: 0,
                            })}
                            selectAllLabel={m.select_all()}
                            deselectAllLabel={m.deselect_all()}
                            confirmUnlinkLabel={m.confirm_unlink_label({
                                item: m.location(),
                            })}
                        >
                            {#snippet renderItemLabel(location: any)}
                                {location.name}
                                {location.roomId ? `(${location.roomId})` : ""}
                            {/snippet}
                            {#snippet renderForm({
                                remoteFunction: rfLocation,
                                schema: locSchema,
                                id: locId,
                                initialData: locFormData = null,
                                onSuccess: locSuccess,
                                onCancel: locCancel,
                            }: any)}
                                <LocationForm
                                    remoteFunction={rfLocation}
                                    validationSchema={locSchema}
                                    isUpdating={!!locId}
                                    initialData={locFormData}
                                    onSuccess={locSuccess}
                                    onCancel={locCancel}
                                    labels={{
                                        name: m.location_name(),
                                        street: m.street(),
                                        houseNumber: m.house_number(),
                                        addressSuffix: m.address_suffix(),
                                        zip: m.zip_code(),
                                        city: m.city(),
                                        state: m.state_region(),
                                        country: m.country(),
                                        roomId: m.room_id(),
                                        latitude: m.latitude(),
                                        longitude: m.longitude(),
                                        what3words: m.what3words(),
                                        inclusivitySupport:
                                            m.inclusivity_support(),
                                        isPublic: m.public(),
                                        heroImage: m.hero_image(),
                                        saveChanges: m.save_changes(),
                                        createLocation: m.create_location(),
                                        cancel: m.cancel(),
                                        saving: m.loading(),
                                        creating: m.creating(),
                                        successfullySaved:
                                            m.successfully_saved(),
                                        errorSomethingWentWrong:
                                            m.something_went_wrong(),
                                        enterLocationName:
                                            m.enter_location_name(),
                                        streetName: m.street_placeholder(),
                                        houseNumberPlaceholder:
                                            m.house_number_placeholder(),
                                        addressSuffixPlaceholder:
                                            m.address_suffix_placeholder(),
                                        zipCodePlaceholder:
                                            m.zip_code_placeholder(),
                                        cityNamePlaceholder:
                                            m.city_placeholder(),
                                        statePlaceholder: m.state_placeholder(),
                                        countryPlaceholder:
                                            m.country_placeholder(),
                                        enterRoomId: m.room_id_placeholder(),
                                        latitudePlaceholder:
                                            m.latitude_placeholder(),
                                        longitudePlaceholder:
                                            m.longitude_placeholder(),
                                        what3wordsPlaceholder:
                                            m.what3words_placeholder(),
                                        inclusivitySupportPlaceholder:
                                            m.accessibility_info(),
                                    }}
                                />
                            {/snippet}
                        </EntityManager>
        {/key}
                    </div>
                {/snippet}
            </ContactForm>
        {/snippet}
    </EntityManager>
    {/key}
    <input
        {...rf.fields.contactIds.as(
            "text",
            JSON.stringify(initialData?.contactIds || []),
        )}
        class="hidden"
    />

    <div class="pt-4 border-t border-gray-100">
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <Utensils size={18} class="text-blue-600" />
            {m.feature_menus_title?.() || 'Menus & Catering'} ({m.optional?.() || 'optional'})
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager {m}
                title={m.feature_menus_title?.() || 'Menus & Catering'}
                icon={Utensils}
                mode="embedded"
                type="event"
                entityId={initialData?.id}
                initialItems={initialData?.menus || []}
                sortField="name"
                selectorSortField="name"
                listItemsRemote={listMenus as any}
                fetchAssociationsRemote={fetchEntityMenus as any}
                addAssociationRemote={async (p: any) =>
                    addMenuAssociation({ ...p, menuId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeMenuAssociation({ ...p, menuId: p.itemId } as any)}
                onchange={(ids: string[], items: any[]) => {
                    currentMenus = items;
                    rf.fields.menuIds.set(JSON.stringify(ids));
                }}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteMenus,
                        itemName: m.menu?.() || 'menu',
                    });
                }}
                createRemote={createMenu}
                createSchema={createMenuSchema}
                updateRemote={updateMenu}
                updateSchema={updateMenuSchema}
                readItemRemote={readMenu}
                searchPredicate={(menuItem: any, q: string) => {
                    const qLower = q.toLowerCase();
                    return (
                        menuItem.name?.toLowerCase().includes(qLower) ||
                        menuItem.description?.toLowerCase().includes(qLower)
                    );
                }}
                loadingLabel={m.loading_item?.({ item: m.menus?.() || 'Menus' }) || 'Loading menus...'}
                noItemsLabel={m.no_items_associated_label?.({ item: m.menus?.() || 'Menus' }) || 'No menus associated'}
                noItemsFoundLabel={m.no_items_found?.({ item: m.menus?.() || 'Menus' }) || 'No menus found'}
                searchPlaceholder={m.search_placeholder?.({ item: m.menus?.() || 'Menus' }) || 'Search menus...'}
                linkItemLabel={m.link_item_label?.({ item: m.menu?.() || 'Menu' }) || 'Link Menu'}
                associatedItemLabel={m.associated_item_label?.({ item: m.menus?.() || 'Menus' }) || 'Associated Menus'}
                quickCreateLabel={m.quick_create?.() || 'Quick Create'}
                closeSearchLabel={m.close_search?.() || 'Close'}
                editLabel={m.edit?.() || 'Edit'}
                deleteLabel={m.delete?.() || 'Delete'}
                unlinkLabel={m.unlink?.() || 'Unlink'}
                deleteForeverLabel={m.delete_forever?.({ item: m.menu?.() || 'Menu' }) || 'Delete Menu'}
                confirmUnlinkLabel={m.confirm_unlink_label?.({ item: m.menu?.() || 'Menu' }) || 'Unlink Menu'}
                selectAllLabel={m.select_all?.() || 'Select All'}
                deselectAllLabel={m.deselect_all?.() || 'Deselect All'}
            >
                {#snippet renderItemLabel(item: any)}
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-gray-900">{item.name}</span>
                        {#if item.isTemplate}
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                {m.template?.() || 'Template'}
                            </span>
                        {:else}
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                {m.event_menu?.() || 'Event'}
                            </span>
                        {/if}
                    </div>
                {/snippet}

                {#snippet renderItemBadge(item: any)}
                    <span class="text-xs text-gray-500">
                        {item.items?.length || 0} {item.items?.length === 1 ? 'item' : 'items'}
                    </span>
                {/snippet}

                {#snippet renderItemDetail(item: any)}
                    <div class="flex items-center gap-1.5 text-xs text-gray-600 font-mono">
                        <span>€{(Number(item.totalPricePerPortion) || 0).toFixed(2)} / {m.portion?.() || 'portion'}</span>
                    </div>
                {/snippet}

                {#snippet participationSnippet(item: any)}
                    <div class="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-medium shrink-0">
                        <Calculator size={13} class="text-emerald-600" />
                        <span>
                            €{((Number(item.totalPricePerPortion) || 0) * (totalParticipants || 1)).toFixed(2)}
                            <span class="text-emerald-600 text-[11px] font-normal">({totalParticipants} {m.participants?.() || 'participants'})</span>
                        </span>
                    </div>
                {/snippet}

                {#snippet renderForm({
                    remoteFunction: rfMenu,
                    schema: menuSchema,
                    id: menuId,
                    initialData: menuFormData = null,
                    onSuccess: menuSuccess,
                    onCancel: menuCancel,
                }: any)}
                    <MenuForm
                        remoteFunction={rfMenu}
                        validationSchema={menuSchema}
                        isUpdating={!!menuId}
                        initialData={menuFormData}
                        participantsCount={totalParticipants}
                        onSuccess={menuSuccess}
                        onCancel={menuCancel}
                    />
                {/snippet}
            </EntityManager>
        {/key}

        <input
            {...rf.fields.menuIds.as(
                "text",
                JSON.stringify(initialData?.menuIds || []),
            )}
            class="hidden"
        />

        {#if currentMenus.length > 0}
            {@const cateringTotal = currentMenus.reduce((sum, item) => sum + (Number(item.totalPricePerPortion) || 0) * (totalParticipants || 1), 0)}
            {@const cateringCost = currentMenus.reduce((sum, item) => sum + (Number(item.totalCostPerPortion) || 0) * (totalParticipants || 1), 0)}
            {@const cateringProfit = cateringTotal - cateringCost}
            <div class="mt-3 p-3.5 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm">
                <div class="flex items-center gap-2">
                    <Utensils size={18} class="text-emerald-600" />
                    <span class="font-semibold text-gray-800">{m.catering_calculation?.() || 'Total Catering Calculation'}:</span>
                    <span class="text-xs text-gray-600">({currentMenus.length} {currentMenus.length === 1 ? (m.menu?.() || 'menu') : (m.menus?.() || 'menus')} × {totalParticipants} {m.participants?.() || 'participants'})</span>
                </div>
                <div class="flex items-center gap-3 text-right">
                    {#if cateringCost > 0}
                        <div class="text-xs text-gray-600">
                            Cost: <span class="font-mono text-gray-800">€{cateringCost.toFixed(2)}</span> • Profit: <span class="font-mono font-semibold text-emerald-700">+€{cateringProfit.toFixed(2)}</span>
                        </div>
                    {/if}
                    <div class="font-bold text-base text-emerald-900 font-mono">
                        €{cateringTotal.toFixed(2)}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <SyncCheckboxBlock
        syncFieldConfig={rf.fields.syncIds}
        initialSelectedIds={initialData?.syncIds || []}
        {isSeries}
    />
</div>
