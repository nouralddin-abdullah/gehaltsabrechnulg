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

test("sidebar navigates between sections", async ({ page }) => {
  await signup(page, "nav");

  await page.getByRole("link", { name: "Companies" }).first().click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();

  await page.getByRole("link", { name: "Employees" }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("company can be edited", async ({ page }) => {
  await signup(page, "edit");

  await page.goto("/companies");
  await page.fill("input[name='name']", "OldName");
  await page.fill("input[name='firma']", "OldName GmbH*Str 1*10115 Berlin");
  await page.click("button:has-text('Add company')");
  await expect(page.getByText("OldName", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).first().click();
  await expect(page).toHaveURL(/\/companies\/[0-9a-f-]+\/edit$/);
  await page.fill("input[name='name']", "NewName");
  await page.fill("input[name='mandant_box']", "30605");
  await page.click("button:has-text('Save changes')");

  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.getByText("NewName", { exact: true })).toBeVisible();
});
