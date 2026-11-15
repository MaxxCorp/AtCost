<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
	import { readContent } from "./read.remote.js";
	import { updateContent } from "./update.remote.js";
	import { getCurrentSessionUser } from "../goals/list.remote.js";
	import { updateCmsSchema } from "#lib/validations/cms.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { toast } from "svelte-sonner";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import LockIcon from "@lucide/svelte/icons/lock";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import ScaleIcon from "@lucide/svelte/icons/scale";
	import UsersIcon from "@lucide/svelte/icons/users";

	breadcrumbState.set({
		feature: "goals",
		current: "Data Privacy Policy (GDPR / DSGVO)",
	});

	const contentQuery = readContent({});
	const sessionQuery = getCurrentSessionUser({});
	const isOperator = $derived(Boolean(sessionQuery.current?.isOperator));

	let isEditing = $state(false);
	let draftHtml = $state("");

	function openEditor() {
		draftHtml = contentQuery.current?.content ?? "";
		isEditing = true;
	}
</script>

<svelte:head>
	<title>Data Privacy Policy (Datenschutzerklärung) · AC-Goals</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6 py-4">
	<!-- Prominent GDPR Self-Service & Encrypted Contact Segregation Callout -->
	<div class="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
			<div class="space-y-2 max-w-2xl">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-200">
					<LockIcon class="size-3.5" />
					GDPR Art. 15, 17 & 25 · Encrypted Contact Segregation
				</span>
				<h1 class="text-2xl sm:text-3xl font-black tracking-tight">
					Data Privacy & Automated Crypto-Shredding
				</h1>
				<p class="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
					Exercise your Right to Erasure (Art. 17 GDPR) at any time via our 3-attribute blind-index verification portal, or inspect how supporter contact records are segregated from public campaign counters.
				</p>
			</div>

			<div class="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
				<a
					href="/gdpr-self-service"
					class="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md hover:bg-emerald-400 transition-all"
				>
					<ShieldCheckIcon class="size-4" />
					GDPR Art. 15 & 17 Self-Service
				</a>
				{#if isOperator}
					<a
						href="/contacts"
						class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all"
					>
						<UsersIcon class="size-4" />
						Manage Encrypted Contacts
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2 text-xs text-gray-500">
			<a href="/imprint" class="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline">
				<ScaleIcon class="size-3.5" />
				View Legal Notice / Imprint (Impressum)
			</a>
		</div>

		{#if isOperator}
			<button
				type="button"
				onclick={() => (isEditing ? (isEditing = false) : openEditor())}
				class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 cursor-pointer"
			>
				<PencilIcon class="size-3.5 text-indigo-600" />
				{isEditing ? "Cancel Editing" : "Edit Policy Content (CMS)"}
			</button>
		{/if}
	</div>

	{#if isEditing && isOperator}
		<div class="rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm space-y-4">
			<h2 class="text-sm font-black uppercase tracking-wider text-indigo-950">
				Update Data Privacy Policy HTML Content
			</h2>
			<form
				{...updateContent.preflight(updateCmsSchema).enhance(async ({ submit }) => {
					const ok = await submit();
					if (ok) {
						toast.success("Data Privacy Policy updated");
						await contentQuery.refresh();
						isEditing = false;
					} else {
						toast.error("Please check validation errors");
					}
				})}
				class="space-y-4"
			>
				<input {...updateContent.fields.language.as("hidden", "en")} />
				<input {...updateContent.fields.branch.as("hidden", "published")} />
				<input {...updateContent.fields.pageSlug.as("hidden", "gdpr")} />
				<input {...updateContent.fields.slotName.as("hidden", "main")} />

				<div>
					<label for="gdpr-cms-content" class="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
						HTML Content
					</label>
					<textarea
						id="gdpr-cms-content"
						rows={14}
						bind:value={draftHtml}
						{...updateContent.fields.content.as("text")}
						class="w-full rounded-2xl border border-gray-200 p-4 font-mono text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
					></textarea>
					{#each updateContent.fields.content.issues() as issue (issue.message)}
						<p class="mt-1 text-xs font-semibold text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={() => (isEditing = false)}
						class="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700"
					>
						Save Policy
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Content Display -->
	{#if contentQuery.loading && !contentQuery.current}
		<LoadingSection />
	{:else if contentQuery.error}
		<ErrorSection headline="Failed to load Data Privacy Policy" message={contentQuery.error.message} />
	{:else if contentQuery.current}
		<article
			{@attach (node) => {
				node.innerHTML = contentQuery.current?.content ?? "";
			}}
			class="rounded-3xl border border-gray-200/80 bg-white p-8 sm:p-10 shadow-2xs prose prose-slate max-w-none"
		></article>
	{/if}
</div>
