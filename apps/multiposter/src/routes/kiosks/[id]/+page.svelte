<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import KioskForm from "$lib/components/kiosks/KioskForm.svelte";
    import * as m from "$lib/paraglide/messages";
    import { getKiosk } from "./read.remote";
    import { updateKiosk } from "./update.remote";
    import { updateKioskSchema } from "$lib/validations/kiosks";
    import { page } from "$app/state";
        
    const kioskId = $derived(page.params.id || "");
    const query = $derived(getKiosk(kioskId));
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-3xl mx-auto">
        <Breadcrumb feature="kiosks" current={m.edit_kiosk()} />

        <h1 class="text-3xl font-bold mb-8">{m.edit_kiosk()}</h1>

        {#if query.loading && !query.current}
            <LoadingSection message={m.loading_kiosk()} />
        {:else if query.current}
            {@const kiosk = query.current}
            {#if kiosk}
                                <KioskForm
                    remoteFunction={updateKiosk.for(kioskId)}
                    validationSchema={updateKioskSchema}
                    initialData={kiosk}
                    isUpdating={true}
                />
                            {:else}
                <ErrorSection
                    headline={m.kiosk_not_found()}
                    message={m.kiosk_not_found_message()}
                    href="/kiosks"
                    button={m.back_to_list()}
                />
            {/if}
        {:else if query.error}
            {@const err = query.error}
            <ErrorSection
                headline={m.error_loading_kiosk()}
                message={err.message}
                href="/kiosks"
                button={m.back_to_list()}
            />
        {/if}
    </div>
</div>
