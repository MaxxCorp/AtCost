<script module lang="ts">
  export interface Props {
    message?: string;
  }
</script>
<script lang="ts">
  const { message = 'Loading...' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12">
  <svg class="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" stroke-width="4" class="opacity-25" />
    <path d="M4 12a8 8 0 018-8" stroke-width="4" class="opacity-75" />
  </svg>
  <p class="mt-3 text-gray-500 text-sm">{message}</p>
</div>
