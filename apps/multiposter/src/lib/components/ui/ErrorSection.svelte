<script module lang="ts">
  export interface Props {
    headline: string;
    message: string;
    href?: string;
    button?: string;
  }
</script>

<script lang="ts">
import Button from './button/button.svelte';
const { headline, message, href = '/', button = 'Back' }: Props = $props();
</script>

<div class="max-w-2xl mx-auto">
  <div class="text-center py-12">
    <h1 class="text-2xl font-bold text-red-600 mb-4">{headline}</h1>
    <p class="text-gray-600 mb-6">{message}</p>
    <Button href={href} size="default">{button}</Button>
  </div>
</div>
