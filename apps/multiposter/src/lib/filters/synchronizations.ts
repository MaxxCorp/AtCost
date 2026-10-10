import type { FilterGroup } from "@ac/ui";
import { RefreshCw } from "@lucide/svelte";

export function getSynchronizationFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "providerType",
            label: m?.providers ? m.providers() : "Providers",
            icon: RefreshCw,
            options: [
                { id: "google-calendar", label: "Google Calendar" },
                { id: "microsoft-calendar", label: "Microsoft Calendar" },
                { id: "berlin-de-main-calendar", label: "Berlin.de (Main)" },
                { id: "berlin-de-mh-calendar", label: "Berlin.de (M-H)" },
                { id: "wp-the-events-calendar", label: "WP The Events Calendar" },
                { id: "email", label: "E-Mail (Brevo)" },
            ],
            searchable: true,
        },
    ];
}
