<script lang="ts">
    import TalentForm from "$lib/components/talent/TalentForm.svelte";
    import { listTalents } from "../talents.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    breadcrumbState.set({ feature: "talents", current: "New Talent" });
</script>

<div class="max-w-5xl mx-auto px-4 py-8">
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">
            Register New Talent
        </h1>
        <p class="text-gray-500 mt-2">Add a new professional to your recruitment pipeline</p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
        <TalentForm
            listContactsRemote={listTalents}
            cancelHref="/talents"
        />
    </div>
</div>
