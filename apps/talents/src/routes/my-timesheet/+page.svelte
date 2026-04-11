<script lang="ts">
    import TimesheetsManager from '$lib/components/timesheets/TimesheetsManager.svelte';
    import { breadcrumbState } from '$lib/stores/breadcrumb.svelte';
    import { onMount } from 'svelte';
    
    // Receive direct data from +page.ts
    let { data } = $props();

    onMount(() => {
        breadcrumbState.set({ feature: 'timesheets', current: 'My Time Tracking' });
    });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <TimesheetsManager profilePromise={Promise.resolve(data.profile)} />
</div>
