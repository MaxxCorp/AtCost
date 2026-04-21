<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import {
        checkStatus,
        register,
        unregister,
    } from "../../../routes/synchronizations/[id]/webhook.remote";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import Bell from "$lib/components/icons/bell.svelte";
    import BellOff from "$lib/components/icons/bell-off.svelte";
    import { invalidateAll } from "$app/navigation";

    let { configId, providerType, direction, disabled = false } = $props<{
        configId: string;
        providerType: string;
        direction: string;
        disabled?: boolean;
    }>();

    let status = $state<{ active: boolean; expiresAt?: Date } | null>(null);
    let isLoadingStatus = $state(true);
    let actionLoading = $state(false);

    // Only show for active configurations that support it
    const supportsWebhooks = $derived(
        (providerType === "google-calendar" &&
            (direction === "pull" || direction === "bidirectional")) ||
            (providerType === "email" && direction === "push"),
    );

    async function refreshStatus() {
        if (!supportsWebhooks) return;
        isLoadingStatus = true;
        try {
            status = await checkStatus(configId);
        } catch (error) {
            console.error("Failed to load webhook status:", error);
        } finally {
            isLoadingStatus = false;
        }
    }

    $effect(() => {
        refreshStatus();
    });

    async function toggleWebhook() {
        if (!status) return;
        const previousStatus = { ...status };

        try {
            actionLoading = true;
            // Optimistic update
            status = { ...status, active: !status.active };

            if (previousStatus.active) {
                const newStatus = await unregister(configId);
                status = newStatus;
                toast.success(m.webhook_unregistered_successfully());
            } else {
                const newStatus = await register(configId);
                status = newStatus;
                toast.success(m.webhook_registered_successfully());
            }

            // Refresh parent page data if on a synchronization page
            await invalidateAll();
        } catch (error: any) {
            // Revert on error
            status = previousStatus;
            const errorMsg = previousStatus.active ? m.failed_to_unregister_webhook() : m.failed_to_register_webhook();
            toast.error(`${errorMsg}: ${error.message}`);
        } finally {
            actionLoading = false;
        }
    }
</script>

{#if supportsWebhooks}
    {#if isLoadingStatus && !status}
        <AsyncButton
            variant="default"
            size="sm"
            loading={true}
            loadingLabel={m.loading()}
            disabled
            class="w-full flex items-center justify-center gap-2"
        >
            <span>{m.loading()}</span>
        </AsyncButton>
    {:else}
        <AsyncButton
            variant={status?.active ? "outline" : "default"}
            size="sm"
            loading={actionLoading}
            loadingLabel={m.updating()}
            onclick={toggleWebhook}
            disabled={disabled}
            class="w-full flex items-center justify-center gap-2"
            title={disabled 
                ? m.none_access() 
                : (status?.active
                    ? m.webhook_active_click_to_unregister()
                    : m.webhook_inactive_click_to_register())}
        >
            {#if status?.active}
                <Bell class="h-4 w-4 text-green-600" />
                <span class="text-green-600">{m.active()}</span>
            {:else}
                <BellOff class="h-4 w-4" />
                <span>{m.activate()}</span>
            {/if}
        </AsyncButton>
    {/if}
{/if}
