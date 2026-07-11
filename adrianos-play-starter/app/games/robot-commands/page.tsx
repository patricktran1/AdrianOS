"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useState } from "react";

type Command = "MOVE" | "TURN LEFT" | "TURN RIGHT";

const LEVELS = [
  { prompt: "Move forward 2 spaces.", answer: ["MOVE", "MOVE"] as Command[] },
  { prompt: "Turn right, then move 1 space.", answer: ["TURN RIGHT", "MOVE"] as Command[] },
  { prompt: "Move 1 space, turn left, then move 1 space.", answer: ["MOVE", "TURN LEFT", "MOVE"] as Command[] },
  { prompt: "Turn left twice.", answer: ["TURN LEFT", "TURN LEFT"] as Command[] },
  { prompt: "Move 2 spaces, turn right, then move 1 space.", answer: ["MOVE", "MOVE", "TURN RIGHT", "MOVE"] as Command[] },
  { prompt: "Turn right, move 2 spaces, then turn left.", answer: ["TURN RIGHT", "MOVE", "MOVE", "TURN LEFT"] as Command[] },
];

export default function RobotCommandsPage() {
  const [index, setIndex] = useState(0);
  const [program, setProgram] = useState<Command[]>([]);
  const [message, setMessage] = useState("Build the command sequence.");
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = LEVELS[index];

  function addCommand(command: Command) {
    setProgram((p) => [...p, command]);
  }

  function undo() {
    setProgram((p) => p.slice(0, -1));
  }

  function reset() {
    setProgram([]);
    setMessage("Build the command sequence.");
  }

  function runProgram() {
    const correct =
      program.length === current.answer.length &&
      program.every((command, i) => command === current.answer[i]);

    if (!correct) {
      setMessage("That program did not reach the goal. Try again.");
      return;
    }

    setScore((s) => s + 1);

    if (index === LEVELS.length - 1) {
      setMessage("Mission complete.");
      window.setTimeout(() => setFinished(true), 600);
      return;
    }

    setMessage("Program successful.");

    window.setTimeout(() => {
      setIndex((i) => i + 1);
      setProgram([]);
      setMessage("Build the command sequence.");
    }, 700);
  }

  if (finished) {
    return (
      <GameFrame title="Robot Commands">
        <section style={finishCard}>
          <div style={{ fontSize: 64 }}>🤖</div>
          <h1 style={finishTitle}>Robot Training Complete</h1>
          <p style={finishText}>You solved all {LEVELS.length} missions.</p>
          <Link href="/" style={homeButton}>Go Home</Link>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Robot Commands">
      <div style={{ width: "min(860px,100%)", margin: "0 auto" }}>
        <div style={statsRow}>
          <span>Mission {index + 1} of {LEVELS.length}</span>
          <span>Score {score}</span>
        </div>

        <section style={card}>
          <span style={eyebrow}>CODE THE ROBOT</span>
          <h1 style={questionTitle}>{current.prompt}</h1>

          <div style={robotStage}>
            <div style={{ fontSize: 84 }}>🤖</div>
            <div style={goalFlag}>🏁</div>
          </div>

          <div style={programBox}>
            {program.length === 0 ? (
              <span style={{ color: "#7f8898" }}>No commands yet</span>
            ) : (
              program.map((command, i) => (
                <div key={`${command}-${i}`} style={programChip}>{command}</div>
              ))
            )}
          </div>

          <div style={commandGrid}>
            <button style={commandButton} onClick={() => addCommand("MOVE")}>MOVE</button>
            <button style={commandButton} onClick={() => addCommand("TURN LEFT")}>TURN LEFT</button>
            <button style={commandButton} onClick={() => addCommand("TURN RIGHT")}>TURN RIGHT</button>
          </div>

          <div style={actionRow}>
            <button style={secondaryButton} onClick={undo}>Undo</button>
            <button style={secondaryButton} onClick={reset}>Reset</button>
            <button style={primaryButton} onClick={runProgram}>Run Program</button>
          </div>

          <p style={messageStyle}>{message}</p>
        </section>
      </div>
    </GameFrame>
  );
}

const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const card: React.CSSProperties = { padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const questionTitle: React.CSSProperties = { fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1, letterSpacing: "-.055em", margin: "12px 0 22px" };
const robotStage: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderRadius: 22, background: "#11161f", border: "1px solid rgba(255,255,255,.08)" };
const goalFlag: React.CSSProperties = { fontSize: 54 };
const programBox: React.CSSProperties = { minHeight: 78, display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "18px 0", padding: 14, borderRadius: 18, background: "#222936", border: "1px solid rgba(255,255,255,.1)" };
const programChip: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, background: "#c6b8ff", color: "#10131b", fontWeight: 900 };
const commandGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 };
const commandButton: React.CSSProperties = { minHeight: 62, borderRadius: 16, border: "1px solid rgba(255,255,255,.15)", background: "#2b3444", color: "#fff", fontWeight: 950, cursor: "pointer" };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 22 };
const secondaryButton: React.CSSProperties = { minWidth: 110, padding: "12px 18px", borderRadius: 999, border: "2px solid #fff", background: "#fff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const primaryButton: React.CSSProperties = { minWidth: 130, padding: "12px 18px", borderRadius: 999, border: "2px solid #d9ff5b", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const messageStyle: React.CSSProperties = { minHeight: 24, color: "#c6b8ff", fontWeight: 850, marginTop: 18 };
const finishCard: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .95, letterSpacing: "-.06em", margin: "14px 0" };
const finishText: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const homeButton: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" };
