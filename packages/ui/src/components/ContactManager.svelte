<script lang="ts">
    import { type Component, type Snippet } from "svelte";
    import EntityManager from "./EntityManager.svelte";
    import { User } from "@lucide/svelte";

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
        getFormData?: (item: T) => any;

        // Form Rendering
        renderForm?: Snippet<[any]>;
        // Rendering snippets
        renderItemLabel: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        
        // Search
        searchPredicate: (item: T, query: string) => boolean;
        
        // Specialized props
        contactId?: string | null;
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
        getFormData,
        renderForm,
        renderItemLabel,
        renderItemBadge,
        renderItemDetail,
        searchPredicate,
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
    {getFormData}
    {renderForm}
    {renderItemLabel}
    {renderItemBadge}
    {renderItemDetail}
    {searchPredicate}
    {...rest}
/>
