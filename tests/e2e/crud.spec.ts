import { test, expect } from "@playwright/test";

test("user can add a company and an employee, then search and delete", async ({
  page,
}) => {
  // fresh account
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `u${tag}`);
  await page.fill("input[name='email']", `crud_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // add a company
  await page.goto("/companies");
  await page.fill("input[name='name']", "ACME GmbH");
  await page.fill("input[name='firma']", "ACME GmbH*Street 1*10115 Berlin");
  await page.click("button:has-text('Add company')");
  await expect(page.getByText("ACME GmbH", { exact: true })).toBeVisible();

  // add an employee via the wizard (skip company + months)
  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Max Mustermann");
  await page.click("button:has-text('Continue')");
  await page.click("button:has-text('Save & finish')");
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);
  await page.goto("/dashboard");
  await expect(page.getByText("Max Mustermann")).toBeVisible();

  // search narrows the list
  await page.fill("input[placeholder='Search employees…']", "zzz");
  await expect(page.getByText("Max Mustermann")).toHaveCount(0);
  await page.fill("input[placeholder='Search employees…']", "max");
  await expect(page.getByText("Max Mustermann")).toBeVisible();

  // delete
  await page.fill("input[placeholder='Search employees…']", "");
  await page.click("li:has-text('Max Mustermann') button:has-text('Delete')");
  await expect(page.getByText("Max Mustermann")).toHaveCount(0);
});
