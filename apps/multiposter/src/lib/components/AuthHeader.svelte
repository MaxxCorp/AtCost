<script lang="ts">
	import { AuthHeader } from "@ac/ui";
	import { authClient } from "$lib/auth-client";
	import { page } from "$app/state";
	import { localizeHref } from "$lib/paraglide/runtime";
	import type { Snippet } from "svelte";

	let { user = null }: { user?: any } = $props();
</script>

<AuthHeader {authClient} {user} appName="AC Multiposter">
	{#snippet nav()}
		<nav class="hidden md:flex gap-4">
			<a
				href="/imprint"
				class="text-sm font-medium text-gray-500 hover:text-gray-900"
				>Imprint</a
			>
			<a
				href="/GDPR"
				class="text-sm font-medium text-gray-500 hover:text-gray-900"
				>Data Privacy</a
			>
		</nav>
	{/snippet}
</AuthHeader>
