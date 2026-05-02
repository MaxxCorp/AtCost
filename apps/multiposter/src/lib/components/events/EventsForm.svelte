<script lang="ts">
    import {
        Calendar,
        Clock,
        MapPin,
        Tag,
        Users,
        Shield,
        Image as ImageIcon,
        Info,
        Repeat,
    } from "@lucide/svelte";
    import { Button } from "$lib/components/ui/button";
    import RecurrenceDialog from "$lib/components/events/RecurrenceDialog.svelte";
    import ImageUploader from "$lib/components/cms/ImageUploader.svelte";
    import RichTextEditor from "$lib/components/cms/RichTextEditor.svelte";
    import * as Field from "$lib/components/ui/field";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import * as m from "$lib/paraglide/messages";
    import { untrack } from "svelte";

    let {
        rf,
        locations = [],
        tags = [],
        resources = [],
        contacts = [],
        synchronizations = [],
        isLoading = false,
    } = $props();

    const timezones = Intl.supportedValuesOf
        ? Intl.supportedValuesOf("timeZone")
        : [];

    function toggleId(field: any, id: string) {
        const current = field.value() || [];
        if (current.includes(id)) {
            field.set(current.filter((i: string) => i !== id));
        } else {
            field.set([...current, id]);
        }
    }

    // Safe accessors for reactive fields to avoid Proxy conversion issues
    const descriptionValue = $derived.by(() => {
        const val = rf.fields.description.value();
        return typeof val === "string" ? val : "";
    });
    const heroImageValue = $derived.by(() => {
        const val = rf.fields.heroImage.value();
        return typeof val === "string" ? val : "";
    });
    function isTruthy(val: any) {
        return (
            val === true || val === "true" || val === "on" || val === "checked"
        );
    }

    const isAllDay = $derived(isTruthy(rf.fields.isAllDay.value()));
    const isPublic = $derived(isTruthy(rf.fields.isPublic.value()));
    const guestsCanInviteOthers = $derived(
        isTruthy(rf.fields.guestsCanInviteOthers.value()),
    );

    const categoryBerlinDotDeValue = $derived.by(() => {
        const val = rf.fields.categoryBerlinDotDe.value();
        return typeof val === "string" ? val : "";
    });

    let showRecurrenceDialog = $state(false);
    const recurrenceValue = $derived.by(() => {
        const val = (rf.fields as any).recurrence?.value();
        if (!val) return "";
        return Array.isArray(val) ? val[0] : String(val);
    });

    const remindersValue = $derived.by(() => {
        const val = (rf.fields as any).reminders?.value();
        if (!val) return "";
        return typeof val === "object" ? JSON.stringify(val) : String(val);
    });

    // Safe accessors for array fields
    const locationIdsValue = $derived.by(() => {
        const val = rf.fields.locationIds.value();
        return Array.isArray(val)
            ? val.map((id: any) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const tagIdsValue = $derived.by(() => {
        const val = rf.fields.tagIds.value();
        return Array.isArray(val)
            ? val.map((id: any) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const resourceIdsValue = $derived.by(() => {
        const val = rf.fields.resourceIds.value();
        return Array.isArray(val)
            ? val.map((id: any) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const contactIdsValue = $derived.by(() => {
        const val = rf.fields.contactIds.value();
        return Array.isArray(val)
            ? val.map((id: any) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    const syncIdsValue = $derived.by(() => {
        const val = rf.fields.syncIds.value();
        return Array.isArray(val)
            ? val.map((id: any) =>
                  typeof id === "object" ? String(id.id || id) : String(id),
              )
            : [];
    });

    // Unified Date/Time Derivation logic (1-hour increment)
    const derivedEndDateTime = $derived.by(() => {
        const d = rf.fields.startDate.value();
        const t = rf.fields.startTime.value();
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
            hasAppliedInitialDerivation = true;
            // Only skip if we already have an end date/time (likely from edit load)
            if (rf.fields.endDate.value() || rf.fields.endTime.value()) {
                return;
            }
        }

        untrack(() => {
            rf.fields.endDate.set(current.date);
            rf.fields.endTime.set(current.time);
        });
    });
</script>

<!-- Hidden Inputs for State Serialization -->
{#if heroImageValue}
    <input {...(rf.fields.heroImage as any).as("hidden", heroImageValue)} />
{/if}
{#if descriptionValue}
    <input {...(rf.fields.description as any).as("hidden", descriptionValue)} />
{/if}
{#if recurrenceValue}
    <input {...(rf.fields as any).recurrence.as("hidden", recurrenceValue)} />
{/if}
{#if remindersValue}
    <input {...(rf.fields as any).reminders.as("hidden", remindersValue)} />
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
{#each syncIdsValue as id, i}
    {@const field = (rf.fields.syncIds as any)[i]}
    {#if field}
        <input {...field.as("hidden", id)} />
    {/if}
{/each}

<!-- Basic Information -->
<section class="bg-white shadow-sm border rounded-xl p-6 space-y-6">
    <div class="flex items-center gap-2 border-b pb-4 mb-4">
        <Info size={20} class="text-blue-500" />
        <h2 class="text-xl font-bold">{m.basic_information()}</h2>
    </div>

    <div class="space-y-4">
        <Field.Field>
            <Field.Label
                >{m.title()}
                <span class="text-red-500">*</span></Field.Label
            >
            <Input {...rf.fields.summary.as("text")} placeholder={m.title()} />
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
                    <option value="confirmed">{m.confirmed()}</option>
                    <option value="tentative">{m.tentative()}</option>
                    <option value="cancelled">{m.cancelled()}</option>
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
<section class="bg-white shadow-sm border rounded-xl p-6 space-y-6">
    <div class="flex items-center gap-2 border-b pb-4 mb-4">
        <Calendar size={20} class="text-green-500" />
        <h2 class="text-xl font-bold">{m.date_and_time()}</h2>
    </div>

    <div class="space-y-4">
        <div class="flex items-center gap-4">
            <Label class="flex items-center gap-2 cursor-pointer">
                <input
                    {...rf.fields.isAllDay.as("checkbox")}
                    class="w-4 h-4 rounded text-blue-600"
                />
                <span class="text-sm font-medium">{m.all_day()}</span>
            </Label>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => (showRecurrenceDialog = true)}
                class="flex items-center gap-2 {recurrenceValue
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : ''}"
            >
                <Repeat size={14} />
                {recurrenceValue ? m.recurrence() : m.repeat()}
            </Button>
        </div>

        <RecurrenceDialog
            bind:open={showRecurrenceDialog}
            value={recurrenceValue}
            onchange={(v: string | null) =>
                (rf.fields as any).recurrence?.set(v ? [v] : [])}
        />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <h3
                    class="text-sm font-black text-gray-500 uppercase tracking-wider"
                >
                    {m.start()}
                </h3>
                <div
                    class="grid gap-2 {isAllDay
                        ? 'grid-cols-1'
                        : 'grid-cols-2'}"
                >
                    <Field.Field>
                        <Input {...rf.fields.startDate.as("date")} />
                        <Field.Error errors={rf.fields.startDate.issues()} />
                    </Field.Field>
                    {#if !isAllDay}
                        <Field.Field>
                            <Input
                                {...rf.fields.startTime.as("time")}
                                class="disabled:bg-gray-100"
                            />
                        </Field.Field>
                    {/if}
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
                    class="grid gap-2 {isAllDay
                        ? 'grid-cols-1'
                        : 'grid-cols-2'}"
                >
                    <Field.Field>
                        <Input {...rf.fields.endDate.as("date")} />
                    </Field.Field>
                    {#if !isAllDay}
                        <Field.Field>
                            <Input
                                {...rf.fields.endTime.as("time")}
                                class="disabled:bg-gray-100"
                            />
                        </Field.Field>
                    {/if}
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
<section class="bg-white shadow-sm border rounded-xl p-6 space-y-6">
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
<div class="space-y-8">
    <!-- Locations -->
    <section class="bg-white shadow-sm border rounded-xl p-6 space-y-4">
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
                        checked={locationIdsValue.includes(loc.id)}
                        onchange={() => toggleId(rf.fields.locationIds, loc.id)}
                        class="w-4 h-4 rounded text-blue-600"
                    />
                    <span class="text-sm">{loc.name}</span>
                </Label>
            {/each}
        </div>
    </section>

    <!-- Tags -->
    <section class="bg-white shadow-sm border rounded-xl p-6 space-y-4">
        <div class="flex items-center gap-2 border-b pb-2">
            <Tag size={18} class="text-indigo-500" />
            <h2 class="font-bold">{m.tags()}</h2>
        </div>
        <div class="max-h-48 overflow-y-auto flex flex-wrap gap-2 pr-2">
            {#each tags as tag}
                <button
                    type="button"
                    onclick={() => toggleId(rf.fields.tagIds, tag.id)}
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
    <section class="bg-white shadow-sm border rounded-xl p-6 space-y-4">
        <div class="flex items-center gap-2 border-b pb-2">
            <Shield size={18} class="text-orange-500" />
            <h2 class="font-bold">{m.feature_resources_title()}</h2>
        </div>
        <div class="max-h-48 overflow-y-auto space-y-1 pr-2">
            {#each resources as res}
                <Label
                    class="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    style="padding-left: {res.level * 1.5 + 0.5}rem"
                >
                    <input
                        type="checkbox"
                        checked={resourceIdsValue.includes(res.id)}
                        onchange={() => toggleId(rf.fields.resourceIds, res.id)}
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
    <section class="bg-white shadow-sm border rounded-xl p-6 space-y-4">
        <div class="flex items-center gap-2 border-b pb-2">
            <Users size={18} class="text-cyan-500" />
            <h2 class="font-bold">{m.feature_contacts_title()}</h2>
        </div>
        <div class="max-h-48 overflow-y-auto space-y-2 pr-2">
            {#each contacts as con}
                <Label
                    class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                    <input
                        type="checkbox"
                        checked={contactIdsValue.includes(con.id)}
                        onchange={() => toggleId(rf.fields.contactIds, con.id)}
                        class="w-4 h-4 rounded text-blue-600"
                    />
                    <div class="flex flex-col">
                        <span class="text-sm font-medium"
                            >{con.displayName ||
                                `${con.givenName || ""} ${con.familyName || ""}`}</span
                        >
                        {#if con.company}
                            <span class="text-[10px] text-gray-400"
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
<section class="bg-white shadow-sm border rounded-xl p-6 space-y-6">
    <div class="flex items-center gap-2 border-b pb-4 mb-4">
        <Shield size={20} class="text-red-500" />
        <h2 class="text-xl font-bold">Settings</h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Label
            class="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
        >
            <span class="text-sm font-bold text-gray-700">Public Event</span>
            <input
                {...rf.fields.isPublic.as("checkbox")}
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
                {...rf.fields.guestsCanInviteOthers.as("checkbox")}
                class="w-5 h-5 rounded text-blue-600"
            />
        </Label>
    </div>
</section>

<!-- Sync Settings -->
<section class="bg-white shadow-sm border rounded-xl p-6 space-y-6">
    <div class="flex items-center gap-2 border-b pb-4 mb-4">
        <Shield size={20} class="text-blue-600" />
        <h2 class="text-xl font-bold">Sync Settings</h2>
    </div>

    <div class="space-y-6">
        <Field.Field>
            <Field.Label>Berlin.de Category</Field.Label>
            <select
                {...rf.fields.categoryBerlinDotDe.as("text")}
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
                <option value=""
                    >-- {m.select_category?.() ?? "Please select"} --</option
                >
                <option value="Ausstellungen">Ausstellungen</option>
                <option value="Bälle & Galas">Bälle & Galas</option>
                <option value="Bildung & Vorträge">Bildung & Vorträge</option>
                <option value="Festivals">Festivals</option>
                <option value="Jazz & Blues">Jazz & Blues</option>
                <option value="Kabarett & Comedy">Kabarett & Comedy</option>
                <option value="Kinderveranstaltungen"
                    >Kinderveranstaltungen</option
                >
                <option value="Klassische Konzerte">Klassische Konzerte</option>
                <option value="Literatur">Literatur</option>
                <option value="Musical">Musical</option>
                <option value="Oper & Tanz">Oper & Tanz</option>
                <option value="Pop, Rock & HipHop">Pop, Rock & HipHop</option>
                <option value="Schlager & Volksmusik"
                    >Schlager & Volksmusik</option
                >
                <option value="Show">Show</option>
                <option value="Sport">Sport</option>
                <option value="Theater">Theater</option>
                <option value="Vermischtes">Vermischtes</option>
                <option value="Volksfeste & Straßenfeste"
                    >Volksfeste & Straßenfeste</option
                >
                <option value="Wirtschaft">Wirtschaft</option>
                <option value="Wissenschaft">Wissenschaft</option>
            </select>
            <Field.Error errors={rf.fields.categoryBerlinDotDe.issues()} />
        </Field.Field>

        <div class="space-y-3">
            <h3 class="text-sm font-bold text-gray-700">
                Active Synchronizations
            </h3>
            {#if synchronizations.length === 0}
                <p class="text-sm text-gray-500 italic">
                    No synchronizations configured.
                </p>
            {:else}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {#each synchronizations as sync}
                        <Label
                            class="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={syncIdsValue.includes(sync.id)}
                                onchange={() =>
                                    toggleId(rf.fields.syncIds, sync.id)}
                                class="w-5 h-5 rounded text-blue-600"
                            />
                            <div class="flex flex-col">
                                <span class="text-sm font-bold"
                                    >{sync.name}</span
                                >
                                <span
                                    class="text-[10px] text-gray-400 uppercase tracking-wider"
                                    >{sync.providerType}</span
                                >
                            </div>
                        </Label>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</section>
