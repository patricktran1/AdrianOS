import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

test.describe("installable AdrianOS app", () => {
  test("publishes a complete School Mode manifest", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/manifest+json");

    const manifest = await response.json();
    expect(manifest.name).toBe("AdrianOS Learning");
    expect(manifest.short_name).toBe("AdrianOS");
    expect(manifest.start_url).toBe("/school?source=installed-app");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/adrianos-192", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "/icons/adrianos-512", sizes: "512x512", type: "image/png" }),
    ]));
    expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toContain("/school?source=app-shortcut");
  });

  test("serves real PNG app icons", async ({ request }) => {
    for (const path of ["/icons/adrianos-192", "/icons/adrianos-512", "/icons/apple-touch"]) {
      const response = await request.get(path);
      expect(response.ok(), path).toBeTruthy();
      expect(response.headers()["content-type"], path).toContain("image/png");
      expect((await response.body()).byteLength, path).toBeGreaterThan(1000);
    }
  });

  test("delivers a root-scoped, noncached service worker", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/javascript");
    expect(response.headers()["cache-control"]).toContain("no-cache");
    expect(response.headers()["service-worker-allowed"]).toBe("/");
    const body = await response.text();
    expect(body).toContain("adrianos-shell-v2");
    expect(body).toContain('"/curriculum"');
    expect(body).toContain("url.origin !== self.location.origin");
    expect(body).toContain('url.pathname.startsWith("/auth/")');
  });

  test("shows the correct iPhone installation path without horizontal overflow", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/install", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Give learning its own front door." })).toBeVisible();
    await expect(page.getByText("Tap the Share button")).toBeVisible();
    await expect(page.getByText("Choose Add to Home Screen")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });

  test("the installed start URL opens School Mode for a configured learner", async ({ page, request }) => {
    await seedQaFamily(page, { clear: true });
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    await page.goto(manifest.start_url, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/school\?source=installed-app/);
    await expect(page.locator("main")).toBeVisible();
  });
});
