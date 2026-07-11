"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useMemo, useState } from "react";

const PATTERNS = [
  { sequence: ["🔵", "🟡", "🔵", "🟡"], answer: "🔵", choices: ["🔵", "🟢", "🟡", "🟣"] },
  { sequence: ["⭐", "⭐", "🌙", "⭐", "⭐"], answer: "🌙", choices: ["☀️", "⭐", "🌙", "⚡"] },
  { sequence: ["1", "2", "3", "1", "2"], answer: "3", choices: ["2", "4", "1", "3"] },
  { sequence: ["🟥", "🟧", "🟨", "🟥", "🟧"], answer: "🟨", choices: ["🟩", "🟥", "🟨", "🟧"] },
  { sequence: ["🐶", "🐱", "🐱", "🐶", "🐱"], answer: "🐱", choices: ["🐭", "🐶", "🐱", "🐰"] },
  { sequence: ["2", "4", "6", "8"], answer: "10", choices: ["9", "10", "12", "8"] },
  { sequence: ["A", "C", "E", "G"], answer: "I", choices: ["H", "I", "J", "K"] },
  { sequence: ["🔺", "🔺", "⬛", "🔺", "🔺"], answer: "⬛", choices: ["⬜", "🔺", "⬛", "🔵"] },
];

export default function PatternMasterPage() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const current = PATTERNS[index];
  const shuffledChoices = useMemo(
    () => [...current.choices].sort(() => Math.random() - 0.5),
    [current]
  );

  function choose(value: string) {
    if (choice !== null) return;
    setChoice(value);
    if (value === current.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index === PATTERNS.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setChoice(null);
  }

  if (finished) {
    return (
      <GameFrame title="Pattern Master">
        <section style={finishCard}>
          <div style={{ fontSize: 64 }}>🧩</div>
          <h1 style={finishTitle}>Pattern Master Complete</h1>
          <p style={finishText}>Score: {score} out of {PATTERNS.length}</p>
          <Link href="/" style={homeButton}>Go Home</Link>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Pattern Master">
      <div style={wrap}>
        <div style={statsRow}>
          <span>Pattern {index + 1} of {PATTERNS.length}</span>
          <span>Score {score}</span>
        </div>

        <section style={card}>
          <span style={eyebrow}>WHAT COMES NEXT?</span>
          <div style={sequenceRow}>
            {current.sequence.map((item, i) => (
              <div key={i} style={sequenceTile}>{item}</div>
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
              <strong>{choice === current.answer ? "Correct." : "Good try."}</strong>
              <button style={primaryButton} onClick={next}>
                {index === PATTERNS.length - 1 ? "See results" : "Next pattern"}
              </button>
            </div>
          )}
        </section>
      </div>
    </GameFrame>
  );
}

const wrap: React.CSSProperties = { width: "min(840px, 100%)", margin: "0 auto" };
const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const card: React.CSSProperties = { padding: "clamp(24px, 5vw, 48px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const sequenceRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, margin: "28px 0" };
const sequenceTile: React.CSSProperties = { width: 72, height: 72, display: "grid", placeItems: "center", borderRadius: 18, background: "#222936", border: "2px solid rgba(255,255,255,.15)", fontSize: 34, fontWeight: 950 };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 };
const choiceButton: React.CSSProperties = { minHeight: 86, borderRadius: 20, border: "1px solid rgba(255,255,255,.15)", fontSize: 34, fontWeight: 950, cursor: "pointer" };
const feedback: React.CSSProperties = { marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 999, padding: "12px 18px", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const finishCard: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .95, letterSpacing: "-.06em", margin: "14px 0" };
const finishText: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const homeButton: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" };
