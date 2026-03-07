import { expect, test } from "@playwright/test";

test("renders the managed entity inventory", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "systemd-first homelab sandbox manager" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Managed Entities" })).toBeVisible();
  await expect(page.getByText("2 items")).toBeVisible();

  const dockerCard = page.locator(".entity-card").filter({ hasText: "docker.service" });
  const sandboxCard = page.locator(".entity-card").filter({ hasText: "lab-api.service" });

  await expect(dockerCard).toContainText("systemd-unit");
  await expect(dockerCard).toContainText("external");
  await expect(sandboxCard).toContainText("sandbox-service");
  await expect(sandboxCard).toContainText("sandboxd");
});
