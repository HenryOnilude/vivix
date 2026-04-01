import { test, expect } from '@playwright/test';

/**
 * End-to-end test for the varStore (Variables & Memory) module.
 *
 * Flow:
 *   1. Load the app at the home screen
 *   2. Navigate to the Variables module via hash routing
 *   3. Pick the "Numbers" preset example
 *   4. Click ▶ Visualize to run the interpreter
 *   5. Verify the first step renders (step counter shows "1/…")
 *   6. Step forward twice and verify the counter advances
 *   7. Confirm the CPU SVG dashboard is visible
 *   8. Confirm the heap memory card appears with at least one variable box
 */

test.describe('varStore module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Variables module
    await page.goto('/#/variables');
    // Wait for the module title to be visible
    await page.waitForSelector('h2', { timeout: 5000 });
  });

  test('loads and shows title', async ({ page }) => {
    const title = await page.locator('h2').textContent();
    expect(title).toContain('Store');
  });

  test('can pick "Numbers" example and visualize', async ({ page }) => {
    // Click the "Numbers" example button
    await page.getByRole('button', { name: 'Numbers' }).click();

    // Click ▶ Visualize
    await page.getByRole('button', { name: /Visualize/ }).click();

    // Step counter should show "1/…"
    await expect(page.locator('.sc')).toContainText('1/');
  });

  test('steps forward through the execution', async ({ page }) => {
    await page.getByRole('button', { name: 'Numbers' }).click();
    await page.getByRole('button', { name: /Visualize/ }).click();

    // Wait for step counter
    const counter = page.locator('.sc');
    await expect(counter).toContainText('1/');

    // Step forward
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(counter).toContainText('2/');

    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(counter).toContainText('3/');
  });

  test('CPU dashboard SVG is visible after visualize', async ({ page }) => {
    await page.getByRole('button', { name: 'Numbers' }).click();
    await page.getByRole('button', { name: /Visualize/ }).click();

    // CpuDash renders an SVG with class cpu-svg
    await expect(page.locator('.cpu-svg')).toBeVisible({ timeout: 3000 });
  });

  test('heap memory card shows variable boxes', async ({ page }) => {
    await page.getByRole('button', { name: 'Numbers' }).click();
    await page.getByRole('button', { name: /Visualize/ }).click();

    // Step to step 2 so at least one variable is declared
    await page.getByRole('button', { name: 'Next step' }).click();

    // The heap-card should contain at least one .heap-box
    await expect(page.locator('.heap-box').first()).toBeVisible({ timeout: 3000 });
  });

  test('last button jumps to final step', async ({ page }) => {
    await page.getByRole('button', { name: 'Numbers' }).click();
    await page.getByRole('button', { name: /Visualize/ }).click();

    // Get total steps from counter "1/N" — extract N
    const counterText = await page.locator('.sc').textContent();
    const total = parseInt(counterText.split('/')[1]);
    expect(total).toBeGreaterThan(1);

    // Click Last ⟫
    await page.getByRole('button', { name: 'Last step' }).click();

    await expect(page.locator('.sc')).toContainText(`${total}/${total}`);
  });

  test('Edit button resets to editor', async ({ page }) => {
    await page.getByRole('button', { name: 'Numbers' }).click();
    await page.getByRole('button', { name: /Visualize/ }).click();

    // The ✎ Edit button appears
    await page.getByRole('button', { name: /Edit/ }).click();

    // After edit, the ▶ Visualize button is visible again and ✎ Edit is gone
    await expect(page.getByRole('button', { name: /Visualize/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit/ })).not.toBeVisible();
  });
});
