<script lang="ts">
    import TalentForm from "$lib/components/talent/TalentForm.svelte";
    import { listTalents } from "../talents.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    import { browser } from "$app/environment";
    $effect(() => {
        breadcrumbState.set({ feature: "talents", current: "New Talent" });
    });
</script>

<div class="max-w-5xl mx-auto px-4 py-8">
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">
            Register New Talent
        </h1>
        <p class="text-gray-500 mt-2">Add a new professional to your recruitment pipeline</p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
        {#if browser}
            <TalentForm
                cancelHref="/talents"
            />
        {:else}
            <div class="h-64 flex items-center justify-center">
                <div class="animate-pulse text-gray-400">Preparing form...</div>
            </div>
        {/if}
    </div>
</div>
