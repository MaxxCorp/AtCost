import { expect, test } from '@playwright/test';

const demoPage = '/testing/list-card';

const getFirstCheckbox = (page) => page.locator('[data-card-id="demo-1"] input[type="checkbox"]').first();

const getActionButton = (page, id: string) => page.getByTestId(`card-action-${id}`);

const getCardRoot = (page, id: string) => page.locator(`[data-card-id="${id}"] [role="link"]`).first();

	test.describe('ListCard interaction guard', () => {
		test('toggling the checkbox does not trigger navigation', async ({ page }) => {
		await page.goto(demoPage);
		const initialUrl = page.url();
		const checkbox = getFirstCheckbox(page);

		await checkbox.click();
		await expect(page).toHaveURL(initialUrl);
		await expect(checkbox).toBeChecked();

		await checkbox.click();
		await expect(page).toHaveURL(initialUrl);
		await expect(checkbox).not.toBeChecked();
	});

	test('inline actions stay on the list page', async ({ page }) => {
		await page.goto(demoPage);
		const initialUrl = page.url();

		const actionButton = getActionButton(page, 'demo-2');
		await actionButton.click();
		await expect(page).toHaveURL(initialUrl);
	});

	});
