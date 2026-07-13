"use client";

import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import type { AdrianProgress } from "@/lib/adrian-progress";
import {
  ADRIAN_PRIZE_COLLECTIONS,
  prizeProgressForGrade,
  type AdrianPrize,
} from "@/lib/adrian-prize-collections";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

const LOCKER_GAME_SLUG = "adrianos-power-locker";
const LOCKER_STATE_ID = "power-locker-state";
export const POWER_LOCKER_EVENT = "adrianos-power-locker-updated";

export type CompanionAura = "spark" | "orbit" | "shield" | "rainbow";

export type PowerLockerState = {
  equippedPrizeKey: string | null;
  updatedAt: string | null;
};

export type EquippedPrize = AdrianPrize & {
  key: string;
  index: number;
  aura: CompanionAura;
  auraLabel: string;
};

const AURAS: Array<{ aura: CompanionAura; label: string }> = [
  { aura: "spark", label: "Spark trail" },
  { aura: "orbit", label: "Orbit glow" },
  { aura: "shield", label: "Shield shimmer" },
  { aura: "rainbow", label: "Rainbow wake" },
];

function lockerItem(profileId: string): ReviewItem | null {
  return readLearningForProfile(profileId).reviewQueue.find(
    (item) => item.gameSlug === LOCKER_GAME_SLUG && item.id === LOCKER_STATE_ID,
  ) ?? null;
}

export function powerLockerPrizeKey(grade: ElementaryGrade, index: number): string {
  return `${grade}:${index}`;
}

function equippedPrize(grade: ElementaryGrade, index: number): EquippedPrize | null {
  const prize = ADRIAN_PRIZE_COLLECTIONS[grade].prizes[index];
  if (!prize) return null;
  const aura = AURAS[index % AURAS.length];
  return {
    ...prize,
    key: powerLockerPrizeKey(grade, index),
    index,
    aura: aura.aura,
    auraLabel: aura.label,
  };
}

export function unlockedPowerLockerPrizes(
  progress: AdrianProgress,
  grade: ElementaryGrade,
): EquippedPrize[] {
  const { unlocked } = prizeProgressForGrade(progress, grade);
  return ADRIAN_PRIZE_COLLECTIONS[grade].prizes
    .slice(0, unlocked)
    .map((_, index) => equippedPrize(grade, index))
    .filter((prize): prize is EquippedPrize => Boolean(prize));
}

export function readPowerLockerState(profileId: string): PowerLockerState {
  const item = lockerItem(profileId);
  const equippedPrizeKey = typeof item?.data?.equippedPrizeKey === "string"
    ? item.data.equippedPrizeKey
    : null;
  return {
    equippedPrizeKey,
    updatedAt: item?.updatedAt ?? null,
  };
}

export function resolveEquippedPrize(options: {
  profileId: string;
  progress: AdrianProgress;
  grade: ElementaryGrade;
}): EquippedPrize | null {
  const unlocked = unlockedPowerLockerPrizes(options.progress, options.grade);
  if (unlocked.length === 0) return null;
  const selectedKey = readPowerLockerState(options.profileId).equippedPrizeKey;
  return unlocked.find((prize) => prize.key === selectedKey) ?? unlocked.at(-1) ?? null;
}

export function equipPowerLockerPrize(profileId: string, prize: EquippedPrize): PowerLockerState {
  const current = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id: LOCKER_STATE_ID,
    gameSlug: LOCKER_GAME_SLUG,
    skillId: "profile-customization",
    subject: "Creativity",
    prompt: "Selected cosmetic companion for AdrianOS games",
    correctAnswer: "",
    data: {
      equippedPrizeKey: prize.key,
      equippedPrizeName: prize.name,
      equippedPrizeEmoji: prize.emoji,
      companionAura: prize.aura,
      profileSetting: true,
      syncedPowerLocker: true,
    },
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 0,
    status: "resolved",
  };

  writeLearningForProfile(profileId, {
    ...current,
    reviewQueue: [
      ...current.reviewQueue.filter(
        (row) => !(row.gameSlug === LOCKER_GAME_SLUG && row.id === LOCKER_STATE_ID),
      ),
      item,
    ].slice(-100),
  });
  window.dispatchEvent(new Event(POWER_LOCKER_EVENT));
  return { equippedPrizeKey: prize.key, updatedAt: now };
}
