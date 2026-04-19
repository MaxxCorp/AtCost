<script lang="ts">
    import { listShiftplans } from "./list.remote";
    import { deleteShiftplans } from "./[id]/delete.remote";
    import { EntityManager, Button, AsyncButton } from "@ac/ui";
    import { Calendar, MapPin, Pencil, Trash2, ChevronRight } from "@lucide/svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    breadcrumbState.set({ feature: "shiftplans" });

    type Shiftplan = Awaited<ReturnType<typeof listShiftplans>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-5xl mx-auto space-y-6">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-gray-900">Shiftplan Templates</h1>
            <p class="text-gray-500 mt-1">Manage recurring schedules and staff assignments across locations.</p>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <EntityManager
                title="Shiftplans"
                icon={Calendar}
                mode="standalone"
                listItemsRemote={listShiftplans as any}
                deleteItemRemote={deleteShiftplans}
                loadingLabel="Synchronizing templates..."
                noItemsFoundLabel="No templates found."
                searchPredicate={(plan: Shiftplan, q: string) => 
                    plan.name.toLowerCase().includes(q.toLowerCase()) ||
                    (plan.locationName?.toLowerCase().includes(q.toLowerCase()) ?? false)
                }
            >
                {#snippet renderListItem(plan: Shiftplan, { isSelected, toggleSelection, deleteItem })}
                    <div class="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300">
                        <div class="flex items-start justify-between gap-4 mb-4">
                            <div class="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onchange={() => toggleSelection(plan.id)}
                                    class="w-5 h-5 text-purple-600 rounded-lg border-gray-300 focus:ring-purple-500"
                                />
                                <div class="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl text-purple-600 border border-purple-200 shadow-sm">
                                    <Calendar size={20} />
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <Button
                                    href={`/shiftplans/${plan.id}`}
                                    variant="ghost"
                                    size="icon"
                                    class="h-9 w-9 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl"
                                >
                                    <Pencil size={18} />
                                </Button>
                                <AsyncButton
                                    onclick={() => deleteItem(plan)}
                                    variant="ghost"
                                    size="icon"
                                    class="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                >
                                    <Trash2 size={18} />
                                </AsyncButton>
                            </div>
                        </div>

                        <a href={`/shiftplans/${plan.id}`} class="block space-y-4">
                            <div>
                                <h3 class="text-xl font-black text-gray-900 group-hover:text-purple-600 transition-colors leading-tight">
                                    {plan.name}
                                </h3>
                                
                                <div class="mt-3 space-y-2">
                                    <div class="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                        <MapPin size={14} class="text-purple-400" />
                                        <span>{plan.locationName || 'Unassigned Location'}</span>
                                    </div>
                                    <div class="flex items-center gap-2 text-sm text-gray-500 font-medium font-mono uppercase tracking-tighter">
                                        <Calendar size={14} class="text-purple-400" />
                                        <span>
                                            {(plan.schedule as any[])?.filter((d: any) => d.isActive).length ?? 0} Workdays configured
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="pt-4 border-t border-gray-50 flex items-center justify-between">
                                <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                    Identified {new Date(plan.createdAt).toLocaleDateString()}
                                </span>
                                <div class="p-2 bg-gray-50 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all">
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        </a>
                    </div>
                {/snippet}
            </EntityManager>
        </div>
    </div>
</div>
