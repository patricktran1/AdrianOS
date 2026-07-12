import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

const profiles = await source("lib/adrian-profiles.ts");
const home = await source("components/HomeExperience.tsx");
const gate = await source("components/FamilyOnboardingGate.tsx");
const setup = await source("components/FamilySetup.tsx");
const learnerProfile = await source("lib/adrian-learning-profile.ts");
const dailySession = await source("lib/adrian-daily-session.ts");
const placement = await source("app/games/placement-adventure/page.tsx");
const layout = await source("app/layout.tsx");

if (!profiles.includes('activeProfileId: ""') || !profiles.includes("profiles: []")) {
  failures.push("profiles: new family state is not empty");
}
if (profiles.includes("DEFAULT_PROFILES") || profiles.includes('name: "Adrian"') || profiles.includes('name: "Elliot"')) {
  failures.push("profiles: personal sample children are still hard-coded as defaults");
}
if (!profiles.includes("migrateUntouchedLegacyStarter") || !profiles.includes("legacyStarterHasRealProgress")) {
  failures.push("profiles: safe migration for untouched old starter data is missing");
}
if (!home.includes("Start with your learner.") || !home.includes("if (!hasProfiles)")) {
  failures.push("homepage: privacy-first blank slate is missing");
}
if (!gate.includes("PROFILE_REQUIRED_PREFIXES") || !layout.includes("<FamilyOnboardingGate>")) {
  failures.push("routing: learner-only pages are not guarded before setup");
}
if (!setup.includes("LEARNER_INTERESTS") || !setup.includes("LEARNING_PRIORITIES") || !setup.includes("sessionMinutes")) {
  failures.push("setup: interests, priorities, or session length are missing");
}
if (!learnerProfile.includes("learner-profile-settings") || !learnerProfile.includes("writeLearningForProfile")) {
  failures.push("personalization: learner settings are not stored in synced learning state");
}
for (const contract of ["hasCompletedPlacement", "personalizedExploreItem", "Parent priority:", "placementFirst"]) {
  if (!dailySession.includes(contract)) failures.push(`daily session: missing ${contract}`);
}
if (!dailySession.includes('if (placement) return [placement]')) {
  failures.push("daily session: a first placement map can be displaced by a free or light day");
}
if (!placement.includes("useFamilyProfiles") || placement.includes("getActiveProfile")) {
  failures.push("placement: profile rendering is not hydration-safe");
}

if (failures.length) {
  console.error("Blank-slate and learner personalization contract failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Blank-slate and learner personalization contract passed.");
