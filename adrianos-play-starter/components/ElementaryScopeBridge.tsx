"use client";

import { useEffect } from "react";
import {
  normalizeElementaryAge,
  normalizeElementaryGrade,
} from "@/lib/adrian-elementary-scope";
import { readLearningForProfile } from "@/lib/adrian-learning";
import { writeProfileGrade } from "@/lib/adrian-profile-grade";
import {
  exportFamilyBackup,
  importFamilyBackup,
  type ChildProfile,
} from "@/lib/adrian-profiles";

const GRADE_GAME_SLUG = "adrianos-grade-profile";
const GRADE_ITEM_ID = "profile-grade";

function storedGrade(profileId: string): number | null {
  const state = readLearningForProfile(profileId);
  const item = state.reviewQueue.find(
    (row) => row.gameSlug === GRADE_GAME_SLUG && row.id === GRADE_ITEM_ID,
  );
  const value = item?.data?.grade;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scopedProfiles(profiles: ChildProfile[]): { profiles: ChildProfile[]; changed: boolean } {
  let changed = false;
  const next = profiles.map((profile) => {
    const age = normalizeElementaryAge(profile.age);
    if (age !== profile.age) changed = true;
    return age === profile.age ? profile : { ...profile, age };
  });
  return { profiles: next, changed };
}

export default function ElementaryScopeBridge() {
  useEffect(() => {
    let timer: number | null = null;
    let stopped = false;
    let enforcing = false;

    const enforce = () => {
      if (stopped || enforcing) return;
      enforcing = true;
      try {
        const backup = exportFamilyBackup();
        const scoped = scopedProfiles(backup.family.profiles);
        if (scoped.changed) {
          const ids = new Set(scoped.profiles.map((profile) => profile.id));
          importFamilyBackup({
            ...backup,
            exportedAt: new Date().toISOString(),
            family: {
              ...backup.family,
              profiles: scoped.profiles,
              activeProfileId: ids.has(backup.family.activeProfileId)
                ? backup.family.activeProfileId
                : scoped.profiles[0]?.id ?? "",
            },
          });
        }

        for (const profile of scoped.profiles) {
          const rawGrade = storedGrade(profile.id);
          if (rawGrade === null) continue;
          const grade = normalizeElementaryGrade(rawGrade, profile.age);
          if (grade !== rawGrade) writeProfileGrade(profile.id, grade);
        }
      } finally {
        enforcing = false;
      }
    };

    const schedule = () => {
      if (stopped) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        enforce();
      }, 60);
    };

    const events = ["adrianos-family-updated", "adrianos-learning-updated", "storage"];
    schedule();
    for (const eventName of events) window.addEventListener(eventName, schedule);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      for (const eventName of events) window.removeEventListener(eventName, schedule);
    };
  }, []);

  return null;
}
