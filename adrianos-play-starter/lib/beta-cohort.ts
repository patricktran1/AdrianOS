"use client";

const COHORT_KEY = "adrianos-beta-cohort-v1";

export const BETA_COHORTS = {
  "adrian-2nd-grade": "Adrian’s 2nd grade cohort",
  "piedmont-families": "Piedmont families",
  "friend-family": "Friends and family",
  general: "General beta",
} as const;

export type BetaCohort = keyof typeof BETA_COHORTS;

export function normalizeBetaCohort(value: string | null | undefined): BetaCohort {
  if (value && value in BETA_COHORTS) return value as BetaCohort;
  return "general";
}

export function rememberBetaCohort(value: string | null | undefined): BetaCohort {
  const cohort = normalizeBetaCohort(value);
  if (typeof window !== "undefined") window.localStorage.setItem(COHORT_KEY, cohort);
  return cohort;
}

export function readBetaCohort(): BetaCohort {
  if (typeof window === "undefined") return "general";
  return normalizeBetaCohort(window.localStorage.getItem(COHORT_KEY));
}

export function betaCohortLabel(cohort: BetaCohort): string {
  return BETA_COHORTS[cohort];
}
