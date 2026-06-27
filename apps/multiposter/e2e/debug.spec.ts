import { test, expect } from '@playwright/test';

test.setTimeout(120000);
test('debug page content', async ({ page }) => {
	const response = await page.goto('/events/new', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(5000);
	
	const currentUrl = page.url();
	console.log("URL:", currentUrl);
	
	const bodyText = await page.evaluate(() => document.body.innerText);
	console.log("BODY TEXT:\n", bodyText.slice(0, 1000));
});
