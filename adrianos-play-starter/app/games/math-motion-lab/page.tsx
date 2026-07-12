"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useState } from "react";

const GAME_SLUG = "math-motion-lab";

type Mission = {
  prompt: string;
  start: number;
  target: number;
  min: number;
  max: number;
  step: number;
  clue: string;
  explanation: string;
  standard: string;
  skillId: string;
};

type World = {
  title: string;
  emoji: string;
  accent: string;
  intro: string;
  unit: string;
  missions: Mission[];
};

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: {
    title: "Critter Hop Path", emoji: "🐸🌼", accent: "#ffd45c", unit: "spots",
    intro: "Hop a friendly frog to the right counting spot.",
    missions: [
      { prompt: "Hop to 3.", start: 0, target: 3, min: 0, max: 5, step: 1, clue: "Count one flower each time.", explanation: "Three hops land on 3.", standard: "TK.CC.1", skillId: "math-counting" },
      { prompt: "Start at 1. Hop to 4.", start: 1, target: 4, min: 0, max: 5, step: 1, clue: "Say 2, 3, 4 as you hop.", explanation: "Three forward hops move from 1 to 4.", standard: "TK.CC.2", skillId: "math-counting" },
      { prompt: "Hop back to 2.", start: 5, target: 2, min: 0, max: 5, step: 1, clue: "Move left and count backward.", explanation: "5, 4, 3, 2 lands on 2.", standard: "TK.CC.3", skillId: "math-counting" },
    ],
  },
  0: {
    title: "Rainbow Number Road", emoji: "🌈🛴", accent: "#ff9bd2", unit: "spaces",
    intro: "Ride a scooter along a bright number road.",
    missions: [
      { prompt: "Show 4 + 3 on the road.", start: 4, target: 7, min: 0, max: 10, step: 1, clue: "Start at 4 and move forward three spaces.", explanation: "4 + 3 = 7.", standard: "K.OA.A.1", skillId: "math-addition" },
      { prompt: "Show 8 − 2 on the road.", start: 8, target: 6, min: 0, max: 10, step: 1, clue: "Move left two spaces from 8.", explanation: "8 − 2 = 6.", standard: "K.OA.A.1", skillId: "math-subtraction" },
      { prompt: "Find the number after 6.", start: 6, target: 7, min: 0, max: 10, step: 1, clue: "One step forward gives the next number.", explanation: "The number after 6 is 7.", standard: "K.CC.A.2", skillId: "math-counting" },
    ],
  },
  1: {
    title: "Robot Rail Runner", emoji: "🤖🚝", accent: "#8dd7ff", unit: "units",
    intro: "Program a robot train with jumps of one, two, five, or ten.",
    missions: [
      { prompt: "Solve 8 + 7.", start: 8, target: 15, min: 0, max: 20, step: 1, clue: "Jump 2 to make 10, then 5 more.", explanation: "8 + 7 = 15.", standard: "1.OA.C.6", skillId: "math-addition" },
      { prompt: "Solve 17 − 9.", start: 17, target: 8, min: 0, max: 20, step: 1, clue: "Jump back 7 to 10, then 2 more.", explanation: "17 − 9 = 8.", standard: "1.OA.C.6", skillId: "math-subtraction" },
      { prompt: "Count by 2s from 4 to 12.", start: 4, target: 12, min: 0, max: 20, step: 2, clue: "Use four jumps of 2.", explanation: "4, 6, 8, 10, 12.", standard: "1.NBT.A.1", skillId: "math-place-value" },
    ],
  },
  2: {
    title: "Dino Canyon Dash", emoji: "🦖🛹", accent: "#d9ff5b", unit: "meters",
    intro: "Skate a dinosaur across canyon checkpoints using efficient jumps.",
    missions: [
      { prompt: "Solve 27 + 18.", start: 27, target: 45, min: 20, max: 50, step: 1, clue: "Jump 3 to 30, then 15 more.", explanation: "27 + 18 = 45.", standard: "2.NBT.B.5", skillId: "math-word-problems" },
      { prompt: "Solve 52 − 17.", start: 52, target: 35, min: 30, max: 60, step: 1, clue: "Jump back 2 to 50, then 15 more.", explanation: "52 − 17 = 35.", standard: "2.NBT.B.5", skillId: "math-subtraction" },
      { prompt: "Count by 5s from 25 to 50.", start: 25, target: 50, min: 20, max: 55, step: 5, clue: "Use five jumps of 5.", explanation: "25, 30, 35, 40, 45, 50.", standard: "2.NBT.A.2", skillId: "math-place-value" },
    ],
  },
  3: {
    title: "Orbit Jump Grid", emoji: "🛰️🪐", accent: "#c6b8ff", unit: "light steps",
    intro: "Pilot a satellite with multiplication and division jumps.",
    missions: [
      { prompt: "Model 6 × 4.", start: 0, target: 24, min: 0, max: 30, step: 4, clue: "Make six equal jumps of 4.", explanation: "Six jumps of 4 land on 24.", standard: "3.OA.A.1", skillId: "math-multiplication" },
      { prompt: "Model 28 ÷ 7.", start: 0, target: 28, min: 0, max: 35, step: 7, clue: "Count how many jumps of 7 reach 28.", explanation: "Four jumps of 7 show 28 ÷ 7 = 4.", standard: "3.OA.A.2", skillId: "math-division" },
      { prompt: "Solve 36 + 27.", start: 36, target: 63, min: 30, max: 70, step: 1, clue: "Jump 4 to 40, then 23 more.", explanation: "36 + 27 = 63.", standard: "3.NBT.A.2", skillId: "math-word-problems" },
    ],
  },
  4: {
    title: "Temple Fraction Trail", emoji: "🏛️🧭", accent: "#ffcb66", unit: "fraction steps",
    intro: "Unlock temple doors by moving across equivalent fractions and mixed numbers.",
    missions: [
      { prompt: "Move from 0 to 3/4.", start: 0, target: 0.75, min: 0, max: 1, step: 0.25, clue: "Three jumps of one fourth make three fourths.", explanation: "1/4 + 1/4 + 1/4 = 3/4.", standard: "4.NF.B.3", skillId: "math-fractions" },
      { prompt: "Show that 2/4 equals 1/2.", start: 0, target: 0.5, min: 0, max: 1, step: 0.25, clue: "Two fourth-size jumps land at one half.", explanation: "2/4 and 1/2 share the same point.", standard: "4.NF.A.1", skillId: "math-fractions" },
      { prompt: "Move from 1 to 1 1/2.", start: 1, target: 1.5, min: 0, max: 2, step: 0.25, clue: "Two quarter jumps equal one half.", explanation: "1 + 1/2 = 1 1/2.", standard: "4.NF.B.3", skillId: "math-fractions" },
    ],
  },
  5: {
    title: "Cyber Decimal Rail", emoji: "🌐⚡", accent: "#77f1d0", unit: "decimal nodes",
    intro: "Route a data runner through precise decimal and fraction coordinates.",
    missions: [
      { prompt: "Move from 0.4 to 0.72.", start: 0.4, target: 0.72, min: 0.4, max: 0.8, step: 0.01, clue: "Move forward 32 hundredths.", explanation: "0.40 + 0.32 = 0.72.", standard: "5.NBT.B.7", skillId: "math-decimals" },
      { prompt: "Solve 1/2 + 1/4.", start: 0.5, target: 0.75, min: 0, max: 1, step: 0.25, clue: "One quarter more than one half is three fourths.", explanation: "1/2 + 1/4 = 3/4.", standard: "5.NF.A.1", skillId: "math-fractions" },
      { prompt: "Move from 1.25 to 1.8.", start: 1.25, target: 1.8, min: 1.2, max: 1.9, step: 0.05, clue: "Move forward eleven jumps of five hundredths.", explanation: "1.25 + 0.55 = 1.80.", standard: "5.NBT.B.7", skillId: "math-decimals" },
    ],
  },
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function label(value: number, grade: ElementaryGrade) {
  if (grade === 4) {
    if (value === 0.25) return "1/4";
    if (value === 0.5) return "1/2";
    if (value === 0.75) return "3/4";
    if (value === 1.25) return "1 1/4";
    if (value === 1.5) return "1 1/2";
    if (value === 1.75) return "1 3/4";
  }
  if (grade === 5 && value === 0.75) return "3/4";
  return String(round(value));
}

function tone(correct: boolean) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.frequency.value = correct ? 760 : 180;
  gain.gain.setValueAtTime(.045, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .16);
  oscillator.start(); oscillator.stop(context.currentTime + .17);
  oscillator.addEventListener("ended", () => void context.close());
}

export default function MathMotionLabPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [missionIndex, setMissionIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [moves, setMoves] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [stars, setStars] = useState(0);
  const [message, setMessage] = useState("Move the hero to the target, then lock it in.");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const nextGrade = readProfileGrade(activeProfile);
    setGrade(nextGrade);
    setPosition(WORLDS[nextGrade].missions[0].start);
  }, [activeProfile, hydrated]);

  const world = grade === null ? null : WORLDS[grade];
  const mission = world?.missions[missionIndex] ?? null;
  const percent = mission ? ((position - mission.min) / (mission.max - mission.min)) * 100 : 0;
  const ticks = useMemo(() => {
    if (!mission) return [];
    const count = Math.min(12, Math.round((mission.max - mission.min) / mission.step));
    return Array.from({ length: count + 1 }, (_, index) => round(mission.min + ((mission.max - mission.min) * index) / count));
  }, [mission]);

  function move(direction: -1 | 1, multiplier = 1) {
    if (!mission || locked) return;
    const next = round(position + mission.step * multiplier * direction);
    setPosition(Math.min(mission.max, Math.max(mission.min, next)));
    setMoves((value) => value + 1);
  }

  function check() {
    if (!mission || grade === null || locked) return;
    const correct = Math.abs(position - mission.target) < 0.001;
    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: "Math",
      skillId: mission.skillId,
      skillLabel: "Number-line reasoning",
      prompt: mission.prompt,
      correctAnswer: label(mission.target, grade),
      correct,
      data: { grade, standardCode: mission.standard, moves, supportUsed: misses > 0 },
    }, activeProfile.id);
    tone(correct);
    if (!correct) {
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setCombo(0);
      setMessage(nextMisses === 1 ? `Coach clue: ${mission.clue}` : `Target beacon: ${label(mission.target, grade)}. ${mission.explanation}`);
      return;
    }
    const nextCombo = misses === 0 ? combo + 1 : 0;
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setStars((value) => value + (misses === 0 ? 3 : 1));
    setLocked(true);
    setMessage(misses === 0 ? `Perfect landing! ${mission.explanation}` : `Route repaired. ${mission.explanation}`);
  }

  function advance() {
    if (!world || !mission || !locked) return;
    if (missionIndex === world.missions.length - 1) {
      completeGame({ xp: 34 + stars * 4 + bestCombo * 3, coins: 8 + stars, score: stars * 150 + bestCombo * 60 });
      setFinished(true);
      return;
    }
    const nextIndex = missionIndex + 1;
    setMissionIndex(nextIndex);
    setPosition(world.missions[nextIndex].start);
    setMoves(0); setMisses(0); setLocked(false);
    setMessage("New route loaded. Move the hero to the target.");
  }

  function replay() {
    if (!world) return;
    restartGame();
    setStarted(true); setFinished(false); setMissionIndex(0); setPosition(world.missions[0].start);
    setMoves(0); setMisses(0); setCombo(0); setBestCombo(0); setStars(0); setLocked(false);
    setMessage("Move the hero to the target, then lock it in.");
  }

  if (!world || !mission || grade === null) return <GameFrame title="Math Motion Lab"><main style={loading}>Calibrating the number track…</main></GameFrame>;

  if (!started) return <GameFrame title={world.title}><main style={{ ...page, background: `radial-gradient(circle at top,${world.accent}35,#10131b 60%)` }}><section style={hero}><div className="motion-float" style={heroEmoji}>{world.emoji}</div><span style={{ ...eyebrow, color: world.accent }}>HANDS-ON NUMBER LINE</span><h1 style={title}>{world.title}</h1><p style={lead}>{world.intro} This is movement math, not a multiple-choice quiz.</p><div style={stats}><strong>🧭 3 routes</strong><strong>🔥 combo stars</strong><strong>🧠 adaptive coaching</strong></div><button style={{ ...primary, background: world.accent }} onClick={() => setStarted(true)}>Start moving →</button></section><style>{css}</style></main></GameFrame>;

  if (finished) return <GameFrame title={world.title}><main style={{ ...page, background: `radial-gradient(circle at top,${world.accent}35,#10131b 60%)` }}><section style={hero}><div className="motion-pop" style={heroEmoji}>🏆{world.emoji}</div><span style={{ ...eyebrow, color: world.accent }}>MOTION MASTERED</span><h1 style={title}>{activeProfile.name} cleared every route!</h1><p style={lead}>The number line became a strategy tool, not just a picture.</p><div style={stats}><strong>⭐ {stars} stars</strong><strong>🔥 {bestCombo}× best combo</strong><strong>🧭 3 routes</strong></div><button style={{ ...primary, background: world.accent }} onClick={replay}>Run new routes →</button></section><style>{css}</style></main></GameFrame>;

  return <GameFrame title={world.title}><main style={{ ...page, background: `radial-gradient(circle at top,${world.accent}25,#10131b 60%)` }}><style>{css}</style><header style={hud}><strong>{world.emoji} Route {missionIndex + 1}/3</strong><span>⭐ {stars} · 🔥 {combo}× · 👣 {moves}</span></header><section style={card}><span style={{ ...eyebrow, color: world.accent }}>{mission.standard}</span><h1 style={question}>{mission.prompt}</h1><p style={positionLabel}>Current position: <strong>{label(position, grade)}</strong> {world.unit}</p><div style={trackWrap} aria-label={`Number line from ${label(mission.min, grade)} to ${label(mission.max, grade)}`}><div style={track}><div className="motion-runner" style={{ ...runner, left: `${Math.max(0, Math.min(100, percent))}%` }}>{world.emoji.split("")[0]}</div></div><div style={tickRow}>{ticks.map((tick) => <span key={tick}>{label(tick, grade)}</span>)}</div></div><div style={controls}><button onClick={() => move(-1, 5)} disabled={locked} style={control}>⏪ 5 jumps</button><button onClick={() => move(-1)} disabled={locked} style={control}>← Back</button><button onClick={() => move(1)} disabled={locked} style={control}>Forward →</button><button onClick={() => move(1, 5)} disabled={locked} style={control}>5 jumps ⏩</button></div><button onClick={check} disabled={locked} style={{ ...primary, background: world.accent }}>Lock in {label(position, grade)}</button><section role="status" style={coach}><strong>{locked ? "ROUTE REPORT" : misses > 0 ? "ADAPTIVE COACH" : "MOTION COACH"}</strong><p>{message}</p>{locked && <button onClick={advance} style={{ ...primary, background: world.accent }}>{missionIndex === 2 ? "Open the motion vault →" : "Next route →"}</button>}</section></section></main></GameFrame>;
}

const css = `@keyframes motionFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes motionPop{0%{transform:scale(.6);opacity:0}80%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}@keyframes runnerBob{0%,100%{transform:translate(-50%,-50%) rotate(-2deg)}50%{transform:translate(-50%,-58%) rotate(2deg)}}.motion-float{animation:motionFloat 2s ease-in-out infinite}.motion-pop{animation:motionPop .45s ease-out both}.motion-runner{animation:runnerBob .7s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.motion-float,.motion-pop,.motion-runner{animation:none}}`;
const loading: React.CSSProperties = { minHeight: 500, display: "grid", placeItems: "center", background: "#10131b", color: "#fff", fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 80px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "rgba(18,24,36,.94)", border: "1px solid rgba(255,255,255,.14)" };
const heroEmoji: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(3rem,8vw,6rem)", lineHeight: .9, letterSpacing: "-.06em" };
const lead: React.CSSProperties = { maxWidth: 700, margin: "12px auto 22px", color: "#c4ccd8", lineHeight: 1.6, fontWeight: 700 };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", margin: "20px 0" };
const primary: React.CSSProperties = { minHeight: 58, padding: "14px 22px", border: 0, borderRadius: 999, color: "#10131b", fontWeight: 950, cursor: "pointer" };
const hud: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: 14, borderRadius: 20, background: "rgba(18,24,36,.94)", fontWeight: 900 };
const card: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto", padding: "clamp(22px,5vw,42px)", borderRadius: 30, background: "rgba(18,24,36,.96)", textAlign: "center", border: "1px solid rgba(255,255,255,.14)" };
const question: React.CSSProperties = { margin: "10px auto", fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1, letterSpacing: "-.045em" };
const positionLabel: React.CSSProperties = { color: "#c4ccd8", fontSize: 18 };
const trackWrap: React.CSSProperties = { margin: "44px 0 24px", padding: "0 10px" };
const track: React.CSSProperties = { position: "relative", height: 16, borderRadius: 999, background: "linear-gradient(90deg,#334155,#64748b)", boxShadow: "inset 0 2px 7px rgba(0,0,0,.45)" };
const runner: React.CSSProperties = { position: "absolute", top: "50%", fontSize: 46, transition: "left .25s ease", filter: "drop-shadow(0 10px 14px rgba(0,0,0,.4))" };
const tickRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 4, marginTop: 17, color: "#aab1bf", fontSize: 11, fontWeight: 850 };
const controls: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10, marginBottom: 18 };
const control: React.CSSProperties = { minHeight: 68, padding: 12, borderRadius: 20, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontSize: 17, fontWeight: 900, cursor: "pointer" };
const coach: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 20, background: "#10131b", color: "#c4ccd8" };
