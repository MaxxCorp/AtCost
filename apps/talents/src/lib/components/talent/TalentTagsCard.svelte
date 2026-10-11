<script lang="ts">
    import { listTags } from '../../../routes/tags/list.remote.js';
    import { listTagCategories } from '../../../routes/tags/categories.remote.js';
    import { updateTalentTagsAction } from '../../../routes/talents/[id]/tags.remote.js';
    import { Button } from '@ac/ui';
    import { Tag as TagIcon, Check, Plus, Globe, Lock, Sparkles, Loader2, X, Search, CheckCircle2 } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';

    interface TagItem {
        id: string;
        name: string;
        color?: string | null;
        visibility?: 'internal' | 'external';
        description?: string | null;
        categoryId?: string | null;
        category?: { id: string; name: string } | null;
    }

    interface Props {
        talentId: string;
        currentTags?: TagItem[];
        onUpdated?: () => void;
    }

    let { talentId, currentTags = [], onUpdated }: Props = $props();

    const tagsQuery = $derived(listTags({ limit: 100 }));
    const categoriesQuery = $derived(listTagCategories({ limit: 50 }));

    const allTags = $derived(tagsQuery.current?.data ?? []);
    const allCategories = $derived(categoriesQuery.current?.data ?? []);

    let selectedTagIds = $state<string[]>([]);
    let isEditing = $state(false);
    let isSaving = $state(false);
    let searchQuery = $state('');
    let selectedCategoryFilter = $state<string>('all');

    // Sync selectedTagIds when currentTags changes and not actively saving
    $effect(() => {
        selectedTagIds = (currentTags || []).map(t => t.id);
    });

    // Preset helper names
    const SALARY_TAG_NAME = 'Gehaltsempfänger (Festgehalt)';
    const HOURLY_TAG_NAME = 'Stundenlohnempfänger (Zeitlohn)';

    const isSalaried = $derived.by(() => {
        return allTags.some(t => t.name.toLowerCase().includes('gehaltsempfänger') && selectedTagIds.includes(t.id));
    });

    const isHourly = $derived.by(() => {
        return allTags.some(t => t.name.toLowerCase().includes('stundenlohnempfänger') && selectedTagIds.includes(t.id));
    });

    function toggleTag(tagId: string) {
        if (selectedTagIds.includes(tagId)) {
            selectedTagIds = selectedTagIds.filter(id => id !== tagId);
        } else {
            selectedTagIds = [...selectedTagIds, tagId];
        }
    }

    function removeTag(tagId: string) {
        selectedTagIds = selectedTagIds.filter(id => id !== tagId);
        void handleSave();
    }

    function setPayrollClassification(type: 'salaried' | 'hourly') {
        const salaryTag = allTags.find(t => t.name.toLowerCase().includes('gehaltsempfänger'));
        const hourlyTag = allTags.find(t => t.name.toLowerCase().includes('stundenlohnempfänger'));

        let next = [...selectedTagIds];

        if (type === 'salaried') {
            if (hourlyTag) next = next.filter(id => id !== hourlyTag.id);
            if (salaryTag && !next.includes(salaryTag.id)) next.push(salaryTag.id);
        } else {
            if (salaryTag) next = next.filter(id => id !== salaryTag.id);
            if (hourlyTag && !next.includes(hourlyTag.id)) next.push(hourlyTag.id);
        }

        selectedTagIds = next;
        void handleSave();
    }

    async function handleSave() {
        if (isSaving) return;
        isSaving = true;
        try {
            await updateTalentTagsAction({
                talentId,
                tagIds: selectedTagIds
            });
            toast.success('Mitarbeiter-Tags erfolgreich aktualisiert');
            isEditing = false;
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || 'Fehler beim Speichern der Tags');
        } finally {
            isSaving = false;
        }
    }

    // Filter available tags for editing selector
    const filteredTags = $derived.by(() => {
        return allTags.filter(t => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = t.name.toLowerCase().includes(q);
                const matchDesc = t.description?.toLowerCase().includes(q);
                if (!matchName && !matchDesc) return false;
            }
            if (selectedCategoryFilter !== 'all') {
                if (selectedCategoryFilter === 'none') {
                    if (t.categoryId) return false;
                } else if (t.categoryId !== selectedCategoryFilter) {
                    return false;
                }
            }
            return true;
        });
    });

    // Group filtered tags by category
    const groupedTags = $derived.by(() => {
        const groups: { categoryId: string | null; categoryName: string; tags: typeof allTags }[] = [];
        
        // Known categories first
        for (const cat of allCategories) {
            const tagsInCat = filteredTags.filter(t => t.categoryId === cat.id);
            if (tagsInCat.length > 0) {
                groups.push({
                    categoryId: cat.id,
                    categoryName: cat.name,
                    tags: tagsInCat
                });
            }
        }

        // Uncategorized tags
        const uncategorized = filteredTags.filter(t => !t.categoryId);
        if (uncategorized.length > 0) {
            groups.push({
                categoryId: null,
                categoryName: 'Allgemein / Keine Kategorie',
                tags: uncategorized
            });
        }

        return groups;
    });

    // Lookup map of all tags for badge display
    const tagsMap = $derived.by(() => {
        const map = new Map<string, TagItem>();
        for (const t of currentTags) {
            map.set(t.id, t);
        }
        for (const t of allTags) {
            map.set(t.id, t as any);
        }
        return map;
    });
</script>

<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
            <div class="flex items-center gap-2.5">
                <div class="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <TagIcon size={20} />
                </div>
                <div>
                    <h2 class="text-xl font-bold text-gray-900 tracking-tight">
                        Mitarbeiter-Klassifizierung & Tags
                    </h2>
                    <p class="text-xs text-gray-500 mt-0.5">
                        Steuert die Gruppierung in Abrechnungsläufen (Gehalt vs. Stundenlohn) und interne Teams.
                    </p>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-2">
            {#if !isEditing}
                <Button 
                    variant="outline" 
                    size="sm" 
                    onclick={() => { isEditing = true; }}
                >
                    <Plus size={16} class="mr-1.5" />
                    Tags zuweisen
                </Button>
            {:else}
                <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={isSaving}
                    onclick={() => { 
                        selectedTagIds = (currentTags || []).map(t => t.id);
                        isEditing = false; 
                    }}
                >
                    Abbrechen
                </Button>
                <Button 
                    variant="primary" 
                    size="sm" 
                    disabled={isSaving}
                    onclick={handleSave}
                >
                    {#if isSaving}
                        <Loader2 size={16} class="mr-1.5 animate-spin" />
                        Speichern...
                    {:else}
                        <Check size={16} class="mr-1.5" />
                        Speichern
                    {/if}
                </Button>
            {/if}
        </div>
    </div>

    <!-- Quick Payroll Classification Shortcuts -->
    <div class="mb-6 p-4 rounded-xl bg-linear-to-r from-slate-50 to-indigo-50/40 border border-indigo-100/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
            <Sparkles size={16} class="text-indigo-600 shrink-0" />
            <span class="text-xs font-semibold text-gray-700">
                Abrechnungs-Schnellklassifizierung:
            </span>
            <div class="flex items-center gap-1.5 flex-wrap">
                {#if isSalaried}
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Gehaltsempfänger
                    </span>
                {:else if isHourly}
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Stundenlohnempfänger
                    </span>
                {:else}
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Nicht eingestuft
                    </span>
                {/if}
            </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <button
                type="button"
                class="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border {isSalaried ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200'}"
                onclick={() => setPayrollClassification('salaried')}
                disabled={isSaving}
            >
                Gehalt (Monatlich)
            </button>
            <button
                type="button"
                class="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border {isHourly ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200'}"
                onclick={() => setPayrollClassification('hourly')}
                disabled={isSaving}
            >
                Stundenlohn (Wöchentlich)
            </button>
        </div>
    </div>

    <!-- Active Tag Badges List -->
    {#if selectedTagIds.length === 0}
        <div class="text-center py-6 px-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
            <TagIcon size={24} class="mx-auto text-gray-400 mb-1.5" />
            <p class="text-sm font-medium text-gray-600">Keine Tags zugewiesen</p>
            <p class="text-xs text-gray-400 mt-0.5">
                Weisen Sie Tags zu, um diesen Mitarbeiter gezielten Abrechnungsgruppen oder Teams zuzuordnen.
            </p>
        </div>
    {:else}
        <div class="flex flex-wrap gap-2">
            {#each selectedTagIds as tagId (tagId)}
                {@const tag = tagsMap.get(tagId)}
                {#if tag}
                    <span 
                        class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-xs transition-all"
                        style={tag.color ? `background-color: ${tag.color}15; color: ${tag.color}; border-color: ${tag.color}35;` : 'background-color: #f3f4f6; color: #374151; border-color: #e5e7eb;'}
                    >
                        {#if tag.color}
                            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {tag.color};"></span>
                        {/if}
                        <span class="font-semibold">{tag.name}</span>

                        {#if tag.category}
                            <span class="text-[10px] px-1.5 py-0.2 rounded bg-black/5 opacity-75 font-normal">
                                {tag.category.name}
                            </span>
                        {/if}

                        {#if tag.visibility === 'external'}
                            <span class="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800" title="Öffentlich sichtbar">
                                <Globe size={10} />
                                Extern
                            </span>
                        {:else}
                            <span class="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700" title="Nur intern sichtbar">
                                <Lock size={10} />
                                Intern
                            </span>
                        {/if}

                        <button
                            type="button"
                            class="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors opacity-60 group-hover:opacity-100"
                            title="Tag entfernen"
                            onclick={() => removeTag(tagId)}
                            disabled={isSaving}
                        >
                            <X size={12} />
                        </button>
                    </span>
                {/if}
            {/each}
        </div>
    {/if}

    <!-- Tag Assignment Drawer / Selector (Expanded when isEditing is true) -->
    {#if isEditing}
        <div class="mt-6 pt-6 border-t border-gray-100 animate-in fade-in duration-200">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-gray-800">
                    Verfügbare Tags nach Kategorien
                </h3>
                <span class="text-xs text-gray-500">
                    {selectedTagIds.length} ausgewählt
                </span>
            </div>

            <!-- Search and Filter Bar -->
            <div class="flex flex-col sm:flex-row items-center gap-2 mb-4">
                <div class="relative w-full sm:flex-1">
                    <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Tag suchen..."
                        bind:value={searchQuery}
                        class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <select
                    bind:value={selectedCategoryFilter}
                    aria-label="Kategorie filtern"
                    class="w-full sm:w-auto px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">Alle Kategorien</option>
                    {#each allCategories as cat}
                        <option value={cat.id}>{cat.name}</option>
                    {/each}
                    <option value="none">Ohne Kategorie</option>
                </select>
            </div>

            <!-- Tags List grouped by Category -->
            <div class="max-h-72 overflow-y-auto space-y-4 pr-1">
                {#if groupedTags.length === 0}
                    <div class="text-center py-6 text-xs text-gray-400">
                        Keine passenden Tags gefunden.
                    </div>
                {:else}
                    {#each groupedTags as group (group.categoryId ?? 'none')}
                        <div class="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                            <div class="text-xs font-semibold text-gray-600 mb-2 flex items-center justify-between">
                                <span>{group.categoryName}</span>
                                <span class="text-[10px] text-gray-400 font-normal">
                                    {group.tags.length} Tags
                                </span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {#each group.tags as t (t.id)}
                                    {@const isChecked = selectedTagIds.includes(t.id)}
                                    <button
                                        type="button"
                                        class="flex items-center justify-between p-2 rounded-lg text-left transition-colors border {isChecked ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 font-medium' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}"
                                        onclick={() => toggleTag(t.id)}
                                    >
                                        <div class="flex items-center gap-2 min-w-0">
                                            <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 {isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}">
                                                {#if isChecked}
                                                    <Check size={11} strokeWidth={3} />
                                                {/if}
                                            </div>
                                            {#if t.color}
                                                <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {t.color};"></span>
                                            {/if}
                                            <div class="min-w-0">
                                                <span class="text-xs truncate block">{t.name}</span>
                                                {#if t.description}
                                                    <span class="text-[10px] text-gray-400 truncate block">{t.description}</span>
                                                {/if}
                                            </div>
                                        </div>

                                        <div class="shrink-0 ml-2">
                                            {#if t.visibility === 'external'}
                                                <span class="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    <Globe size={9} />
                                                    Extern
                                                </span>
                                            {:else}
                                                <span class="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded bg-gray-100 text-gray-600">
                                                    <Lock size={9} />
                                                    Intern
                                                </span>
                                            {/if}
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>
