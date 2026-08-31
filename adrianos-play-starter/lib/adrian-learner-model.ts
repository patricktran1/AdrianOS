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
 *    Runtime imports stay relative with extensions so the module runs under
 *    node type stripping.
 */

import type { Game } from "@/lib/games";
import {
  alternateMechanicRoute,
  deduceRouteForSkill,
  deduceSupportsSkill,
  distinctCategories,
  KERNEL_GAMES,
  kernelVerbsForSkill,
  mechanicForGame,
  normalizeMechanic,
  type InteractionMechanic,
  type MechanicCategory,
} from "./kernels/kernel-registry.ts";
import {
  describeSignature,
  isKnownSignature,
  signatureFavoursVerb,
} from "./learning/error-signatures.ts";

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
  /**
   * The cognitive action that produced this answer — chose an option, built
   * a composition, placed things in order, recalled from memory. Attempts
   * that do not report one inherit their game's registry classification, so
   * historical evidence stays usable.
   */
  mechanic: InteractionMechanic;
  /**
   * Identifies the specific task this answer responded to, so that retrying
   * one task cannot masquerade as independent evidence. A child who misses
   * "build 47" twice in a row has produced one task's worth of evidence,
   * not two. Null when a game cannot identify its tasks.
   */
  taskId: string | null;
  /**
   * The observable relationship between the expected and submitted response
   * — `place-value.tens-omitted`, `sequence.adjacent-swap` — recorded by the
   * game at answer time, where the task structure is still known.
   *
   * This is an observation about two responses, never a claim about the
   * child. Null whenever nothing structural can be said, which is the
   * common case and an entirely acceptable one.
   */
  errorSignature: string | null;
  /**
   * Deduction only: whether the answer was reached by working the clues —
   * enough of them read, and every card ruled out for a stated reason.
   *
   * A correct answer with this false is still correct; it is simply not yet
   * evidence that the reasoning happened, which is the whole reason DEDUCE
   * exists. Null for mechanics where the question does not apply.
   */
  reasoned: boolean | null;
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

/**
 * A repeated observable error, promoted from raw evidence only after it has
 * survived the accumulation rules. Describes a relationship between
 * responses; it is never a statement about the child.
 */
export type ErrorPattern = {
  signature: string;
  /** Plain-language description of the observed relationship. */
  description: string;
  /** How many *distinct tasks* showed it. Retries of one task count once. */
  taskCount: number;
  /** Mechanics it has been observed in. */
  mechanics: InteractionMechanic[];
  examplePrompt: string;
  exampleExpected: string;
  exampleGiven: string;
  lastSeenAt: string;
};

/**
 * What the evidence currently supports saying about a skill.
 *
 * These are evidence states, not diagnoses. Each one answers "what has been
 * observed?" and nothing more, which is exactly as much as a routing
 * decision needs.
 */
export type SkillState =
  /** Not enough evidence to say anything. The honest default. */
  | "unknown"
  /** Reliable and independent, in at least one interaction form. */
  | "secure"
  /** Working, but not yet reliably. */
  | "emerging"
  /** Succeeds mainly when hints or retries carry it. */
  | "support-dependent"
  /** Answers arrive too fast to have been considered, and miss. */
  | "possible-random-response"
  /** The same structural error keeps recurring across independent tasks. */
  | "repeatable-error-pattern"
  /** Solid in one interaction form, not in another. */
  | "representation-specific-difficulty";

/** Evidence for one skill inside one interaction mechanic. */
export type MechanicSignal = {
  mechanic: InteractionMechanic;
  attempts: number;
  correct: number;
  accuracy: number;
  /** Share of attempts that needed a hint or retry. */
  supportRate: number;
  /**
   * Share of the *correct* attempts that were reached by reasoning, where
   * the mechanic reports it. 1 when the question does not apply, so
   * mechanics that cannot answer it are unaffected.
   */
  reasonedRate: number;
};

/**
 * How broadly a skill's success generalises across interaction forms.
 *
 * This is deliberately about *evidence diversity*, not cognition: it says
 * what the child has demonstrated, never what is happening in their head.
 */
export type SkillGrasp = "unknown" | "single-context" | "cross-context";

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
  /** Per-mechanic evidence, most-practised first. */
  mechanics: MechanicSignal[];
  /**
   * Mechanics where success is demonstrated on its own strength: at least
   * MIN_MECHANIC_ATTEMPTS attempts, accuracy at or above
   * SECURE_MECHANIC_ACCURACY, and support on fewer than half of them.
   */
  secureMechanics: InteractionMechanic[];
  /**
   * The distinct *kinds* of thinking those mechanics represent. Breadth is
   * counted here rather than in raw mechanics, so several games that all ask
   * a child to recognise an answer count once.
   */
  secureCategories: MechanicCategory[];
  /** Mechanics with enough attempts to say they are not working yet. */
  weakMechanics: InteractionMechanic[];
  grasp: SkillGrasp;
  /** Structural errors that survived the accumulation rules. */
  errorPatterns: ErrorPattern[];
  /** What the evidence currently supports. Never a diagnosis. */
  state: SkillState;
  /** True when answers are arriving faster than they could be considered. */
  rapidResponses: boolean;
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
/** A mechanic needs this many attempts before its evidence counts alone. */
const MIN_MECHANIC_ATTEMPTS = 3;
/** …and this accuracy before the mechanic reads as secure. */
const SECURE_MECHANIC_ACCURACY = 0.7;
/** A skill this fluent but shown in only one mechanic is a transfer candidate. */
const TRANSFER_FLUENCY = 0.75;

/*
 * Promoting an observation into an actionable pattern
 * ---------------------------------------------------
 * One strange answer is noise. The rules below decide when repeated evidence
 * has earned the right to change what a child is shown next, and they are
 * deliberately hard to satisfy: a false pattern sends a capable child
 * backwards, which is worse than missing a real one for another session.
 *
 * A signature becomes actionable only when ALL of these hold:
 *   - it appears on at least MIN_SIGNATURE_TASKS *distinct tasks* (retrying
 *     the same task is one task's worth of evidence, not two);
 *   - those tasks are recent, within SIGNATURE_RECENCY_WINDOW attempts;
 *   - the skill is not otherwise going well — a child at or above
 *     SLIP_TOLERANCE_ACCURACY is having slips, not a pattern;
 *   - the answers were not produced at random-clicking speed.
 */
/** Distinct tasks that must show the same signature before it is actionable. */
const MIN_SIGNATURE_TASKS = 3;
/** Only signatures seen within this many recent attempts on a skill count. */
const SIGNATURE_RECENCY_WINDOW = 12;
/** At or above this accuracy, wrong answers read as slips rather than pattern. */
const SLIP_TOLERANCE_ACCURACY = 0.8;
/** Answers faster than this are too quick to have been read and considered. */
const RANDOM_RESPONSE_MS = 1200;
/** This share of attempts at that speed, while inaccurate, reads as guessing. */
const RANDOM_RESPONSE_SHARE = 0.6;
/** Accuracy below which a rapid-answering skill counts as possibly random. */
const RANDOM_RESPONSE_ACCURACY = 0.55;
/** Support on more than this share of attempts means success is not yet independent. */
const SUPPORT_DEPENDENT_RATE = 0.5;
/** Most correct answers in a reasoning mechanic must be reasoned to count. */
const REASONED_SOLVE_RATE = 0.6;
/** A mechanic needs this many attempts before weakness in it is credible. */
const MIN_WEAK_MECHANIC_ATTEMPTS = 3;
/** At or below this accuracy a mechanic reads as not yet working. */
const WEAK_MECHANIC_ACCURACY = 0.5;

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

const TRAILING_PUNCTUATION = new Set([".", "!", "?"]);

/**
 * Answers are compared after light normalization so that "12", " 12 " and "12."
 * cluster as the same misconception, while genuinely different answers do not.
 */
export function normalizeAnswer(value: string): string {
  const collapsed = value.toLowerCase().replace(/[\s,]+/g, " ").trim();
  // Trailing punctuation is trimmed with a loop rather than an anchored
  // repetition such as /[.!?]+$/. A repetition pinned to the end of the input
  // backtracks quadratically on a long run of those characters, and this runs
  // on stored answer text.
  let end = collapsed.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(collapsed[end - 1])) end -= 1;
  return collapsed.slice(0, end).trim();
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
    // Attempts written before mechanics existed inherit their game's
    // classification, so a legacy log still yields a per-mechanic picture.
    mechanic: normalizeMechanic(raw.mechanic) ?? mechanicForGame(gameSlug),
    taskId:
      typeof raw.taskId === "string" && raw.taskId.trim()
        ? raw.taskId.trim().slice(0, 64)
        : null,
    // Only signatures this build knows how to act on survive. An unknown or
    // corrupted value becomes null rather than an invented classification.
    errorSignature: isKnownSignature(raw.errorSignature) ? raw.errorSignature : null,
    reasoned: typeof raw.reasoned === "boolean" ? raw.reasoned : null,
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

/**
 * Promotes repeated structural errors into actionable patterns.
 *
 * The independence rule is the important one: evidence is counted per
 * *distinct task*, so a child who misses "build 47" twice in a row has
 * produced one task's worth of evidence. Without that, two attempts at a
 * single task would look like a habit.
 */
function collectErrorPatterns(
  rows: LearningEvidence[],
  accuracy: number,
  rapidResponses: boolean
): ErrorPattern[] {
  // A child who is mostly right is making slips. Reading a pattern into
  // them would send a capable learner backwards over ordinary noise.
  if (accuracy >= SLIP_TOLERANCE_ACCURACY) return [];
  // Answers given too fast to have been read carry no structural meaning,
  // however consistent they look.
  if (rapidResponses) return [];

  const recent = rows.slice(-SIGNATURE_RECENCY_WINDOW);
  const bySignature = new Map<string, {
    tasks: Set<string>;
    mechanics: Set<InteractionMechanic>;
    last: LearningEvidence;
  }>();

  for (const [index, row] of recent.entries()) {
    if (row.correct || !row.errorSignature) continue;
    const entry = bySignature.get(row.errorSignature);
    // Tasks that do not identify themselves fall back to their position, so
    // each such attempt counts once and never merges with another.
    const taskKey = row.taskId ?? `${row.prompt}#${index}`;
    if (entry) {
      entry.tasks.add(taskKey);
      entry.mechanics.add(row.mechanic);
      if (row.at >= entry.last.at) entry.last = row;
    } else {
      bySignature.set(row.errorSignature, {
        tasks: new Set([taskKey]),
        mechanics: new Set([row.mechanic]),
        last: row,
      });
    }
  }

  return [...bySignature.entries()]
    .filter(([, entry]) => entry.tasks.size >= MIN_SIGNATURE_TASKS)
    .map(([signature, entry]) => ({
      signature,
      description: describeSignature(signature) ?? "made the same kind of mistake again",
      taskCount: entry.tasks.size,
      mechanics: [...entry.mechanics],
      examplePrompt: entry.last.prompt,
      exampleExpected: entry.last.correctAnswer,
      exampleGiven: entry.last.givenAnswer ?? "",
      lastSeenAt: entry.last.at,
    }))
    .sort((a, b) => b.taskCount - a.taskCount || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/**
 * Detects answers arriving faster than a child could read and consider them.
 *
 * Speed alone is not a problem — a fluent child is fast and right. This
 * fires only when speed and inaccuracy occur together.
 */
function readRapidResponses(rows: LearningEvidence[], accuracy: number): boolean {
  if (rows.length < MIN_SKILL_ATTEMPTS) return false;
  if (accuracy > RANDOM_RESPONSE_ACCURACY) return false;
  const timed = rows.filter((row) => row.responseMs !== null);
  if (timed.length < MIN_SKILL_ATTEMPTS) return false;
  const rapid = timed.filter((row) => (row.responseMs as number) < RANDOM_RESPONSE_MS);
  return rapid.length / timed.length >= RANDOM_RESPONSE_SHARE;
}

/**
 * Chooses the single evidence state that best describes a skill right now.
 *
 * Order matters. A state that changes what a child should be shown outranks
 * one that only describes how well things are going, and every branch that
 * claims something specific requires more evidence than the ones above it.
 */
function readSkillState(input: {
  attempts: number;
  accuracy: number;
  supportReliance: number;
  fluency: number;
  rapidResponses: boolean;
  errorPatterns: ErrorPattern[];
  secureMechanics: InteractionMechanic[];
  weakMechanics: InteractionMechanic[];
}): SkillState {
  if (input.attempts < MIN_SKILL_ATTEMPTS) return "unknown";
  // Fast, inaccurate answers make every other reading unreliable, so this
  // is settled before anything structural is claimed.
  if (input.rapidResponses) return "possible-random-response";
  if (input.errorPatterns.length > 0) return "repeatable-error-pattern";
  // Solid in one interaction form and not in another is a statement about
  // the representation, not about the skill as a whole.
  if (input.secureMechanics.length > 0 && input.weakMechanics.length > 0) {
    return "representation-specific-difficulty";
  }
  if (input.supportReliance > SUPPORT_DEPENDENT_RATE) return "support-dependent";
  if (input.secureMechanics.length > 0) return "secure";
  return "emerging";
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
  const mechanics = collectMechanics(rows);
  const secureMechanics = mechanics
    .filter((row) =>
      row.attempts >= MIN_MECHANIC_ATTEMPTS
      && row.accuracy >= SECURE_MECHANIC_ACCURACY
      // Success that leaned on hints or retries most of the time is real
      // progress, but it is not yet evidence the mechanic stands on its own.
      && row.supportRate < 0.5
      // Right answers reached without using the clues are not evidence that
      // the child can reason their way there.
      && row.reasonedRate >= REASONED_SOLVE_RATE
    )
    .map((row) => row.mechanic);
  // A mechanic only reads as "not working yet" once it has had a fair run;
  // one bad round in a new interaction form proves nothing.
  const weakMechanics = mechanics
    .filter((row) =>
      row.attempts >= MIN_WEAK_MECHANIC_ATTEMPTS
      && row.accuracy <= WEAK_MECHANIC_ACCURACY
    )
    .map((row) => row.mechanic);

  const secureCategories = distinctCategories(secureMechanics);
  const rapidResponses = readRapidResponses(rows, accuracy);
  const errorPatterns = collectErrorPatterns(rows, accuracy, rapidResponses);
  const state = readSkillState({
    attempts,
    accuracy,
    supportReliance,
    fluency,
    rapidResponses,
    errorPatterns,
    secureMechanics,
    weakMechanics,
  });

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
    mechanics,
    secureMechanics,
    secureCategories,
    weakMechanics,
    errorPatterns,
    state,
    rapidResponses,
    // Cross-context means two different *kinds* of demand, not two skins.
    grasp: secureCategories.length >= 2
      ? "cross-context"
      : secureCategories.length === 1
        ? "single-context"
        : "unknown",
  };
}

function collectMechanics(rows: LearningEvidence[]): MechanicSignal[] {
  const byMechanic = new Map<InteractionMechanic, LearningEvidence[]>();
  for (const row of rows) {
    const list = byMechanic.get(row.mechanic);
    if (list) list.push(row);
    else byMechanic.set(row.mechanic, [row]);
  }
  return [...byMechanic.entries()]
    .map(([mechanic, list]) => {
      const correct = list.filter((row) => row.correct).length;
      const supported = list.filter(
        (row) => row.hintsUsed > 0 || row.wrongAttempts > 0
      ).length;
      // Only rows that actually answer the question count, so a mechanic
      // that never reports reasoning is neither rewarded nor penalised.
      const judged = list.filter((row) => row.correct && row.reasoned !== null);
      const reasonedRate =
        judged.length > 0
          ? judged.filter((row) => row.reasoned === true).length / judged.length
          : 1;
      return {
        mechanic,
        attempts: list.length,
        correct,
        accuracy: correct / list.length,
        supportRate: supported / list.length,
        reasonedRate,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
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

/**
 * What AdrianOS should do next. The smallest vocabulary that still lets the
 * distinct evidence states produce distinct experiences.
 *
 *  - `explore`      nothing credible to act on; follow interest
 *  - `practice`     ordinary forward progress, including after a lone slip
 *  - `stretch`      reliable and independent; raise the challenge
 *  - `transfer`     reliable in one interaction form; try another
 *  - `represent`    fine in one form, not in another; work the weaker form
 *  - `reteach`      a repeated structural error; make the idea concrete
 *  - `scaffold`     success is leaning on help, or answers are unconsidered
 *  - `prerequisite` the idea underneath looks unsteady; go there first
 */
export type WorldIntent =
  | "stretch"
  | "practice"
  | "reteach"
  | "explore"
  | "transfer"
  | "represent"
  | "scaffold"
  | "prerequisite";

/**
 * A deliberately tiny prerequisite map covering only the skills this
 * decision engine can actually reason about.
 *
 * The repository's larger skill graph indexes a different id namespace and
 * does not describe these skills, and inventing a full curriculum ontology
 * to route four skills would be a liability rather than an asset. An entry
 * here means: when this skill shows a repeated structural error AND the
 * listed skill is itself unsteady, the underlying idea is worth revisiting.
 */
const SKILL_PREREQUISITES = new Map<string, string>([
  ["math-place-value", "math-counting"],
  ["math-addition", "math-place-value"],
  ["math-decimals", "math-place-value"],
  ["math-fractions", "math-counting"],
]);

export type NextActivity = {
  intent: WorldIntent;
  skillId: string | null;
  skillLabel: string | null;
  subject: EvidenceSubject | null;
  /** Preferred game slugs, most relevant first. May be empty. */
  preferredSlugs: string[];
  /**
   * A fully-parameterised destination for the first preferred slug, when the
   * decision depends on more than the game (a kernel run for a specific
   * skill, say). Null when the game's own route is the destination.
   */
  preferredHref: string | null;
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
  preferredHref: null,
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
/**
 * The single source of truth for what AdrianOS does next.
 *
 * The world beacon, the post-win screen, and every adult-facing explanation
 * all read this one decision, so a child cannot be told one thing on the map
 * and something else thirty seconds later.
 *
 * Precedence is explicit and ordered by how much a wrong next move would
 * cost. Something that would send a capable child backwards must clear a
 * higher bar than something that merely picks the next ordinary activity:
 *
 *   1. prerequisite  the idea underneath is itself unsteady
 *   2. reteach       a repeated structural error across independent tasks
 *   3. represent     secure in one interaction form, not in another
 *   4. scaffold      answers arrive faster than they can be considered
 *   5. reteach       a repeated identical answer, while accuracy is low
 *   6. scaffold      success is leaning on hints and retries
 *   7. transfer      reliable in one form; worth proving in another
 *   8. stretch       reliable and independent
 *   9. practice      ordinary progress — and where a lone slip lands
 *  10. explore       nothing credible to act on
 *
 * Specific evidence outranks general condition: a wrong answer that keeps
 * repeating says more about what to do next than a broad reliance on help
 * does. Unconsidered answering sits above both, because it makes every
 * other reading of the evidence unreliable.
 *
 * A single odd answer reaches none of the first five branches, because each
 * of them requires evidence that survived the accumulation rules.
 */
export function chooseLearningIntent(model: LearnerModel): NextActivity {
  if (!model.confident || model.skills.length === 0) return EXPLORE_ACTIVITY;

  const patterned = model.skills
    .filter((skill) => skill.state === "repeatable-error-pattern")
    .sort((a, b) => b.errorPatterns[0].taskCount - a.errorPatterns[0].taskCount)[0]
    ?? null;

  if (patterned) {
    const prerequisite = findUnsteadyPrerequisite(model, patterned);
    if (prerequisite) return prerequisiteActivity(patterned, prerequisite);
    return reteachActivity(patterned);
  }

  const representation = model.skills.find(
    (skill) => skill.state === "representation-specific-difficulty"
  );
  if (representation) {
    const activity = representActivity(representation);
    if (activity) return activity;
  }

  // Answers arriving faster than they can be read make every other reading
  // unreliable, so this is settled before any claim about a misunderstanding.
  const rapid = model.skills.find((skill) => skill.state === "possible-random-response");
  if (rapid) return scaffoldActivity(rapid);

  const focus = model.focusSkill;
  // A literal repeated wrong answer is weaker evidence than a structural
  // pattern, so it only routes when the skill is not otherwise going well.
  if (
    focus
    && (focus.action === "reteach" || focus.misconceptions.length > 0)
    && focus.accuracy < SLIP_TOLERANCE_ACCURACY
  ) {
    return {
      intent: "reteach",
      skillId: focus.skillId,
      skillLabel: focus.skillLabel,
      subject: focus.subject,
      preferredSlugs: focus.gameSlugs,
      preferredHref: null,
      childReason: `Let's figure out ${focus.skillLabel.toLowerCase()} together.`,
      adultReason: focus.misconceptions.length > 0
        ? `Repeated answer "${focus.misconceptions[0].answer}" on ${focus.skillLabel} suggests a specific misunderstanding rather than careless slips. Reteaching before more practice.`
        : `Accuracy on ${focus.skillLabel} is ${Math.round(focus.accuracy * 100)}% across ${focus.attempts} attempts. Reteaching with worked support.`,
      difficultyShift: -1,
      hintStrategy: "immediate",
    };
  }

  // Only once nothing more specific applies does general reliance on help
  // decide the next move.
  const leaning = model.skills.find((skill) => skill.state === "support-dependent");
  if (leaning) return scaffoldActivity(leaning);

  const transfer = findTransferCandidate(model);
  if (transfer) return transfer;

  if (model.readiness === "stretch" && model.stretchSkill) {
    const stretch = model.stretchSkill;
    return {
      intent: "stretch",
      skillId: stretch.skillId,
      skillLabel: stretch.skillLabel,
      subject: stretch.subject,
      preferredSlugs: stretch.gameSlugs,
      preferredHref: null,
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
      preferredHref: null,
      childReason: `A bit more ${focus.skillLabel.toLowerCase()} and you've got it.`,
      adultReason: `${focus.skillLabel} is forming: ${Math.round(focus.accuracy * 100)}% accurate with ${Math.round(focus.supportReliance * 100)}% support reliance. Repeating in a new setting.`,
      difficultyShift: focus.confidence === "struggling" ? -1 : 0,
      hintStrategy: focus.supportReliance > 0.4 ? "early" : "on-request",
    };
  }

  return EXPLORE_ACTIVITY;
}

/** Kept as the established name; the engine above is the implementation. */
export function recommendNextActivity(model: LearnerModel): NextActivity {
  return chooseLearningIntent(model);
}

/**
 * A repeated structural error justifies revisiting the idea underneath only
 * when that idea is *itself* unsteady in the evidence. A child who misses
 * multi-digit addition while place value is solid does not need to go back
 * to place value; they need help with addition.
 */
function findUnsteadyPrerequisite(
  model: LearnerModel,
  skill: SkillSignal
): SkillSignal | null {
  // A Map, because skill ids come from stored evidence: a plain object
  // would resolve "constructor" to an inherited function.
  const prerequisiteId = SKILL_PREREQUISITES.get(skill.skillId);
  if (!prerequisiteId) return null;
  const prerequisite = model.skills.find((row) => row.skillId === prerequisiteId);
  if (!prerequisite) return null;
  // Silence is not evidence of a gap: a skill nobody has practised says
  // nothing, and guessing that it is weak would send the child backwards
  // on no grounds at all.
  if (prerequisite.attempts < MIN_SKILL_ATTEMPTS) return null;
  const unsteady =
    prerequisite.state === "repeatable-error-pattern"
    || prerequisite.state === "support-dependent"
    || prerequisite.accuracy < SECURE_MECHANIC_ACCURACY;
  return unsteady ? prerequisite : null;
}

function prerequisiteActivity(
  skill: SkillSignal,
  prerequisite: SkillSignal
): NextActivity {
  const route = kernelRouteForSkill(prerequisite.skillId, "build");
  return {
    intent: "prerequisite",
    skillId: prerequisite.skillId,
    skillLabel: prerequisite.skillLabel,
    subject: prerequisite.subject,
    preferredSlugs: route ? [route.slug] : prerequisite.gameSlugs,
    preferredHref: route?.href ?? null,
    childReason: `Let's warm up with ${prerequisite.skillLabel.toLowerCase()} first.`,
    adultReason: `The repeated ${skill.skillLabel.toLowerCase()} errors involve ${prerequisite.skillLabel.toLowerCase()}, and ${prerequisite.skillLabel.toLowerCase()} is also unsteady (${Math.round(prerequisite.accuracy * 100)}% across ${prerequisite.attempts} attempts). Spending time there first.`,
    difficultyShift: -1,
    hintStrategy: "early",
  };
}

/**
 * A repeated structural error is answered with a representation that makes
 * the idea physical, rather than with more of the same question.
 */
function reteachActivity(skill: SkillSignal): NextActivity {
  const pattern = skill.errorPatterns[0];
  const verb = signatureFavoursVerb(pattern.signature);
  const route = verb ? kernelRouteForSkill(skill.skillId, verb) : null;
  // Deduction is a reteach destination only when the errors are themselves
  // about reading relationships and no concrete form is indicated. It is
  // never chosen merely for being the newest thing available.
  const inferenceRoute =
    !route && pattern.signature.startsWith("deduce.")
      ? null
      : route;
  return {
    intent: "reteach",
    skillId: skill.skillId,
    skillLabel: skill.skillLabel,
    subject: skill.subject,
    preferredSlugs: inferenceRoute ? [inferenceRoute.slug] : skill.gameSlugs,
    preferredHref: inferenceRoute?.href ?? null,
    childReason: `Let's build ${skill.skillLabel.toLowerCase()} a different way.`,
    adultReason: `Across ${pattern.taskCount} different ${skill.skillLabel.toLowerCase()} tasks, ${describePatternForAdult(pattern)}. Offering a hands-on version of the same idea rather than more of the same questions.`,
    difficultyShift: -1,
    hintStrategy: "early",
  };
}

/**
 * Secure in one interaction form and not in another is a statement about the
 * representation, not about the skill. The answer is time in the weaker
 * form, with help available — not an easier version of the whole skill.
 */
function representActivity(skill: SkillSignal): NextActivity | null {
  const weak = skill.weakMechanics.find(
    (mechanic) => mechanic === "build" || mechanic === "place"
  ) as "build" | "place" | undefined;
  if (!weak) return null;
  const route = kernelRouteForSkill(skill.skillId, weak);
  if (!route) return null;
  const strong = skill.secureMechanics[0];
  return {
    intent: "represent",
    skillId: skill.skillId,
    skillLabel: skill.skillLabel,
    subject: skill.subject,
    preferredSlugs: [route.slug],
    preferredHref: route.href,
    childReason: `You've got ${skill.skillLabel.toLowerCase()}! Let's try it this way.`,
    adultReason: `${skill.skillLabel} is reliable when ${MECHANIC_PHRASES.get(strong) ?? "working in a familiar way"}, but not yet when ${MECHANIC_PHRASES.get(weak)}. Practising that form specifically, with help available, rather than treating the whole skill as weak.`,
    difficultyShift: 0,
    hintStrategy: "early",
  };
}

/**
 * Help stays on and the challenge comes down. Nothing here punishes a child
 * for guessing; it simply stops rewarding speed over thought.
 */
function scaffoldActivity(skill: SkillSignal): NextActivity {
  const random = skill.state === "possible-random-response";
  return {
    intent: "scaffold",
    skillId: skill.skillId,
    skillLabel: skill.skillLabel,
    subject: skill.subject,
    preferredSlugs: skill.gameSlugs,
    preferredHref: null,
    childReason: random
      ? `Let's take ${skill.skillLabel.toLowerCase()} slowly together.`
      : `Let's do ${skill.skillLabel.toLowerCase()} with a helper.`,
    adultReason: random
      ? `Answers on ${skill.skillLabel} are arriving faster than the questions can be read, and accuracy is ${Math.round(skill.accuracy * 100)}%. Slowing the loop down and keeping help on screen.`
      : `${skill.skillLabel} succeeds mainly with hints or retries (${Math.round(skill.supportReliance * 100)}% of attempts). Keeping the support in place rather than calling the skill secure.`,
    difficultyShift: -1,
    hintStrategy: "immediate",
  };
}

function describePatternForAdult(pattern: ErrorPattern): string {
  return pattern.description;
}

/** The kernel route that expresses a skill through a verb, when one exists. */
function kernelRouteForSkill(
  skillId: string,
  verb: "build" | "place"
): { slug: string; href: string } | null {
  if (!kernelVerbsForSkill(skillId).includes(verb)) return null;
  const game = KERNEL_GAMES[verb];
  return {
    slug: game.slug,
    href: `/games/${game.slug}?${new URLSearchParams({ skill: skillId, from: "teaching" })}`,
  };
}


const MECHANIC_PHRASES = new Map<string, string>([
  ["choose", "picking answers"],
  ["build", "building it"],
  ["place", "putting things in order"],
  ["recall", "memory play"],
  ["deduce", "working it out from clues"],
]);

function findTransferCandidate(model: LearnerModel): NextActivity | null {
  const candidates = model.skills
    .filter((skill) => {
      if (skill.attempts < MIN_SKILL_ATTEMPTS) return false;
      if (skill.fluency < TRANSFER_FLUENCY) return false;
      if (skill.misconceptions.length > 0) return false;
      if (skill.grasp === "single-context") return true;
      // Inference is not just a third skin. A child who can construct and
      // position an idea has still never been asked to work it out from
      // relationships, so that gap is worth closing even once the evidence
      // already spans two kinds of demand.
      return (
        skill.grasp === "cross-context"
        && !skill.secureCategories.includes("inference")
        && deduceSupportsSkill(skill.skillId)
      );
    })
    .sort((a, b) => b.fluency - a.fluency);

  for (const skill of candidates) {
    const route = alternateMechanicRoute(skill.skillId, skill.secureMechanics);
    if (!route) continue;
    const shownIn = MECHANIC_PHRASES.get(skill.secureMechanics[0]) ?? "one kind of activity";
    return {
      intent: "transfer",
      skillId: skill.skillId,
      skillLabel: skill.skillLabel,
      subject: skill.subject,
      preferredSlugs: [route.slug],
      preferredHref: route.href,
      childReason: `You're a star at ${skill.skillLabel.toLowerCase()}! Try it a brand-new way.`,
      adultReason: `${skill.skillLabel} is reliable, but so far only by ${shownIn}. Offering the same skill through ${MECHANIC_PHRASES.get(route.verb)} to see whether the understanding carries across.`,
      difficultyShift: 0,
      hintStrategy: "on-request",
    };
  }
  return null;
}

/**
 * Plain-language sentence describing what has been observed for a skill and
 * what AdrianOS is doing about it.
 *
 * Every branch names an observation and an action. None of them claims to
 * know what a child understands, and none reports a probability: a parent
 * can check any of these statements against the activities themselves.
 */
export function explainSkillForAdult(skill: SkillSignal, childName: string): string {
  const name = childName || "Your child";
  const label = skill.skillLabel.toLowerCase();
  switch (skill.state) {
    case "repeatable-error-pattern": {
      const pattern = skill.errorPatterns[0];
      return `${name} ${pattern.description} in ${pattern.taskCount} different ${label} activities, so AdrianOS is giving another way to work with the same idea.`;
    }
    case "representation-specific-difficulty": {
      const strong = MECHANIC_PHRASES.get(skill.secureMechanics[0]) ?? "one kind of activity";
      const weak = MECHANIC_PHRASES.get(skill.weakMechanics[0]) ?? "another kind";
      return `${name} handles ${label} reliably when ${strong}, and is still practising when ${weak}. The next activities focus on that second kind.`;
    }
    case "possible-random-response":
      return `Answers on ${label} have been arriving very quickly and often missing, so AdrianOS has slowed the activity down and kept a helper on screen.`;
    case "support-dependent":
      return `${name} is getting ${label} right with hints or a second try most of the time, so the helper stays on rather than the skill being treated as finished.`;
    case "secure":
      return skill.grasp === "cross-context"
        ? `${name} solved ${label} reliably in ${skill.secureMechanics.length} different kinds of activities.`
        : `${name} solves ${label} reliably in one kind of activity so far.`;
    case "emerging":
      return `${name} is getting ${label} right about ${Math.round(skill.accuracy * 100)}% of the time and is still building it.`;
    default:
      return `There is not enough ${label} activity yet to say anything useful.`;
  }
}

/** Plain-language label for how broadly a skill has been demonstrated. */
export function graspLabel(
  skill: Pick<SkillSignal, "grasp" | "secureMechanics" | "secureCategories">
): string {
  if (skill.grasp === "cross-context") {
    return `Shown in ${skill.secureCategories.length} different kinds of activities`;
  }
  if (skill.grasp === "single-context") return "Reliable in one kind of activity so far";
  return "Not enough evidence yet";
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
