<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
	import { readContent } from "./read.remote.js";
	import { updateContent } from "./update.remote.js";
	import { getCurrentSessionUser } from "../goals/list.remote.js";
	import { updateCmsSchema } from "#lib/validations/cms.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { toast } from "svelte-sonner";
	import ScaleIcon from "@lucide/svelte/icons/scale";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import PencilIcon from "@lucide/svelte/icons/pencil";

	breadcrumbState.set({
		feature: "goals",
		current: "Legal Notice / Imprint (Impressum)",
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
	<title>Imprint / Legal Notice (Impressum) · AC-Goals</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6 py-4">
	<!-- Header Banner -->
	<div class="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
		<div class="space-y-1.5">
			<span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-700">
				<ScaleIcon class="size-3.5" />
				Provider Identification · § 5 DDG / TMG & § 18 MStV
			</span>
			<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
				Legal Notice / Imprint (Impressum)
			</h1>
			<p class="text-xs sm:text-sm text-gray-500">
				Mandatory operator disclosures, dispute resolution notice, and data protection contact details for AC-Goals.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2 shrink-0">
			<a
				href="/GDPR"
				class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
			>
				<FileTextIcon class="size-3.5" />
				Data Privacy (/GDPR)
			</a>
			<a
				href="/gdpr-self-service"
				class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
			>
				<ShieldCheckIcon class="size-3.5" />
				GDPR Self-Service
			</a>
			{#if isOperator}
				<button
					type="button"
					onclick={() => (isEditing ? (isEditing = false) : openEditor())}
					class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
				>
					<PencilIcon class="size-3.5 text-indigo-600" />
					{isEditing ? "Cancel" : "Edit Imprint"}
				</button>
			{/if}
		</div>
	</div>

	{#if isEditing && isOperator}
		<div class="rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm space-y-4">
			<h2 class="text-sm font-black uppercase tracking-wider text-indigo-950">
				Update Imprint / Legal Notice HTML Content
			</h2>
			<form
				{...updateContent.preflight(updateCmsSchema).enhance(async ({ submit }) => {
					const ok = await submit();
					if (ok) {
						toast.success("Imprint updated");
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
				<input {...updateContent.fields.pageSlug.as("hidden", "imprint")} />
				<input {...updateContent.fields.slotName.as("hidden", "main")} />

				<div>
					<label for="imprint-cms-content" class="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
						HTML Content
					</label>
					<textarea
						id="imprint-cms-content"
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
						Save Imprint
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if contentQuery.loading && !contentQuery.current}
		<LoadingSection />
	{:else if contentQuery.error}
		<ErrorSection headline="Failed to load Imprint" message={contentQuery.error.message} />
	{:else if contentQuery.current}
		<article
			{@attach (node) => {
				node.innerHTML = contentQuery.current?.content ?? "";
			}}
			class="rounded-3xl border border-gray-200/80 bg-white p-8 sm:p-10 shadow-2xs prose prose-slate max-w-none"
		></article>
	{/if}
</div>
