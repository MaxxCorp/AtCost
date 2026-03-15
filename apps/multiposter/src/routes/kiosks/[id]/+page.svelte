<script lang="ts">
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import KioskForm from "$lib/components/kiosks/KioskForm.svelte";
    import * as m from "$lib/paraglide/messages";
    import { getKiosk } from "./read.remote";
    import { updateKiosk } from "./update.remote";
    import { updateKioskSchema } from "$lib/validations/kiosks";
    import { page } from "$app/state";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";

    let kioskId = $derived(page.params.id!);
    let kioskPromise = $derived(getKiosk(kioskId));
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-3xl mx-auto">
        <Breadcrumb feature="kiosks" current={m.edit_kiosk()} />

        <h1 class="text-3xl font-bold mb-8">{m.edit_kiosk()}</h1>

        {#await kioskPromise}
            <LoadingSection message={m.loading_kiosk()} />
        {:then kiosk}
            {#if kiosk}
                <KioskForm
                    remoteFunction={updateKiosk}
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
        {:catch err}
            <ErrorSection
                headline={m.error_loading_kiosk()}
                message={err.message}
                href="/kiosks"
                button={m.back_to_list()}
            />
        {/await}
    </div>
</div>
