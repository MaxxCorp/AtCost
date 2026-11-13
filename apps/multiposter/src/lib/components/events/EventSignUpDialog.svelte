<script lang="ts">
	import * as Dialog from "#lib/components/ui/dialog/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import AsyncButton from "#lib/components/ui/AsyncButton.svelte";
	import * as m from "#lib/paraglide/messages.js";
	import { toast } from "svelte-sonner";
	import {
		submitEventSignUp,
		lookupEventReservation,
		cancelEventReservation,
	} from "../../../routes/events/[id]/signup.remote.js";
	import {
		UserPlus,
		Search,
		Plus,
		Trash2,
		Users,
		Bell,
		Mail,
		Phone,
		CheckCircle2,
		AlertCircle,
	} from "@lucide/svelte";

	interface Props {
		open: boolean;
		eventId: string;
		eventSummary: string;
		signUpMode: "off" | "recommended" | "required" | string;
		locations?: Array<{ id?: string; name: string }>;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(false),
		eventId,
		eventSummary,
		signUpMode,
		locations = [],
		onSuccess,
	}: Props = $props();

	let activeTab = $state<"new" | "lookup">("new");
	let lookupEmail = $state("");
	let lookupPhone = $state("");
	let lookupLoading = $state(false);
	let lookupNotFound = $state(false);
	let existingContactId = $state<string | undefined>(undefined);
	let lookupVerifiedEmail = $state<string | undefined>(undefined);
	let lookupVerifiedPhone = $state<string | undefined>(undefined);

	let givenName = $state("");
	let familyName = $state("");
	let emails = $state<string[]>([""]);
	let phones = $state<string[]>([""]);
	let partySize = $state<number>(1);
	let notifyOnChanges = $state(false);
	let subscribeLocationNewsletter = $state(false);

	let submitting = $state(false);
	let cancelling = $state(false);
	let formError = $state<string | null>(null);

	const locationNames = $derived(
		(locations ?? [])
			.map((l) => l?.name)
			.filter(Boolean)
			.join(", ")
	);

	function resetForm() {
		activeTab = "new";
		lookupEmail = "";
		lookupPhone = "";
		lookupNotFound = false;
		existingContactId = undefined;
		lookupVerifiedEmail = undefined;
		lookupVerifiedPhone = undefined;
		givenName = "";
		familyName = "";
		emails = [""];
		phones = [""];
		partySize = 1;
		notifyOnChanges = false;
		subscribeLocationNewsletter = false;
		formError = null;
	}

	function handleOpenChange(nextOpen: boolean) {
		open = nextOpen;
		if (!nextOpen) {
			resetForm();
		}
	}

	function addEmailField() {
		emails = [...emails, ""];
	}

	function removeEmailField(index: number) {
		if (emails.length <= 1) {
			emails = [""];
			return;
		}
		emails = emails.filter((_, i) => i !== index);
	}

	function addPhoneField() {
		phones = [...phones, ""];
	}

	function removePhoneField(index: number) {
		if (phones.length <= 1) {
			phones = [""];
			return;
		}
		phones = phones.filter((_, i) => i !== index);
	}

	function isValidEmail(val: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
	}

	async function handleLookup() {
		formError = null;
		lookupNotFound = false;

		const cleanEmail = lookupEmail.trim();
		const cleanPhone = lookupPhone.trim();
		if (!cleanEmail && cleanPhone.replace(/\D/g, "").length < 6) {
			formError =
				"Please enter an email address or a phone number (at least 6 digits) to look up your reservation.";
			return;
		}
		if (cleanEmail && !isValidEmail(cleanEmail)) {
			formError = "Please enter a valid email address.";
			return;
		}

		lookupLoading = true;
		try {
			const res = await lookupEventReservation({
				eventId,
				email: cleanEmail || undefined,
				phone: cleanPhone || undefined,
			});

			if (!res.found) {
				lookupNotFound = true;
				return;
			}

			const r = res.reservation;
			existingContactId = r.contactId;
			lookupVerifiedEmail = cleanEmail || undefined;
			lookupVerifiedPhone = cleanPhone || undefined;
			givenName = r.givenName;
			familyName = r.familyName;
			emails = r.emails.length > 0 ? r.emails : [""];
			phones = r.phones.length > 0 ? r.phones : [""];
			partySize = Math.max(1, r.partySize || 1);
			notifyOnChanges = Boolean(r.notifyOnChanges);
			subscribeLocationNewsletter = Boolean(r.subscribeLocationNewsletter);
			toast.success(
				m.reservation_found?.() ||
					"Reservation found! You can update or cancel it below."
			);
		} catch (err: any) {
			formError = err?.message || "Failed to look up reservation.";
		} finally {
			lookupLoading = false;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;

		if (!givenName.trim() || !familyName.trim()) {
			formError = "First name and last name are required.";
			return;
		}

		const nonEmptyEmails = emails.map((x) => x.trim()).filter(Boolean);
		for (const em of nonEmptyEmails) {
			if (!isValidEmail(em)) {
				formError = `Invalid email address: ${em}`;
				return;
			}
		}

		if ((notifyOnChanges || subscribeLocationNewsletter) && nonEmptyEmails.length === 0) {
			formError =
				m.email_required_for_notifications?.() ||
				"Please provide at least one valid email address to receive event updates or location newsletters.";
			return;
		}

		const nonEmptyPhones = phones.map((x) => x.trim()).filter(Boolean);

		submitting = true;
		try {
			const res = await submitEventSignUp({
				eventId,
				givenName: givenName.trim(),
				familyName: familyName.trim(),
				emails: nonEmptyEmails,
				phones: nonEmptyPhones,
				partySize: Math.max(1, Math.trunc(Number(partySize) || 1)),
				notifyOnChanges,
				subscribeLocationNewsletter,
				existingContactId,
			});

			toast.success(
				res.isUpdate
					? m.reservation_updated?.() || "Your reservation has been updated!"
					: m.reservation_saved?.() || "Your registration has been confirmed!"
			);
			onSuccess?.();
			handleOpenChange(false);
		} catch (err: any) {
			formError = err?.message || "Failed to submit registration.";
		} finally {
			submitting = false;
		}
	}

	async function handleCancelReservation() {
		if (!existingContactId) return;
		if (
			!confirm(
				m.cancel_reservation_confirm?.() ||
					"Are you sure you want to cancel your reservation?"
			)
		) {
			return;
		}

		cancelling = true;
		formError = null;
		try {
			await cancelEventReservation({
				eventId,
				contactId: existingContactId,
				email: lookupVerifiedEmail || emails.find((x) => x.trim()) || undefined,
				phone: lookupVerifiedPhone || phones.find((x) => x.trim()) || undefined,
			});
			toast.success(
				m.reservation_cancelled?.() || "Your reservation has been cancelled."
			);
			onSuccess?.();
			handleOpenChange(false);
		} catch (err: any) {
			formError = err?.message || "Failed to cancel reservation.";
		} finally {
			cancelling = false;
		}
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-xl">
				<UserPlus class="w-5 h-5 text-blue-600" />
				<span>{m.sign_up_modal_title?.() || "Event Registration"}</span>
			</Dialog.Title>
			<Dialog.Description class="text-sm text-gray-600">
				<span class="font-medium text-gray-900">{eventSummary}</span>
				{#if signUpMode === "required"}
					<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
						{m.sign_ups_required?.() || "Required"}
					</span>
				{:else if signUpMode === "recommended"}
					<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
						{m.sign_ups_recommended?.() || "Recommended"}
					</span>
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 mt-2">
			<p class="text-xs text-gray-600 bg-blue-50/70 border border-blue-100 rounded-lg p-3 leading-relaxed">
				{m.sign_up_modal_intro?.() ||
					"Reserve your spot for this event. Only your first and last name are required; provide an email address if you would like to receive event updates or location newsletters."}
			</p>

			<!-- Mode Switcher -->
			<div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
				<button
					type="button"
					onclick={() => {
						if (existingContactId) {
							resetForm();
						} else {
							activeTab = "new";
							lookupNotFound = false;
							formError = null;
						}
					}}
					class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors {activeTab === 'new'
						? 'bg-white text-gray-900 shadow-2xs'
						: 'text-gray-600 hover:text-gray-900'}"
				>
					{m.sign_up_tab_new?.() || "New Registration"}
				</button>
				<button
					type="button"
					onclick={() => {
						activeTab = "lookup";
						lookupNotFound = false;
						formError = null;
					}}
					class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors {activeTab === 'lookup'
						? 'bg-white text-gray-900 shadow-2xs'
						: 'text-gray-600 hover:text-gray-900'}"
				>
					{m.sign_up_tab_lookup?.() || "Update / Cancel Reservation"}
				</button>
			</div>

			{#if activeTab === "lookup" && !existingContactId}
				<div class="space-y-4 p-4 border border-gray-200 rounded-xl bg-gray-50/60">
					<p class="text-xs text-gray-600">
						{m.sign_up_lookup_intro?.() ||
							"Already signed up? Enter the email address or phone number you used when registering to view, update, or cancel your reservation."}
					</p>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="lookup-email" class="block text-xs font-medium text-gray-700 mb-1">
								{m.email_address?.() || "Email Address"}
							</label>
							<input
								id="lookup-email"
								type="email"
								bind:value={lookupEmail}
								placeholder="name@example.com"
								class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
							/>
						</div>
						<div>
							<label for="lookup-phone" class="block text-xs font-medium text-gray-700 mb-1">
								{m.phone_number?.() || "Phone Number"}
							</label>
							<input
								id="lookup-phone"
								type="tel"
								bind:value={lookupPhone}
								placeholder="+49 176 5405659"
								class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
							/>
						</div>
					</div>

					{#if lookupNotFound}
						<div class="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
							<AlertCircle class="w-4 h-4 shrink-0" />
							<span>
								{m.reservation_not_found?.() ||
									"No matching reservation was found for this event."}
							</span>
						</div>
					{/if}

					{#if formError}
						<div class="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
							<AlertCircle class="w-4 h-4 shrink-0" />
							<span>{formError}</span>
						</div>
					{/if}

					<div class="flex justify-end">
						<AsyncButton
							type="button"
							onclick={handleLookup}
							loading={lookupLoading}
							class="gap-1.5"
						>
							<Search class="w-4 h-4" />
							<span>{m.find_reservation?.() || "Find Reservation"}</span>
						</AsyncButton>
					</div>
				</div>
			{:else}
				{#if existingContactId}
					<div class="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
						<CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-600" />
						<span>
							{m.reservation_found?.() ||
								"Reservation found! You can update your details below or cancel your reservation."}
						</span>
					</div>
				{/if}

				<form onsubmit={handleSubmit} class="space-y-4">
					<!-- Name -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="signup-given-name" class="block text-xs font-medium text-gray-700 mb-1">
								{m.given_name?.() || "First Name"} *
							</label>
							<input
								id="signup-given-name"
								type="text"
								required
								bind:value={givenName}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
							/>
						</div>
						<div>
							<label for="signup-family-name" class="block text-xs font-medium text-gray-700 mb-1">
								{m.family_name?.() || "Last Name"} *
							</label>
							<input
								id="signup-family-name"
								type="text"
								required
								bind:value={familyName}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
							/>
						</div>
					</div>

					<!-- Party Size -->
					<div class="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
						<div class="flex items-center justify-between gap-2">
							<label for="signup-party-size" class="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
								<Users class="w-4 h-4 text-blue-600" />
								<span>{m.party_size_label?.() || "Total people in your party (including you)"}</span>
							</label>
							<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
								{m.party_of_count?.({ count: String(Math.max(1, partySize || 1)) }) ||
									`Party of ${Math.max(1, partySize || 1)}`}
							</span>
						</div>
						<div class="flex items-center gap-3">
							<input
								id="signup-party-size"
								type="number"
								min="1"
								max="100"
								bind:value={partySize}
								class="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-center bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
							/>
							<p class="text-xs text-gray-500">
								{m.party_size_help?.() ||
									"Coming with additional people? Increase this number (e.g. 5 for a party of five: you + 4 guests)."}
							</p>
						</div>
					</div>

					<!-- Emails -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium text-gray-700 flex items-center gap-1.5">
								<Mail class="w-3.5 h-3.5 text-gray-500" />
								<span>{m.email_addresses?.() || "Email Addresses"}</span>
							</span>
							<button
								type="button"
								onclick={addEmailField}
								class="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
							>
								<Plus class="w-3.5 h-3.5" />
								<span>{m.add_email?.() || "Add Email"}</span>
							</button>
						</div>
						{#each emails as _, i (i)}
							<div class="flex items-center gap-2">
								<input
									type="email"
									bind:value={emails[i]}
									placeholder={m.email_address?.() || "name@example.com"}
									class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
								/>
								{#if emails.length > 1 || emails[i]}
									<button
										type="button"
										onclick={() => removeEmailField(i)}
										class="p-2 text-gray-400 hover:text-red-600 rounded-lg"
										aria-label="Remove email"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Phones -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium text-gray-700 flex items-center gap-1.5">
								<Phone class="w-3.5 h-3.5 text-gray-500" />
								<span>{m.phone_numbers?.() || "Phone Numbers"}</span>
							</span>
							<button
								type="button"
								onclick={addPhoneField}
								class="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
							>
								<Plus class="w-3.5 h-3.5" />
								<span>{m.add_phone?.() || "Add Phone"}</span>
							</button>
						</div>
						{#each phones as _, i (i)}
							<div class="flex items-center gap-2">
								<input
									type="tel"
									bind:value={phones[i]}
									placeholder={m.phone_number?.() || "+49 176 5405659"}
									class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
								/>
								{#if phones.length > 1 || phones[i]}
									<button
										type="button"
										onclick={() => removePhoneField(i)}
										class="p-2 text-gray-400 hover:text-red-600 rounded-lg"
										aria-label="Remove phone"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Notification Options -->
					<div class="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
						<div class="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
							<Bell class="w-3.5 h-3.5 text-blue-600" />
							<span>Notifications (requires a valid email)</span>
						</div>
						<label class="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={notifyOnChanges}
								class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span>
								{m.notify_event_changes?.() ||
									"Notify me of changes to events I am signed up for"}
							</span>
						</label>
						<label class="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={subscribeLocationNewsletter}
								class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span>
								{locationNames
									? m.subscribe_location_newsletter_named?.({ locations: locationNames }) ||
									  `Subscribe to the newsletter for ${locationNames}`
									: m.subscribe_location_newsletter?.() ||
									  "Subscribe to the location's newsletter"}
							</span>
						</label>
					</div>

					{#if formError}
						<div class="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
							<AlertCircle class="w-4 h-4 shrink-0" />
							<span>{formError}</span>
						</div>
					{/if}

					<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
						{#if existingContactId}
							<AsyncButton
								type="button"
								variant="destructive"
								onclick={handleCancelReservation}
								loading={cancelling}
							>
								{m.cancel_reservation?.() || "Cancel Reservation"}
							</AsyncButton>
						{:else}
							<div></div>
						{/if}

						<div class="flex items-center gap-2">
							<Button
								type="button"
								variant="secondary"
								onclick={() => handleOpenChange(false)}
							>
								{m.cancel?.() || "Cancel"}
							</Button>
							<AsyncButton type="submit" loading={submitting}>
								{existingContactId
									? m.update_reservation?.() || "Update Reservation"
									: m.register_for_event?.() || "Sign Up for Event"}
							</AsyncButton>
						</div>
					</div>
				</form>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
