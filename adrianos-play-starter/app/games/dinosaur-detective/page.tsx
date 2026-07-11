"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useMemo, useState } from "react";

const DINOSAURS = [
  { name: "Tyrannosaurus rex", emoji: "🦖", clues: ["I was a meat eater.", "I walked on two legs.", "I had huge teeth and tiny arms."] },
  { name: "Triceratops", emoji: "🦕", clues: ["I ate plants.", "I had three horns.", "I had a large bony frill."] },
  { name: "Stegosaurus", emoji: "🦕", clues: ["I ate plants.", "I had plates along my back.", "My tail had spikes."] },
  { name: "Brachiosaurus", emoji: "🦕", clues: ["I ate plants.", "I had a very long neck.", "My front legs were longer than my back legs."] },
  { name: "Velociraptor", emoji: "🦖", clues: ["I was a small meat eater.", "I was fast.", "I had a curved claw on each foot."] },
  { name: "Ankylosaurus", emoji: "🦕", clues: ["I ate plants.", "My body was covered in armor.", "I had a club-shaped tail."] },
];

export default function DinosaurDetectivePage() {
  const [index, setIndex] = useState(0);
  const [clueCount, setClueCount] = useState(1);
  const [choice, setChoice] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = DINOSAURS[index];
  const choices = useMemo(() => [...DINOSAURS].sort(() => Math.random() - 0.5).slice(0, 4), [current]);
  if (!choices.some((d) => d.name === current.name)) choices[0] = current;

  function choose(name: string) {
    if (choice) return;
    setChoice(name);
    if (name === current.name) setScore((s) => s + 1);
  }

  function next() {
    if (index === DINOSAURS.length - 1) return setFinished(true);
    setIndex((i) => i + 1);
    setClueCount(1);
    setChoice(null);
  }

  if (finished) {
    return <GameFrame title="Dinosaur Detective"><section style={finish}><div style={{fontSize:72}}>🦖</div><h1 style={finishTitle}>Case Closed</h1><p style={muted}>Score: {score} out of {DINOSAURS.length}</p><Link href="/" style={home}>Go Home</Link></section></GameFrame>;
  }

  return <GameFrame title="Dinosaur Detective"><main style={wrap}>
    <div style={stats}><span>Case {index + 1} of {DINOSAURS.length}</span><span>Score {score}</span></div>
    <section style={card}>
      <span style={eyebrow}>IDENTIFY THE DINOSAUR</span>
      <div style={{fontSize:88, margin:"18px 0"}}>🦴</div>
      <div style={clueBox}>{current.clues.slice(0, clueCount).map((clue, i) => <p key={i} style={{margin:"8px 0"}}>Clue {i + 1}: {clue}</p>)}</div>
      {clueCount < current.clues.length && !choice && <button style={secondary} onClick={() => setClueCount((n) => n + 1)}>Reveal another clue</button>}
      <div style={grid}>{choices.map((d) => {
        const correct = choice && d.name === current.name;
        const wrong = choice === d.name && d.name !== current.name;
        return <button key={d.name} onClick={() => choose(d.name)} style={{...answer, background: correct ? "#d9ff5b" : wrong ? "#ffb5bf" : "#222936", color: correct || wrong ? "#10131b" : "#fff"}}><span style={{fontSize:42}}>{d.emoji}</span><strong>{d.name}</strong></button>;
      })}</div>
      {choice && <div style={feedback}><strong>{choice === current.name ? "Correct." : `The dinosaur was ${current.name}.`}</strong><button style={primary} onClick={next}>{index === DINOSAURS.length - 1 ? "See results" : "Next case"}</button></div>}
    </section>
  </main></GameFrame>;
}

const wrap: React.CSSProperties = { width: "min(860px,100%)", margin: "0 auto" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "space-between", color: "#aab1bf", fontWeight: 800, marginBottom: 14 };
const card: React.CSSProperties = { padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const clueBox: React.CSSProperties = { padding: 18, borderRadius: 18, background: "#11161f", marginBottom: 18, textAlign: "left", fontSize: 18, lineHeight: 1.45 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 18 };
const answer: React.CSSProperties = { minHeight: 110, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 16, cursor: "pointer" };
const secondary: React.CSSProperties = { padding: "11px 16px", borderRadius: 999, border: "2px solid #fff", background: "#fff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const primary: React.CSSProperties = { padding: "12px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const feedback: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 };
const finish: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(3rem,8vw,5.5rem)", letterSpacing: "-.06em", margin: "14px 0" };
const muted: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const home: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" };
