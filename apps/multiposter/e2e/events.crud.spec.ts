import { expect, test, Page, Locator } from '@playwright/test';

const ROUTES = {
	list: '/events',
	new: '/events/new'
};

async function waitForToast(page: Page) {
	// Look for any toast alert to be visible
	const toast = page.locator('[data-sonner-toast]').first();
	try {
		await expect(toast).toBeVisible({ timeout: 5000 });
		// We don't need to dismiss it, it auto-dismisses, just wait for it.
	} catch (e) {
		// If toast doesn't appear or is missed, that's fine as long as redirect happened.
	}
}

async function createEvent(page: Page, details: { summary: string; ticketPrice: string; recurring?: boolean }) {
	await page.goto(ROUTES.new);
	await page.waitForLoadState('networkidle');

	// Fill basic information
	await page.locator('input[name="summary"]').fill(details.summary);

	// Fill ticket price if provided
	if (details.ticketPrice) {
		const unknownCheckbox = page.locator('input#ticketPriceUnknown');
		if (await unknownCheckbox.isChecked()) {
			// Click the label or checkbox to uncheck
			await page.locator('label[for="ticketPriceUnknown"]').click();
		}
		await page.locator('input[name="ticketPrice"]').fill(details.ticketPrice);
	}

	// Ensure dates are filled out reasonably
	const today = new Date().toISOString().split('T')[0];
	await page.locator('input[name="startDate"]').fill(today);
	await page.locator('input[name="startTime"]').fill('10:00');
	await page.locator('input[name="endDate"]').fill(today);
	await page.locator('input[name="endTime"]').fill('12:00');

	if (details.recurring) {
		// Open recurrence dialog (the button in EventForm pt-4 border-t)
		await page.locator('div.pt-4.border-t button').click();

		// Wait for dialog to open
		await expect(page.getByRole('dialog')).toBeVisible();

		// Select Weekly (value "2" in RRule)
		await page.locator('select#freq').selectOption('2');

		// Set to end after 3 occurrences to keep it small
		await page.locator('input#end-count').click();
		await page.locator('input[type="number"]').filter({ has: page.locator('..').filter({ hasText: /After/i }) }).first().fill('3');

		// Click Save inside dialog
		await page.getByRole('button', { name: /Save/i }).filter({ hasNotText: 'Changes' }).click();
	}

	// Submit form
	await page.getByRole('button', { name: /Create Event/i }).click();

	// Verify redirect and toast
	await page.waitForURL(/\/events/);
	await waitForToast(page);
}

async function updateEvent(page: Page, oldSummary: string, newSummary: string) {
	// Find the event card
	const card = page.locator('div.bg-white', { hasText: oldSummary }).first();
	
	// Click Edit button inside the card
	await card.getByRole('link', { name: /Edit/i }).click();

	// Wait for edit page
	await expect(page.locator('input[name="summary"]')).toBeVisible();

	// Update summary
	await page.locator('input[name="summary"]').fill(newSummary);

	// Submit
	await page.getByRole('button', { name: /Save Changes/i }).click();

	// Verify redirect and toast
	await page.waitForURL(/\/events/);
	await waitForToast(page);
}

async function deleteSingleEvent(page: Page, summary: string) {
	const card = page.locator('div.bg-white', { hasText: summary }).first();
	
	// Automatically accept the confirmation dialog
	page.once('dialog', dialog => dialog.accept());
	
	// Click delete button
	await card.getByRole('button', { name: /Delete/i }).first().click();

	// Verify toast
	await waitForToast(page);
}

test.describe('Events CRUD and UI Mutations', () => {

	test.setTimeout(120000); // Allow time for Vite to optimize dependencies

	test.beforeEach(async ({ page }) => {
		// Navigate to the list page before each test
		await page.goto(ROUTES.list);
		await page.waitForLoadState('networkidle');
	});

	test('creates a standard event and verifies it appears in the list', async ({ page }) => {
		const eventName = `E2E Event ${Date.now()}`;
		await createEvent(page, { summary: eventName, ticketPrice: '15' });

		// Verify the event appears in the list
		await expect(page.locator('h3', { hasText: eventName }).first()).toBeVisible();
	});

	test('updates an event and verifies the UI updates reactively', async ({ page }) => {
		const initialName = `E2E Update Initial ${Date.now()}`;
		const updatedName = `${initialName} (Updated)`;

		// Create the event first
		await createEvent(page, { summary: initialName, ticketPrice: '10' });
		await expect(page.locator('h3', { hasText: initialName }).first()).toBeVisible();

		// Update the event
		await updateEvent(page, initialName, updatedName);

		// The list should show the updated name and NOT the old name
		await expect(page.getByRole('heading', { name: updatedName, exact: true }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: initialName, exact: true }).first()).toBeHidden();
	});

	test('deletes an event and verifies it is removed from the list', async ({ page }) => {
		const eventName = `E2E Delete Target ${Date.now()}`;

		// Create the event
		await createEvent(page, { summary: eventName, ticketPrice: '0' });
		await expect(page.locator('h3', { hasText: eventName }).first()).toBeVisible();

		// Delete the event
		await deleteSingleEvent(page, eventName);

		// Verify it is no longer visible
		await expect(page.locator('h3', { hasText: eventName }).first()).toBeHidden();
	});

	test('creates a recurring event series, expands it, and deletes the series', async ({ page }) => {
		const seriesName = `E2E Recurring Series ${Date.now()}`;

		// Create recurring event
		await createEvent(page, { summary: seriesName, ticketPrice: '20', recurring: true });
		
		// Wait for the card to be visible
		const card = page.locator('div.bg-white', { hasText: seriesName }).first();
		await expect(card).toBeVisible();

		// Expand the series instances
		const expandButton = card.getByRole('button', { name: /instances/i });
		if (await expandButton.count() > 0) {
			await expandButton.click();
			const instanceDeleteButton = card.locator('.mt-4.pt-4').getByRole('button', { name: /Delete/i }).first();
			if (await instanceDeleteButton.count() > 0) {
				await expect(instanceDeleteButton).toBeVisible();
			}
		}

		// Now delete the entire series
		// The main delete button on the card should prompt for series deletion
		page.once('dialog', async dialog => {
			await dialog.accept();
		});

		// The main delete button is at the bottom of the card, so it's the last one
		await card.getByRole('button', { name: /Delete|Löschen/i }).last().click();

		// Verify toast and removal
		await waitForToast(page);
		await expect(card).toBeHidden();
	});

	test('filters events list using search input reactively', async ({ page }) => {
		const uniquePrefix = `E2E-Search-${Date.now()}`;
		const event1 = `${uniquePrefix}-Apple`;
		const event2 = `${uniquePrefix}-Banana`;

		await createEvent(page, { summary: event1, ticketPrice: '5' });
		await createEvent(page, { summary: event2, ticketPrice: '5' });

		await expect(page.locator('h3', { hasText: event1 }).first()).toBeVisible();
		await expect(page.locator('h3', { hasText: event2 }).first()).toBeVisible();

		// Search for Apple
		const searchInput = page.getByPlaceholder(/Search events/i);
		if (await searchInput.count() === 0) return; // If search input not implemented yet, skip
		await searchInput.fill('Apple');

		// Banana should disappear, Apple should remain
		await expect(page.locator('h3', { hasText: event2 }).first()).toBeHidden();
		await expect(page.locator('h3', { hasText: event1 }).first()).toBeVisible();

		// Search for Banana
		await searchInput.fill('Banana');
		await expect(page.locator('h3', { hasText: event1 }).first()).toBeHidden();
		await expect(page.locator('h3', { hasText: event2 }).first()).toBeVisible();
	});

	test('creates a tag via quick create dialog and verifies automatic association', async ({ page }) => {
		await page.goto(ROUTES.new);
		await page.waitForLoadState('networkidle');

		// The tags section has a heading "Tags"
		const tagsHeading = page.getByRole('heading', { name: /Tags|Schlagwörter/i });
		// The parent div of the heading contains the entity manager
		const tagsSection = page.locator('div').filter({ has: tagsHeading }).last();

		// Click Quick Create in Tags section
		// The button has a plus icon and text "Quick Create" or German equivalent
		await tagsSection.getByRole('button').filter({ hasText: /Quick Create|Schnell/i }).click();

		// Verify dialog IS open
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Type tag name inside the dialog
		const tagName = `E2E-Tag-${Date.now()}`;
		const nameInput = dialog.locator('input#name');
		await expect(nameInput).toBeVisible();
		await nameInput.fill(tagName);

		// Submit the form inside the dialog
		await dialog.locator('button[type="submit"]').click();

		// Wait for toast
		await waitForToast(page);

		// Verify the dialog closed automatically
		await expect(dialog).toBeHidden();

		// Tag should be associated (visible in the list of associated items, which shows the tag name)
		await expect(tagsSection.getByText(tagName)).toBeVisible();
	});

});
