import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = (process.env.ADRIANOS_PRODUCTION_URL ?? "https://adrian-os-murex.vercel.app").replace(/\/$/, "");
const attempts = Number(process.env.AUTH_SMOKE_ATTEMPTS ?? 10);
const pauseMs = Number(process.env.AUTH_SMOKE_PAUSE_MS ?? 12000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodedSeveralTimes(value) {
  let current = value;
  for (let index = 0; index < 4; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

async function runAttempt(attempt) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const response = await page.goto(`${origin}/join?cohort=general&oauth-smoke=1`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) {
      throw new Error(`Join page returned ${response?.status() ?? "no response"}.`);
    }

    const button = page.getByRole("button", { name: "Continue with Google" });
    await button.waitFor({ state: "visible", timeout: 12_000 });
    if (await button.isDisabled()) {
      throw new Error("Continue with Google is disabled. Supabase browser variables are missing from production.");
    }

    await Promise.all([
      page.waitForURL((url) => url.hostname === "accounts.google.com", { timeout: 25_000 }),
      button.click(),
    ]);

    const googleUrl = page.url();
    const decodedUrl = decodedSeveralTimes(googleUrl);
    const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();

    if (!decodedUrl.includes("client_id=")) {
      throw new Error("Google OAuth URL did not include a client_id.");
    }
    if (!decodedUrl.includes(".supabase.co/auth/v1/callback")) {
      throw new Error("Google OAuth URL did not include the Supabase auth callback.");
    }
    if (body.includes("redirect_uri_mismatch") || body.includes("error 400")) {
      throw new Error("Google rejected the callback with redirect_uri_mismatch or Error 400.");
    }

    console.log(`OAuth smoke passed on attempt ${attempt}.`);
    console.log(`Google host: ${new URL(googleUrl).hostname}`);
    console.log("Client ID present: yes");
    console.log("Supabase callback present: yes");
  } catch (error) {
    await fs.mkdir("test-results/production-auth", { recursive: true });
    await page.screenshot({
      path: `test-results/production-auth/attempt-${attempt}.png`,
      fullPage: true,
    }).catch(() => undefined);
    throw error;
  } finally {
    await browser.close();
  }
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await runAttempt(attempt);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`OAuth smoke attempt ${attempt}/${attempts} failed:`, error instanceof Error ? error.message : error);
    if (attempt < attempts) await sleep(pauseMs);
  }
}

throw lastError ?? new Error("Production Google OAuth smoke failed.");
