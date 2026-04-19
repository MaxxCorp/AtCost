<script lang="ts">
    import { listTimeOffRequests, requestTimeOff } from "./time-off.remote";
    import { EntityManager, Button, AsyncButton } from "@ac/ui";
    import { Plane, Calendar, Clock, CheckCircle2, XCircle, Timer, Trash2, Plus } from "@lucide/svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { timeOffRequestSchema } from "@ac/validations";
    import { authClient } from "$lib/auth";
    import { onMount } from "svelte";

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
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <EntityManager
                title="Time Off"
                icon={Plane}
                mode="standalone"
                listItemsRemote={listTimeOffRequests as any}
                loadingLabel="Checking balances..."
                noItemsFoundLabel="No leave requests found."
                searchPredicate={(req: TimeOffRequest, q: string) => 
                    (req.reason?.toLowerCase().includes(q.toLowerCase()) ?? false) ||
                    req.type.toLowerCase().includes(q.toLowerCase())
                }
            >
                {#snippet renderListItem(req: TimeOffRequest, { isSelected, toggleSelection })}
                    {@const status = statusMap[req.status] || statusMap.pending}
                    <div class="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:border-amber-200 transition-all duration-300">
                        <div class="flex flex-col sm:flex-row items-start justify-between gap-6">
                            <div class="flex items-start gap-4 flex-1">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onchange={() => toggleSelection(req.id)}
                                    class="w-5 h-5 mt-1 text-amber-600 rounded-lg border-gray-300 focus:ring-amber-500"
                                />
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
                                >
                                    <Trash2 size={16} class="mr-2" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                {/snippet}

                {#snippet renderForm({ remoteFunction, onSuccess, onCancel, initialData })}
                    <div class="p-6 space-y-6">
                        <div class="space-y-2">
                            <h2 class="text-2xl font-black tracking-tight">New Leave Request</h2>
                            <p class="text-sm text-gray-500">Submit your request for time off. Your manager will be notified.</p>
                        </div>

                        <form 
                            {...remoteFunction.preflight(timeOffRequestSchema).enhance(async ({ submit }: { submit: any }) => {
                                const res = await submit();
                                if (res.success) onSuccess(res);
                            })}
                            class="space-y-4"
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
                                        <option value="vacation">Vacation</option>
                                        <option value="sick">Sick Leave</option>
                                        <option value="unpaid">Unpaid Leave</option>
                                        <option value="other">Other</option>
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

                            <div class="flex gap-3 pt-4">
                                <AsyncButton 
                                    type="submit" 
                                    class="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg shadow-amber-200"
                                    loading={remoteFunction.loading}
                                    loadingLabel="Submitting..."
                                >
                                    Submit Request
                                </AsyncButton>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    class="px-6 border-gray-200 font-bold rounded-xl"
                                    onclick={onCancel}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </div>
                {/snippet}
            </EntityManager>
        </div>
    </div>
</div>
