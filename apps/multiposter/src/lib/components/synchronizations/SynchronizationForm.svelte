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
		Camera
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import * as m from "$lib/paraglide/messages";
	import { translateIssue, EntityManager, handleDelete } from "@ac/ui";
	import TemplateSelector from "./TemplateSelector.svelte";
	import ContactForm from "../contacts/ContactForm.svelte";
	import { listContacts } from "../../../routes/contacts/list.remote";
	import { createContact } from "../../../routes/contacts/new/create.remote";
	import { updateContact } from "../../../routes/contacts/[id]/update.remote";
	import { createContactSchema, updateContactSchema } from "@ac/validations";
	import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";

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
			description: "Sync with Outlook/Microsoft 365",
			icon: Calendar,
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

	let initialContacts = $state<any[]>([]);

	onMount(() => {
		if (recipientContactIds.length > 0) {
			listContacts({ limit: 100 }).then((res) => {
				const all = res?.data || [];
				initialContacts = all.filter((c: any) => recipientContactIds.includes(c.id));
			}).catch(() => {});
		}
	});

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

		{#if selectedProvider === "google-calendar" || selectedProvider === "microsoft-calendar"}
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

			<div class="border-t pt-4">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={includeEventContacts}
						onchange={(e) => (includeEventContacts = e.currentTarget.checked)}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
					/>
					<span class="text-sm font-medium text-gray-700">
						Also send to contacts attached to the synchronized event/announcement
					</span>
				</label>
				<input {...fields.settings.includeEventContacts.as("hidden", includeEventContacts ? "true" : "false")} />
			</div>

			<div class="border-t pt-4">
				<h3 class="text-md font-semibold text-gray-900 mb-2 flex items-center gap-2">
					<Users size={18} class="text-blue-600" />
					Configured Recipient Contacts
				</h3>
				<EntityManager
					{m}
					title="Recipient Contacts"
					icon={Users}
					mode="embedded"
					type="sync_config"
					entityId={initialData?.id || ""}
					initialItems={initialContacts}
					onchange={(ids: string[]) => {
						recipientContactIds = ids;
					}}
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
					getFormData={(c: any) => ({
						contact: c,
						emails: c.emails,
						phones: c.phones,
						addresses: c.addresses,
						relations: c.relations,
						tags: c.tags,
					})}
					searchPredicate={(c: any, q: string) => {
						const name = (
							c.displayName ||
							`${c.givenName || ""} ${c.familyName || ""}`
						).toLowerCase();
						return name.includes(q.toLowerCase());
					}}
				>
					{#snippet renderItemLabel(contact: any)}
						{contact.displayName ||
							`${contact.givenName || ""} ${contact.familyName || ""}`}
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
				<input {...fields.settings.recipientContactIds.as("hidden", JSON.stringify(recipientContactIds))} />
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
{/if}
