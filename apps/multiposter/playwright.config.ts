import { defineConfig } from '@playwright/test';

const PORT = 4173;
const HOST = '127.0.0.1';

export default defineConfig({
	webServer: {
		command: `pnpm exec vite dev --host ${HOST} --port ${PORT}`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		stdout: 'pipe',
		stderr: 'pipe'
	},
	use: {
		baseURL: `http://${HOST}:${PORT}`
	},
	testDir: 'e2e'
});
