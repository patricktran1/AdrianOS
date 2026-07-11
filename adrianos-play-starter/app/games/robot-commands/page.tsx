"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Direction = 0 | 1 | 2 | 3;
type BasicCommand = "MOVE" | "LEFT" | "RIGHT";
type Command = BasicCommand | "REPEAT2";
type Point = { x: number; y: number };
type RobotState = Point & { direction: Direction };

type Level = {
  name: string;
  prompt: string;
  start: RobotState;
  goal: Point;
  obstacles: Point[];
  stars: Point[];
  maxBlocks: number;
};

const SIZE = 6;
const GAME_SLUG = "robot-commands";

const LEVELS: Level[] = [
  {
    name: "Straight Shot",
    prompt: "Collect both stars and reach the flag.",
    start: { x: 0, y: 5, direction: 1 },
    goal: { x: 3, y: 5 },
    obstacles: [],
    stars: [{ x: 1, y: 5 }, { x: 2, y: 5 }],
    maxBlocks: 3,
  },
  {
    name: "Corner Turn",
    prompt: "Go up, turn right, and reach the flag.",
    start: { x: 1, y: 5, direction: 0 },
    goal: { x: 4, y: 2 },
    obstacles: [{ x: 2, y: 4 }, { x: 3, y: 4 }],
    stars: [{ x: 1, y: 3 }, { x: 2, y: 2 }],
    maxBlocks: 7,
  },
  {
    name: "Repeat Power",
    prompt: "Use Repeat ×2 to cross the long hallway.",
    start: { x: 0, y: 4, direction: 1 },
    goal: { x: 5, y: 4 },
    obstacles: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
    stars: [{ x: 2, y: 4 }, { x: 4, y: 4 }],
    maxBlocks: 4,
  },
  {
    name: "Zigzag",
    prompt: "Navigate around the blocks and collect every star.",
    start: { x: 0, y: 5, direction: 0 },
    goal: { x: 5, y: 0 },
    obstacles: [
      { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    ],
    stars: [{ x: 0, y: 3 }, { x: 2, y: 3 }, { x: 5, y: 1 }],
    maxBlocks: 14,
  },
  {
    name: "Moon Base",
    prompt: "Find the safe path through the moon rocks.",
    start: { x: 5, y: 5, direction: 3 },
    goal: { x: 0, y: 0 },
    obstacles: [
      { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 4, y: 1 },
    ],
    stars: [{ x: 3, y: 5 }, { x: 2, y: 3 }, { x: 0, y: 1 }],
    maxBlocks: 16,
  },
  {
    name: "Final Circuit",
    prompt: "Collect four stars and finish the final circuit.",
    start: { x: 0, y: 0, direction: 1 },
    goal: { x: 5, y: 5 },
    obstacles: [
      { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 2 }, { x: 3, y: 4 }, { x: 1, y: 4 },
    ],
    stars: [{ x: 1, y: 0 }, { x: 3, y: 2 }, { x: 5, y: 3 }, { x: 4, y: 5 }],
    maxBlocks: 18,
  },
];

const directionGlyphs = ["▲", "▶", "▼", "◀"];
const directionNames = ["north", "east", "south", "west"];
const moves = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function key(point: Point): string {
  return `${point.x},${point.y}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function expandProgram(program: Command[]): BasicCommand[] {
  const expanded: BasicCommand[] = [];
  let previous: BasicCommand | null = null;

  for (const command of program) {
    if (command === "REPEAT2") {
      if (previous) expanded.push(previous, previous);
      continue;
    }
    expanded.push(command);
    previous = command;
  }

  return expanded;
}

export default function RobotCommandsPage() {
  const { progress, recordPlay, award } = useAdrianProgress();
  const [levelIndex, setLevelIndex] = useState(0);
  const [program, setProgram] = useState<Command[]>([]);
  const [robot, setRobot] = useState<RobotState>(LEVELS[0].start);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("Build a program, then run it.");
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const level = LEVELS[levelIndex];
  const obstacleKeys = useMemo(() => new Set(level.obstacles.map(key)), [level]);
  const starKeys = useMemo(() => new Set(level.stars.map(key)), [level]);
  const bestScore = progress.games[GAME_SLUG]?.bestScore ?? 0;

  useEffect(() => {
    recordPlay(GAME_SLUG);
  }, [recordPlay]);

  function resetLevel(nextLevel = level) {
    setProgram([]);
    setRobot(nextLevel.start);
    setCollected(new Set());
    setMessage("Build a program, then run it.");
    setRunning(false);
  }

  function addCommand(command: Command) {
    if (running || program.length >= level.maxBlocks) return;
    if (command === "REPEAT2" && !program.some((item) => item !== "REPEAT2")) {
      setMessage("Add a Move or Turn command before Repeat ×2.");
      return;
    }
    setProgram((current) => [...current, command]);
    setMessage("Program ready. Press Run when you are done.");
  }

  function undo() {
    if (running) return;
    setProgram((current) => current.slice(0, -1));
  }

  async function runProgram() {
    if (running || program.length === 0) return;
    setRunning(true);
    setMessage("Robot running...");
    setRobot(level.start);
    setCollected(new Set());

    let current = { ...level.start };
    const collectedStars = new Set<string>();
    const expanded = expandProgram(program);
    let crashed = false;

    await sleep(250);

    for (const command of expanded) {
      if (command === "LEFT") {
        current = { ...current, direction: ((current.direction + 3) % 4) as Direction };
      } else if (command === "RIGHT") {
        current = { ...current, direction: ((current.direction + 1) % 4) as Direction };
      } else {
        const delta = moves[current.direction];
        const next = { x: current.x + delta.x, y: current.y + delta.y };
        const blocked =
          next.x < 0 || next.x >= SIZE || next.y < 0 || next.y >= SIZE || obstacleKeys.has(key(next));

        if (blocked) {
          crashed = true;
          setMessage("Bump! The robot hit a wall or rock.");
          break;
        }

        current = { ...current, ...next };
        const currentKey = key(current);
        if (starKeys.has(currentKey)) collectedStars.add(currentKey);
      }

      setRobot({ ...current });
      setCollected(new Set(collectedStars));
      await sleep(330);
    }

    if (crashed) {
      setRunning(false);
      return;
    }

    const reachedGoal = current.x === level.goal.x && current.y === level.goal.y;
    const allStars = collectedStars.size === level.stars.length;

    if (!reachedGoal || !allStars) {
      setMessage(
        !reachedGoal
          ? "The robot stopped before the flag. Adjust the program."
          : `You still need ${level.stars.length - collectedStars.size} star${level.stars.length - collectedStars.size === 1 ? "" : "s"}.`
      );
      setRunning(false);
      return;
    }

    const efficiencyBonus = Math.max(0, level.maxBlocks - program.length) * 15;
    const levelScore = 100 + level.stars.length * 25 + efficiencyBonus;
    const nextScore = score + levelScore;
    setScore(nextScore);
    award(GAME_SLUG, {
      xp: 30 + level.stars.length * 5,
      coins: 4 + level.stars.length,
      score: nextScore,
      completed: levelIndex === LEVELS.length - 1,
    });

    if (levelIndex === LEVELS.length - 1) {
      setMessage("Final circuit complete!");
      await sleep(700);
      setFinished(true);
      setRunning(false);
      return;
    }

    setMessage(`Mission complete! +${levelScore} points`);
    await sleep(850);
    const nextIndex = levelIndex + 1;
    setLevelIndex(nextIndex);
    resetLevel(LEVELS[nextIndex]);
  }

  function restartGame() {
    setLevelIndex(0);
    setScore(0);
    setFinished(false);
    resetLevel(LEVELS[0]);
    recordPlay(GAME_SLUG);
  }

  if (finished) {
    return (
      <GameFrame title="Robot Commands 2.0">
        <section style={finishCard}>
          <div style={{ fontSize: 70 }}>🤖🏆</div>
          <span style={eyebrow}>ROBOT TRAINING COMPLETE</span>
          <h1 style={finishTitle}>You cleared every circuit.</h1>
          <p style={finishText}>Score: {score} · Best: {Math.max(score, bestScore)}</p>
          <div style={actionRow}>
            <button style={primaryButton} onClick={restartGame}>Play Again</button>
            <Link href="/" style={linkButton}>Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Robot Commands 2.0">
      <div style={{ width: "min(1040px,100%)", margin: "0 auto" }}>
        <div style={statsRow}>
          <span>Mission {levelIndex + 1}/{LEVELS.length}</span>
          <span>Score {score}</span>
          <span>Best {bestScore}</span>
        </div>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span style={eyebrow}>{level.name.toUpperCase()}</span>
              <h1 style={questionTitle}>{level.prompt}</h1>
            </div>
            <div style={blockCounter}>{program.length}/{level.maxBlocks} blocks</div>
          </div>

          <div style={layoutGrid}>
            <div style={board}>
              {Array.from({ length: SIZE * SIZE }).map((_, index) => {
                const x = index % SIZE;
                const y = Math.floor(index / SIZE);
                const cellKey = `${x},${y}`;
                const isRobot = robot.x === x && robot.y === y;
                const isGoal = level.goal.x === x && level.goal.y === y;
                const isObstacle = obstacleKeys.has(cellKey);
                const hasStar = starKeys.has(cellKey) && !collected.has(cellKey);

                return (
                  <div
                    key={cellKey}
                    style={{
                      ...cell,
                      background: isObstacle ? "#3b4659" : (x + y) % 2 === 0 ? "#202734" : "#252e3d",
                    }}
                  >
                    {isGoal && <span style={{ position: "absolute", fontSize: 28 }}>🏁</span>}
                    {hasStar && <span style={{ position: "absolute", fontSize: 25 }}>⭐</span>}
                    {isObstacle && <span style={{ fontSize: 28 }}>🪨</span>}
                    {isRobot && (
                      <div style={robotToken}>
                        <span style={{ fontSize: 32 }}>🤖</span>
                        <span style={directionBadge}>{directionGlyphs[robot.direction]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <div style={programBox}>
                <strong style={{ display: "block", marginBottom: 10 }}>YOUR PROGRAM</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {program.length === 0 ? (
                    <span style={{ color: "#7f8898" }}>Add command blocks below.</span>
                  ) : (
                    program.map((command, index) => (
                      <span key={`${command}-${index}`} style={programChip}>
                        {command === "LEFT" ? "↶ LEFT" : command === "RIGHT" ? "↷ RIGHT" : command === "REPEAT2" ? "⟳ REPEAT ×2" : "↑ MOVE"}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div style={commandGrid}>
                <button style={commandButton} onClick={() => addCommand("MOVE")} disabled={running}>↑ Move</button>
                <button style={commandButton} onClick={() => addCommand("LEFT")} disabled={running}>↶ Turn Left</button>
                <button style={commandButton} onClick={() => addCommand("RIGHT")} disabled={running}>↷ Turn Right</button>
                <button style={repeatButton} onClick={() => addCommand("REPEAT2")} disabled={running}>⟳ Repeat Last ×2</button>
              </div>

              <div style={actionRow}>
                <button style={secondaryButton} onClick={undo} disabled={running}>Undo</button>
                <button style={secondaryButton} onClick={() => resetLevel()} disabled={running}>Reset</button>
                <button style={primaryButton} onClick={runProgram} disabled={running || program.length === 0}>
                  {running ? "Running..." : "Run Program"}
                </button>
              </div>

              <p style={messageStyle}>{message}</p>
              <p style={{ color: "#7f8898", fontSize: 13, margin: 0 }}>
                Robot is facing {directionNames[robot.direction]}. Collect {level.stars.length} star{level.stars.length === 1 ? "" : "s"} before the flag.
              </p>
            </div>
          </div>
        </section>
      </div>
    </GameFrame>
  );
}

const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const card: React.CSSProperties = { padding: "clamp(20px,4vw,38px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const questionTitle: React.CSSProperties = { fontSize: "clamp(1.8rem,4vw,3.2rem)", lineHeight: 1, letterSpacing: "-.05em", margin: "10px 0 20px" };
const blockCounter: React.CSSProperties = { alignSelf: "flex-start", padding: "10px 13px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontWeight: 900 };
const layoutGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 22, alignItems: "start" };
const board: React.CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${SIZE},1fr)`, gap: 5, padding: 8, borderRadius: 22, background: "#11161f", border: "1px solid rgba(255,255,255,.08)" };
const cell: React.CSSProperties = { position: "relative", minHeight: 58, aspectRatio: "1", display: "grid", placeItems: "center", borderRadius: 11, overflow: "hidden" };
const robotToken: React.CSSProperties = { position: "relative", zIndex: 2, display: "grid", placeItems: "center", filter: "drop-shadow(0 5px 8px rgba(0,0,0,.4))" };
const directionBadge: React.CSSProperties = { position: "absolute", right: -7, top: -8, width: 23, height: 23, display: "grid", placeItems: "center", borderRadius: "50%", background: "#d9ff5b", color: "#10131b", fontSize: 12, fontWeight: 950 };
const programBox: React.CSSProperties = { minHeight: 105, padding: 16, borderRadius: 18, background: "#222936", border: "1px solid rgba(255,255,255,.1)" };
const programChip: React.CSSProperties = { padding: "9px 11px", borderRadius: 12, background: "#c6b8ff", color: "#10131b", fontSize: 12, fontWeight: 950 };
const commandGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9, marginTop: 14 };
const commandButton: React.CSSProperties = { minHeight: 58, borderRadius: 16, border: "1px solid rgba(255,255,255,.17)", background: "#2b3444", color: "#fff", fontWeight: 950, cursor: "pointer" };
const repeatButton: React.CSSProperties = { ...commandButton, background: "#433a61", color: "#efeaff" };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 18 };
const secondaryButton: React.CSSProperties = { minWidth: 100, padding: "12px 17px", borderRadius: 999, border: "2px solid #fff", background: "#fff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const primaryButton: React.CSSProperties = { minWidth: 135, padding: "12px 18px", borderRadius: 999, border: "2px solid #d9ff5b", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const messageStyle: React.CSSProperties = { minHeight: 24, color: "#c6b8ff", fontWeight: 850, margin: "16px 0 8px" };
const finishCard: React.CSSProperties = { width: "min(720px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .95, letterSpacing: "-.06em", margin: "14px 0" };
const finishText: React.CSSProperties = { color: "#aab1bf", fontSize: 18, marginBottom: 26 };
const linkButton: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#fff", color: "#10131b", fontWeight: 950, textDecoration: "none" };
