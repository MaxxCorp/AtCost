<script lang="ts">
	import "../app.css";
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import { Toaster } from "@ac/ui/components/sonner";
	import * as Sidebar from "@ac/ui/components/sidebar";
	import * as Breadcrumb from "@ac/ui/components/breadcrumb";
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
	import { FEATURES } from "$lib/features";

	let { children } = $props();

	onMount(() => {
		if (browser && "serviceWorker" in navigator) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (const registration of registrations) {
					registration.unregister();
				}
			});
		}
	});

	let isAuthPage = $derived(
		$page.url.pathname === "/login" || $page.url.pathname === "/signup",
	);

	const featureMeta = $derived.by(() =>
		breadcrumbState.feature
			? FEATURES.find((f) => f.key === breadcrumbState.feature)
			: null,
	);
	const breadcrumbSegments = $derived.by(
		() =>
			breadcrumbState.segments ??
			(featureMeta
				? [{ label: featureMeta.title, href: featureMeta.href }]
				: []),
	);
</script>

<svelte:head>
	<title>AC Personnel</title>
</svelte:head>

{#if isAuthPage}
	<main class="min-h-screen bg-background">
		{@render children()}
	</main>
{:else}
	<Sidebar.Provider>
		<AppSidebar />
		<Sidebar.Inset>
			<header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
				<Sidebar.Trigger class="-ml-1" />

				{#if breadcrumbSegments.length > 0 || breadcrumbState.current}
					<div class="ml-2">
						<Breadcrumb.Root>
							<Breadcrumb.List>
								<Breadcrumb.Item>
									<Breadcrumb.Link href="/"
										>Home</Breadcrumb.Link
									>
								</Breadcrumb.Item>

								{#each breadcrumbSegments as segment, i}
									<Breadcrumb.Separator />
									<Breadcrumb.Item>
										{#if segment.href && (i < breadcrumbSegments.length - 1 || breadcrumbState.current)}
											<Breadcrumb.Link href={segment.href}
												>{segment.label}</Breadcrumb.Link
											>
										{:else}
											<Breadcrumb.Page
												>{segment.label}</Breadcrumb.Page
											>
										{/if}
									</Breadcrumb.Item>
								{/each}

								{#if breadcrumbState.current}
									<Breadcrumb.Separator />
									<Breadcrumb.Item>
										<Breadcrumb.Page
											class="truncate max-w-xs"
											>{breadcrumbState.current}</Breadcrumb.Page
										>
									</Breadcrumb.Item>
								{/if}
							</Breadcrumb.List>
						</Breadcrumb.Root>
					</div>
				{/if}
			</header>
			<div class="flex flex-1 flex-col gap-4 p-4 md:p-8 bg-gray-50">
				<div class="mx-auto w-full max-w-7xl">
					{@render children()}
				</div>
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}

<Toaster richColors position="top-right" />

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
			"Helvetica Neue", Arial, sans-serif;
	}

	:global(html) {
		scroll-behavior: smooth;
	}
</style>
