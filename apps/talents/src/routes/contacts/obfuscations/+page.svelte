<script lang="ts">
    import { GdprAdminList } from '@ac/ui';
    import { breadcrumbState } from '#lib/stores/breadcrumb.svelte.js';
    import { listGdprRequests, executeGdprObfuscation } from './obfuscations.remote.js';

    breadcrumbState.set({ feature: 'contacts', current: 'DSGVO Obfuskierung' });

    const requestsQuery = listGdprRequests();
</script>

<svelte:head>
    <title>DSGVO Obfuskierungs- & Crypto-Shredding-Manager · AC Talents</title>
</svelte:head>

<div class="space-y-6">
    <div class="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-950 to-slate-900 p-5 text-white shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                    DSGVO Art. 17 · Kryptografische Löschung & Blockchain-Integrität
                </span>
                <h2 class="text-lg font-black mt-0.5">
                    Erweiterte Obfuskierung mit PKI Crypto-Shredding & HMAC-SHA256 Blind-Indizes
                </h2>
                <p class="text-xs text-slate-300 mt-1 max-w-3xl">
                    Bei Ausführung einer Obfuskierung werden sowohl Klartext-Kontaktdaten als auch der subjektbezogene AES-256-GCM Data Encryption Key (`crypto_data_key`) unwiderruflich vernichtet. Dadurch sind sämtliche historischen verschlüsselten Personal-Snapshots dauerhaft unlesbar, während die RFC 6962 Blockchain-Custody-Kette revisionssicher erhalten bleibt.
                </p>
            </div>
            <a
                href="/gdpr-self-service"
                class="shrink-0 rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-teal-400"
            >
                Self-Service Portal öffnen
            </a>
        </div>
    </div>

    <GdprAdminList
        {requestsQuery}
        obfuscateCommand={executeGdprObfuscation}
    />
</div>
