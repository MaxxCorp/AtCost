import { expect, test, Page } from '@playwright/test';

const HARNESS_ROUTE = '/testing/campaigns-automation';

const createRng = (seed = 1337) => {
	let value = seed;
	return () => {
		value = (value * 9301 + 49297) % 233280;
		return value / 233280;
	};
};

const randInt = (rng: () => number, min: number, max: number) =>
	Math.floor(rng() * (max - min + 1)) + min;

const shuffleSample = <T,>(rng: () => number, items: T[], count: number) => {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy.slice(0, count);
};

const cardLocator = (page: Page, id: string) =>
	page.locator(`[data-testid="campaign-card"][data-campaign-id="${id}"]`);

const checkboxLocator = (page: Page, id: string) =>
	cardLocator(page, id).locator('input[type="checkbox"]');

const deleteButtonLocator = (page: Page, id: string) =>
	cardLocator(page, id).getByRole('button', { name: 'Delete' });

const getCampaignIds = async (page: Page) => {
	return await page
		.locator('[data-testid="campaign-card"]')
		.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-campaign-id') || ''));
};

const getSelectedIds = async (page: Page) => {
	return (
		await page
			.locator('[data-testid="campaign-card"]')
			.evaluateAll((cards) =>
				cards
					.map((card) => {
						const id = card.getAttribute('data-campaign-id') || '';
						const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
						return checkbox?.checked ? id : null;
					})
					.filter((id): id is string => Boolean(id))
			)
	);
};

const ensureSelectionCount = async (page: Page, rng: () => number, target: number) => {
	let selected = await getSelectedIds(page);
	if (selected.length > target) {
		const toUnselect = shuffleSample(rng, selected, selected.length - target);
		for (const id of toUnselect) {
			await toggleSelection(page, id, false);
		}
	}

	selected = await getSelectedIds(page);

	if (selected.length < target) {
		const ids = await getCampaignIds(page);
		const unselected = ids.filter((id) => !selected.includes(id));
		const needed = target - selected.length;
		const toSelect = shuffleSample(rng, unselected, needed);
		for (const id of toSelect) {
			await toggleSelection(page, id, true);
		}
	}

	return await getSelectedIds(page);
};

const toggleSelection = async (page: Page, id: string, selected: boolean) => {
	const checkbox = checkboxLocator(page, id);
	if ((await checkbox.isChecked()) !== selected) {
		await checkbox.click();
	}
};

const assertBulkVisibility = async (page: Page) => {
	const selectedCount = (await getSelectedIds(page)).length;
	const bulkButton = page.getByRole('button', { name: /Delete Selected/ });

	if (selectedCount === 0) {
		await expect(bulkButton).toHaveCount(0);
	} else {
		await expect(bulkButton).toHaveCount(1);
		await expect(bulkButton).toHaveText(`Delete Selected (${selectedCount})`);
	}

	return selectedCount;
};

const expectRemovalWithinTwoSeconds = async (page: Page, ids: string[]) => {
	for (const id of ids) {
		await expect(cardLocator(page, id)).toHaveCount(0, { timeout: 2000 });
	}
};

const waitForToast = async (page: Page, text: string) => {
	await expect(page.getByRole('alert').filter({ hasText: text }).first()).toBeVisible();
};

const performBulkDelete = async (page: Page, rng: () => number, deleteCount: number) => {
	const activeSelection = await ensureSelectionCount(page, rng, deleteCount);
	const bulkButton = page.getByRole('button', { name: `Delete Selected (${deleteCount})` });

	const dialogPromise = page.waitForEvent('dialog').then((dialog) => {
		expect(dialog.message()).toBe(
			`Delete ${deleteCount} ${deleteCount === 1 ? 'campaign' : 'campaigns'}?`
		);
		dialog.accept();
	});

	await bulkButton.click();
	await dialogPromise;

	const toastMessage = `${deleteCount} ${deleteCount === 1 ? 'campaign' : 'campaigns'} deleted successfully!`;
	await waitForToast(page, toastMessage);
	await expectRemovalWithinTwoSeconds(page, activeSelection.slice(0, deleteCount));
	await assertBulkVisibility(page);
};

const performSingleDeletes = async (page: Page, rng: () => number, deleteCount: number) => {
	const ids = await getCampaignIds(page);
	const targets = shuffleSample(rng, ids, deleteCount);

	for (const id of targets) {
		await deleteButtonLocator(page, id).click();
		await waitForToast(page, 'Campaign deleted successfully!');
		await expectRemovalWithinTwoSeconds(page, [id]);
	}

	await assertBulkVisibility(page);
};

const randomlyToggleSelection = async (page: Page, rng: () => number, ids: string[]) => {
	const maxSelect = Math.min(3, ids.length);
	const selectCount = randInt(rng, 0, maxSelect);
	const toSelect = shuffleSample(rng, ids, selectCount);

	for (const id of toSelect) {
		await toggleSelection(page, id, true);
	}

	const currentSelection = await getSelectedIds(page);
	const maxUnselect = Math.min(3, currentSelection.length);
	const unselectCount = randInt(rng, 0, maxUnselect);
	const toUnselect = shuffleSample(rng, currentSelection, unselectCount);

	for (const id of toUnselect) {
		await toggleSelection(page, id, false);
	}

	await assertBulkVisibility(page);
};

const deleteLoop = async (page: Page, rng: () => number) => {
	while ((await page.getByTestId('campaign-card').count()) > 0) {
		const ids = await getCampaignIds(page);
		await randomlyToggleSelection(page, rng, ids);

		const deleteCount = Math.min(randInt(rng, 1, 3), ids.length);
		const useBulk = rng() > 0.5;

		if (useBulk) {
			await performBulkDelete(page, rng, deleteCount);
		} else {
			await performSingleDeletes(page, rng, deleteCount);
		}
	}
};

const seedCampaigns = async (page: Page) => {
	for (let index = 1; index <= 10; index++) {
		await page.getByTestId('campaign-name-input').fill(`Test ${index}`);
		await page.getByTestId('campaign-content-input').fill('{}');
		await page.getByTestId('campaign-submit').click();
		await expect(page.getByTestId('campaign-card')).toHaveCount(index);
	}
};

const verifyBulkButtonMatchesSelection = async (page: Page) => {
	const selected = await getSelectedIds(page);
	const bulkButton = page.getByRole('button', { name: /Delete Selected/ });

	if (selected.length === 0) {
		await expect(bulkButton).toHaveCount(0);
	} else {
		await expect(bulkButton).toHaveText(`Delete Selected (${selected.length})`);
	}
};

test('campaign list interactions remain stable under random deletes', async ({ page }) => {
	await page.goto(HARNESS_ROUTE);
	await expect(page.getByTestId('campaign-harness')).toHaveAttribute('data-hydrated', 'true');
	await seedCampaigns(page);

	const rng = createRng(20241114);
	await deleteLoop(page, rng);

	await expect(page.getByTestId('campaign-card')).toHaveCount(0);
	await verifyBulkButtonMatchesSelection(page);
});
