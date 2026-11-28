<script lang="ts">
	import { HIER_FONT_STACK, HIER_PALETTE, type HierLogoVariant } from './types.js';

	let {
		variant = 'purple',
		subtitle = 'in Marzahn-Süd',
		neonRays = false,
		showSubtitle = true,
		class: extraClass = ''
	}: {
		variant?: HierLogoVariant;
		subtitle?: string;
		neonRays?: boolean;
		showSubtitle?: boolean;
		class?: string;
	} = $props();

	let wordmarkFill = $derived.by(() => {
		switch (variant) {
			case 'white':
			case 'on_pink':
			case 'on_green':
				return '#ffffff';
			case 'analog':
				return HIER_PALETTE.primaryAnalog;
			case 'mono':
				return '#111111';
			case 'on_yellow':
			case 'purple':
			default:
				return HIER_PALETTE.primaryDigital;
		}
	});

	let rayColors = $derived.by(() => {
		if (variant === 'mono') {
			return { r1: '#333333', r2: '#666666', r3: '#444444' };
		}
		const basePink = neonRays ? HIER_PALETTE.neonPink : HIER_PALETTE.pink;
		const baseYellow = neonRays ? HIER_PALETTE.neonYellow : HIER_PALETTE.yellow;
		const baseGreen = neonRays ? HIER_PALETTE.neonGreen : HIER_PALETTE.green;

		if (variant === 'on_yellow') {
			return { r1: basePink, r2: HIER_PALETTE.primaryDigital, r3: baseGreen };
		}
		if (variant === 'on_pink') {
			return { r1: HIER_PALETTE.primaryDigital, r2: baseYellow, r3: baseGreen };
		}
		if (variant === 'on_green') {
			return { r1: basePink, r2: baseYellow, r3: HIER_PALETTE.primaryDigital };
		}
		return { r1: basePink, r2: baseYellow, r3: baseGreen };
	});

	let effectiveSubtitle = $derived(subtitle?.trim() || 'in Marzahn-Süd');
	let viewBoxValue = $derived(showSubtitle ? '0 0 320 185' : '0 0 320 138');
</script>

<svg
	viewBox={viewBoxValue}
	fill="none"
	role="img"
	aria-label={showSubtitle ? `HIER ${effectiveSubtitle}` : 'HIER'}
	class="ci-svg {extraClass}"
>
	<!-- Geometric FUTURA-inspired HIER wordmark -->
	<g fill={wordmarkFill}>
		<path d="M 10 42 H 31 V 73 H 54 V 42 H 75 V 124 H 54 V 91 H 31 V 124 H 10 Z" />
		<path d="M 83 42 H 104 V 124 H 83 Z" />
		<path d="M 113 42 H 164 V 60 H 134 V 74 H 161 V 91 H 134 V 106 H 164 V 124 H 113 Z" />
		<path
			d="M 173 42 H 212 C 231 42 242 52 242 68 C 242 80 235 88 224 91 L 245 124 H 221 L 204 94 H 194 V 124 H 173 Z M 194 59 V 78 H 209 C 217 78 221 74 221 68.5 C 221 63 217 59 209 59 Z"
		/>
	</g>

	<!-- Three dynamic rounded wedge rays -->
	<path
		d="M 239 44 L 234 15 Q 233 10 238 10 L 258 11 Q 263 12 261 17 L 250 45 Q 248 49 243 48 Q 240 47 239 44 Z"
		fill={rayColors.r1}
	/>
	<path
		d="M 251 58 L 274 30 Q 278 26 282 30 L 295 45 Q 299 49 294 53 L 260 69 Q 255 71 251 67 Q 249 62 251 58 Z"
		fill={rayColors.r2}
	/>
	<path
		d="M 256 77 L 297 74 Q 303 74 302 80 L 299 98 Q 297 104 291 102 L 254 89 Q 250 87 251 82 Q 252 78 256 77 Z"
		fill={rayColors.r3}
	/>

	{#if showSubtitle}
		<text
			x="10"
			y="159"
			fill={wordmarkFill}
			font-family={HIER_FONT_STACK}
			font-weight="800"
			font-size="29"
			textLength="235"
			lengthAdjust="spacing"
		>
			{effectiveSubtitle}
		</text>
	{/if}
</svg>
