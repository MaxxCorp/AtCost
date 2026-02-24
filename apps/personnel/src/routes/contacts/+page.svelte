<script lang="ts">
    import { listContacts } from "./list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { onMount } from "svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import ErrorSection from "@ac/ui/components/ErrorSection.svelte";
    import EmptyState from "@ac/ui/components/EmptyState.svelte";

    breadcrumbState.set({ feature: "contacts" });

    let contacts = $state<any[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        try {
            contacts = await listContacts();
        } catch (e: any) {
            error = e.message || "Failed to load employees";
        } finally {
            loading = false;
        }
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Employees</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage employee records and contact information
            </p>
        </div>
        <a
            href="/contacts/new"
            class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
            + Add Employee
        </a>
    </div>

    {#if loading}
        <LoadingSection message="Loading employees..." />
    {:else if error}
        <ErrorSection headline="Error" message={error} />
    {:else if contacts.length === 0}
        <EmptyState
            title="No employees yet"
            description="Add your first employee to get started."
            actionLabel="Add Employee"
            actionHref="/contacts/new"
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
                                >Email</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Phone</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Tags</th
                            >
                            <th
                                class="px-4 py-3 text-right font-medium text-gray-600"
                                >Actions</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {#each contacts as employee (employee.id)}
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 font-medium text-gray-900">
                                    {employee.displayName ||
                                        `${employee.givenName || ""} ${employee.familyName || ""}`.trim() ||
                                        "—"}
                                </td>
                                <td class="px-4 py-3 text-gray-600">
                                    {employee.emails?.[0]?.value || "—"}
                                </td>
                                <td class="px-4 py-3 text-gray-600">
                                    {employee.phones?.[0]?.value || "—"}
                                </td>
                                <td class="px-4 py-3">
                                    {#if employee.tags?.length}
                                        <div class="flex gap-1 flex-wrap">
                                            {#each employee.tags.slice(0, 3) as tag}
                                                <span
                                                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                                                >
                                                    {tag.name}
                                                </span>
                                            {/each}
                                            {#if employee.tags.length > 3}
                                                <span
                                                    class="text-xs text-gray-400"
                                                    >+{employee.tags.length -
                                                        3}</span
                                                >
                                            {/if}
                                        </div>
                                    {:else}
                                        <span class="text-gray-400">—</span>
                                    {/if}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <a
                                        href="/contacts/{employee.id}"
                                        class="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
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
