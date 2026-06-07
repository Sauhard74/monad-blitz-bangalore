import { test, expect } from '@playwright/test';

test('office loads and the Phaser canvas renders without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const ready = page.waitForEvent('console', {
    predicate: (m) => m.text().includes('[OfficeScene] ready'),
    timeout: 15_000,
  });

  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);

  // The scene actually booted (not just an empty canvas element).
  await ready;

  expect(pageErrors, `page errors: ${pageErrors.join(', ')}`).toEqual([]);
});
