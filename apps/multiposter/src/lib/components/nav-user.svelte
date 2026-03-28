<script lang="ts">
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { useSidebar } from "$lib/components/ui/sidebar/index.js";
	import ChevronsUpDownIcon from "$lib/components/icons/chevrons-up-down.svelte";
	import LogOutIcon from "$lib/components/icons/log-out.svelte";
	import GlobeIcon from "$lib/components/icons/globe.svelte";
	import { authClient } from "$lib/auth";
	import { setLocale, getLocale } from "$lib/paraglide/runtime.js";
	import * as m from "$lib/paraglide/messages.js";

	let { user }: { user: { name: string; email: string; avatar?: string } } =
		$props();
	const sidebar = useSidebar();

	async function handleSignOut() {
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = "/login";
					},
				},
			});
		} catch (error) {
			console.error("Sign out failed:", error);
		}
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						{...props}
					>
						<Avatar.Root class="size-8 rounded-lg">
							<Avatar.Image src={user.avatar} alt={user.name} />
							<Avatar.Fallback
								class="rounded-lg text-xs leading-none"
							>
								{user.name?.charAt(0).toUpperCase() ||
									user.email?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div
							class="grid flex-1 text-start text-sm leading-tight"
						>
							<span class="truncate font-medium">{user.name}</span
							>
							<span class="truncate text-xs">{user.email}</span>
						</div>
						<ChevronsUpDownIcon class="ms-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				side={sidebar.isMobile ? "bottom" : "right"}
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Label class="p-0 font-normal">
					<div
						class="flex items-center gap-2 px-1 py-1.5 text-start text-sm"
					>
						<Avatar.Root class="size-8 rounded-lg">
							<Avatar.Image src={user.avatar} alt={user.name} />
							<Avatar.Fallback
								class="rounded-lg text-xs leading-none"
							>
								{user.name?.charAt(0).toUpperCase() ||
									user.email?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div
							class="grid flex-1 text-start text-sm leading-tight"
						>
							<span class="truncate font-medium">{user.name}</span
							>
							<span class="truncate text-xs">{user.email}</span>
						</div>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Label
						class="text-xs text-muted-foreground px-2 py-1.5"
						>{m.language()}</DropdownMenu.Label
					>
					<DropdownMenu.Item
						onclick={() => setLocale("en")}
						class={getLocale() === "en" ? "bg-accent" : ""}
					>
						<GlobeIcon class="size-4 mr-2" />
						<span>English</span>
						{#if getLocale() === "en"}
							<span class="ml-auto text-blue-600">âœ“</span>
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={() => setLocale("de")}
						class={getLocale() === "de" ? "bg-accent" : ""}
					>
						<GlobeIcon class="size-4 mr-2" />
						<span>Deutsch</span>
						{#if getLocale() === "de"}
							<span class="ml-auto text-blue-600">âœ“</span>
						{/if}
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={handleSignOut}>
					<LogOutIcon />
					{m.sign_out()}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
