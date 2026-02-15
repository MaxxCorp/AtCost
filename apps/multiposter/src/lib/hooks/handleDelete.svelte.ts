// src/lib/hooks/handleDelete.svelte.ts
// Shared delete handler for all list pages (Svelte 5 idiom)
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
/**
 * Shared delete handler for list pages.
 * @param opts - Options for deletion
 * @param opts.ids - Array of item IDs to delete
 * @param opts.deleteFn - Function to call to perform the delete (should return a promise)
 * @param opts.itemName - Name of the item (singular, e.g. "campaign")
 */
export async function handleDelete({
    ids,
    deleteFn,
    itemName,
}: {
    ids: string[];
    deleteFn: (ids: string[]) => Promise<any>;
    itemName: string;
}): Promise<boolean> {
    if (!ids?.length) return false;
    const plural = ids.length === 1 ? '' : 's';
    if (!confirm(`Delete ${ids.length} ${itemName}${plural}?`)) return false;
    try {
        await deleteFn(ids);
        toast.success(`${ids.length} ${itemName}${plural} deleted successfully!`);
        return true;
    } catch (e) {
        toast.error(`Failed to delete ${itemName}${plural}`);
        return false;
    }
}
