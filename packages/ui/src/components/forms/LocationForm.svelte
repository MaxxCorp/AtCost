<script lang="ts">
    // @ts-ignore
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button/index.js";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";
    import { translateIssue } from "../../utils.js";
    import { useFormValidationFeedback } from "../../hooks/formValidationFeedback.svelte.ts";
    import {
        Clock,
        Plus,
        Trash2,
        Calendar,
        Copy,
        Sparkles
    } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
        children,
        heroImageSlot,
        labels = {},
        m = undefined,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        children?: Snippet<[]>;
        heroImageSlot?: Snippet<[]>;
        labels?: any;
        m?: any;
    } = $props();

    const rf = $derived(
        validationSchema
            ? (remoteFunction as any).preflight(validationSchema)
            : remoteFunction,
    );

    const i18n = {
        get name() {
            return labels?.name ?? m?.location_name?.() ?? m?.name?.() ?? "Name";
        },
        get description() {
            return labels?.description ?? m?.description?.() ?? "Description";
        },
        get capacity() {
            return labels?.capacity ?? m?.capacity?.() ?? "Capacity";
        },
        get street() {
            return labels?.street ?? m?.street?.() ?? "Street";
        },
        get houseNumber() {
            return labels?.houseNumber ?? m?.house_number?.() ?? "House Number";
        },
        get addressSuffix() {
            return labels?.addressSuffix ?? m?.address_suffix?.() ?? "Address Suffix";
        },
        get zip() {
            return labels?.zip ?? m?.zip_code?.() ?? "ZIP Code";
        },
        get city() {
            return labels?.city ?? m?.city?.() ?? "City";
        },
        get state() {
            return labels?.state ?? m?.state_region?.() ?? "State/Region";
        },
        get country() {
            return labels?.country ?? m?.country?.() ?? "Country";
        },
        get roomId() {
            return labels?.roomId ?? m?.room_id?.() ?? "Room ID";
        },
        get latitude() {
            return labels?.latitude ?? m?.latitude?.() ?? "Latitude";
        },
        get longitude() {
            return labels?.longitude ?? m?.longitude?.() ?? "Longitude";
        },
        get what3words() {
            return labels?.what3words ?? m?.what3words?.() ?? "what3words";
        },
        get inclusivitySupport() {
            return labels?.inclusivitySupport ?? m?.inclusivity_support?.() ?? "Inclusivity Support";
        },
        get openingHours() {
            return labels?.openingHours ?? m?.opening_hours?.() ?? "Opening Hours / Öffnungszeiten";
        },
        get isPublic() {
            return labels?.isPublic ?? m?.public?.() ?? "Public";
        },
        get saveChanges() {
            return labels?.saveChanges ?? m?.save_changes?.() ?? "Save Changes";
        },
        get createLocation() {
            return labels?.createLocation ?? m?.create_location?.() ?? "Create Location";
        },
        get cancel() {
            return labels?.cancel ?? m?.cancel?.() ?? "Cancel";
        },
        get saving() {
            return labels?.saving ?? m?.loading?.() ?? "Saving...";
        },
        get creating() {
            return labels?.creating ?? m?.creating?.() ?? "Creating...";
        },
        get successfullySaved() {
            return labels?.successfullySaved ?? m?.successfully_saved?.() ?? "Successfully Saved!";
        },
        get errorSomethingWentWrong() {
            return labels?.errorSomethingWentWrong ?? m?.something_went_wrong?.() ?? "Oh no! Something went wrong";
        },
        get enterLocationName() {
            return labels?.enterLocationName ?? m?.enter_location_name?.() ?? "Enter location name";
        },
        get streetName() {
            return labels?.streetName ?? m?.street_placeholder?.() ?? "Street name";
        },
        get houseNumberPlaceholder() {
            return labels?.houseNumberPlaceholder ?? m?.house_number_placeholder?.() ?? "e.g. 10A";
        },
        get addressSuffixPlaceholder() {
            return labels?.addressSuffixPlaceholder ?? m?.address_suffix_placeholder?.() ?? "e.g. Backyard, 2nd floor";
        },
        get zipCodePlaceholder() {
            return labels?.zipCodePlaceholder ?? m?.zip_code_placeholder?.() ?? "Postal code";
        },
        get cityNamePlaceholder() {
            return labels?.cityNamePlaceholder ?? m?.city_placeholder?.() ?? "City name";
        },
        get statePlaceholder() {
            return labels?.statePlaceholder ?? m?.state_placeholder?.() ?? "State";
        },
        get countryPlaceholder() {
            return labels?.countryPlaceholder ?? m?.country_placeholder?.() ?? "Country";
        },
        get enterRoomId() {
            return labels?.enterRoomId ?? m?.room_id_placeholder?.() ?? "Enter room ID (e.g. 101)";
        },
        get latitudePlaceholder() {
            return labels?.latitudePlaceholder ?? m?.latitude_placeholder?.() ?? "Latitude";
        },
        get longitudePlaceholder() {
            return labels?.longitudePlaceholder ?? m?.longitude_placeholder?.() ?? "Longitude";
        },
        get what3wordsPlaceholder() {
            return labels?.what3wordsPlaceholder ?? m?.what3words_placeholder?.() ?? "e.g. filled.count.soap";
        },
        get inclusivitySupportPlaceholder() {
            return labels?.inclusivitySupportPlaceholder ?? m?.accessibility_info?.() ?? "Accessibility and inclusivity information";
        },
        get heroImage() {
            return labels?.heroImage ?? m?.hero_image?.() ?? "Hero Image";
        },
        get pleaseFixValidation() {
            return labels?.pleaseFixValidation ?? m?.please_fix_validation?.() ?? "Please fix the validation errors in the form.";
        },
    };

    const feedback = useFormValidationFeedback(() => rf, {
        message: () => i18n.pleaseFixValidation,
    });

    // --- GRANULAR OPENING HOURS STATE & HELPERS ---
    const DAYS = [
        { key: "monday", label: "Montag", short: "Mo" },
        { key: "tuesday", label: "Dienstag", short: "Di" },
        { key: "wednesday", label: "Mittwoch", short: "Mi" },
        { key: "thursday", label: "Donnerstag", short: "Do" },
        { key: "friday", label: "Freitag", short: "Fr" },
        { key: "saturday", label: "Samstag", short: "Sa" },
        { key: "sunday", label: "Sonntag", short: "So" },
    ] as const;

    function initOpeningHours() {
        const defaultDays: Record<string, { closed: boolean; slots: { open: string; close: string; label?: string }[]; note?: string }> = {
            monday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
            tuesday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
            wednesday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
            thursday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
            friday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
            saturday: { closed: true, slots: [] },
            sunday: { closed: true, slots: [] },
        };

        const rawVal = initialData?.openingHours;
        if (!rawVal) {
            return {
                days: defaultDays,
                specialHours: [] as { date: string; closed: boolean; slots?: { open: string; close: string }[]; note?: string }[],
                notes: '',
            };
        }

        if (typeof rawVal === 'object') {
            return {
                days: rawVal.days ? { ...defaultDays, ...rawVal.days } : defaultDays,
                specialHours: Array.isArray(rawVal.specialHours) ? [...rawVal.specialHours] : [],
                notes: rawVal.notes || '',
            };
        }

        if (typeof rawVal === 'string') {
            const trimmed = rawVal.trim();
            if (trimmed.startsWith('{')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return {
                        days: parsed.days ? { ...defaultDays, ...parsed.days } : defaultDays,
                        specialHours: Array.isArray(parsed.specialHours) ? [...parsed.specialHours] : [],
                        notes: parsed.notes || '',
                    };
                } catch {
                    // fall through
                }
            }
        }

        return {
            days: defaultDays,
            specialHours: [],
            notes: '',
        };
    }

    let ohState = $state(initOpeningHours());

    function applyPreset(preset: 'office' | 'copyMonday' | 'clear') {
        if (preset === 'office') {
            ohState.days = {
                monday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
                tuesday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
                wednesday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
                thursday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
                friday: { closed: false, slots: [{ open: "09:00", close: "17:00" }] },
                saturday: { closed: true, slots: [] },
                sunday: { closed: true, slots: [] },
            };
            toast.success("Standard Bürozeiten (Mo–Fr 9–17 Uhr) angewendet");
        } else if (preset === 'copyMonday') {
            const mon = ohState.days.monday;
            if (mon) {
                ohState.days.tuesday = JSON.parse(JSON.stringify(mon));
                ohState.days.wednesday = JSON.parse(JSON.stringify(mon));
                ohState.days.thursday = JSON.parse(JSON.stringify(mon));
                ohState.days.friday = JSON.parse(JSON.stringify(mon));
                toast.success("Montagszeiten auf Di–Fr übertragen");
            }
        } else if (preset === 'clear') {
            for (const d of DAYS) {
                ohState.days[d.key] = { closed: true, slots: [] };
            }
            toast.success("Alle Tage auf geschlossen gesetzt");
        }
    }

    function addSlot(dayKey: string) {
        if (!ohState.days[dayKey]) {
            ohState.days[dayKey] = { closed: false, slots: [] };
        }
        ohState.days[dayKey].closed = false;
        ohState.days[dayKey].slots.push({ open: "14:00", close: "17:30" });
    }

    function removeSlot(dayKey: string, index: number) {
        if (ohState.days[dayKey]?.slots) {
            ohState.days[dayKey].slots.splice(index, 1);
            if (ohState.days[dayKey].slots.length === 0) {
                ohState.days[dayKey].closed = true;
            }
        }
    }

    function addSpecialHour() {
        ohState.specialHours.push({
            date: new Date().toISOString().slice(0, 10),
            closed: true,
            note: "Feiertag / Sonderzeit"
        });
    }

    function removeSpecialHour(index: number) {
        ohState.specialHours.splice(index, 1);
    }

    const serializedOpeningHours = $derived.by<string>(() => {
        const data = {
            days: ohState.days,
            specialHours: ohState.specialHours.length > 0 ? ohState.specialHours : undefined,
            notes: ohState.notes.trim() ? ohState.notes.trim() : undefined,
        };
        return JSON.stringify(data);
    });

    const liveFormattedLines = $derived.by<string[]>(() => {
        const lines: string[] = [];
        const formattedDays = DAYS.map((d) => {
            const sched = ohState.days[d.key];
            if (!sched || sched.closed || !sched.slots || sched.slots.length === 0) {
                return { key: d.key, short: d.short, text: 'Geschlossen', isClosed: true };
            }
            const slotsText = sched.slots.map(s => `${s.open}–${s.close} Uhr${s.label ? ` (${s.label})` : ''}`).join(', ');
            const noteText = sched.note ? ` (${sched.note})` : '';
            return { key: d.key, short: d.short, text: `${slotsText}${noteText}`, isClosed: false };
        });

        let groupStart = 0;
        while (groupStart < formattedDays.length) {
            let groupEnd = groupStart;
            while (
                groupEnd + 1 < formattedDays.length &&
                formattedDays[groupEnd + 1].text === formattedDays[groupStart].text
            ) {
                groupEnd++;
            }
            const current = formattedDays[groupStart];
            if (!current.isClosed) {
                let range = '';
                if (groupStart === groupEnd) {
                    range = current.short;
                } else if (groupEnd === groupStart + 1) {
                    range = `${current.short}, ${formattedDays[groupEnd].short}`;
                } else {
                    range = `${current.short}–${formattedDays[groupEnd].short}`;
                }
                lines.push(`${range} ${current.text}`);
            }
            groupStart = groupEnd + 1;
        }

        if (ohState.specialHours && ohState.specialHours.length > 0) {
            for (const sp of ohState.specialHours) {
                lines.push(`Ausnahme ${sp.date}: ${sp.closed ? 'Geschlossen' : 'Geöffnet'}${sp.note ? ` (${sp.note})` : ''}`);
            }
        }
        if (ohState.notes && ohState.notes.trim()) {
            lines.push(ohState.notes.trim());
        }
        return lines.length > 0 ? lines : ["Keine regulären Öffnungszeiten hinterlegt"];
    });
</script>

<form
    class="space-y-4"
    {...rf.enhance(async ({ submit }: { submit: any }) => {
        try {
            await submit();
            const result = (rf as any).result;
            const error = (rf as any).error;

            if (error || (result && result.success === false)) {
                toast.error(
                    error?.message ||
                        result?.error?.message ||
                        result?.error ||
                        i18n.errorSomethingWentWrong,
                );
                return;
            }

            toast.success(i18n.successfullySaved);
            if (onSuccess) onSuccess(result);
            else await goto(cancelHref);
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast.error(err?.message || i18n.errorSomethingWentWrong);
        }
    })}
>
    {#if isUpdating && initialData?.id}
        <input {...rf.fields.id.as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.name}</span>
        <input
            {...rf.fields.name.as("text", initialData?.name ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.name.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.enterLocationName}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.name.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.description}</span>
        <textarea
            {...rf.fields.description.as("text", initialData?.description ?? "")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the location..."
            rows="2"
        ></textarea>
        {#each rf.fields.description.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.capacity}</span>
        <input
            {...rf.fields.capacity.as("text", initialData?.capacity ?? "")}
            class="mt-2 w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. 50 people"
        />
        {#each rf.fields.capacity.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    {#if heroImageSlot}
        {@render heroImageSlot()}
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.street}</span>
        <input
            {...rf.fields.street.as("text", initialData?.street ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.street.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.streetName}
        />
        {#each rf.fields.street.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.houseNumber}</span
            >
            <input
                {...rf.fields.houseNumber.as("text", initialData?.houseNumber ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.houseNumber.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.houseNumberPlaceholder}
            />
            {#each rf.fields.houseNumber.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.addressSuffix}</span
            >
            <input
                {...rf.fields.addressSuffix.as("text", initialData?.addressSuffix ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.addressSuffix.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.addressSuffixPlaceholder}
            />
            {#each rf.fields.addressSuffix.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.zip}</span
            >
            <input
                {...rf.fields.zip.as("text", initialData?.zip ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.zip.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.zipCodePlaceholder}
            />
            {#each rf.fields.zip.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block col-span-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.city}</span
            >
            <input
                {...rf.fields.city.as("text", initialData?.city ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.city.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.cityNamePlaceholder}
            />
            {#each rf.fields.city.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.state}</span
            >
            <input
                {...rf.fields.state.as("text", initialData?.state ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.state.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.statePlaceholder}
            />
            {#each rf.fields.state.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.country}</span
            >
            <input
                {...rf.fields.country.as("text", initialData?.country ?? "")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.country.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.countryPlaceholder}
            />
            {#each rf.fields.country.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{i18n.roomId}</span
        >
        <input
            {...rf.fields.roomId.as("text", initialData?.roomId ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.roomId.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.enterRoomId}
        />
        {#each rf.fields.roomId.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <div class="grid grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.latitude}</span
            >
            <input
                {...rf.fields.latitude.as("text", initialData?.latitude != null ? String(initialData.latitude) : "")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.latitude.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.latitudePlaceholder}
            />
            {#each rf.fields.latitude.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >{i18n.longitude}</span
            >
            <input
                {...rf.fields.longitude.as("text", initialData?.longitude != null ? String(initialData.longitude) : "")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.longitude.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
                placeholder={i18n.longitudePlaceholder}
            />
            {#each rf.fields.longitude.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >{i18n.what3words}</span
        >
        <input
            {...rf.fields.what3words.as("text", initialData?.what3words ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.what3words.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.what3wordsPlaceholder}
        />
        {#each rf.fields.what3words.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >{i18n.inclusivitySupport}</span
        >
        <textarea
            {...rf.fields.inclusivitySupport.as("text", initialData?.inclusivitySupport ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.inclusivitySupport.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}"
            placeholder={i18n.inclusivitySupportPlaceholder}
            rows="3"
        ></textarea>
        {#each rf.fields.inclusivitySupport.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <!-- Granular Opening Hours Section -->
    <div class="border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-2">
                <Clock class="w-4 h-4 text-amber-500 shrink-0" />
                <span class="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {i18n.openingHours}
                </span>
            </div>

            <!-- Quick Presets -->
            <div class="flex items-center gap-2 flex-wrap text-xs">
                <span class="text-slate-400 font-medium text-[11px]">Schnellvorlagen:</span>
                <button
                    type="button"
                    onclick={() => applyPreset('office')}
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 hover:border-amber-400 font-medium transition text-[11px]"
                >
                    <Sparkles class="w-3 h-3 text-amber-500" />
                    <span>Mo–Fr 9–17 Uhr</span>
                </button>
                <button
                    type="button"
                    onclick={() => applyPreset('copyMonday')}
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 hover:border-amber-400 font-medium transition text-[11px]"
                    title="Mo-Zeiten auf Di–Fr übertragen"
                >
                    <Copy class="w-3 h-3 text-slate-400" />
                    <span>Mo auf Di–Fr</span>
                </button>
                <button
                    type="button"
                    onclick={() => applyPreset('clear')}
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 hover:border-red-400 font-medium transition text-[11px]"
                    title="Alle Tage auf geschlossen setzen"
                >
                    <span>Zurücksetzen</span>
                </button>
            </div>
        </div>

        <!-- Weekly Days List -->
        <div class="space-y-2 pt-1">
            {#each DAYS as day (day.key)}
                {@const dayData = ohState.days[day.key] || { closed: false, slots: [] }}
                <div class="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 transition-all {dayData.closed ? 'opacity-70 bg-slate-50/50' : ''}">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <!-- Day label & Closed toggle -->
                        <div class="flex items-center gap-2.5 min-w-[120px] pt-1">
                            <label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={!dayData.closed}
                                    onchange={(e) => {
                                        const open = e.currentTarget.checked;
                                        dayData.closed = !open;
                                        if (open && (!dayData.slots || dayData.slots.length === 0)) {
                                            dayData.slots = [{ open: "09:00", close: "17:00" }];
                                        }
                                    }}
                                    class="rounded text-amber-600 focus:ring-amber-500"
                                />
                                <span>{day.label}</span>
                            </label>
                        </div>

                        <!-- Slots or Closed Badge -->
                        <div class="flex-1 min-w-[240px] space-y-1.5">
                            {#if dayData.closed}
                                <span class="text-xs text-slate-400 font-medium italic">
                                    Geschlossen
                                </span>
                            {:else}
                                {#each dayData.slots as slot, sIdx (sIdx)}
                                    <div class="flex items-center gap-1.5 flex-wrap text-xs">
                                        <span class="text-[11px] text-slate-400 font-medium">von</span>
                                        <input
                                            type="time"
                                            bind:value={slot.open}
                                            class="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                                        />
                                        <span class="text-[11px] text-slate-400 font-medium">bis</span>
                                        <input
                                            type="time"
                                            bind:value={slot.close}
                                            class="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                                        />
                                        <input
                                            type="text"
                                            bind:value={slot.label}
                                            placeholder="z. B. Kernzeit / Beratung"
                                            class="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1 min-w-[100px]"
                                        />
                                        {#if dayData.slots.length > 1}
                                            <button
                                                type="button"
                                                onclick={() => removeSlot(day.key, sIdx)}
                                                class="p-1 text-slate-400 hover:text-red-500 transition"
                                                title="Zeitraum entfernen"
                                            >
                                                <Trash2 class="w-3.5 h-3.5" />
                                            </button>
                                        {/if}
                                    </div>
                                {/each}

                                <div class="flex items-center gap-3 pt-0.5">
                                    <button
                                        type="button"
                                        onclick={() => addSlot(day.key)}
                                        class="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium"
                                    >
                                        <Plus class="w-3 h-3" />
                                        <span>Weiterer Zeitraum (z. B. Nachmittag)</span>
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>

        <!-- Special Days & Holidays Exceptions -->
        <div class="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar class="w-3.5 h-3.5 text-amber-500" />
                    <span>Sonderöffnungszeiten & Feiertage (Ausnahmen)</span>
                </span>
                <button
                    type="button"
                    onclick={addSpecialHour}
                    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-amber-400"
                >
                    <Plus class="w-3 h-3 text-amber-600" />
                    <span>Ausnahme hinzufügen</span>
                </button>
            </div>

            {#if ohState.specialHours.length > 0}
                <div class="space-y-1.5">
                    {#each ohState.specialHours as sp, idx (idx)}
                        <div class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs flex-wrap">
                            <input
                                type="date"
                                bind:value={sp.date}
                                class="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                            />
                            <label class="flex items-center gap-1 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    bind:checked={sp.closed}
                                    class="rounded text-amber-600"
                                />
                                <span>Geschlossen</span>
                            </label>
                            <input
                                type="text"
                                bind:value={sp.note}
                                placeholder="Grund (z. B. Heiligabend, Feiertag, Betriebsruhe)"
                                class="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1 min-w-[120px]"
                            />
                            <button
                                type="button"
                                onclick={() => removeSpecialHour(idx)}
                                class="p-1 text-slate-400 hover:text-red-500 transition"
                                title="Ausnahme entfernen"
                            >
                                <Trash2 class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- General Notes -->
        <div class="pt-2 border-t border-slate-200 dark:border-slate-700/80">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Zusatzhinweise (z. B. Telefonische Erreichbarkeit, Barrierefreier Zugang)
            </label>
            <input
                type="text"
                bind:value={ohState.notes}
                placeholder="z. B. Telefonische Erreichbarkeit • Barrierefreier Zugang"
                class="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
        </div>

        <!-- Formatted Live Preview -->
        <div class="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-xs">
            <div class="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold mb-1 text-[11px] uppercase tracking-wider">
                <Sparkles class="w-3 h-3 text-amber-600" />
                <span>Automatisch formatierte Anzeige (für Kioske, Plakate & Web):</span>
            </div>
            <div class="font-mono text-slate-800 dark:text-slate-200 whitespace-pre-line text-xs leading-relaxed">
                {liveFormattedLines.join('\n')}
            </div>
        </div>

        <!-- Hidden Input strictly bound to SvelteKit Remote Functions -->
        {#if serializedOpeningHours !== undefined}
            <input {...rf.fields.openingHours.as("hidden", serializedOpeningHours)} />
        {/if}

        {#each rf.fields.openingHours.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <label class="flex items-center gap-2 cursor-pointer py-2">
        <input
            {...rf.fields.isPublic.as("checkbox", initialData?.isPublic ?? true)}
            type="checkbox"
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.isPublic}</span>
        {#each rf.fields.isPublic.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    {#if children}
        {@render children()}
    {/if}

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? i18n.saving : i18n.creating}
            loading={(rf as any).pending}
        >
            {isUpdating ? i18n.saveChanges : i18n.createLocation}
        </AsyncButton>
        {#if onCancel}
            <Button
                variant="secondary"
                type="button"
                size="default"
                onclick={onCancel}
            >
                {i18n.cancel}
            </Button>
        {:else}
            <Button variant="secondary" href={cancelHref} size="default">
                {i18n.cancel}
            </Button>
        {/if}
    </div>
</form>
