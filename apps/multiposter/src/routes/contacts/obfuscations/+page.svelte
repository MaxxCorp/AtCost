<script lang="ts">
    import { GdprAdminList } from '@ac/ui';
    import { breadcrumbState } from '#lib/stores/breadcrumb.svelte.js';
    import { listGdprRequests, executeGdprObfuscation } from './obfuscations.remote.js';

    breadcrumbState.set({ feature: 'contacts', current: 'DSGVO Obfuskierung' });

    const requestsQuery = listGdprRequests({ status: 'all' });
</script>

<svelte:head>
    <title>DSGVO Obfuskierungs-Manager · AtCost Multiposter</title>
</svelte:head>

<GdprAdminList
    {requestsQuery}
    obfuscateCommand={executeGdprObfuscation}
/>
