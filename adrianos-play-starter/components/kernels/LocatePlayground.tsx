"use client";

/**
 * Spyglass Bay — the LOCATE surface.
 *
 * The design problem this solves: a comprehension question with three options
 * has a one-in-three floor, and the child who read the sentence and the child
 * who shrugged leave the same row behind. Reading Lab already tells a child
 * "use the passage as evidence" — and has no way to see whether they did.
 *
 * So here, going back to the text *is* the interaction:
 *
 *   1. The passage is on screen, one tappable sentence at a time.
 *   2. The child marks the sentence that tells them the answer.
 *   3. Only then can they answer.
 *
 * Two consequences fall out of that, and they are the point of the mission:
 *
 * - Answering is impossible with nothing marked, so "just pick one" is not a
 *   route through.
 * - Marking is compared against the sentences that actually make the answer
 *   knowable. A child who marks the whole passage has hit the right sentence
 *   and shown nothing, and the evidence keeps that apart from finding it.
 *
 * Nothing here scolds. A mark can be taken back, the passage never hides, and
 * the guide never mentions guessing.
 */

import GameFrame from "@/components/GameFrame";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { markQuestionShown } from "@/lib/adrian-evidence";
import { useGameSession } from "@/lib/game-session";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import {
  buildLocateRun,
  LOCATE_RUN_LENGTH,
  type LocateTask,
} from "@/lib/kernels/locate-tasks";
import {
  isSupportedAnswer,
  locateErrorSignature,
  markingBudget,
  type LocateTrace,
} from "@/lib/learning/locate-evidence";
import { useEffect, useMemo, useRef, useState } from "react";

const GAME_SLUG = "spyglass-bay";
const ACCENT = "#7fd7ff";

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

export default function LocatePlayground() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);

  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [route, setRoute] = useState<{ skillId: string | null; from: string | null } | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);

  // Per-round state.
  const [marked, setMarked] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState("");
  const [sparks, setSparks] = useState(0);

  // Marks taken back. Written from handlers, never a reason to re-render.
  const unmarked = useRef(0);
  const answerGuard = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    setGrade(readProfileGrade(activeProfile));
    const params = new URLSearchParams(window.location.search);
    setRoute({ skillId: params.get("skill"), from: params.get("from") });
  }, [activeProfile, hydrated]);

  const run = useMemo(() => {
    if (grade === null || route === null) return null;
    return buildLocateRun({
      profileId: activeProfile.id,
      grade,
      skillId: route.skillId,
      dayKey: localDateKey(),
    });
  }, [activeProfile.id, grade, route]);

  const task: LocateTask | null = run?.[round] ?? null;

  useEffect(() => {
    if (!started || finished || !task) return;
    markQuestionShown(GAME_SLUG);
    setMarked([]);
    setChosen(null);
    setMisses(0);
    setSolved(false);
    unmarked.current = 0;
    answerGuard.current = false;
    setMessage("Read the story. Tap the part that tells you.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, round, task?.id]);

  // Answering needs at least one sentence marked. This is what stops
  // "just pick one" being a route to a correct answer.
  const canAnswer = marked.length > 0 && chosen !== null && !solved;

  function toggleSentence(id: string) {
    if (!task || solved) return;
    if (marked.includes(id)) {
      // Taking a mark back is a legitimate correction, not a failure.
      unmarked.current += 1;
      setMarked((value) => value.filter((row) => row !== id));
      setMessage("Unmarked. Which part tells you?");
      return;
    }
    const next = [...marked, id];
    setMarked(next);
    setMessage(
      next.length > markingBudget(task)
        ? "That's most of the story. Which one part tells you?"
        : "Marked. Now choose your answer."
    );
  }

  function answer() {
    if (!task || !canAnswer || answerGuard.current || chosen === null) return;
    answerGuard.current = true;
    const correct = chosen === task.answerId;
    const trace: LocateTrace = { markedIds: marked, unmarked: unmarked.current };
    const chosenText = task.options.find((row) => row.id === chosen)?.text ?? "";

    recordLearningAttempt(
      {
        gameSlug: GAME_SLUG,
        subject: task.subject,
        skillId: task.skillId,
        skillLabel: task.skillLabel,
        prompt: `${task.title}: ${task.prompt}`,
        correctAnswer: task.options.find((row) => row.id === task.answerId)?.text ?? "",
        correct,
        givenAnswer: chosenText,
        hintsUsed: Math.min(misses, 2),
        wrongAttempts: misses,
        mechanic: "locate",
        // The distinction the verb exists for: read out of the passage, or
        // arrived at without it.
        reasoned: isSupportedAnswer({ correct, task, trace }),
        taskId: task.id,
        errorSignature: locateErrorSignature({ task, correct, trace }),
        data: {
          standardCode: task.standardCode,
          kernelVerb: "locate",
          arrivedFrom: route?.from ?? "",
          storyId: task.storyId,
          // How much of the passage was marked against how much the answer
          // rests on. Counts only — never the sentences themselves.
          marked: marked.length,
          supporting: task.supportingIds.length,
          sentences: task.sentences.length,
        },
      },
      activeProfile.id
    );

    if (correct) {
      const clean = isSupportedAnswer({ correct, task, trace });
      setSparks((value) => value + (clean && misses === 0 ? 3 : 1));
      setSolved(true);
      setMessage(
        clean
          ? "Found it — and you showed where it says so."
          : "That's right. Let's look at which part tells you."
      );
    } else if (misses === 0) {
      setMisses(1);
      setChosen(null);
      answerGuard.current = false;
      setMessage(task.hint);
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

  const background = `radial-gradient(circle at top, ${ACCENT}22, #0d1319 55%)`;

  if (!run || !task) {
    return (
      <GameFrame title="Spyglass Bay">
        <main style={loading}>Raising the spyglass…</main>
      </GameFrame>
    );
  }

  if (!started) {
    return (
      <GameFrame title="Spyglass Bay">
        <main style={{ ...page, background }}>
          <section style={hero}>
            <div style={big}>🔭</div>
            <span style={{ ...eyebrow, color: ACCENT }}>SHOWING WHERE IT SAYS SO</span>
            <h1 style={title}>Spyglass Bay</h1>
            <p style={lead}>
              {route?.from === "teaching" || route?.from === "transfer"
                ? `You know ${task.skillLabel.toLowerCase()} — now show where the story says it.`
                : "Read a short story. Tap the part that tells you, then answer."}
            </p>
            <div style={stats}>
              <strong>🔭 {run.length} stories</strong>
              <strong>✋ tap the part</strong>
              <strong>🔊 hear it read</strong>
            </div>
            <button onClick={() => setStarted(true)} style={{ ...primary, background: ACCENT }}>
              Start looking →
            </button>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Spyglass Bay">
        <main style={{ ...page, background }}>
          <section style={hero}>
            <div style={big}>🏆🔭</div>
            <span style={{ ...eyebrow, color: ACCENT }}>EVERY STORY READ</span>
            <h1 style={title}>{activeProfile.name} found them all!</h1>
            <p style={lead}>You showed where each answer came from.</p>
            <div style={stats}><strong>✨ {sparks} sparks</strong></div>
            <button onClick={replay} style={{ ...primary, background: ACCENT }}>
              Another story →
            </button>
          </section>
        </main>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Spyglass Bay">
      <main style={{ ...page, background }}>
        <header style={hud}>
          <strong>🔭 Story {round + 1}/{run.length}</strong>
          <span>✨ {sparks}</span>
        </header>

        <section style={card}>
          <div style={storyHead}>
            <span aria-hidden="true" style={{ fontSize: 24 }}>{task.emoji}</span>
            <h1 style={storyTitle}>{task.title}</h1>
            <button
              onClick={() => speak(task.sentences.map((row) => row.text).join(" "))}
              style={readAloud}
              type="button"
              aria-label="Hear the story read aloud"
            >
              🔊
            </button>
          </div>

          <ul style={passage} data-testid="passage" aria-label="The story">
            {task.sentences.map((sentence) => {
              const isMarked = marked.includes(sentence.id);
              return (
                <li key={sentence.id}>
                  <button
                    type="button"
                    onClick={() => toggleSentence(sentence.id)}
                    data-sentence-id={sentence.id}
                    data-marked={isMarked ? "true" : "false"}
                    aria-pressed={isMarked}
                    disabled={solved}
                    style={{
                      ...sentenceRow,
                      borderColor: isMarked ? ACCENT : "rgba(255,255,255,.14)",
                      background: isMarked ? `${ACCENT}22` : "rgba(255,255,255,.04)",
                    }}
                  >
                    <span aria-hidden="true" style={{ opacity: isMarked ? 1 : 0.35 }}>
                      {isMarked ? "🔎" : "○"}
                    </span>
                    <span style={{ flex: 1, textAlign: "left" }}>{sentence.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <h2 style={question} data-testid="locate-question">{task.prompt}</h2>

          <div style={options}>
            {task.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => !solved && setChosen(option.id)}
                data-option-id={option.id}
                aria-pressed={chosen === option.id}
                disabled={solved}
                style={{
                  ...optionRow,
                  borderColor: chosen === option.id ? ACCENT : "rgba(255,255,255,.14)",
                  background: chosen === option.id ? `${ACCENT}22` : "rgba(255,255,255,.04)",
                }}
              >
                {option.text}
              </button>
            ))}
          </div>

          <p style={guide} aria-live="polite" data-testid="locate-guide">{message}</p>

          {solved ? (
            <button onClick={advance} style={{ ...primary, background: ACCENT }} data-testid="locate-advance">
              {round >= run.length - 1 ? "Finish →" : "Next story →"}
            </button>
          ) : (
            <button
              onClick={answer}
              style={{ ...primary, background: ACCENT, opacity: canAnswer ? 1 : 0.45 }}
              disabled={!canAnswer}
              data-testid="locate-answer"
            >
              {marked.length === 0 ? "Tap the part that tells you" : "Show my answer"}
            </button>
          )}
        </section>
      </main>
    </GameFrame>
  );
}

const loading: React.CSSProperties = {
  minHeight: 500,
  display: "grid",
  placeItems: "center",
  background: "#0d1319",
  color: "#fff",
  fontWeight: 900,
};
const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "18px 16px 28px",
  color: "#f6f5f2",
  display: "grid",
  gap: 14,
  alignContent: "start",
};
const hero: React.CSSProperties = {
  display: "grid",
  gap: 12,
  justifyItems: "center",
  textAlign: "center",
  padding: "26px 18px",
};
const big: React.CSSProperties = { fontSize: 56 };
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: ".14em" };
const title: React.CSSProperties = { fontSize: 30, fontWeight: 900, margin: 0 };
const lead: React.CSSProperties = { fontSize: 15, maxWidth: 460, margin: 0, opacity: 0.9 };
const stats: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", fontSize: 12 };
const primary: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "13px 22px",
  fontWeight: 900,
  fontSize: 15,
  color: "#0d1319",
  cursor: "pointer",
};
const hud: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 900 };
const card: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(13,19,25,.72)",
};
const storyHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const storyTitle: React.CSSProperties = { fontSize: 17, fontWeight: 900, margin: 0, flex: 1 };
const readAloud: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(255,255,255,.06)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 15,
  cursor: "pointer",
  color: "#f6f5f2",
};
const passage: React.CSSProperties = { display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 0 };
const sentenceRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  width: "100%",
  borderRadius: 14,
  border: "1px solid",
  padding: "11px 12px",
  fontSize: 15,
  lineHeight: 1.5,
  color: "#f6f5f2",
  cursor: "pointer",
};
const question: React.CSSProperties = { fontSize: 17, fontWeight: 900, margin: "4px 0 0" };
const options: React.CSSProperties = { display: "grid", gap: 8 };
const optionRow: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid",
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 700,
  color: "#f6f5f2",
  cursor: "pointer",
  textAlign: "left",
};
const guide: React.CSSProperties = { fontSize: 14, margin: 0, minHeight: 20, opacity: 0.92 };
