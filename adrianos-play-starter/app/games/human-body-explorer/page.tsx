"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const GAME_SLUG = "human-body-explorer";
const QUESTIONS = [
  ["Which organ pumps blood around your body?", ["Heart", "Lungs", "Stomach", "Brain"], 0, "The heart is a powerful muscle that pumps blood."],
  ["Which organs help you breathe?", ["Kidneys", "Lungs", "Bones", "Skin"], 1, "Your lungs bring oxygen into your body."],
  ["Which organ helps you think and remember?", ["Brain", "Liver", "Heart", "Bladder"], 0, "Your brain controls thoughts, memory, movement, and senses."],
  ["What protects your brain?", ["Ribs", "Skull", "Muscles", "Hair"], 1, "The skull is a hard helmet made of bone."],
  ["Which body part helps digest food?", ["Stomach", "Elbow", "Ear", "Ankle"], 0, "The stomach mixes food with digestive juices."],
  ["What carries messages between your brain and body?", ["Nerves", "Teeth", "Nails", "Sweat"], 0, "Nerves carry electrical messages throughout your body."],
] as const;

export default function Page() {
  const { recordPlay, award } = useAdrianProgress();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const completionRecorded = useRef(false);
  const current = QUESTIONS[index];

  useEffect(() => {
    recordPlay(GAME_SLUG);
  }, [recordPlay]);

  useEffect(() => {
    if (!done || completionRecorded.current) return;
    completionRecorded.current = true;
    award(GAME_SLUG, { xp: 18 + score * 4, coins: 5, score, completed: true });
  }, [done, score, award]);

  function pick(answerIndex: number) {
    if (choice !== null) return;
    setChoice(answerIndex);
    if (answerIndex === current[2]) setScore((value) => value + 1);
  }

  function next() {
    if (index === QUESTIONS.length - 1) {
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setChoice(null);
  }

  function restart() {
    completionRecorded.current = false;
    setIndex(0);
    setChoice(null);
    setScore(0);
    setDone(false);
    recordPlay(GAME_SLUG);
  }

  return (
    <GameFrame title="Human Body Explorer">
      {done ? (
        <section style={finish}>
          <div style={{ fontSize: 64 }}>🫀</div>
          <h1 style={title}>Body Mission Complete</h1>
          <p style={muted}>Score: {score} out of {QUESTIONS.length}</p>
          <div style={finishActions}>
            <button onClick={restart} style={primary} type="button">Play again</button>
            <Link href="/" style={home}>Go Home</Link>
          </div>
        </section>
      ) : (
        <main style={wrap}>
          <div style={stats}><span>Question {index + 1} of {QUESTIONS.length}</span><span>Score {score}</span></div>
          <section style={card}>
            <div style={{ fontSize: 64 }}>🧠</div>
            <small style={eye}>HUMAN BODY EXPLORER</small>
            <h1 style={question}>{current[0]}</h1>
            <div style={{ display: "grid", gap: 10 }}>
              {current[1].map((answer, answerIndex) => {
                const correct = choice !== null && answerIndex === current[2];
                const wrong = choice === answerIndex && answerIndex !== current[2];
                return (
                  <button
                    key={answer}
                    onClick={() => pick(answerIndex)}
                    style={{ ...answerStyle, background: correct ? "#d9ff5b" : wrong ? "#ffb5bf" : "#222936", color: correct || wrong ? "#10131b" : "#fff" }}
                    type="button"
                  >
                    {answer}
                  </button>
                );
              })}
            </div>
            {choice !== null && (
              <div style={feedback}>
                <strong>{choice === current[2] ? "Correct." : "Good try."}</strong>
                <p style={muted}>{current[3]}</p>
                <button onClick={next} style={primary} type="button">{index === QUESTIONS.length - 1 ? "See results" : "Next question"}</button>
              </div>
            )}
          </section>
        </main>
      )}
    </GameFrame>
  );
}

const wrap: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const card: React.CSSProperties = { padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eye: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, letterSpacing: 2 };
const question: React.CSSProperties = { fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1, letterSpacing: "-.055em", margin: "12px 0 26px" };
const answerStyle: React.CSSProperties = { minHeight: 64, borderRadius: 18, border: "1px solid rgba(255,255,255,.13)", fontSize: 18, fontWeight: 900, cursor: "pointer" };
const feedback: React.CSSProperties = { marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.11)" };
const primary: React.CSSProperties = { border: 0, borderRadius: 999, padding: "12px 18px", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const finish: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", textAlign: "center" };
const title: React.CSSProperties = { fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .95, letterSpacing: "-.06em" };
const finishActions: React.CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 };
const home: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#222936", color: "#fff", fontWeight: 950, textDecoration: "none" };
