<script lang="ts">
    import { 
        User, 
        UserPlus as UserPlusIcon, 
        Search, 
        Filter, 
        Edit2, 
        Trash2, 
        MoreVertical, 
        ExternalLink,
        CheckCircle2,
        Clock,
        Archive
    } from "@lucide/svelte";
    import { listTalents, deleteTalent, bulkDeleteTalents, listTags } from "./talents.remote";
    import { listLocations } from "../locations/list.remote";
    import { toast } from "svelte-sonner";
    import { Button, AsyncButton, EntityManager } from "@ac/ui";

    type Talent = Awaited<ReturnType<typeof listTalents>>["data"][number];

    let stats = $state({ total: 0, applicants: 0, active: 0 });

    function updateStats(talents: Talent[]) {
        stats = {
            total: talents.length,
            applicants: talents.filter((t: any) => t.status === 'applicant').length,
            active: talents.filter((t: any) => t.status === 'active').length,
        };
    }
</script>

<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
            <h1 class="text-4xl font-black text-gray-900 tracking-tight">Talents</h1>
            <p class="text-gray-500 mt-1 font-medium italic">
                Strategic recruitment pipeline and professional network
            </p>
        </div>
    </div>

    <!-- Stats Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Pipeline</p>
            <p class="text-3xl font-black text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div class="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-sm">
            <p class="text-xs font-bold text-indigo-400 uppercase tracking-widest">Active Applicants</p>
            <p class="text-3xl font-black text-indigo-600 mt-1">{stats.applicants}</p>
        </div>
        <div class="bg-green-50/50 p-4 rounded-2xl border border-green-100 shadow-sm">
            <p class="text-xs font-bold text-green-400 uppercase tracking-widest">Active Talents</p>
            <p class="text-3xl font-black text-green-600 mt-1">{stats.active}</p>
        </div>
    </div>

    <div class="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
        <EntityManager
            title="Talent Management"
            icon={User}
            mode="standalone"
            listItemsRemote={listTalents as any}
            filterAssociations={[
                {
                    id: "locationId",
                    label: "Locations",
                    listRemote: listLocations as any,
                    getOptionLabel: (l: any) => l.name,
                },
                {
                    id: "tagId",
                    label: "Tags",
                    listRemote: listTags as any,
                    getOptionLabel: (t: any) => t.name,
                },
            ]}
            filters={[
                {
                    id: "status",
                    label: "Status",
                    type: "select",
                    options: [
                        { value: "active", label: "Active" },
                        { value: "applicant", label: "Applicant" },
                        { value: "inactive", label: "Inactive" },
                    ],
                    optionsRemote: async () => [],
                }
            ]}
            deleteItemRemote={async (ids: string[]) => {
                if (ids.length === 1) {
                    const res = await deleteTalent(ids[0]);
                    return res.success;
                }
                const res = await bulkDeleteTalents(ids);
                return res.success;
            }}
            createHref="/talents/new"
            createLabel="Create Talent"
            loadingLabel="Loading talents..."
            noItemsFoundLabel="No talents discovered in your network yet."
            searchPredicate={(t: Talent, q: string) => 
                t.contact?.displayName?.toLowerCase().includes(q.toLowerCase()) ||
                t.jobTitle?.toLowerCase().includes(q.toLowerCase())
            }
        >
            {#snippet renderListItem(talent: Talent, { isSelected, toggleSelection, deleteItem })}
                <div class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6 transition-all hover:shadow-lg hover:border-indigo-100 group">
                    <div class="flex items-center gap-4 flex-1 w-full">
                        <input 
                            type="checkbox" 
                            checked={isSelected}
                            onchange={() => toggleSelection(talent.id)}
                            class="rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                        />
                        
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg border border-indigo-200 shrink-0">
                            {talent.contact?.displayName?.charAt(0) || "U"}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <a href="/talents/{talent.id}" class="font-black text-gray-900 hover:text-indigo-600 transition-colors text-lg truncate block">
                                    {talent.contact?.displayName}
                                </a>
                                
                                {#if talent.status === 'active'}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-100">
                                        <CheckCircle2 size={10} /> Active
                                    </span>
                                {:else if talent.status === 'applicant'}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                                        <Clock size={10} /> Applicant
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 text-[10px] font-bold uppercase tracking-wider border border-gray-100">
                                        <Archive size={10} /> Inactive
                                    </span>
                                {/if}
                            </div>
                            
                            <p class="text-sm font-bold text-indigo-600 italic mb-1">{talent.jobTitle || "Professional Talent"}</p>
                            <p class="text-xs text-gray-400 font-medium">{talent.contact?.emails?.[0]?.value || "No contact email provided"}</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap md:flex-nowrap items-center gap-4 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-gray-50">
                        <div class="flex-1 md:flex-initial">
                            {#if talent.linkedUser}
                                <div class="flex flex-col">
                                    <span class="text-[10px] uppercase font-black text-gray-300 tracking-tighter mb-0.5">Linked Account</span>
                                    <span class="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                        <User size={12} class="text-indigo-400" /> {talent.linkedUser.name}
                                    </span>
                                </div>
                            {:else}
                                <span class="text-[10px] uppercase font-black text-gray-200 tracking-tighter">No Account Link</span>
                            {/if}
                        </div>

                        <div class="flex gap-2">
                            <Button 
                                href="/talents/{talent.id}" 
                                variant="ghost"
                                class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Edit Profile"
                            >
                                <Edit2 size={18} />
                            </Button>
                            <AsyncButton 
                                variant="ghost"
                                class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                onclick={() => deleteItem(talent)}
                                title="Remove Talent"
                            >
                                <Trash2 size={18} />
                            </AsyncButton>
                        </div>
                    </div>
                </div>
            {/snippet}
        </EntityManager>
    </div>
</div>
