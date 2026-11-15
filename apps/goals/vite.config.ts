import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit({
            preprocess: vitePreprocess(),
            compilerOptions: { experimental: { async: true } },
            adapter: adapter(),
            csrf: {},
            experimental: { remoteFunctions: true },
            onwarn: (warning, handler) => {
                if (warning.code === 'state_referenced_locally') return;
                handler(warning);
            }
        }),
        paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' })
    ] as any,
    ssr: {
        noExternal: ['@ac/ui', '@ac/validations', '@ac/db']
    },
    resolve: {
        dedupe: ['svelte']
    },
    server: {
        port: 5175,
        fs: {
            allow: ['../../']
        }
    }
});
