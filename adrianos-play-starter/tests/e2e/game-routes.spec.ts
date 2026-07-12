import { expect, test, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { seedQaFamily } from "./helpers/seed-family";

type GameMetadata = {
  slug?: string;
  status?: string;
};

function loadGameSlugs(): string[] {
  const gamesRoot = path.resolve(process.cwd(), "app", "games");
  return readdirSync(gamesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadataPath = path.join(gamesRoot, entry.name, "game.json");
      const pagePath = path.join(gamesRoot, entry.name, "page.tsx");
      if (!existsSync(metadataPath) || !existsSync(pagePath)) return null;
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as GameMetadata;
      if (!metadata.slug || metadata.status === "hidden") return null;
      return metadata.slug;
    })
    .filter((slug): slug is string => Boolean(slug))
    .sort();
}

const gameSlugs = loadGameSlugs();

async function assertGameRenders(page: Page, slug: string) {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().startsWith("http://127.0.0.1:3000")) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await seedQaFamily(page, { clear: true });
  const response = await page.goto(`/games/${slug}`, { waitUntil: "domcontentloaded" });
  expect(response, `${slug} should return a document response`).not.toBeNull();
  expect(response?.status(), `${slug} should not return an HTTP error`).toBeLessThan(400);

  await expect(page.locator("body")).toBeVisible();
  await expect.poll(async () => (await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);

  const feelShell = page.locator('[data-game-feel-shell="active"]');
  await expect(feelShell, `${slug} should receive the shared game feel engine`).toBeVisible();
  await expect(feelShell).toHaveAttribute("data-game-slug", slug);
  await expect(feelShell.locator(".game-feel-ambient")).toHaveCount(1);

  const powerLoop = page.locator('[data-game-power-loop="active"]');
  await expect(powerLoop, `${slug} should receive the shared game power loop`).toBeVisible();
  await expect(powerLoop).toHaveAttribute("data-power-ready", "true");

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/Application error|Internal Server Error|This page could not be found/i);

  await page.waitForTimeout(250);
  expect(pageErrors, `${slug} should not throw an uncaught browser error`).toEqual([]);
  expect(serverErrors, `${slug} should not trigger a same-origin 5xx response`).toEqual([]);
}

test.describe("all game routes render", () => {
  for (const slug of gameSlugs) {
    test(`${slug} renders on desktop`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await assertGameRenders(page, slug);
    });

    test(`${slug} renders on phone`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await assertGameRenders(page, slug);
    });
  }
});
