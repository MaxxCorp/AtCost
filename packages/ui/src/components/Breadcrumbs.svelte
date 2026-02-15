<script lang="ts">
    import { page } from "$app/state";
    import * as Breadcrumb from "./ui/breadcrumb/index.js";

    // derived state for crumbs
    let crumbs = $derived.by(() => {
        const path = page.url.pathname;
        const segments = path.split("/").filter(Boolean);

        let currentPath = "";
        const items = segments.map((segment) => {
            currentPath += `/${segment}`;
            return {
                label: formatSegment(segment),
                href: currentPath,
            };
        });

        // Add Home if path is not root.
        if (path !== "/") {
            return [{ label: "Home", href: "/" }, ...items];
        }
        return [];
    });

    function formatSegment(segment: string) {
        // Replace dashes with spaces and title case
        return segment
            .replace(/-/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }
</script>

{#if crumbs.length > 0}
    <div class="px-6 py-4">
        <Breadcrumb.Root>
            <Breadcrumb.List>
                {#each crumbs as crumb, index}
                    <Breadcrumb.Item>
                        {#if index === crumbs.length - 1}
                            <Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
                        {:else}
                            <Breadcrumb.Link href={crumb.href}
                                >{crumb.label}</Breadcrumb.Link
                            >
                        {/if}
                    </Breadcrumb.Item>
                    {#if index < crumbs.length - 1}
                        <Breadcrumb.Separator />
                    {/if}
                {/each}
            </Breadcrumb.List>
        </Breadcrumb.Root>
    </div>
{/if}
