<script lang="ts">
	import * as Collapsible from "@ac/ui/components/collapsible";
	import * as Sidebar from "@ac/ui/components/sidebar";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import type { ComponentProps } from "svelte";

	type NavItem = {
		title: string;
		url: string;
		icon?: any;
		isActive?: boolean;
		items?: {
			title: string;
			url: string;
			iconPath?: string;
		}[];
	};

	let {
		items = [],
	}: {
		items: NavItem[];
	} = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Platform</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#each items as item}
			<Collapsible.Root open={item.isActive} class="group/collapsible">
				<Sidebar.MenuItem>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<Sidebar.MenuButton {...props} tooltipContent={item.title}>
								{#if item.icon}
									<item.icon />
								{/if}
								<span>{item.title}</span>
								<ChevronRightIcon
									class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
								/>
							</Sidebar.MenuButton>
						{/snippet}
					</Collapsible.Trigger>
					<Collapsible.Content>
						<Sidebar.MenuSub>
							{#each item.items ?? [] as subItem}
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubButton>
										{#snippet child({ props })}
											<a href={subItem.url} {...props}>
												{#if subItem.iconPath}
													<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d={subItem.iconPath} />
													</svg>
												{/if}
												<span>{subItem.title}</span>
											</a>
										{/snippet}
									</Sidebar.MenuSubButton>
								</Sidebar.MenuSubItem>
							{/each}
						</Sidebar.MenuSub>
					</Collapsible.Content>
				</Sidebar.MenuItem>
			</Collapsible.Root>
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
