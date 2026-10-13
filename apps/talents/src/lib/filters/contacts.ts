import { listLocations } from "../../routes/locations/list.remote.js";
import { listTags } from "../../routes/tags/list.remote.js";
import type { FilterGroup } from "@ac/ui";
import { MapPin, Tag as TagIcon } from "@lucide/svelte";

export function getContactFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "locationId",
            label: m?.locations ? m.locations() : "Locations",
            icon: MapPin,
            optionsRemote: listLocations,
            searchable: true,
        },
        {
            id: "tagId",
            label: m?.tags ? m.tags() : "Tags",
            icon: TagIcon,
            optionsRemote: listTags,
            searchable: true,
        },
    ];
}
