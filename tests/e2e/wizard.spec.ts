import { test, expect } from "@playwright/test";

async function signup(page: import("@playwright/test").Page, prefix: string) {
  const tag = Date.now().toString(36) + prefix;
  await page.goto("/signup");
  await page.fill("input[name='username']", `${prefix}${tag}`);
  await page.fill("input[name='email']", `${prefix}_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("wizard: personal -> inline company -> month -> employee detail", async ({
  page,
}) => {
  await signup(page, "wiz");

  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Wizard Hero");
  await page.click("button:has-text('Continue')");

  // step 2: add a company inline
  await page.click("button:has-text('+ Add company')");
  await page.fill("input[name='name']", "WizCo");
  await page.fill("input[name='firma']", "WizCo GmbH*Str 1*10115 Berlin");
  await page.click("button:has-text('Save company')");
  await page.click("button:has-text('Continue')");

  // step 3: add a month, finish on employee detail
  await page.selectOption("select[name='monat']", "März");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");

  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Wizard Hero" })).toBeVisible();
  await expect(page.getByText("März 2026")).toBeVisible();
});

test("wizard: can skip company and months after step 1", async ({ page }) => {
  await signup(page, "skip");

  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Skip Person");
  await page.click("button:has-text('Continue')");
  await page.click("button:has-text('Skip for now')"); // company
  await page.click("button:has-text('Skip for now')"); // months

  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Skip Person" })).toBeVisible();
  await expect(page.getByText("No months yet.")).toBeVisible();
});
