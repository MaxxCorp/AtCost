
export class KioskState {
    isKiosk = $state(false);
    isHeaderVisible = $state(true);
    showSeriesToggle = $state(false);
    compressSeries = $state(true);
    onToggleCompressSeries = $state<((val: boolean) => void) | null>(null);
}

export const kioskState = new KioskState();
