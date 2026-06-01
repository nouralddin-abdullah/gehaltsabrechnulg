import { test, expect } from "@playwright/test";

// End-to-end: create an employee, save three months, and verify the slip's
// "Jahres-Werte" block shows the TRUE SUM of the three captured months.
// Each month's computed_totals is captured from the rendered iframe and persisted;
// waiting for the running cumulative after each month also proves the previous
// month persisted before the next one's preview loads.
test("cumulative across 3 saved months shows the true sum on the slip", async ({
  page,
}) => {
  test.setTimeout(120000);
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `c${tag}`);
  await page.fill("input[name='email']", `cum_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // employee with Automatik on (full engine runs per month)
  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Cumul Tester");
  await page.check("input[name='automatik.enabled']");
  await page.fill("input[name='automatik.steuerklasse']", "1");
  await page.fill("input[name='automatik.bundesland']", "BE");
  await page.fill("input[name='automatik.age']", "30");
  await page.click("button:has-text('Continue')");
  await page.click("button:has-text('Save & finish')");
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);
  const employeeUrl = page.url();

  const slip = page.frameLocator("iframe[title='slip']");

  // each month is 100,00 Std × 20,00 = 2.000,00 gross
  async function addMonth(monat: string) {
    await page.goto(employeeUrl);
    await page.click("text=Add month");
    await page.selectOption("select[name='monat']", monat);
    await page.fill("input[name='jahr']", "2026");
    await page.fill("input[placeholder='Menge']", "100,00");
    await page.fill("input[placeholder='Faktor']", "20,00");
    await page.click("button:has-text('Save month')");
    await expect(page).toHaveURL(/\/payslips\/[0-9a-f-]+$/);
  }

  // März → running cumulative 2.000,00 (this month captured)
  await addMonth("März");
  await expect(slip.locator("#yGesamtBrutto")).toHaveText("2.000,00", {
    timeout: 15000,
  });
  await page.waitForTimeout(900); // let computed_totals persist to the DB

  // April → 4.000,00 (proves März persisted and is summed)
  await addMonth("April");
  await expect(slip.locator("#yGesamtBrutto")).toHaveText("4.000,00", {
    timeout: 15000,
  });
  await page.waitForTimeout(900);

  // Mai → 6.000,00 across all three months
  await addMonth("Mai");
  await expect(slip.locator("#yGesamtBrutto")).toHaveText("6.000,00", {
    timeout: 15000,
  });
  await expect(slip.locator("#yearSuffix")).toContainText("3 Monate");
});
