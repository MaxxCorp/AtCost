import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	onwarn: (warning, handler) => {
		if (warning.code === 'state_referenced_locally') return;
		handler(warning);
	},
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		// Using Vercel adapter for deployment
		adapter: adapter({
			// Vercel configuration
			runtime: 'nodejs20.x',
			// Split API routes from pages for better performance
			split: false,
			// Set maxDuration for all functions (free tier: 10s, pro: 60s)
			maxDuration: 30
		}),
		experimental: {
			remoteFunctions: true
		},
		alias: {
			"@": "./src/lib"
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
