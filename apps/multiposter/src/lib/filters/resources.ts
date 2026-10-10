import { listLocations } from "../../routes/locations/list.remote";
import type { FilterGroup } from "@ac/ui";
import { MapPin } from "@lucide/svelte";

export function getResourceFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "locationId",
            label: m?.locations?.() ?? "Locations",
            icon: MapPin,
            optionsRemote: listLocations,
            searchable: true,
        },
    ];
}
