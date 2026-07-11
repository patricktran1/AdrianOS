"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useMemo, useState } from "react";

const PLACES = [
  { clue: "This country is shaped like a boot.", answer: "Italy", choices: ["Italy", "Japan", "Brazil", "Egypt"], emoji: "🍕" },
  { clue: "The pyramids of Giza are here.", answer: "Egypt", choices: ["Mexico", "Egypt", "India", "Peru"], emoji: "🔺" },
  { clue: "This country is home to kangaroos.", answer: "Australia", choices: ["Canada", "Kenya", "Australia", "Spain"], emoji: "🦘" },
  { clue: "Mount Fuji is in this country.", answer: "Japan", choices: ["China", "Japan", "Chile", "France"], emoji: "🗻" },
  { clue: "The Amazon rainforest covers much of this country.", answer: "Brazil", choices: ["Brazil", "Norway", "Thailand", "Greece"], emoji: "🌳" },
  { clue: "The Eiffel Tower is in this country.", answer: "France", choices: ["France", "Germany", "Belgium", "Portugal"], emoji: "🗼" },
  { clue: "This country has a maple leaf on its flag.", answer: "Canada", choices: ["Canada", "Austria", "Ireland", "Sweden"], emoji: "🍁" },
  { clue: "The Taj Mahal is in this country.", answer: "India", choices: ["India", "Nepal", "Turkey", "Morocco"], emoji: "🕌" },
];

export default function WorldExplorerPage() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const current = PLACES[index];
  const choices = useMemo(() => [...current.choices].sort(() => Math.random() - 0.5), [current]);

  function choose(value: string) {
    if (choice !== null) return;
    setChoice(value);
    if (value === current.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index === PLACES.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setChoice(null);
  }

  if (finished) {
    return (
      <GameFrame title="World Explorer">
        <section style={finishCard}>
          <div style={{ fontSize: 64 }}>🌍</div>
          <h1 style={finishTitle}>World Tour Complete</h1>
          <p style={finishText}>Score: {score} out of {PLACES.length}</p>
          <Link href="/" style={homeButton}>Go Home</Link>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="World Explorer">
      <div style={{ width: "min(820px,100%)", margin: "0 auto" }}>
        <div style={statsRow}>
          <span>Stop {index + 1} of {PLACES.length}</span>
          <span>Score {score}</span>
        </div>

        <section style={card}>
          <div style={{ fontSize: 76 }}>{current.emoji}</div>
          <span style={eyebrow}>WORLD EXPLORER</span>
          <h1 style={questionTitle}>{current.clue}</h1>

          <div style={answerStack}>
            {choices.map((item) => {
              const isCorrect = choice !== null && item === current.answer;
              const isWrong = choice === item && item !== current.answer;
              return (
                <button
                  key={item}
                  onClick={() => choose(item)}
                  style={{
                    ...answerButton,
                    background: isCorrect ? "#d9ff5b" : isWrong ? "#ffb5bf" : "#222936",
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
              <strong>{choice === current.answer ? "Correct." : `The answer is ${current.answer}.`}</strong>
              <button style={primaryButton} onClick={next}>
                {index === PLACES.length - 1 ? "See results" : "Next stop"}
              </button>
            </div>
          )}
        </section>
      </div>
    </GameFrame>
  );
}

const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const card: React.CSSProperties = { padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const questionTitle: React.CSSProperties = { fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1, letterSpacing: "-.055em", margin: "12px 0 28px" };
const answerStack: React.CSSProperties = { display: "grid", gap: 10 };
const answerButton: React.CSSProperties = { minHeight: 64, borderRadius: 18, border: "1px solid rgba(255,255,255,.13)", fontSize: 18, fontWeight: 900, cursor: "pointer" };
const feedback: React.CSSProperties = { marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 999, padding: "12px 18px", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const finishCard: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .95, letterSpacing: "-.06em", margin: "14px 0" };
const finishText: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const homeButton: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" };
