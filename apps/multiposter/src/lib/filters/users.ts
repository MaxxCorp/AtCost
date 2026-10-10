import type { FilterGroup } from "@ac/ui";
import { Shield } from "@lucide/svelte";

export function getUserFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "role",
            label: m?.role ? m.role() : "Role",
            icon: Shield,
            options: [
                { id: "admin", label: m?.admin ? m.admin() : "Admin" },
                { id: "user", label: m?.user ? m.user() : "User" },
                { id: "guest", label: m?.guest ? m.guest() : "Guest" },
            ],
            searchable: true,
        },
    ];
}
