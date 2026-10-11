<script lang="ts">
    import { listTaskTypeConfigs, updateTaskConfig, listTasks } from '../../../routes/tasks.remote.js';
    import { AsyncButton } from '@ac/ui';
    import { toast } from 'svelte-sonner';
    import { X, SlidersHorizontal, Clock, ShieldCheck, CheckCircle2 } from '@lucide/svelte';

    let {
        open = false,
        onClose,
    } = $props<{
        open: boolean;
        onClose: () => void;
    }>();

    const configsQuery = listTaskTypeConfigs();
    const configs = $derived(configsQuery.current || []);

    const utc = updateTaskConfig;

    let selectedType = $state<string>('experience_step_increase');
    let leadTimeDays = $state<number>(30);
    let isEnabled = $state<boolean>(true);

    $effect(() => {
        if (configs.length > 0) {
            const found = configs.find((c: any) => c.taskType === selectedType) || configs[0];
            if (found) {
                selectedType = found.taskType;
                leadTimeDays = found.leadTimeDays;
                isEnabled = found.isEnabled;
            }
        }
    });

    function selectConfig(cfg: any) {
        selectedType = cfg.taskType;
        leadTimeDays = cfg.leadTimeDays;
        isEnabled = cfg.isEnabled;
    }
</script>

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div class="relative w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <SlidersHorizontal class="w-4 h-4" />
                        </span>
                        <h2 class="text-xl font-black uppercase tracking-tight">Aufgaben- & Vorlaufzeiten-Konfiguration</h2>
                    </div>
                    <p class="text-xs text-gray-400">
                        Vorlaufzeiten (Lead Time) und automatische Generierung von Freigaben für Management, HR und Admins konfigurieren.
                    </p>
                </div>

                <button
                    type="button"
                    onclick={onClose}
                    class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
                <!-- Task Types List -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {#each configs as cfg (cfg.taskType)}
                        <button
                            type="button"
                            onclick={() => selectConfig(cfg)}
                            class="p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 {selectedType === cfg.taskType ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm' : 'bg-gray-50/50 hover:bg-gray-50 border-gray-200/80'}"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <span class="text-xs font-black text-gray-900">{cfg.name}</span>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider {cfg.isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}">
                                    {cfg.isEnabled ? 'Aktiv' : 'Deaktiviert'}
                                </span>
                            </div>
                            <p class="text-[11px] text-gray-500 line-clamp-2">{cfg.description}</p>
                            <div class="flex items-center gap-2 pt-1 text-[10px] font-bold text-indigo-700">
                                <Clock class="w-3 h-3" />
                                Vorlaufzeit: {cfg.leadTimeDays} Tag(e)
                            </div>
                        </button>
                    {/each}
                </div>

                <!-- Edit Panel -->
                <div class="p-6 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-4">
                    <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                        <Clock class="w-4 h-4 text-indigo-600" />
                        Parameter für: {configs.find((c: any) => c.taskType === selectedType)?.name || selectedType}
                    </h3>

                    <form
                        {...utc.enhance(async ({ submit }) => {
                            const res = await submit() as any;
                            if (res?.success) {
                                toast.success('Vorlaufzeit & Parameter aktualisiert!');
                                void configsQuery.refresh();
                                void listTasks().refresh();
                            }
                        })}
                        class="space-y-4"
                    >
                        {#if selectedType}
                            <input {...utc.fields.taskType.as('hidden', selectedType)} />
                        {/if}

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label class="block">
                                <span class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 block">
                                    Vorlaufzeit vor Ereignis (Tage)
                                </span>
                                <input
                                    {...utc.fields.leadTimeDays.as('number')}
                                    min="0"
                                    max="365"
                                    value={leadTimeDays}
                                    oninput={(e) => leadTimeDays = Number(e.currentTarget.value)}
                                    class="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <span class="text-[10px] text-gray-400 mt-1 block">
                                    Aufgabe wird {leadTimeDays} Tage vor dem Zieldatum in der Warteschlange platziert.
                                </span>
                            </label>

                            <div class="flex flex-col justify-center">
                                <span class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 block">
                                    Automatisierung aktivieren
                                </span>
                                <label class="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        {...utc.fields.isEnabled.as('checkbox')}
                                        checked={isEnabled}
                                        onchange={(e) => isEnabled = e.currentTarget.checked}
                                        class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span class="text-xs font-medium text-gray-700">
                                        Automatische Aufgabengenerierung aktiv
                                    </span>
                                </label>
                            </div>
                        </div>

                        <!-- Target Roles preview -->
                        <div class="pt-2">
                            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                Berechtigte Zielgruppen
                            </span>
                            <div class="flex flex-wrap gap-1.5">
                                <span class="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                    Administrator
                                </span>
                                <span class="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                    HR Manager
                                </span>
                                <span class="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                    Geschäftsführung (Top Management)
                                </span>
                            </div>
                        </div>

                        <div class="flex justify-end pt-2">
                            <AsyncButton
                                type="submit"
                                loading={utc.pending}
                                class="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            >
                                Änderungen speichern
                            </AsyncButton>
                        </div>
                    </form>
                </div>

                <!-- Automated Runner Information -->
                <div class="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between gap-4">
                    <div>
                        <h4 class="text-xs font-black uppercase tracking-wider text-indigo-950">Automatischer Prüflauf</h4>
                        <p class="text-[11px] text-indigo-800/80">
                            Wird monatlich am 1. des Monats per Cronjob ausgeführt oder manuell über die Schaltfläche „Prüflauf starten“ in der Symbolleiste.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                    type="button"
                    onclick={onClose}
                    class="px-6 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-200/80 transition-all uppercase tracking-wider"
                >
                    Schließen
                </button>
            </div>
        </div>
    </div>
{/if}
