<script lang="ts">
  import * as m from "$lib/paraglide/messages";
  import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
  import { listTalentGroups, createTalentGroup } from "./talent-groups.remote";
  import {
    createTalentGroupSchema,
    TALENT_GROUP_TYPES,
    type TalentGroupOverview,
  } from "@ac/validations";
  import { Button, AsyncButton, EmptyState, LoadingSection, ErrorSection } from "@ac/ui";
  import * as Dialog from "@ac/ui/components/dialog";
  import {
    Users,
    Folder,
    Plus,
    Search,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    Sparkles,
    Layers,
    X,
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  breadcrumbState.set({ feature: "talents", current: m.talent_groups() });

  let searchQuery = $state("");
  let selectedTypeFilter = $state<string | null>(null);
  let showCreateDialog = $state(false);
  let selectedCreateType = $state<string>(TALENT_GROUP_TYPES[0] || "Type1");
  let expandedTypes = $state<Record<string, boolean>>({});

  const DEFAULT_COLLAPSED_LIMIT = 4;

  const filterState = $derived({
    search: searchQuery.trim() || undefined,
    type: selectedTypeFilter || undefined,
  });

  function toggleExpandType(type: string) {
    expandedTypes[type] = !expandedTypes[type];
  }

  function openCreateForType(type?: string) {
    if (type) {
      selectedCreateType = type;
    }
    showCreateDialog = true;
  }

  const typeColorAccents: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
    Type1: { bg: "bg-indigo-600", text: "text-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-50/70" },
    Type2: { bg: "bg-emerald-600", text: "text-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-50/70" },
    Type3: { bg: "bg-amber-600", text: "text-amber-700", border: "border-amber-200", lightBg: "bg-amber-50/70" },
  };

  function getTypeAccent(type: string) {
    return (
      typeColorAccents[type] || {
        bg: "bg-purple-600",
        text: "text-purple-700",
        border: "border-purple-200",
        lightBg: "bg-purple-50/70",
      }
    );
  }
</script>

<div class="space-y-8 container mx-auto px-4 py-6 max-w-6xl">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200/80 pb-6">
    <div>
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
          <Layers class="w-6 h-6" />
        </div>
        <h1 class="text-3xl font-black text-gray-900 tracking-tight">{m.talent_groups()}</h1>
      </div>
      <p class="text-gray-500 mt-2 font-medium">
        {m.talent_groups_description()}
      </p>
    </div>

    <Button onclick={() => openCreateForType()} class="shadow-sm">
      <Plus class="w-4 h-4 mr-2" />
      {m.create_group()}
    </Button>
  </div>

  <!-- Search & Type Filter Toolbar -->
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="relative flex-1">
      <Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder={m.search_groups_placeholder()}
        bind:value={searchQuery}
        class="pl-10 pr-9 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs transition-all placeholder:text-gray-400"
      />
      {#if searchQuery}
        <button
          type="button"
          onclick={() => (searchQuery = "")}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      {/if}
    </div>

    <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
      <button
        type="button"
        onclick={() => (selectedTypeFilter = null)}
        class="px-3.5 py-2 text-xs font-bold rounded-xl border transition-all {selectedTypeFilter === null
          ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}"
      >
        {m.all_types()}
      </button>

      {#each TALENT_GROUP_TYPES as typeName}
        <button
          type="button"
          onclick={() => (selectedTypeFilter = selectedTypeFilter === typeName ? null : typeName)}
          class="px-3.5 py-2 text-xs font-bold rounded-xl border transition-all {selectedTypeFilter === typeName
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}"
        >
          {typeName}
        </button>
      {/each}
    </div>
  </div>

  <!-- Main Content: Groups grouped by Type in Expandable Rows -->
  <svelte:boundary>
    {#if $effect.pending()}
      <LoadingSection message={m.loading_talent_groups()} />
    {/if}

    <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
      {#await listTalentGroups(filterState)}
        <LoadingSection message={m.loading_talent_groups()} />
      {:then result}
        {@const allGroups = result?.data || []}
        {@const knownTypes = Array.from(
          new Set([...TALENT_GROUP_TYPES, ...allGroups.map((g) => g.type)])
        )}
        {@const displayTypes = selectedTypeFilter
          ? knownTypes.filter((t) => t === selectedTypeFilter)
          : knownTypes}

        {#if allGroups.length === 0}
          <div class="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-xs">
            <div class="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Folder class="w-7 h-7" />
            </div>
            <h3 class="text-lg font-bold text-gray-900">
              {searchQuery ? m.no_matching_groups_found() : m.no_groups_created_yet()}
            </h3>
            <p class="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto">
              {searchQuery
                ? m.no_groups_match_query({ query: searchQuery })
                : m.create_first_group_desc()}
            </p>
            {#if !searchQuery}
              <div class="mt-6">
                <Button onclick={() => openCreateForType()}>
                  <Plus class="w-4 h-4 mr-2" />
                  {m.create_first_group()}
                </Button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="space-y-8">
            {#each displayTypes as typeName (typeName)}
              {@const groupsForType = allGroups.filter((g) => g.type === typeName)}
              {@const accent = getTypeAccent(typeName)}
              {@const isExpanded = !!expandedTypes[typeName]}
              {@const hasMore = groupsForType.length > DEFAULT_COLLAPSED_LIMIT}
              {@const visibleGroups = isExpanded
                ? groupsForType
                : groupsForType.slice(0, DEFAULT_COLLAPSED_LIMIT)}
              {@const totalMembersInType = groupsForType.reduce(
                (sum, g) => sum + (g.memberCount || 0),
                0
              )}

              <section class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-5">
                <!-- Type Row Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div class="flex items-center gap-3">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider {accent.lightBg} {accent.text} border {accent.border}">
                      {typeName}
                    </span>
                    <span class="text-xs font-semibold text-gray-400">
                      {groupsForType.length} {groupsForType.length === 1 ? "group" : "groups"} · {totalMembersInType} {totalMembersInType === 1 ? "member" : "members"}
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => openCreateForType(typeName)}
                      class="text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <Plus size={14} class="mr-1" />
                      {m.add_to_type({ type: typeName })}
                    </Button>

                    {#if hasMore}
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => toggleExpandType(typeName)}
                        class="text-xs font-semibold rounded-xl border-gray-200"
                      >
                        {#if isExpanded}
                          <ChevronUp size={14} class="mr-1.5" />
                          {m.show_less()}
                        {:else}
                          <ChevronDown size={14} class="mr-1.5" />
                          {m.show_all_count({ count: groupsForType.length })}
                        {/if}
                      </Button>
                    {/if}
                  </div>
                </div>

                <!-- Row of Groups -->
                {#if groupsForType.length === 0}
                  <div class="py-6 px-4 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200 text-center">
                    <p class="text-xs font-medium text-gray-400">
                      {m.no_groups_in_type_yet({ type: typeName })}
                    </p>
                    <button
                      type="button"
                      onclick={() => openCreateForType(typeName)}
                      class="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {m.create_type_group({ type: typeName })}
                    </button>
                  </div>
                {:else}
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {#each visibleGroups as group (group.id)}
                      <a
                        href="/talent-groups/{group.id}"
                        class="group relative bg-gray-50/50 hover:bg-white rounded-2xl p-5 border border-gray-200/70 hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                      >
                        <div class="space-y-3">
                          <div class="flex items-start justify-between gap-2">
                            <div class="w-10 h-10 rounded-xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-center text-indigo-600 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                              <Users size={20} />
                            </div>

                            <span class="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-white px-2 py-0.5 rounded-full border border-gray-200/70">
                              <Users size={12} class="text-indigo-500" />
                              {group.memberCount ?? 0}
                            </span>
                          </div>

                          <div>
                            <h4 class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors text-base tracking-tight truncate">
                              {group.name}
                            </h4>
                            <p class="text-[11px] font-medium text-gray-400 mt-0.5">
                              Created {new Date(group.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                          <span>{m.manage_group()}</span>
                          <ArrowRight size={14} />
                        </div>
                      </a>
                    {/each}

                    {#if hasMore && !isExpanded}
                      <button
                        type="button"
                        onclick={() => toggleExpandType(typeName)}
                        class="bg-gray-50/30 hover:bg-indigo-50/50 rounded-2xl p-5 border border-dashed border-gray-300 hover:border-indigo-300 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px]"
                      >
                        <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-indigo-600 mb-2 shadow-xs">
                          <Plus size={16} />
                        </div>
                        <span class="text-xs font-bold text-gray-700">
                          {m.more_type_groups({ count: groupsForType.length - DEFAULT_COLLAPSED_LIMIT, type: typeName, label: groupsForType.length - DEFAULT_COLLAPSED_LIMIT === 1 ? "group" : "groups" })}
                        </span>
                        <span class="text-[11px] text-gray-400 mt-0.5">{m.click_to_view_all()}</span>
                      </button>
                    {/if}
                  </div>
                {/if}
              </section>
            {/each}
          </div>
        {/if}
      {/await}
    </div>

    {#snippet failed(error: unknown)}
      <ErrorSection
        headline="Error loading talent groups"
        message={error instanceof Error ? error.message : "An unexpected error occurred."}
      />
    {/snippet}
  </svelte:boundary>
</div>

<!-- Create Group Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
  <Dialog.Content class="sm:max-w-[480px]">
    <Dialog.Header>
      <Dialog.Title class="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Sparkles class="text-indigo-600" size={20} />
        {m.create_group()}
      </Dialog.Title>
      <Dialog.Description class="text-sm text-gray-500">
        {m.create_group_dialog_desc()}
      </Dialog.Description>
    </Dialog.Header>

    <form class="space-y-4 pt-3" {...createTalentGroup.preflight(createTalentGroupSchema).enhance(async ({ submit }) => {
        try {
          await submit();
          toast.success(m.group_created_success());
          showCreateDialog = false;
          listTalentGroups(filterState).refresh();
        } catch (error: any) {
          toast.error(error?.message || m.failed_to_create_group());
        }
      })}
    >
  
      <div class="space-y-1.5">
        <label for="group-name" class="text-xs font-bold uppercase tracking-wider text-gray-700">
          {m.group_name()}
        </label>
        <input
          id="group-name"
          {...createTalentGroup.fields.name.as("text")}
          placeholder={m.group_name_placeholder()}
          class="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all {(createTalentGroup.fields.name.issues?.() ?? []).length > 0 ? 'border-red-500' : 'border-gray-200'}"
          required
        />
        {#each createTalentGroup.fields.name.issues?.() ?? [] as issue}
          <p class="text-xs font-medium text-red-600 mt-1">{issue.message}</p>
        {/each}
      </div>

      <div class="space-y-1.5">
        <label for="group-type" class="text-xs font-bold uppercase tracking-wider text-gray-700">
          {m.group_type()}
        </label>
        <select
          id="group-type"
          {...createTalentGroup.fields.type.as("select")}
          bind:value={selectedCreateType}
          class="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-gray-200"
          required
        >
          {#each TALENT_GROUP_TYPES as typeOption}
            <option value={typeOption}>{typeOption}</option>
          {/each}
        </select>
        {#each createTalentGroup.fields.type.issues?.() ?? [] as issue}
          <p class="text-xs font-medium text-red-600 mt-1">{issue.message}</p>
        {/each}
      </div>

      <Dialog.Footer class="pt-4 gap-2">
        <Button
          type="button"
          variant="outline"
          onclick={() => (showCreateDialog = false)}
        >
          {m.cancel()}
        </Button>
        <AsyncButton
          type="submit"
          loadingLabel={m.creating()}
          loading={createTalentGroup.pending}
          class="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {m.create_group()}
        </AsyncButton>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
