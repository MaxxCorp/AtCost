<script lang="ts">
    import { type Event } from "@ac/validations";

    import { m } from "#lib/paraglide/messages.js";
    import { getLocale } from "#lib/paraglide/runtime.js";
    import {
        Calendar,
        Clock,
        MapPin,
        Users,
        QrCode,
        Accessibility,
        Tag,
        RefreshCw,
        Info,
        Ticket,
        UserPlus,
    } from "@lucide/svelte";
    import { formatRecurrenceText } from "#lib/utils/format-recurrence.js";
    import { formatTicketPrice, isEventFree } from "#lib/utils/format-ticket-price.js";

    import { getEventRooms } from "#lib/utils/format-rooms.js";
    import { getVisibleEventLocations, getAdditionalSeriesLocations, getEventLocationNames } from "#lib/utils/event-locations.js";
    import { isMultiDayEvent, getEventDurationDays, formatFriendlyEventTime } from '#lib/utils/format-event-date.js';
    import { isSignUpClosed } from '#lib/utils/event-signup.js';
    import { getKioskSignUpText } from '#lib/utils/kiosk-signup.js';
    import {
        formatDateWeekday,
        formatDateDay,
        formatDateMonth,
        formatTime,
        formatTimeRange,
        type EnrichedEvent,
        type SeriesInstanceInfo,
    } from '#lib/utils/kiosk-flat-helpers.js';
    import { page } from '$app/state';
    import { authClient } from '#lib/auth.js';
    const session = authClient.useSession();
    const isLoggedIn = $derived(Boolean(page.data?.user || $session.data?.user));

    let { event }: { event: Event } = $props();

    const displayLocations = $derived(getVisibleEventLocations(event, { allowInternal: isLoggedIn }));
    const additionalSeriesLocations = $derived(getAdditionalSeriesLocations(event, displayLocations, { allowInternal: isLoggedIn }));

    function formatDateTime(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleString(getLocale(), {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(getLocale(), {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    const multiDay = $derived(isMultiDayEvent(event));
    const durationDays = $derived(multiDay ? getEventDurationDays(event) : 1);

    const displayDate = $derived(
        multiDay
            ? formatFriendlyEventTime(
                event,
                {
                    all_day: m.all_day?.() || "All Day",
                    on: m.on?.() || "on",
                    to: m.to?.() || "to",
                    until: m.until?.() || "until",
                    days_count: (c) => m.days_count({ count: c }),
                    loading: m.loading?.() || "Loading...",
                },
                getLocale()
            )
            : event.isAllDay && event.startDateTime
                ? formatDate(event.startDateTime)
                : event.startDateTime
                  ? formatDateTime(event.startDateTime)
                  : ""
    );

    let imageLoadError = $state(false);
    let heroImageError = $state(false);

    const heroUrl = $derived(event.heroImage?.trim() || "");
    const showHeroPoster = $derived(Boolean(heroUrl) && !heroImageError);

    const hasContact = $derived(!!event.resolvedContact);
    const hasDescription = $derived(!!(event.description && event.description.trim().length > 0));
    const displayTicketPrice = $derived(formatTicketPrice((event as any).ticketPrice, (event as any).ticketPriceUnknown, { currency: (event as any).currency || 'EUR' }));
    const eventRecurrenceRule = $derived((Array.isArray(event.recurrence) ? event.recurrence[0] : (typeof event.recurrence === 'string' ? event.recurrence : null)) || (event as any).seriesMaster?.recurrence?.[0] || null);

    const enrichedEvent = $derived(event as EnrichedEvent);
    const isCompressedSeries = $derived(
        Boolean(
            enrichedEvent.isCompressedSeries &&
                ((enrichedEvent.seriesInstances && enrichedEvent.seriesInstances.length >= 1) ||
                    (enrichedEvent.seriesDates && enrichedEvent.seriesDates.length >= 1))
        )
    );
    const seriesInstances = $derived<SeriesInstanceInfo[]>(
        enrichedEvent.seriesInstances ??
            (enrichedEvent.seriesDates ?? []).map((d, idx) => ({
                id: `${event.id}_d_${idx}`,
                startDateTime: d,
                status: 'confirmed',
                isAllDay: event.isAllDay,
            }))
    );
    const totalInstances = $derived(seriesInstances.length || enrichedEvent.instanceCount || 1);
    const cancelledCount = $derived(
        isCompressedSeries ? seriesInstances.filter((i) => i.status === 'cancelled').length : 0
    );
    const tentativeCount = $derived(
        isCompressedSeries ? seriesInstances.filter((i) => i.status === 'tentative').length : 0
    );
    const recurrenceLabel = $derived(
        enrichedEvent.recurrenceText ||
            (eventRecurrenceRule
                ? formatRecurrenceText(eventRecurrenceRule, { dtstart: event.startDateTime })
                : m.series_badge())
    );
    const seriesTimeRange = $derived(
        formatTimeRange(event.startDateTime, event.endDateTime, event.isAllDay, true, getLocale())
    );
    const baseTimeLabel = $derived(
        !event.isAllDay && event.startDateTime ? formatTime(event.startDateTime, getLocale()) : ""
    );
    const primaryLocationNameSet = $derived(
        new Set(displayLocations.map((l: any) => String(l.name || '').trim()).filter(Boolean))
    );
    const visibleTags = $derived.by(() => {
        if (!event.tags || event.tags.length === 0) return [];
        if (!isCompressedSeries) return event.tags;
        return event.tags.filter((tag: any) => {
            const name = typeof tag === 'string' ? tag : tag?.name;
            return name !== 'Series';
        });
    });

    const hasLocations = $derived(displayLocations.length > 0 || additionalSeriesLocations.length > 0 || getEventRooms(event).length > 0);
    const hasMeta = $derived(hasLocations || hasContact);
    const hasQr = $derived(Boolean((event as any).qrCodeDataUrl || event.qrCodePath));
    const hasDetails = $derived(Boolean(displayTicketPrice || event.signUpMode === 'required' || (event as any).categoryBerlinDotDe || (((event as any).inclusivityInformation) && (event as any).inclusivityInformation.length > 0)));
    const hasSidebar = $derived(hasQr || hasDetails);
    const hasPrimaryColumn = $derived(hasDescription || isCompressedSeries);
    const activeColumnCount = $derived((hasPrimaryColumn ? 1 : 0) + (hasMeta ? 1 : 0) + (hasSidebar ? 1 : 0));

    const otherContacts = $derived.by(() => {
        if (!Array.isArray((event as any)?.contacts)) return [];
        return (event as any).contacts.filter((c: any) => {
            const cObj = c.contact || c;
            const cId = cObj.id || c.id;
            if (event.resolvedContact?.id && cId && cId === event.resolvedContact.id) return false;
            const cName = (cObj.displayName || `${cObj.givenName || ''} ${cObj.familyName || ''}`.trim() || cObj.company || cObj.name || '').trim().toLowerCase();
            if (event.resolvedContact?.name && cName && cName === event.resolvedContact.name.trim().toLowerCase()) return false;
            return true;
        });
    });
</script>

{#snippet locationCard()}
    <div class="flex items-start gap-4 p-6 lg:p-8 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1">
        <MapPin class="w-7 h-7 lg:w-8 lg:h-8 text-blue-600 mt-0.5 shrink-0" />
        <div class="min-w-0 flex-1 flex flex-col justify-center">
            <h3 class="font-bold text-slate-900 text-base sm:text-lg lg:text-xl mb-2">
                {displayLocations.length + additionalSeriesLocations.length > 1 ? m.locations() : m.location()}
            </h3>
            {#if displayLocations.length > 0}
                <div class="space-y-2.5">
                    {#each displayLocations as loc (loc.id || loc.name)}
                        <div>
                            <p class="text-slate-900 text-lg sm:text-xl lg:text-2xl font-bold leading-snug">{loc.name}</p>
                            {#if loc.street || loc.houseNumber || loc.zip || loc.city}
                                <p class="text-sm sm:text-base lg:text-lg text-slate-600">
                                    {[
                                        [loc.street, loc.houseNumber].filter(Boolean).join(" "),
                                        [loc.zip, loc.city].filter(Boolean).join(" ")
                                    ].filter(Boolean).join(", ")}
                                </p>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
            {#if additionalSeriesLocations.length > 0}
                <div class="mt-4 pt-3 border-t border-slate-200/70 space-y-2.5">
                    <h4 class="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">
                        {m.other_series_locations()}
                    </h4>
                    <div class="space-y-2">
                        {#each additionalSeriesLocations as group (group.location.id || group.location.name)}
                            {@const loc = group.location}
                            <div>
                                <p class="text-slate-700 text-sm sm:text-base font-medium">{loc.name}</p>
                                {#if loc.street || loc.houseNumber || loc.zip || loc.city}
                                    <p class="text-xs sm:text-sm text-slate-500">
                                        {[
                                            [loc.street, loc.houseNumber].filter(Boolean).join(" "),
                                            [loc.zip, loc.city].filter(Boolean).join(" ")
                                        ].filter(Boolean).join(", ")}
                                    </p>
                                {/if}
                                {#if group.occurrences && group.occurrences.length > 0}
                                    <div class="flex flex-wrap items-center gap-1.5 pt-1.5">
                                        {#each group.occurrences as occ, occIdx (occ.id || occIdx)}
                                            {#if occ.startDateTime}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                                                    <span>{formatDateWeekday(occ.startDateTime, getLocale())}</span>
                                                    <span>{formatDateDay(occ.startDateTime, getLocale())} {formatDateMonth(occ.startDateTime, getLocale())}</span>
                                                </span>
                                            {/if}
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
            {#if getEventRooms(event).length > 0}
                <div class="flex flex-wrap items-center gap-2 mt-3">
                    {#each getEventRooms(event) as roomName (roomName)}
                        <span
                            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm sm:text-base font-bold bg-blue-100 text-blue-800 border border-blue-200"
                        >
                            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            {roomName}
                        </span>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/snippet}

{#snippet contactCard()}
    {#if event.resolvedContact}
        <div class="flex items-start gap-4 p-6 lg:p-8 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1">
            <Users class="w-7 h-7 lg:w-8 lg:h-8 text-blue-600 mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1 flex flex-col justify-center">
                <div class="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <h3 class="font-bold text-slate-900 text-base sm:text-lg lg:text-xl">{m.contact()}</h3>
                    {#if event.resolvedContact.roles && event.resolvedContact.roles.length > 0}
                        <div class="flex items-center gap-1.5 flex-wrap">
                            {#each event.resolvedContact.roles as roleName, rIdx (`${roleName}_${rIdx}`)}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                    {roleName}
                                </span>
                            {/each}
                        </div>
                    {:else if event.resolvedContact.role}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            {event.resolvedContact.role}
                        </span>
                    {/if}
                </div>
                <p class="text-slate-900 font-bold text-lg sm:text-xl lg:text-2xl leading-snug">
                    {event.resolvedContact.name}
                </p>

                {#if event.resolvedContact.email}
                    <p class="text-sm sm:text-base lg:text-lg text-slate-600 mt-1 break-all">
                        <a
                            href="mailto:{event.resolvedContact.email}"
                            class="hover:text-blue-600"
                        >{event.resolvedContact.email}</a>
                    </p>
                {/if}
                {#if event.resolvedContact.phone}
                    <p class="text-sm sm:text-base lg:text-lg text-slate-600 mt-0.5">
                        <a
                            href="tel:{event.resolvedContact.phone}"
                            class="hover:text-blue-600"
                        >{event.resolvedContact.phone}</a>
                    </p>
                {/if}

                {#if event.resolvedContact.qrCodeDataUrl || event.resolvedContact.qrCodePath}
                    <div class="mt-4">
                        <img
                            src={event.resolvedContact.qrCodeDataUrl || event.resolvedContact.qrCodePath}
                            alt="Contact QR"
                            class="w-32 h-32 lg:w-40 lg:h-40 object-contain border rounded-xl bg-white p-2"
                        />
                        <p class="text-xs sm:text-sm text-slate-500 mt-1.5">
                            {m.scan_contact_info()}
                        </p>
                    </div>
                {/if}

                {#if otherContacts.length > 0}
                    <div class="mt-4 pt-3 border-t border-slate-200/70 space-y-2">
                        <h4 class="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">
                            {m.feature_contacts_title?.() ?? "Contacts"}
                        </h4>
                        <div class="space-y-1.5">
                            {#each otherContacts as otherContact, ocIdx ((otherContact.contact || otherContact)?.id || ocIdx)}
                                {@const cObj = otherContact.contact || otherContact}
                                <div class="flex items-center justify-between gap-2 text-sm sm:text-base text-slate-700 flex-wrap">
                                    <span class="font-medium">{cObj.displayName || `${cObj.givenName || ''} ${cObj.familyName || ''}`.trim() || cObj.company || cObj.name}</span>
                                    {#if cObj.roles && cObj.roles.length > 0}
                                        <div class="flex items-center gap-1 flex-wrap">
                                            {#each cObj.roles as role, roleIdx (role?.id || role?.name || role || roleIdx)}
                                                <span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                                                    {role.name || role}
                                                </span>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{/snippet}

{#snippet seriesDatesCard()}
    <div class="bg-white rounded-2xl border border-indigo-200/80 shadow-xs p-6 sm:p-8 lg:p-10 {hasDescription ? 'shrink-0' : 'flex-1 flex flex-col justify-center'}">
        <h3 class="font-bold text-slate-900 text-base sm:text-lg lg:text-xl mb-4 flex items-center gap-2.5">
            <Calendar class="w-6 h-6 lg:w-7 lg:h-7 text-indigo-600 shrink-0" />
            <span>{m.all_instances_count?.({ count: totalInstances }) ?? `${totalInstances} Dates`}</span>
        </h3>
        <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {#each seriesInstances as inst, sIdx (inst.id || `${inst.startDateTime}_${sIdx}`)}
                {@const instTimeLabel = !inst.isAllDay && inst.startDateTime ? formatTime(inst.startDateTime, getLocale()) : ""}
                {@const hasCustomTime = Boolean(instTimeLabel && baseTimeLabel && instTimeLabel !== baseTimeLabel)}
                {@const instLocNames = getEventLocationNames(inst, { allowInternal: isLoggedIn })}
                {@const altLocNames = instLocNames.filter((n) => !primaryLocationNameSet.has(n))}
                {#if inst.status === 'cancelled'}
                    <span class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm sm:text-base lg:text-lg font-bold bg-red-50 text-red-700 border border-red-200 shadow-xs">
                        <span class="line-through opacity-75">{formatDateWeekday(inst.startDateTime, getLocale())}</span>
                        <span class="line-through opacity-75">{formatDateDay(inst.startDateTime, getLocale())} {formatDateMonth(inst.startDateTime, getLocale())}</span>
                        <span class="bg-red-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md uppercase">{m.cancelled()}</span>
                    </span>
                {:else if inst.status === 'tentative'}
                    <span class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm sm:text-base lg:text-lg font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                        <span class="text-amber-700 font-semibold">{formatDateWeekday(inst.startDateTime, getLocale())}</span>
                        <span>{formatDateDay(inst.startDateTime, getLocale())} {formatDateMonth(inst.startDateTime, getLocale())}</span>
                        {#if hasCustomTime}
                            <span class="text-xs sm:text-sm text-amber-700 font-medium">• {instTimeLabel}</span>
                        {/if}
                        {#if altLocNames.length > 0}
                            <span class="inline-flex items-center gap-1 text-xs sm:text-sm text-amber-900 font-medium bg-amber-100/80 px-2 py-0.5 rounded-md">
                                <MapPin class="w-3 h-3" />
                                {altLocNames.join(', ')}
                            </span>
                        {/if}
                        <span class="bg-amber-500 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md uppercase">{m.tentative()}</span>
                    </span>
                {:else}
                    <span class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm sm:text-base lg:text-lg font-bold bg-slate-900 text-white shadow-xs">
                        <span class="text-indigo-300 font-semibold">{formatDateWeekday(inst.startDateTime, getLocale())}</span>
                        <span>{formatDateDay(inst.startDateTime, getLocale())} {formatDateMonth(inst.startDateTime, getLocale())}</span>
                        {#if hasCustomTime}
                            <span class="text-xs sm:text-sm text-slate-300 font-medium">• {instTimeLabel}</span>
                        {/if}
                        {#if altLocNames.length > 0}
                            <span class="inline-flex items-center gap-1 text-xs sm:text-sm text-indigo-200 font-medium bg-white/10 px-2 py-0.5 rounded-md">
                                <MapPin class="w-3 h-3" />
                                {altLocNames.join(', ')}
                            </span>
                        {/if}
                    </span>
                {/if}
            {/each}
        </div>
    </div>
{/snippet}

{#snippet descriptionCard()}
    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 lg:p-10 flex-1 flex flex-col">
        <h3 class="font-bold text-slate-900 text-base sm:text-lg lg:text-xl mb-4 flex items-center gap-2.5">
            <Info class="w-6 h-6 text-blue-600 shrink-0" />
            <span>{m.about_this_event?.() || 'About'}</span>
        </h3>
        <div class="prose prose-base sm:prose-lg xl:prose-xl text-slate-700 max-w-none whitespace-pre-wrap leading-relaxed flex-1">
            {@html event.description}
        </div>
    </div>
{/snippet}

{#snippet primaryColumnContent()}
    {#if isCompressedSeries}{@render seriesDatesCard()}{/if}
    {#if hasDescription}{@render descriptionCard()}{/if}
{/snippet}

{#snippet qrCard()}
    {#if hasQr}
        <div class="bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-3">
                {#if (event as any).qrCodeDataUrl}
                    <img
                        src={(event as any).qrCodeDataUrl}
                        alt="QR Code"
                        class="w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 xl:w-64 xl:h-64 object-contain"
                    />
                {:else if event.qrCodePath}
                    {#if !imageLoadError}
                        <img
                            src={event.qrCodePath}
                            alt="QR Code"
                            class="w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 xl:w-64 xl:h-64 object-contain"
                            onerror={() => (imageLoadError = true)}
                        />
                    {:else}
                        <QrCode class="w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 text-slate-800" />
                    {/if}
                {/if}
            </div>
            <p class="text-sm sm:text-base lg:text-lg text-slate-600 font-semibold">
                {m.scan_for_details()}
            </p>
        </div>
    {/if}
{/snippet}

{#snippet detailsCard()}
    {#if hasDetails}
        <div class="bg-indigo-50/80 rounded-2xl p-6 lg:p-8 border border-indigo-100 shadow-xs flex-1 flex flex-col justify-center space-y-4">
            <h3 class="font-bold text-indigo-950 text-base sm:text-lg lg:text-xl flex items-center gap-2">
                <Tag class="w-5 h-5 lg:w-6 lg:h-6 text-indigo-700 shrink-0" />
                <span>{m.event_details()}</span>
            </h3>

            <div class="space-y-3.5 text-sm sm:text-base lg:text-lg">
                {#if displayTicketPrice}
                    <div class="flex items-center gap-2.5 text-indigo-900">
                        <Ticket class="w-5 h-5 opacity-75 shrink-0" />
                        <span class="font-semibold">{displayTicketPrice}</span>
                    </div>
                {/if}

                {#if event.signUpMode === 'required'}
                    {@const compactSignUp = getKioskSignUpText(event, { showQrCode: hasQr })}
                    {@const signUpClosed = isSignUpClosed(event.signUpMode, event.signUpClosureDate)}
                    {#if compactSignUp}
                        <div class="flex items-start gap-2.5 {signUpClosed ? 'text-red-700 font-semibold' : 'text-indigo-900'}">
                            <UserPlus class="w-5 h-5 opacity-75 shrink-0 mt-0.5" />
                            <span class="font-medium">{compactSignUp}</span>
                        </div>
                    {/if}
                {/if}

                {#if (event as any).categoryBerlinDotDe}
                    <div class="flex items-start gap-2.5 text-indigo-900">
                        <Tag class="w-5 h-5 opacity-75 mt-0.5 shrink-0" />
                        <span class="bg-white/70 px-3 py-1 rounded-lg font-medium border border-indigo-100/80">
                            {(event as any).categoryBerlinDotDe}
                        </span>
                    </div>
                {/if}

                {#if (event as any).inclusivityInformation && (event as any).inclusivityInformation.length > 0}
                    <div class="flex items-start gap-2.5 text-indigo-900">
                        <Accessibility class="w-5 h-5 opacity-75 mt-0.5 shrink-0" />
                        <div class="flex flex-wrap gap-1.5">
                            {#each (event as any).inclusivityInformation as info, idx (`${info}_${idx}`)}
                                <span class="bg-white/70 text-indigo-950 px-2.5 py-0.5 rounded-lg border border-indigo-100/80 text-sm sm:text-base font-medium">
                                    {info}
                                </span>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{/snippet}

{#if showHeroPoster}
    <!-- Prepared Event Poster (Full Screen) -->
    <div class="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden select-none">
        <img
            src={heroUrl}
            alt=""
            aria-hidden="true"
            draggable="false"
            class="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-45 brightness-75 pointer-events-none select-none"
        />
        <div class="absolute inset-0 bg-slate-950/30 pointer-events-none"></div>
        <img
            src={heroUrl}
            alt={event.summary}
            draggable="false"
            class="relative z-10 w-full h-full object-contain select-none drop-shadow-2xl"
            onerror={() => { heroImageError = true; }}
        />
        {#if event.status === 'cancelled'}
            <div class="absolute top-6 left-6 z-20 bg-rose-600/95 text-white text-base sm:text-xl font-black px-5 py-2 rounded-full border-2 border-white/30 uppercase tracking-widest shadow-2xl">
                {m.cancelled?.() || 'Cancelled'}
            </div>
        {/if}
    </div>
{:else}
    <!-- Full-Screen Generated Event View -->
    <div class="w-full h-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden select-none">
        <!-- Top Header Banner -->
        <div class="shrink-0 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 px-6 py-5 sm:px-10 sm:py-7 lg:px-14 lg:py-9 text-white shadow-md">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8">
                <div class="space-y-3 min-w-0 flex-1">
                    {#if isCompressedSeries || multiDay || event.status === 'cancelled' || isEventFree(event.ticketPrice, event.ticketPriceUnknown) || visibleTags.length > 0}
                        <div class="flex items-center gap-2.5 flex-wrap">
                            {#if isCompressedSeries}
                                <span class="bg-white/25 text-white text-xs sm:text-sm lg:text-base font-extrabold px-3.5 py-1 rounded-full border border-white/30 backdrop-blur-xs flex items-center gap-1.5 shadow-xs">
                                    <RefreshCw class="w-4 h-4 text-blue-100" />
                                    <span>{totalInstances}× {m.series_badge()}</span>
                                </span>
                                {#if cancelledCount > 0 && cancelledCount < totalInstances}
                                    <span class="bg-rose-500/90 text-white text-xs sm:text-sm lg:text-base font-bold px-3 py-1 rounded-full border border-white/20 shadow-xs">
                                        {cancelledCount} {m.cancelled()}
                                    </span>
                                {/if}
                                {#if tentativeCount > 0 && tentativeCount < totalInstances}
                                    <span class="bg-amber-500/90 text-white text-xs sm:text-sm lg:text-base font-bold px-3 py-1 rounded-full border border-white/20 shadow-xs">
                                        {tentativeCount} {m.tentative()}
                                    </span>
                                {/if}
                            {/if}
                            {#if multiDay}
                                <span class="bg-white/20 text-white text-xs sm:text-sm lg:text-base font-semibold px-3 py-1 rounded-full border border-white/20 backdrop-blur-xs flex items-center gap-1.5 shadow-xs">
                                    <Calendar class="w-4 h-4 text-blue-200" />
                                    <span>{m.multi_day_badge()} ({m.days_count({ count: durationDays })})</span>
                                </span>
                            {/if}
                            {#if event.status === 'cancelled'}
                                <span class="bg-rose-600 text-white text-xs sm:text-sm lg:text-base font-bold px-3.5 py-1 rounded-full border border-white/20 uppercase tracking-widest shadow-sm">
                                    {m.cancelled?.() || 'Cancelled'}
                                </span>
                            {/if}
                            {#if isEventFree(event.ticketPrice, event.ticketPriceUnknown)}
                                <span class="bg-emerald-500/90 text-white text-xs sm:text-sm lg:text-base font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                                    <Ticket class="w-4 h-4" />
                                    <span>{m.ticket_price_free?.() || 'Free'}</span>
                                </span>
                            {/if}
                            {#if visibleTags.length > 0}
                                {#each visibleTags as tag, tIdx (typeof tag === 'string' ? `${tag}_${tIdx}` : tag.id || tag.name || tIdx)}
                                    <span class="bg-white/20 text-white text-xs sm:text-sm lg:text-base font-medium px-3 py-1 rounded-full border border-white/20 backdrop-blur-xs flex items-center gap-1.5">
                                        <Tag class="w-3.5 h-3.5 text-blue-200" />
                                        <span>{typeof tag === 'string' ? tag : tag.name}</span>
                                    </span>
                                {/each}
                            {/if}
                        </div>
                    {/if}
                    <h1 class="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight break-words">
                        {event.summary}
                    </h1>
                </div>

                <div class="flex flex-col items-start lg:items-end gap-2 shrink-0 bg-white/10 backdrop-blur-xs rounded-2xl px-4 py-3 sm:px-6 sm:py-4 border border-white/15">
                    {#if isCompressedSeries}
                        <div class="flex items-center gap-2.5">
                            <RefreshCw class="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-blue-200 shrink-0" />
                            <span class="text-base sm:text-xl lg:text-2xl xl:text-3xl font-bold text-white">{recurrenceLabel}</span>
                        </div>
                        {#if seriesTimeRange}
                            <div class="flex items-center gap-2 text-sm sm:text-base lg:text-xl font-semibold text-blue-100 bg-white/10 px-3.5 py-1 rounded-full border border-white/20">
                                <Clock class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                <span>{seriesTimeRange}</span>
                            </div>
                        {/if}
                    {:else}
                        <div class="flex items-center gap-2.5">
                            <Calendar class="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-blue-200 shrink-0" />
                            <span class="text-base sm:text-xl lg:text-2xl xl:text-3xl font-bold text-white">{displayDate}</span>
                        </div>
                        {#if eventRecurrenceRule || event.recurringEventId || event.seriesId}
                            <div class="flex items-center gap-1.5 text-xs sm:text-sm lg:text-base text-blue-100 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                                <RefreshCw class="w-4 h-4 shrink-0" />
                                <span>{formatRecurrenceText(eventRecurrenceRule, { dtstart: event.startDateTime })}</span>
                            </div>
                        {/if}
                    {/if}
                    {#if isLoggedIn && ((event.prepMinutes && event.prepMinutes > 0) || (event.teardownMinutes && event.teardownMinutes > 0))}
                        <div class="flex flex-wrap items-center gap-2 text-xs text-amber-200">
                            {#if event.prepMinutes && event.prepMinutes > 0}
                                <span class="bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 backdrop-blur-xs font-semibold">
                                    {m.prep_padding()}: -{event.prepMinutes}m
                                </span>
                            {/if}
                            {#if event.teardownMinutes && event.teardownMinutes > 0}
                                <span class="bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 backdrop-blur-xs font-semibold">
                                    {m.teardown_padding()}: +{event.teardownMinutes}m
                                </span>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Adaptive Full-Screen Content Body -->
        <div class="flex-1 min-h-0 w-full p-6 sm:p-8 lg:p-12 pb-16 overflow-y-auto flex flex-col">
            {#if activeColumnCount === 3}
                <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
                    <div class="lg:col-span-6 flex flex-col gap-6">
                        {@render primaryColumnContent()}
                    </div>
                    <div class="lg:col-span-3 flex flex-col gap-6">
                        {#if hasLocations}{@render locationCard()}{/if}
                        {#if hasContact}{@render contactCard()}{/if}
                    </div>
                    <div class="lg:col-span-3 flex flex-col gap-6">
                        {@render qrCard()}
                        {@render detailsCard()}
                    </div>
                </div>
            {:else if activeColumnCount === 2}
                <div class="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-stretch">
                    {#if hasPrimaryColumn}
                        <div class="md:col-span-7 lg:col-span-8 flex flex-col gap-6">
                            {@render primaryColumnContent()}
                        </div>
                        <div class="md:col-span-5 lg:col-span-4 flex flex-col gap-6">
                            {#if hasMeta}
                                {#if hasLocations}{@render locationCard()}{/if}
                                {#if hasContact}{@render contactCard()}{/if}
                            {:else}
                                {@render qrCard()}
                                {@render detailsCard()}
                            {/if}
                        </div>
                    {:else}
                        <div class="md:col-span-7 flex flex-col gap-6">
                            {#if hasLocations}{@render locationCard()}{/if}
                            {#if hasContact}{@render contactCard()}{/if}
                        </div>
                        <div class="md:col-span-5 flex flex-col gap-6">
                            {@render qrCard()}
                            {@render detailsCard()}
                        </div>
                    {/if}
                </div>
            {:else if activeColumnCount === 1}
                <div class="flex-1 grid grid-cols-1 gap-6 lg:gap-8 items-stretch">
                    {#if hasPrimaryColumn}
                        <div class="flex flex-col gap-6 flex-1">
                            {@render primaryColumnContent()}
                        </div>
                    {:else if hasMeta}
                        {#if hasLocations && hasContact}
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 flex-1">
                                {@render locationCard()}
                                {@render contactCard()}
                            </div>
                        {:else if hasLocations}
                            {@render locationCard()}
                        {:else}
                            {@render contactCard()}
                        {/if}
                    {:else if hasQr && hasDetails}
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 flex-1">
                            {@render qrCard()}
                            {@render detailsCard()}
                        </div>
                    {:else if hasQr}
                        {@render qrCard()}
                    {:else}
                        {@render detailsCard()}
                    {/if}
                </div>
            {:else}
                <div class="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 lg:p-14 flex flex-col items-center justify-center text-center gap-4">
                    <Calendar class="w-12 h-12 lg:w-16 lg:h-16 text-blue-600" />
                    <p class="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900">
                        {displayDate}
                    </p>
                    {#if eventRecurrenceRule || event.recurringEventId || event.seriesId}
                        <p class="text-base sm:text-xl lg:text-2xl text-slate-600 flex items-center gap-2">
                            <RefreshCw class="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                            <span>{formatRecurrenceText(eventRecurrenceRule, { dtstart: event.startDateTime })}</span>
                        </p>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}
