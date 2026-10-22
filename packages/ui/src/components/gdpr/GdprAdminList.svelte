<script lang="ts">
    import { toast } from 'svelte-sonner';
    import { formatDistanceToNow, format } from 'date-fns';
    import { de } from 'date-fns/locale';
    import {
        ShieldAlert,
        UserX,
        CheckCircle2,
        Clock,
        Search,
        RefreshCw,
        Lock,
        AlertTriangle,
        Hash,
        Eye,
        Calendar
    } from '@lucide/svelte';

    let {
        requestsQuery,
        obfuscateCommand,
    }: {
        requestsQuery: any;
        obfuscateCommand: any;
    } = $props();

    let statusFilter = $state<'pending' | 'obfuscated' | 'all'>('pending');
    let searchQuery = $state('');
    let executingId = $state<string | null>(null);

    const queryData = $derived(requestsQuery.current);
    const items = $derived<any[]>(queryData?.data || []);
    const total = $derived<number>(queryData?.total || 0);

    const filteredItems = $derived.by(() => {
        let list = items;
        if (statusFilter !== 'all') {
            list = list.filter((r) => r.status === statusFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (r) =>
                    r.contact?.displayName?.toLowerCase().includes(q) ||
                    r.contact?.givenName?.toLowerCase().includes(q) ||
                    r.contact?.familyName?.toLowerCase().includes(q) ||
                    r.notes?.toLowerCase().includes(q) ||
                    r.contactId?.toLowerCase().includes(q)
            );
        }
        return list;
    });

    const pendingCount = $derived(items.filter((r) => r.status === 'pending').length);
    const completedCount = $derived(items.filter((r) => r.status === 'obfuscated').length);

    async function handleExecuteObfuscation(contactId: string, gdprRequestId?: string) {
        if (!confirm('Achtung: Sämtliche Klardaten (Namen, E-Mails, Telefonnummern, Adressen) werden jetzt unwiderruflich durch kryptografische SHA-256 Hashes ersetzt. Möchten Sie fortfahren?')) {
            return;
        }

        executingId = contactId;
        try {
            await obfuscateCommand({
                contactId,
                gdprRequestId,
                notes: 'Durch Administrator im DSGVO Management Center ausgeführt.'
            });
            toast.success('Kontakt erfolgreich anonymisiert und Daten gehasht.');
            await requestsQuery.refresh();
        } catch (err: any) {
            toast.error(err?.message || 'Fehler beim Ausführen der Obfuskierung.');
        } finally {
            executingId = null;
        }
    }
</script>

<div class="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-8">
        <div class="space-y-2">
            <div class="flex items-center gap-3">
                <span class="w-2.5 h-10 bg-rose-600 rounded-full"></span>
                <h1 class="text-3xl md:text-4xl font-black text-gray-900 tracking-tight uppercase italic leading-none">
                    DSGVO Obfuskierungs-Manager
                </h1>
            </div>
            <p class="text-gray-400 font-bold uppercase tracking-widest text-[11px] ml-5">
                Verwaltung von Anträgen auf Datenanonymisierung nach Art. 17 DSGVO (Recht auf Vergessenwerden)
            </p>
        </div>

        <div class="flex items-center gap-3">
            <button
                type="button"
                onclick={async () => {
                    await requestsQuery.refresh();
                    toast.success('Liste aktualisiert');
                }}
                class="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl border border-gray-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
            >
                <RefreshCw class="w-3.5 h-3.5 {requestsQuery.loading ? 'animate-spin' : ''}" />
                Aktualisieren
            </button>
        </div>
    </header>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-6 bg-white rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden space-y-1">
            <div class="flex items-center justify-between text-rose-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Zu obfuskieren</span>
                <span class="relative flex h-3 w-3">
                    {#if pendingCount > 0}
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    {/if}
                    <span class="relative inline-flex rounded-full h-3 w-3 {pendingCount > 0 ? 'bg-rose-500' : 'bg-gray-300'}"></span>
                </span>
            </div>
            <div class="text-4xl font-black text-gray-900">{pendingCount}</div>
            <p class="text-[11px] text-gray-400 font-medium">Offene Anfragen ausstehend</p>
        </div>

        <div class="p-6 bg-white rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden space-y-1">
            <div class="flex items-center justify-between text-emerald-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Erfolgreich gehasht</span>
                <CheckCircle2 class="w-4 h-4" />
            </div>
            <div class="text-4xl font-black text-gray-900">{completedCount}</div>
            <p class="text-[11px] text-gray-400 font-medium">Anonymisierte Kontakte</p>
        </div>

        <div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden space-y-1">
            <div class="flex items-center justify-between text-indigo-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Gesetzliche Frist</span>
                <Clock class="w-4 h-4" />
            </div>
            <div class="text-2xl font-black text-gray-900">30 Tage</div>
            <p class="text-[11px] text-gray-400 font-medium">Frist gem. Art. 12 Abs. 3 DSGVO</p>
        </div>
    </div>

    <!-- Filter and Search Toolbar -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gray-50/70 p-3 rounded-2xl border border-gray-200/80">
        <!-- Status Switcher Tabs -->
        <div class="flex bg-gray-200/60 p-1 rounded-xl">
            <button
                type="button"
                onclick={() => statusFilter = 'pending'}
                class="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all {statusFilter === 'pending' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}"
            >
                Zu obfuskieren ({pendingCount})
            </button>
            <button
                type="button"
                onclick={() => statusFilter = 'obfuscated'}
                class="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all {statusFilter === 'obfuscated' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}"
            >
                Anonymisiert ({completedCount})
            </button>
            <button
                type="button"
                onclick={() => statusFilter = 'all'}
                class="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all {statusFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}"
            >
                Alle ({items.length})
            </button>
        </div>

        <!-- Search input -->
        <div class="relative max-w-sm w-full">
            <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
                type="text"
                placeholder="Suche nach Name, Notiz, ID..."
                bind:value={searchQuery}
                class="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
        </div>
    </div>

    <!-- Requests List -->
    {#if requestsQuery.loading && !queryData}
        <div class="p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Lade DSGVO-Anträge...</p>
        </div>
    {:else if filteredItems.length === 0}
        <div class="p-16 text-center bg-white rounded-3xl border border-dashed border-gray-200 space-y-3">
            <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mx-auto">
                <UserX class="w-6 h-6" />
            </div>
            <h3 class="text-base font-bold text-gray-900">Keine Datensätze gefunden</h3>
            <p class="text-xs text-gray-400 max-w-md mx-auto">
                {#if statusFilter === 'pending'}
                    Derzeit liegen keine offenen Anfragen zur Obfuskierung vor. Alle Anträge sind abgearbeitet!
                {:else}
                    Es wurden keine Datensätze gefunden, die dem aktuellen Filter entsprechen.
                {/if}
            </p>
        </div>
    {:else}
        <div class="space-y-4">
            {#each filteredItems as req (req.id)}
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="space-y-3 max-w-2xl">
                        <!-- Top tags / status -->
                        <div class="flex items-center gap-2 flex-wrap">
                            {#if req.status === 'pending'}
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                    Zu obfuskieren (Ausstehend)
                                </span>
                            {:else}
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                                    <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                                    Erfolgreich Anonymisiert
                                </span>
                            {/if}

                            <span class="text-[10px] text-gray-400 font-mono">
                                Ref: {req.id.slice(0, 8)}
                            </span>

                            <span class="text-[10px] text-gray-400 flex items-center gap-1">
                                <Calendar class="w-3 h-3" />
                                Beantragt: {format(new Date(req.requestedAt), 'dd.MM.yyyy HH:mm')}
                            </span>
                        </div>

                        <!-- Contact Header -->
                        <div>
                            <h3 class="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                {#if req.status === 'obfuscated'}
                                    <Hash class="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span class="font-mono text-gray-700">{req.contact?.displayName || 'Anonymisierter Datensatz'}</span>
                                {:else}
                                    <span>{req.contact?.displayName || [req.contact?.givenName, req.contact?.familyName].filter(Boolean).join(' ') || 'Unbenannter Kontakt'}</span>
                                {/if}
                            </h3>

                            {#if req.contact?.emails?.length || req.contact?.phones?.length}
                                <div class="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                                    {#if req.contact?.emails?.length}
                                        <span class="truncate max-w-xs">{req.contact.emails.join(', ')}</span>
                                    {/if}
                                    {#if req.contact?.phones?.length}
                                        <span>{req.contact.phones.join(', ')}</span>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <!-- Identified Fields Pills -->
                        {#if req.identifiedFields?.length}
                            <div class="flex items-center gap-1.5 flex-wrap pt-1">
                                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">
                                    Verifizierte Merkmale:
                                </span>
                                {#each req.identifiedFields as field (field)}
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        {field}
                                    </span>
                                {/each}
                            </div>
                        {/if}

                        {#if req.notes}
                            <p class="text-xs text-gray-500 italic bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                                "{req.notes}"
                            </p>
                        {/if}
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-3 shrink-0">
                        {#if req.status === 'pending'}
                            <button
                                type="button"
                                disabled={executingId === req.contactId}
                                onclick={() => handleExecuteObfuscation(req.contactId, req.id)}
                                class="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {#if executingId === req.contactId}
                                    <span class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                    Obfuskiere...
                                {:else}
                                    <UserX class="w-4 h-4" />
                                    Jetzt Obfuskieren
                                {/if}
                            </button>
                        {:else}
                            <div class="text-right">
                                <span class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">
                                    <Lock class="w-3.5 h-3.5 text-gray-400" />
                                    Hashes aktiv
                                </span>
                                {#if req.processedAt}
                                    <p class="text-[10px] text-gray-400 mt-1">
                                        Ausgeführt am {format(new Date(req.processedAt), 'dd.MM.yyyy')}
                                    </p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
