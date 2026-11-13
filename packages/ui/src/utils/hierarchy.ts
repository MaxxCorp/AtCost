import { getContactDisplayName } from "./contacts.js";

/**
 * Extracts a normalized lowercase string value from an item for sorting.
 */
export function getItemSortValue(item: any, field: string): string {
    if (!item) return "";
    if (field === "displayName" || field === "name") {
        const displayName = getContactDisplayName(item);
        if (displayName) return displayName.toLowerCase();
        return (item.name || item.title || item.company || item.id || "").toString().toLowerCase();
    }
    return (item[field] ?? "").toString().toLowerCase();
}

/**
 * Compares two items by a given field and sort order, falling back to display name.
 * Numeric values sort before missing/null values.
 */
export function compareItems(a: any, b: any, field: string, order: "asc" | "desc"): number {
    const rawA = a?.[field];
    const rawB = b?.[field];
    const numA = rawA !== null && rawA !== undefined && rawA !== "" && !isNaN(Number(rawA)) ? Number(rawA) : null;
    const numB = rawB !== null && rawB !== undefined && rawB !== "" && !isNaN(Number(rawB)) ? Number(rawB) : null;

    if (numA !== null && numB === null) {
        return -1;
    }
    if (numA === null && numB !== null) {
        return 1;
    }

    let cmp = 0;
    if (numA !== null && numB !== null) {
        cmp = numA - numB;
    } else {
        const valA = getItemSortValue(a, field);
        const valB = getItemSortValue(b, field);
        cmp = valA.localeCompare(valB, undefined, { sensitivity: "base", numeric: true });
    }

    const res = order === "desc" ? -cmp : cmp;
    if (res !== 0) return res;

    const nameA = getItemSortValue(a, "displayName");
    const nameB = getItemSortValue(b, "displayName");
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true });
}

/**
 * Sorts a flat array of items by the specified field and order.
 */
export function sortItemsList<I>(items: I[], field: string, order: "asc" | "desc"): I[] {
    if (!items || !Array.isArray(items)) return [];
    return [...items].sort((a: any, b: any) => compareItems(a, b, field, order));
}

/**
 * Sorts items hierarchically in pre-order depth-first traversal so children appear
 * directly beneath their parents, while sorting sibling nodes at each level by
 * `field` and `order`. Recomputes `level` relative to the items present in `items`.
 */
export function sortHierarchically<I>(
    items: I[],
    field = "name",
    order: "asc" | "desc" = "asc"
): Array<I & { level: number }> {
    if (!items || !Array.isArray(items)) return [];

    const byId = new Map<string, any>();
    for (const item of items) {
        const id = (item as any)?.id;
        if (id && !byId.has(id)) {
            byId.set(id, item);
        }
    }

    const visibleParentsOf = new Map<string, Set<string>>();
    const childrenOf = new Map<string, Set<string>>();

    for (const id of byId.keys()) {
        visibleParentsOf.set(id, new Set());
        childrenOf.set(id, new Set());
    }

    for (const [id, item] of byId.entries()) {
        const rawParents: unknown[] = Array.isArray(item?.parentIds)
            ? item.parentIds
            : item?.parentId
                ? [item.parentId]
                : [];

        for (const pid of rawParents) {
            if (typeof pid === "string" && pid !== id && byId.has(pid)) {
                visibleParentsOf.get(id)!.add(pid);
                childrenOf.get(pid)!.add(id);
            }
        }

        const rawChildren: unknown[] = Array.isArray(item?.childIds) ? item.childIds : [];
        for (const cid of rawChildren) {
            if (typeof cid === "string" && cid !== id && byId.has(cid)) {
                visibleParentsOf.get(cid)!.add(id);
                childrenOf.get(id)!.add(cid);
            }
        }
    }

    const roots: any[] = [];
    for (const item of items) {
        const id = (item as any)?.id;
        if (!id || (visibleParentsOf.get(id)?.size ?? 0) === 0) {
            roots.push(item);
        }
    }

    const result: Array<I & { level: number }> = [];
    const visited = new Set<string>();

    function visit(node: any, depth: number) {
        const id = node?.id;
        if (id) {
            if (visited.has(id)) return;
            visited.add(id);
        }
        result.push({ ...node, level: depth });
        if (id) {
            const childIds = Array.from(childrenOf.get(id) ?? []);
            if (childIds.length > 0) {
                const childNodes = childIds.map((cid) => byId.get(cid)).filter(Boolean);
                for (const child of sortItemsList(childNodes, field, order)) {
                    visit(child, depth + 1);
                }
            }
        }
    }

    for (const root of sortItemsList(roots, field, order)) {
        visit(root, 0);
    }

    // Fallback for any disconnected cycles where every node in the cycle had a visible parent
    for (const item of sortItemsList(items, field, order)) {
        const id = (item as any)?.id;
        if (id && !visited.has(id)) {
            visit(item, 0);
        }
    }

    return result;
}
