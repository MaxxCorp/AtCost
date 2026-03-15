<script lang="ts">
    import { format } from "date-fns";
    import { 
        ChevronDown, 
        ChevronUp, 
        Plus, 
        User, 
        Calendar, 
        MessageSquare,
        UserCheck,
        ClipboardCheck,
        UserMinus,
        MessageCircle
    } from "@lucide/svelte";
    import { Button } from "../button";
    import * as Collapsible from "../collapsible";
    import TimelineEntryDialog from "./TimelineEntryDialog.svelte";
    import type { Snippet } from "svelte";

    interface TimelineEntry {
        id: string;
        type: "Interview" | "Hiring" | "Evaluation" | "Termination";
        description: string;
        timestamp: string;
        addedByUserId: string;
        data: {
            date: string;
            comment: string;
            nextStep?: {
                name: string;
                date: string;
                responsibleEmployeeId: string;
            };
        };
    }

    interface Props {
        talentId: string;
        entries: TimelineEntry[];
        employees: { id: string, displayName: string }[];
        onAddEntry: (entry: any) => Promise<void>;
    }

    let { talentId, entries, employees, onAddEntry }: Props = $props();

    let isOpen = $state(false);
    let showAll = $state(false);

    const sortedEntries = $derived([...entries].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));

    const displayedEntries = $derived(showAll ? sortedEntries : sortedEntries.slice(0, 3));
    const hasMore = $derived(sortedEntries.length > 3);

    const typeIcons = {
        Interview: MessageCircle,
        Hiring: UserCheck,
        Evaluation: ClipboardCheck,
        Termination: UserMinus
    };

    const typeColors = {
        Interview: "bg-blue-100 text-blue-700 border-blue-200",
        Hiring: "bg-green-100 text-green-700 border-green-200",
        Evaluation: "bg-purple-100 text-purple-700 border-purple-200",
        Termination: "bg-red-100 text-red-700 border-red-200"
    };

</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900">Talent History</h3>
        <Button variant="outline" size="sm" onclick={() => isOpen = true} class="flex items-center gap-1">
            <Plus size={16} />
            <span>Add Entry</span>
        </Button>
    </div>

    {#if sortedEntries.length === 0}
        <div class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p class="text-sm text-gray-500">No history entries yet.</p>
        </div>
    {:else}
        <div class="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {#each displayedEntries as entry (entry.id)}
                {@const Icon = typeIcons[entry.type]}
                <div class="relative">
                    <div class="absolute -left-[31px] top-1 p-1 bg-white border-2 border-white rounded-full">
                        <div class="p-1.5 rounded-full {typeColors[entry.type]} shadow-sm">
                            <Icon size={14} />
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div class="px-4 py-3 bg-gray-50/50 border-b border-gray-50 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold uppercase tracking-wider">{entry.type}</span>
                                <span class="text-xs text-gray-400">•</span>
                                <span class="text-xs text-gray-500">{format(new Date(entry.data.date), "PPP")}</span>
                            </div>
                            <div class="flex items-center gap-1.5 text-xs text-gray-400">
                                <User size={12} />
                                <span>{entry.addedByUserId}</span>
                            </div>
                        </div>
                        
                        <div class="p-4 space-y-3">
                            {#if entry.description}
                                <p class="text-sm text-gray-600">{entry.description}</p>
                            {/if}
                            
                            {#if entry.data.comment}
                                <div class="bg-gray-50 rounded-lg p-3 flex gap-3">
                                    <MessageSquare size={16} class="text-gray-400 shrink-0 mt-0.5" />
                                    <p class="text-sm text-gray-700 italic">"{entry.data.comment}"</p>
                                </div>
                            {/if}

                            {#if entry.data.nextStep}
                                <div class="mt-4 pt-3 border-t border-gray-100">
                                    <div class="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-tight">
                                        <Calendar size={12} />
                                        <span>Next Step</span>
                                    </div>
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                        <div>
                                            <p class="text-sm font-medium text-indigo-900">{entry.data.nextStep.name}</p>
                                            <p class="text-xs text-indigo-700">{format(new Date(entry.data.nextStep.date), "PPP")}</p>
                                        </div>
                                        <div class="flex items-center gap-1.5 text-xs text-indigo-600 bg-white px-2 py-1 rounded border border-indigo-100">
                                            <User size={12} />
                                            <span>{employees.find(e => e.id === entry.data.nextStep?.responsibleEmployeeId)?.displayName || entry.data.nextStep.responsibleEmployeeId}</span>
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}

            {#if hasMore}
                <div class="flex justify-center pt-2">
                    <Button variant="ghost" size="sm" onclick={() => showAll = !showAll} class="text-gray-500 hover:text-gray-900">
                        {#if showAll}
                            <ChevronUp size={16} class="mr-1" />
                            <span>Show Recent Only</span>
                        {:else}
                            <ChevronDown size={16} class="mr-1" />
                            <span>Show All History ({sortedEntries.length})</span>
                        {/if}
                    </Button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<TimelineEntryDialog 
    bind:open={isOpen}
    {talentId}
    {employees}
    onSave={onAddEntry}
/>
