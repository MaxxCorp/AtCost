/**
 * Utility for preserving and restoring list position, pagination, and active item scroll
 * across list and detail/edit navigation.
 */

const LIST_URL_PREFIX = 'ac_list_url:';
const ACTIVE_ITEM_PREFIX = 'ac_active_item:';

/**
 * Record the current list URL (path + search params) for a feature.
 */
export function recordListUrl(feature: string, url: string | URL): void {
    if (typeof window === 'undefined') return;
    try {
        const strUrl = typeof url === 'string' ? url : (url.pathname + url.search);
        sessionStorage.setItem(LIST_URL_PREFIX + feature, strUrl);
    } catch (e) {
        // Ignore storage errors (e.g. private browsing quota)
    }
}

/**
 * Get the last recorded list URL for a feature, or fallback.
 */
export function getLastListUrl(feature: string, fallbackUrl: string): string {
    if (typeof window === 'undefined') return fallbackUrl;
    try {
        return sessionStorage.getItem(LIST_URL_PREFIX + feature) || fallbackUrl;
    } catch (e) {
        return fallbackUrl;
    }
}

/**
 * Record the active or last-clicked item ID for a feature.
 */
export function recordActiveItem(feature: string, itemId: string): void {
    if (typeof window === 'undefined' || !itemId) return;
    try {
        sessionStorage.setItem(ACTIVE_ITEM_PREFIX + feature, itemId);
    } catch (e) {
        // Ignore storage errors
    }
}

/**
 * Get the last active item ID for a feature without clearing it.
 */
export function getLastActiveItem(feature: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return sessionStorage.getItem(ACTIVE_ITEM_PREFIX + feature);
    } catch (e) {
        return null;
    }
}

/**
 * Consume (retrieve and remove) the last active item ID for a feature.
 */
export function consumeActiveItem(feature: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const val = sessionStorage.getItem(ACTIVE_ITEM_PREFIX + feature);
        if (val) {
            sessionStorage.removeItem(ACTIVE_ITEM_PREFIX + feature);
        }
        return val;
    } catch (e) {
        return null;
    }
}

export interface UrlLike {
    pathname?: string;
    search?: string;
    searchParams?: {
        get(name: string): string | null;
        has?(name: string): boolean;
        toString?(): string;
    };
}

/**
 * Reads initial page number from URL search parameters.
 */
export function initPageFromUrl(url?: UrlLike | null, defaultPage = 1): number {
    try {
        if (!url || !url.searchParams) return defaultPage;
        const p = Number(url.searchParams.get("page"));
        return p > 0 ? p : defaultPage;
    } catch {
        return defaultPage;
    }
}

/**
 * Synchronizes local pagination state with the URL query parameters.
 */
export function syncPageToUrl(
    feature: string,
    pageNum: number,
    currentUrl?: UrlLike | null,
    gotoFn?: (url: string, opts?: { replaceState?: boolean; noScroll?: boolean; keepFocus?: boolean }) => Promise<void> | void
): void {
    if (typeof window === 'undefined') return;
    try {
        const url = new URL(window.location.href);
        if (currentUrl?.pathname) {
            url.pathname = currentUrl.pathname;
        }
        if (currentUrl?.searchParams?.toString) {
            url.search = currentUrl.searchParams.toString();
        } else if (currentUrl?.search) {
            url.search = currentUrl.search;
        }
        
        const urlPage = Number(url.searchParams.get("page") || "1");
        if (urlPage !== pageNum) {
            if (pageNum <= 1) {
                url.searchParams.delete("page");
            } else {
                url.searchParams.set("page", String(pageNum));
            }
            const target = url.pathname + (url.search ? url.search : "");
            recordListUrl(feature, target);
            if (gotoFn) {
                void gotoFn(target, { replaceState: true, noScroll: true, keepFocus: true });
            }
        } else {
            recordListUrl(feature, url.pathname + (url.search ? url.search : ""));
        }
    } catch (e) {
        // Ignore URL parsing errors
    }
}


/**
 * Smoothly scrolls to an item element and adds a transient highlight effect.
 * Retries up to `maxAttempts` frames in case DOM is still rendering.
 */
export function restoreItemScroll(
    itemId: string,
    options: {
        highlightClass?: string;
        duration?: number;
        maxAttempts?: number;
    } = {}
): Promise<boolean> {
    if (typeof window === 'undefined' || !itemId) return Promise.resolve(false);

    const {
        highlightClass = 'item-highlight-target',
        duration = 2000,
        maxAttempts = 20,
    } = options;

    return new Promise((resolve) => {
        let attempts = 0;

        const tryScroll = () => {
            attempts++;
            const el =
                document.getElementById(`item-${itemId}`) ||
                document.querySelector(`[data-item-id="${itemId}"]`) ||
                document.getElementById(itemId);

            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                el.classList.add(highlightClass);
                setTimeout(() => {
                    el.classList.remove(highlightClass);
                }, duration);
                resolve(true);
                return;
            }

            if (attempts < maxAttempts) {
                requestAnimationFrame(tryScroll);
            } else {
                resolve(false);
            }
        };

        requestAnimationFrame(tryScroll);
    });
}

/**
 * Svelte action to automatically scroll and highlight an item when it mounts if it matches the last active item.
 */
export function activeItemAnchor(node: HTMLElement, params: { feature: string; id?: string | null }) {
    if (typeof window === 'undefined' || !params?.id) return;
    const { feature, id } = params;
    const activeId = getLastActiveItem(feature);
    if (activeId && activeId === id) {
        consumeActiveItem(feature);
        requestAnimationFrame(() => {
            node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            node.classList.add('item-highlight-target');
            setTimeout(() => {
                node.classList.remove('item-highlight-target');
            }, 2000);
        });
    }
}

