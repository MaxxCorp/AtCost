import { listLocations } from "../../routes/locations/list.remote";
import type { FilterGroup } from "@ac/ui";
import { Home } from "@lucide/svelte";

export function getLocationFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "city",
            label: m?.cities?.() ?? "Cities",
            icon: Home,
            searchable: true,
            optionsRemote: async () => {
                const res = await listLocations({ limit: 1000 });
                const items = Array.isArray(res) ? res : (res?.data ?? []);
                const cities = [...new Set(items.map((i: any) => i.city).filter(Boolean))];
                return cities.sort().map((c) => ({ id: String(c), label: String(c), value: String(c) }));
            },
        },
    ];
}
