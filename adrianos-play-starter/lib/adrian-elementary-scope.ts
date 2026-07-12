export type ElementaryGrade = -1 | 0 | 1 | 2 | 3 | 4 | 5;

export const ELEMENTARY_MIN_AGE = 4;
export const ELEMENTARY_MAX_AGE = 11;
export const ELEMENTARY_MIN_GRADE: ElementaryGrade = -1;
export const ELEMENTARY_MAX_GRADE: ElementaryGrade = 5;

export const ELEMENTARY_AGE_OPTIONS = Array.from(
  { length: ELEMENTARY_MAX_AGE - ELEMENTARY_MIN_AGE + 1 },
  (_, index) => ELEMENTARY_MIN_AGE + index,
);

export const ELEMENTARY_GRADE_OPTIONS: ReadonlyArray<{
  value: ElementaryGrade;
  label: string;
  shortLabel: string;
  typicalAge: string;
}> = [
  { value: -1, label: "TK (Transitional Kindergarten)", shortLabel: "TK", typicalAge: "4–5" },
  { value: 0, label: "Kindergarten", shortLabel: "K", typicalAge: "5–6" },
  { value: 1, label: "Grade 1", shortLabel: "1", typicalAge: "6–7" },
  { value: 2, label: "Grade 2", shortLabel: "2", typicalAge: "7–8" },
  { value: 3, label: "Grade 3", shortLabel: "3", typicalAge: "8–9" },
  { value: 4, label: "Grade 4", shortLabel: "4", typicalAge: "9–10" },
  { value: 5, label: "Grade 5", shortLabel: "5", typicalAge: "10–11" },
];

export function normalizeElementaryAge(value: number): number {
  if (!Number.isFinite(value)) return 7;
  return Math.max(ELEMENTARY_MIN_AGE, Math.min(ELEMENTARY_MAX_AGE, Math.round(value)));
}

export function inferredElementaryGradeForAge(value: number): ElementaryGrade {
  const age = normalizeElementaryAge(value);
  if (age <= 4) return -1;
  if (age === 5) return 0;
  return Math.max(1, Math.min(5, age - 5)) as ElementaryGrade;
}

export function normalizeElementaryGrade(value: number, age = 7): ElementaryGrade {
  if (!Number.isFinite(value)) return inferredElementaryGradeForAge(age);
  return Math.max(ELEMENTARY_MIN_GRADE, Math.min(ELEMENTARY_MAX_GRADE, Math.round(value))) as ElementaryGrade;
}

export function elementaryGradeLabel(grade: number): string {
  const clean = normalizeElementaryGrade(grade);
  if (clean === -1) return "TK";
  if (clean === 0) return "Kindergarten";
  return `Grade ${clean}`;
}

export function elementaryGradeShortLabel(grade: number): string {
  const clean = normalizeElementaryGrade(grade);
  return ELEMENTARY_GRADE_OPTIONS.find((option) => option.value === clean)?.shortLabel ?? String(clean);
}

export function elementaryGradeTypicalAge(grade: number): string {
  const clean = normalizeElementaryGrade(grade);
  return ELEMENTARY_GRADE_OPTIONS.find((option) => option.value === clean)?.typicalAge ?? "4–11";
}

export function isElementaryGrade(value: number): value is ElementaryGrade {
  return Number.isInteger(value) && value >= ELEMENTARY_MIN_GRADE && value <= ELEMENTARY_MAX_GRADE;
}
