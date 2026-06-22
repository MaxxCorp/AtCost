<script lang="ts">
	import { create } from "./create.remote";
	import { goto } from "$app/navigation";
	import { createSynchronizationSchema } from "$lib/validations/synchronizations";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { toast } from "svelte-sonner";
	import SynchronizationForm from "$lib/components/synchronizations/SynchronizationForm.svelte";

	const rf = create.preflight(createSynchronizationSchema);
</script>

<svelte:head>
	<title>Add Calendar Sync</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<Breadcrumb feature="synchronizations" current="Add Calendar Sync" />

	<div class="mb-8">
		<h1 class="text-3xl font-bold">Add Calendar Sync</h1>
		<p class="text-gray-600 mt-2">
			Connect a calendar service to synchronize your events
		</p>
	</div>

	<form
		class="space-y-4"
		{...rf.enhance(async ({ submit }) => {
				const result: any = await submit();
				if (result?.error) {
					toast.error(
						result.error.message ||
							"Failed to create synchronization",
					);
					return;
				}
				toast.success("Calendar synchronization created successfully!");
				await goto("/synchronizations");
			})}
		onkeydown={(event) => {
			if (event.key === "Enter") {
				const target = event.target as HTMLElement;
				if (
					target.tagName !== "TEXTAREA" &&
					target.getAttribute("type") !== "submit"
				) {
					event.preventDefault();
				}
			}
		}}
	>
		<SynchronizationForm remoteFunction={rf} />

		<!-- Submit -->
		<div class="flex items-center justify-end gap-3 pt-4">
			<Button
				variant="secondary"
				href="/synchronizations"
				size="default"
			>
				Cancel
			</Button>
			<AsyncButton
				type="submit"
				loadingLabel="Creating..."
				loading={create.pending}
			>
				Create Sync
			</AsyncButton>
		</div>
	</form>
</div>
