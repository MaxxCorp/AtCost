import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    onwarn: (warning, handler) => {
        if (warning.code === 'state_referenced_locally') return;
        handler(warning);
    },
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter(),
        csrf: {
            // trustedOrigins: []
        },
        experimental: {
            remoteFunctions: true
        },
        alias: {
            "@": "./src/lib",
            "drizzle-orm": "./node_modules/drizzle-orm"
        }
    },
    compilerOptions: {
        experimental: {
            async: true
        }
    }
};

export default config;
