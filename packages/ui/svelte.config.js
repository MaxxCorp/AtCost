import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		experimental: {
			remoteFunctions: true
		}
	},
	preprocess: vitePreprocess(),
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
