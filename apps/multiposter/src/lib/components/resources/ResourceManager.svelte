<script module lang="ts">
    export interface Resource {
        id: string;
        [key: string]: any;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import {
        Search,
        Plus,
        Check,
        ExternalLink,
        X,
        Trash2,
        User,
        MapPin,
        Box,
    } from "@lucide/svelte";

    import { Button } from "@ac/ui";
    import AssociationPill from "../ui/associations/AssociationPill.svelte";
    import AssociationHeader from "../ui/associations/AssociationHeader.svelte";
    import AssociationList from "../ui/associations/AssociationList.svelte";
    import { toast } from "svelte-sonner";

    // Resource interface moved to module script

    // Generic Types
    // The Resource interface is now imported from the module script.
    // type Resource = {
    //     id: string;
    //     name?: string;
    //     displayName?: string; // Contact
    //     givenName?: string; // Contact
    //     familyName?: string; // Contact
    //     type?: string;
    //     [key: string]: any;
    // };

    interface Props {
        type: "contact" | "location";
        entityId?: string | null;
        remoteFunctions: {
            list: () => Promise<Resource[]>;
            create: any;
            update: any;
            delete: (ids: string[]) => Promise<any>;
            associate?: (params: any) => Promise<any>;
            dissociate?: (params: any) => Promise<any>;
            fetchAssociations?: (params: any) => Promise<Resource[]>;
            updateAssociation?: (params: any) => Promise<any>;
        };
        // We pass the Form component dynamically or use slots?
        // Slots are harder for the specific props needed by forms.
        // Better to pass the Component itself.
        FormComponent: any;
        schemas: {
            create: any;
            update: any;
        };
        value?: string[];
        onchange?: (ids: string[]) => void;
    }

    let {
        type,
        entityId = null,
        remoteFunctions,
        FormComponent,
        schemas,
        value = $bindable([]),
        onchange,
    }: Props = $props();

    // State
    let associatedResources = $state<Resource[]>([]);
    let allResources = $state<Resource[]>([]);

    let showSelector = $state(false);
    let showQuickCreate = $state(false);
    let searchQuery = $state("");
    let loadingSearch = $state(false);
    let editingResource = $state<Resource | null>(null);

    // Initial Load
    $effect(() => {
        if (entityId && remoteFunctions.fetchAssociations) {
            loadAssociations();
        }
    });

    // Sync value
    $effect(() => {
        if (!entityId) {
            // If no entityId, we are just maintaining a list of IDs (e.g. creating new parent)
            // We assume associatedResources are the "value"
            value = associatedResources.map((r) => r.id);
        }
    });

    async function loadAssociations() {
        if (!entityId || !remoteFunctions.fetchAssociations) return;
        try {
            // We rely on the passed fetchAssociations function to handle any specific params
            // (e.g. via closure in the parent component)
            associatedResources = await remoteFunctions.fetchAssociations({
                entityId,
            });
        } catch (e) {
            console.error("Failed to load associations", e);
        }
    }

    async function toggleSelector() {
        showSelector = !showSelector;
        if (showSelector && allResources.length === 0) {
            loadingSearch = true;
            try {
                allResources = await remoteFunctions.list();
            } catch (e) {
                console.error("Failed to list resources", e);
                toast.error("Failed to load list");
            }
            loadingSearch = false;
        }
    }

    // Helper to get name
    function getName(r: Resource) {
        if (type === "contact") {
            return (
                r.displayName ||
                `${r.givenName || ""} ${r.familyName || ""}`.trim() ||
                "Unnamed"
            );
        }
        return r.name || "Unnamed";
    }

    const filteredResources = $derived(
        allResources.filter((r) => {
            const name = getName(r).toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        }),
    );

    async function toggleAssociation(resource: Resource) {
        const isAssociated = associatedResources.some(
            (r) => r.id === resource.id,
        );

        try {
            if (isAssociated) {
                if (entityId && remoteFunctions.dissociate) {
                    await remoteFunctions.dissociate({
                        entityId,
                        resourceId: resource.id,
                    });
                }
                associatedResources = associatedResources.filter(
                    (r) => r.id !== resource.id,
                );
            } else {
                if (entityId && remoteFunctions.associate) {
                    await remoteFunctions.associate({
                        entityId,
                        resourceId: resource.id,
                    });
                }
                associatedResources = [...associatedResources, resource];
            }
            if (onchange) onchange(associatedResources.map((r) => r.id));
        } catch (error: any) {
            console.error("Association toggle failed", error);
            toast.error(error.message || "Failed to update association");
        }
    }

    async function handleSuccess(result: any) {
        // Standardize result extraction
        // We expect { success: true, data: Resource } or similar
        // Superforms returns { type: 'success', data: { [key]: Resource } }

        console.log("ResourceManager handleSuccess:", result);

        let resource: Resource | null = null;

        // Try standard locations
        if (result.type === "success" && result.data) {
            // Look for type-specific keys
            if (type === "contact")
                resource = result.data.contact || result.data.data?.contact;
            if (type === "location")
                resource = result.data.location || result.data.data?.location;

            // Or generic 'data' if strictly defined
            if (!resource && result.data.id) {
                // Maybe it IS the resource?
                if (type === "location" && result.data.name)
                    resource = result.data;
                if (
                    type === "contact" &&
                    (result.data.displayName || result.data.givenName)
                )
                    resource = result.data;
            }
        } else if (result.success && (result.contact || result.location)) {
            // Direct return (not via superforms enhance if manually fetched?)
            resource = result.contact || result.location;
        }

        if (!resource) {
            // Fallback: simple ID check?
            // Or re-fetch?
            toast.error(
                "Created but failed to retrieve details. Please select from list.",
            );
            return;
        }

        // Logic is same as toggleAssociation(add) but for a NEW item
        if (entityId && remoteFunctions.associate) {
            await remoteFunctions.associate({
                entityId,
                resourceId: resource.id,
            });
            // Refresh associations?
        }

        if (!associatedResources.some((r) => r.id === resource!.id)) {
            associatedResources = [...associatedResources, resource];
        }

        if (!allResources.some((r) => r.id === resource!.id)) {
            allResources = [resource, ...allResources];
        }

        if (editingResource) {
            // In-place update
            associatedResources = associatedResources.map((r) =>
                r.id === resource!.id ? resource! : r,
            );
            allResources = allResources.map((r) =>
                r.id === resource!.id ? resource! : r,
            );
            toast.success("Updated successfully");
            editingResource = null;
        } else {
            toast.success("Created and associated");
            showQuickCreate = false;
        }

        if (onchange) onchange(associatedResources.map((r) => r.id));
    }

    async function handleDelete(resource: Resource) {
        if (!confirm(`Delete ${getName(resource)}?`)) return;
        try {
            await remoteFunctions.delete([resource.id]);
            associatedResources = associatedResources.filter(
                (r) => r.id !== resource.id,
            );
            allResources = allResources.filter((r) => r.id !== resource.id);
            toast.success("Deleted");
            if (onchange) onchange(associatedResources.map((r) => r.id));
        } catch (e: any) {
            toast.error(e.message || "Failed to delete");
        }
    }

    // Icons
    let Icon = $derived(type === "contact" ? User : MapPin);
    let Title = $derived(type === "contact" ? "Contacts" : "Locations");
</script>

<div class="space-y-4 border rounded-lg p-4 bg-gray-50">
    <AssociationHeader
        title={Title}
        icon={Icon}
        {showSelector}
        {showQuickCreate}
        onToggleSelector={toggleSelector}
        onToggleQuickCreate={() => {
            showQuickCreate = !showQuickCreate;
            editingResource = null;
        }}
    />

    <AssociationList
        itemCount={associatedResources.length}
        emptyMessage={`No ${type}s associated.`}
        {showSelector}
        {showQuickCreate}
    >
        {#each associatedResources as res (res.id)}
            <AssociationPill
                onedit={() => {
                    editingResource = res;
                    showQuickCreate = false;
                    showSelector = false;
                }}
                onunlink={() => toggleAssociation(res)}
            >
                <div class="text-gray-700 flex items-center gap-1 font-medium">
                    {getName(res)}
                    {#if type === "location" && res.type}
                        <span
                            class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100"
                        >
                            {res.type}
                        </span>
                    {/if}
                </div>
                <div class="ml-auto flex items-center gap-2">
                    <a
                        href={`/${type}s/${res.id}`}
                        target="_blank"
                        class="text-gray-400 hover:text-blue-500"
                    >
                        <ExternalLink size={14} />
                    </a>
                </div>
            </AssociationPill>
        {/each}
    </AssociationList>

    {#if showSelector}
        <div class="bg-white border rounded-lg p-3 shadow-inner space-y-3">
            <div class="relative">
                <Search
                    size={16}
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                    type="text"
                    placeholder={`Search ${type}s...`}
                    bind:value={searchQuery}
                    class="pl-9 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div class="max-h-48 overflow-y-auto space-y-1">
                {#if loadingSearch}
                    <div class="text-xs text-center py-4 text-gray-400">
                        Loading...
                    </div>
                {:else if filteredResources.length === 0}
                    <div class="text-xs text-center py-4 text-gray-400">
                        No results found.
                    </div>
                {:else}
                    {#each filteredResources as res (res.id)}
                        {@const isAssociated = associatedResources.some(
                            (r) => r.id === res.id,
                        )}
                        <div class="flex items-center gap-1 group">
                            <button
                                type="button"
                                class="flex-1 flex items-center justify-between px-3 py-2 rounded-md transition-colors text-left {isAssociated
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'hover:bg-gray-100'}"
                                onclick={() => toggleAssociation(res)}
                            >
                                <span class="text-sm">{getName(res)}</span>
                                {#if isAssociated}<Check size={14} />{/if}
                            </button>
                            <button
                                type="button"
                                class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(res);
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}

    {#if showQuickCreate || editingResource}
        <div
            class="bg-white border rounded-lg p-4 shadow-lg animate-in fade-in slide-in-from-top-2"
        >
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-bold text-gray-900">
                    {editingResource
                        ? `Edit ${getName(editingResource)}`
                        : `Create ${type === "contact" ? "Contact" : "Location"}`}
                </h4>
                <button
                    type="button"
                    onclick={() => {
                        showQuickCreate = false;
                        editingResource = null;
                    }}
                >
                    <X size={20} class="text-gray-400 hover:text-gray-600" />
                </button>
            </div>

            <!-- Dynamic Form Component -->
            {#key editingResource?.id || "new"}
                <FormComponent
                    remoteFunction={editingResource
                        ? remoteFunctions.update
                        : remoteFunctions.create}
                    initialData={editingResource || {}}
                    validationSchema={editingResource
                        ? schemas.update
                        : schemas.create}
                    isUpdating={!!editingResource}
                    onSuccess={handleSuccess}
                    onCancel={() => {
                        showQuickCreate = false;
                        editingResource = null;
                    }}
                />
            {/key}
        </div>
    {/if}
</div>
```
