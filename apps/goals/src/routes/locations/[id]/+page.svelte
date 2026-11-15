<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { LocationDetailView } from "@ac/ui";
	import { page } from "$app/state";
	import { readLocation } from "./read.remote.js";
	import { updateLocation } from "./update.remote.js";
	import { deleteLocation } from "./delete.remote.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { updateLocationSchema } from "@ac/validations";

	const locationId = $derived(page.params.id as string);
</script>

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
