<script lang="ts">
	import { untrack, onMount } from "svelte";
	import {
		Calendar,
		ArrowLeft,
		ArrowRight,
		ArrowLeftRight,
		Mail,
		Users,
		MapPin,
		Search,
		Camera,
		ShieldCheck,
		CheckCircle2,
		AlertCircle,
		RefreshCw,
		Building2,
		Settings2,
		Server,
		Check,
		Filter,
		Folder,
		X,
		SlidersHorizontal,
		Clock,
		Globe,
		Lock,
		Plus
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import * as m from "#lib/paraglide/messages.js";
	import { translateIssue, EntityManager, handleDelete, matchContactSearch } from "@ac/ui";
	import TemplateSelector from "./TemplateSelector.svelte";
	import ContactForm from "../contacts/ContactForm.svelte";
	import KioskMultiSelect from "../kiosks/KioskMultiSelect.svelte";
	import { listLocations } from "../../../routes/locations/list.remote";
	import { listEvents } from "../../../routes/events/list.remote";
	import { listTags } from "../../../routes/tags/list.remote";
	import { listEventRoles } from "../../../routes/event-roles/list.remote";
	import {
		formatForInput,
		getNextWeekRange,
		getThisWeekRange,
		getNextMonthRange,
		getThisMonthRange,
		formatDateRangeDisplay,
	} from "#lib/utils/kiosk-dates.js";
	import { listContacts } from "../../../routes/contacts/list.remote";
	import { createContact } from "../../../routes/contacts/new/create.remote";
	import { updateContact } from "../../../routes/contacts/[id]/update.remote";
	import { readContact } from "../../../routes/contacts/[id]/read.remote";
	import { createContactSchema, updateContactSchema } from "@ac/validations";
	import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";
	import { getContactFilterGroups } from "#lib/filters/index.js";
	import { getDerivedEventContacts, type DerivedRecipientContact, isEmployeeContact } from "#lib/filters/synchronizations.js";
	import { testMicrosoftTarget } from "../../../routes/synchronizations/test-target.remote";
	import {
		listMicrosoftMailboxes,
		listMicrosoftCalendars,
		listMicrosoftContactFolders
	} from "../../../routes/synchronizations/microsoft-targets.remote";

	interface Props {
		remoteFunction: any;
		isUpdating?: boolean;
		initialData?: any;
	}
	let { remoteFunction, isUpdating = false, initialData }: Props = $props();

	const providers = [
		{
			id: "google-calendar" as const,
			name: "Google Calendar",
			description: "Sync with your Google Calendar",
			icon: Calendar,
			available: true,
		},
		{
			id: "microsoft-calendar" as const,
			name: "Microsoft Calendar",
			description: "Sync events with Outlook / Microsoft 365 calendar",
			icon: Calendar,
			available: true,
		},
		{
			id: "microsoft-contacts" as const,
			name: "Microsoft Contacts",
			description: "Sync contacts and staff with Outlook Contacts",
			icon: Users,
			available: true,
		},
		{
			id: "microsoft-resources" as const,
			name: "Microsoft Resources",
			description: "Discover & book meeting rooms and resources in Microsoft 365",
			icon: MapPin,
			available: true,
		},
		{
			id: "berlin-de-main-calendar" as const,
			name: "Berlin.de (Main Calendar)",
			description: "Push events to main Berlin.de event calendar",
			icon: Calendar,
			available: true,
		},
		{
			id: "berlin-de-mh-calendar" as const,
			name: "Berlin.de (Marzahn-Hellersdorf)",
			description: "Push events to Berlin.de MH district calendar",
			icon: Calendar,
			available: true,
		},
		{
			id: "wp-the-events-calendar" as const,
			name: "WP The Events Calendar",
			description:
				"Push events to WordPress site with The Events Calendar plugin",
			icon: Calendar,
			available: true,
		},
		{
			id: "eventbrite" as const,
			name: "Eventbrite",
			description: "Sync with Eventbrite events",
			icon: Calendar,
			available: true,
		},
		{
			id: "meetup" as const,
			name: "Meetup",
			description: "Sync with Meetup.com groups",
			icon: Users,
			available: true,
		},
		{
			id: "seniorennetz-berlin" as const,
			name: "Seniorennetz Berlin",
			description: "Sync with Seniorennetz Berlin events",
			icon: Users,
			available: true,
		},
		{
			id: "bewegungsatlas-berlin" as const,
			name: "Bewegungsatlas Berlin",
			description: "Sync with Bewegungsatlas Berlin activities",
			icon: MapPin,
			available: true,
		},
		{
			id: "email" as const,
			name: "E-Mail (Brevo)",
			description: "Send email campaigns via Brevo with Svelte templates & contacts",
			icon: Mail,
			available: true,
		},
		{
			id: "nebenan-de" as const,
			name: "Nebenan.de",
			description: "Push events to Nebenan.de organisation profile",
			icon: Users,
			available: true,
		},
		{
			id: "instagram" as const,
			name: "Instagram",
			description: "Push events to Instagram feed & stories with Svelte templates",
			icon: Camera,
			available: true,
		},
	];

	const directions = [
		{
			value: "pull" as const,
			label: "Pull Only",
			description: "Import events from external calendar to this app",
			icon: ArrowLeft,
		},
		{
			value: "push" as const,
			label: "Push Only",
			description: "Export events from this app to external calendar",
			icon: ArrowRight,
		},
		{
			value: "bidirectional" as const,
			label: "Bidirectional",
			description: "Keep both calendars in sync",
			icon: ArrowLeftRight,
		},
	];

	let selectedProvider = $state<string | null>(untrack(() => initialData?.providerType || null));
	let searchTerm = $state("");
	let filteredProviders = $derived(
		providers.filter((p) =>
			p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
			p.description.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	let providerId = $state(untrack(() => initialData?.name || ""));
	let direction = $state<"pull" | "push" | "bidirectional">(untrack(() => initialData?.direction || "bidirectional"));
	let calendarId = $state(untrack(() => initialData?.settings?.calendarId || "primary"));
	let syncIntervalMinutes = $state(untrack(() => initialData?.settings?.syncIntervalMinutes || 60));
	let isDefault = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.isDefault;
			return val === true || val === "true" || val === 1;
		})
	);
	let company = $state(untrack(() => initialData?.settings?.company || ""));
	let wpBaseUrl = $state(untrack(() => initialData?.settings?.baseUrl || ""));
	let wpUsername = $state(untrack(() => initialData?.settings?.username || ""));
	let wpAppPassword = $state(untrack(() => initialData?.settings?.applicationPassword || ""));
	let mhUsername = $state(untrack(() => initialData?.credentials?.username || ""));
	let mhPassword = $state(untrack(() => initialData?.credentials?.password || ""));
	let nebenanEmail = $state(untrack(() => initialData?.credentials?.email || ""));
	let nebenanPassword = $state(untrack(() => initialData?.credentials?.password || ""));
	let nebenanProfileId = $state(untrack(() => initialData?.settings?.profileId || ""));
	let instagramAccountId = $state(untrack(() => initialData?.settings?.instagramAccountId || ""));
	let instagramAccessToken = $state(untrack(() => initialData?.settings?.accessToken || initialData?.credentials?.accessToken || ""));
	let instagramTemplate = $state(untrack(() => initialData?.settings?.selectedTemplate || "standard"));
	let instagramHashtags = $state(untrack(() => initialData?.settings?.defaultHashtags || "#events #community"));

	let emailTemplate = $state(untrack(() => initialData?.settings?.selectedTemplate || "standard"));
	let recipientEmail = $state(untrack(() => initialData?.settings?.recipientEmail || ""));
	let includeEventContacts = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.includeEventContacts;
			return val === true || val === "true" || val === "1";
		})
	);
	let brevoApiKey = $state(untrack(() => initialData?.settings?.apiKey || initialData?.credentials?.apiKey || ""));

	let recipientContactIds = $state<string[]>(
		untrack(() => {
			const raw = initialData?.settings?.recipientContactIds;
			if (Array.isArray(raw)) return raw;
			if (typeof raw === "string" && raw.trim()) {
				try {
					const parsed = JSON.parse(raw);
					return Array.isArray(parsed) ? parsed : [raw];
				} catch {
					return [raw];
				}
			}
			return [];
		})
	);
	let excludedRecipientContactIds = $state<string[]>(
		untrack(() => {
			const raw = initialData?.settings?.excludedRecipientContactIds;
			if (Array.isArray(raw)) return raw;
			if (typeof raw === "string" && raw.trim()) {
				try {
					const parsed = JSON.parse(raw);
					return Array.isArray(parsed) ? parsed : [raw];
				} catch {
					return [raw];
				}
			}
			return [];
		})
	);

	// Microsoft Synchronization settings
	let msAuthMode = $state<"auto" | "app" | "user">(untrack(() => initialData?.settings?.authMode || "auto"));

	let msMailboxType = $state<"user" | "shared" | "room" | "group">(
		untrack(() => {
			const calId = initialData?.settings?.calendarId;
			const isEmail = typeof calId === "string" && calId.includes("@");
			if (initialData?.settings?.mailboxType) return initialData.settings.mailboxType;
			if (initialData?.settings?.mailboxEmail || isEmail) return "shared";
			return "user";
		})
	);
	let msMailboxEmail = $state<string>(
		untrack(() => {
			const calId = initialData?.settings?.calendarId;
			const isEmail = typeof calId === "string" && calId.includes("@");
			if (initialData?.settings?.mailboxEmail) return initialData.settings.mailboxEmail;
			if (isEmail) return calId;
			return "";
		})
	);
	let msCalendarId = $state<string>(
		untrack(() => {
			const calId = initialData?.settings?.calendarId;
			const isEmail = typeof calId === "string" && calId.includes("@");
			if (isEmail) return "primary";
			return initialData?.settings?.calendarId || "primary";
		})
	);
	let msFolderId = $state<string>(untrack(() => initialData?.settings?.folderId || ""));
	let msResourceFilter = $state<"all" | "room" | "equipment">(untrack(() => initialData?.settings?.resourceFilter || "room"));
	let msIncludeRoomBookings = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.includeRoomBookings;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);
	let msIncludeContacts = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.includeContacts;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);
	let msAutoBookOnCalendar = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.autoBookOnCalendar;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);

	let msMailboxSearch = $state("");
	let debouncedSearch = $state("");
	let msMailboxFilterType = $state<"all" | "shared" | "room" | "user">("all");
	let msManualMailboxInput = $state(false);
	let msCustomCalendar = $state(false);
	let msCustomFolder = $state(false);

	// Event Selection & Filtering States (modeled after Kiosk selection UI)
	let excludeSeries = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.excludeSeries;
			return val === true || val === "true" || val === 1;
		})
	);
	let syncSeriesMode = $state<"all" | "exclude" | "master_only">(
		untrack(() => initialData?.settings?.syncSeriesMode || (initialData?.settings?.excludeSeries ? "exclude" : "all"))
	);
	let excludeNonPublic = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.excludeNonPublic;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);
	let excludeTentative = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.excludeTentative;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);
	let excludeCancelled = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.excludeCancelled;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);
	let excludePastEvents = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.excludePastEvents;
			return val === undefined ? false : (val === true || val === "true" || val === 1);
		})
	);

	let rangeMode = $state<string>(
		untrack(() => initialData?.settings?.rangeMode || "all")
	);
	let lookAheadDays = $state<number>(
		untrack(() => {
			const val = initialData?.settings?.lookAheadDays;
			return val !== undefined && val !== null && val !== "" ? Number(val) : 30;
		})
	);
	let lookPastDays = $state<number>(
		untrack(() => {
			const val = initialData?.settings?.lookPastDays;
			return val !== undefined && val !== null && val !== "" ? Number(val) : 0;
		})
	);
	let startDate = $state<string>(
		untrack(() => initialData?.settings?.startDate || "")
	);
	let endDate = $state<string>(
		untrack(() => initialData?.settings?.endDate || "")
	);

	let includedTags = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.includedTags;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let excludedTags = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.excludedTags;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let includedLocationIds = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.includedLocationIds;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let excludedLocationIds = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.excludedLocationIds;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let includedEventIds = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.includedEventIds;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let excludedEventIds = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.excludedEventIds;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);

	// Participant & Contact Sync Settings
	let syncParticipants = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.syncParticipants ?? initialData?.settings?.includeEventContacts;
			return val === undefined ? true : (val === true || val === "true" || val === 1);
		})
	);
	let includeEmployeeContacts = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.includeEmployeeContacts;
			if (val !== undefined) return val === true || val === "true" || val === 1;
			const legacyOnlyEmp = initialData?.settings?.onlyEmployeeContacts;
			if (legacyOnlyEmp !== undefined) return legacyOnlyEmp === true || legacyOnlyEmp === "true" || legacyOnlyEmp === 1;
			return true; // Default: internal staff only
		})
	);
	let includePublicContacts = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.includePublicContacts;
			if (val !== undefined) return val === true || val === "true" || val === 1;
			if (initialData?.settings?.onlyEmployeeContacts === false) return true;
			return false; // Default: public contacts not synced unless enabled
		})
	);
	let includeNonPublicContacts = $state<boolean>(
		untrack(() => {
			const val = initialData?.settings?.includeNonPublicContacts;
			if (val !== undefined) return val === true || val === "true" || val === 1;
			if (initialData?.settings?.onlyEmployeeContacts === false && initialData?.settings?.includePublicContacts === undefined) return true;
			return false; // Default: non-public user NOT synced by default
		})
	);
	const onlyEmployeeContactsDerived = $derived(
		includeEmployeeContacts && !includePublicContacts && !includeNonPublicContacts
	);
	let participantRoleFilterMode = $state<"all" | "include" | "exclude">(
		untrack(() => {
			const mode = initialData?.settings?.participantRoleFilterMode;
			if (mode === "include" || mode === "exclude") return mode;
			if (initialData?.settings?.includedContactRoles?.length) return "include";
			if (initialData?.settings?.excludedContactRoles?.length) return "exclude";
			return "all";
		})
	);
	let includedContactRoles = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.includedContactRoles;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let excludedContactRoles = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.excludedContactRoles;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let participantTagFilterMode = $state<"all" | "include" | "exclude">(
		untrack(() => {
			const mode = initialData?.settings?.participantTagFilterMode;
			if (mode === "include" || mode === "exclude") return mode;
			if (initialData?.settings?.includedContactTags?.length) return "include";
			if (initialData?.settings?.excludedContactTags?.length) return "exclude";
			return "all";
		})
	);
	let includedContactTags = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.includedContactTags;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);
	let excludedContactTags = $state<string[]>(
		untrack(() => {
			const val = initialData?.settings?.excludedContactTags;
			if (Array.isArray(val)) return val;
			if (typeof val === "string" && val.trim()) {
				try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; } catch { return [val]; }
			}
			return [];
		})
	);

	const isEventProvider = $derived(
		selectedProvider !== "microsoft-contacts" &&
		selectedProvider !== "microsoft-resources"
	);
	const isParticipantProvider = $derived(
		isEventProvider || selectedProvider === "microsoft-contacts"
	);

	const eventRolesQuery = listEventRoles({ limit: 1000 });
	const eventRoles = $derived(eventRolesQuery.current?.data ?? []);

	const tagsQuery = listTags({ limit: 1000 });
	const tags = $derived(tagsQuery.current?.data ?? []);

	const locationsQuery = listLocations({ limit: 1000 });
	const locations = $derived(locationsQuery.current?.data ?? []);

	const eventsQuery = listEvents({ limit: 1000 });
	const events = $derived(eventsQuery.current?.data ?? []);

	const isCalendarMode = $derived(
		rangeMode === "next_week" ||
		rangeMode === "this_week" ||
		rangeMode === "next_month" ||
		rangeMode === "this_month"
	);
	const isRollingDaysMode = $derived(rangeMode === "rolling");
	const isFixedMode = $derived(rangeMode === "fixed");

	const calendarPreview = $derived.by(() => {
		const now = new Date();
		if (rangeMode === "next_week") return getNextWeekRange(now);
		if (rangeMode === "this_week") return getThisWeekRange(now);
		if (rangeMode === "next_month") return getNextMonthRange(now);
		if (rangeMode === "this_month") return getThisMonthRange(now);
		return null;
	});

	function applyNextWeek() {
		if (isFixedMode) {
			const { start, end } = getNextWeekRange();
			startDate = formatForInput(start);
			endDate = formatForInput(end);
		} else if (isRollingDaysMode) {
			lookAheadDays = 7;
			lookPastDays = 0;
		} else {
			rangeMode = "next_week";
		}
	}

	function applyNextMonth() {
		if (isFixedMode) {
			const { start, end } = getNextMonthRange();
			startDate = formatForInput(start);
			endDate = formatForInput(end);
		} else if (isRollingDaysMode) {
			lookAheadDays = 30;
			lookPastDays = 0;
		} else {
			rangeMode = "next_month";
		}
	}

	function applyThisWeek() {
		if (isFixedMode) {
			const { start, end } = getThisWeekRange();
			startDate = formatForInput(start);
			endDate = formatForInput(end);
		} else if (isRollingDaysMode) {
			lookAheadDays = 7;
			lookPastDays = 0;
		} else {
			rangeMode = "this_week";
		}
	}

	function applyThisMonth() {
		if (isFixedMode) {
			const { start, end } = getThisMonthRange();
			startDate = formatForInput(start);
			endDate = formatForInput(end);
		} else if (isRollingDaysMode) {
			lookAheadDays = 30;
			lookPastDays = 0;
		} else {
			rangeMode = "this_month";
		}
	}

	function applyDaysOffset(days: number) {
		if (isFixedMode) {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
			const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59);
			startDate = formatForInput(start);
			endDate = formatForInput(end);
		} else if (isRollingDaysMode) {
			lookAheadDays = days;
			lookPastDays = 0;
		} else {
			rangeMode = "rolling";
			lookAheadDays = days;
			lookPastDays = 0;
		}
	}

	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	function handleMailboxSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
		const val = e.currentTarget.value;
		msMailboxSearch = val;
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			debouncedSearch = val;
		}, 250);
	}

	const isMicrosoft = $derived(
		selectedProvider === "microsoft-calendar" ||
		selectedProvider === "microsoft-contacts" ||
		selectedProvider === "microsoft-resources"
	);

	const mailboxesQuery = $derived(
		isMicrosoft && msMailboxType === "shared" && !msManualMailboxInput
			? listMicrosoftMailboxes({
				search: debouncedSearch.trim() || undefined,
				authMode: msAuthMode
			})
			: undefined
	);
	const tenantMailboxes = $derived(mailboxesQuery?.current ?? []);

	const filteredTenantMailboxes = $derived(
		msMailboxFilterType === "all"
			? tenantMailboxes
			: tenantMailboxes.filter((mb) => mb.type === msMailboxFilterType)
	);

	const mailboxCounts = $derived({
		all: tenantMailboxes.length,
		shared: tenantMailboxes.filter((m) => m.type === "shared").length,
		room: tenantMailboxes.filter((m) => m.type === "room").length,
		user: tenantMailboxes.filter((m) => m.type === "user").length
	});

	const selectedMailboxObj = $derived(
		tenantMailboxes.find((mb) => mb.email.toLowerCase() === msMailboxEmail.toLowerCase())
	);

	const calendarsQuery = $derived(
		selectedProvider === "microsoft-calendar"
			? listMicrosoftCalendars({
				mailboxEmail: msMailboxType === "shared" && msMailboxEmail ? msMailboxEmail : undefined,
				currentCalendarId: msCalendarId || undefined,
				authMode: msAuthMode
			})
			: undefined
	);
	const availableCalendars = $derived(calendarsQuery?.current ?? []);

	const selectedCalendarObj = $derived(
		availableCalendars.find((c) => c.id === msCalendarId || (msCalendarId === "primary" && c.isDefault))
	);

	const foldersQuery = $derived(
		selectedProvider === "microsoft-contacts"
			? listMicrosoftContactFolders({
				mailboxEmail: msMailboxType === "shared" && msMailboxEmail ? msMailboxEmail : undefined,
				currentFolderId: msFolderId || undefined,
				authMode: msAuthMode
			})
			: undefined
	);
	const availableFolders = $derived(foldersQuery?.current ?? []);

	const selectedFolderObj = $derived(
		availableFolders.find((f) => f.id === msFolderId)
	);

	let msTestingState = $state<{
		testing: boolean;
		result?: any;
		error?: string;
	}>({ testing: false });

	async function handleTestMicrosoftTarget() {
		try {
			msTestingState = { testing: true, result: undefined, error: undefined };
			const type = selectedProvider === "microsoft-contacts"
				? "contacts"
				: selectedProvider === "microsoft-resources"
					? "resources"
					: "calendar";

			const res = await testMicrosoftTarget({
				type,
				authMode: msAuthMode,
				mailboxEmail: msMailboxType === "shared" ? msMailboxEmail : undefined,
				calendarId: msCalendarId,
				folderId: msFolderId
			});

			msTestingState = {
				testing: false,
				result: res,
				error: res.success ? undefined : (res.error || res.message)
			};

			if (res.success) {
				toast.success(res.message);
			} else {
				toast.error(res.error || res.message);
			}
		} catch (err: any) {
			const msg = err?.message || "Failed to test Microsoft target";
			msTestingState = {
				testing: false,
				error: msg
			};
			toast.error(msg);
		}
	}

	let additionalContactsList = $state<any[]>([]);

	onMount(() => {
		if (recipientContactIds.length > 0) {
			listContacts({ limit: 100 }).then((res) => {
				const all = res?.data || [];
				additionalContactsList = all
					.filter((c: any) => recipientContactIds.includes(c.id))
					.map((c: any) => ({
						...c,
						isEventDerived: false,
						isEmployee: isEmployeeContact(c)
					}));
			}).catch(() => {});
		}
	});

	const currentSyncSettings = $derived({
		// Event filters
		excludeSeries,
		syncSeriesMode,
		excludeNonPublic,
		excludeTentative,
		excludeCancelled,
		excludePastEvents,
		rangeMode,
		lookAheadDays,
		lookPastDays,
		startDate,
		endDate,
		includedLocationIds,
		excludedLocationIds,
		includedTags,
		excludedTags,
		includedEventIds,
		excludedEventIds,

		// Participant filters
		syncParticipants,
		includeEventContacts: syncParticipants,
		includeEmployeeContacts,
		includePublicContacts,
		includeNonPublicContacts,
		onlyEmployeeContacts: onlyEmployeeContactsDerived,
		participantRoleFilterMode,
		includedContactRoles,
		excludedContactRoles,
		participantTagFilterMode,
		includedContactTags,
		excludedContactTags,
	});

	const eventDerivedContacts = $derived.by<DerivedRecipientContact[]>(() => {
		if (selectedProvider !== "email") return [];
		return getDerivedEventContacts(events, currentSyncSettings);
	});

	const combinedRecipientContacts = $derived.by<any[]>(() => {
		if (selectedProvider !== "email") return [];
		const excludedSet = new Set(excludedRecipientContactIds);
		const filteredEventContacts = eventDerivedContacts.filter((c) => !excludedSet.has(c.id));
		const eventContactIds = new Set(filteredEventContacts.map((c) => c.id));

		const extraContacts: any[] = [];
		for (const id of recipientContactIds) {
			if (!eventContactIds.has(id)) {
				const existing = additionalContactsList.find((c: any) => c.id === id);
				if (existing) {
					extraContacts.push({
						...existing,
						isEventDerived: false,
						isEmployee: isEmployeeContact(existing),
					});
				} else {
					extraContacts.push({
						id,
						displayName: "Loading contact...",
						isEventDerived: false,
						isEmployee: false,
					});
				}
			}
		}

		return [...filteredEventContacts, ...extraContacts];
	});

	function handleRecipientsChange(ids: string[], items: any[]) {
		const currentIds = new Set(ids);
		const eventContactIds = new Set(eventDerivedContacts.map((c) => c.id));

		// Additional contacts are those in `ids` that are NOT derived from events
		recipientContactIds = ids.filter((id) => !eventContactIds.has(id));

		// Excluded contacts are event-derived contacts that are NOT in `ids`
		excludedRecipientContactIds = eventDerivedContacts
			.map((c) => c.id)
			.filter((id) => !currentIds.has(id));

		// Update additionalContactsList cache with any newly linked full objects
		for (const item of items) {
			if (item?.id && !eventContactIds.has(item.id)) {
				if (!additionalContactsList.some((c: any) => c.id === item.id)) {
					additionalContactsList.push({
						...item,
						isEventDerived: false,
						isEmployee: isEmployeeContact(item)
					});
				}
			}
		}
	}

	const instagramTemplates = [
		{
			id: "standard",
			name: "Standard Event Post",
			description: "Feature-rich post template with emojis, date/time, location, and hashtags."
		},
		{
			id: "minimal",
			name: "Minimal & Punchy",
			description: "Concise summary ideal for fast scrolling on Instagram feed."
		},
		{
			id: "story-banner",
			name: "Story Banner Layout",
			description: "Vibrant highlight design layout suitable for Instagram Stories and highlights."
		}
	];

	const emailTemplates = [
		{
			id: "standard",
			name: "Standard Event Notification",
			description: "Rich HTML notification with full event details, date/time, location, and contact info."
		},
		{
			id: "minimal",
			name: "Minimal & Direct",
			description: "Clean layout focused on event title, date, location, and concise summary."
		},
		{
			id: "newsletter",
			name: "Newsletter Highlight",
			description: "Modern card-based layout ideal for community announcements and bulletins."
		}
	];

	// Set default direction based on provider if we are creating
	$effect(() => {
		if (
			!isUpdating && (
			selectedProvider === "berlin-de-main-calendar" ||
			selectedProvider === "berlin-de-mh-calendar" ||
			selectedProvider === "wp-the-events-calendar" ||
			selectedProvider === "eventbrite" ||
			selectedProvider === "meetup" ||
			selectedProvider === "seniorennetz-berlin" ||
			selectedProvider === "bewegungsatlas-berlin" ||
			selectedProvider === "email" ||
			selectedProvider === "nebenan-de" ||
			selectedProvider === "instagram")
		) {
			direction = "push";
		}
	});

	let prevIssuesLength = $state(0);
	const fields = $derived(remoteFunction.fields as any);
	
	$effect(() => {
		const issues = (remoteFunction as any).allIssues?.() ?? [];
		if (issues.length > 0 && prevIssuesLength === 0) {
			toast.error(m.please_fix_validation());
		}
		prevIssuesLength = issues.length;
	});
</script>

<!-- Hidden Inputs required for form submission -->
{#if isUpdating && initialData?.id}
	<input {...fields.id.as("hidden", initialData.id)} />
{/if}
{#if selectedProvider}
	<input
		{...fields.providerType.as("hidden", selectedProvider)}
	/>
{/if}

<!-- Provider Selection -->
{#if !isUpdating}
<div class="bg-white shadow rounded-lg p-6 space-y-4">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
		<h2 class="text-xl font-semibold">Select Calendar Provider</h2>
		<div class="relative w-full md:w-64">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Filter providers..."
				class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		</div>
	</div>

	<div class="grid gap-3 grid-cols-2 lg:grid-cols-3">
		{#each filteredProviders as provider (provider.id)}
			{@const Icon = provider.icon}
			<button
				type="button"
				disabled={!provider.available}
				class="text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 {selectedProvider === provider.id
					? 'border-blue-600 bg-blue-50'
					: provider.available
						? 'border-gray-200 hover:border-gray-300'
						: 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}"
				onclick={() => provider.available && (selectedProvider = provider.id)}
			>
				<div class="rounded-lg p-1.5 shrink-0 {selectedProvider === provider.id ? 'bg-blue-200' : 'bg-gray-100'}">
					<Icon class="h-5 w-5 {selectedProvider === provider.id ? 'text-blue-600' : 'text-gray-600'}" />
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="font-semibold text-sm truncate" title={provider.name}>
						{provider.name}
					</h3>
					{#if !provider.available}
						<p class="text-[10px] text-orange-600 font-medium uppercase tracking-wider">
							Coming soon
						</p>
					{/if}
				</div>
			</button>
		{/each}
		{#if filteredProviders.length === 0}
			<div class="col-span-full py-8 text-center text-gray-500 text-sm italic">
				No providers found matching "{searchTerm}"
			</div>
		{/if}
	</div>
</div>
{/if}

{#if selectedProvider}
<!-- Configuration -->
<div class="bg-white shadow rounded-lg p-6 space-y-4">
	<h2 class="text-xl font-semibold mb-4">Configuration</h2>
	<div class="space-y-4">
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
				Sync Name
			</label>
			<input
				{...fields.name.as("text", providerId)}
				placeholder="e.g., my-work-calendar"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(fields.name.issues() ?? []).length > 0 ? 'border-red-500' : ''}"
			/>
			{#each fields.name.issues() ?? [] as issue (issue.message)}
				<p class="text-xs text-red-600 mt-1">
					{translateIssue(issue.message, m)}
				</p>
			{/each}
			<p class="text-xs text-gray-500 mt-1">
				A unique identifier for this sync configuration
			</p>
		</div>

		{#if selectedProvider === "google-calendar"}
			<div>
				<label for="calendarId" class="block text-sm font-medium text-gray-700 mb-1">
					Calendar ID
				</label>
				<input
					{...fields.settings.calendarId.as("text")}
					id="calendarId"
					bind:value={calendarId}
					placeholder="primary"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Use "primary" for your main calendar or specify a calendar ID
				</p>
			</div>
		{/if}

		{#if selectedProvider === "microsoft-calendar" || selectedProvider === "microsoft-contacts" || selectedProvider === "microsoft-resources"}
			<div class="border border-blue-200 bg-blue-50/40 rounded-xl p-5 space-y-5">
				<div class="flex items-center gap-2 border-b border-blue-200 pb-3">
					<Server class="h-5 w-5 text-blue-600" />
					<h3 class="font-semibold text-gray-900 text-base">
						{selectedProvider === "microsoft-calendar"
							? (m.microsoft_calendar_settings ? m.microsoft_calendar_settings() : "Microsoft Calendar Configuration")
							: selectedProvider === "microsoft-contacts"
								? (m.microsoft_contacts_settings ? m.microsoft_contacts_settings() : "Microsoft Contacts Configuration")
								: (m.microsoft_resources_settings ? m.microsoft_resources_settings() : "Microsoft Resources & Rooms Configuration")}
					</h3>
				</div>

				<!-- Target Mailbox Selection (Personal vs Shared / Detached) -->
				<div class="space-y-3">
					<span class="block text-sm font-medium text-gray-700">
						{m.ms_mailbox_type ? m.ms_mailbox_type() : "Target Mailbox"}
					</span>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label
							class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {msMailboxType === 'user' ? 'border-blue-600 bg-white ring-2 ring-blue-500/20' : 'border-gray-200 bg-white hover:border-gray-300'}"
						>
							<input
								type="radio"
								value="user"
								checked={msMailboxType === "user"}
								onchange={() => (msMailboxType = "user")}
								class="mt-1 text-blue-600 focus:ring-blue-500"
							/>
							<div>
								<div class="font-medium text-sm text-gray-900">
									{m.ms_mailbox_user ? m.ms_mailbox_user() : "Personal Mailbox"}
								</div>
								<div class="text-xs text-gray-500">
									Connects to your signed-in Microsoft 365 account
								</div>
							</div>
						</label>

						<label
							class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {msMailboxType === 'shared' ? 'border-blue-600 bg-white ring-2 ring-blue-500/20' : 'border-gray-200 bg-white hover:border-gray-300'}"
						>
							<input
								type="radio"
								value="shared"
								checked={msMailboxType === "shared"}
								onchange={() => (msMailboxType = "shared")}
								class="mt-1 text-blue-600 focus:ring-blue-500"
							/>
							<div>
								<div class="font-medium text-sm text-gray-900">
									{m.ms_mailbox_shared ? m.ms_mailbox_shared() : "Shared / Detached Mailbox"}
								</div>
								<div class="text-xs text-gray-500">
									Dedicated or room mailbox (e.g. veranstaltung.bhs@...)
								</div>
							</div>
						</label>
					</div>
				</div>

				{#if msMailboxType === "shared"}
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="block text-sm font-medium text-gray-700">
								{m.ms_mailbox_email ? m.ms_mailbox_email() : "Mailbox Email Address"}
								<span class="text-red-500">*</span>
							</span>
							<button
								type="button"
								onclick={() => (msManualMailboxInput = !msManualMailboxInput)}
								class="text-xs text-blue-600 hover:text-blue-800 font-medium underline inline-flex items-center gap-1"
							>
								{msManualMailboxInput
									? (m.ms_browse_tenant ? m.ms_browse_tenant() : "Browse Tenant Directory")
									: (m.ms_manual_entry ? m.ms_manual_entry() : "Manual Entry")}
							</button>
						</div>

						{#if msManualMailboxInput}
							<div>
								<label for="msMailboxEmail" class="sr-only">
									{m.ms_mailbox_email ? m.ms_mailbox_email() : "Mailbox Email Address"}
								</label>
								<input
									id="msMailboxEmail"
									type="email"
									bind:value={msMailboxEmail}
									placeholder={m.ms_mailbox_email_placeholder ? m.ms_mailbox_email_placeholder() : "e.g. veranstaltung.bhs@ballev.onmicrosoft.com"}
									class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									required
								/>
								<p class="text-xs text-gray-500 mt-1">
									{m.ms_mailbox_email_hint ? m.ms_mailbox_email_hint() : "Enter the full email address of the detached or shared Microsoft 365 mailbox."}
								</p>
							</div>
						{:else}
							<!-- Selected Mailbox Banner (if selected) -->
							{#if msMailboxEmail}
								<div class="p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between">
									<div class="flex items-center gap-3 min-w-0">
										<div class="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
											{#if selectedMailboxObj?.type === "room"}
												<MapPin class="h-4 w-4" />
											{:else if selectedMailboxObj?.type === "user"}
												<Users class="h-4 w-4" />
											{:else}
												<Building2 class="h-4 w-4" />
											{/if}
										</div>
										<div class="min-w-0">
											<div class="font-medium text-sm text-blue-950 truncate">
												{selectedMailboxObj?.displayName || msMailboxEmail}
											</div>
											<div class="text-xs text-blue-700 font-mono truncate">
												{msMailboxEmail}
											</div>
										</div>
									</div>
									<button
										type="button"
										onclick={() => (msMailboxEmail = "")}
										class="shrink-0 ml-3 text-xs px-2.5 py-1 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-md font-medium shadow-sm"
									>
										Change
									</button>
								</div>
							{/if}

							<!-- Tenant Directory Browser -->
							<div class="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
								<!-- Search bar and Filters -->
								<div class="p-2.5 border-b border-gray-200 bg-gray-50/60 space-y-2">
									<div class="flex items-center gap-2">
										<div class="relative flex-1">
											<Search class="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
											<label for="msMailboxSearchInput" class="sr-only">
												{m.ms_search_mailboxes ? m.ms_search_mailboxes() : "Search tenant mailboxes..."}
											</label>
											<input
												id="msMailboxSearchInput"
												type="text"
												value={msMailboxSearch}
												oninput={handleMailboxSearchInput}
												placeholder={m.ms_search_mailboxes ? m.ms_search_mailboxes() : "Search tenant mailboxes by name or email..."}
												class="w-full pl-8 pr-8 py-1.5 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											/>
											{#if msMailboxSearch}
												<button
													type="button"
													onclick={() => { msMailboxSearch = ""; debouncedSearch = ""; }}
													class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
												>
													<X class="h-3.5 w-3.5" />
												</button>
											{/if}
										</div>
										<button
											type="button"
											title={m.ms_refresh_tenant ? m.ms_refresh_tenant() : "Refresh from Microsoft 365"}
											disabled={mailboxesQuery?.loading}
											onclick={() => void mailboxesQuery?.refresh()}
											class="p-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-100 text-gray-600 disabled:opacity-50"
										>
											<RefreshCw class="h-3.5 w-3.5 {mailboxesQuery?.loading ? 'animate-spin text-blue-600' : ''}" />
										</button>
									</div>

									<!-- Filter pills -->
									<div class="flex items-center gap-1.5 text-xs">
										<span class="text-gray-500 text-[11px] font-medium mr-1 flex items-center gap-1">
											<Filter class="h-3 w-3" />
										</span>
										<button
											type="button"
											onclick={() => (msMailboxFilterType = "all")}
											class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors {msMailboxFilterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200/80 text-gray-700 hover:bg-gray-300/80'}"
										>
											{m.ms_filter_all ? m.ms_filter_all() : "All"}{#if mailboxCounts.all > 0} ({mailboxCounts.all}){/if}
										</button>
										<button
											type="button"
											onclick={() => (msMailboxFilterType = "shared")}
											class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors {msMailboxFilterType === 'shared' ? 'bg-blue-600 text-white' : 'bg-gray-200/80 text-gray-700 hover:bg-gray-300/80'}"
										>
											{m.ms_filter_shared ? m.ms_filter_shared() : "Shared"}{#if mailboxCounts.all > 0} ({mailboxCounts.shared}){/if}
										</button>
										<button
											type="button"
											onclick={() => (msMailboxFilterType = "room")}
											class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors {msMailboxFilterType === 'room' ? 'bg-blue-600 text-white' : 'bg-gray-200/80 text-gray-700 hover:bg-gray-300/80'}"
										>
											{m.ms_filter_rooms ? m.ms_filter_rooms() : "Rooms"}{#if mailboxCounts.all > 0} ({mailboxCounts.room}){/if}
										</button>
										<button
											type="button"
											onclick={() => (msMailboxFilterType = "user")}
											class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors {msMailboxFilterType === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200/80 text-gray-700 hover:bg-gray-300/80'}"
										>
											{m.ms_filter_users ? m.ms_filter_users() : "Users"}{#if mailboxCounts.all > 0} ({mailboxCounts.user}){/if}
										</button>
									</div>
								</div>

								<!-- Mailbox List -->
								<div class="max-h-56 overflow-y-auto divide-y divide-gray-100 p-1">
									{#if mailboxesQuery?.loading && !mailboxesQuery.current}
										<div class="py-6 text-center text-xs text-gray-500 space-y-2">
											<RefreshCw class="h-4 w-4 animate-spin text-blue-600 mx-auto" />
											<div>Querying Microsoft 365 tenant directory...</div>
										</div>
									{:else if mailboxesQuery?.error}
										<div class="p-3 text-xs text-amber-800 bg-amber-50 rounded space-y-1.5 m-1">
											<div class="font-medium flex items-center gap-1.5">
												<AlertCircle class="h-4 w-4 text-amber-600 shrink-0" />
												<span>Tenant directory query unavailable</span>
											</div>
											<p class="text-[11px] text-amber-700">
												Could not list mailboxes automatically. You can switch to manual entry to specify the address directly.
											</p>
											<button
												type="button"
												onclick={() => (msManualMailboxInput = true)}
												class="text-[11px] underline font-semibold text-amber-900"
											>
												Use Manual Entry
											</button>
										</div>
									{:else if filteredTenantMailboxes.length === 0}
										<div class="py-6 text-center text-xs text-gray-500">
											No mailboxes found matching filter in tenant directory.
										</div>
									{:else}
										{#each filteredTenantMailboxes as mb (mb.id || mb.email)}
											{@const isSelected = msMailboxEmail.toLowerCase() === mb.email.toLowerCase()}
											<button
												type="button"
												onclick={() => {
													msMailboxEmail = mb.email;
													msCalendarId = "primary";
													void calendarsQuery?.refresh();
												}}
												class="w-full text-left p-2 rounded-md flex items-center justify-between gap-2 transition-colors {isSelected ? 'bg-blue-50 border border-blue-300 ring-1 ring-blue-400/30' : 'hover:bg-gray-50'}"
											>
												<div class="flex items-center gap-2.5 min-w-0">
													<div class="p-1.5 rounded shrink-0 {isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}">
														{#if mb.type === 'room'}
															<MapPin class="h-3.5 w-3.5" />
														{:else if mb.type === 'user'}
															<Users class="h-3.5 w-3.5" />
														{:else}
															<Building2 class="h-3.5 w-3.5" />
														{/if}
													</div>
													<div class="min-w-0">
														<div class="text-xs font-medium {isSelected ? 'text-blue-900' : 'text-gray-900'} truncate">
															{mb.displayName}
														</div>
														<div class="text-[11px] font-mono {isSelected ? 'text-blue-700' : 'text-gray-500'} truncate">
															{mb.email}
														</div>
													</div>
												</div>
												<div class="flex items-center gap-1.5 shrink-0">
													<span class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded {mb.type === 'room' ? 'bg-emerald-100 text-emerald-800' : mb.type === 'shared' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}">
														{mb.type}
													</span>
													{#if isSelected}
														<Check class="h-4 w-4 text-blue-600" />
													{/if}
												</div>
											</button>
										{/each}
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Calendar Specific Settings -->
				{#if selectedProvider === "microsoft-calendar"}
					<div>
						{#if !msCustomCalendar && availableCalendars.length > 0}
							<div class="flex items-center justify-between mb-1">
								<label for="msCalendarSelect" class="block text-sm font-medium text-gray-700">
									{m.ms_calendar_id ? m.ms_calendar_id() : "Calendar ID"}
								</label>
								<div class="flex items-center gap-2">
									<button
										type="button"
										title={m.ms_refresh_tenant ? m.ms_refresh_tenant() : "Refresh from Microsoft 365"}
										disabled={calendarsQuery?.loading}
										onclick={() => void calendarsQuery?.refresh()}
										class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
									>
										<RefreshCw class="h-3.5 w-3.5 {calendarsQuery?.loading ? 'animate-spin text-blue-600' : ''}" />
									</button>
									<button
										type="button"
										onclick={() => (msCustomCalendar = true)}
										class="text-xs text-blue-600 hover:text-blue-800 underline"
									>
										Custom ID
									</button>
								</div>
							</div>
							<select
								id="msCalendarSelect"
								bind:value={msCalendarId}
								class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
							>
								{#if !availableCalendars.some((c) => c.isDefault)}
									<option value="primary">Default Calendar (primary)</option>
								{/if}
								{#each availableCalendars as cal (cal.id)}
									{@const isDefaultStr = cal.isDefault ? " (Primary / Default)" : ""}
									{@const groupStr = cal.groupName && cal.groupName !== "Calendars" ? ` [${cal.groupName}]` : ""}
									{@const ownerStr = cal.owner?.name && cal.owner?.name !== cal.name ? ` (${cal.owner.name})` : ""}
									<option value={cal.id}>
										{cal.name}{isDefaultStr}{groupStr}{ownerStr}
									</option>
								{/each}
								{#if msCalendarId && msCalendarId !== "primary" && !availableCalendars.some((c) => c.id === msCalendarId)}
									<option value={msCalendarId}>
										Custom / Unlisted Calendar ({msCalendarId.length > 20 ? msCalendarId.slice(0, 8) + "..." + msCalendarId.slice(-6) : msCalendarId})
									</option>
								{/if}
							</select>
							{#if selectedCalendarObj}
								<div class="mt-2 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs space-y-1">
									<div class="flex items-center justify-between gap-2">
										<div class="font-semibold text-blue-950 flex items-center gap-1.5">
											<Calendar class="h-3.5 w-3.5 text-blue-600 shrink-0" />
											<span>{selectedCalendarObj.name}</span>
											{#if selectedCalendarObj.isDefault}
												<span class="text-[10px] bg-blue-200/80 text-blue-800 font-medium px-1.5 py-0.5 rounded">Primary</span>
											{/if}
										</div>
										{#if selectedCalendarObj.groupName}
											<span class="text-[11px] text-blue-800 bg-white border border-blue-200 px-1.5 py-0.5 rounded font-medium">
												{selectedCalendarObj.groupName}
											</span>
										{/if}
									</div>
									<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-blue-800/90 pt-0.5">
										{#if selectedCalendarObj.owner?.name || selectedCalendarObj.owner?.address}
											<div>
												<span class="text-blue-600 font-medium">Owner:</span>
												{selectedCalendarObj.owner.name || selectedCalendarObj.owner.address}
											</div>
										{/if}
										<div>
											<span class="text-blue-600 font-medium">Access:</span>
											{selectedCalendarObj.canEdit ? "Read / Write" : "Read-Only"}
										</div>
									</div>
								</div>
							{:else if msCalendarId && msCalendarId !== "primary"}
								<div class="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
									<div class="font-medium flex items-center justify-between gap-1.5 flex-wrap">
										<div class="flex items-center gap-1.5">
											<AlertCircle class="h-3.5 w-3.5 text-amber-600 shrink-0" />
											<span>Saved Custom Calendar Target</span>
										</div>
										{#if msCalendarId.includes('@')}
											<button
												type="button"
												onclick={() => {
													msMailboxType = "shared";
													msMailboxEmail = msCalendarId;
													msCalendarId = "primary";
													void calendarsQuery?.refresh();
												}}
												class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-200 hover:bg-amber-300 text-amber-950 rounded transition-colors"
											>
												<Building2 class="h-3 w-3" />
												<span>Switch to Detached Mailbox</span>
											</button>
										{/if}
									</div>
									<p class="text-[11px] text-amber-800">
										Targeting calendar ID: <span class="font-mono">{msCalendarId.length > 28 ? msCalendarId.slice(0, 12) + "..." + msCalendarId.slice(-8) : msCalendarId}</span>. You can keep this or select one of your named calendars above.
									</p>
								</div>
							{/if}
						{:else}
							<div class="flex items-center justify-between mb-1">
								<label for="msCalendarId" class="block text-sm font-medium text-gray-700">
									{m.ms_calendar_id ? m.ms_calendar_id() : "Calendar ID"}
								</label>
								<div class="flex items-center gap-2">
									<button
										type="button"
										title={m.ms_refresh_tenant ? m.ms_refresh_tenant() : "Refresh from Microsoft 365"}
										disabled={calendarsQuery?.loading}
										onclick={() => void calendarsQuery?.refresh()}
										class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
									>
										<RefreshCw class="h-3.5 w-3.5 {calendarsQuery?.loading ? 'animate-spin text-blue-600' : ''}" />
									</button>
									{#if availableCalendars.length > 0}
										<button
											type="button"
											onclick={() => (msCustomCalendar = false)}
											class="text-xs text-blue-600 hover:text-blue-800 underline"
										>
											Pick from list
										</button>
									{/if}
								</div>
							</div>
							<input
								id="msCalendarId"
								type="text"
								bind:value={msCalendarId}
								placeholder="primary"
								class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<p class="text-xs text-gray-500 mt-1">
								{#if calendarsQuery?.loading}
									Discovering available calendars...
								{:else}
									{m.ms_calendar_id_hint ? m.ms_calendar_id_hint() : "Use 'primary' for default calendar, or enter a calendar ID."}
								{/if}
							</p>
						{/if}
					</div>

					<!-- Coordination & Cross-Provider Options -->
					<div class="space-y-3 pt-2 border-t border-blue-200">
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={msIncludeRoomBookings}
								onchange={(e) => (msIncludeRoomBookings = e.currentTarget.checked)}
								class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
							/>
							<div>
								<span class="text-sm font-medium text-gray-900 block">
									{m.ms_include_room_bookings ? m.ms_include_room_bookings() : "Coordinate Room Bookings"}
								</span>
								<span class="text-xs text-gray-500 block">
									{m.ms_include_room_bookings_hint ? m.ms_include_room_bookings_hint() : "Automatically reserve matching rooms in Microsoft 365 when events allocate them."}
								</span>
							</div>
						</label>

						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={msIncludeContacts}
								onchange={(e) => (msIncludeContacts = e.currentTarget.checked)}
								class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
							/>
							<div>
								<span class="text-sm font-medium text-gray-900 block">
									{m.ms_include_contacts ? m.ms_include_contacts() : "Invite Event Contacts as Attendees"}
								</span>
								<span class="text-xs text-gray-500 block">
									{m.ms_include_contacts_hint ? m.ms_include_contacts_hint() : "Include linked contacts as meeting attendees on the calendar event."}
								</span>
							</div>
						</label>

						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={msAutoBookOnCalendar}
								onchange={(e) => (msAutoBookOnCalendar = e.currentTarget.checked)}
								class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
							/>
							<div>
								<span class="text-sm font-medium text-gray-900 block">
									Direct Room Calendar Booking
								</span>
								<span class="text-xs text-gray-500 block">
									Write reservation events directly into room mailboxes in addition to conference room location metadata.
								</span>
							</div>
						</label>
					</div>
				{/if}

				<!-- Contacts Specific Settings -->
				{#if selectedProvider === "microsoft-contacts"}
					<div>
						{#if !msCustomFolder && availableFolders.length > 0}
							<div class="flex items-center justify-between mb-1">
								<label for="msFolderSelect" class="block text-sm font-medium text-gray-700">
									{m.ms_folder_id ? m.ms_folder_id() : "Contacts Folder ID (Optional)"}
								</label>
								<div class="flex items-center gap-2">
									<button
										type="button"
										title={m.ms_refresh_tenant ? m.ms_refresh_tenant() : "Refresh from Microsoft 365"}
										disabled={foldersQuery?.loading}
										onclick={() => void foldersQuery?.refresh()}
										class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
									>
										<RefreshCw class="h-3.5 w-3.5 {foldersQuery?.loading ? 'animate-spin text-blue-600' : ''}" />
									</button>
									<button
										type="button"
										onclick={() => (msCustomFolder = true)}
										class="text-xs text-blue-600 hover:text-blue-800 underline"
									>
										Custom ID
									</button>
								</div>
							</div>
							<select
								id="msFolderSelect"
								bind:value={msFolderId}
								class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
							>
								<option value="">Default Contacts Folder</option>
								{#each availableFolders as folder (folder.id)}
									<option value={folder.id}>{folder.displayName}</option>
								{/each}
								{#if msFolderId && !availableFolders.some((f) => f.id === msFolderId)}
									<option value={msFolderId}>
										Custom / Unlisted Folder ({msFolderId.length > 20 ? msFolderId.slice(0, 8) + "..." + msFolderId.slice(-6) : msFolderId})
									</option>
								{/if}
							</select>
							{#if selectedFolderObj}
								<div class="mt-2 p-2 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs flex items-center gap-2 text-blue-900">
									<Folder class="h-3.5 w-3.5 text-blue-600 shrink-0" />
									<span class="font-medium">{selectedFolderObj.displayName}</span>
								</div>
							{:else if msFolderId}
								<div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
									Targeting folder ID: <span class="font-mono">{msFolderId.length > 28 ? msFolderId.slice(0, 12) + "..." + msFolderId.slice(-8) : msFolderId}</span>
								</div>
							{/if}
						{:else}
							<div class="flex items-center justify-between mb-1">
								<label for="msFolderId" class="block text-sm font-medium text-gray-700">
									{m.ms_folder_id ? m.ms_folder_id() : "Contacts Folder ID (Optional)"}
								</label>
								<div class="flex items-center gap-2">
									<button
										type="button"
										title={m.ms_refresh_tenant ? m.ms_refresh_tenant() : "Refresh from Microsoft 365"}
										disabled={foldersQuery?.loading}
										onclick={() => void foldersQuery?.refresh()}
										class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
									>
										<RefreshCw class="h-3.5 w-3.5 {foldersQuery?.loading ? 'animate-spin text-blue-600' : ''}" />
									</button>
									{#if availableFolders.length > 0}
										<button
											type="button"
											onclick={() => (msCustomFolder = false)}
											class="text-xs text-blue-600 hover:text-blue-800 underline"
										>
											Pick from list
										</button>
									{/if}
								</div>
							</div>
							<input
								id="msFolderId"
								type="text"
								bind:value={msFolderId}
								placeholder={m.ms_folder_id_placeholder ? m.ms_folder_id_placeholder() : "Leave empty for default Contacts folder"}
								class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<p class="text-xs text-gray-500 mt-1">
								{#if foldersQuery?.loading}
									Discovering contact folders...
								{:else}
									Specify a custom folder ID or leave blank to sync with the primary Outlook contacts folder.
								{/if}
							</p>
						{/if}
					</div>
				{/if}

				<!-- Resources Specific Settings -->
				{#if selectedProvider === "microsoft-resources"}
					<div>
						<span class="block text-sm font-medium text-gray-700 mb-2">
							{m.ms_resource_filter ? m.ms_resource_filter() : "Resource Types to Sync"}
						</span>
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<label
								class="flex items-center gap-2 p-2.5 rounded-lg border bg-white cursor-pointer {msResourceFilter === 'all' ? 'border-blue-600 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}"
							>
								<input
									type="radio"
									value="all"
									checked={msResourceFilter === "all"}
									onchange={() => (msResourceFilter = "all")}
									class="text-blue-600 focus:ring-blue-500"
								/>
								<span class="text-xs font-medium text-gray-800">
									{m.ms_resource_filter_all ? m.ms_resource_filter_all() : "All (Rooms & Equip)"}
								</span>
							</label>

							<label
								class="flex items-center gap-2 p-2.5 rounded-lg border bg-white cursor-pointer {msResourceFilter === 'room' ? 'border-blue-600 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}"
							>
								<input
									type="radio"
									value="room"
									checked={msResourceFilter === "room"}
									onchange={() => (msResourceFilter = "room")}
									class="text-blue-600 focus:ring-blue-500"
								/>
								<span class="text-xs font-medium text-gray-800">
									{m.ms_resource_filter_rooms ? m.ms_resource_filter_rooms() : "Meeting Rooms Only"}
								</span>
							</label>

							<label
								class="flex items-center gap-2 p-2.5 rounded-lg border bg-white cursor-pointer {msResourceFilter === 'equipment' ? 'border-blue-600 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}"
							>
								<input
									type="radio"
									value="equipment"
									checked={msResourceFilter === "equipment"}
									onchange={() => (msResourceFilter = "equipment")}
									class="text-blue-600 focus:ring-blue-500"
								/>
								<span class="text-xs font-medium text-gray-800">
									{m.ms_resource_filter_equipment ? m.ms_resource_filter_equipment() : "Equipment Only"}
								</span>
							</label>
						</div>
						<p class="text-xs text-gray-500 mt-2">
							Discovers tenant places and mailboxes. When an event is pushed, matching resources in this app are automatically synchronized and booked.
						</p>
					</div>
				{/if}

				<!-- Authentication Mode Selection -->
				<div class="pt-2 border-t border-blue-200">
					<label for="msAuthMode" class="block text-sm font-medium text-gray-700 mb-1">
						{m.ms_auth_mode ? m.ms_auth_mode() : "Authentication Mode"}
					</label>
					<select
						id="msAuthMode"
						bind:value={msAuthMode}
						class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="auto">
							{m.ms_auth_auto ? m.ms_auth_auto() : "Auto-detect (App Credentials for shared mailboxes, OAuth for personal)"}
						</option>
						<option value="app">
							{m.ms_auth_app ? m.ms_auth_app() : "Application Credentials (Entra ID Client Secret)"}
						</option>
						<option value="user">
							{m.ms_auth_user ? m.ms_auth_user() : "User Delegated OAuth (Signed-in User)"}
						</option>
					</select>
					<p class="text-xs text-gray-500 mt-1">
						Detached and shared mailboxes (like veranstaltung.bhs@ballev.onmicrosoft.com) require App Credentials with Calendars.ReadWrite application permissions.
					</p>
				</div>

				<!-- Target Connection & Diagnostic Testing -->
				<div class="pt-3 border-t border-blue-200">
					<div class="flex items-center justify-between gap-3">
						<div>
							<div class="text-sm font-semibold text-gray-900">
								Verify Target Access
							</div>
							<div class="text-xs text-gray-500">
								Test live connectivity, permissions, and mailbox resolution before saving.
							</div>
						</div>
						<button
							type="button"
							disabled={msTestingState.testing}
							onclick={handleTestMicrosoftTarget}
							class="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
						>
							{#if msTestingState.testing}
								<RefreshCw class="h-3.5 w-3.5 animate-spin" />
								{m.ms_testing_connection ? m.ms_testing_connection() : "Testing Connection..."}
							{:else}
								<ShieldCheck class="h-3.5 w-3.5" />
								{m.ms_test_connection ? m.ms_test_connection() : "Test Target Connection"}
							{/if}
						</button>
					</div>

					{#if msTestingState.result?.success}
						<div class="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 space-y-1">
							<div class="flex items-center gap-1.5 font-semibold text-green-900">
								<CheckCircle2 class="h-4 w-4 text-green-600 shrink-0" />
								<span>{msTestingState.result.message}</span>
							</div>
							{#if msTestingState.result.details}
								<div class="text-[11px] text-green-700 pl-5 space-y-0.5">
									<div>Mailbox: {msTestingState.result.details.mailboxEmail || "Current User"}</div>
									<div>Mode: {msTestingState.result.details.authMode}</div>
									{#if msTestingState.result.details.calendarName}
										<div>Calendar: {msTestingState.result.details.calendarName}</div>
									{/if}
									{#if msTestingState.result.details.roomsCount !== undefined}
										<div>Rooms discovered in tenant: {msTestingState.result.details.roomsCount}</div>
									{/if}
								</div>
							{/if}
						</div>
					{:else if msTestingState.error}
						<div class="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
							<div class="flex items-center gap-1.5 font-semibold text-red-900">
								<AlertCircle class="h-4 w-4 text-red-600 shrink-0" />
								<span>Target Connection Failed</span>
							</div>
							<p class="pl-5 text-red-700 whitespace-pre-line font-mono text-[11px]">
								{msTestingState.error}
							</p>
						</div>
					{/if}
				</div>

				<!-- Hidden Inputs Bound to Schema Fields -->
				{#if msAuthMode}
					<input {...fields.settings.authMode.as("hidden", msAuthMode)} />
				{/if}
				{#if msMailboxType}
					<input {...fields.settings.mailboxType.as("hidden", msMailboxType)} />
				{/if}
				{#if msMailboxType === "shared" && msMailboxEmail}
					<input {...fields.settings.mailboxEmail.as("hidden", msMailboxEmail)} />
				{/if}
				{#if selectedProvider === "microsoft-calendar" && msCalendarId}
					<input {...fields.settings.calendarId.as("hidden", msCalendarId)} />
				{/if}
				{#if selectedProvider === "microsoft-contacts" && msFolderId}
					<input {...fields.settings.folderId.as("hidden", msFolderId)} />
				{/if}
				{#if selectedProvider === "microsoft-resources" && msResourceFilter}
					<input {...fields.settings.resourceFilter.as("hidden", msResourceFilter)} />
				{/if}
				{#if selectedProvider === "microsoft-calendar"}
					<input {...fields.settings.includeRoomBookings.as("hidden", msIncludeRoomBookings ? "true" : "false")} />
					<input {...fields.settings.includeContacts.as("hidden", msIncludeContacts ? "true" : "false")} />
					<input {...fields.settings.autoBookOnCalendar.as("hidden", msAutoBookOnCalendar ? "true" : "false")} />
				{/if}
			</div>
		{/if}

		{#if selectedProvider === "berlin-de-main-calendar"}
			<div>
				<label for="company" class="block text-sm font-medium text-gray-700 mb-1">
					Company (Firma)
				</label>
				<input
					{...fields.settings.company.as("text")}
					id="company"
					bind:value={company}
					placeholder="Your organization name"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Company name to include in event submissions
				</p>
			</div>
		{/if}

		{#if selectedProvider === "berlin-de-mh-calendar"}
			<div>
				<label for="mhUsername" class="block text-sm font-medium text-gray-700 mb-1">
					Login Username
				</label>
				<input
					{...fields.credentials.username.as("text")}
					id="mhUsername"
					bind:value={mhUsername}
					placeholder="Username"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<div>
				<label for="mhPassword" class="block text-sm font-medium text-gray-700 mb-1">
					Login Password
				</label>
				<input
					{...fields.credentials.password.as("password")}
					id="mhPassword"
					bind:value={mhPassword}
					placeholder="Password"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		{/if}

		{#if selectedProvider === "nebenan-de"}
			<div>
				<label for="nebenanEmail" class="block text-sm font-medium text-gray-700 mb-1">
					Nebenan.de Email / Username
				</label>
				<input
					{...fields.credentials.email.as("text")}
					id="nebenanEmail"
					bind:value={nebenanEmail}
					placeholder="login@example.com"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<div>
				<label for="nebenanPassword" class="block text-sm font-medium text-gray-700 mb-1">
					Nebenan.de Password
				</label>
				<input
					{...fields.credentials.password.as("password")}
					id="nebenanPassword"
					bind:value={nebenanPassword}
					placeholder="Password"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<div>
				<label for="nebenanProfileId" class="block text-sm font-medium text-gray-700 mb-1">
					Business Profile ID (Gewerbeprofil-ID)
				</label>
				<input
					{...fields.settings.profileId.as("text")}
					id="nebenanProfileId"
					bind:value={nebenanProfileId}
					placeholder="e.g. cbe780d1-9642-49e5-8928-d1c163698658"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					The UUID of your business profile on Nebenan.de
				</p>
			</div>
		{/if}

		{#if selectedProvider === "wp-the-events-calendar"}
			<div>
				<label for="wpBaseUrl" class="block text-sm font-medium text-gray-700 mb-1">
					WordPress Site URL
				</label>
				<input
					{...fields.settings.baseUrl.as("url")}
					id="wpBaseUrl"
					bind:value={wpBaseUrl}
					placeholder="https://yoursite.com"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					The base URL of your WordPress site
				</p>
			</div>
			<div>
				<label for="wpUsername" class="block text-sm font-medium text-gray-700 mb-1">
					WordPress Username
				</label>
				<input
					{...fields.settings.username.as("text")}
					id="wpUsername"
					bind:value={wpUsername}
					placeholder="admin"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					WordPress user with editor or administrator role
				</p>
			</div>
			<div>
				<label for="wpAppPassword" class="block text-sm font-medium text-gray-700 mb-1">
					Application Password
				</label>
				<input
					{...fields.settings.applicationPassword.as("password")}
					id="wpAppPassword"
					bind:value={wpAppPassword}
					placeholder="abcd 1234 efgh 5678 ijkl"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Application password generated in WordPress user profile
				</p>
			</div>
		{/if}

		{#if selectedProvider === "email"}
			<TemplateSelector
				templates={emailTemplates}
				selectedTemplate={emailTemplate}
				onselect={(id) => (emailTemplate = id)}
				label="Select Email Template (Svelte Templating)"
				accent="blue"
			/>
			<input {...fields.settings.selectedTemplate.as("hidden", emailTemplate)} />

			<div>
				<label for="brevoApiKey" class="block text-sm font-medium text-gray-700 mb-1">
					Brevo API Key (Optional)
				</label>
				<input
					{...fields.settings.apiKey.as("password")}
					id="brevoApiKey"
					bind:value={brevoApiKey}
					placeholder="xkeysib-..."
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Your Brevo API Key (Leave empty to use global BREVO_API_KEY env or sandbox mode)
				</p>
			</div>

			<div>
				<label for="recipientEmail" class="block text-sm font-medium text-gray-700 mb-1">
					Default Recipient Email (Optional)
				</label>
				<input
					{...fields.settings.recipientEmail.as("email")}
					id="recipientEmail"
					bind:value={recipientEmail}
					placeholder="recipient@example.com"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					An optional single recipient email address for sync notifications
				</p>
			</div>

			<div class="border-t pt-4 space-y-3">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
					<div>
						<h3 class="text-md font-semibold text-gray-900 flex items-center gap-2">
							<Users size={18} class="text-blue-600" />
							Email Recipients & Contacts
						</h3>
						<p class="text-xs text-gray-500 mt-0.5">
							Recipients automatically include event participants matching your Event Selection and Participant filtering rules (e.g. internal staff by default). You can also associate additional contacts below or exclude specific individuals.
						</p>
					</div>
					<div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
						<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
							<Users class="w-3.5 h-3.5 text-blue-600" />
							{combinedRecipientContacts.length} Total Recipient{combinedRecipientContacts.length === 1 ? '' : 's'}
						</span>
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-2 text-xs">
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
						<ShieldCheck class="w-3 h-3 text-amber-600" />
						{eventDerivedContacts.filter((c) => c.isEmployee).length} Staff from Events
					</span>
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
						<Users class="w-3 h-3 text-blue-600" />
						{eventDerivedContacts.filter((c) => !c.isEmployee).length} Public/Event Attendees
					</span>
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
						<Plus class="w-3 h-3 text-emerald-600" />
						{recipientContactIds.length} Additional Associated
					</span>
					{#if excludedRecipientContactIds.length > 0}
						<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
							<X class="w-3 h-3 text-rose-600" />
							{excludedRecipientContactIds.length} Excluded
						</span>
					{/if}
				</div>

				<EntityManager
					{m}
					title="Recipient Contacts"
					icon={Users}
					mode="embedded"
					initialItems={combinedRecipientContacts}
					filters={getContactFilterGroups(m)}
					onchange={handleRecipientsChange}
					listItemsRemote={listContacts as any}
					deleteItemRemote={async (ids: string[]) => {
						return await handleDelete({
							ids,
							deleteFn: deleteContact,
							itemName: "contact",
						});
					}}
					createRemote={createContact}
					createSchema={createContactSchema}
					updateRemote={updateContact}
					updateSchema={updateContactSchema}
					readItemRemote={readContact}
					searchPredicate={matchContactSearch}
				>
					{#snippet renderItemLabel(contact: any)}
						<span class="font-medium text-gray-900">
							{contact.displayName ||
								`${contact.givenName || ""} ${contact.familyName || ""}`.trim() ||
								contact.company ||
								m.unnamed_contact()}
						</span>
					{/snippet}

					{#snippet renderItemBadge(contact: any)}
						{#if contact.isEventDerived}
							<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full {contact.isEmployee ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
								{#if contact.isEmployee}
									<ShieldCheck class="w-3 h-3 text-amber-600" />
									Event Staff
								{:else}
									<Users class="w-3 h-3 text-blue-600" />
									Event Contact ({contact.eventCount})
								{/if}
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
								<Plus class="w-3 h-3 text-emerald-600" />
								Additional Associated
							</span>
						{/if}
					{/snippet}

					{#snippet renderItemDetail(contact: any)}
						<div class="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
							{#if contact.emails?.[0]?.value}
								<span class="font-mono text-gray-600">{contact.emails.find((e: any) => e.primary)?.value || contact.emails[0].value}</span>
							{/if}
							{#if contact.isEventDerived && contact.eventTitles?.length}
								<span class="text-gray-400">•</span>
								<span class="truncate max-w-xs text-gray-500" title={contact.eventTitles.join(", ")}>
									{contact.eventTitles[0]}{contact.eventTitles.length > 1 ? ` +${contact.eventTitles.length - 1} more` : ''}
								</span>
							{/if}
						</div>
					{/snippet}

					{#snippet renderForm({
						remoteFunction: rfState,
						schema,
						initialData: formData,
						onSuccess,
						onCancel,
						id,
					}: any)}
						<ContactForm
							remoteFunction={rfState}
							schema={schema}
							initialData={formData}
							isUpdating={!!id}
							{onSuccess}
							{onCancel}
							{m}
						/>
					{/snippet}
				</EntityManager>
				<input {...fields.settings.includeEventContacts.as("hidden", syncParticipants ? "true" : "false")} />
				<input {...fields.settings.recipientContactIds.as("hidden", JSON.stringify(recipientContactIds))} />
				<input {...fields.settings.excludedRecipientContactIds.as("hidden", JSON.stringify(excludedRecipientContactIds))} />
			</div>
		{/if}

		{#if selectedProvider === "instagram"}
			<TemplateSelector
				templates={instagramTemplates}
				selectedTemplate={instagramTemplate}
				onselect={(id) => (instagramTemplate = id)}
				label="Select Template (Svelte Templating)"
				accent="pink"
			/>
			<input {...fields.settings.selectedTemplate.as("hidden", instagramTemplate)} />

			<div>
				<label for="instagramAccountId" class="block text-sm font-medium text-gray-700 mb-1">
					Instagram Account ID / Page ID
				</label>
				<input
					{...fields.settings.instagramAccountId.as("text")}
					id="instagramAccountId"
					bind:value={instagramAccountId}
					placeholder="17841400000000000"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Your Instagram Business / Creator Account ID (Leave empty for sandbox mode)
				</p>
			</div>

			<div>
				<label for="instagramAccessToken" class="block text-sm font-medium text-gray-700 mb-1">
					Instagram Graph API Access Token
				</label>
				<input
					{...fields.settings.accessToken.as("password")}
					id="instagramAccessToken"
					bind:value={instagramAccessToken}
					placeholder="EAAG..."
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
				<p class="text-xs text-gray-500 mt-1">
					User or Page access token with instagram_content_publish permissions
				</p>
			</div>

			<div>
				<label for="instagramHashtags" class="block text-sm font-medium text-gray-700 mb-1">
					Default Hashtags
				</label>
				<input
					{...fields.settings.defaultHashtags.as("text")}
					id="instagramHashtags"
					bind:value={instagramHashtags}
					placeholder="#events #community #berlin"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		{/if}

		<div>
			<label for="syncInterval" class="block text-sm font-medium text-gray-700 mb-1">
				Sync Interval (minutes)
			</label>
			<input
				{...fields.settings.syncIntervalMinutes.as("number")}
				id="syncInterval"
				bind:value={syncIntervalMinutes}
				min="15"
				max="1440"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
			<p class="text-xs text-gray-500 mt-1">
				How often to sync (15 minutes to 24 hours)
			</p>
		</div>

		<div class="border-t pt-4">
			<label class="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					checked={isDefault}
					onchange={(e) => (isDefault = e.currentTarget.checked)}
					class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
				/>
				<div class="flex-1">
					<span class="text-sm font-medium text-gray-900 block">
						{m.default_sync_target ? m.default_sync_target() : "Default Shared Sync Target"}
					</span>
					<span class="text-xs text-gray-500 block mt-0.5">
						{m.default_sync_target_description ? m.default_sync_target_description() : "Automatically select this sync target for newly created events and announcements across all users."}
					</span>
				</div>
			</label>
			<input {...fields.settings.isDefault.as("hidden", isDefault ? "true" : "false")} />
		</div>
	</div>
</div>

<!-- Sync Direction -->
<div class="bg-white shadow rounded-lg p-6 space-y-4">
	<h2 class="text-xl font-semibold mb-4">Sync Direction</h2>
	<div class="space-y-3">
		{#each directions as dir (dir.value)}
			{@const Icon = dir.icon}
			<label
				class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {direction === dir.value
					? 'border-blue-600 bg-blue-50'
					: 'border-gray-200 hover:border-gray-300'} {(selectedProvider ===
					'berlin-de-main-calendar' ||
					selectedProvider === 'berlin-de-mh-calendar' ||
					selectedProvider === 'wp-the-events-calendar' ||
					selectedProvider === 'seniorennetz-berlin' ||
					selectedProvider === 'email' ||
					selectedProvider === 'nebenan-de' ||
					selectedProvider === 'instagram' ||
					selectedProvider === 'bewegungsatlas-berlin' ||
					selectedProvider === 'eventbrite' ||
					selectedProvider === 'meetup') &&
				dir.value !== 'push'
					? 'opacity-50 cursor-not-allowed'
					: ''}"
			>
				<input
					{...fields.direction.as("radio", dir.value)}
					checked={direction === dir.value}
					onchange={() => {
						direction = dir.value;
						remoteFunction.validate();
					}}
					disabled={(selectedProvider === "berlin-de-main-calendar" ||
						selectedProvider === "berlin-de-mh-calendar" ||
						selectedProvider === "wp-the-events-calendar" ||
						selectedProvider === "seniorennetz-berlin" ||
						selectedProvider === "email" ||
						selectedProvider === "nebenan-de" ||
						selectedProvider === "instagram" ||
						selectedProvider === "bewegungsatlas-berlin" ||
						selectedProvider === "eventbrite" ||
						selectedProvider === "meetup") &&
						dir.value !== "push"}
					class="mt-1"
				/>
				<Icon
					class="h-5 w-5 mt-0.5 {direction === dir.value ? 'text-blue-600' : 'text-gray-600'}"
				/>
				<div class="flex-1">
					<div class="font-medium">{dir.label}</div>
					<div class="text-sm text-gray-600">
						{dir.description}
					</div>
					{#if (selectedProvider === "berlin-de-main-calendar" || selectedProvider === "berlin-de-mh-calendar" || selectedProvider === "wp-the-events-calendar" || selectedProvider === "seniorennetz-berlin" || selectedProvider === "email" || selectedProvider === "nebenan-de" || selectedProvider === "instagram" || selectedProvider === "bewegungsatlas-berlin" || selectedProvider === "eventbrite" || selectedProvider === "meetup") && dir.value !== "push"}
						<div class="text-xs text-orange-600 mt-1">
							Not supported for {selectedProvider === "berlin-de-main-calendar"
								? "Berlin.de"
								: selectedProvider === "berlin-de-mh-calendar"
									? "Berlin.de (MH)"
									: selectedProvider === "wp-the-events-calendar"
										? "WordPress Events Calendar"
										: selectedProvider === "seniorennetz-berlin"
											? "Seniorennetz Berlin"
											: selectedProvider === "nebenan-de"
											? "Nebenan.de"
											: selectedProvider === "instagram"
											? "Instagram"
											: selectedProvider === "bewegungsatlas-berlin"
											? "Bewegungsatlas Berlin"
											: selectedProvider === "eventbrite"
											? "Eventbrite"
											: selectedProvider === "meetup"
											? "Meetup"
											: "Email (Brevo)"}
						</div>
					{/if}
				</div>
			</label>
		{/each}
	</div>
</div>

{#if isEventProvider}
	<!-- Event Selection & Filtering Rules (Kiosk-style fine-grained control) -->
	<div class="bg-white shadow rounded-lg p-6 space-y-6">
		<div class="flex items-start justify-between border-b pb-4">
			<div>
				<h2 class="text-xl font-semibold flex items-center gap-2 text-gray-900">
					<SlidersHorizontal class="w-5 h-5 text-blue-600" />
					{m.sync_event_selection_title()}
				</h2>
				<p class="text-sm text-gray-600 mt-1">
					{m.sync_event_selection_description()}
				</p>
			</div>
		</div>

		<!-- Recurring Series Edge-Case Handling -->
		<div class="bg-blue-50/60 border border-blue-200 rounded-lg p-4 space-y-3">
			<div class="flex items-center justify-between">
				<label class="flex items-center gap-2 cursor-pointer font-medium text-sm text-blue-950">
					<input
						type="checkbox"
						checked={excludeSeries}
						onchange={(e) => {
							excludeSeries = e.currentTarget.checked;
							syncSeriesMode = excludeSeries ? "exclude" : "all";
						}}
						class="rounded border-blue-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
					/>
					<span>{m.exclude_series_events()}</span>
				</label>
				<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold {excludeSeries ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}">
					{excludeSeries ? m.sync_series_exclude() : m.sync_series_all()}
				</span>
			</div>
			<p class="text-xs text-blue-800 leading-relaxed">
				{m.sync_series_hint()}
			</p>

			<div class="pt-2 border-t border-blue-200/60">
				<span class="block text-xs font-semibold uppercase tracking-wider text-blue-900 mb-1">
					{m.sync_series_mode()}
				</span>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
					<button
						type="button"
						class="px-3 py-2 text-xs font-medium rounded-md border text-left transition-colors {syncSeriesMode === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}"
						onclick={() => {
							syncSeriesMode = 'all';
							excludeSeries = false;
						}}
					>
						<span class="font-bold block">{m.sync_series_all()}</span>
						<span class="text-[11px] {syncSeriesMode === 'all' ? 'text-blue-100' : 'text-gray-500'}">Sync series with recurrence or occurrences</span>
					</button>

					<button
						type="button"
						class="px-3 py-2 text-xs font-medium rounded-md border text-left transition-colors {syncSeriesMode === 'exclude' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}"
						onclick={() => {
							syncSeriesMode = 'exclude';
							excludeSeries = true;
						}}
					>
						<span class="font-bold block">{m.sync_series_exclude()}</span>
						<span class="text-[11px] {syncSeriesMode === 'exclude' ? 'text-amber-100' : 'text-gray-500'}">Skip series masters & virtual instances</span>
					</button>

					<button
						type="button"
						class="px-3 py-2 text-xs font-medium rounded-md border text-left transition-colors {syncSeriesMode === 'master_only' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}"
						onclick={() => {
							syncSeriesMode = 'master_only';
							excludeSeries = false;
						}}
					>
						<span class="font-bold block">{m.sync_series_master_only()}</span>
						<span class="text-[11px] {syncSeriesMode === 'master_only' ? 'text-blue-100' : 'text-gray-500'}">Sync only master, suppress instances</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Status & Visibility Toggles -->
		<div class="space-y-3">
			<span class="block text-sm font-medium text-gray-700">Status & Visibility Filters</span>
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
				<label class="flex items-center gap-2 p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
					<input
						type="checkbox"
						checked={excludeNonPublic}
						onchange={(e) => (excludeNonPublic = e.currentTarget.checked)}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span>{m.exclude_non_public_items()}</span>
				</label>

				<label class="flex items-center gap-2 p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
					<input
						type="checkbox"
						checked={excludeTentative}
						onchange={(e) => (excludeTentative = e.currentTarget.checked)}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span>{m.exclude_tentative_items()}</span>
				</label>

				<label class="flex items-center gap-2 p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
					<input
						type="checkbox"
						checked={excludeCancelled}
						onchange={(e) => (excludeCancelled = e.currentTarget.checked)}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span>{m.exclude_cancelled_items()}</span>
				</label>

				<label class="flex items-center gap-2 p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
					<input
						type="checkbox"
						checked={excludePastEvents}
						onchange={(e) => (excludePastEvents = e.currentTarget.checked)}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span>{m.hide_past_events()}</span>
				</label>
			</div>
		</div>

		<!-- Time Horizon & Date Range -->
		<div class="space-y-4 border-t pt-4">
			<div class="flex items-center justify-between">
				<span class="block text-sm font-medium text-gray-700">{m.time_range_mode()}</span>
				{#if calendarPreview}
					<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
						<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
						{formatDateRangeDisplay(calendarPreview.start, calendarPreview.end)}
					</span>
				{/if}
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<select
						bind:value={rangeMode}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
					>
						<option value="all">All Events (no date constraint)</option>
						<optgroup label={m.rolling_calendar()}>
							<option value="next_week">{m.next_week()} ({m.auto_updating_badge()})</option>
							<option value="next_month">{m.next_month()} ({m.auto_updating_badge()})</option>
							<option value="this_week">{m.this_week()} ({m.auto_updating_badge()})</option>
							<option value="this_month">{m.this_month()} ({m.auto_updating_badge()})</option>
						</optgroup>
						<optgroup label={m.rolling_window()}>
							<option value="rolling">{m.rolling_days()}</option>
						</optgroup>
						<optgroup label={m.fixed_date_range()}>
							<option value="fixed">{m.fixed_date_range()}</option>
						</optgroup>
					</select>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors {rangeMode === 'next_week' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}"
						onclick={() => applyNextWeek()}
					>
						{m.next_week()}
					</button>
					<button
						type="button"
						class="text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors {rangeMode === 'next_month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}"
						onclick={() => applyNextMonth()}
					>
						{m.next_month()}
					</button>
					<button
						type="button"
						class="text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors {rangeMode === 'rolling' && lookAheadDays === 30 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'}"
						onclick={() => applyDaysOffset(30)}
					>
						{m.days_30()}
					</button>
					<button
						type="button"
						class="text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors {rangeMode === 'rolling' && lookAheadDays === 90 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'}"
						onclick={() => applyDaysOffset(90)}
					>
						{m.days_90()}
					</button>
				</div>
			</div>

			{#if isRollingDaysMode}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
					<div>
						<label for="lookAheadDaysInput" class="block text-sm font-medium text-gray-700 mb-1">
							{m.look_ahead_days()}
						</label>
						<input
							type="number"
							id="lookAheadDaysInput"
							bind:value={lookAheadDays}
							min="1"
							max="730"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
						/>
					</div>
					<div>
						<label for="lookPastDaysInput" class="block text-sm font-medium text-gray-700 mb-1">
							{m.look_past_days()}
						</label>
						<input
							type="number"
							id="lookPastDaysInput"
							bind:value={lookPastDays}
							min="0"
							max="365"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
						/>
					</div>
				</div>
			{:else if isFixedMode}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
					<div>
						<label for="startDateInput" class="block text-sm font-medium text-gray-700 mb-1">
							{m.start_date()}
						</label>
						<input
							type="datetime-local"
							id="startDateInput"
							bind:value={startDate}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
						/>
					</div>
					<div>
						<label for="endDateInput" class="block text-sm font-medium text-gray-700 mb-1">
							{m.end_date()}
						</label>
						<input
							type="datetime-local"
							id="endDateInput"
							bind:value={endDate}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
						/>
					</div>
				</div>
			{/if}
		</div>

		<!-- Fine-grained Tags & Locations Selection (KioskMultiSelect) -->
		<details class="space-y-4 border-t pt-4">
			<summary class="text-base font-semibold text-gray-900 cursor-pointer select-none flex items-center justify-between">
				<span>{m.fine_grained_display_selection()} (Tags, Locations & Events)</span>
				<span class="text-xs text-gray-500 font-normal">Click to expand</span>
			</summary>

			<div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
				<!-- Tags -->
				<div class="space-y-2">
					<KioskMultiSelect title={m.included_tags()} items={tags} bind:selectedIds={includedTags} />
				</div>
				<div class="space-y-2">
					<KioskMultiSelect title={m.excluded_tags()} items={tags} bind:selectedIds={excludedTags} />
				</div>

				<!-- Locations -->
				<div class="space-y-2">
					<KioskMultiSelect title={m.included_locations ? m.included_locations() : "Included Locations"} items={locations} bind:selectedIds={includedLocationIds} />
				</div>
				<div class="space-y-2">
					<KioskMultiSelect title={m.excluded_locations ? m.excluded_locations() : "Excluded Locations"} items={locations} bind:selectedIds={excludedLocationIds} />
				</div>

				<!-- Events Overrides -->
				<div class="space-y-2">
					<KioskMultiSelect title={m.included_events()} items={events} labelKey="summary" bind:selectedIds={includedEventIds} />
				</div>
				<div class="space-y-2">
					<KioskMultiSelect title={m.excluded_events()} items={events} labelKey="summary" bind:selectedIds={excludedEventIds} />
				</div>
			</div>
		</details>

		<!-- Hidden serialized inputs for Remote Form submission -->
		<input {...fields.settings.excludeSeries.as("text", String(excludeSeries))} class="hidden" />
		<input {...fields.settings.syncSeriesMode.as("text", syncSeriesMode)} class="hidden" />
		<input {...fields.settings.excludeNonPublic.as("text", String(excludeNonPublic))} class="hidden" />
		<input {...fields.settings.excludeTentative.as("text", String(excludeTentative))} class="hidden" />
		<input {...fields.settings.excludeCancelled.as("text", String(excludeCancelled))} class="hidden" />
		<input {...fields.settings.excludePastEvents.as("text", String(excludePastEvents))} class="hidden" />

		<input {...fields.settings.rangeMode.as("text", rangeMode)} class="hidden" />
		<input {...fields.settings.lookAheadDays.as("number", lookAheadDays)} class="hidden" />
		<input {...fields.settings.lookPastDays.as("number", lookPastDays)} class="hidden" />
		<input {...fields.settings.startDate.as("text", startDate)} class="hidden" />
		<input {...fields.settings.endDate.as("text", endDate)} class="hidden" />

		<input {...fields.settings.includedTags.as("text", JSON.stringify(includedTags))} class="hidden" />
		<input {...fields.settings.excludedTags.as("text", JSON.stringify(excludedTags))} class="hidden" />
		<input {...fields.settings.includedLocationIds.as("text", JSON.stringify(includedLocationIds))} class="hidden" />
		<input {...fields.settings.excludedLocationIds.as("text", JSON.stringify(excludedLocationIds))} class="hidden" />
		<input {...fields.settings.includedEventIds.as("text", JSON.stringify(includedEventIds))} class="hidden" />
		<input {...fields.settings.excludedEventIds.as("text", JSON.stringify(excludedEventIds))} class="hidden" />
	</div>
{/if}

{#if isParticipantProvider}
	<!-- Event Participants & Attendee Sync Rules -->
	<div class="bg-white shadow rounded-lg p-6 space-y-6">
		<div class="flex items-start justify-between border-b pb-4">
			<div>
				<h2 class="text-xl font-semibold flex items-center gap-2 text-gray-900">
					<Users class="w-5 h-5 text-indigo-600" />
					{m.sync_participants_title()}
				</h2>
				<p class="text-sm text-gray-600 mt-1">
					{m.sync_participants_description()}
				</p>
			</div>
			<div>
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold {!syncParticipants ? 'bg-gray-100 text-gray-600 border border-gray-300' : onlyEmployeeContactsDerived ? 'bg-amber-100 text-amber-800 border border-amber-300' : (includePublicContacts && !includeNonPublicContacts) ? 'bg-blue-100 text-blue-800 border border-blue-300' : includeNonPublicContacts ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600 border border-gray-300'}">
					{#if !syncParticipants}
						Disabled
					{:else if onlyEmployeeContactsDerived}
						<ShieldCheck class="w-3.5 h-3.5 text-amber-600" />
						Internal Staff Only
					{:else if includePublicContacts && !includeNonPublicContacts}
						<Globe class="w-3.5 h-3.5 text-blue-600" />
						Staff & Public Contacts
					{:else if includeNonPublicContacts}
						<Users class="w-3.5 h-3.5 text-emerald-600" />
						All Participants (Inc. Private)
					{:else}
						<AlertCircle class="w-3.5 h-3.5 text-gray-500" />
						No Scope Selected
					{/if}
				</span>
			</div>
		</div>

		<!-- Master Participants Toggle & Privacy Restriction -->
		<div class="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-5 space-y-4">
			<label class="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					checked={syncParticipants}
					onchange={(e) => {
						syncParticipants = e.currentTarget.checked;
					}}
					class="mt-1 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
				/>
				<div>
					<span class="font-semibold text-sm text-indigo-950 block">{m.sync_participants_toggle()}</span>
					<span class="text-xs text-indigo-800">
						Synchronize linked event contacts as calendar attendees (Microsoft / Google Calendar) or into your external contacts directory (Microsoft Contacts).
					</span>
				</div>
			</label>

			{#if syncParticipants}
				<div class="pt-3 border-t border-indigo-200/60 pl-7 space-y-3">
					<div>
						<div class="flex items-center gap-1.5 font-semibold text-xs text-indigo-950 mb-1">
							<ShieldCheck class="w-4 h-4 text-indigo-600" />
							<span>{m.sync_participants_privacy_title ? m.sync_participants_privacy_title() : "Contact Privacy & Visibility Scope"}</span>
						</div>
						<p class="text-xs text-indigo-800/80 mb-3">
							{m.sync_participants_privacy_desc ? m.sync_participants_privacy_desc() : "Choose which categories of linked contacts are eligible for external calendar and directory synchronization. Non-public contacts are excluded by default to protect personal data."}
						</p>

						<div class="space-y-2.5">
							<!-- Option 1: Internal Staff / Employees -->
							<label class="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border transition-colors {includeEmployeeContacts ? 'bg-amber-50/80 border-amber-300/80 shadow-xs' : 'bg-white/80 border-indigo-100 hover:bg-white'}">
								<input
									type="checkbox"
									checked={includeEmployeeContacts}
									onchange={(e) => {
										includeEmployeeContacts = e.currentTarget.checked;
									}}
									class="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
								/>
								<div>
									<div class="flex items-center gap-1.5 font-medium text-xs text-indigo-950">
										<ShieldCheck class="w-3.5 h-3.5 text-amber-600" />
										<span>{m.sync_participants_employees ? m.sync_participants_employees() : "Sync internal staff (Employees)"}</span>
										<span class="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">Default</span>
									</div>
									<p class="text-[11px] text-indigo-900/80 mt-0.5">
										{m.sync_participants_employees_desc ? m.sync_participants_employees_desc() : "Contacts tagged as 'Employee' (internal team, hosts, and organizers)."}
									</p>
								</div>
							</label>

							<!-- Option 2: Public Contacts -->
							<label class="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border transition-colors {includePublicContacts ? 'bg-blue-50/80 border-blue-300/80 shadow-xs' : 'bg-white/80 border-indigo-100 hover:bg-white'}">
								<input
									type="checkbox"
									checked={includePublicContacts}
									onchange={(e) => {
										includePublicContacts = e.currentTarget.checked;
									}}
									class="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
								/>
								<div>
									<div class="flex items-center gap-1.5 font-medium text-xs text-indigo-950">
										<Globe class="w-3.5 h-3.5 text-blue-600" />
										<span>{m.sync_participants_public ? m.sync_participants_public() : "Sync public contacts"}</span>
									</div>
									<p class="text-[11px] text-indigo-900/80 mt-0.5">
										{m.sync_participants_public_desc ? m.sync_participants_public_desc() : "External contacts explicitly marked as public in the directory (e.g. public speakers, performers, partners)."}
									</p>
								</div>
							</label>

							<!-- Option 3: Non-Public / Private Contacts -->
							<label class="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border transition-colors {includeNonPublicContacts ? 'bg-purple-50/80 border-purple-300/80 shadow-xs' : 'bg-white/80 border-indigo-100 hover:bg-white'}">
								<input
									type="checkbox"
									checked={includeNonPublicContacts}
									onchange={(e) => {
										includeNonPublicContacts = e.currentTarget.checked;
									}}
									class="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
								/>
								<div>
									<div class="flex items-center gap-1.5 font-medium text-xs text-indigo-950">
										<Lock class="w-3.5 h-3.5 text-purple-600" />
										<span>{m.sync_participants_non_public ? m.sync_participants_non_public() : "Sync non-public / private contacts"}</span>
									</div>
									<p class="text-[11px] text-indigo-900/80 mt-0.5">
										{m.sync_participants_non_public_desc ? m.sync_participants_non_public_desc() : "Private external contacts and unlisted attendees. Disabled by default to protect personal data."}
									</p>
								</div>
							</label>
						</div>

						{#if !includeEmployeeContacts && !includePublicContacts && !includeNonPublicContacts}
							<div class="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-800 flex items-center gap-1.5">
								<AlertCircle class="w-3.5 h-3.5 text-amber-600 shrink-0" />
								<span>{m.sync_participants_none_selected ? m.sync_participants_none_selected() : "No contact categories selected. No linked participants will be synchronized."}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		{#if syncParticipants}
			<!-- Filter by Roles Section -->
			<div class="border border-gray-200 rounded-xl p-5 space-y-4 bg-white shadow-sm">
				<div class="flex items-center justify-between border-b pb-3">
					<div>
						<h3 class="text-sm font-bold text-gray-900 flex items-center gap-2">
							<Users class="w-4 h-4 text-gray-600" />
							{m.sync_contact_roles_title()}
						</h3>
						<p class="text-xs text-gray-500 mt-0.5">
							{m.sync_contact_roles_desc()}
						</p>
					</div>
					<div class="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all {participantRoleFilterMode === 'all' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
							onclick={() => { participantRoleFilterMode = 'all'; }}
						>
							All Roles
						</button>
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all {participantRoleFilterMode === 'include' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
							onclick={() => { participantRoleFilterMode = 'include'; }}
						>
							Include Only
						</button>
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all {participantRoleFilterMode === 'exclude' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
							onclick={() => { participantRoleFilterMode = 'exclude'; }}
						>
							Exclude
						</button>
					</div>
				</div>

				{#if participantRoleFilterMode === 'all'}
					<div class="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
						Contacts with <strong>any</strong> assigned event role (or no role assigned) will be included in the synchronization.
					</div>
				{:else if participantRoleFilterMode === 'include'}
					<div class="space-y-3">
						<p class="text-xs text-gray-600">
							Only participants who have <strong>at least one</strong> of the selected roles below will be synchronized:
						</p>
						<div class="flex flex-wrap gap-2">
							{#each eventRoles as role}
								{@const isSelected = includedContactRoles.includes(role.id) || includedContactRoles.includes(role.name)}
								<button
									type="button"
									onclick={() => {
										if (isSelected) {
											includedContactRoles = includedContactRoles.filter(r => r !== role.id && r !== role.name);
										} else {
											includedContactRoles = [...includedContactRoles, role.id];
										}
									}}
									class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer {isSelected ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}"
								>
									<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {role.color || '#3b82f6'};"></span>
									<span>{role.name}</span>
									{#if isSelected}
										<Check class="w-3.5 h-3.5 text-blue-600" />
									{/if}
								</button>
							{/each}
							{#if eventRoles.length === 0}
								<span class="text-xs text-gray-400 italic">No event roles found in database.</span>
							{/if}
						</div>
					</div>
				{:else if participantRoleFilterMode === 'exclude'}
					<div class="space-y-3">
						<p class="text-xs text-gray-600">
							Participants with any of the selected roles below will be <strong>omitted</strong> from synchronization:
						</p>
						<div class="flex flex-wrap gap-2">
							{#each eventRoles as role}
								{@const isSelected = excludedContactRoles.includes(role.id) || excludedContactRoles.includes(role.name)}
								<button
									type="button"
									onclick={() => {
										if (isSelected) {
											excludedContactRoles = excludedContactRoles.filter(r => r !== role.id && r !== role.name);
										} else {
											excludedContactRoles = [...excludedContactRoles, role.id];
										}
									}}
									class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer {isSelected ? 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/20' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}"
								>
									<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {role.color || '#ef4444'};"></span>
									<span>{role.name}</span>
									{#if isSelected}
										<X class="w-3.5 h-3.5 text-red-600" />
									{/if}
								</button>
							{/each}
							{#if eventRoles.length === 0}
								<span class="text-xs text-gray-400 italic">No event roles found in database.</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Filter by Contact Tags Section -->
			<div class="border border-gray-200 rounded-xl p-5 space-y-4 bg-white shadow-sm">
				<div class="flex items-center justify-between border-b pb-3">
					<div>
						<h3 class="text-sm font-bold text-gray-900 flex items-center gap-2">
							<Filter class="w-4 h-4 text-gray-600" />
							{m.sync_contact_tags_title()}
						</h3>
						<p class="text-xs text-gray-500 mt-0.5">
							{m.sync_contact_tags_desc()}
						</p>
					</div>
					<div class="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all {participantTagFilterMode === 'all' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
							onclick={() => { participantTagFilterMode = 'all'; }}
						>
							All Tags
						</button>
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all {participantTagFilterMode === 'include' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
							onclick={() => { participantTagFilterMode = 'include'; }}
						>
							Include Only
						</button>
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all {participantTagFilterMode === 'exclude' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
							onclick={() => { participantTagFilterMode = 'exclude'; }}
						>
							Exclude
						</button>
					</div>
				</div>

				{#if participantTagFilterMode === 'all'}
					<div class="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
						Contacts with <strong>any</strong> profile tags (or no tags) will be eligible for synchronization.
					</div>
				{:else if participantTagFilterMode === 'include'}
					<div class="space-y-2">
						<p class="text-xs text-gray-600">
							Only participants who have <strong>at least one</strong> of the selected tags on their contact record will be synced:
						</p>
						<KioskMultiSelect title={m.included_contact_tags()} items={tags} bind:selectedIds={includedContactTags} />
					</div>
				{:else if participantTagFilterMode === 'exclude'}
					<div class="space-y-2">
						<p class="text-xs text-gray-600">
							Participants who have any of the selected tags on their contact record will be <strong>omitted</strong>:
						</p>
						<KioskMultiSelect title={m.excluded_contact_tags()} items={tags} bind:selectedIds={excludedContactTags} />
					</div>
				{/if}
			</div>
		{/if}

		<!-- Hidden serialized inputs for Participant settings -->
		<input {...fields.settings.syncParticipants.as("text", String(syncParticipants))} class="hidden" />
		<input {...fields.settings.onlyEmployeeContacts.as("text", String(onlyEmployeeContactsDerived))} class="hidden" />
		<input {...fields.settings.includeEmployeeContacts.as("text", String(includeEmployeeContacts))} class="hidden" />
		<input {...fields.settings.includePublicContacts.as("text", String(includePublicContacts))} class="hidden" />
		<input {...fields.settings.includeNonPublicContacts.as("text", String(includeNonPublicContacts))} class="hidden" />
		<input {...fields.settings.participantRoleFilterMode.as("text", participantRoleFilterMode)} class="hidden" />
		<input {...fields.settings.includedContactRoles.as("text", JSON.stringify(includedContactRoles))} class="hidden" />
		<input {...fields.settings.excludedContactRoles.as("text", JSON.stringify(excludedContactRoles))} class="hidden" />
		<input {...fields.settings.participantTagFilterMode.as("text", participantTagFilterMode)} class="hidden" />
		<input {...fields.settings.includedContactTags.as("text", JSON.stringify(includedContactTags))} class="hidden" />
		<input {...fields.settings.excludedContactTags.as("text", JSON.stringify(excludedContactTags))} class="hidden" />
	</div>
{/if}
{/if}
