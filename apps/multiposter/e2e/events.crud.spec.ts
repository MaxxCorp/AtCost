import { test, expect } from '@playwright/test';

test.describe('Events CRUD', () => {
    test('full CRUD flow', async ({ page }) => {
        // 1. Navigate to events page
        await page.goto('/events');
        await expect(page).toHaveURL(/\/events/);

        // 2. CREATE
        await page.goto('/events/new');
        await page.waitForLoadState('networkidle');
        await page.fill('input[name="summary"]', 'E2E Test A');
        await page.fill('textarea[name="description"]', 'Desc A');
        
        const today = new Date().toISOString().split('T')[0];
        await page.fill('input[type="date"]', today);

        await page.click('button:has-text("Save")');
        // Wait for redirect to /events or success message
        await page.waitForURL(/\/events/);
        
        // Verify 'E2E Test A' is in the list
        await expect(page.locator('h3', { hasText: 'E2E Test A' })).toBeVisible();

        // 3. UPDATE
        // Find the Edit button for 'E2E Test A'
        const eventACard = page.locator('.bg-white', { hasText: 'E2E Test A' }).first();
        await eventACard.locator('a:has-text("Edit")').click();

        // Wait for form to load
        await page.waitForLoadState('networkidle');

        // Verify prefill
        await expect(page.locator('input[name="summary"]')).toHaveValue('E2E Test A');

        // Update summary
        await page.fill('input[name="summary"]', 'E2E Test A - Updated');
        await page.click('button:has-text("Save")');

        await page.waitForURL(/\/events/);
        
        // Verify update in list
        await expect(page.locator('h3', { hasText: 'E2E Test A - Updated' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'E2E Test A' })).toHaveCount(0); // The exact old text shouldn't be a standalone heading anymore

        // 4. CREATE SECOND ITEM
        await page.goto('/events/new');
        await page.waitForLoadState('networkidle');
        
        // Ensure no bleed
        await expect(page.locator('input[name="summary"]')).toHaveValue('');

        await page.fill('input[name="summary"]', 'E2E Test B');
        await page.fill('textarea[name="description"]', 'Desc B');
        await page.fill('input[type="date"]', today);
        await page.click('button:has-text("Save")');

        await page.waitForURL(/\/events/);
        await expect(page.locator('h3', { hasText: 'E2E Test B' })).toBeVisible();

        // 5. UPDATE SECOND ITEM
        const eventBCard = page.locator('.bg-white', { hasText: 'E2E Test B' }).first();
        await eventBCard.locator('a:has-text("Edit")').click();
        await page.waitForLoadState('networkidle');

        // Verify prefill again
        await expect(page.locator('input[name="summary"]')).toHaveValue('E2E Test B');
        await page.click('button:has-text("Save")');
        await page.waitForURL(/\/events/);

        // 6. DELETE BOTH
        // Handle confirm dialogs automatically
        page.on('dialog', dialog => dialog.accept());

        // Delete B
        const cardB = page.locator('.bg-white', { hasText: 'E2E Test B' }).first();
        await cardB.locator('button:has-text("Delete")').click();
        
        // Wait for it to disappear
        await expect(page.locator('h3', { hasText: 'E2E Test B' })).toHaveCount(0);

        // Delete A
        const cardA = page.locator('.bg-white', { hasText: 'E2E Test A - Updated' }).first();
        await cardA.locator('button:has-text("Delete")').click();

        // Wait for it to disappear
        await expect(page.locator('h3', { hasText: 'E2E Test A - Updated' })).toHaveCount(0);
    });
});
