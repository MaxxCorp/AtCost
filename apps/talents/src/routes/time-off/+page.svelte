<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { listTimeOffRequests, requestTimeOff } from "./time-off.remote";
    import { Button, AsyncButton } from "@ac/ui";
    import * as Dialog from "@ac/ui/components/dialog";
    import { Plane, Calendar, Clock, CheckCircle2, XCircle, Timer, Trash2, Plus, Search, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight } from "@lucide/svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { timeOffRequestSchema } from "@ac/validations";
    import { authClient } from "$lib/auth";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";

    breadcrumbState.set({ feature: "time-off" });

    let userId = $state<string | null>(null);

    onMount(async () => {
        const session = await authClient.getSession();
        userId = session?.data?.user?.id || null;
    });

    type TimeOffRequest = Awaited<ReturnType<typeof listTimeOffRequests>>["data"][number];

    const statusMap: Record<string, { label: string, color: string, icon: any }> = {
        pending: { label: "Pending", color: "text-amber-600 bg-amber-50 border-amber-100", icon: Timer },
        approved: { label: "Approved", color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
        rejected: { label: "Rejected", color: "text-rose-600 bg-rose-50 border-rose-100", icon: XCircle },
    };

    let searchQuery = $state("");
    let page = $state(1);
    let limit = $state(50);
    let showQuickCreate = $state(false);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery,
    });

    // TODO: implement actual cancel API if there's one. For now just toast a message.
    async function cancelRequest(req: TimeOffRequest) {
        toast.info("Cancel request not implemented natively yet");
    }

</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-5xl mx-auto space-y-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                    <Plane class="text-amber-500" size={32} />
                    Time Off Requests
                </h1>
                <p class="text-gray-500 mt-1">Request leave and manage your absence history.</p>
            </div>
            <Button onclick={() => (showQuickCreate = true)} class="w-full md:w-auto shadow-sm">
                <Plus class="w-4 h-4 mr-2" />
                New Request
            </Button>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h1 class="text-2xl font-black mb-6 text-gray-900 px-1">Time Off Requests</h1>

            <!-- Action Bar -->
            <div class="flex flex-col md:flex-row gap-3 mb-6">
                <div class="relative flex-1">
                    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={m.search_requests()}
                        bind:value={searchQuery}
                        oninput={() => (page = 1)}
                        class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all bg-gray-50/50"
                    />
                </div>
            </div>

            <!-- Main List -->
            <svelte:boundary>
                {#if $effect.pending()}
                    <div class="py-12 text-center text-gray-500">Loading...</div>
                {/if}
                <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
                    <div class="grid grid-cols-1 gap-5">
                        {#each (await listTimeOffRequests(filterState)).data || [] as req (req.id)}
                            {@const status = statusMap[req.status] || statusMap.pending}
                            <div class="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:border-amber-200 transition-all duration-300">
                                <div class="flex flex-col sm:flex-row items-start justify-between gap-6">
                                    <div class="flex items-start gap-4 flex-1">
                                        <div class="space-y-3 flex-1">
                                            <div class="flex items-center gap-3 flex-wrap">
                                                <h3 class="text-xl font-black text-gray-900 uppercase tracking-tighter">
                                                    {req.type}
                                                </h3>
                                                <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border {status.color}">
                                                    <status.icon size={12} />
                                                    {status.label}
                                                </div>
                                            </div>

                                            <div class="flex items-center gap-6 text-sm text-gray-500 font-medium">
                                                <div class="flex items-center gap-2">
                                                    <Calendar size={16} class="text-amber-400" />
                                                    <span>{new Date(req.startDate).toLocaleDateString()} — {new Date(req.endDate).toLocaleDateString()}</span>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <Clock size={16} class="text-amber-400" />
                                                    <span>
                                                        {Math.ceil((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} Days
                                                    </span>
                                                </div>
                                            </div>

                                            {#if req.reason}
                                                <p class="text-gray-600 text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 italic">
                                                    "{req.reason}"
                                                </p>
                                            {/if}
                                        </div>
                                    </div>

                                    <div class="shrink-0 flex sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <Button
                                            variant="ghost"
                                            class="flex-1 sm:flex-none justify-start px-4 h-10 hover:bg-amber-50 hover:text-amber-600 rounded-xl"
                                            onclick={() => cancelRequest(req)}
                                        >
                                            <Trash2 size={16} class="mr-2" />
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="text-center py-12 bg-white rounded-xl border border-gray-100 col-span-full">
                                <Plane class="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <h3 class="text-lg font-medium text-gray-900">
                                    No leave requests found
                                </h3>
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    {#await listTimeOffRequests(filterState) then result}
                        {#if result && result.total > limit}
                            {@const totalPages = Math.ceil(result.total / limit)}
                            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100">
                                <div class="flex items-center gap-3 text-sm text-gray-500">
                                    <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, result.total)} of {result.total}</span>
                                    <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                        <select
                                            bind:value={limit}
                                            onchange={() => (page = 1)}
                                            class="text-xs bg-transparent border-gray-200 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
                                        >
                                            <option value={10}>{m.items_per_page({ count: 10 })}</option>
                                            <option value={20}>{m.items_per_page({ count: 20 })}</option>
                                            <option value={50}>{m.items_per_page({ count: 50 })}</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 sm:gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={page === 1}
                                        onclick={() => page = 1}
                                        class="h-9 w-9 border-gray-200 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                                    >
                                        <ChevronsLeft size={16} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onclick={() => page > 1 && page--}
                                        class="h-9 px-3 border-gray-200 shrink-0"
                                    >
                                        <ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
                                        Previous
                                    </Button>
                                    <div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700">
                                        <select
                                            bind:value={page}
                                            class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 rounded px-1 min-w-[2.5rem]"
                                        >
                                            {#each Array(totalPages) as _, i}
                                                <option value={i + 1}>{i + 1}</option>
                                            {/each}
                                        </select>
                                        <span class="text-gray-400">/ {totalPages}</span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === totalPages}
                                        onclick={() => page < totalPages && page++}
                                        class="h-9 px-3 border-gray-200 shrink-0"
                                    >
                                        Next
                                        <ArrowRight size={16} class="ml-1.5 hidden sm:block" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={page === totalPages}
                                        onclick={() => page = totalPages}
                                        class="h-9 w-9 border-gray-200 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                                    >
                                        <ChevronsRight size={16} />
                                    </Button>
                                </div>
                            </div>
                        {/if}
                    {/await}
                </div>
                {#snippet failed(error: unknown)}
                    <div class="py-12 text-center text-red-500">{error instanceof Error ? error.message : "Failed to load."}</div>
                {/snippet}
            </svelte:boundary>
        </div>
    </div>
</div>

<Dialog.Root bind:open={showQuickCreate}>
    <Dialog.Content class="sm:max-w-[600px]">
        <Dialog.Header>
            <Dialog.Title>New Leave Request</Dialog.Title>
        </Dialog.Header>
        
        <form 
            {...requestTimeOff.preflight(timeOffRequestSchema).enhance(async ({ submit }) => {
                const res = await submit();
                if (res) {
                    toast.success("Request submitted");
                    showQuickCreate = false;
                    listTimeOffRequests(filterState).refresh();
                }
            })}
            class="space-y-4 pt-4"
        >
            {#if userId}
                <input type="hidden" name="talentId" value={userId} />
            {/if}
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label for="type" class="text-xs font-black uppercase tracking-widest text-gray-400">Request Type</label>
                    <select 
                        name="type" 
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    >
                        <option value="vacation">{m.leave_vacation()}</option>
                        <option value="sick">{m.leave_sick()}</option>
                        <option value="unpaid">{m.leave_unpaid()}</option>
                        <option value="other">{m.leave_other()}</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label for="startDate" class="text-xs font-black uppercase tracking-widest text-gray-400">Start Date</label>
                    <input 
                        type="date" 
                        name="startDate" 
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
                    />
                </div>
                <div class="space-y-1.5">
                    <label for="endDate" class="text-xs font-black uppercase tracking-widest text-gray-400">End Date</label>
                    <input 
                        type="date" 
                        name="endDate" 
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
                    />
                </div>
            </div>

            <div class="space-y-1.5">
                <label for="reason" class="text-xs font-black uppercase tracking-widest text-gray-400">Reason / Notes</label>
                <textarea 
                    name="reason" 
                    rows="3"
                    class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                    placeholder="Briefly describe the reason for your request..."
                ></textarea>
            </div>

            <Dialog.Footer class="pt-4">
                <Button 
                    type="button" 
                    variant="outline" 
                    onclick={() => (showQuickCreate = false)}
                >
                    Cancel
                </Button>
                <AsyncButton 
                    type="submit" 
                    class="bg-amber-600 hover:bg-amber-700 text-white"
                    
                    
                >
                    Submit Request
                </AsyncButton>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
