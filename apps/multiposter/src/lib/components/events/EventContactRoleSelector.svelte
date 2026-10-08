<script lang="ts">
    import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
    import { listEventRoles } from "../../../routes/event-roles/list.remote.js";
    import { updateContactRoles } from "../../../routes/contacts/associate.remote.js";
    import type { EventRole } from "@ac/validations";
    import { toast } from "svelte-sonner";
    import * as m from "#lib/paraglide/messages.js";
    import { Plus, Check, Settings, Loader2 } from "@lucide/svelte";

    interface Props {
        contact: any;
        eventId?: string;
        selectedRoleIds?: string[];
        onchange?: (roleIds: string[], roles: EventRole[]) => void;
        onopenManager?: () => void;
    }

    let {
        contact,
        eventId,
        selectedRoleIds = $bindable([]),
        onchange,
        onopenManager
    }: Props = $props();

    // Map role color id to styling
    const COLOR_CLASSES: Record<string, { bg: string; dot: string }> = {
        blue: { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
        indigo: { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
        purple: { bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
        rose: { bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
        amber: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
        emerald: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
        cyan: { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
        slate: { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
    };

    function getColorClass(color?: string | null) {
        return COLOR_CLASSES[color || "blue"] || COLOR_CLASSES.blue;
    }

    let activeRoleIds = $derived(
        selectedRoleIds && selectedRoleIds.length > 0
            ? selectedRoleIds
            : (Array.isArray(contact?.roles)
                ? contact.roles.map((r: any) => r.id || r)
                : [])
    );

    let isUpdating = $state(false);

    async function toggleRole(role: EventRole, allRoles: EventRole[]) {
        const id = role.id;
        const currentIds = activeRoleIds;
        let newIds: string[];
        if (currentIds.includes(id)) {
            newIds = currentIds.filter((rId: string) => rId !== id);
        } else {
            newIds = [...currentIds, id];
        }

        selectedRoleIds = newIds;
        const newRoles = allRoles.filter((r) => newIds.includes(r.id));
        onchange?.(newIds, newRoles);

        if (eventId && contact?.id) {
            isUpdating = true;
            try {
                await updateContactRoles({
                    eventId,
                    contactId: contact.id,
                    roleIds: newIds
                });
            } catch (err: any) {
                toast.error(err?.message || "Failed to update roles");
            } finally {
                isUpdating = false;
            }
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

<div class="inline-flex items-center gap-1.5 flex-wrap">
    {#await listEventRoles()}
        <div class="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Loader2 size={12} class="animate-spin" />
        </div>
    {:then rolesResult}
        {@const allRoles = rolesResult.data || []}
        {@const assigned = allRoles.filter((r) => activeRoleIds.includes(r.id))}

        <!-- Render Assigned Role Badges -->
        {#each assigned as role (role.id)}
            {@const style = getColorClass(role.color)}
            <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border {style.bg}"
            >
                <span class="w-1.5 h-1.5 rounded-full {style.dot}"></span>
                <span>{getRoleLabel(role.name)}</span>
            </span>
        {/each}

        <!-- Dropdown to Add / Toggle Roles -->
        <DropdownMenu.Root>
            <DropdownMenu.Trigger class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
                {#if isUpdating}
                    <Loader2 size={11} class="animate-spin text-blue-600" />
                {:else}
                    <Plus size={11} />
                {/if}
                <span>{assigned.length === 0 ? (m.add_role?.() ?? "Add Role") : (m.roles?.() ?? "Roles")}</span>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content align="start" class="w-56 p-1.5">
                <DropdownMenu.Label class="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                    {m.roles?.() ?? "Roles"}
                </DropdownMenu.Label>

                {#if allRoles.length === 0}
                    <div class="px-2 py-2 text-xs text-gray-400 text-center">
                        {m.no_roles?.() ?? "No roles defined"}
                    </div>
                {:else}
                    <div class="space-y-0.5">
                        {#each allRoles as role (role.id)}
                            {@const isSelected = activeRoleIds.includes(role.id)}
                            {@const style = getColorClass(role.color)}
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-gray-100 transition-colors cursor-pointer text-left {isSelected ? 'bg-blue-50/60 font-semibold' : ''}"
                                onclick={(e) => {
                                    e.preventDefault();
                                    void toggleRole(role, allRoles);
                                }}
                            >
                                <div class="flex items-center gap-2 truncate">
                                    <span class="w-2 h-2 rounded-full shrink-0 {style.dot}"></span>
                                    <span class="truncate">{getRoleLabel(role.name)}</span>
                                </div>
                                {#if isSelected}
                                    <Check size={14} class="text-blue-600 shrink-0" />
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}

                {#if onopenManager}
                    <DropdownMenu.Separator class="my-1" />
                    <button
                        type="button"
                        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer text-left"
                        onclick={(e) => {
                            e.preventDefault();
                            onopenManager?.();
                        }}
                    >
                        <Settings size={13} />
                        <span>{m.manage_roles?.() ?? "Manage Roles..."}</span>
                    </button>
                {/if}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    {:catch}
        <!-- Fallback if error loading roles -->
    {/await}
</div>
