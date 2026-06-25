<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { listContacts } from "./list.remote";
	import { listLocations } from "../locations/list.remote";
	import { listTags } from "../tags/list.remote";
	import { deleteContact } from "./[id]/delete.remote";

	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import {
		User,
		Pencil,
		Trash2,
		Eye,
		Phone,
		Mail,
		MapPin,
		Plus,
		Search,
		Filter as FilterIcon,
		ChevronDown,
		ChevronRight,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight,
		X
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";

	let sortField = $state<"updatedAt" | "createdAt" | "displayName">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let page = $state(1);
	let limit = $state(50);
	let selectedLocationId = $state<string | null>(null);
	let selectedTagId = $state<string | null>(null);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("contactsFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				if (prefs.locationId) selectedLocationId = prefs.locationId;
				if (prefs.tagId) selectedTagId = prefs.tagId;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	$effect(() => {
		const prefsToSave = {
			sortField,
			sortOrder,
			locationId: selectedLocationId,
			tagId: selectedTagId,
		};
		setPreference("contactsFilters", JSON.stringify(prefsToSave)).catch(console.error);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		locationId: selectedLocationId || undefined,
		tagId: selectedTagId || undefined,
		sortField,
		sortOrder,
	});

	const activeFiltersCount = $derived((selectedLocationId ? 1 : 0) + (selectedTagId ? 1 : 0));

	const allLocationsQuery = listLocations({ limit: 1000, sortField: 'name', sortOrder: 'asc' });
	const allTagsQuery = listTags({ limit: 1000, sortField: 'name', sortOrder: 'asc' });

	async function handleDelete(contact: any) {
		if (!window.confirm(m.delete_confirm({ item: "Contact" }))) return;
		try {
			await deleteContact([contact.id]);
			toast.success(m.delete_successful());
			listContacts(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="contacts" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
					{m.feature_contacts_title()}
				</h1>
			</div>
			<Button href="/contacts/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_item({ item: "Contact" })}
			</Button>
		</div>

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					placeholder={m.search_contacts()}
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button variant="outline" class="relative border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
							<FilterIcon size={16} class="mr-2" />
							Filters
							{#if activeFiltersCount > 0}
								<span class="absolute -top-2 -right-2 bg-primary-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
									{activeFiltersCount}
								</span>
							{/if}
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-64 p-2 rounded-xl">
						<div class="px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
							Location
						</div>
						<div class="max-h-48 overflow-y-auto p-1 space-y-0.5">
							<button
								class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors {selectedLocationId === null ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
								onclick={() => { selectedLocationId = null; page = 1; }}
							>
								All Locations
							</button>
							{#await allLocationsQuery then locations}
								{#each locations.data as loc}
									<button
										class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors {selectedLocationId === loc.id ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
										onclick={() => { selectedLocationId = loc.id; page = 1; }}
									>
										{loc.name}
									</button>
								{/each}
							{/await}
						</div>
						
						<DropdownMenu.Separator />

						<div class="px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
							Tag
						</div>
						<div class="max-h-48 overflow-y-auto p-1 space-y-0.5">
							<button
								class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors {selectedTagId === null ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
								onclick={() => { selectedTagId = null; page = 1; }}
							>
								All Tags
							</button>
							{#await allTagsQuery then tags}
								{#each tags.data as tag}
									<button
										class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors {selectedTagId === tag.id ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
										onclick={() => { selectedTagId = tag.id; page = 1; }}
									>
										{tag.name}
									</button>
								{/each}
							{/await}
						</div>

						{#if activeFiltersCount > 0}
							<div class="p-1 mt-2 border-t border-gray-100 dark:border-gray-800">
								<button
									class="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
									onclick={() => { selectedLocationId = null; selectedTagId = null; page = 1; }}
								>
									<X size={14} /> Clear all
								</button>
							</div>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
					<select
						bind:value={sortField}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="updatedAt">{m.sort_last_updated()}</option>
						<option value="createdAt">{m.sort_created_date()}</option>
						<option value="displayName">Name</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() => (sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc" ? m.descending() : m.ascending()}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
					</button>
				</div>
			</div>
		</div>

		<svelte:boundary>
			{#if $effect.pending()}
				<div class="py-12 text-center text-gray-500">Loading...</div>
			{/if}
			<div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
				<!-- List -->
				<div class="grid grid-cols-1 gap-5">
					{#each (await listContacts(filterState)).data || [] as contact (contact.id)}
						<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
							<div class="flex-1 mb-5">
								<div class="flex items-start gap-4">
									<div class="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
										<User size={24} />
									</div>
									<div class="flex-1 min-w-0">
										<a href={`/contacts/${contact.id}/view`} class="block group mb-1">
											<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug truncate transition-colors">
												{contact.displayName || `${contact.givenName || ""} ${contact.familyName || ""}`.trim() || m.unnamed_contact()}
											</h3>
										</a>
										{#if contact.role || contact.company || contact.department}
											<p class="text-sm text-gray-500 dark:text-gray-400 truncate">
												{[contact.role, contact.department, contact.company].filter(Boolean).join(" · ")}
											</p>
										{/if}

										<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
											{#if contact.emails && contact.emails.length > 0}
												<div class="flex items-start gap-2">
													<Mail size={16} class="text-gray-400 mt-1" />
													<div class="flex flex-col">
														{#each contact.emails as email}
															<span class="text-sm text-gray-700 dark:text-gray-300">
																{email.value}
																<span class="text-xs text-gray-400">({email.type})</span>
															</span>
														{/each}
													</div>
												</div>
											{/if}

											{#if contact.phones && contact.phones.length > 0}
												<div class="flex items-start gap-2">
													<Phone size={16} class="text-gray-400 mt-1" />
													<div class="flex flex-col">
														{#each contact.phones as phone}
															<span class="text-sm text-gray-700 dark:text-gray-300">
																{phone.value}
																<span class="text-xs text-gray-400">({phone.type})</span>
															</span>
														{/each}
													</div>
												</div>
											{/if}
										</div>

										{#if contact.addresses && contact.addresses.length > 0}
											<div class="flex items-start gap-2 mt-4">
												<MapPin size={16} class="text-gray-400 mt-1 shrink-0" />
												<div class="flex flex-col">
													{#each contact.addresses as addr}
														<span class="text-sm text-gray-700 dark:text-gray-300 break-words">
															{[addr.street, addr.houseNumber, addr.zip, addr.city].filter(Boolean).join(" ")}
														</span>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>

							<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto">
								<Button variant="outline" size="sm" href={`/contacts/${contact.id}/view`} class="flex-1 sm:flex-none">
									<Eye class="w-4 h-4 mr-2" />
									{m.view()}
								</Button>
								<Button variant="outline" size="sm" href={`/contacts/${contact.id}`} class="flex-1 sm:flex-none">
									<Pencil class="w-4 h-4 mr-2" />
									{m.edit()}
								</Button>
								<button
									class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
									onclick={() => handleDelete(contact)}
								>
									<Trash2 class="w-4 h-4 mr-2" />
									{m.delete()}
								</button>
							</div>
							<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
								{contact.createdAt ? m.updated_on({
									date: new Date(contact.createdAt).toLocaleString([], {
										year: "numeric",
										month: "2-digit",
										day: "2-digit",
										hour: "2-digit",
										minute: "2-digit",
									}),
								}) : ''}
							</div>
						</div>
						{:else}
						<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
							<User class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
							<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
								{m.no_items({ items: m.feature_contacts_title() })}
							</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Try adjusting your search or filters.
							</p>
						</div>
					{/each}

					<!-- Pagination -->
					{#await listContacts(filterState) then res}
					{#if res && res.total > limit}
						{@const totalPages = Math.ceil(res.total / limit)}
						<div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
							<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
								<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, res.total)} of {res.total}</span>
								<div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
									<select
										bind:value={limit}
										onchange={() => (page = 1)}
										class="text-xs bg-transparent border-gray-200 dark:border-gray-700 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
									>
										<option value={10}>{m.items_per_page({ count: 10 })}</option>
										<option value={20}>{m.items_per_page({ count: 20 })}</option>
										<option value={50}>{m.items_per_page({ count: 50 })}</option>
										<option value={100}>{m.items_per_page({ count: 100 })}</option>
									</select>
								</div>
							</div>
							<div class="flex items-center gap-1 sm:gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page === 1}
									onclick={() => page = 1}
									class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
									title="First page"
								>
									<ChevronsLeft size={16} />
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={page === 1}
									onclick={() => page > 1 && page--}
									class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
								>
									<ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
									Previous
								</Button>
								<div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700 dark:text-gray-300">
									<select
										bind:value={page}
										class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 min-w-[2.5rem]"
									>
										{#each Array(totalPages) as _, i}
											<option value={i + 1}>{i + 1}</option>
										{/each}
									</select>
									<span class="text-gray-400">/ {totalPages}</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={page === totalPages}
									onclick={() => page < totalPages && page++}
									class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
								>
									Next
									<ArrowRight size={16} class="ml-1.5 hidden sm:block" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onclick={() => page = totalPages}
									class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
									title="Last page"
								>
									<ChevronsRight size={16} />
								</Button>
							</div>
						</div>
					{/if}
					{/await}
				</div>
			</div>
			{#snippet failed(error: unknown)}
				<div class="py-12 text-center text-red-500">{error instanceof Error ? error.message : "Failed to load."}</div>
			{/snippet}
		</svelte:boundary>
	</div>
</div>

