"use client";

/**
 * The shared interaction-kernel surface.
 *
 * One component renders every kernel verb, because the child's physical
 * interaction is deliberately identical — tap parts from a tray, Undo,
 * Check — while the *cognitive* action changes per verb:
 *
 * - BUILD: an open box judged by what the selection totals. No slot count
 *   and no running total are shown, so the child must actually count or
 *   compose; any valid composition of the target passes, exactly as it
 *   would with physical blocks.
 * - PLACE: a fixed row of slots filled in order; order itself is judged.
 *
 * The interaction stays tap-first (works on touch, mouse and keyboard —
 * every control is a native button) and mirrors the tap–Undo–Check loop
 * children already know from Word Forge Studio.
 *
 * Misses escalate deterministically: first miss coaches a strategy, second
 * shows the worked answer and lets the round advance, so nobody gets stuck.
 * Every Check is recorded with the mechanic, the canonical form of what was
 * actually made, and the coaching level it leaned on.
 */

import GameFrame from "@/components/GameFrame";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { markQuestionShown } from "@/lib/adrian-evidence";
import { useGameSession } from "@/lib/game-session";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import {
  buildKernelRun,
  judgeKernelAnswer,
  KERNEL_RUN_LENGTH,
  LONG_LABEL_CHARS,
  type KernelPart,
  type KernelTask,
  resolveKernelSkill,
  type KernelVerb,
} from "@/lib/kernels/kernel-tasks";
import { KERNEL_GAMES } from "@/lib/kernels/kernel-registry";
import { adaptKernelRun, DEFAULT_ADAPTATION } from "@/lib/kernels/kernel-adaptation";
import { useLearnerModel } from "@/lib/adrian-evidence";
import { chooseLearningIntent } from "@/lib/adrian-learner-model";
import { useEffect, useMemo, useRef, useState } from "react";

type VerbTheme = {
  accent: string;
  eyebrow: string;
  intro: string;
  boxLabel: string;
  checkLabel: string;
  startLabel: string;
  perfectLine: string;
  solvedLine: string;
};

const THEMES: Record<KernelVerb, VerbTheme> = {
  build: {
    accent: "#ffd45c",
    eyebrow: "BUILDING",
    intro: "Make numbers out of real pieces. Tap parts into the box, then check your build.",
    boxLabel: "Your build",
    checkLabel: "Check my build",
    startLabel: "Start building →",
    perfectLine: "Built it first try! +3 sparks.",
    solvedLine: "You built it! +1 spark.",
  },
  place: {
    accent: "#8dd7ff",
    eyebrow: "PUTTING IN ORDER",
    intro: "Set the stepping stones in the right order to cross the river.",
    boxLabel: "Your path",
    checkLabel: "Check my path",
    startLabel: "Start crossing →",
    perfectLine: "Crossed first try! +3 sparks.",
    solvedLine: "You made it across! +1 spark.",
  },
};

function localDateKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

export default function KernelPlayground({ verb }: { verb: KernelVerb }) {
  const game = KERNEL_GAMES[verb];
  const theme = THEMES[verb];
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(game.slug);
  // The learner model is read once when the run is built. Reading it live
  // would let a task change under the child's hands mid-round.
  const { model: learnerModel, hydrated: modelReady } = useLearnerModel(
    hydrated ? activeProfile.id : ""
  );

  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [route, setRoute] = useState<{ skillId: string | null; from: string | null } | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState<KernelPart[]>([]);
  const [misses, setMisses] = useState(0);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [sparks, setSparks] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [message, setMessage] = useState("");
  // Spam-tapping Check fires the handler again before React commits the
  // resulting state, which would record duplicate evidence rows. The guard
  // is a ref (synchronous) and lifts only once the selection or round
  // actually changes.
  const checkGuard = useRef(false);
  useEffect(() => {
    checkGuard.current = false;
  }, [chosen, round, started]);


  useEffect(() => {
    if (!hydrated) return;
    setGrade(readProfileGrade(activeProfile));
    const params = new URLSearchParams(window.location.search);
    setRoute({ skillId: params.get("skill"), from: params.get("from") });
  }, [activeProfile, hydrated]);

  // Which skill this run will teach, decided before the run is built so the
  // teaching decision can be matched against it.
  const runSkillId = useMemo(() => {
    if (grade === null || route === null) return null;
    return resolveKernelSkill(verb, grade, route.skillId);
  }, [grade, route, verb]);

  const adaptation = useMemo(() => {
    if (!modelReady || !runSkillId) return DEFAULT_ADAPTATION;
    return adaptKernelRun(chooseLearningIntent(learnerModel), runSkillId);
  }, [learnerModel, modelReady, runSkillId]);

  const run = useMemo(() => {
    if (grade === null || route === null || !modelReady) return null;
    return buildKernelRun({
      verb,
      profileId: activeProfile.id,
      grade,
      skillId: route.skillId,
      difficultyShift: adaptation.difficultyShift,
      dayKey: localDateKey(),
    });
  }, [activeProfile.id, adaptation.difficultyShift, grade, modelReady, route, verb]);

  // When answers have been arriving faster than the question can be read,
  // Check waits a beat after the last tap. Nothing is blocked and nothing is
  // said about it: rapid tapping simply stops being the quickest route.
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    if (adaptation.settleMs <= 0) {
      setSettled(true);
      return;
    }
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), adaptation.settleMs);
    return () => window.clearTimeout(timer);
  }, [adaptation.settleMs, chosen, round]);

  const task: KernelTask | null = run?.[round] ?? null;

  useEffect(() => {
    if (started && !finished && task) {
      markQuestionShown(game.slug);
      // A visible scaffold puts the strategy on screen from the start rather
      // than holding it back until something goes wrong.
      setMessage(adaptation.scaffold === "visible" ? task.hint : task.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adaptation.scaffold, started, finished, round, task?.id]);

  const chosenIds = useMemo(() => new Set(chosen.map((part) => part.id)), [chosen]);
  // Read off the task rather than the skill, so any future generator whose
  // pieces are sentences gets the readable layout without being listed here.
  const longLabels = useMemo(
    () => (task?.tray ?? []).some((part) => part.label.length > LONG_LABEL_CHARS),
    [task]
  );
  const done = solved || revealed;
  const canCheck = task
    ? !done
      && settled
      && (task.verb === "build" ? chosen.length > 0 : chosen.length === task.slots)
    : false;

  function tap(part: KernelPart) {
    if (!task || done || chosenIds.has(part.id)) return;
    if (task.verb === "place" && chosen.length >= task.slots) return;
    setChosen((value) => [...value, part]);
  }

  function undo() {
    if (!done) setChosen((value) => value.slice(0, -1));
  }

  function check() {
    if (!task || !canCheck || checkGuard.current) return;
    checkGuard.current = true;
    const judgement = judgeKernelAnswer(task, chosen);
    recordLearningAttempt(
      {
        gameSlug: game.slug,
        subject: task.subject,
        skillId: task.skillId,
        skillLabel: task.skillLabel,
        prompt: task.prompt,
        correctAnswer: task.targetLabel,
        correct: judgement.correct,
        givenAnswer: judgement.canonicalAnswer,
        hintsUsed: Math.min(misses, 2),
        wrongAttempts: misses,
        mechanic: verb,
        // The run strips the "#index" suffix so the same target met on a
        // later day is the same task, while retries within a run collapse.
        taskId: task.id.split("#")[0],
        errorSignature: judgement.errorSignature,
        data: {
          standardCode: task.standardCode ?? "",
          kernelVerb: verb,
          arrivedFrom: route?.from ?? "",
        },
      },
      activeProfile.id
    );
    if (judgement.correct) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      setSparks((value) => value + (misses === 0 ? 3 : 1));
      setSolved(true);
      setMessage(misses === 0 ? theme.perfectLine : theme.solvedLine);
    } else if (misses === 0) {
      setMisses(1);
      setCombo(0);
      setChosen([]);
      setMessage(task.hint);
      markQuestionShown(game.slug);
    } else {
      // Second miss: show the worked answer and let the round move on, so a
      // child is never trapped repeating a task they cannot yet do.
      setMisses(2);
      setCombo(0);
      setRevealed(true);
      setMessage(task.explanation);
    }
  }

  function advance() {
    if (!run || !done) return;
    if (round >= run.length - 1) {
      completeGame({
        xp: 30 + sparks * 3 + bestCombo * 2,
        coins: 6 + sparks,
        score: sparks * 100 + bestCombo * 40,
      });
      setFinished(true);
      return;
    }
    setRound((value) => value + 1);
    setChosen([]);
    setMisses(0);
    setSolved(false);
    setRevealed(false);
  }

  function replay() {
    restartGame();
    setStarted(true);
    setFinished(false);
    setRound(0);
    setChosen([]);
    setMisses(0);
    setSolved(false);
    setRevealed(false);
    setSparks(0);
    setCombo(0);
    setBestCombo(0);
  }

  const background = `radial-gradient(circle at top, ${theme.accent}28, #11151d 55%)`;

  if (!run || !task) {
    return (
      <GameFrame title={game.title}>
        <main style={loading}>Setting up {game.title}…</main>
      </GameFrame>
    );
  }

  if (!started) {
    const transferArrival = route?.from === "transfer";
    return (
      <GameFrame title={game.title}>
        <main style={{ ...page, background }}>
          <section style={hero}>
            <div style={big}>{game.emoji}</div>
            <span style={{ ...eyebrow, color: theme.accent }}>{theme.eyebrow}</span>
            <h1 style={title}>{game.title}</h1>
            <p style={lead}>
              {transferArrival
                ? `You're great at ${task.skillLabel.toLowerCase()} — now show it a brand-new way!`
                : theme.intro}
            </p>
            <div style={stats}>
              <strong>{game.emoji} {KERNEL_RUN_LENGTH} rounds</strong>
              <strong>🔥 combo rewards</strong>
              <strong>🔊 hear every step</strong>
            </div>
            <button onClick={() => setStarted(true)} style={{ ...primary, background: theme.accent }}>
              {theme.startLabel}
            </button>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title={game.title}>
        <main style={{ ...page, background }}>
          <section style={hero}>
            <div style={big}>🏆{game.emoji}</div>
            <span style={{ ...eyebrow, color: theme.accent }}>ALL {KERNEL_RUN_LENGTH} ROUNDS DONE</span>
            <h1 style={title}>{activeProfile.name} did it!</h1>
            <p style={lead}>Every round was made with your own hands — that is how it sticks.</p>
            <div style={stats}>
              <strong>✨ {sparks} sparks</strong>
              <strong>🔥 {bestCombo}× best combo</strong>
            </div>
            <button onClick={replay} style={{ ...primary, background: theme.accent }}>
              Play again →
            </button>
          </section>
        </main>
      </GameFrame>
    );
  }

  return (
    <GameFrame title={game.title}>
      <main style={{ ...page, background }}>
        <header style={hud}>
          <strong>{game.emoji} Round {round + 1}/{run.length}</strong>
          <span>✨ {sparks} · 🔥 {combo}×</span>
        </header>
        <div style={track}>
          <div
            style={{
              ...fill,
              width: `${((round + (done ? 1 : 0)) / run.length) * 100}%`,
              background: theme.accent,
            }}
          />
        </div>
        <section style={cardStyle}>
          <h1 style={promptStyle}>{task.prompt}</h1>
          <button onClick={() => speak(task.prompt)} style={listen}>🔊 Hear it</button>

          <div aria-label={theme.boxLabel} data-testid="kernel-box" style={boxOuter}>
            <span style={boxTitle}>{theme.boxLabel}</span>
            {task.verb === "place" ? (
              <div style={longLabels ? slotColumn : slotRow}>
                {Array.from({ length: task.slots }, (_, index) => {
                  const part = chosen[index];
                  return (
                    <span
                      key={index}
                      style={{
                        ...(longLabels ? slotLine : slotStyle),
                        borderColor: part ? theme.accent : "rgba(255,255,255,.22)",
                      }}
                    >
                      {part ? (
                        <>
                          {longLabels ? null : <span style={slotEmoji}>{part.emoji}</span>}
                          <span style={longLabels ? partSentence : slotLabel}>{part.label}</span>
                        </>
                      ) : (
                        <span style={slotIndex}>{index + 1}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div style={buildBox}>
                {chosen.length === 0 ? (
                  <span style={boxEmpty}>Tap pieces below to add them</span>
                ) : (
                  chosen.map((part) => (
                    <span key={part.id} style={{ ...chip, borderColor: theme.accent }}>
                      <span style={slotEmoji}>{part.emoji}</span>
                      <span style={slotLabel}>{part.label}</span>
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          <div
            data-testid="kernel-tray"
            data-long-labels={longLabels ? "true" : "false"}
            style={longLabels ? trayColumn : trayGrid}
          >
            {task.tray.map((part) => (
              <button
                key={part.id}
                data-part-id={part.id}
                onClick={() => tap(part)}
                disabled={done || chosenIds.has(part.id)}
                style={{
                  ...(longLabels ? partRow : partButton),
                  opacity: chosenIds.has(part.id) ? 0.25 : 1,
                }}
              >
                {longLabels ? null : <span style={partEmoji}>{part.emoji}</span>}
                <span style={longLabels ? partSentence : partLabel}>{part.label}</span>
              </button>
            ))}
          </div>

          <div style={actions}>
            <button onClick={undo} data-testid="kernel-undo" disabled={done || chosen.length === 0} style={secondary}>
              Undo
            </button>
            <button
              onClick={check}
              data-testid="kernel-check"
              disabled={!canCheck}
              style={{ ...primary, background: theme.accent, opacity: canCheck ? 1 : 0.5 }}
            >
              {theme.checkLabel}
            </button>
          </div>

          <div role="status" style={teaching}>
            <strong>{misses === 0 ? "WORKSHOP GUIDE" : "HELPER"}</strong>
            <p style={{ margin: "6px 0 0" }}>{message}</p>
            {done && (
              <button onClick={advance} data-testid="kernel-advance" style={{ ...primary, background: theme.accent, marginTop: 12 }}>
                {round >= run.length - 1 ? "Finish →" : "Next round →"}
              </button>
            )}
          </div>
        </section>
      </main>
    </GameFrame>
  );
}

const loading: React.CSSProperties = { minHeight: 500, display: "grid", placeItems: "center", background: "#11151d", color: "#fff", fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 80px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "rgba(18,24,36,.94)", border: "1px solid rgba(255,255,255,.14)" };
const big: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.6rem,8vw,5.4rem)", lineHeight: 0.92, letterSpacing: "-.05em" };
const lead: React.CSSProperties = { maxWidth: 680, margin: "12px auto 22px", color: "#c4ccd8", lineHeight: 1.6, fontWeight: 700 };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", margin: "20px 0" };
const primary: React.CSSProperties = { minHeight: 58, padding: "14px 22px", border: 0, borderRadius: 999, color: "#11151d", fontWeight: 950, cursor: "pointer", fontSize: 16 };
const secondary: React.CSSProperties = { ...primary, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const hud: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto 10px", display: "flex", justifyContent: "space-between", padding: 14, borderRadius: 20, background: "rgba(18,24,36,.94)", fontWeight: 900 };
const track: React.CSSProperties = { width: "min(900px,100%)", height: 12, margin: "0 auto 12px", borderRadius: 999, background: "#222936", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", transition: "width .3s ease" };
const cardStyle: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(20px,5vw,40px)", borderRadius: 30, background: "rgba(18,24,36,.96)", textAlign: "center", border: "1px solid rgba(255,255,255,.14)" };
const promptStyle: React.CSSProperties = { margin: "8px auto 12px", fontSize: "clamp(1.5rem,4.5vw,2.6rem)", lineHeight: 1.1 };
const listen: React.CSSProperties = { minHeight: 46, padding: "10px 16px", borderRadius: 999, background: "#222936", border: "1px solid rgba(255,255,255,.14)", color: "#fff", fontWeight: 900, cursor: "pointer" };
const boxOuter: React.CSSProperties = { margin: "20px 0 16px", padding: 14, borderRadius: 22, background: "#10131b", border: "1px dashed rgba(255,255,255,.2)" };
const boxTitle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 950, letterSpacing: ".14em", color: "#8b94a5", textTransform: "uppercase", marginBottom: 10 };
const slotRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 };
const slotStyle: React.CSSProperties = { minWidth: 72, minHeight: 72, padding: "6px 10px", display: "grid", placeItems: "center", gap: 2, borderRadius: 16, border: "3px solid", background: "#181e2b" };
const slotEmoji: React.CSSProperties = { fontSize: 24, lineHeight: 1 };
/*
 * Sentence-shaped tiles.
 *
 * The tray was built for "47" and "3 x 4": a 64px square with an emoji above
 * a centred word. A whole sentence in that box wraps into an unreadable
 * column, so when a task's own labels are long the tray and the slots become
 * stacked full-width lines instead — left-aligned, no emoji competing with
 * the words, and tall enough to read at a glance.
 */
const trayColumn: React.CSSProperties = { display: "grid", gap: 8, margin: "6px 0 4px" };
const slotColumn: React.CSSProperties = { display: "grid", gap: 8 };
const partRow: React.CSSProperties = { width: "100%", minHeight: 52, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", textAlign: "left" };
const slotLine: React.CSSProperties = { width: "100%", minHeight: 52, padding: "12px 14px", borderRadius: 14, border: "3px solid", background: "#181e2b", display: "flex", alignItems: "center", textAlign: "left" };
const partSentence: React.CSSProperties = { fontSize: 15, fontWeight: 700, lineHeight: 1.45, textAlign: "left" };
const slotLabel: React.CSSProperties = { fontSize: 14, fontWeight: 950 };
const slotIndex: React.CSSProperties = { fontSize: 22, fontWeight: 950, color: "#3b4354" };
const buildBox: React.CSSProperties = { minHeight: 84, display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 8, padding: 6 };
const boxEmpty: React.CSSProperties = { color: "#5a6376", fontWeight: 800 };
const chip: React.CSSProperties = { minWidth: 52, minHeight: 52, padding: "4px 8px", display: "grid", placeItems: "center", borderRadius: 14, border: "2px solid", background: "#181e2b" };
const trayGrid: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 9, margin: "6px 0 4px" };
const partButton: React.CSSProperties = { minWidth: 64, minHeight: 64, padding: "6px 10px", borderRadius: 18, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", gap: 2 };
const partEmoji: React.CSSProperties = { fontSize: 26, lineHeight: 1 };
const partLabel: React.CSSProperties = { fontSize: 13, fontWeight: 950 };
const actions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 18 };
const teaching: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 20, background: "#10131b", color: "#c4ccd8" };
