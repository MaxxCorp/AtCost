<script lang="ts">
    import * as Dialog from "#lib/components/ui/dialog/index.js";
    import { Button } from "#lib/components/ui/button/index.js";
    import AsyncButton from "#lib/components/ui/AsyncButton.svelte";
    import { listEventRoles } from "../../../routes/event-roles/list.remote.js";
    import { createEventRole } from "../../../routes/event-roles/new/create.remote.js";
    import { updateEventRole } from "../../../routes/event-roles/[id]/update.remote.js";
    import { deleteEventRole } from "../../../routes/event-roles/[id]/delete.remote.js";
    import type { EventRole } from "@ac/validations";
    import { toast } from "svelte-sonner";
    import * as m from "#lib/paraglide/messages.js";
    import {
        Plus,
        Pencil,
        Trash2,
        Check,
        X,
        Shield,
        Loader2
    } from "@lucide/svelte";

    interface Props {
        open?: boolean;
        onclose?: () => void;
    }

    let { open = $bindable(false), onclose }: Props = $props();

    // Color options for role badges
    const COLOR_OPTIONS = [
        { id: "blue", label: "Blue", bg: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
        { id: "indigo", label: "Indigo", bg: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
        { id: "purple", label: "Purple", bg: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500" },
        { id: "rose", label: "Rose", bg: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
        { id: "amber", label: "Amber", bg: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
        { id: "emerald", label: "Emerald", bg: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
        { id: "cyan", label: "Cyan", bg: "bg-cyan-100 text-cyan-800 border-cyan-200", dot: "bg-cyan-500" },
        { id: "slate", label: "Slate", bg: "bg-slate-100 text-slate-800 border-slate-200", dot: "bg-slate-500" },
    ];

    // Form state for creating a new role
    let isCreating = $state(false);
    let newName = $state("");
    let newColor = $state("blue");
    let newDescription = $state("");
    let createLoading = $state(false);

    // Editing state
    let editingId = $state<string | null>(null);
    let editName = $state("");
    let editColor = $state("blue");
    let editDescription = $state("");
    let editLoading = $state(false);

    // Deleting state
    let deletingId = $state<string | null>(null);

    function resetNewForm() {
        isCreating = false;
        newName = "";
        newColor = "blue";
        newDescription = "";
    }

    function startEdit(role: EventRole) {
        editingId = role.id;
        editName = role.name;
        editColor = role.color || "blue";
        editDescription = role.description || "";
    }

    function cancelEdit() {
        editingId = null;
        editName = "";
        editColor = "blue";
        editDescription = "";
    }

    async function handleCreate() {
        if (!newName.trim()) return;
        createLoading = true;
        try {
            await createEventRole({
                name: newName.trim(),
                color: newColor,
                description: newDescription.trim() || undefined
            });
            toast.success(m.role_created?.() ?? "Role created successfully");
            resetNewForm();
        } catch (err: any) {
            toast.error(err?.message || "Failed to create role");
        } finally {
            createLoading = false;
        }
    }

    async function handleUpdate(id: string) {
        if (!editName.trim()) return;
        editLoading = true;
        try {
            await updateEventRole({
                id,
                name: editName.trim(),
                color: editColor,
                description: editDescription.trim() || undefined
            });
            toast.success(m.role_updated?.() ?? "Role updated successfully");
            cancelEdit();
        } catch (err: any) {
            toast.error(err?.message || "Failed to update role");
        } finally {
            editLoading = false;
        }
    }

    async function handleDelete(id: string) {
        if (!confirm(m.confirm_delete_role?.() ?? "Are you sure you want to delete this role?")) return;
        deletingId = id;
        try {
            await deleteEventRole({ id });
            toast.success(m.role_deleted?.() ?? "Role deleted successfully");
        } catch (err: any) {
            toast.error(err?.message || "Failed to delete role");
        } finally {
            deletingId = null;
        }
    }

    function getRoleLabel(roleName?: string | null) {
        if (!roleName) return "";
        const key = roleName.trim().toLowerCase();
        if (key === "main contact" || key === "maincontact") return m.main_contact?.() ?? roleName;
        if (key === "project manager" || key === "projectmanager") return m.project_manager?.() ?? roleName;
        if (key === "participant") return m.participant?.() ?? roleName;
        return roleName;
    }
</script>

<Dialog.Root bind:open onOpenChange={(val) => { if (!val) onclose?.(); }}>
    <Dialog.Content class="max-w-xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <Dialog.Header class="pb-3 border-b border-gray-100">
            <div class="flex items-center gap-2">
                <div class="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Shield size={20} />
                </div>
                <div>
                    <Dialog.Title class="text-lg font-bold text-gray-900">
                        {m.manage_roles?.() ?? "Manage Roles"}
                    </Dialog.Title>
                    <Dialog.Description class="text-xs text-gray-500">
                        {m.roles_description?.() ?? "Define and manage contact roles for events"}
                    </Dialog.Description>
                </div>
            </div>
        </Dialog.Header>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <!-- Add New Role Form / Button -->
            {#if !isCreating}
                <button
                    type="button"
                    class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 text-sm font-semibold text-gray-700 hover:text-blue-600 transition-all cursor-pointer"
                    onclick={() => (isCreating = true)}
                >
                    <Plus size={16} />
                    <span>{m.create_role?.() ?? "Create Role"}</span>
                </button>
            {:else}
                <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold uppercase tracking-wider text-gray-700">
                            {m.create_role?.() ?? "Create Role"}
                        </span>
                        <button
                            type="button"
                            class="text-gray-400 hover:text-gray-600 p-1"
                            onclick={resetNewForm}
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <div>
                        <label for="new-role-name" class="block text-xs font-medium text-gray-700 mb-1">
                            {m.role_name?.() ?? "Role Name"}
                        </label>
                        <input
                            id="new-role-name"
                            type="text"
                            bind:value={newName}
                            placeholder="e.g. Speaker, Moderator, Sponsor..."
                            class="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreate(); } }}
                        />
                    </div>

                    <!-- Color Picker Swatches -->
                    <div>
                        <span class="block text-xs font-medium text-gray-700 mb-1.5">
                            {m.role_color?.() ?? "Color"}
                        </span>
                        <div class="flex flex-wrap gap-2">
                            {#each COLOR_OPTIONS as opt (opt.id)}
                                <button
                                    type="button"
                                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer {opt.bg} {newColor === opt.id ? 'ring-2 ring-blue-500 ring-offset-1 font-bold' : 'opacity-70 hover:opacity-100'}"
                                    onclick={() => (newColor = opt.id)}
                                >
                                    <span class="w-2 h-2 rounded-full {opt.dot}"></span>
                                    <span>{opt.label}</span>
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" size="sm" onclick={resetNewForm}>
                            {m.cancel?.() ?? "Cancel"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!newName.trim() || createLoading}
                            onclick={handleCreate}
                        >
                            {#if createLoading}
                                <Loader2 size={14} class="animate-spin mr-1" />
                            {/if}
                            {m.save?.() ?? "Save"}
                        </Button>
                    </div>
                </div>
            {/if}

            <!-- Existing Roles List -->
            <div class="space-y-2">
                {#await listEventRoles()}
                    <div class="py-8 flex justify-center text-gray-400">
                        <Loader2 class="animate-spin" size={20} />
                    </div>
                {:then res}
                    {@const roles = res.data || []}
                    {#if roles.length === 0}
                        <div class="py-8 text-center text-sm text-gray-400">
                            {m.no_roles?.() ?? "No roles defined yet."}
                        </div>
                    {:else}
                        {#each roles as role (role.id)}
                            {@const colorOpt = COLOR_OPTIONS.find((c) => c.id === role.color) || COLOR_OPTIONS[0]}
                            {#if editingId === role.id}
                                <div class="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5">
                                    <div class="flex items-center gap-2">
                                        <input
                                            type="text"
                                            bind:value={editName}
                                            class="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleUpdate(role.id); } }}
                                        />
                                    </div>
                                    <div class="flex flex-wrap gap-1.5">
                                        {#each COLOR_OPTIONS as opt (opt.id)}
                                            <button
                                                type="button"
                                                class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-all cursor-pointer {opt.bg} {editColor === opt.id ? 'ring-2 ring-blue-500 ring-offset-1 font-bold' : 'opacity-60 hover:opacity-100'}"
                                                onclick={() => (editColor = opt.id)}
                                            >
                                                <span class="w-1.5 h-1.5 rounded-full {opt.dot}"></span>
                                                <span>{opt.label}</span>
                                            </button>
                                        {/each}
                                    </div>
                                    <div class="flex justify-end gap-2 pt-1">
                                        <Button type="button" variant="ghost" size="sm" onclick={cancelEdit}>
                                            <X size={14} class="mr-1" />
                                            {m.cancel?.() ?? "Cancel"}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={!editName.trim() || editLoading}
                                            onclick={() => handleUpdate(role.id)}
                                        >
                                            {#if editLoading}
                                                <Loader2 size={14} class="animate-spin mr-1" />
                                            {:else}
                                                <Check size={14} class="mr-1" />
                                            {/if}
                                            {m.save?.() ?? "Save"}
                                        </Button>
                                    </div>
                                </div>
                            {:else}
                                <div class="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all group">
                                    <div class="flex items-center gap-2.5 min-w-0">
                                        <span class="px-2.5 py-0.5 rounded-md text-xs font-semibold border inline-flex items-center gap-1.5 {colorOpt.bg}">
                                            <span class="w-1.5 h-1.5 rounded-full {colorOpt.dot}"></span>
                                            <span class="truncate">{getRoleLabel(role.name)}</span>
                                        </span>
                                        {#if role.isDefault}
                                            <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                                (Default)
                                            </span>
                                        {/if}
                                    </div>

                                    <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                        <button
                                            type="button"
                                            class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            title={m.edit?.() ?? "Edit"}
                                            onclick={() => startEdit(role)}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                            title={m.delete?.() ?? "Delete"}
                                            disabled={deletingId === role.id}
                                            onclick={() => handleDelete(role.id)}
                                        >
                                            {#if deletingId === role.id}
                                                <Loader2 size={14} class="animate-spin text-red-500" />
                                            {:else}
                                                <Trash2 size={14} />
                                            {/if}
                                        </button>
                                    </div>
                                </div>
                            {/if}
                        {/each}
                    {/if}
                {:catch err}
                    <div class="py-4 text-center text-xs text-red-500">
                        {err?.message || "Failed to load roles"}
                    </div>
                {/await}
            </div>
        </div>

        <Dialog.Footer class="pt-3 border-t border-gray-100">
            <Button
                type="button"
                variant="secondary"
                onclick={() => { open = false; onclose?.(); }}
            >
                {m.close?.() ?? "Close"}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
