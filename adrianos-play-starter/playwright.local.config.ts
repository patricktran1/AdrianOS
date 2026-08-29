// Local-only override: this sandbox ships a preinstalled Chromium that does not
// match the version @playwright/test would download. Not used by CI.
import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
  },
});
