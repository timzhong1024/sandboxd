import { expect, test } from "@playwright/test";

test("renders the managed entity inventory", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "A homelab control surface with the feel of a compact appliance.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Managed entity inventory" }),
  ).toBeVisible();
  await expect(page.getByText("Total entities")).toBeVisible();
  await expect(page.getByText("lab-api.service")).toBeVisible();
  await expect(page.getByText("lab-worker.service")).toBeVisible();
  await expect(page.getByText("lab-batch.service")).toBeVisible();

  const cards = page.getByRole("list").getByRole("listitem");
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(4);
});
