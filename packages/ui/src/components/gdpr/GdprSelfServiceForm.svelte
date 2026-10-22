<script lang="ts">
    import { toast } from 'svelte-sonner';
    import { ShieldCheck, UserCheck, AlertCircle, CheckCircle2, Lock, FileText, Sparkles } from '@lucide/svelte';

    let { remoteForm, validationSchema }: { remoteForm: any; validationSchema: any } = $props();

    // Local reactive tracking of inputs to provide instant visual counter feedback
    let emailVal = $state('');
    let phoneVal = $state('');
    let birthdayVal = $state('');
    let familyNameVal = $state('');
    let givenNameVal = $state('');
    let zipVal = $state('');
    let cityVal = $state('');
    let streetVal = $state('');
    let notesVal = $state('');
    let isConfirmed = $state(false);

    let submitResult = $state<any>(null);
    let isSubmitting = $state(false);

    const filledCount = $derived(
        [
            emailVal.trim(),
            phoneVal.trim(),
            birthdayVal.trim(),
            familyNameVal.trim(),
            givenNameVal.trim(),
            zipVal.trim(),
            cityVal.trim(),
            streetVal.trim()
        ].filter(Boolean).length
    );

    const isMinimumMet = $derived(filledCount >= 3);
</script>

<div class="max-w-3xl mx-auto py-8 px-4 sm:px-6">
    {#if submitResult?.success}
        <div class="bg-white rounded-3xl border border-emerald-100 p-8 shadow-xl space-y-6 text-center animate-in fade-in duration-300">
            <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 class="w-9 h-9" />
            </div>

            <div class="space-y-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck class="w-3.5 h-3.5" />
                    Identität erfolgreich verifiziert
                </span>
                <h2 class="text-3xl font-black text-gray-900 tracking-tight">Antrag auf Anonymisierung registriert</h2>
                <p class="text-gray-600 max-w-lg mx-auto text-sm leading-relaxed">
                    Vielen Dank. Ihre Identität wurde anhand der 3 angegebenen Merkmale
                    {#if submitResult.identifiedFields?.length}
                        (<span class="font-semibold text-gray-800">{submitResult.identifiedFields.join(', ')}</span>)
                    {/if}
                    eindeutig zugeordnet.
                </p>
            </div>

            <div class="p-5 bg-gray-50 rounded-2xl border border-gray-100 max-w-md mx-auto text-left space-y-3">
                <div class="flex items-center justify-between text-xs border-b border-gray-200/60 pb-2">
                    <span class="text-gray-500 font-medium">Status</span>
                    <span class="font-bold text-amber-600 uppercase tracking-wide">Für Obfuskierung vorgemerkt</span>
                </div>
                {#if submitResult.contactDisplayName}
                    <div class="flex items-center justify-between text-xs border-b border-gray-200/60 pb-2">
                        <span class="text-gray-500 font-medium">Zugeordneter Kontakt</span>
                        <span class="font-semibold text-gray-900 truncate max-w-[200px]">{submitResult.contactDisplayName}</span>
                    </div>
                {/if}
                {#if submitResult.gdprRequestId}
                    <div class="flex items-center justify-between text-xs border-b border-gray-200/60 pb-2">
                        <span class="text-gray-500 font-medium">Referenznummer</span>
                        <span class="font-mono text-gray-700 text-[11px]">{submitResult.gdprRequestId.slice(0, 8)}...</span>
                    </div>
                {/if}
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500 font-medium">Gesetzliche Frist (Art. 12 Abs. 3 DSGVO)</span>
                    <span class="font-semibold text-gray-900">Max. 30 Tage</span>
                </div>
            </div>

            <p class="text-xs text-gray-400 max-w-lg mx-auto">
                Ihr Datensatz wurde für die administrative Obfuskierung gesperrt. Bei der Durchführung werden sämtliche Klardaten
                unwiderruflich durch kryptografische SHA-256 Hashes ersetzt.
            </p>

            <button
                type="button"
                onclick={() => {
                    submitResult = null;
                    emailVal = '';
                    phoneVal = '';
                    birthdayVal = '';
                    familyNameVal = '';
                    givenNameVal = '';
                    zipVal = '';
                    cityVal = '';
                    streetVal = '';
                    notesVal = '';
                    isConfirmed = false;
                }}
                class="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
            >
                Neuen Antrag stellen
            </button>
        </div>
    {:else}
        <div class="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <!-- Header Banner -->
            <div class="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 sm:p-10 relative overflow-hidden">
                <div class="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div class="relative z-10 space-y-3">
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 flex items-center gap-1.5">
                            <Lock class="w-3.5 h-3.5" />
                            DSGVO Selbstauskunft & Art. 17
                        </span>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/80">
                            Recht auf Vergessenwerden
                        </span>
                    </div>
                    <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-white">
                        Datenlöschung & Anonymisierung
                    </h1>
                    <p class="text-indigo-200 text-sm max-w-2xl leading-relaxed">
                        Um Ihre personenbezogenen Daten vor unberechtigten Anfragen Dritter zu schützen,
                        identifizieren Sie sich bitte mit <strong>mindestens drei (3)</strong> der unten aufgeführten Merkmale.
                    </p>
                </div>
            </div>

            <!-- Progress & Validation Pill Bar -->
            <div class="px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black uppercase tracking-wider text-gray-500">Identifikations-Check:</span>
                    <span class="text-xs font-black px-2.5 py-1 rounded-full border transition-all {isMinimumMet ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">
                        {filledCount} von 3 Merkmalen ausgefüllt
                    </span>
                </div>
                {#if isMinimumMet}
                    <span class="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 class="w-4 h-4" />
                        Mindestanforderung erfüllt
                    </span>
                {:else}
                    <span class="text-xs text-gray-400">
                        Noch {Math.max(0, 3 - filledCount)} Angabe(n) erforderlich
                    </span>
                {/if}
            </div>

            <!-- Form -->
            <form
                {...remoteForm.preflight(validationSchema).enhance(async ({ submit }) => {
                    isSubmitting = true;
                    try {
                        const res = await submit();
                        if (res?.data) {
                            submitResult = res.data;
                            if (res.data.success) {
                                toast.success('Antrag erfolgreich registriert!');
                            } else {
                                toast.error(res.data.reason || 'Identifikation fehlgeschlagen.');
                            }
                        }
                    } catch (err: any) {
                        toast.error(err?.message || 'Fehler beim Absenden des Antrags.');
                    } finally {
                        isSubmitting = false;
                    }
                })}
                class="p-8 sm:p-10 space-y-8"
            >
                <div class="space-y-6">
                    <div class="border-b border-gray-100 pb-2">
                        <h2 class="text-base font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                            <UserCheck class="w-4 h-4 text-indigo-600" />
                            Persönliche Identifikationsdaten
                        </h2>
                        <p class="text-xs text-gray-400 mt-0.5">Wählen und befüllen Sie mindestens drei Angaben aus dem Kontaktpool.</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <!-- Email -->
                        <div class="space-y-1.5">
                            <label for="gdpr-email" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                E-Mail-Adresse
                            </label>
                            <input
                                id="gdpr-email"
                                type="email"
                                placeholder="ihre.email@beispiel.de"
                                bind:value={emailVal}
                                {...remoteForm.fields.email.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.email.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- Phone -->
                        <div class="space-y-1.5">
                            <label for="gdpr-phone" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Telefonnummer
                            </label>
                            <input
                                id="gdpr-phone"
                                type="tel"
                                placeholder="+49 170 1234567"
                                bind:value={phoneVal}
                                {...remoteForm.fields.phone.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.phone.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- Birthday -->
                        <div class="space-y-1.5">
                            <label for="gdpr-birthday" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Geburtsdatum
                            </label>
                            <input
                                id="gdpr-birthday"
                                type="date"
                                bind:value={birthdayVal}
                                {...remoteForm.fields.birthday.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800"
                            />
                            {#each remoteForm.fields.birthday.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- Family Name -->
                        <div class="space-y-1.5">
                            <label for="gdpr-family-name" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Nachname (Familienname)
                            </label>
                            <input
                                id="gdpr-family-name"
                                type="text"
                                placeholder="Mustermann"
                                bind:value={familyNameVal}
                                {...remoteForm.fields.familyName.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.familyName.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- Given Name -->
                        <div class="space-y-1.5">
                            <label for="gdpr-given-name" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Vorname
                            </label>
                            <input
                                id="gdpr-given-name"
                                type="text"
                                placeholder="Erika"
                                bind:value={givenNameVal}
                                {...remoteForm.fields.givenName.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.givenName.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- Postal Code (Zip) -->
                        <div class="space-y-1.5">
                            <label for="gdpr-zip" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Postleitzahl (PLZ)
                            </label>
                            <input
                                id="gdpr-zip"
                                type="text"
                                placeholder="10115"
                                bind:value={zipVal}
                                {...remoteForm.fields.zip.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.zip.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- City -->
                        <div class="space-y-1.5">
                            <label for="gdpr-city" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Stadt / Wohnort
                            </label>
                            <input
                                id="gdpr-city"
                                type="text"
                                placeholder="Berlin"
                                bind:value={cityVal}
                                {...remoteForm.fields.city.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.city.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>

                        <!-- Street -->
                        <div class="space-y-1.5">
                            <label for="gdpr-street" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                Straße & Hausnummer
                            </label>
                            <input
                                id="gdpr-street"
                                type="text"
                                placeholder="Musterstraße 42"
                                bind:value={streetVal}
                                {...remoteForm.fields.street.as('text')}
                                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            {#each remoteForm.fields.street.issues() as issue (issue.message)}
                                <p class="text-xs font-semibold text-rose-500 mt-1">{issue.message}</p>
                            {/each}
                        </div>
                    </div>

                    <!-- Additional Notes -->
                    <div class="space-y-1.5 pt-2">
                        <label for="gdpr-notes" class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                            Zusätzliche Mitteilung / Anmerkung (optional)
                        </label>
                        <textarea
                            id="gdpr-notes"
                            rows={3}
                            placeholder="Optional: Weitere Angaben zur Identifizierung oder Anliegen..."
                            bind:value={notesVal}
                            {...remoteForm.fields.notes.as('text')}
                            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                        ></textarea>
                    </div>
                </div>

                <!-- Confirmation Checkbox -->
                <div class="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/80 space-y-2">
                    <label class="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            bind:checked={isConfirmed}
                            {...remoteForm.fields.confirmRequest.as('checkbox')}
                            class="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0"
                        />
                        <div class="space-y-0.5 text-xs text-gray-700">
                            <span class="font-bold text-gray-900 block">
                                Ich beantrage verbindlich die Anonymisierung / Löschung meiner Daten (Art. 17 DSGVO).
                            </span>
                            <span class="text-gray-500 block leading-relaxed">
                                Mir ist bewusst, dass dieser Vorgang nach administrativer Ausführung unwiderruflich ist
                                und personenbezogene Daten durch irreversible Hashes ersetzt werden.
                            </span>
                        </div>
                    </label>
                    {#each remoteForm.fields.confirmRequest.issues() as issue (issue.message)}
                        <p class="text-xs font-semibold text-rose-500 ml-7">{issue.message}</p>
                    {/each}
                </div>

                <!-- Submit Button -->
                <div class="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
                    <p class="text-xs text-gray-400">
                        Verschlüsselte Datenübertragung via SSL/TLS.
                    </p>
                    <button
                        type="submit"
                        disabled={isSubmitting || !isMinimumMet || !isConfirmed}
                        class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {#if isSubmitting}
                            <span class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                            Prüfe Angaben...
                        {:else}
                            <Sparkles class="w-4 h-4" />
                            Identität prüfen & Antrag absenden
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    {/if}
</div>
