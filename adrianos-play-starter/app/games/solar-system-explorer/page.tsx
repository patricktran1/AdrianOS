"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useEffect, useMemo, useRef, useState } from "react";

const GAME_SLUG = "solar-system-explorer";
const QUESTIONS = [
  { prompt: "Which planet is closest to the Sun?", answer: "Mercury", choices: ["Mercury", "Venus", "Earth", "Mars"], emoji: "☀️" },
  { prompt: "Which planet do we live on?", answer: "Earth", choices: ["Mars", "Earth", "Jupiter", "Neptune"], emoji: "🌍" },
  { prompt: "Which planet is famous for its rings?", answer: "Saturn", choices: ["Saturn", "Mercury", "Earth", "Mars"], emoji: "🪐" },
  { prompt: "Which planet is the largest?", answer: "Jupiter", choices: ["Venus", "Mars", "Jupiter", "Uranus"], emoji: "🔭" },
  { prompt: "Which planet is called the Red Planet?", answer: "Mars", choices: ["Mars", "Neptune", "Saturn", "Venus"], emoji: "🔴" },
  { prompt: "What travels around Earth?", answer: "The Moon", choices: ["The Sun", "The Moon", "Mars", "Jupiter"], emoji: "🌙" },
  { prompt: "What is the Sun?", answer: "A star", choices: ["A planet", "A moon", "A star", "A comet"], emoji: "⭐" },
  { prompt: "Which planet is farthest from the Sun?", answer: "Neptune", choices: ["Earth", "Saturn", "Uranus", "Neptune"], emoji: "🌌" },
];

export default function SolarSystemExplorerPage() {
  const { recordPlay, award } = useAdrianProgress();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const awarded = useRef(false);
  const current = QUESTIONS[index];
  const choices = useMemo(() => [...current.choices].sort(() => Math.random() - 0.5), [current]);

  useEffect(() => { recordPlay(GAME_SLUG); }, [recordPlay]);
  useEffect(() => {
    if (!finished || awarded.current) return;
    awarded.current = true;
    award(GAME_SLUG, { xp: 18 + score * 3, coins: 4 + Math.floor(score / 2), score, completed: true });
  }, [finished, score, award]);

  function choose(value: string) {
    if (choice) return;
    setChoice(value);
    if (value === current.answer) setScore((value) => value + 1);
  }

  function next() {
    if (index === QUESTIONS.length - 1) return setFinished(true);
    setIndex((value) => value + 1);
    setChoice(null);
  }

  function replay() {
    awarded.current = false;
    setIndex(0);
    setScore(0);
    setChoice(null);
    setFinished(false);
    recordPlay(GAME_SLUG);
  }

  if (finished) {
    return <GameFrame title="Solar System Explorer"><section style={finish}><div style={{fontSize:72}}>🚀</div><h1 style={finishTitle}>Mission Complete</h1><p style={muted}>Score: {score} out of {QUESTIONS.length}</p><button onClick={replay} style={home}>Play again</button></section></GameFrame>;
  }

  return <GameFrame title="Solar System Explorer"><main style={wrap}>
    <div style={stats}><span>Mission {index + 1} of {QUESTIONS.length}</span><span>Score {score}</span></div>
    <section style={card}>
      <div style={{fontSize:82}}>{current.emoji}</div>
      <span style={eyebrow}>SPACE MISSION</span>
      <h1 style={title}>{current.prompt}</h1>
      <div style={grid}>{choices.map((item) => {
        const correct = choice && item === current.answer;
        const wrong = choice === item && item !== current.answer;
        return <button key={item} onClick={() => choose(item)} style={{...answer, background: correct ? "#d9ff5b" : wrong ? "#ffb5bf" : "#222936", color: correct || wrong ? "#10131b" : "#fff"}}>{item}</button>;
      })}</div>
      {choice && <div style={feedback}><strong>{choice === current.answer ? "Correct." : `The answer is ${current.answer}.`}</strong><button style={primary} onClick={next}>{index === QUESTIONS.length - 1 ? "See results" : "Next mission"}</button></div>}
    </section>
  </main></GameFrame>;
}

const wrap: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "space-between", color: "#aab1bf", fontWeight: 800, marginBottom: 14 };
const card: React.CSSProperties = { padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "radial-gradient(circle at 50% 0%, rgba(198,184,255,.18), transparent 24rem), #181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const title: React.CSSProperties = { fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1, letterSpacing: "-.055em", margin: "14px 0 28px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 };
const answer: React.CSSProperties = { minHeight: 82, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", fontSize: 18, fontWeight: 900, cursor: "pointer" };
const primary: React.CSSProperties = { padding: "12px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const feedback: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 };
const finish: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(3rem,8vw,5.5rem)", letterSpacing: "-.06em", margin: "14px 0" };
const muted: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const home: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
