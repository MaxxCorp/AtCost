<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { listLocations } from "./list.remote.js";
	import { deleteLocation } from "./[id]/delete.remote.js";
	import { getCurrentSessionUser } from "../goals/list.remote.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { LocationList, LoadingSection, Button } from "@ac/ui";
	import { getLocationFilterGroups } from "#lib/filters/index.js";
	import { Lock } from "@lucide/svelte";

	breadcrumbState.set({ feature: "locations" });

	const sessionQuery = getCurrentSessionUser({});
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(Boolean(sessionQuery.current?.isOperator));
	const filterGroups = $derived(getLocationFilterGroups(m));
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		{#if sessionQuery.loading && !sessionQuery.current}
			<LoadingSection message="Verifying operator access..." />
		{:else if !currentUser || !isOperator}
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
							: "Only platform operators and administrators can view and manage locations."}
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
		{:else}
			<LocationList
				listLocationsRemote={listLocations}
				deleteLocationRemote={deleteLocation}
				{filterGroups}
				{m}
			/>
		{/if}
	</div>
</div>
