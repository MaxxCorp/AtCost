<script lang="ts">
	import { Button } from "@ac/ui";
	import type { Snippet } from "svelte";
	import { LoaderCircle } from "@lucide/svelte";

	interface Props {
		// Loading state - can be a boolean or a number (for remote function pending count)
		loading?: boolean | number;

		children?: Snippet;

		// Button styling variants (inherited from shadcn Button)
		variant?:
			| "default"
			| "destructive"
			| "outline"
			| "secondary"
			| "ghost"
			| "link";
		size?: "default" | "sm" | "lg" | "icon";

		// Additional classes
		class?: string;

		// Disable button independently of loading state
		disabled?: boolean;

		// Form button type
		type?: "button" | "submit" | "reset";

		// Click handler
		onclick?: (event: MouseEvent) => void;

		// Button text while loading
		loadingLabel?: string;

		// Allow other HTML attributes
		[key: string]: any;
	}

	let {
		loading = false,
		loadingLabel = "Processing...",
		children,
		variant = "default",
		size = "default",
		class: className = "",
		disabled = false,
		type = "button",
		onclick,
		...rest
	}: Props = $props();

	// Normalize loading state (handle both boolean and number from remote function pending count)
	const isLoading = $derived(
		typeof loading === "number" ? loading > 0 : loading,
	);

	// Determine if button should be disabled
	const isDisabled = $derived(isLoading || disabled);
</script>

<Button
	{type}
	{variant}
	{size}
	class={className}
	disabled={isDisabled}
	{onclick}
	{...rest}
>
	{#if isLoading}
		<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
		{loadingLabel}
	{:else if children}
		{@render children()}
	{/if}
</Button>
