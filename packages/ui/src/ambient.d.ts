declare module "*.svelte" {
    const component: any;
    export default component;
}

declare module "$app/navigation" {
    export function goto(url: string | URL, opts?: { replaceState?: boolean; noScroll?: boolean; keepFocus?: boolean; invalidateAll?: boolean }): Promise<void>;
    export function invalidate(url: string | URL | ((url: URL) => boolean)): Promise<void>;
    export function invalidateAll(): Promise<void>;
    export function preloadData(href: string): Promise<any>;
    export function preloadCode(...urls: string[]): Promise<any>;
}
