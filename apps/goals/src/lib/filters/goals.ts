import { listTags } from '../../routes/tags/list.remote.js';
import { listLocations } from '../../routes/locations/list.remote.js';
import type { FilterGroup } from '@ac/ui';
import { Tag as TagIcon, MapPin, Sparkles, CheckCircle2 } from '@lucide/svelte';

export function getGoalFilterGroups(m?: any): FilterGroup[] {
    return [
        {
            id: 'tagId',
            label: m?.tags ? m.tags() : 'Tags',
            icon: TagIcon,
            type: 'select',
            searchable: true,
            optionsRemote: async () => {
                const res = await listTags({ limit: 500 });
                const items = Array.isArray(res) ? res : (res?.data ?? []);
                return items.map((t: any) => ({
                    id: String(t.id),
                    value: String(t.id),
                    label: t.categoryName ? `${t.name} (${t.categoryName})` : String(t.name)
                }));
            }
        },
        {
            id: 'locationId',
            label: m?.locations ? m.locations() : 'Locations',
            icon: MapPin,
            type: 'select',
            searchable: true,
            optionsRemote: async () => {
                const res = await listLocations({ limit: 500 });
                const items = Array.isArray(res) ? res : (res?.data ?? []);
                return items.map((l: any) => ({
                    id: String(l.id),
                    value: String(l.id),
                    label: l.city ? `${l.name} (${l.city})` : String(l.name)
                }));
            }
        },
        {
            id: 'contributionType',
            label: m?.contribution_type ? m.contribution_type() : 'Contribution Plugin',
            icon: Sparkles,
            type: 'select',
            options: [
                {
                    id: 'financial',
                    value: 'financial',
                    label: m?.plugin_financial ? m.plugin_financial() : 'Financial Backing (EUR)'
                },
                {
                    id: 'vote',
                    value: 'vote',
                    label: m?.plugin_vote ? m.plugin_vote() : 'Community Vote'
                },
                {
                    id: 'signup',
                    value: 'signup',
                    label: m?.plugin_signup ? m.plugin_signup() : 'Participant Sign-up'
                }
            ]
        },
        {
            id: 'status',
            label: m?.status ? m.status() : 'Campaign Status',
            icon: CheckCircle2,
            type: 'select',
            options: [
                {
                    id: 'published',
                    value: 'published',
                    label: m?.status_published ? m.status_published() : 'Active / Published'
                },
                {
                    id: 'completed_successful',
                    value: 'completed_successful',
                    label: m?.status_completed_successful
                        ? m.status_completed_successful()
                        : 'Completed (Successful)'
                },
                {
                    id: 'completed_unsuccessful',
                    value: 'completed_unsuccessful',
                    label: m?.status_completed_unsuccessful
                        ? m.status_completed_unsuccessful()
                        : 'Completed (Unsuccessful)'
                },
                {
                    id: 'pending_approval',
                    value: 'pending_approval',
                    label: m?.status_pending_approval
                        ? m.status_pending_approval()
                        : 'Pending Operator Approval'
                },
                {
                    id: 'draft',
                    value: 'draft',
                    label: m?.status_draft ? m.status_draft() : 'Draft'
                },
                {
                    id: 'cancelled',
                    value: 'cancelled',
                    label: m?.status_cancelled ? m.status_cancelled() : 'Cancelled'
                }
            ]
        }
    ];
}
