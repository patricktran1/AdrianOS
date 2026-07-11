"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type PassportStamp = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type WorldPassport = {
  version: 1;
  stamps: PassportStamp[];
  expeditions: number;
  updatedAt: string;
};

const ITEM_ID = "world-explorer-passport";
const GAME_SLUG = "adrianos-world-passport";
export const WORLD_PASSPORT_EVENT = "adrianos-world-passport-updated";

const EMPTY_PASSPORT: WorldPassport = {
  version: 1,
  stamps: [],
  expeditions: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parsePassport(item: ReviewItem | undefined): WorldPassport {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.worldPassport !== true) return EMPTY_PASSPORT;
  const raw = item.data.passportJson;
  if (typeof raw !== "string") return EMPTY_PASSPORT;
  try {
    const parsed = JSON.parse(raw) as Partial<WorldPassport>;
    const stamps = Array.isArray(parsed.stamps)
      ? parsed.stamps
          .filter((stamp): stamp is PassportStamp => Boolean(
            stamp
            && typeof stamp === "object"
            && typeof stamp.id === "string"
            && typeof stamp.label === "string"
            && typeof stamp.emoji === "string"
            && typeof stamp.earnedAt === "string"
          ))
          .slice(-40)
      : [];
    return {
      version: 1,
      stamps,
      expeditions: typeof parsed.expeditions === "number" && Number.isFinite(parsed.expeditions)
        ? Math.max(0, Math.floor(parsed.expeditions))
        : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY_PASSPORT;
  }
}

export function readWorldPassport(profileId: string): WorldPassport {
  const learning = readLearningForProfile(profileId);
  return parsePassport(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeWorldPassport(profileId: string, passport: WorldPassport): WorldPassport {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: WorldPassport = {
    ...passport,
    version: 1,
    stamps: passport.stamps.slice(-40),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "geography-world-passport",
    subject: "Geography",
    prompt: "World Explorer passport stamps",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.stamps.length,
    status: "resolved",
    data: {
      worldPassport: true,
      passportJson: JSON.stringify(next),
    },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(WORLD_PASSPORT_EVENT));
  return next;
}

export function addWorldPassportStamps(
  profileId: string,
  stamps: Array<Omit<PassportStamp, "earnedAt">>
): { passport: WorldPassport; added: PassportStamp[] } {
  const current = readWorldPassport(profileId);
  const known = new Set(current.stamps.map((stamp) => stamp.id));
  const earnedAt = new Date().toISOString();
  const added = stamps
    .filter((stamp) => !known.has(stamp.id))
    .map((stamp) => ({ ...stamp, earnedAt }));
  const passport = writeWorldPassport(profileId, {
    ...current,
    expeditions: current.expeditions + 1,
    stamps: [...current.stamps, ...added],
  });
  return { passport, added };
}
