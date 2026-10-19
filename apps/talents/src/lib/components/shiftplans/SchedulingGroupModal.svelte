<script lang="ts">
    import { createSchedulingGroup, updateSchedulingGroup, deleteSchedulingGroup } from "../../../routes/shiftplans/shifts.remote";
    import type { SchedulingGroupDetail } from "@ac/validations";
    import { Button, AsyncButton, highlightAndScrollToElement } from "@ac/ui";
    import { X, Layers, Trash2, Check, AlertTriangle, Building2, Tag } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    interface Props {
        isOpen: boolean;
        group?: SchedulingGroupDetail | null;
        locations?: Array<{ id: string; name: string }>;
        onclose: () => void;
        onSuccess: () => void;
    }

    let {
        isOpen = $bindable(),
        group = null,
        locations = [],
        onclose,
        onSuccess,
    }: Props = $props();

    const isEditing = $derived(!!group);

    // svelte-ignore state_referenced_locally
    let name = $state(group?.name ?? "");
    // svelte-ignore state_referenced_locally
    let code = $state(group?.code ?? "");
    // svelte-ignore state_referenced_locally
    let color = $state(group?.color ?? "purple");
    // svelte-ignore state_referenced_locally
    let locationId = $state<string | null>(group?.locationId ?? null);

    let isSaving = $state(false);
    let isDeleting = $state(false);
    let showDeleteConfirm = $state(false);

    const colorOptions = [
        { id: "purple", label: "Purple", bg: "bg-purple-500", border: "border-purple-500" },
        { id: "blue", label: "Blue", bg: "bg-blue-500", border: "border-blue-500" },
        { id: "green", label: "Emerald", bg: "bg-emerald-500", border: "border-emerald-500" },
        { id: "yellow", label: "Amber", bg: "bg-amber-500", border: "border-amber-500" },
        { id: "pink", label: "Pink", bg: "bg-pink-500", border: "border-pink-500" },
        { id: "darkBlue", label: "Indigo", bg: "bg-indigo-600", border: "border-indigo-600" },
        { id: "darkGreen", label: "Teal", bg: "bg-teal-600", border: "border-teal-600" },
        { id: "darkPurple", label: "Fuchsia", bg: "bg-fuchsia-600", border: "border-fuchsia-600" },
        { id: "darkYellow", label: "Orange", bg: "bg-orange-500", border: "border-orange-500" },
        { id: "gray", label: "Slate", bg: "bg-slate-500", border: "border-slate-500" },
    ];

    async function handleSave() {
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error("Group name is required");
            const input = document.getElementById("group-name-input");
            if (input) {
                highlightAndScrollToElement(input);
            }
            return;
        }

        isSaving = true;
        try {
            if (isEditing && group) {
                await updateSchedulingGroup({
                    id: group.id,
                    name: trimmedName,
                    code: code.trim() ? code.trim().toUpperCase() : null,
                    color,
                    locationId: locationId || null,
                });
                toast.success(`Scheduling group "${trimmedName}" updated`);
            } else {
                await createSchedulingGroup({
                    name: trimmedName,
                    code: code.trim() ? code.trim().toUpperCase() : null,
                    color,
                    locationId: locationId || null,
                });
                toast.success(`Scheduling group "${trimmedName}" created`);
            }
            onSuccess();
            onclose();
        } catch (error: any) {
            toast.error(error?.message || "Failed to save scheduling group");
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!group) return;

        isDeleting = true;
        try {
            await deleteSchedulingGroup({ id: group.id });
            toast.success(`Scheduling group "${group.name}" deleted`);
            onSuccess();
            onclose();
        } catch (error: any) {
            toast.error(error?.message || "Failed to delete scheduling group");
        } finally {
            isDeleting = false;
        }
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <!-- Modal Header -->
            <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/70 to-indigo-50/70">
                <div class="flex items-center gap-3">
                    <div class="p-2.5 bg-purple-100 text-purple-700 rounded-2xl shadow-xs">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900 tracking-tight">
                            {isEditing ? "Edit Scheduling Group" : "New Scheduling Group"}
                        </h2>
                        <p class="text-xs text-gray-500 font-medium">
                            {isEditing ? "Update group details or remove this group." : "Organize shifts and team members by department or role."}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onclick={onclose}
                    class="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                    aria-label="Close dialog"
                >
                    <X size={18} />
                </button>
            </div>

            <!-- Form Content -->
            <form onsubmit={(e) => { e.preventDefault(); void handleSave(); }} class="p-6 space-y-5">
                <!-- Group Name -->
                <div>
                    <label for="group-name-input" class="block text-xs font-bold text-gray-700 mb-1.5">
                        Group Name <span class="text-red-500">*</span>
                    </label>
                    <input
                        id="group-name-input"
                        type="text"
                        placeholder="e.g. Front of House, Kitchen, Bar, Supervisors"
                        bind:value={name}
                        required
                        class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                    />
                </div>

                <!-- Short Code & Location -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label for="group-code-input" class="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                            <Tag size={13} class="text-gray-400" />
                            Short Code (Optional)
                        </label>
                        <input
                            id="group-code-input"
                            type="text"
                            placeholder="e.g. FOH, KIT, BAR"
                            maxlength={8}
                            bind:value={code}
                            class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold uppercase focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                        />
                        <p class="text-[10px] text-gray-400 font-medium mt-1">Displayed as a badge in schedule headers.</p>
                    </div>

                    <div>
                        <label for="group-location-input" class="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                            <Building2 size={13} class="text-gray-400" />
                            Location (Optional)
                        </label>
                        <select
                            id="group-location-input"
                            bind:value={locationId}
                            class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all text-gray-800"
                        >
                            <option value={null}>All Locations</option>
                            {#each locations as loc (loc.id)}
                                <option value={loc.id}>{loc.name}</option>
                            {/each}
                        </select>
                        <p class="text-[10px] text-gray-400 font-medium mt-1">Leave empty to use across all venues.</p>
                    </div>
                </div>

                <!-- Theme Color Palette -->
                <div>
                    <span class="block text-xs font-bold text-gray-700 mb-2">Theme Color</span>
                    <div class="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {#each colorOptions as opt (opt.id)}
                            {@const isSelected = color === opt.id}
                            <button
                                type="button"
                                onclick={() => color = opt.id}
                                title={opt.label}
                                class={[
                                    "h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer relative shadow-2xs",
                                    opt.bg,
                                    isSelected ? "ring-2 ring-offset-2 ring-purple-600 scale-105" : "hover:opacity-90 opacity-80"
                                ]}
                            >
                                {#if isSelected}
                                    <Check size={14} class="text-white drop-shadow-xs" />
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Delete Confirmation Box (if editing and confirmed) -->
                {#if isEditing && showDeleteConfirm}
                    <div class="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-2.5 animate-in fade-in duration-100">
                        <div class="flex items-start gap-2 text-red-800 text-xs font-medium">
                            <AlertTriangle size={16} class="text-red-500 shrink-0 mt-0.5" />
                            <span>
                                Are you sure you want to delete <strong>{group?.name}</strong>? Existing shifts in this group will not be deleted, but will become unassigned from this group.
                            </span>
                        </div>
                        <div class="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onclick={() => showDeleteConfirm = false}
                                class="text-xs text-gray-600 hover:text-gray-900"
                            >
                                Cancel
                            </Button>
                            <AsyncButton
                                size="sm"
                                type="button"
                                onclick={handleDelete}
                                loading={isDeleting}
                                class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs"
                            >
                                Confirm Delete
                            </AsyncButton>
                        </div>
                    </div>
                {/if}

                <!-- Modal Actions -->
                <div class="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div>
                        {#if isEditing && !showDeleteConfirm}
                            <button
                                type="button"
                                onclick={() => showDeleteConfirm = true}
                                class="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1.5 p-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                            >
                                <Trash2 size={14} />
                                Delete Group
                            </button>
                        {/if}
                    </div>

                    <div class="flex items-center gap-2">
                        <Button
                            variant="outline"
                            type="button"
                            onclick={onclose}
                            class="text-xs font-bold px-4 py-2 rounded-xl text-gray-600 border-gray-200 hover:bg-gray-50"
                        >
                            Cancel
                        </Button>
                        <AsyncButton
                            type="submit"
                            loading={isSaving}
                            class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-xs"
                        >
                            {isEditing ? "Save Changes" : "Create Group"}
                        </AsyncButton>
                    </div>
                </div>
            </form>
        </div>
    </div>
{/if}
