import { expect, test } from "@playwright/test";

test("renders the managed entity inventory", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "systemd-first homelab sandbox manager" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Managed Entities" })).toBeVisible();
  await expect(page.getByText(/items/)).toBeVisible();

  const cards = page.locator(".entity-card");
  await expect(cards.first()).toBeVisible();
  await expect(page.locator(".badge")).toHaveCount(await cards.count());
});
