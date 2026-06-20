<script module lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  export interface Props extends HTMLAttributes<HTMLDivElement> {
    message?: string;
  }
</script>
<script lang="ts">
  import { Loader2 } from '@lucide/svelte';
  import { cn } from '../utils.js';

  let { message = 'Loading...', class: className, ...restProps }: Props = $props();
</script>

<div class={cn("flex flex-col items-center justify-center py-12", className)} {...restProps}>
  <Loader2 class="h-8 w-8 animate-spin text-primary-500" />
  <p class="mt-3 text-gray-500 text-sm font-medium">{message}</p>
</div>
