import { test, expect } from "@playwright/test";

test.describe("Highlands documentation assistant", () => {
  test("chat, citation, feedback, admin source and sync", async ({ page }) => {
    await page.goto("/chat");

    await page.getByText("How do I request technology support?").click();
    await expect(page.getByText("Helper")).toBeVisible();
    await expect(
      page.getByText("technology support", { exact: false }),
    ).toBeVisible({
      timeout: 15000,
    });

    const citationLink = page.getByRole("link", {
      name: "Requesting Technology Support",
    });
    await expect(citationLink).toBeVisible();

    await page.getByRole("button", { name: "Helpful" }).click();

    await page.getByRole("link", { name: "Sources" }).click();
    await page.waitForURL("**/admin/sources");
    await expect(page.getByText("Approved sources")).toBeVisible();

    await page.getByRole("link", { name: "Sync" }).click();
    await page.waitForURL("**/admin/sync");
    await page.getByRole("button", { name: "Run full sync" }).click();
    await expect(
      page.getByText(/Sync COMPLETED|Sync FAILED|Sync CANCELLED/),
    ).toBeVisible({
      timeout: 30000,
    });
  });
});
