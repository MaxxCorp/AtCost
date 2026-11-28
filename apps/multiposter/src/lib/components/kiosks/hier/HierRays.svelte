<script lang="ts">
	import { HIER_PALETTE } from './types.js';

	let {
		neon = false,
		mono = false,
		opacity = 1,
		class: extraClass = ''
	}: {
		neon?: boolean;
		mono?: boolean;
		opacity?: number;
		class?: string;
	} = $props();

	let ray1 = $derived(mono ? '#444444' : neon ? HIER_PALETTE.neonPink : HIER_PALETTE.pink);
	let ray2 = $derived(mono ? '#777777' : neon ? HIER_PALETTE.neonYellow : HIER_PALETTE.yellow);
	let ray3 = $derived(mono ? '#555555' : neon ? HIER_PALETTE.neonGreen : HIER_PALETTE.green);
</script>

<svg
	viewBox="0 0 90 105"
	fill="none"
	aria-hidden="true"
	class="ci-svg {extraClass}"
	style="opacity: {opacity};"
>
	<path
		d="M 11 40 L 6 11 Q 5 6 10 6 L 30 7 Q 35 8 33 13 L 22 41 Q 20 45 15 44 Q 12 43 11 40 Z"
		fill={ray1}
	/>
	<path
		d="M 23 54 L 46 26 Q 50 22 54 26 L 67 41 Q 71 45 66 49 L 32 65 Q 27 67 23 63 Q 21 58 23 54 Z"
		fill={ray2}
	/>
	<path
		d="M 28 73 L 69 70 Q 75 70 74 76 L 71 94 Q 69 100 63 98 L 26 85 Q 22 83 23 78 Q 24 74 28 73 Z"
		fill={ray3}
	/>
</svg>
