<script lang="ts">
	import { Button } from "../button/index.js";
	import { ShieldAlert, Lock, ArrowRight } from "@lucide/svelte";
	import type { ContactEncryptionStatus } from "@ac/validations";

	interface Props {
		status?: ContactEncryptionStatus | null;
		onopen: () => void;
	}

	let { status, onopen }: Props = $props();
</script>

{#if status?.hasUnencryptedData}
	<div class="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
		<div class="flex items-start sm:items-center gap-3">
			<div class="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
				<ShieldAlert class="w-5 h-5" />
			</div>
			<div>
				<h3 class="text-sm font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
					<span>Kontakt-Verschlüsselung ausstehend</span>
					<span class="text-xs px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-semibold">
						{status.unencryptedCount} von {status.totalContacts} unverschlüsselt
					</span>
				</h3>
				<p class="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
					Schützen Sie Telefonnummern, E-Mail-Adressen und Personendaten durch Migration auf das PKI-gesicherte AES-256-GCM Envelope-Verfahren.
				</p>
			</div>
		</div>

		<Button
			variant="outline"
			size="sm"
			class="bg-white hover:bg-amber-100/50 border-amber-300 text-amber-900 dark:bg-gray-800 dark:border-amber-700 dark:text-amber-200 shadow-2xs gap-1.5 font-semibold shrink-0"
			onclick={onopen}
		>
			<Lock size={14} class="text-amber-600" />
			<span>Jetzt verschlüsseln</span>
			<ArrowRight size={14} />
		</Button>
	</div>
{/if}

