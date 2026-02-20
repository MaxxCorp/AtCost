<script lang="ts">
	import { Breadcrumbs } from "@ac/ui";

	// Swallow props to avoid breaking consumers immediately
	let { ..._ }: Record<string, any> = $props();
</script>

<Breadcrumbs />
