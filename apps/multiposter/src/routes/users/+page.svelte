<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { listUsers } from "./list.remote";
	import { deleteUser } from "./[id]/delete.remote";

	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
	import Button from "#lib/components/ui/button/button.svelte";
	import {
		User as UserIcon,
		Pencil,
		Trash2,
		Eye,
		Mail,
		Shield,
		Calendar as CalendarIcon,
		Plus,
		Search,
		ChevronDown,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight,
		Check,
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "#lib/utils/idb.js";
	import { page as pageState } from "$app/state";
	import { goto } from "$app/navigation";

	import {
		FilterMenu,
		ActiveFilterChips,
		BulkActionToolbar,
		initPageFromUrl,
		syncPageToUrl,
		recordActiveItem,
		activeItemAnchor,
		LoadingSection,
		ErrorSection,
		type FilterGroup,
		type FilterStateMap
	} from "@ac/ui";

	let sortField = $state<"createdAt" | "name" | "email">("createdAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let filterValues = $state<FilterStateMap>({});
	const page = $derived(initPageFromUrl(pageState.url));
	let limit = $state(50);

	function setPage(newPage: number) {
		syncPageToUrl("users", newPage, pageState.url, goto);
	}

	import { getUserFilterGroups } from "#lib/filters/index.js";

	const filterGroups = $derived<FilterGroup[]>(getUserFilterGroups(m));

	function savePrefs(sf: typeof sortField, so: typeof sortOrder, fv: FilterStateMap) {
		setPreference("usersFilters", JSON.stringify({ sortField: sf, sortOrder: so, filterValues: fv })).catch(console.error);
	}

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("usersFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				if (prefs.filterValues) filterValues = prefs.filterValues;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery || undefined,
		role: (filterValues.role?.include?.length || filterValues.role?.exclude?.length) ? filterValues.role : undefined,
		sortField,
		sortOrder,
	});

	let selectedIds = $state<string[]>([]);
	const usersQuery = $derived(listUsers(filterState));
	const usersRes = $derived(usersQuery.current);
	const userItems = $derived(usersRes?.data ?? []);
	const total = $derived(usersRes?.total ?? 0);
	const totalPages = $derived(Math.ceil(total / limit));

	async function handleBulkDelete() {
		if (selectedIds.length === 0) return;
		const confirmMsg = m.delete_confirm?.({ item: `${selectedIds.length} ${m.user ? m.user() : 'users'}` }) || `Delete ${selectedIds.length} users?`;
		if (!window.confirm(confirmMsg)) return;
		try {
			await deleteUser(selectedIds);
			toast.success(m.delete_successful?.() || 'Deleted successfully');
			selectedIds = [];
			await usersQuery.refresh();
		} catch (e: any) {
			toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
		}
	}

	async function handleDelete(user: any) {
		if (!window.confirm(m.delete_confirm({ item: m.user ? m.user() : "User" }))) return;
		try {
			await deleteUser([user.id]);
			toast.success(m.delete_successful());
			await usersQuery.refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

	function formatRoles(user: any) {
		const roles = Array.isArray(user.roles) ? user.roles : [];
		if (roles.length === 0) return m.role_user();
		return roles.join(", ");
	}

</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="users" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{m.feature_users_title()}</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{m.feature_users_description()}</p>
			</div>
			<!-- Optional: New user creation link -->
		</div>

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					placeholder={m.search_users()}
					bind:value={searchQuery}
					oninput={() => setPage(1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<FilterMenu
					groups={filterGroups}
					bind:filters={filterValues}
					buttonLabel={m.filters()}
					onchange={() => setPage(1)}
				/>

				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
					<select
						bind:value={sortField}
						onchange={() => savePrefs(sortField, sortOrder, filterValues)}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="createdAt">{m.sort_joined_date()}</option>
						<option value="name">{m.sort_name()}</option>
						<option value="email">{m.sort_email()}</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() => {
							sortOrder = sortOrder === "desc" ? "asc" : "desc";
							savePrefs(sortField, sortOrder, filterValues);
						}}
						title={sortOrder === "desc" ? m.descending() : m.ascending()}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
					</button>
				</div>
			</div>
		</div>

		<!-- Active Filter Chips -->
		<ActiveFilterChips
			groups={filterGroups}
			filters={filterValues}
			activeFiltersLabel={m.active_filters()}
			clearAllLabel={m.clear_all_filters()}
			onremove={(groupId: string, optId: string, type: "include" | "exclude") => {
				const current = filterValues[groupId] || { include: [], exclude: [] };
				filterValues = {
					...filterValues,
					[groupId]: {
						include: type === "include" ? current.include.filter((id) => id !== optId) : current.include,
						exclude: type === "exclude" ? current.exclude.filter((id) => id !== optId) : current.exclude,
					},
				};
				setPage(1);
			}}
			onclearall={() => {
				const reset: FilterStateMap = {};
				for (const g of filterGroups) {
					reset[g.id] = { include: [], exclude: [] };
				}
				filterValues = reset;
				setPage(1);
			}}
		/>

		{#if usersQuery.loading && !usersRes}
			<LoadingSection message={m.loading ? m.loading() : "Loading users..."} />
		{:else if usersQuery.error}
			<ErrorSection
				headline="Error"
				message={usersQuery.error.message || "Failed to load users"}
				href="/users"
			/>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
				{#each userItems as user (user.id)}
					<div
						id="item-{user.id}"
						use:activeItemAnchor={{ feature: 'users', id: user.id }}
						class="group relative bg-white dark:bg-gray-900 rounded-2xl p-6 border transition-all duration-300 {selectedIds.includes(user.id)
							? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xl bg-blue-50/10 dark:bg-blue-950/20'
							: 'border-gray-100 dark:border-gray-800 hover:shadow-xl hover:border-blue-200'}"
					>
							<div class="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
								<div class="flex items-center gap-3 shrink-0">
									<input
										type="checkbox"
										bind:group={selectedIds}
										value={user.id}
										class="h-4.5 w-4.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer mt-1 flex-shrink-0 transition-colors"
										title={selectedIds.includes(user.id) ? "Deselect" : "Select"}
									/>
									<a
										href={`/users/${user.id}`}
										onclick={() => recordActiveItem("users", user.id)}
										class="shrink-0"
									>
										{#if user.image}
											<img
												src={user.image}
												alt={user.name}
												class="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md group-hover:scale-105 transition-transform"
											/>
										{:else}
											<div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center border border-blue-200 shadow-sm group-hover:scale-105 transition-transform">
												<UserIcon size={28} class="text-blue-600" />
											</div>
										{/if}
									</a>
								</div>

								<div class="flex-1 min-w-0 space-y-3">
									<div>
										<a
											href={`/users/${user.id}`}
											onclick={() => recordActiveItem("users", user.id)}
											class="text-xl font-black text-gray-900 dark:text-gray-100 hover:underline group-hover:text-blue-600 transition-colors truncate block"
										>
											{user.name}
										</a>
										<div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
											<Mail size={14} class="text-blue-400" />
											<span class="text-sm font-medium truncate">{user.email}</span>
										</div>
									</div>

									<div class="flex flex-wrap gap-2">
										<div class="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-black uppercase tracking-wider border border-blue-100 dark:border-blue-800">
											<Shield size={12} />
											{formatRoles(user)}
										</div>
									</div>

									<div class="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">
										<CalendarIcon size={12} />
										{m.joined_label()} {new Date(user.createdAt).toLocaleDateString()}
									</div>
								</div>

								<div class="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all transform translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
									<Button
										href={`/users/${user.id}`}
										onclick={() => recordActiveItem("users", user.id)}
										variant="ghost"
										class="flex-1 sm:flex-none justify-start px-4 h-10 hover:bg-blue-50 hover:text-blue-600 rounded-xl"
									>
										<Pencil size={16} class="mr-2" />
										{m.edit()}
									</Button>
									<button
										onclick={() => handleDelete(user)}
										class="flex-1 sm:flex-none inline-flex items-center justify-start whitespace-nowrap text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-600 rounded-xl px-4 h-10 text-red-500"
									>
										<Trash2 size={16} class="mr-2" />
										{m.delete()}
									</button>
								</div>
							</div>
						</div>
						{:else}
						<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
							<UserIcon class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
							<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
								{m.no_users_found()}
							</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Try adjusting your search or filters.
							</p>
						</div>
						{/each}
					</div>

					<!-- Pagination -->
					{#if total > limit}
						<div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
							<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
								<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</span>
								<div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
									<select
										bind:value={limit}
										onchange={() => setPage(1)}
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
									onclick={() => setPage(1)}
									class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
									title="First page"
								>
									<ChevronsLeft size={16} />
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={page === 1}
									onclick={() => page > 1 && setPage(page - 1)}
									class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
								>
									<ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
									Previous
								</Button>
								<div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700 dark:text-gray-300">
									<select
										value={page}
										onchange={(e) => setPage(Number(e.currentTarget.value))}
										class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 min-w-[2.5rem]"
									>
										{#each Array(totalPages) as _, i (i)}
											<option value={i + 1}>{i + 1}</option>
										{/each}
									</select>
									<span class="text-gray-400">/ {totalPages}</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={page === totalPages}
									onclick={() => page < totalPages && setPage(page + 1)}
									class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
								>
									Next
									<ArrowRight size={16} class="ml-1.5 hidden sm:block" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onclick={() => setPage(totalPages)}
									class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
									title="Last page"
								>
									<ChevronsRight size={16} />
								</Button>
							</div>
						</div>
					{/if}
				{/if}

		<BulkActionToolbar
			{selectedIds}
			totalCount={userItems.length}
			onSelectAll={() => (selectedIds = userItems.map((u: any) => u.id))}
			onDeselectAll={() => (selectedIds = [])}
			onDelete={handleBulkDelete}
			deleteLabel={m.delete ? m.delete() : "Delete"}
			selectAllLabel={m.select_all ? m.select_all() : `Select All (${userItems.length})`}
			deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
		/>
	</div>
</div>


