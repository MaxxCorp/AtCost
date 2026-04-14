<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { listShiftplans } from "./list.remote";
    import { deleteShiftplans } from "./[id]/delete.remote";
    import { LoadingSection, ErrorSection, BulkActionToolbar, EmptyState, Button, handleDelete } from "@ac/ui";
    import { Calendar, MapPin, Pencil, Trash2, ChevronRight } from "@lucide/svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { goto } from "$app/navigation";

    breadcrumbState.set({ feature: "shiftplans" });

    const query = listShiftplans();
    let selectedIds = $state<Set<string>>(new Set());

    function isSelected(id: string) {
        return selectedIds.has(id);
    }
    
    function toggleSelection(id: string) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        selectedIds = new Set(selectedIds);
    }
    
    function selectAll(items: any[]) {
        selectedIds = new Set(items.map((item) => item.id));
    }
    
    function deselectAll() {
        selectedIds = new Set();
    }
</script>

<div class="container mx-auto px-4">
    <div class="max-w-5xl mx-auto space-y-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-3xl font-bold tracking-tight">Shiftplan Templates</h1>
                <p class="text-gray-500 mt-1">Manage recurring schedules and staff assignments across locations.</p>
            </div>
            
            <div class="flex items-center gap-3">
                <BulkActionToolbar
                    selectedCount={selectedIds.size}
                    totalCount={query.current?.length ?? 0}
                    onSelectAll={() => selectAll(query.current ?? [])}
                    onDeselectAll={deselectAll}
                    onDelete={async () => {
                        await handleDelete({
                            ids: [...selectedIds],
                            deleteFn: deleteShiftplans,
                            itemName: "shiftplan templates",
                        });
                        deselectAll();
                        query.refresh();
                    }}
                    newItemHref="/shiftplans/new"
                    newItemLabel="+ New Template"
                />
            </div>
        </div>

        {#if query.loading}
            <LoadingSection message="Loading shiftplan templates..." />
        {:else if query.error}
            <ErrorSection
                headline="Failed to load shiftplans"
                message={query.error?.message || "Something went wrong"}
                href="/shiftplans"
                button="Retry"
            />
        {:else if query.current}
            {#if query.current.length === 0}
                <div class="bg-white rounded-3xl p-12 shadow-sm border border-gray-100">
                    <EmptyState
                        icon={Calendar}
                        title="No Shiftplan Templates"
                        description="Define your first recurring schedule to start managing staff rotations."
                        actionLabel="Create First Template"
                        actionHref="/shiftplans/new"
                    />
                </div>
            {:else}
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {#each query.current as plan (plan.id)}
                        <div class="group relative bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300">
                            <div class="flex items-start justify-between gap-4 mb-4">
                                <div class="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={isSelected(plan.id)}
                                        onchange={() => toggleSelection(plan.id)}
                                        class="w-4 h-4 text-purple-600 rounded-md border-gray-300 focus:ring-purple-500"
                                    />
                                    <div class="p-2 bg-purple-50 rounded-xl text-purple-600">
                                        <Calendar size={18} />
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        href={`/shiftplans/${plan.id}`}
                                        variant="ghost"
                                        size="icon"
                                        class="h-8 w-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                                    >
                                        <Pencil size={16} />
                                    </Button>
                                    <Button
                                        onclick={async () => {
                                            if (confirm("Delete this template?")) {
                                                await deleteShiftplans([plan.id]);
                                                query.refresh();
                                            }
                                        }}
                                        variant="ghost"
                                        size="icon"
                                        class="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>

                            <a href={`/shiftplans/${plan.id}`} class="block space-y-3">
                                <h3 class="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                                    {plan.name}
                                </h3>
                                
                                <div class="space-y-2">
                                    <div class="flex items-center gap-2 text-sm text-gray-500">
                                        <MapPin size={14} />
                                        <span>{plan.locationName || 'Unassigned Location'}</span>
                                    </div>
                                    <div class="flex items-center gap-2 text-sm text-gray-500">
                                        <Calendar size={14} />
                                        <span>
                                            {(plan.schedule as any[])?.filter((d: any) => d.isActive).length ?? 0} Workdays configured
                                        </span>
                                    </div>
                                </div>
                            </a>

                            <div class="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                                <span class="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                                    Created {new Date(plan.createdAt).toLocaleDateString()}
                                </span>
                                <div class="p-1.5 bg-gray-50 rounded-lg">
                                    <ChevronRight size={14} class="text-gray-400" />
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>
