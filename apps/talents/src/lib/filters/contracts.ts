import { listTalents } from "../../routes/talents/list.remote.js";
import { listContractFrameworks } from "../../routes/contract-frameworks/frameworks.remote.js";
import type { FilterGroup } from "@ac/ui";
import { User, FileText } from "@lucide/svelte";

export function getContractFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: "talentId",
            label: m?.talent ? m.talent() : "Talent",
            icon: User,
            listRemote: listTalents as any,
            getOptionLabel: (t: any) => t.contact?.displayName,
        },
        {
            id: "frameworkId",
            label: m?.framework ? m.framework() : "Framework",
            icon: FileText,
            listRemote: listContractFrameworks as any,
            getOptionLabel: (f: any) => f.name,
        },
    ];
}
