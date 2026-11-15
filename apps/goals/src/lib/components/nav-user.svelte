<script lang="ts">
	import * as Avatar from "@ac/ui/components/avatar";
	import * as DropdownMenu from "@ac/ui/components/dropdown-menu";
	import * as Sidebar from "@ac/ui/components/sidebar";
	import { useSidebar } from "@ac/ui/components/sidebar";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import TargetIcon from "@lucide/svelte/icons/target";
	import PlusCircleIcon from "@lucide/svelte/icons/plus-circle";
	import { goto } from "$app/navigation";
	import { authClient } from "#lib/auth.js";

	let {
		user,
	}: {
		user: {
			name: string;
			email: string;
			avatar?: string;
		};
	} = $props();

	const sidebar = useSidebar();

	async function handleSignOut() {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					void goto("/");
				},
			},
		});
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props }: { props: any })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<Avatar.Root class="h-8 w-8 rounded-lg">
							<Avatar.Image src={user.avatar} alt={user.name} />
							<Avatar.Fallback class="rounded-lg">
								{user.name?.charAt(0).toUpperCase() || "?"}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">{user.name}</span>
							<span class="text-muted-foreground truncate text-xs"
								>{user.email}</span
							>
						</div>
						<ChevronsUpDownIcon class="ml-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-[--bits-dropdown-menu-anchor-width] min-w-56 rounded-lg"
				side={sidebar.isMobile ? "bottom" : "right"}
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Label class="p-0 font-normal">
					<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<Avatar.Root class="h-8 w-8 rounded-lg">
							<Avatar.Image src={user.avatar} alt={user.name} />
							<Avatar.Fallback class="rounded-lg">
								{user.name?.charAt(0).toUpperCase() || "?"}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">{user.name}</span>
							<span class="text-muted-foreground truncate text-xs"
								>{user.email}</span
							>
						</div>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item>
						<a href="/goals" class="flex items-center gap-2 w-full h-full">
							<TargetIcon class="size-4" />
							Browse Campaigns
						</a>
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<a href="/goals/new" class="flex items-center gap-2 w-full h-full">
							<PlusCircleIcon class="size-4" />
							Start a Campaign
						</a>
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item onclick={handleSignOut}>
						<LogOutIcon class="size-4" />
						Log out
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
