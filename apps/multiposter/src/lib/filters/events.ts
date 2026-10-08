import { listLocations } from "../../routes/locations/list.remote";
import { listTags } from "../../routes/tags/list.remote";
import type { FilterGroup } from "@ac/ui";
import { MapPin, Tag as TagIcon } from "@lucide/svelte";

export function getEventFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "tagId",
            label: m?.tags?.() ?? "Tags",
            icon: TagIcon,
            optionsRemote: listTags,
            searchable: true,
        },
        {
            id: "locationId",
            label: m?.locations?.() ?? "Locations",
            icon: MapPin,
            optionsRemote: listLocations,
            searchable: true,
        },
    ];
}
