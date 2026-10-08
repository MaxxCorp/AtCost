import { listLocations } from "../../routes/locations/list.remote.js";
import { listTags } from "../../routes/tags/list.remote.js";
import type { FilterGroup } from "@ac/ui";
import { MapPin, Tag, Clock } from "@lucide/svelte";

export function getTalentFilterGroups(m?: any): FilterGroup[] {
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
            icon: Tag,
            optionsRemote: listTags,
            searchable: true,
        },
        {
            id: "status",
            label: m?.status ? m.status() : "Status",
            icon: Clock,
            options: [
                { id: "active", value: "active", label: m?.status_active ? m.status_active() : "Active" },
                { id: "applicant", value: "applicant", label: m?.status_applicant ? m.status_applicant() : "Applicant" },
                { id: "inactive", value: "inactive", label: m?.status_inactive ? m.status_inactive() : "Inactive" },
            ],
        },
    ];
}
