<script lang="ts">
	import "../app.css";
	import AppSidebar from "#lib/components/app-sidebar.svelte";
	import { Toaster } from "@ac/ui/components/sonner";
	import * as Sidebar from "@ac/ui/components/sidebar";
	import * as Breadcrumb from "@ac/ui/components/breadcrumb";
	import { onMount } from "svelte";
	import { browser, dev } from "$app/env";
	import { page } from "$app/state";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { FEATURES } from "#lib/features.js";
	import { getLastListUrl } from "@ac/ui";
	import { getCurrentSessionUser, switchDevPersona } from "./goals/list.remote.js";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import UsersIcon from "@lucide/svelte/icons/users";
	import EyeIcon from "@lucide/svelte/icons/eye";
	import PlusIcon from "@lucide/svelte/icons/plus";

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

	const isAuthPage = $derived(
		page.url.pathname === "/login" || page.url.pathname === "/signup",
	);

	const sessionQuery = getCurrentSessionUser({});
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(Boolean(sessionQuery.current?.isOperator));
	const activePersona = $derived(sessionQuery.current?.devPersona ?? "operator");
	let switchingPersona = $state(false);

	async function handlePersonaChange(role: "operator" | "community" | "guest") {
		if (switchingPersona) return;
		try {
			switchingPersona = true;
			await switchDevPersona(role);
			await sessionQuery.refresh();
		} finally {
			switchingPersona = false;
		}
	}

	const featureMeta = $derived.by(() =>
		breadcrumbState.feature
			? FEATURES.find((f) => f.key === breadcrumbState.feature)
			: null,
	);
	const breadcrumbSegments = $derived.by(
		() =>
			breadcrumbState.segments ??
			(featureMeta
				? [{ label: featureMeta.title, href: getLastListUrl(featureMeta.key, featureMeta.href) }]
				: []),
	);
</script>

<svelte:head>
	<title>AC-Goals — Crowdfunding & Community Petitions</title>
</svelte:head>

{#if isAuthPage}
	<main class="min-h-screen flex flex-col bg-background">
		<div class="flex-1">
			{#key page.url.pathname}
				{@render children()}
			{/key}
		</div>
		<footer class="border-t bg-white px-4 py-3 text-xs text-gray-500">
			<div class="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2">
				<span>© {new Date().getFullYear()} AC-Goals — Crowdfunding & Community Petitions</span>
				<nav class="flex flex-wrap items-center gap-4 font-semibold">
					<a href="/imprint" class="hover:text-indigo-600 transition-colors">Imprint (Impressum)</a>
					<a href="/GDPR" class="hover:text-indigo-600 transition-colors">Data Privacy (GDPR)</a>
					<a href="/gdpr-self-service" class="text-indigo-600 hover:text-indigo-700 transition-colors">
						GDPR Art. 17 Self-Service
					</a>
				</nav>
			</div>
		</footer>
	</main>
{:else}
	<Sidebar.Provider>
		<AppSidebar />
		<Sidebar.Inset>
			<header class="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-4">
				<Sidebar.Trigger class="-ml-1" />

				{#if breadcrumbSegments.length > 0 || breadcrumbState.current}
					<div class="ml-2 hidden sm:block">
						<Breadcrumb.Root>
							<Breadcrumb.List>
								<Breadcrumb.Item>
									<Breadcrumb.Link href="/">Home</Breadcrumb.Link>
								</Breadcrumb.Item>

								{#each breadcrumbSegments as segment, i (i)}
									<Breadcrumb.Separator />
									<Breadcrumb.Item>
										{#if segment.href && (i < breadcrumbSegments.length - 1 || breadcrumbState.current)}
											<Breadcrumb.Link href={segment.href}>{segment.label}</Breadcrumb.Link>
										{:else}
											<Breadcrumb.Page>{segment.label}</Breadcrumb.Page>
										{/if}
									</Breadcrumb.Item>
								{/each}

								{#if breadcrumbState.current}
									<Breadcrumb.Separator />
									<Breadcrumb.Item>
										<Breadcrumb.Page class="truncate max-w-xs">
											{breadcrumbState.current}
										</Breadcrumb.Page>
									</Breadcrumb.Item>
								{/if}
							</Breadcrumb.List>
						</Breadcrumb.Root>
					</div>
				{/if}

				<div class="ml-auto flex items-center gap-2">
					{#if dev}
						<div
							class="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1 text-xs"
							title="Switch active persona to test Operator vs Community Member vs Guest permissions"
						>
							<button
								type="button"
								disabled={switchingPersona}
								onclick={() => handlePersonaChange("operator")}
								class={[
									"flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
									activePersona === "operator"
										? "bg-indigo-600 text-white shadow-xs"
										: "text-gray-600 hover:text-gray-900",
								]}
							>
								<ShieldIcon class="size-3.5" />
								<span>Operator</span>
							</button>
							<button
								type="button"
								disabled={switchingPersona}
								onclick={() => handlePersonaChange("community")}
								class={[
									"flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
									activePersona === "community"
										? "bg-emerald-600 text-white shadow-xs"
										: "text-gray-600 hover:text-gray-900",
								]}
							>
								<UsersIcon class="size-3.5" />
								<span class="hidden md:inline">Community Member</span>
								<span class="md:hidden">Member</span>
							</button>
							<button
								type="button"
								disabled={switchingPersona}
								onclick={() => handlePersonaChange("guest")}
								class={[
									"flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
									activePersona === "guest"
										? "bg-slate-700 text-white shadow-xs"
										: "text-gray-600 hover:text-gray-900",
								]}
							>
								<EyeIcon class="size-3.5" />
								<span>Guest</span>
							</button>
						</div>
					{/if}

					{#if !currentUser}
						<a
							href="/login"
							class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
						>
							Sign In
						</a>
					{:else}
						<div class="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
							<span class="max-w-[10rem] truncate">{currentUser.name || currentUser.email}</span>
							{#if isOperator}
								<span class="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
									Operator
								</span>
							{/if}
						</div>
					{/if}

					<a
						href="/goals/new"
						class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
					>
						<PlusIcon class="size-3.5" />
						<span class="hidden sm:inline">Launch Campaign</span>
					</a>
				</div>
			</header>
			<div class="flex flex-1 flex-col gap-4 p-4 md:p-8 bg-gray-50">
				<div class="mx-auto w-full max-w-7xl">
					{#key page.url.pathname}
						{@render children()}
					{/key}
				</div>
			</div>
			<footer class="border-t bg-white px-4 py-3 text-xs text-gray-500">
				<div class="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2">
					<span>© {new Date().getFullYear()} AC-Goals — Crowdfunding & Community Petitions</span>
					<nav class="flex flex-wrap items-center gap-4 font-semibold">
						<a href="/imprint" class="hover:text-indigo-600 transition-colors">Imprint (Impressum)</a>
						<a href="/GDPR" class="hover:text-indigo-600 transition-colors">Data Privacy (GDPR)</a>
						<a href="/gdpr-self-service" class="text-indigo-600 hover:text-indigo-700 transition-colors">
							GDPR Art. 17 Self-Service
						</a>
						{#if isOperator}
							<a href="/contacts" class="hover:text-indigo-600 transition-colors">Encrypted Contacts</a>
						{/if}
					</nav>
				</div>
			</footer>
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}

<Toaster richColors position="top-right" />
