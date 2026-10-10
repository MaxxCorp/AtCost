import { listLocations } from "../../routes/locations/list.remote.js";
import type { FilterGroup } from "@ac/ui";
import { MapPin } from "@lucide/svelte";

export function getLocationFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "city",
            label: m?.cities ? m.cities() : "City",
            icon: MapPin,
            type: "select",
            searchable: true,
            optionsRemote: async () => {
                const res = await listLocations({ limit: 1000 });
                const items = Array.isArray(res) ? res : (res?.data ?? []);
                const cities = [...new Set(items.map((i: any) => i.city).filter(Boolean))];
                return cities.sort().map((city) => ({ id: String(city), value: String(city), label: String(city) }));
            },
        },
    ];
}
