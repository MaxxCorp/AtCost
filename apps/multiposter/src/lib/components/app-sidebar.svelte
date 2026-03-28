<script lang="ts">
	import NavMain from "./nav-main.svelte";
	import NavUser from "./nav-user.svelte";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps } from "svelte";
	import { getVisibleFeatures } from "$lib/features";
	import { hasAccess } from "$lib/authorization";
	import { authClient } from "$lib/auth";
	import { onMount } from "svelte";
	import { ICONS } from "$lib/icons";
	import FileTextIcon from "$lib/components/icons/file-text.svelte";
	import LayersIcon from "$lib/components/icons/layers.svelte";
	import LogInIcon from "$lib/components/icons/log-in.svelte";
	import UserPlusIcon from "$lib/components/icons/user-plus.svelte";
	import * as m from "$lib/paraglide/messages.js";
	import { setLocale, getLocale } from "$lib/paraglide/runtime.js";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		...restProps
	}: ComponentProps<typeof Sidebar.Root> = $props();

	let user = $state<any>(null);
	let navMain = $state<any[]>([]);

	onMount(async () => {
		const session = await authClient.getSession();
		if (session?.data?.user) {
			user = session.data.user;

			const platformFeatures = getVisibleFeatures(user, hasAccess).map(
				(f) => ({
					title: f.title(),
					url: f.href,
					iconPath: ICONS[f.icon].path,
				}),
			);

			navMain = [
				{
					title: m.features(),
					url: "#",
					icon: LayersIcon,
					isActive: true,
					items: platformFeatures,
				},
			];
		}
	});
</script>

<Sidebar.Root {collapsible} {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					size="lg"
					class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
				>
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white shrink-0"
							>
								<span class="font-bold text-xs">AC</span>
							</div>
							<div
								class="grid flex-1 text-left text-sm leading-tight"
							>
								<span
									class="truncate font-semibold text-lg text-gray-900"
									>{m.multiposter()}</span
								>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<NavMain items={navMain} />
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton tooltipContent={m.imprint()}>
					{#snippet child({ props })}
						<a href="/imprint" {...props}>
							<FileTextIcon />
							<span>{m.imprint()}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton tooltipContent={m.data_privacy()}>
					{#snippet child({ props })}
						<a href="/GDPR" {...props}>
							<FileTextIcon />
							<span>{m.data_privacy()}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>

		{#if user}
			<NavUser
				user={{
					name: user.name || user.email,
					email: user.email,
					avatar: user.image,
				}}
			/>
		{:else}
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent={m.log_in()}>
						{#snippet child({ props })}
							<a href="/login" {...props}>
								<LogInIcon />
								<span>{m.log_in()}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent={m.sign_up()}>
						{#snippet child({ props })}
							<a href="/signup" {...props}>
								<UserPlusIcon />
								<span>{m.sign_up()}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		{/if}
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
