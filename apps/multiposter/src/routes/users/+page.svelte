<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { listUsers } from "./list.remote";
	import { deleteUser } from "./[id]/delete.remote";

	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
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
		ChevronsRight
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";

	let sortField = $state<"createdAt" | "name" | "email">("createdAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let page = $state(1);
	let limit = $state(50);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("usersFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	$effect(() => {
		const prefsToSave = {
			sortField,
			sortOrder,
		};
		setPreference("usersFilters", JSON.stringify(prefsToSave)).catch(console.error);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		sortField,
		sortOrder,
	});

	async function handleDelete(user: any) {
		if (!window.confirm(m.delete_confirm({ item: "User" }))) return;
		try {
			await deleteUser([user.id]);
			toast.success(m.delete_successful());
			listUsers(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

	function formatRoles(user: any) {
		const roles = Array.isArray(user.roles) ? user.roles : [];
		if (roles.length === 0) return m.role_user();
		return roles.join(", ");
	}
	let query = $derived(listUsers(filterState));
	let res = $derived(query.current);
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="users" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
					{m.users()}
				</h1>
			</div>
			<!-- Optional: New user creation link -->
		</div>

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					placeholder="Search users..."
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
					<select
						bind:value={sortField}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="createdAt">Joined Date</option>
						<option value="name">Name</option>
						<option value="email">Email</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() => (sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc" ? "Descending" : "Ascending"}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
					</button>
				</div>
			</div>
		</div>

		<!-- List -->
		<div class="grid grid-cols-1 gap-5">

			{#if query.loading && !query.current}
				<div class="col-span-full py-12 text-center text-gray-500">Loading...</div>
			{:else if query.error}
				<div class="col-span-full py-12 text-center text-red-500">{query.error.message}</div>
			{:else}
				{#each query.current?.data || [] as user (user.id)}
				<div class="group relative bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
					<div class="flex flex-col sm:flex-row items-start gap-6">
						<div class="flex items-center gap-4 shrink-0">
							<a href={`/users/${user.id}`} class="shrink-0">
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
								<a href={`/users/${user.id}`} class="text-xl font-black text-gray-900 dark:text-gray-100 hover:underline group-hover:text-blue-600 transition-colors truncate block">
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

						<div class="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
							<Button
								href={`/users/${user.id}`}
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
			{/if}
		</div>

		<!-- Pagination -->

		{#if query.current && query.current.total > limit}
				{@const totalPages = Math.ceil(query.current.total / limit)}
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
					<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
						<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, query.current.total)} of {query.current.total}</span>
						<div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
							<select
								bind:value={limit}
								onchange={() => (page = 1)}
								class="text-xs bg-transparent border-gray-200 dark:border-gray-700 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
							>
								<option value={10}>10 per page</option>
								<option value={20}>20 per page</option>
								<option value={50}>50 per page</option>
								<option value={100}>100 per page</option>
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
	</div>
</div>


