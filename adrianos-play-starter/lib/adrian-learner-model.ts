/**
 * AdrianOS learner model.
 *
 * Turns raw gameplay evidence into inferences a designer can act on:
 * how fluent a skill is, whether the child is guessing or thinking,
 * which wrong answers repeat (a misconception rather than a slip),
 * and what should happen next.
 *
 * Design rules this file follows:
 *
 * 1. Every inference is derived from recorded gameplay. Nothing is invented,
 *    randomized, or smoothed toward a flattering answer.
 * 2. Thresholds are explicit. When there is not enough evidence the model
 *    reports `unknown` instead of guessing, and callers fall back to interest.
 * 3. It is pure and synchronous so it can be unit tested without a browser.
 *    Only `import type` is used so the module runs under node type stripping.
 */

import type { Game } from "@/lib/games";

export type EvidenceSubject = Game["subject"];

/** One recorded answer, captured at the moment the child responded. */
export type LearningEvidence = {
  at: string;
  gameSlug: string;
  subject: EvidenceSubject;
  skillId: string;
  skillLabel: string;
  prompt: string;
  correctAnswer: string;
  /** What the child actually chose. Null when a game cannot report it. */
  givenAnswer: string | null;
  correct: boolean;
  /** Milliseconds from question shown to answer committed. Null when untimed. */
  responseMs: number | null;
  /** Hints opened before answering. */
  hintsUsed: number;
  /** Wrong tries on this same question before this record. */
  wrongAttempts: number;
  standardCode: string | null;
};

export type ConfidenceRead =
  | "solid"
  | "effortful"
  | "guessing"
  | "struggling"
  | "unknown";

export type SkillTrend = "rising" | "steady" | "slipping" | "unknown";

/** What the product should do next for a skill. */
export type SkillAction = "stretch" | "practice" | "reteach" | "revisit";

export type Misconception = {
  skillId: string;
  skillLabel: string;
  subject: EvidenceSubject;
  /** The wrong answer the child keeps giving. */
  answer: string;
  count: number;
  examplePrompt: string;
  expected: string;
  lastSeenAt: string;
};

export type SkillSignal = {
  skillId: string;
  skillLabel: string;
  subject: EvidenceSubject;
  gameSlugs: string[];
  attempts: number;
  correct: number;
  accuracy: number;
  /** Median response time in ms across timed attempts, or null. */
  medianResponseMs: number | null;
  /** 0 = answers as fast as this child usually does, 1 = markedly slower. */
  hesitation: number;
  /** 0 = solves unaided, 1 = leans on hints and retries every time. */
  supportReliance: number;
  /** Accuracy discounted by the support and hesitation it required. */
  fluency: number;
  trend: SkillTrend;
  confidence: ConfidenceRead;
  misconceptions: Misconception[];
  lastSeenAt: string;
  action: SkillAction;
};

export type SubjectSignal = {
  subject: EvidenceSubject;
  attempts: number;
  accuracy: number;
  fluency: number;
  skillCount: number;
};

export type LearnerPace = "quick" | "steady" | "deliberate" | "unknown";
export type LearnerReadiness = "stretch" | "steady" | "support" | "unknown";

export type LearnerModel = {
  profileId: string;
  generatedAt: string;
  sampleSize: number;
  /** True once there is enough evidence for the adaptive layer to lead. */
  confident: boolean;
  skills: SkillSignal[];
  subjects: SubjectSignal[];
  misconceptions: Misconception[];
  /** The skill most worth helping with right now. */
  focusSkill: SkillSignal | null;
  /** The skill most ready for a harder version. */
  stretchSkill: SkillSignal | null;
  /** Recent accuracy relative to earlier accuracy, 0..1 centred on .5. */
  momentum: number;
  pace: LearnerPace;
  readiness: LearnerReadiness;
  /** Median response time across all timed evidence. */
  baselineResponseMs: number | null;
};

export const EVIDENCE_LIMIT = 400;

/** Below this many attempts on a skill, timing and trend are not trusted. */
const MIN_SKILL_ATTEMPTS = 3;
/** Below this many timed samples, response time is not trusted. */
const MIN_TIMED_SAMPLES = 3;
/** A wrong answer must repeat this often before it counts as a misconception. */
const MIN_MISCONCEPTION_COUNT = 2;
/** Below this much total evidence the model defers to interest and novelty. */
const MIN_CONFIDENT_SAMPLE = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(999, Math.round(value))
    : 0;
}

/**
 * Answers are compared after light normalization so that "12", " 12 " and "12."
 * cluster as the same misconception, while genuinely different answers do not.
 */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
}

export function normalizeEvidence(value: unknown): LearningEvidence | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<LearningEvidence>;
  const skillId = safeText(raw.skillId);
  const gameSlug = safeText(raw.gameSlug);
  if (!skillId || !gameSlug) return null;
  const responseMs =
    typeof raw.responseMs === "number"
      && Number.isFinite(raw.responseMs)
      && raw.responseMs > 0
      // Guard against a tab left open: a 10 minute "answer" is not think time.
      && raw.responseMs < 10 * 60 * 1000
      ? Math.round(raw.responseMs)
      : null;
  return {
    at: safeText(raw.at, new Date(0).toISOString()),
    gameSlug,
    subject: (safeText(raw.subject, "Logic") as EvidenceSubject),
    skillId,
    skillLabel: safeText(raw.skillLabel, skillId),
    prompt: safeText(raw.prompt).slice(0, 240),
    correctAnswer: safeText(raw.correctAnswer).slice(0, 120),
    givenAnswer:
      typeof raw.givenAnswer === "string" && raw.givenAnswer.trim()
        ? raw.givenAnswer.trim().slice(0, 120)
        : null,
    correct: raw.correct === true,
    responseMs,
    hintsUsed: safeCount(raw.hintsUsed),
    wrongAttempts: safeCount(raw.wrongAttempts),
    standardCode:
      typeof raw.standardCode === "string" && raw.standardCode.trim()
        ? raw.standardCode.trim().slice(0, 24)
        : null,
  };
}

export function normalizeEvidenceLog(value: unknown): LearningEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeEvidence)
    .filter((row): row is LearningEvidence => row !== null)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-EVIDENCE_LIMIT);
}

function readConfidence(
  accuracy: number,
  hesitation: number,
  attempts: number
): ConfidenceRead {
  if (attempts < MIN_SKILL_ATTEMPTS) return "unknown";
  const quick = hesitation < 0.4;
  if (accuracy >= 0.75) return quick ? "solid" : "effortful";
  // Fast and wrong is the signature of guessing rather than reasoning.
  if (quick) return "guessing";
  return "struggling";
}

function readTrend(rows: LearningEvidence[]): SkillTrend {
  if (rows.length < 6) return "unknown";
  const split = Math.floor(rows.length / 2);
  const earlier = rows.slice(0, split);
  const recent = rows.slice(split);
  const earlierRate = earlier.filter((row) => row.correct).length / earlier.length;
  const recentRate = recent.filter((row) => row.correct).length / recent.length;
  const delta = recentRate - earlierRate;
  if (delta >= 0.2) return "rising";
  if (delta <= -0.2) return "slipping";
  return "steady";
}

function readAction(
  accuracy: number,
  fluency: number,
  attempts: number,
  misconceptions: number
): SkillAction {
  if (attempts < MIN_SKILL_ATTEMPTS) return "practice";
  // A repeating wrong answer means practice will just rehearse the error.
  if (misconceptions > 0 && accuracy < 0.8) return "reteach";
  if (accuracy < 0.5) return "reteach";
  if (fluency >= 0.78) return "stretch";
  if (accuracy >= 0.8) return "revisit";
  return "practice";
}

function collectMisconceptions(rows: LearningEvidence[]): Misconception[] {
  const wrong = rows.filter((row) => !row.correct && row.givenAnswer);
  const clusters = new Map<string, Misconception>();
  for (const row of wrong) {
    const answer = row.givenAnswer as string;
    const key = normalizeAnswer(answer);
    if (!key) continue;
    // A wrong answer that matches the expected answer is a reporting bug,
    // not a misconception; ignore it rather than showing nonsense to a parent.
    if (key === normalizeAnswer(row.correctAnswer)) continue;
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      if (row.at > existing.lastSeenAt) existing.lastSeenAt = row.at;
    } else {
      clusters.set(key, {
        skillId: row.skillId,
        skillLabel: row.skillLabel,
        subject: row.subject,
        answer,
        count: 1,
        examplePrompt: row.prompt,
        expected: row.correctAnswer,
        lastSeenAt: row.at,
      });
    }
  }
  return [...clusters.values()]
    .filter((row) => row.count >= MIN_MISCONCEPTION_COUNT)
    .sort((a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

function buildSkillSignal(
  rows: LearningEvidence[],
  baselineResponseMs: number | null
): SkillSignal {
  const first = rows[0];
  const attempts = rows.length;
  const correct = rows.filter((row) => row.correct).length;
  const accuracy = attempts > 0 ? correct / attempts : 0;

  const timed = rows
    .map((row) => row.responseMs)
    .filter((ms): ms is number => ms !== null);
  const medianResponseMs = timed.length >= MIN_TIMED_SAMPLES ? median(timed) : null;

  // Hesitation is relative to this child's own baseline, never to a global
  // "expected" speed, so a deliberate thinker is not scored as struggling.
  const hesitation =
    medianResponseMs !== null && baselineResponseMs && baselineResponseMs > 0
      ? clamp((medianResponseMs / baselineResponseMs - 1) / 1.2, 0, 1)
      : 0;

  const supportPerAttempt =
    rows.reduce((sum, row) => sum + row.hintsUsed + row.wrongAttempts, 0) / attempts;
  const supportReliance = clamp(supportPerAttempt / 2, 0, 1);

  // Fluency is what a teacher means by "has this really landed?": right answers
  // that came without leaning on hints and without unusual hesitation.
  const fluency = clamp(
    accuracy * (1 - supportReliance * 0.45) * (1 - hesitation * 0.25),
    0,
    1
  );

  const misconceptions = collectMisconceptions(rows);
  const lastSeenAt = rows[rows.length - 1].at;

  return {
    skillId: first.skillId,
    skillLabel: first.skillLabel,
    subject: first.subject,
    gameSlugs: [...new Set(rows.map((row) => row.gameSlug))],
    attempts,
    correct,
    accuracy,
    medianResponseMs,
    hesitation,
    supportReliance,
    fluency,
    trend: readTrend(rows),
    confidence: readConfidence(accuracy, hesitation, attempts),
    misconceptions,
    lastSeenAt,
    action: readAction(accuracy, fluency, attempts, misconceptions.length),
  };
}

function readPace(
  baselineResponseMs: number | null,
  timedSamples: number
): LearnerPace {
  if (baselineResponseMs === null || timedSamples < MIN_TIMED_SAMPLES * 2) {
    return "unknown";
  }
  if (baselineResponseMs <= 3500) return "quick";
  if (baselineResponseMs <= 9000) return "steady";
  return "deliberate";
}

function readMomentum(rows: LearningEvidence[]): number {
  if (rows.length < 6) return 0.5;
  const window = Math.max(4, Math.round(rows.length / 3));
  const recent = rows.slice(-window);
  const earlier = rows.slice(0, rows.length - window);
  if (earlier.length === 0) return 0.5;
  const recentRate = recent.filter((row) => row.correct).length / recent.length;
  const earlierRate = earlier.filter((row) => row.correct).length / earlier.length;
  return clamp(0.5 + (recentRate - earlierRate), 0, 1);
}

function readReadiness(
  skills: SkillSignal[],
  momentum: number,
  sampleSize: number
): LearnerReadiness {
  if (sampleSize < MIN_CONFIDENT_SAMPLE) return "unknown";
  const scored = skills.filter((skill) => skill.attempts >= MIN_SKILL_ATTEMPTS);
  if (scored.length === 0) return "unknown";
  const averageFluency =
    scored.reduce((sum, skill) => sum + skill.fluency, 0) / scored.length;
  if (averageFluency >= 0.72 && momentum >= 0.45) return "stretch";
  if (averageFluency <= 0.4 || momentum < 0.35) return "support";
  return "steady";
}

/**
 * Ranks skills by how much a child would benefit from meeting them next.
 * A repeating misconception outranks a low score, because rehearsing a
 * misunderstood method makes it more durable rather than less.
 */
function focusScore(skill: SkillSignal): number {
  const gap = 1 - skill.fluency;
  const misconceptionWeight = skill.misconceptions.length > 0 ? 0.35 : 0;
  const slippingWeight = skill.trend === "slipping" ? 0.2 : 0;
  const guessingWeight = skill.confidence === "guessing" ? 0.15 : 0;
  const evidenceWeight = Math.min(1, skill.attempts / 6) * 0.15;
  return gap + misconceptionWeight + slippingWeight + guessingWeight + evidenceWeight;
}

function stretchScore(skill: SkillSignal): number {
  if (skill.misconceptions.length > 0) return -1;
  const trendWeight = skill.trend === "rising" ? 0.15 : 0;
  const independence = 1 - skill.supportReliance;
  return skill.fluency * 0.7 + independence * 0.3 + trendWeight;
}

export function buildLearnerModel(
  profileId: string,
  evidence: LearningEvidence[],
  now = new Date()
): LearnerModel {
  const rows = normalizeEvidenceLog(evidence);
  const timed = rows
    .map((row) => row.responseMs)
    .filter((ms): ms is number => ms !== null);
  const baselineResponseMs = timed.length >= MIN_TIMED_SAMPLES ? median(timed) : null;

  const bySkill = new Map<string, LearningEvidence[]>();
  for (const row of rows) {
    const list = bySkill.get(row.skillId);
    if (list) list.push(row);
    else bySkill.set(row.skillId, [row]);
  }

  const skills = [...bySkill.values()]
    .map((skillRows) => buildSkillSignal(skillRows, baselineResponseMs))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  const bySubject = new Map<EvidenceSubject, SkillSignal[]>();
  for (const skill of skills) {
    const list = bySubject.get(skill.subject);
    if (list) list.push(skill);
    else bySubject.set(skill.subject, [skill]);
  }
  const subjects: SubjectSignal[] = [...bySubject.entries()]
    .map(([subject, list]) => {
      const attempts = list.reduce((sum, skill) => sum + skill.attempts, 0);
      const correct = list.reduce((sum, skill) => sum + skill.correct, 0);
      return {
        subject,
        attempts,
        accuracy: attempts > 0 ? correct / attempts : 0,
        fluency: list.reduce((sum, skill) => sum + skill.fluency, 0) / list.length,
        skillCount: list.length,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  const scorable = skills.filter((skill) => skill.attempts >= MIN_SKILL_ATTEMPTS);
  const focusSkill =
    scorable.length > 0
      ? [...scorable].sort((a, b) => focusScore(b) - focusScore(a))[0]
      : null;
  const stretchCandidates = scorable.filter((skill) => stretchScore(skill) > 0.6);
  const stretchSkill =
    stretchCandidates.length > 0
      ? [...stretchCandidates].sort((a, b) => stretchScore(b) - stretchScore(a))[0]
      : null;

  const momentum = readMomentum(rows);

  return {
    profileId,
    generatedAt: now.toISOString(),
    sampleSize: rows.length,
    confident: rows.length >= MIN_CONFIDENT_SAMPLE,
    skills,
    subjects,
    misconceptions: skills
      .flatMap((skill) => skill.misconceptions)
      .sort((a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, 12),
    focusSkill,
    stretchSkill,
    momentum,
    pace: readPace(baselineResponseMs, timed.length),
    readiness: readReadiness(skills, momentum, rows.length),
    baselineResponseMs,
  };
}

export const EMPTY_LEARNER_MODEL: LearnerModel = {
  profileId: "",
  generatedAt: new Date(0).toISOString(),
  sampleSize: 0,
  confident: false,
  skills: [],
  subjects: [],
  misconceptions: [],
  focusSkill: null,
  stretchSkill: null,
  momentum: 0.5,
  pace: "unknown",
  readiness: "unknown",
  baselineResponseMs: null,
};

/* ------------------------------------------------------------------ */
/* Turning the model into something the world can say out loud          */
/* ------------------------------------------------------------------ */

export type WorldIntent = "stretch" | "practice" | "reteach" | "explore";

export type NextActivity = {
  intent: WorldIntent;
  skillId: string | null;
  skillLabel: string | null;
  subject: EvidenceSubject | null;
  /** Preferred game slugs, most relevant first. May be empty. */
  preferredSlugs: string[];
  /**
   * Why this was chosen, phrased for a child who may not read fluently.
   * Never mentions scores, assessment, standards, or being behind.
   */
  childReason: string;
  /** The same decision explained for a parent or teacher. */
  adultReason: string;
  /** Difficulty nudge for games that accept one: -1, 0, or +1. */
  difficultyShift: -1 | 0 | 1;
  /** How eagerly a game should offer help before the child asks. */
  hintStrategy: "on-request" | "early" | "immediate";
};

const EXPLORE_ACTIVITY: NextActivity = {
  intent: "explore",
  skillId: null,
  skillLabel: null,
  subject: null,
  preferredSlugs: [],
  childReason: "Something new is waiting for you.",
  adultReason:
    "Not enough gameplay evidence yet. Leading with interest and novelty until the model has a real signal.",
  difficultyShift: 0,
  hintStrategy: "on-request",
};

/**
 * Chooses what the world should point the child at next.
 *
 * The rules are ordered by teaching value, not by novelty:
 * a repeating misconception is addressed before new ground is broken,
 * and a fluent skill is stretched rather than rehearsed.
 */
export function recommendNextActivity(model: LearnerModel): NextActivity {
  if (!model.confident || model.skills.length === 0) return EXPLORE_ACTIVITY;

  const focus = model.focusSkill;
  if (focus && (focus.action === "reteach" || focus.misconceptions.length > 0)) {
    return {
      intent: "reteach",
      skillId: focus.skillId,
      skillLabel: focus.skillLabel,
      subject: focus.subject,
      preferredSlugs: focus.gameSlugs,
      childReason: `Let's figure out ${focus.skillLabel.toLowerCase()} together.`,
      adultReason: focus.misconceptions.length > 0
        ? `Repeated answer "${focus.misconceptions[0].answer}" on ${focus.skillLabel} suggests a specific misunderstanding rather than careless slips. Reteaching before more practice.`
        : `Accuracy on ${focus.skillLabel} is ${Math.round(focus.accuracy * 100)}% across ${focus.attempts} attempts. Reteaching with worked support.`,
      difficultyShift: -1,
      hintStrategy: "immediate",
    };
  }

  if (model.readiness === "stretch" && model.stretchSkill) {
    const stretch = model.stretchSkill;
    return {
      intent: "stretch",
      skillId: stretch.skillId,
      skillLabel: stretch.skillLabel,
      subject: stretch.subject,
      preferredSlugs: stretch.gameSlugs,
      childReason: `You're strong at ${stretch.skillLabel.toLowerCase()}. Want a tougher one?`,
      adultReason: `${stretch.skillLabel} is solved independently (fluency ${Math.round(stretch.fluency * 100)}%). Raising challenge instead of repeating known material.`,
      difficultyShift: 1,
      hintStrategy: "on-request",
    };
  }

  if (focus) {
    return {
      intent: "practice",
      skillId: focus.skillId,
      skillLabel: focus.skillLabel,
      subject: focus.subject,
      preferredSlugs: focus.gameSlugs,
      childReason: `A bit more ${focus.skillLabel.toLowerCase()} and you've got it.`,
      adultReason: `${focus.skillLabel} is forming: ${Math.round(focus.accuracy * 100)}% accurate with ${Math.round(focus.supportReliance * 100)}% support reliance. Repeating in a new setting.`,
      difficultyShift: focus.confidence === "struggling" ? -1 : 0,
      hintStrategy: focus.supportReliance > 0.4 ? "early" : "on-request",
    };
  }

  return EXPLORE_ACTIVITY;
}

/** Plain-language label for a confidence read, for adult-facing surfaces. */
export function confidenceLabel(confidence: ConfidenceRead): string {
  if (confidence === "solid") return "Answers quickly and correctly";
  if (confidence === "effortful") return "Gets there, but works hard for it";
  if (confidence === "guessing") return "Answering fast without checking";
  if (confidence === "struggling") return "Slow and often incorrect";
  return "Not enough attempts yet";
}

export function actionLabel(action: SkillAction): string {
  if (action === "stretch") return "Ready for harder work";
  if (action === "reteach") return "Needs reteaching";
  if (action === "revisit") return "Worth revisiting later";
  return "Keep practising";
}
