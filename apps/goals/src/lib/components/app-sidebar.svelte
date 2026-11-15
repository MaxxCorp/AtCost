<script lang="ts">
	import NavMain from "./nav-main.svelte";
	import NavUser from "./nav-user.svelte";
	import * as Sidebar from "@ac/ui/components/sidebar";
	import type { ComponentProps } from "svelte";
	import { getVisibleFeatures } from "#lib/features.js";
	import { hasAccess } from "#lib/authorization.js";
	import { ICONS } from "#lib/icons.js";
	import { getCurrentSessionUser } from "../../routes/goals/list.remote.js";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import UserPlusIcon from "@lucide/svelte/icons/user-plus";
	import TargetIcon from "@lucide/svelte/icons/target";
	import ShieldIcon from "@lucide/svelte/icons/shield";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		...restProps
	}: ComponentProps<typeof Sidebar.Root> = $props();

	const sessionQuery = getCurrentSessionUser({});
	const currentUser = $derived(sessionQuery.current?.user ?? null);

	const navMain = $derived.by(() => {
		const platformFeatures = getVisibleFeatures(currentUser, hasAccess);

		const campaigns = platformFeatures
			.filter((f) => (f.category as string) === "campaigns" || f.category === "community")
			.map((f) => ({
				title: f.title,
				url: f.href,
				iconPath: ICONS[f.icon]?.path,
			}));

		if (!campaigns.some((item) => item.url === "/goals/new")) {
			campaigns.push({
				title: "Launch Campaign",
				url: "/goals/new",
				iconPath: ICONS.plus?.path,
			});
		}

		const management = platformFeatures
			.filter((f) => (f.category as string) === "management" || f.category === "operator")
			.map((f) => ({
				title: f.title,
				url: f.href,
				iconPath: ICONS[f.icon]?.path,
			}));

		const groups: {
			title: string;
			url: string;
			icon: any;
			isActive: boolean;
			items: { title: string; url: string; iconPath?: string }[];
		}[] = [];

		if (campaigns.length > 0) {
			groups.push({
				title: "Goal Campaigns",
				url: "/goals",
				icon: TargetIcon,
				isActive: true,
				items: campaigns,
			});
		}

		if (management.length > 0) {
			groups.push({
				title: "Operator Management",
				url: "/goals/approvals",
				icon: ShieldIcon,
				isActive: true,
				items: management,
			});
		}

		return groups;
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
					{#snippet child({ props }: { props: any })}
						<a href="/" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shrink-0"
							>
								<span class="font-bold text-xs">AC</span>
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold text-lg text-gray-900">
									AC-Goals
								</span>
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
		<div class="px-2 py-1.5 border-b border-sidebar-border/60 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-x-2 gap-y-1 group-data-[collapsible=icon]:hidden">
			<a href="/imprint" class="hover:text-foreground hover:underline font-medium">Imprint</a>
			<span>·</span>
			<a href="/GDPR" class="hover:text-foreground hover:underline font-medium">Data Privacy</a>
			<span>·</span>
			<a href="/gdpr-self-service" class="text-indigo-600 hover:text-indigo-700 hover:underline font-semibold">
				GDPR Self-Service
			</a>
		</div>
		{#if currentUser}
			<NavUser
				user={{
					name: currentUser.name || currentUser.email,
					email: currentUser.email,
					avatar: currentUser.image ?? undefined,
				}}
			/>
		{:else}
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Log In">
						{#snippet child({ props }: { props: any })}
							<a href="/login" {...props}>
								<LogInIcon />
								<span>Log In</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Register to Participate">
						{#snippet child({ props }: { props: any })}
							<a href="/signup" {...props}>
								<UserPlusIcon />
								<span>Register to Participate</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		{/if}
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
