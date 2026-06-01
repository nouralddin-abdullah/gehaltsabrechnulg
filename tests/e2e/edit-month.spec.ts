import { test, expect } from "@playwright/test";

// Editing a saved month must flow through to the generated slip.
test("editing a month updates the generated slip", async ({ page }) => {
  test.setTimeout(90000);
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `m${tag}`);
  await page.fill("input[name='email']", `mon_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // employee (no automatik needed — gross is automatik-independent)
  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Edit Tester");
  await page.click("button:has-text('Continue')");
  await page.click("button:has-text('Save & finish')");
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);

  // add a month: 100,00 × 20,00 = 2.000,00
  await page.click("text=Add month");
  await page.selectOption("select[name='monat']", "März");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");
  await expect(page).toHaveURL(/\/payslips\/[0-9a-f-]+$/);

  const slip = page.frameLocator("iframe[title='slip']");
  await expect(slip.locator("#gesamtBruttoCell")).toHaveText("2.000,00", {
    timeout: 15000,
  });

  // edit: change Menge to 150,00 → the slip must now show 3.000,00
  await page.click("text=Edit month");
  await expect(page).toHaveURL(/\/edit$/);
  await page.fill("input[placeholder='Menge']", "150,00");
  await page.click("button:has-text('Save month')");
  await expect(page).toHaveURL(/\/payslips\/[0-9a-f-]+$/);
  await expect(slip.locator("#gesamtBruttoCell")).toHaveText("3.000,00", {
    timeout: 15000,
  });
});
