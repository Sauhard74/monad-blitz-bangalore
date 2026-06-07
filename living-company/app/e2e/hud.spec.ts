import { test, expect } from '@playwright/test';

test('clicking an employee in the roster opens their detail card', async ({ page }) => {
  await page.goto('/');

  // Roster renders the seeded cast.
  const ada = page.getByRole('button', { name: /Ada/ });
  await expect(ada).toBeVisible();

  await ada.click();

  // The detail card shows the role blurb.
  await expect(page.getByText(/Sets the vision/)).toBeVisible();
});
