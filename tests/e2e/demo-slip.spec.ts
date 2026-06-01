import { test, expect } from "@playwright/test";

test("demo page renders a slip and the engine computed Gesamt-Brutto", async ({
  page,
}) => {
  await page.goto("/demo");

  // The slip renders inside the template iframe.
  const frame = page.frameLocator("iframe[title='slip']");

  // #gesamtBruttoCell is filled by the template's own computeTotals().
  const cell = frame.locator("#gesamtBruttoCell");
  await expect(cell).toBeVisible();

  // German currency like "2.149,01" — proves the embedded engine ran.
  await expect(cell).toHaveText(/^\d{1,3}(\.\d{3})*,\d{2}$/);
});
