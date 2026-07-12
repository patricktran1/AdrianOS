"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { seededShuffle } from "@/lib/deterministic-random";
import { getActiveProfile } from "@/lib/adrian-profiles";
import {
  getDueReviewItems,
  recordLearningAttempt,
} from "@/lib/adrian-learning";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type PatternSkill = "logic-patterns" | "logic-multi-step";
type PatternCard = {
  id: string;
  sequence: string[];
  answer: string;
  choices: string[];
  explanation: string;
  level: 1 | 2 | 3;
  skillId: PatternSkill;
};

const GAME_SLUG = "pattern-master";
const SESSION_LENGTH = 8;

const PATTERNS: PatternCard[] = [
  { id: "color-ab", sequence: ["🔵", "🟡", "🔵", "🟡"], answer: "🔵", choices: ["🔵", "🟢", "🟡", "🟣"], explanation: "The colors alternate blue, yellow, blue, yellow.", level: 1, skillId: "logic-patterns" },
  { id: "star-star-moon", sequence: ["⭐", "⭐", "🌙", "⭐", "⭐"], answer: "🌙", choices: ["☀️", "⭐", "🌙", "⚡"], explanation: "The repeating group is star, star, moon.", level: 1, skillId: "logic-patterns" },
  { id: "123", sequence: ["1", "2", "3", "1", "2"], answer: "3", choices: ["2", "4", "1", "3"], explanation: "The group 1, 2, 3 repeats.", level: 1, skillId: "logic-patterns" },
  { id: "rainbow-three", sequence: ["🟥", "🟧", "🟨", "🟥", "🟧"], answer: "🟨", choices: ["🟩", "🟥", "🟨", "🟧"], explanation: "Red, orange, yellow repeats.", level: 1, skillId: "logic-patterns" },
  { id: "dog-cat-cat", sequence: ["🐶", "🐱", "🐱", "🐶", "🐱"], answer: "🐱", choices: ["🐭", "🐶", "🐱", "🐰"], explanation: "The repeating group is dog, cat, cat.", level: 1, skillId: "logic-patterns" },
  { id: "shape-pair", sequence: ["🔺", "🔺", "⬛", "🔺", "🔺"], answer: "⬛", choices: ["⬜", "🔺", "⬛", "🔵"], explanation: "Two triangles are followed by one square.", level: 1, skillId: "logic-patterns" },
  { id: "fruit-ab", sequence: ["🍎", "🍌", "🍎", "🍌", "🍎"], answer: "🍌", choices: ["🍎", "🍌", "🍓", "🍊"], explanation: "Apple and banana alternate.", level: 1, skillId: "logic-patterns" },
  { id: "music-aab", sequence: ["🎵", "🎵", "🥁", "🎵", "🎵"], answer: "🥁", choices: ["🎸", "🎵", "🥁", "🎹"], explanation: "Two notes are followed by one drum.", level: 1, skillId: "logic-patterns" },

  { id: "evens", sequence: ["2", "4", "6", "8"], answer: "10", choices: ["9", "10", "12", "8"], explanation: "Each number increases by 2.", level: 2, skillId: "logic-patterns" },
  { id: "odds", sequence: ["1", "3", "5", "7"], answer: "9", choices: ["8", "9", "10", "11"], explanation: "Each number increases by 2, making the odd numbers.", level: 2, skillId: "logic-patterns" },
  { id: "fives", sequence: ["5", "10", "15", "20"], answer: "25", choices: ["21", "24", "25", "30"], explanation: "Each number increases by 5.", level: 2, skillId: "logic-patterns" },
  { id: "count-down", sequence: ["12", "10", "8", "6"], answer: "4", choices: ["2", "4", "5", "8"], explanation: "Each number decreases by 2.", level: 2, skillId: "logic-patterns" },
  { id: "letters-skip-one", sequence: ["A", "C", "E", "G"], answer: "I", choices: ["H", "I", "J", "K"], explanation: "The sequence skips one letter each time.", level: 2, skillId: "logic-patterns" },
  { id: "letters-back", sequence: ["J", "H", "F", "D"], answer: "B", choices: ["A", "B", "C", "E"], explanation: "The letters move backward by two places.", level: 2, skillId: "logic-patterns" },
  { id: "growing-block", sequence: ["●", "●●", "●●●", "●●●●"], answer: "●●●●●", choices: ["●●", "●●●", "●●●●●", "●●●●●●"], explanation: "One dot is added each time.", level: 2, skillId: "logic-patterns" },
  { id: "double", sequence: ["1", "2", "4", "8"], answer: "16", choices: ["10", "12", "16", "18"], explanation: "Each number is doubled.", level: 2, skillId: "logic-multi-step" },

  { id: "plus-one-plus-two", sequence: ["1", "2", "4", "5", "7"], answer: "8", choices: ["8", "9", "10", "12"], explanation: "The rule alternates plus 1, then plus 2.", level: 3, skillId: "logic-multi-step" },
  { id: "plus-two-plus-three", sequence: ["2", "4", "7", "9", "12"], answer: "14", choices: ["13", "14", "15", "16"], explanation: "The rule alternates plus 2, then plus 3.", level: 3, skillId: "logic-multi-step" },
  { id: "square-numbers", sequence: ["1", "4", "9", "16"], answer: "25", choices: ["20", "24", "25", "32"], explanation: "These are 1×1, 2×2, 3×3, 4×4, then 5×5.", level: 3, skillId: "logic-multi-step" },
  { id: "add-growing", sequence: ["1", "2", "4", "7", "11"], answer: "16", choices: ["14", "15", "16", "17"], explanation: "Add 1, then 2, then 3, then 4, then 5.", level: 3, skillId: "logic-multi-step" },
  { id: "two-rules", sequence: ["3", "6", "5", "10", "9"], answer: "18", choices: ["12", "16", "18", "20"], explanation: "Multiply by 2, then subtract 1, and repeat.", level: 3, skillId: "logic-multi-step" },
  { id: "letters-growing-jump", sequence: ["A", "B", "D", "G"], answer: "K", choices: ["I", "J", "K", "L"], explanation: "Move forward 1 letter, then 2, then 3, then 4.", level: 3, skillId: "logic-multi-step" },
  { id: "emoji-nested", sequence: ["🌱", "🌱🌱", "🌳", "🌱", "🌱🌱"], answer: "🌳", choices: ["🌱", "🌳", "🌲", "🌻"], explanation: "The group is one sprout, two sprouts, then one tree.", level: 3, skillId: "logic-multi-step" },
  { id: "alternating-shapes-count", sequence: ["🔵", "🔺🔺", "🔵🔵🔵", "🔺🔺🔺🔺"], answer: "🔵🔵🔵🔵🔵", choices: ["🔺🔺🔺🔺🔺", "🔵🔵🔵🔵", "🔵🔵🔵🔵🔵", "🔺🔺🔺"], explanation: "The color alternates while the number of shapes increases by one.", level: 3, skillId: "logic-multi-step" },
];

function makeSession(reviewIds: string[] = [], seed = "initial"): PatternCard[] {
  if (reviewIds.length > 0) {
    const review = reviewIds
      .map((id) => PATTERNS.find((pattern) => pattern.id === id))
      .filter((pattern): pattern is PatternCard => Boolean(pattern));
    if (review.length > 0) return review.slice(0, SESSION_LENGTH);
  }

  const foundation = seededShuffle(PATTERNS.filter((pattern) => pattern.level === 1), `${seed}:foundation`).slice(0, 3);
  const developing = seededShuffle(PATTERNS.filter((pattern) => pattern.level === 2), `${seed}:developing`).slice(0, 3);
  const challenge = seededShuffle(PATTERNS.filter((pattern) => pattern.level === 3), `${seed}:challenge`).slice(0, 2);
  return seededShuffle([...foundation, ...developing, ...challenge], `${seed}:session`);
}

export default function PatternMasterPage() {
  const { progress, recordPlay, award } = useAdrianProgress();
  const profileId = getActiveProfile().id;
  const dueReviews = getDueReviewItems(profileId, GAME_SLUG);
  const autoStarted = useRef(false);

  const [session, setSession] = useState<PatternCard[]>(() => makeSession([], "initial"));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const current = session[index];
  const bestScore = progress.games[GAME_SLUG]?.bestScore ?? 0;
  const shuffledChoices = useMemo(
    () => current ? seededShuffle(current.choices, `${current.id}:choices`) : [],
    [current]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      startSession(true);
      return;
    }
    recordPlay(GAME_SLUG);
  }, []);

  function startSession(useReview = false) {
    const ids = useReview
      ? getDueReviewItems(profileId, GAME_SLUG)
          .map((item) => typeof item.data?.patternId === "string" ? item.data.patternId : "")
          .filter(Boolean)
      : [];
    const seed = useReview ? `review:${ids.join(":")}` : `round:${Date.now()}`;
    setSession(makeSession(ids, seed));
    setIndex(0);
    setScore(0);
    setChoice(null);
    setFinished(false);
    setReviewMode(useReview && ids.length > 0);
    recordPlay(GAME_SLUG);
  }

  function choose(value: string) {
    if (choice !== null || !current) return;
    setChoice(value);
    const correct = value === current.answer;
    if (correct) setScore((valueNow) => valueNow + current.level * 10);

    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: "Logic",
      skillId: current.skillId,
      skillLabel: current.skillId === "logic-multi-step" ? "Multi-step reasoning" : "Recognizing patterns",
      prompt: `${current.sequence.join(" ")} → ?`,
      correctAnswer: current.answer,
      correct,
      review: reviewMode,
      data: { patternId: current.id, level: current.level },
    }, profileId);
  }

  function next() {
    if (index < session.length - 1) {
      setIndex((value) => value + 1);
      setChoice(null);
      return;
    }

    const maxScore = session.reduce((sum, pattern) => sum + pattern.level * 10, 0);
    const accuracy = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    award(GAME_SLUG, {
      xp: reviewMode ? 12 + Math.round(score / 5) : 30 + Math.round(score / 3),
      coins: reviewMode ? 2 : 4 + Math.floor(score / 35),
      score: accuracy,
      completed: !reviewMode,
    });
    setFinished(true);
  }

  if (finished) {
    const maxScore = session.reduce((sum, pattern) => sum + pattern.level * 10, 0);
    const accuracy = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return (
      <GameFrame title="Pattern Master">
        <section style={finishCard}>
          <div style={{ fontSize: 64 }}>{accuracy >= 80 ? "🧩🏆" : "🧩"}</div>
          <span style={eyebrow}>{reviewMode ? "REVIEW COMPLETE" : "LOGIC MISSION COMPLETE"}</span>
          <h1 style={finishTitle}>{accuracy}% accuracy</h1>
          <p style={finishText}>You solved {session.length} randomized patterns and earned learning evidence for the Skill Graph.</p>
          <div style={actionRow}>
            <button onClick={() => startSession(reviewMode)} style={primaryButton}>Play Another Round</button>
            {dueReviews.length > 0 && !reviewMode && <button onClick={() => startSession(true)} style={secondaryButton}>Review Due Patterns</button>}
            <Link href="/" style={homeButton}>Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Pattern Master">
      <div style={wrap}>
        <div style={statsRow}>
          <span>{reviewMode ? "Spaced Review" : `Pattern ${index + 1} of ${session.length}`}</span>
          <span>Level {current.level}</span>
          <span>Score {score} · Best {bestScore}</span>
        </div>

        <section style={card}>
          <span style={eyebrow}>{current.skillId === "logic-multi-step" ? "MULTI-STEP LOGIC" : "WHAT COMES NEXT?"}</span>
          <div style={sequenceRow}>
            {current.sequence.map((item, itemIndex) => (
              <div key={`${item}-${itemIndex}`} style={sequenceTile}>{item}</div>
            ))}
            <div style={{ ...sequenceTile, borderStyle: "dashed" }}>?</div>
          </div>

          <div style={choiceGrid}>
            {shuffledChoices.map((item) => {
              const isCorrect = choice !== null && item === current.answer;
              const isWrong = choice === item && item !== current.answer;
              return (
                <button
                  key={item}
                  onClick={() => choose(item)}
                  style={{
                    ...choiceButton,
                    background: isCorrect ? "#d9ff5b" : isWrong ? "#ffb5bf" : "#2b3444",
                    color: isCorrect || isWrong ? "#10131b" : "#fff",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {choice !== null && (
            <div style={feedback}>
              <div style={{ textAlign: "left" }}>
                <strong>{choice === current.answer ? "Correct." : `The answer is ${current.answer}.`}</strong>
                <p style={explanation}>{current.explanation}</p>
              </div>
              <button style={primaryButton} onClick={next}>
                {index === session.length - 1 ? "See results" : "Next pattern"}
              </button>
            </div>
          )}
        </section>
      </div>
    </GameFrame>
  );
}

const wrap: React.CSSProperties = { width: "min(840px, 100%)", margin: "0 auto" };
const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const card: React.CSSProperties = { padding: "clamp(24px, 5vw, 48px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const sequenceRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, margin: "28px 0" };
const sequenceTile: React.CSSProperties = { minWidth: 68, minHeight: 68, padding: "8px 10px", display: "grid", placeItems: "center", borderRadius: 18, background: "#222936", border: "2px solid rgba(255,255,255,.15)", fontSize: "clamp(1.35rem,4vw,2.15rem)", fontWeight: 950 };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 };
const choiceButton: React.CSSProperties = { minHeight: 86, borderRadius: 20, border: "1px solid rgba(255,255,255,.15)", fontSize: "clamp(1.3rem,4vw,2.1rem)", fontWeight: 950, cursor: "pointer" };
const feedback: React.CSSProperties = { marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" };
const explanation: React.CSSProperties = { color: "#aab1bf", margin: "6px 0 0", lineHeight: 1.45 };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 20 };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 999, padding: "12px 18px", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid rgba(255,255,255,.2)", borderRadius: 999, padding: "12px 18px", background: "#c6b8ff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const finishCard: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .95, letterSpacing: "-.06em", margin: "14px 0" };
const finishText: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26, lineHeight: 1.5 };
const homeButton: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#fff", color: "#10131b", fontWeight: 950, textDecoration: "none" };
