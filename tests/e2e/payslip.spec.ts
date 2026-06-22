import { test, expect } from "@playwright/test";

test("print spends one credit per employee; serial assign-once; reprint free", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `p${tag}`);
  await page.fill("input[name='email']", `pay_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // buy a credit pack (payment is mocked for now)
  await page.goto("/credits");
  await page.click("button:has-text('Buy')");
  await expect(page.getByText(/credit/).first()).toBeVisible();

  // company
  await page.goto("/companies");
  await page.fill("input[name='name']", "PayCo");
  await page.fill("input[name='firma']", "PayCo GmbH*Str 1*10115 Berlin");
  await page.click("button:has-text('Add company')");
  await expect(page.getByText("PayCo", { exact: true })).toBeVisible();

  // employee (automatik on so the engine computes) via the wizard
  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Erika Beispiel");
  await page.fill("input[name='meta.stKl']", "1");
  await page.check("input[name='automatik.enabled']");
  await page.fill("input[name='automatik.bundesland']", "BE");
  await page.click("button:has-text('Continue')");
  await page.click("button:has-text('Save & finish')");
  await expect(page.getByRole("heading", { name: "Erika Beispiel" })).toBeVisible();

  // month 1 (März)
  await page.click("text=Add month");
  await page.selectOption("select[name='monat']", "März");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[name='druckdatum']", "31.03.2026");
  await page.fill("input[placeholder='LA']", "100");
  await page.fill("input[placeholder='Bezeichnung']", "Normalstunden");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");

  // preview page → first print spends the credit and assigns a serial
  await page.click("button:has-text('Print (1 credit)')");
  const serial1Text = await page.getByText(/Serial #\d+/).textContent();
  const serial1 = Number(serial1Text!.match(/\d+/)![0]);
  expect(serial1).toBeGreaterThan(0);

  // reprint = revisit: same serial, no further charge
  await page.reload();
  await expect(page.getByText(`Serial #${serial1}`)).toBeVisible();

  // month 2 (April): same employee is already unlocked → printing is free
  await page.goto(`/dashboard`);
  await page.click("text=Erika Beispiel");
  await page.click("text=Add month");
  await page.selectOption("select[name='monat']", "April");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[placeholder='LA']", "100");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");
  await page.click("button:has-text('Print (free)')");
  const serial2Text = await page.getByText(/Serial #\d+/).textContent();
  const serial2 = Number(serial2Text!.match(/\d+/)![0]);
  expect(serial2).toBe(serial1 + 1);
});
