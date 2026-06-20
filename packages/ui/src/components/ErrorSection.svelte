<script module lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  export interface Props extends HTMLAttributes<HTMLDivElement> {
    error?: unknown;
    headline?: string;
    message?: string;
    href?: string;
    button?: string;
    onRetry?: () => void;
  }
</script>

<script lang="ts">
  import { Button } from "./button/index.js";
  import { cn } from "../utils.js";

  let { 
    error,
    headline = "Something went wrong", 
    message, 
    href, 
    button = "Back",
    onRetry,
    class: className,
    ...restProps
  }: Props = $props();

  const displayMessage = $derived(message || (error as any)?.message || "An unexpected error occurred. Please try again.");
</script>

<div class={cn("max-w-2xl mx-auto", className)} {...restProps}>
  <div class="text-center py-12">
    <h3 class="text-xl font-bold text-red-600 mb-3">{headline}</h3>
    <p class="text-gray-600 mb-6 max-w-md mx-auto">{displayMessage}</p>
    
    <div class="flex items-center justify-center gap-3">
      {#if onRetry}
        <Button variant="outline" onclick={onRetry}>Try Again</Button>
      {/if}
      {#if href}
        <Button {href} size="default">{button}</Button>
      {/if}
    </div>
  </div>
</div>
