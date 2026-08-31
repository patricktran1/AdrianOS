"use client";

/**
 * Clue Hollow — the DEDUCE surface.
 *
 * The design problem this solves: a clue game where the child reads a hint
 * and taps one of four names is multiple choice wearing a hat. Guessing
 * costs nothing, and nothing about the child's reasoning is observable.
 *
 * So here the reasoning *is* the interaction:
 *
 *   1. One clue is on the lantern. More can be asked for, one at a time.
 *   2. The child crosses out the cards the clue rules out.
 *   3. When exactly one card is left standing, they can claim it.
 *
 * Two consequences fall out of that, and they are the point of the mission:
 *
 * - Claiming is only possible with exactly one card standing, so "cross out
 *   everything" and "cross out nothing" are not strategies.
 * - Every cross-out is checked against the clues *revealed so far*. Ruling
 *   out a card that nothing has contradicted yet is recorded as an
 *   unjustified move. A child who crosses out three cards at random and
 *   happens to leave the right one has produced a correct answer and a very
 *   different reasoning trace, and the evidence keeps them apart.
 *
 * Nothing here scolds. A card crossed out too early can be brought back, and
 * the guide never mentions guessing.
 */

import GameFrame from "@/components/GameFrame";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { markQuestionShown } from "@/lib/adrian-evidence";
import { useGameSession } from "@/lib/game-session";
import { useLearnerModel } from "@/lib/adrian-evidence";
import { chooseLearningIntent } from "@/lib/adrian-learner-model";
import { adaptKernelRun, DEFAULT_ADAPTATION } from "@/lib/kernels/kernel-adaptation";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import {
  buildDeduceRun,
  describeClue,
  DEDUCE_RUN_LENGTH,
  resolveDeduceSkill,
  type DeduceTask,
} from "@/lib/kernels/deduce-tasks";
import {
  isRuledOut,
  rulingConstraint,
  type DeduceCandidate,
} from "@/lib/kernels/deduce-constraints";
import {
  deduceErrorSignature,
  isCleanDeduction,
  type DeduceTrace,
} from "@/lib/learning/deduce-evidence";
import { useEffect, useMemo, useRef, useState } from "react";

const GAME_SLUG = "clue-hollow";
const ACCENT = "#9cff88";

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

export default function DeducePlayground() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const { model: learnerModel, hydrated: modelReady } = useLearnerModel(
    hydrated ? activeProfile.id : ""
  );

  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [route, setRoute] = useState<{ skillId: string | null; from: string | null } | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);

  // Per-round reasoning state.
  const [revealed, setRevealed] = useState(1);
  const [ruledOut, setRuledOut] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState("");
  const [sparks, setSparks] = useState(0);

  // The reasoning trace for the round in progress. A ref because it is
  // written from event handlers and must never trigger a re-render.
  const trace = useRef<DeduceTrace>({ unjustifiedEliminations: 0, restored: 0, misappliedKinds: [] });
  // Which cards are *currently* crossed out without a clue supporting it.
  // Held separately so that correcting a hasty cross-out clears it: the
  // action is still recorded, but a child who thinks again and fixes it has
  // reasoned their way to the answer.
  const unsupported = useRef<Set<string>>(new Set());
  const claimGuard = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    setGrade(readProfileGrade(activeProfile));
    const params = new URLSearchParams(window.location.search);
    setRoute({ skillId: params.get("skill"), from: params.get("from") });
  }, [activeProfile, hydrated]);

  const runSkillId = useMemo(() => {
    if (grade === null || route === null) return null;
    return resolveDeduceSkill(grade, route.skillId);
  }, [grade, route]);

  const adaptation = useMemo(() => {
    if (!modelReady || !runSkillId) return DEFAULT_ADAPTATION;
    return adaptKernelRun(chooseLearningIntent(learnerModel), runSkillId);
  }, [learnerModel, modelReady, runSkillId]);

  const run = useMemo(() => {
    if (grade === null || route === null || !modelReady) return null;
    return buildDeduceRun({
      profileId: activeProfile.id,
      grade,
      skillId: route.skillId,
      difficultyShift: adaptation.difficultyShift,
      dayKey: localDateKey(),
    });
  }, [activeProfile.id, adaptation.difficultyShift, grade, modelReady, route]);

  const task: DeduceTask | null = run?.[round] ?? null;

  useEffect(() => {
    if (!started || finished || !task) return;
    markQuestionShown(GAME_SLUG);
    // A visible scaffold opens with two clues already lit rather than one.
    setRevealed(adaptation.scaffold === "visible" ? Math.min(2, task.clues.length) : 1);
    setRuledOut([]);
    setMisses(0);
    setSolved(false);
    trace.current = { unjustifiedEliminations: 0, restored: 0, misappliedKinds: [] };
    unsupported.current = new Set();
    claimGuard.current = false;
    setMessage("Read the clue. Cross out the ones it cannot be.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, round, task?.id, adaptation.scaffold]);

  const revealedClues = useMemo(
    () => (task ? task.clues.slice(0, revealed) : []),
    [task, revealed]
  );
  const standing = useMemo(
    () => (task ? task.candidates.filter((row) => !ruledOut.includes(row.id)) : []),
    [task, ruledOut]
  );

  // Claiming is possible only when the child's own work has narrowed the
  // field to one. This is what stops "cross out everything" being a route
  // to a correct answer.
  const canClaim = standing.length === 1 && !solved;
  const moreClues = task ? revealed < task.clues.length : false;

  function toggleCard(candidate: DeduceCandidate) {
    if (!task || solved) return;
    if (ruledOut.includes(candidate.id)) {
      // Bringing a card back is a legitimate correction, not a failure.
      trace.current.restored += 1;
      unsupported.current.delete(candidate.id);
      trace.current.unjustifiedEliminations = unsupported.current.size;
      setRuledOut((value) => value.filter((id) => id !== candidate.id));
      setMessage(`${candidate.label} is back in the hunt.`);
      return;
    }
    const ruling = rulingConstraint(candidate, revealedClues, task.candidates);
    if (!ruling) {
      // Nothing revealed so far contradicts this card. The move is allowed —
      // children are entitled to explore — but it is recorded honestly.
      unsupported.current.add(candidate.id);
      trace.current.unjustifiedEliminations = unsupported.current.size;
      for (const clue of revealedClues) {
        if (!trace.current.misappliedKinds.includes(clue.kind)) {
          trace.current.misappliedKinds.push(clue.kind);
        }
      }
      setMessage("Hmm — no clue says it can't be that one yet.");
    } else {
      setMessage(`Good spot. ${describeClue(ruling, task.candidates)}`);
    }
    setRuledOut((value) => [...value, candidate.id]);
  }

  function revealNext() {
    if (!task || !moreClues || solved) return;
    setRevealed((value) => Math.min(task.clues.length, value + 1));
    markQuestionShown(GAME_SLUG);
  }

  function claim() {
    if (!task || !canClaim || claimGuard.current) return;
    claimGuard.current = true;
    const chosen = standing[0];
    const correct = chosen.id === task.solutionId;
    const stillContradicted = isRuledOut(chosen, task.clues, task.candidates);

    recordLearningAttempt(
      {
        gameSlug: GAME_SLUG,
        subject: task.subject,
        skillId: task.skillId,
        skillLabel: task.skillLabel,
        prompt: task.prompt,
        correctAnswer:
          task.candidates.find((row) => row.id === task.solutionId)?.label ?? "",
        correct,
        givenAnswer: chosen.label,
        hintsUsed: Math.min(misses, 2),
        wrongAttempts: misses,
        mechanic: "deduce",
        // The distinction the verb exists for: reached by working the clues,
        // or merely arrived at.
        reasoned: isCleanDeduction({
          correct,
          revealedCount: revealed,
          cluesNeeded: task.cluesNeeded,
          trace: trace.current,
        }),
        taskId: task.id.split("#")[0],
        errorSignature: correct
          ? null
          : deduceErrorSignature({
              task,
              chosen,
              revealedCount: revealed,
              trace: trace.current,
            }),
        data: {
          standardCode: task.standardCode ?? "",
          kernelVerb: "deduce",
          arrivedFrom: route?.from ?? "",
          // The reasoning trace: how much of the clue set was actually used,
          // and whether the eliminations were supported by it.
          cluesRevealed: revealed,
          cluesNeeded: task.cluesNeeded,
          unjustifiedEliminations: trace.current.unjustifiedEliminations,
        },
      },
      activeProfile.id
    );

    if (correct) {
      const clean = revealed >= task.cluesNeeded && trace.current.unjustifiedEliminations === 0;
      setSparks((value) => value + (clean && misses === 0 ? 3 : 1));
      setSolved(true);
      setMessage(
        clean ? "Solved! Every clue fits." : "That's the one! Let's check the clues together."
      );
    } else if (misses === 0) {
      setMisses(1);
      setRuledOut([]);
      unsupported.current = new Set();
      trace.current.unjustifiedEliminations = 0;
      claimGuard.current = false;
      setMessage(
        stillContradicted
          ? "One of the clues doesn't fit that one. Try the clues again."
          : "Not quite. Read each clue again and see who it rules out."
      );
    } else {
      setMisses(2);
      setSolved(true);
      setMessage(task.explanation);
    }
  }

  function advance() {
    if (!run || !solved) return;
    if (round >= run.length - 1) {
      completeGame({ xp: 30 + sparks * 3, coins: 6 + sparks, score: sparks * 110 });
      setFinished(true);
      return;
    }
    setRound((value) => value + 1);
  }

  function replay() {
    restartGame();
    setStarted(true);
    setFinished(false);
    setRound(0);
    setSparks(0);
  }

  const background = `radial-gradient(circle at top, ${ACCENT}22, #0f1512 55%)`;

  if (!run || !task) {
    return (
      <GameFrame title="Clue Hollow">
        <main style={loading}>Lighting the lanterns…</main>
      </GameFrame>
    );
  }

  if (!started) {
    return (
      <GameFrame title="Clue Hollow">
        <main style={{ ...page, background }}>
          <section style={hero}>
            <div style={big}>🔦</div>
            <span style={{ ...eyebrow, color: ACCENT }}>WORKING IT OUT</span>
            <h1 style={title}>Clue Hollow</h1>
            <p style={lead}>
              {route?.from === "teaching" || route?.from === "transfer"
                ? `You know ${task.skillLabel.toLowerCase()} — now find it from clues.`
                : "Something is hiding. Use the clues to cross out who it cannot be."}
            </p>
            <div style={stats}>
              <strong>🔦 {run.length} mysteries</strong>
              <strong>❌ cross out</strong>
              <strong>🔊 hear every clue</strong>
            </div>
            <button onClick={() => setStarted(true)} style={{ ...primary, background: ACCENT }}>
              Start the hunt →
            </button>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Clue Hollow">
        <main style={{ ...page, background }}>
          <section style={hero}>
            <div style={big}>🏆🔦</div>
            <span style={{ ...eyebrow, color: ACCENT }}>ALL MYSTERIES SOLVED</span>
            <h1 style={title}>{activeProfile.name} worked them all out!</h1>
            <p style={lead}>You found each one by ruling out what it could not be.</p>
            <div style={stats}><strong>✨ {sparks} sparks</strong></div>
            <button onClick={replay} style={{ ...primary, background: ACCENT }}>
              Another hunt →
            </button>
          </section>
        </main>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Clue Hollow">
      <main style={{ ...page, background }}>
        <header style={hud}>
          <strong>🔦 Mystery {round + 1}/{run.length}</strong>
          <span>✨ {sparks}</span>
        </header>
        <div style={track}>
          <div style={{ ...fill, width: `${((round + (solved ? 1 : 0)) / run.length) * 100}%`, background: ACCENT }} />
        </div>

        <section style={cardStyle}>
          <h1 style={promptStyle}>{task.prompt}</h1>

          <ul style={clueList} data-testid="clue-list" aria-label="Clues so far">
            {revealedClues.map((clue, index) => {
              const text = describeClue(clue, task.candidates);
              return (
                <li key={`${clue.kind}-${index}`} style={clueRow} data-clue-index={index}>
                  <span aria-hidden="true" style={{ fontSize: 20 }}>🔦</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{text}</span>
                  <button
                    onClick={() => speak(text)}
                    aria-label={`Hear clue ${index + 1}`}
                    style={speakButton}
                  >
                    🔊
                  </button>
                </li>
              );
            })}
          </ul>

          {moreClues ? (
            <button onClick={revealNext} data-testid="deduce-more-clues" style={secondary}>
              Ask for another clue ({task.clues.length - revealed} left)
            </button>
          ) : (
            <p style={allCluesNote}>That's every clue.</p>
          )}

          <div style={grid} data-testid="deduce-candidates">
            {task.candidates.map((candidate) => {
              const out = ruledOut.includes(candidate.id);
              return (
                <button
                  key={candidate.id}
                  data-candidate-id={candidate.id}
                  data-ruled-out={out ? "true" : "false"}
                  aria-pressed={out}
                  aria-label={
                    out
                      ? `${candidate.label}, crossed out. Tap to bring back.`
                      : `${candidate.label}, still possible. Tap to cross out.`
                  }
                  onClick={() => toggleCard(candidate)}
                  disabled={solved}
                  style={{
                    ...candidateCard,
                    borderColor: out ? "#3a4a3f" : ACCENT,
                    opacity: out ? 0.45 : 1,
                  }}
                >
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{candidate.emoji}</span>
                  <span style={candidateLabel}>{candidate.label}</span>
                  {/* State is never colour alone: crossed-out cards say so. */}
                  <span style={candidateState}>{out ? "✕ ruled out" : "could be"}</span>
                </button>
              );
            })}
          </div>

          <div style={actions}>
            <button
              onClick={claim}
              data-testid="deduce-claim"
              disabled={!canClaim}
              style={{ ...primary, background: ACCENT, opacity: canClaim ? 1 : 0.45 }}
            >
              {standing.length === 1 ? "That's the one!" : `${standing.length} could still be it`}
            </button>
          </div>

          <div role="status" style={teaching}>
            <strong>{misses === 0 ? "HOLLOW GUIDE" : "HELPER"}</strong>
            <p style={{ margin: "6px 0 0" }}>{message}</p>
            {solved && (
              <button onClick={advance} data-testid="deduce-advance" style={{ ...primary, background: ACCENT, marginTop: 12 }}>
                {round >= run.length - 1 ? "Finish →" : "Next mystery →"}
              </button>
            )}
          </div>
        </section>
      </main>
    </GameFrame>
  );
}

const loading: React.CSSProperties = { minHeight: 500, display: "grid", placeItems: "center", background: "#0f1512", color: "#fff", fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 80px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "rgba(16,24,20,.94)", border: "1px solid rgba(255,255,255,.14)" };
const big: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.6rem,8vw,5.4rem)", lineHeight: 0.92, letterSpacing: "-.05em" };
const lead: React.CSSProperties = { maxWidth: 680, margin: "12px auto 22px", color: "#c4d8cc", lineHeight: 1.6, fontWeight: 700 };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", margin: "20px 0" };
const primary: React.CSSProperties = { minHeight: 58, padding: "14px 22px", border: 0, borderRadius: 999, color: "#0f1512", fontWeight: 950, cursor: "pointer", fontSize: 16 };
const secondary: React.CSSProperties = { minHeight: 52, padding: "12px 20px", borderRadius: 999, background: "#1c2620", color: "#fff", border: "1px solid rgba(255,255,255,.16)", fontWeight: 900, cursor: "pointer" };
const hud: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto 10px", display: "flex", justifyContent: "space-between", padding: 14, borderRadius: 20, background: "rgba(16,24,20,.94)", fontWeight: 900 };
const track: React.CSSProperties = { width: "min(900px,100%)", height: 12, margin: "0 auto 12px", borderRadius: 999, background: "#1c2620", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", transition: "width .3s ease" };
const cardStyle: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(20px,5vw,40px)", borderRadius: 30, background: "rgba(16,24,20,.96)", textAlign: "center", border: "1px solid rgba(255,255,255,.14)" };
const promptStyle: React.CSSProperties = { margin: "4px auto 14px", fontSize: "clamp(1.5rem,4.5vw,2.4rem)", lineHeight: 1.1 };
const clueList: React.CSSProperties = { listStyle: "none", padding: 0, margin: "0 auto 14px", display: "grid", gap: 8, maxWidth: 560 };
const clueRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, background: "#141d18", border: "1px solid rgba(156,255,136,.25)", fontWeight: 800, fontSize: "clamp(1rem,3vw,1.25rem)" };
const speakButton: React.CSSProperties = { minWidth: 44, minHeight: 44, borderRadius: 12, background: "#1c2620", border: "1px solid rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", fontSize: 18 };
const allCluesNote: React.CSSProperties = { color: "#8aa294", fontWeight: 800, margin: "0 0 6px" };
const grid: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, margin: "18px 0 6px" };
const candidateCard: React.CSSProperties = { minWidth: 104, minHeight: 108, padding: "12px 14px", borderRadius: 20, border: "3px solid", background: "#141d18", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", gap: 4 };
const candidateLabel: React.CSSProperties = { fontSize: "clamp(1.1rem,3.5vw,1.6rem)", fontWeight: 950 };
const candidateState: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: ".06em", color: "#9fb3a6", textTransform: "uppercase" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 14 };
const teaching: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 20, background: "#0d1512", color: "#c4d8cc" };
