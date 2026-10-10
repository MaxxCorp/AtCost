import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
// import { playwright } from '@vitest/browser-playwright';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Consult https://svelte.dev/docs/kit/integrations
			// for more information about preprocessors
			preprocess: vitePreprocess(),
			compilerOptions: { experimental: { async: true } },
			// Using Vercel adapter for deployment
			adapter: adapter({
				// Vercel configuration
				// Split API routes from pages for better performance
				split: false,

				// Set maxDuration for all functions (free tier: 60s)
				maxDuration: 60,
				runtime: 'nodejs24.x'
			}),

			csrf: {
				trustedOrigins: ['*']
			},
			experimental: { remoteFunctions: true },
			onwarn: (warning, handler) => {
				if (warning.code === 'state_referenced_locally') return;

				handler(warning);
			}
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		})
	] as any,
	optimizeDeps: { include: ['ckeditor5'] },
	ssr: { noExternal: ['@ac/ui', '@ac/validations', '@ac/db'] }
});
