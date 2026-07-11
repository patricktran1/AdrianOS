"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useMemo, useState } from "react";

const QUESTIONS = [
  { prompt: "Which coins make 10¢?", answer: "Two nickels", choices: ["Two nickels", "One penny", "Three quarters", "One dime and one nickel"] },
  { prompt: "You have $5 and spend $2. How much is left?", answer: "$3", choices: ["$2", "$3", "$5", "$7"] },
  { prompt: "Which is worth more?", answer: "One quarter", choices: ["One nickel", "One dime", "One quarter", "Five pennies"] },
  { prompt: "A toy costs $7. You pay with $10. What is your change?", answer: "$3", choices: ["$1", "$2", "$3", "$4"] },
  { prompt: "How many quarters make $1?", answer: "4", choices: ["2", "3", "4", "5"] },
  { prompt: "You save $2 each week for 3 weeks. How much do you save?", answer: "$6", choices: ["$5", "$6", "$8", "$9"] },
  { prompt: "Which costs less?", answer: "$4 book", choices: ["$4 book", "$6 game", "$8 ball", "$10 puzzle"] },
  { prompt: "You have three $1 bills and two quarters. How much total?", answer: "$3.50", choices: ["$2.50", "$3.25", "$3.50", "$5.00"] },
];

export default function MoneyMathPage() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const current = QUESTIONS[index];
  const choices = useMemo(() => [...current.choices].sort(() => Math.random() - 0.5), [current]);

  function choose(value: string) {
    if (choice) return;
    setChoice(value);
    if (value === current.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index === QUESTIONS.length - 1) return setFinished(true);
    setIndex((i) => i + 1);
    setChoice(null);
  }

  if (finished) {
    return <GameFrame title="Money Math"><section style={finish}><div style={{fontSize:72}}>💰</div><h1 style={finishTitle}>Money Mission Complete</h1><p style={muted}>Score: {score} out of {QUESTIONS.length}</p><Link href="/" style={home}>Go Home</Link></section></GameFrame>;
  }

  return <GameFrame title="Money Math"><main style={wrap}>
    <div style={stats}><span>Question {index + 1} of {QUESTIONS.length}</span><span>Score {score}</span></div>
    <section style={card}>
      <div style={{fontSize:72}}>🪙</div>
      <span style={eyebrow}>MONEY MATH</span>
      <h1 style={title}>{current.prompt}</h1>
      <div style={grid}>{choices.map((item) => {
        const correct = choice && item === current.answer;
        const wrong = choice === item && item !== current.answer;
        return <button key={item} onClick={() => choose(item)} style={{...answer, background: correct ? "#d9ff5b" : wrong ? "#ffb5bf" : "#222936", color: correct || wrong ? "#10131b" : "#fff"}}>{item}</button>;
      })}</div>
      {choice && <div style={feedback}><strong>{choice === current.answer ? "Correct." : `The answer is ${current.answer}.`}</strong><button style={primary} onClick={next}>{index === QUESTIONS.length - 1 ? "See results" : "Next question"}</button></div>}
    </section>
  </main></GameFrame>;
}

const wrap: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "space-between", color: "#aab1bf", fontWeight: 800, marginBottom: 14 };
const card: React.CSSProperties = { padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const title: React.CSSProperties = { fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1, letterSpacing: "-.055em", margin: "14px 0 28px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 };
const answer: React.CSSProperties = { minHeight: 82, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", fontSize: 18, fontWeight: 900, cursor: "pointer" };
const primary: React.CSSProperties = { padding: "12px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const feedback: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 };
const finish: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(3rem,8vw,5.5rem)", letterSpacing: "-.06em", margin: "14px 0" };
const muted: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const home: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" };
