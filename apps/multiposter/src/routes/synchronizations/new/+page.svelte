<script lang="ts">
	import { create } from "./create.remote";
	import { goto } from "$app/navigation";
	import { createSynchronizationSchema } from "$lib/validations/synchronizations";
	import {
		Calendar,
		ArrowLeft,
		ArrowRight,
		ArrowLeftRight,
		Mail,
		Users,
		MapPin,
		Search,
	} from "@lucide/svelte";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { toast } from "svelte-sonner";
 
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
			available: false,
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
			description: "Send email campaigns via Brevo",
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

	let selectedProvider = $state<
		| "google-calendar"
		| "microsoft-calendar"
		| "berlin-de-main-calendar"
		| "berlin-de-mh-calendar"
		| "wp-the-events-calendar"
		| "eventbrite"
		| "meetup"
		| "seniorennetz-berlin"
		| "bewegungsatlas-berlin"
		| "email"
		| "nebenan-de"
		| null
	>(null);
	let searchTerm = $state("");
	let filteredProviders = $derived(
		providers.filter((p) =>
			p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
			p.description.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);
	let providerId = $state("");
	let direction = $state<"pull" | "push" | "bidirectional">("bidirectional");
	let calendarId = $state("primary");
	let syncIntervalMinutes = $state(60);
	let company = $state("");
	let fieldMappings = $state<Record<string, string>>({});
	let wpBaseUrl = $state("");
	let wpUsername = $state("");
	let wpAppPassword = $state("");
	let mhUsername = $state("");
	let mhPassword = $state("");

	// Set default direction based on provider
	$effect(() => {
		if (
			selectedProvider === "berlin-de-main-calendar" ||
			selectedProvider === "berlin-de-mh-calendar" ||
			selectedProvider === "wp-the-events-calendar" ||
			selectedProvider === "eventbrite" ||
			selectedProvider === "meetup" ||
			selectedProvider === "seniorennetz-berlin" ||
			selectedProvider === "bewegungsatlas-berlin" ||
			selectedProvider === "email" ||
			selectedProvider === "nebenan-de"
		) {
			direction = "push";
		}
	});





	import * as m from "$lib/paraglide/messages";



	let prevIssuesLength = $state(0);
	const fields = create.fields as any;
	$effect(() => {
		const issues = (create as any).allIssues?.() ?? [];
		if (issues.length > 0 && prevIssuesLength === 0) {
			toast.error(m.please_fix_validation());
		}
		prevIssuesLength = issues.length;
	});
</script>

<svelte:head>
	<title>Add Calendar Sync</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<Breadcrumb feature="synchronizations" current="Add Calendar Sync" />

	<div class="mb-8">
		<h1 class="text-3xl font-bold">Add Calendar Sync</h1>
		<p class="text-gray-600 mt-2">
			Connect a calendar service to synchronize your events
		</p>
	</div>

	<form
		class="space-y-4"
		{...create
			.preflight(createSynchronizationSchema)
			.enhance(async ({ submit }) => {
				const result: any = await submit();
				if (result?.error) {
					toast.error(
						result.error.message ||
							"Failed to create synchronization",
					);
					return;
				}
				toast.success("Calendar synchronization created successfully!");
				await goto("/synchronizations");
			})}
		onkeydown={(event) => {
			if (event.key === "Enter") {
				const target = event.target as HTMLElement;
				if (
					target.tagName !== "TEXTAREA" &&
					target.getAttribute("type") !== "submit"
				) {
					event.preventDefault();
				}
			}
		}}
	>
		<!-- Hidden Inputs required for form submission -->
		{#if selectedProvider}
			<input
				{...fields.providerType.as("hidden", selectedProvider)}
			/>
		{/if}
		<!-- providerId is handled by the text input below -->

		<!-- Settings as JSON string to avoid dot-notation parsing issues -->

		<!-- Provider Selection -->
		<div class="bg-white shadow rounded-lg p-6 space-y-4">
			<div
				class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4"
			>
				<h2 class="text-xl font-semibold">Select Calendar Provider</h2>
				<div class="relative w-full md:w-64">
					<Search
						class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
					/>
					<input
						type="text"
						bind:value={searchTerm}
						placeholder="Filter providers..."
						class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>
			</div>

			<div class="grid gap-3 grid-cols-2 lg:grid-cols-3">
				{#each filteredProviders as provider}
					{@const Icon = provider.icon}
					<button
						type="button"
						disabled={!provider.available}
						class="text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 {selectedProvider ===
						provider.id
							? 'border-blue-600 bg-blue-50'
							: provider.available
								? 'border-gray-200 hover:border-gray-300'
								: 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}"
						onclick={() =>
							provider.available &&
							(selectedProvider = provider.id)}
					>
						<div
							class="rounded-lg p-1.5 shrink-0 {selectedProvider ===
							provider.id
								? 'bg-blue-200'
								: 'bg-gray-100'}"
						>
							<Icon
								class="h-5 w-5 {selectedProvider === provider.id
									? 'text-blue-600'
									: 'text-gray-600'}"
							/>
						</div>
						<div class="flex-1 min-w-0">
							<h3
								class="font-semibold text-sm truncate"
								title={provider.name}
							>
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
					<div
						class="col-span-full py-8 text-center text-gray-500 text-sm italic"
					>
						No providers found matching "{searchTerm}"
					</div>
				{/if}
			</div>
		</div>

		{#if selectedProvider}
			<!-- Configuration -->
			<div class="bg-white shadow rounded-lg p-6 space-y-4">
				<h2 class="text-xl font-semibold mb-4">Configuration</h2>
				<div class="space-y-4">
					<div>
						<label
							for="name"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							Sync Name
						</label>
						<input
							{...fields.name.as("text")}
							value={providerId}
							name="name"
							placeholder="e.g., my-work-calendar"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(fields.name.issues()?.length ?? 0) > 0
								? 'border-red-500'
								: ''}"
							oninput={(e) => (providerId = e.currentTarget.value)}
							onblur={() => create.validate()}
						/>
						{#each fields.name.issues() ?? [] as issue}
							<p class="text-xs text-red-600 mt-1">
								{issue.message}
							</p>
						{/each}
						<p class="text-xs text-gray-500 mt-1">
							A unique identifier for this sync configuration
						</p>
					</div>

					{#if selectedProvider === "google-calendar"}
						<div>
							<label
								for="calendarId"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Calendar ID
							</label>
							<input
								{...fields.settings.fields.calendarId.as("text")}
								id="calendarId"
								bind:value={calendarId}
								placeholder="primary"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<p class="text-xs text-gray-500 mt-1">
								Use "primary" for your main calendar or specify
								a calendar ID
							</p>
						</div>
					{/if}

					{#if selectedProvider === "berlin-de-main-calendar"}
						<div>
							<label
								for="company"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Company (Firma)
							</label>
							<input
								{...fields.settings.fields.company.as("text")}
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
							<label
								for="mhUsername"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Login Username
							</label>
							<input
								{...fields.credentials.fields.username.as("text")}
								id="mhUsername"
								bind:value={mhUsername}
								placeholder="Username"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						<div>
							<label
								for="mhPassword"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Login Password
							</label>
							<input
								{...fields.credentials.fields.password.as(
									"password",
								)}
								id="mhPassword"
								bind:value={mhPassword}
								placeholder="Password"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
					{/if}

					{#if selectedProvider === "nebenan-de"}
						<div>
							<label
								for="nebenanEmail"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Nebenan.de Email / Username
							</label>
							<input
								{...fields.credentials.fields.email.as("text")}
								id="nebenanEmail"
								placeholder="login@example.com"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						<div>
							<label
								for="nebenanPassword"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Nebenan.de Password
							</label>
							<input
								{...fields.credentials.fields.password.as(
									"password",
								)}
								id="nebenanPassword"
								placeholder="Password"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						<div>
							<label
								for="nebenanProfileId"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Business Profile ID (Gewerbeprofil-ID)
							</label>
							<input
								{...fields.settings.fields.profileId.as("text")}
								id="nebenanProfileId"
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
							<label
								for="wpBaseUrl"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								WordPress Site URL
							</label>
							<input
								{...fields.settings.fields.baseUrl.as("url")}
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
							<label
								for="wpUsername"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								WordPress Username
							</label>
							<input
								{...fields.settings.fields.username.as("text")}
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
							<label
								for="wpAppPassword"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Application Password
							</label>
							<input
								{...fields.settings.fields.applicationPassword.as(
									"password",
								)}
								id="wpAppPassword"
								bind:value={wpAppPassword}
								placeholder="abcd 1234 efgh 5678 ijkl"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<p class="text-xs text-gray-500 mt-1">
								Application password generated in WordPress user
								profile
							</p>
						</div>
					{/if}

					<div>
						<label
							for="syncInterval"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							Sync Interval (minutes)
						</label>
						<input
							{...fields.settings.fields.syncIntervalMinutes.as(
								"number",
							)}
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
					{#each directions as dir}
						{@const Icon = dir.icon}
						<label
							class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {direction ===
							dir.value
								? 'border-blue-600 bg-blue-50'
								: 'border-gray-200 hover:border-gray-300'} {(selectedProvider ===
								'berlin-de-main-calendar' ||
								selectedProvider === 'berlin-de-mh-calendar' ||
								selectedProvider === 'wp-the-events-calendar' ||
								selectedProvider === 'seniorennetz-berlin' ||
								selectedProvider === 'email' ||
								selectedProvider === 'nebenan-de' ||
								selectedProvider === 'bewegungsatlas-berlin' ||
								selectedProvider === 'eventbrite' ||
								selectedProvider === 'meetup') &&
							dir.value !== 'push'
								? 'opacity-50 cursor-not-allowed'
								: ''}"
						>
							<input
								{...fields.direction.as(
									"radio",
									dir.value,
								)}
								checked={direction === dir.value}
								onchange={() => {
									direction = dir.value;
									create.validate();
								}}
								disabled={(selectedProvider ===
									"berlin-de-main-calendar" ||
									selectedProvider ===
										"berlin-de-mh-calendar" ||
									selectedProvider ===
										"wp-the-events-calendar" ||
									selectedProvider ===
										"seniorennetz-berlin" ||
									selectedProvider === "email" ||
									selectedProvider === "nebenan-de" ||
									selectedProvider === "bewegungsatlas-berlin" ||
									selectedProvider === "eventbrite" ||
									selectedProvider === "meetup") &&
									dir.value !== "push"}
								class="mt-1"
							/>
							<Icon
								class="h-5 w-5 mt-0.5 {direction === dir.value
									? 'text-blue-600'
									: 'text-gray-600'}"
							/>
							<div class="flex-1">
								<div class="font-medium">{dir.label}</div>
								<div class="text-sm text-gray-600">
									{dir.description}
								</div>
								{#if (selectedProvider === "berlin-de-main-calendar" || selectedProvider === "berlin-de-mh-calendar" || selectedProvider === "wp-the-events-calendar" || selectedProvider === "seniorennetz-berlin" || selectedProvider === "email" || selectedProvider === "nebenan-de" || selectedProvider === "bewegungsatlas-berlin" || selectedProvider === "eventbrite" || selectedProvider === "meetup") && dir.value !== "push"}
									<div class="text-xs text-orange-600 mt-1">
										Not supported for {selectedProvider ===
										"berlin-de-main-calendar"
											? "Berlin.de"
											: selectedProvider ===
												  "berlin-de-mh-calendar"
												? "Berlin.de (MH)"
												: selectedProvider ===
													  "wp-the-events-calendar"
													? "WordPress Events Calendar"
													: selectedProvider ===
														  "seniorennetz-berlin"
														? "Seniorennetz Berlin"
														: selectedProvider ===
														  "nebenan-de"
														? "Nebenan.de"
														: selectedProvider ===
														  "bewegungsatlas-berlin"
														? "Bewegungsatlas Berlin"
														: selectedProvider ===
														  "eventbrite"
														? "Eventbrite"
														: selectedProvider ===
														  "meetup"
														? "Meetup"
														: "Email (Brevo)"}
									</div>
								{/if}
							</div>
						</label>
					{/each}
				</div>
			</div>

			<!-- Submit -->
			<div class="flex items-center justify-end gap-3">
				<Button
					variant="secondary"
					href="/synchronizations"
					size="default"
				>
					Cancel
				</Button>
				<AsyncButton
					type="submit"
					loadingLabel="Creating..."
					loading={create.pending}
				>
					Create Sync
				</AsyncButton>
			</div>
		{/if}
	</form>
</div>
