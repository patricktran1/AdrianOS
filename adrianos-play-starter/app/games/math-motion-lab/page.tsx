"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import { type KeyboardEvent, type PointerEvent, useEffect, useState } from "react";

const SLUG = "math-motion-lab";
const ROUTE_MODES = ["tap", "power-gate", "turbo"] as const;
type RouteMode = (typeof ROUTE_MODES)[number];
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
type World = { title: string; emoji: string; accent: string; intro: string; missions: Mission[] };

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: {
    title: "Critter Hop Path",
    emoji: "🐸🌼",
    accent: "#ffd45c",
    intro: "Hop a frog to the right counting spot.",
    missions: [
      { prompt: "Hop to 3.", start: 0, target: 3, min: 0, max: 5, step: 1, clue: "Count one flower each hop.", explanation: "Three hops land on 3.", standard: "TK.CC.1", skillId: "math-counting" },
      { prompt: "Start at 1. Hop to 4.", start: 1, target: 4, min: 0, max: 5, step: 1, clue: "Say 2, 3, 4 as you hop.", explanation: "Three forward hops reach 4.", standard: "TK.CC.2", skillId: "math-counting" },
      { prompt: "Hop back to 2.", start: 5, target: 2, min: 0, max: 5, step: 1, clue: "Move left and count backward.", explanation: "5, 4, 3, 2 lands on 2.", standard: "TK.CC.3", skillId: "math-counting" },
    ],
  },
  0: {
    title: "Rainbow Number Road",
    emoji: "🌈🛴",
    accent: "#ff9bd2",
    intro: "Ride a scooter along a bright number road.",
    missions: [
      { prompt: "Show 4 + 3.", start: 4, target: 7, min: 0, max: 10, step: 1, clue: "Move forward three spaces.", explanation: "4 + 3 = 7.", standard: "K.OA.A.1", skillId: "math-addition" },
      { prompt: "Show 8 − 2.", start: 8, target: 6, min: 0, max: 10, step: 1, clue: "Move left two spaces.", explanation: "8 − 2 = 6.", standard: "K.OA.A.1", skillId: "math-subtraction" },
      { prompt: "Find the number after 6.", start: 6, target: 7, min: 0, max: 10, step: 1, clue: "Take one step forward.", explanation: "The number after 6 is 7.", standard: "K.CC.A.2", skillId: "math-counting" },
    ],
  },
  1: {
    title: "Robot Rail Runner",
    emoji: "🤖🚝",
    accent: "#8dd7ff",
    intro: "Program a robot train with efficient jumps.",
    missions: [
      { prompt: "Solve 8 + 7.", start: 8, target: 15, min: 0, max: 20, step: 1, clue: "Jump 2 to make 10, then 5 more.", explanation: "8 + 7 = 15.", standard: "1.OA.C.6", skillId: "math-addition" },
      { prompt: "Solve 17 − 9.", start: 17, target: 8, min: 0, max: 20, step: 1, clue: "Jump back 7 to 10, then 2 more.", explanation: "17 − 9 = 8.", standard: "1.OA.C.6", skillId: "math-subtraction" },
      { prompt: "Count by 2s to 12.", start: 4, target: 12, min: 0, max: 20, step: 2, clue: "Use four jumps of 2.", explanation: "4, 6, 8, 10, 12.", standard: "1.NBT.A.1", skillId: "math-place-value" },
    ],
  },
  2: {
    title: "Dino Canyon Dash",
    emoji: "🦖🛹",
    accent: "#d9ff5b",
    intro: "Skate a dinosaur across canyon checkpoints.",
    missions: [
      { prompt: "Solve 27 + 18.", start: 27, target: 45, min: 20, max: 50, step: 1, clue: "Jump 3 to 30, then 15 more.", explanation: "27 + 18 = 45.", standard: "2.NBT.B.5", skillId: "math-word-problems" },
      { prompt: "Solve 52 − 17.", start: 52, target: 35, min: 30, max: 60, step: 1, clue: "Jump back 2 to 50, then 15 more.", explanation: "52 − 17 = 35.", standard: "2.NBT.B.5", skillId: "math-subtraction" },
      { prompt: "Count by 5s to 50.", start: 25, target: 50, min: 20, max: 55, step: 5, clue: "Use five jumps of 5.", explanation: "25, 30, 35, 40, 45, 50.", standard: "2.NBT.A.2", skillId: "math-place-value" },
    ],
  },
  3: {
    title: "Orbit Jump Grid",
    emoji: "🛰️🪐",
    accent: "#c6b8ff",
    intro: "Pilot a satellite with multiplication and division jumps.",
    missions: [
      { prompt: "Model 6 × 4.", start: 0, target: 24, min: 0, max: 30, step: 4, clue: "Make six equal jumps of 4.", explanation: "Six jumps of 4 land on 24.", standard: "3.OA.A.1", skillId: "math-multiplication" },
      { prompt: "Model 28 ÷ 7.", start: 0, target: 28, min: 0, max: 35, step: 7, clue: "Count jumps of 7 to 28.", explanation: "Four jumps show 28 ÷ 7 = 4.", standard: "3.OA.A.2", skillId: "math-division" },
      { prompt: "Solve 36 + 27.", start: 36, target: 63, min: 30, max: 70, step: 1, clue: "Jump 4 to 40, then 23 more.", explanation: "36 + 27 = 63.", standard: "3.NBT.A.2", skillId: "math-word-problems" },
    ],
  },
  4: {
    title: "Temple Fraction Trail",
    emoji: "🏛️🧭",
    accent: "#ffcb66",
    intro: "Unlock doors by moving across fractions.",
    missions: [
      { prompt: "Move to 3/4.", start: 0, target: 0.75, min: 0, max: 1, step: 0.25, clue: "Take three one-fourth jumps.", explanation: "1/4 + 1/4 + 1/4 = 3/4.", standard: "4.NF.B.3", skillId: "math-fractions" },
      { prompt: "Show 2/4 = 1/2.", start: 0, target: 0.5, min: 0, max: 1, step: 0.25, clue: "Take two one-fourth jumps.", explanation: "2/4 and 1/2 share a point.", standard: "4.NF.A.1", skillId: "math-fractions" },
      { prompt: "Move from 1 to 1 1/2.", start: 1, target: 1.5, min: 0, max: 2, step: 0.25, clue: "Two quarter jumps equal one half.", explanation: "1 + 1/2 = 1 1/2.", standard: "4.NF.B.3", skillId: "math-fractions" },
    ],
  },
  5: {
    title: "Cyber Decimal Rail",
    emoji: "🌐⚡",
    accent: "#77f1d0",
    intro: "Route a data runner through decimals and fractions.",
    missions: [
      { prompt: "Move from 0.4 to 0.72.", start: 0.4, target: 0.72, min: 0.4, max: 0.8, step: 0.01, clue: "Move forward 32 hundredths.", explanation: "0.40 + 0.32 = 0.72.", standard: "5.NBT.B.7", skillId: "math-decimals" },
      { prompt: "Solve 1/2 + 1/4.", start: 0.5, target: 0.75, min: 0, max: 1, step: 0.25, clue: "One quarter more than one half is three fourths.", explanation: "1/2 + 1/4 = 3/4.", standard: "5.NF.A.1", skillId: "math-fractions" },
      { prompt: "Move from 1.25 to 1.8.", start: 1.25, target: 1.8, min: 1.2, max: 1.9, step: 0.05, clue: "Move eleven jumps of five hundredths.", explanation: "1.25 + 0.55 = 1.80.", standard: "5.NBT.B.7", skillId: "math-decimals" },
    ],
  },
};

const MODE_META: Record<RouteMode, { label: string; icon: string; instruction: string }> = {
  tap: { label: "Tap Trail", icon: "👆", instruction: "Tap or drag the runner straight to your answer." },
  "power-gate": { label: "Power Gate", icon: "⚡", instruction: "Hit the glowing strategy gate, then reach the answer." },
  turbo: { label: "Turbo Jumps", icon: "🚀", instruction: "Build the answer with jump controls." },
};

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const label = (value: number, grade: ElementaryGrade) =>
  grade === 4 && value === 0.25 ? "1/4" :
  grade === 4 && value === 0.5 ? "1/2" :
  grade >= 4 && value === 0.75 ? "3/4" :
  grade === 4 && value === 1.5 ? "1 1/2" : String(round(value));

function ping(ok: boolean) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.frequency.value = ok ? 760 : 180;
  gain.gain.value = 0.04;
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
  oscillator.stop(context.currentTime + 0.17);
  oscillator.onended = () => void context.close();
}

function snapToMission(value: number, mission: Mission) {
  const steps = Math.round((value - mission.min) / mission.step);
  return round(clamp(mission.min + steps * mission.step, mission.min, mission.max));
}

function strategyGate(mission: Mission) {
  const direction = Math.sign(mission.target - mission.start) || 1;
  if (mission.step === 1) {
    const nextTen = direction > 0
      ? Math.ceil((mission.start + 0.001) / 10) * 10
      : Math.floor((mission.start - 0.001) / 10) * 10;
    if (direction > 0 && nextTen > mission.start && nextTen < mission.target) return nextTen;
    if (direction < 0 && nextTen < mission.start && nextTen > mission.target) return nextTen;
  }
  const totalSteps = Math.max(1, Math.round(Math.abs(mission.target - mission.start) / mission.step));
  const halfwaySteps = Math.max(1, Math.floor(totalSteps / 2));
  const candidate = round(mission.start + direction * halfwaySteps * mission.step);
  return candidate === mission.target ? mission.start : candidate;
}

function trackTicks(mission: Mission) {
  const values = new Set<number>([mission.min, mission.max, mission.start, mission.target]);
  for (let index = 1; index < 5; index += 1) {
    values.add(snapToMission(mission.min + ((mission.max - mission.min) * index) / 5, mission));
  }
  return [...values].sort((a, b) => a - b);
}

export default function MathMotionLab() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [done, setDone] = useState(false);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [stars, setStars] = useState(0);
  const [locked, setLocked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [gateCleared, setGateCleared] = useState(false);
  const [runNumber, setRunNumber] = useState(0);
  const [message, setMessage] = useState("Move the hero, then lock in your answer.");

  useEffect(() => {
    if (!hydrated) return;
    const nextGrade = readProfileGrade(activeProfile);
    setGrade(nextGrade);
    setPosition(WORLDS[nextGrade].missions[0].start);
    setMessage(MODE_META[ROUTE_MODES[runNumber % ROUTE_MODES.length]].instruction);
  }, [activeProfile, hydrated, runNumber]);

  if (grade === null) {
    return <GameFrame title="Math Motion Lab"><main style={load}>Calibrating the track…</main></GameFrame>;
  }

  const world = WORLDS[grade];
  const mission = world.missions[index];
  const routeMode = ROUTE_MODES[(index + runNumber) % ROUTE_MODES.length];
  const mode = MODE_META[routeMode];
  const gate = strategyGate(mission);
  const pct = ((position - mission.min) / (mission.max - mission.min)) * 100;
  const gatePct = ((gate - mission.min) / (mission.max - mission.min)) * 100;
  const ticks = trackTicks(mission);
  const shortJump = mission.step;
  const longJump = mission.step * 5;

  const moveTo = (nextPosition: number) => {
    if (locked) return;
    const snapped = snapToMission(nextPosition, mission);
    setPosition(snapped);
    if (routeMode === "power-gate" && Math.abs(snapped - gate) < 0.001 && !gateCleared) {
      setGateCleared(true);
      setMessage(`Power gate ${label(gate, grade)} charged. Now reach the answer!`);
      ping(true);
    }
  };

  const move = (direction: -1 | 1, multiplier = 1) => {
    moveTo(position + mission.step * multiplier * direction);
  };

  const moveFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    moveTo(mission.min + ratio * (mission.max - mission.min));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    moveFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) moveFromPointer(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleTrackKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveTo(mission.min);
    }
    if (event.key === "End") {
      event.preventDefault();
      moveTo(mission.max);
    }
  };

  const advance = (nextStars: number, nextBest: number) => {
    if (index === world.missions.length - 1) {
      completeGame({ xp: 34 + nextStars * 4 + nextBest * 3, coins: 8 + nextStars, score: nextStars * 150 + nextBest * 60 });
      setDone(true);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setPosition(world.missions[nextIndex].start);
    setMisses(0);
    setLocked(false);
    setGateCleared(false);
    setMessage(MODE_META[ROUTE_MODES[(nextIndex + runNumber) % ROUTE_MODES.length]].instruction);
  };

  const check = () => {
    if (locked) return;
    const correct = Math.abs(position - mission.target) < 0.001;
    recordLearningAttempt({
      gameSlug: SLUG,
      subject: "Math",
      skillId: mission.skillId,
      skillLabel: "Number-line reasoning",
      prompt: mission.prompt,
      correctAnswer: label(mission.target, grade),
      correct,
      data: { grade, standardCode: mission.standard, supportUsed: misses > 0, routeMode, strategyGateCleared: gateCleared },
    }, activeProfile.id);
    ping(correct);
    if (!correct) {
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setCombo(0);
      setMessage(nextMisses === 1 ? `Coach clue: ${mission.clue}` : `Target beacon: ${label(mission.target, grade)}. ${mission.explanation}`);
      return;
    }

    const nextCombo = misses === 0 ? combo + 1 : 0;
    const nextBest = Math.max(best, nextCombo);
    const strategyBonus = routeMode === "power-gate" && gateCleared ? 1 : 0;
    const nextStars = stars + (misses === 0 ? 3 : 1) + strategyBonus;
    setCombo(nextCombo);
    setBest(nextBest);
    setStars(nextStars);
    setLocked(true);
    setMessage(`${misses === 0 ? "Perfect landing" : "Route repaired"}! ${mission.explanation}`);
    window.setTimeout(() => advance(nextStars, nextBest), 950);
  };

  const replay = () => {
    restartGame();
    setDone(false);
    setIndex(0);
    setPosition(world.missions[0].start);
    setMisses(0);
    setCombo(0);
    setBest(0);
    setStars(0);
    setLocked(false);
    setGateCleared(false);
    setRunNumber((value) => value + 1);
    setMessage("Fresh route remix loaded.");
  };

  if (done) {
    return <GameFrame title={world.title}><main style={page}><section style={hero}><div style={big}>🏆{world.emoji}</div><h1 style={title}>{activeProfile.name} cleared every route!</h1><p>⭐ {stars} stars · 🔥 {best}× best combo</p><p className="motion-replay-note">Next run remixes all three control styles.</p><button className="motion-primary" style={{ background: world.accent }} onClick={replay}>Run a new remix →</button><style>{css}</style></section></main></GameFrame>;
  }

  return <GameFrame title={world.title}>
    <main style={{ ...page, background: `radial-gradient(circle at 75% ${18 + index * 18}%, ${world.accent}20, transparent 28%), #10131b` }}>
      <header style={hud}>
        <strong>{world.emoji} Route {index + 1}/{world.missions.length}</strong>
        <span>⭐ {stars} · 🔥 {combo}×</span>
      </header>
      <section style={card} data-route-mode={routeMode} data-gate-cleared={gateCleared ? "true" : "false"}>
        <div className="motion-mode-row">
          <span className="motion-mode" style={{ borderColor: `${world.accent}88`, color: world.accent }}>{mode.icon} {mode.label}</span>
          <span style={{ ...eyebrow, color: world.accent }}>{mission.standard}</span>
        </div>
        <h1 style={question}>{mission.prompt}</h1>
        <p className="motion-instruction">{mode.instruction}</p>
        <p>Current position: <strong>{label(position, grade)}</strong></p>
        <div
          aria-label={`Number line from ${label(mission.min, grade)} to ${label(mission.max, grade)}`}
          aria-valuemax={mission.max}
          aria-valuemin={mission.min}
          aria-valuenow={position}
          className={`motion-track ${dragging ? "is-dragging" : ""}`}
          data-testid="motion-track"
          onKeyDown={handleTrackKey}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDragging(false)}
          role="slider"
          tabIndex={locked ? -1 : 0}
          style={track}
        >
          <div className="motion-progress" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: world.accent }} />
          {ticks.map((tick) => {
            const tickPct = ((tick - mission.min) / (mission.max - mission.min)) * 100;
            return <span className="motion-tick" key={tick} style={{ left: `${tickPct}%` }}><i /><b>{label(tick, grade)}</b></span>;
          })}
          {routeMode === "power-gate" && !gateCleared && gate !== mission.start && (
            <span className="motion-gate" aria-label={`Power gate ${label(gate, grade)}`} style={{ left: `${gatePct}%`, color: world.accent }}>⚡</span>
          )}
          <span className="motion-runner" style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}>{Array.from(world.emoji)[0]}</span>
        </div>
        <div style={controls} aria-label="Jump controls">
          <button className="motion-control" onClick={() => move(-1, 5)} disabled={locked} aria-label={`Move back ${label(longJump, grade)}`}>⏪ <span>−{label(longJump, grade)}</span></button>
          <button className="motion-control" onClick={() => move(-1)} disabled={locked} aria-label={`Move back ${label(shortJump, grade)}`}>← <span>−{label(shortJump, grade)}</span></button>
          <button className="motion-control" onClick={() => move(1)} disabled={locked} aria-label={`Move forward ${label(shortJump, grade)}`}><span>+{label(shortJump, grade)}</span> →</button>
          <button className="motion-control" onClick={() => move(1, 5)} disabled={locked} aria-label={`Move forward ${label(longJump, grade)}`}><span>+{label(longJump, grade)}</span> ⏩</button>
        </div>
        <button className="motion-primary" onClick={check} disabled={locked} style={{ background: world.accent }}>Lock in {label(position, grade)}</button>
        <section role="status" style={coach}>
          <strong>{misses ? "ADAPTIVE COACH" : locked ? "ROUTE CLEARED" : "MOTION COACH"}</strong>
          <p>{message}</p>
          {locked && <small>Next route launching automatically…</small>}
        </section>
        <style>{css}</style>
      </section>
    </main>
  </GameFrame>;
}

const css = `
@keyframes mf{50%{transform:translateY(-9px)}}
@keyframes mr{50%{transform:translate(-50%,-60%) rotate(2deg)}}
@keyframes mg{50%{transform:translate(-50%,-58%) scale(1.16);filter:drop-shadow(0 0 14px currentColor)}}
.motion-float{animation:mf 2s ease-in-out infinite}
.motion-runner{position:absolute;z-index:5;top:50%;transform:translate(-50%,-50%);font-size:46px;line-height:1;transition:left .2s ease;animation:mr .7s ease-in-out infinite;pointer-events:none;filter:drop-shadow(0 8px 9px #05070caa)}
.motion-track{touch-action:none;cursor:grab;user-select:none;outline:none;isolation:isolate}
.motion-track.is-dragging{cursor:grabbing}
.motion-track:focus-visible{box-shadow:0 0 0 4px #ffffff,0 0 0 8px #8dd7ff}
.motion-progress{position:absolute;inset:0 auto 0 0;border-radius:inherit;opacity:.35}
.motion-tick{position:absolute;z-index:2;top:50%;transform:translate(-50%,-50%);pointer-events:none}
.motion-tick i{display:block;width:3px;height:22px;border-radius:999px;background:#dce7f7;box-shadow:0 0 0 2px #111827}
.motion-tick b{position:absolute;top:22px;left:50%;transform:translateX(-50%);font-size:11px;color:#dce7f7;white-space:nowrap}
.motion-gate{position:absolute;z-index:4;top:50%;transform:translate(-50%,-50%);font-size:34px;animation:mg .9s ease-in-out infinite;pointer-events:none}
.motion-mode-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.motion-mode{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid;border-radius:999px;background:#0d121c;font-size:12px;font-weight:950;letter-spacing:.04em}
.motion-instruction{min-height:24px;color:#c7d2e4;font-weight:750}
.motion-control{min-height:58px;padding:12px 14px;border:1px solid #62728d;border-radius:16px;background:linear-gradient(180deg,#35425a,#263247);color:#f8fbff;font:inherit;font-weight:950;font-size:17px;box-shadow:inset 0 1px 0 #ffffff22,0 7px 14px #05070c55;cursor:pointer;transition:transform .12s ease,filter .12s ease,background .12s ease}
.motion-control:hover:not(:disabled){filter:brightness(1.12)}
.motion-control:active:not(:disabled){transform:translateY(2px);box-shadow:inset 0 2px 6px #05070c88,0 2px 8px #05070c55}
.motion-control:focus-visible,.motion-primary:focus-visible{outline:4px solid #fff;outline-offset:3px}
.motion-control:disabled{opacity:1;background:#202837;border-color:#3d4960;color:#9eacc2;box-shadow:inset 0 1px 0 #ffffff0d;cursor:not-allowed}
.motion-primary{min-height:58px;padding:14px 22px;border:0;border-radius:999px;color:#10131b;font:inherit;font-weight:950;font-size:17px;box-shadow:inset 0 -3px 0 #00000024,0 9px 18px #05070c55;cursor:pointer}
.motion-primary:disabled{opacity:.72;cursor:default}
.motion-replay-note{color:#c7d2e4}
@media(max-width:560px){
  .motion-mode-row{align-items:flex-start;flex-direction:column}
  .motion-control{min-height:54px;font-size:16px}
  .motion-tick b{font-size:10px}
}
@media(prefers-reduced-motion:reduce){
  .motion-float,.motion-runner,.motion-gate{animation:none}
  .motion-runner,.motion-control{transition:none}
}
`;

const load: React.CSSProperties = { minHeight: 500, display: "grid", placeItems: "center", background: "#10131b", color: "#fff" };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 80px", color: "#fff", background: "#10131b" };
const hero: React.CSSProperties = { maxWidth: 920, margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "#181e2a" };
const big: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { fontSize: "clamp(3rem,8vw,6rem)", lineHeight: 0.9 };
const hud: React.CSSProperties = { maxWidth: 920, margin: "0 auto 12px", display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 20, background: "#181e2a", fontWeight: 900 };
const card: React.CSSProperties = { maxWidth: 920, margin: "0 auto", padding: "clamp(22px,5vw,42px)", borderRadius: 30, background: "#181e2a", textAlign: "center" };
const question: React.CSSProperties = { fontSize: "clamp(2rem,6vw,4rem)", marginBottom: 12 };
const track: React.CSSProperties = { position: "relative", height: 18, margin: "58px 8px 64px", borderRadius: 999, background: "linear-gradient(90deg,#334155,#71819a)", boxShadow: "inset 0 2px 7px #05070c99,0 0 0 1px #94a3b833" };
const controls: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginBottom: 18 };
const coach: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 20, background: "#10131b", color: "#f8fbff" };
