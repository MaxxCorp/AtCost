<script lang="ts">
	interface TemplateItem {
		id: string;
		name: string;
		description: string;
	}

	interface Props {
		templates: TemplateItem[];
		selectedTemplate: string;
		onselect: (id: string) => void;
		label?: string;
		accent?: 'pink' | 'blue';
	}

	let {
		templates,
		selectedTemplate,
		onselect,
		label = 'Select Template (Svelte Templating)',
		accent = 'blue'
	}: Props = $props();

	const isPink = $derived(accent === 'pink');
</script>

<div>
	{#if label}
		<span class="block text-sm font-medium text-gray-700 mb-2">
			{label}
		</span>
	{/if}
	<div class="grid gap-3 grid-cols-1 sm:grid-cols-3">
		{#each templates as tmpl (tmpl.id)}
			{@const isSelected = selectedTemplate === tmpl.id}
			<button
				type="button"
				class="text-left p-3 rounded-lg border-2 transition-all flex flex-col justify-between {isSelected
					? isPink
						? 'border-pink-600 bg-pink-50'
						: 'border-blue-600 bg-blue-50'
					: 'border-gray-200 hover:border-gray-300'}"
				onclick={() => onselect(tmpl.id)}
			>
				<div>
					<div class="font-semibold text-sm text-gray-900">{tmpl.name}</div>
					<div class="text-xs text-gray-500 mt-1">{tmpl.description}</div>
				</div>
				{#if isSelected}
					<span
						class="inline-block mt-2 text-[10px] font-bold uppercase {isPink
							? 'text-pink-600'
							: 'text-blue-600'}"
					>
						Selected
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
