import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for the Home page.
 */
test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the main heading and tagline', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('visual');
    await expect(page.locator('h1')).toContainText('JS');
    await expect(page.locator('.tagline')).toContainText('See how JavaScript thinks.');
  });

  test('renders all 9 module cards', async ({ page }) => {
    const cards = page.locator('.module-card');
    await expect(cards).toHaveCount(9);
  });

  test('navigating to Variables module via card click', async ({ page }) => {
    await page.locator('a[href="#/variables"]').click();
    await page.waitForSelector('h2', { timeout: 5000 });
    const title = await page.locator('h2').textContent();
    expect(title).toContain('Store');
  });

  test('navigating to IfGate module via card click', async ({ page }) => {
    await page.locator('a[href="#/if-gate"]').click();
    await page.waitForSelector('h2', { timeout: 5000 });
    const title = await page.locator('h2').textContent();
    expect(title).toContain('Gate');
  });

  test('navigating to ForLoop module via card click', async ({ page }) => {
    await page.locator('a[href="#/for-loop"]').click();
    await page.waitForSelector('h2', { timeout: 5000 });
    const title = await page.locator('h2').textContent();
    expect(title).toContain('Loop');
  });

  test('back link returns to home from a module', async ({ page }) => {
    await page.locator('a[href="#/variables"]').click();
    await page.waitForSelector('h2', { timeout: 5000 });
    await page.locator('.back').click();
    await expect(page.locator('h1')).toContainText('JS');
  });

  test('unknown hash shows "Module not found"', async ({ page }) => {
    await page.goto('/#/nonexistent-module');
    await expect(page.locator('.not-found')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.not-found')).toContainText('Module not found');
  });
});
