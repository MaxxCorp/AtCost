<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import * as m from "#lib/paraglide/messages.js";
	import { listLocations } from "./list.remote";
	import { deleteLocation } from "./[id]/delete.remote";
	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
	import { LocationList } from "@ac/ui";
	import { getLocationFilterGroups } from "#lib/filters/index.js";

	const filterGroups = $derived(getLocationFilterGroups(m));
	let locationListRef = $state<ReturnType<typeof LocationList> | undefined>();

	afterNavigate(({ from }) => {
		if (from) void locationListRef?.refresh();
	});
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="locations" />
		<LocationList
			bind:this={locationListRef}
			listLocationsRemote={listLocations}
			deleteLocationRemote={deleteLocation}
			{filterGroups}
			{m}
		/>
	</div>
</div>
