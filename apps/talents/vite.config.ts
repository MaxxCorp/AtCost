import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sveltePath = path.dirname(require.resolve('svelte/package.json'));

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit(),
        paraglideVitePlugin({
            project: './project.inlang',
            outdir: './src/lib/paraglide'
        })
    ] as any,
    ssr: {
        noExternal: ['@ac/ui', '@ac/validations', '@ac/db']
    },
    resolve: {
        dedupe: ['svelte']
    },
    server: {
        port: 5174,
        fs: {
            allow: ['../../']
        }
    }
});
