<script lang="ts">
    import { isScanAvailable, scanNamecard } from "../../../routes/contacts/scanNamecard.remote";
    import { Camera } from "@lucide/svelte";
    import { AsyncButton } from "@ac/ui";
    import { toast } from "svelte-sonner";

    interface Props {
        onScanned: (data: any) => void;
    }

    let { onScanned }: Props = $props();

    let fileInput: HTMLInputElement | undefined = $state();
    let scanning = $state(false);

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        scanning = true;
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                if (!dataUrl) {
                    scanning = false;
                    return;
                }
                const [header, base64] = dataUrl.split(',');
                const match = header.match(/:(.*?);/);
                const mimeType = match ? match[1] : 'image/jpeg';

                try {
                    const result = await scanNamecard({ imageBase64: base64, mimeType });
                    if (result.success) {
                        onScanned(result.data);
                        toast.success("Namecard scanned successfully");
                    } else {
                        toast.error(result.error || "Failed to scan namecard");
                    }
                } catch (err: any) {
                    toast.error(err.message || "Failed to scan namecard");
                } finally {
                    scanning = false;
                    if (fileInput) fileInput.value = '';
                }
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            toast.error(error.message || "Failed to process image");
            scanning = false;
            if (fileInput) fileInput.value = '';
        }
    }
</script>

{#await isScanAvailable({}) then available}
    {#if available}
        <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            bind:this={fileInput} 
            onchange={handleFileChange}
            class="hidden" 
        />
        <AsyncButton
            type="button"
            variant="outline"
            loading={scanning}
            loadingLabel="Scanning..."
            onclick={() => fileInput?.click()}
        >
            <Camera size={16} class="mr-2" />
            Scan Namecard
        </AsyncButton>
    {/if}
{/await}
