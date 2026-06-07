import { test, expect } from '@playwright/test';

test('starting a project kicks off visible collaboration', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder(/Give the company a project/).fill('a habit-tracking app');
  await page.getByRole('button', { name: 'START' }).click();

  // The company flips to a working state and the brief lands in the feed.
  await expect(page.getByText('○ IDLE')).toHaveCount(0);
  await expect(page.getByText('New project: a habit-tracking app')).toBeVisible();

  // The team gathers for a meeting (status + activity both reflect it).
  await expect(page.getByText('Team gathers in the War Room')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('In meeting').first()).toBeVisible();
});
