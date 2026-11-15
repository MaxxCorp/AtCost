<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { LocationDetailView, LoadingSection, Button } from "@ac/ui";
	import { page } from "$app/state";
	import { readLocation } from "./read.remote.js";
	import { updateLocation } from "./update.remote.js";
	import { deleteLocation } from "./delete.remote.js";
	import { getCurrentSessionUser } from "../../goals/list.remote.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { updateLocationSchema } from "@ac/validations";
	import { Lock } from "@lucide/svelte";

	const locationId = $derived(page.params.id as string);
	const sessionQuery = getCurrentSessionUser({});
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(Boolean(sessionQuery.current?.isOperator));
</script>

{#if sessionQuery.loading && !sessionQuery.current}
	<LoadingSection message="Verifying operator access..." />
{:else if !currentUser || !isOperator}
	<div class="max-w-3xl mx-auto py-8">
		<div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-5 shadow-sm">
			<div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
				<Lock class="w-7 h-7" />
			</div>
			<div class="space-y-2 max-w-xl mx-auto">
				<h1 class="text-xl font-bold text-gray-900">
					{!currentUser ? "Authentication Required" : "Operator or Admin Privileges Required"}
				</h1>
				<p class="text-sm text-gray-600 leading-relaxed">
					{!currentUser
						? "Please sign in with an Operator or Administrator account to manage locations."
						: "Only platform operators and administrators can view and edit location details."}
				</p>
			</div>
			<div class="flex flex-wrap items-center justify-center gap-3">
				{#if !currentUser}
					<Button href="/login?redirectTo={encodeURIComponent(page.url.pathname)}" variant="primary">
						Sign In
					</Button>
				{:else}
					<Button href="/goals" variant="outline">Back to Campaigns</Button>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<LocationDetailView
		{locationId}
		readLocationRemote={readLocation}
		updateLocationRemote={updateLocation}
		deleteLocationRemote={deleteLocation}
		validationSchema={updateLocationSchema}
		cancelHref="/locations"
		{m}
		onLocationLoaded={(loc: any) => {
			breadcrumbState.set({
				feature: "locations",
				current: `Edit: ${loc.name}`,
			});
		}}
	/>
{/if}
