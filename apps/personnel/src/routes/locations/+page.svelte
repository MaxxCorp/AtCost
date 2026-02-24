<script lang="ts">
    import { listLocations } from "./list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { onMount } from "svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import ErrorSection from "@ac/ui/components/ErrorSection.svelte";
    import EmptyState from "@ac/ui/components/EmptyState.svelte";

    breadcrumbState.set({ feature: "locations" });

    let locations = $state<any[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        try {
            locations = await listLocations();
        } catch (e: any) {
            error = e.message || "Failed to load locations";
        } finally {
            loading = false;
        }
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Locations</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage office locations, branches, and work sites
            </p>
        </div>
        <a
            href="/locations/new"
            class="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
        >
            + Add Location
        </a>
    </div>

    {#if loading}
        <LoadingSection message="Loading locations..." />
    {:else if error}
        <ErrorSection headline="Error" message={error} />
    {:else if locations.length === 0}
        <EmptyState
            title="No locations yet"
            description="Add your first location to get started."
            actionLabel="Add Location"
            actionHref="/locations/new"
        />
    {:else}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Name</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Address</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >City</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Country</th
                            >
                            <th
                                class="px-4 py-3 text-right font-medium text-gray-600"
                                >Actions</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {#each locations as loc (loc.id)}
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 font-medium text-gray-900"
                                    >{loc.name}</td
                                >
                                <td class="px-4 py-3 text-gray-600">
                                    {[loc.street, loc.houseNumber]
                                        .filter(Boolean)
                                        .join(" ") || "—"}
                                </td>
                                <td class="px-4 py-3 text-gray-600"
                                    >{loc.city || "—"}</td
                                >
                                <td class="px-4 py-3 text-gray-600"
                                    >{loc.country || "—"}</td
                                >
                                <td class="px-4 py-3 text-right">
                                    <a
                                        href="/locations/{loc.id}"
                                        class="text-orange-600 hover:text-orange-800 font-medium text-sm"
                                    >
                                        Edit
                                    </a>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>
