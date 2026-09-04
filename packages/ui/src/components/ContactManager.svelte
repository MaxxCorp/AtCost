<script lang="ts">
    import { type Component, type Snippet } from "svelte";
    // @ts-ignore
    import EntityManager_ from "./EntityManager.svelte";
    const EntityManager = EntityManager_ as any;
    import { User } from "@lucide/svelte";
    import { matchContactSearch } from "../utils.js";

    interface Props<T extends { id: string }> {
        title: string;
        icon?: Component<any>;
        mode?: "embedded" | "standalone";
        
        // Data fetchers
        listItemsRemote: () => Promise<T[]>;
        deleteItemRemote?: (ids: string[]) => Promise<any>;
        
        // Form Data
        createRemote?: any;
        createSchema?: any;
        updateRemote?: any;
        updateSchema?: any;
        readItemRemote?: (id: string) => Promise<any>;

        // Form Rendering
        renderForm?: Snippet<[any]>;
        // Rendering snippets
        renderItemLabel: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        
        // Search
        searchPredicate?: (item: T, query: string) => boolean;
        
        // Specialized props
        contactId?: string | null;

        // Sorting
        sortField?: string;
        sortOrder?: "asc" | "desc";
    }

    let {
        title,
        icon = User,
        mode = "standalone",
        listItemsRemote,
        deleteItemRemote,
        createRemote,
        createSchema,
        updateRemote,
        updateSchema,
        readItemRemote,
        renderForm,
        renderItemLabel,
        renderItemBadge,
        renderItemDetail,
        searchPredicate = matchContactSearch,
        sortField = "displayName",
        sortOrder = "asc",
        ...rest
    }: Props<any> = $props();

</script>

<EntityManager
    {title}
    icon={icon}
    {mode}
    {listItemsRemote}
    {deleteItemRemote}
    {createRemote}
    {createSchema}
    {updateRemote}
    {updateSchema}
    {readItemRemote}
    {renderForm}
    {renderItemLabel}
    {renderItemBadge}
    {renderItemDetail}
    {searchPredicate}
    {sortField}
    {sortOrder}
    {...rest}
/>
