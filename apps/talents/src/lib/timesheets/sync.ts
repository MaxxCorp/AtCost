import { getUnsyncedEntries, markAsSynced } from './offline';
import { clockIn, clockOut } from '../../routes/timesheets/timesheets.remote';

export async function syncOfflineEntries() {
    const entries = await getUnsyncedEntries();
    for (const entry of entries) {
        try {
            if (entry.endTime) {
                // Was a full entry, but maybe it was a clock-out of an existing entry?
                // For simplicity, we assume we sync start/stop actions sequentially.
            } else {
                await (clockIn as any)({
                    talentId: entry.talentId,
                    type: entry.type,
                    locationId: entry.locationId,
                    latitude: entry.latitude,
                    longitude: entry.longitude
                });
            }
            if (entry.id) await markAsSynced(entry.id);
        } catch (e) {
            console.error('Failed to sync entry', entry, e);
        }
    }
}

export function setupMidnightSync(activeShift?: { endTime: Date }) {
    const checkSync = () => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
            // Check if active shift goes past midnight
            if (activeShift && new Date(activeShift.endTime) > now) {
                console.log('Skipping midnight sync: active shift spans across midnight');
                return;
            }
            console.log('Midnight sync triggered');
            syncOfflineEntries();
        }
    };

    const interval = setInterval(checkSync, 60000); // Check every minute
    return () => clearInterval(interval);
}
