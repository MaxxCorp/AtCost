import type { Feature } from '$lib/authorization';

export interface BreadcrumbSegment {
    label: string;
    href?: string;
}

class BreadcrumbState {
    feature = $state<Feature | null>(null);
    segments = $state<BreadcrumbSegment[] | null>(null);
    current = $state<string | null>(null);

    set(opts: { feature?: Feature; segments?: BreadcrumbSegment[]; current?: string }) {
        this.feature = opts.feature ?? null;
        this.segments = opts.segments ?? null;
        this.current = opts.current ?? null;
    }

    reset() {
        this.feature = null;
        this.segments = null;
        this.current = null;
    }
}

export const breadcrumbState = new BreadcrumbState();
