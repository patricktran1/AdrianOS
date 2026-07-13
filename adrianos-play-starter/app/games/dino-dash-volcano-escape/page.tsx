"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./DinoDash.module.css";

const GAME_SLUG = "dino-dash-volcano-escape";
const GATE_COUNT = 8;
const MAX_SHIELDS = 3;

type DashPhase = "ready" | "boost" | "roar" | "shield";
type Screen = "play" | "complete";

type DashQuestion = {
  prompt: string;
  visual: string;
  choices: number[];
  answer: number;
  hint: string;
  skillId: string;
  skillLabel: string;
  standard: string;
  operation: string;
};

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function choicesFor(answer: number, spread: number, random: () => number): number[] {
  const values = new Set<number>([answer]);
  const offsets = shuffle(
    [1, -1, 2, -2, spread, -spread, spread + 1, -(spread + 1), spread * 2, -(spread * 2)],
    random,
  );
  for (const offset of offsets) {
    values.add(Math.max(0, answer + offset));
    if (values.size === 3) break;
  }
  let fallback = 1;
  while (values.size < 3) {
    values.add(answer + fallback);
    fallback += 1;
  }
  return shuffle(Array.from(values), random);
}

function makeQuestion(grade: number, gate: number, seed: string): DashQuestion {
  const random = seededRandom(hashText(seed));
  const pick = (minimum: number, maximum: number) => minimum + Math.floor(random() * (maximum - minimum + 1));

  if (grade <= 0) {
    const maximum = grade < 0 ? 5 : 10;
    const answer = pick(2, maximum);
    return {
      prompt: "How many dinosaur eggs are on the trail?",
      visual: Array.from({ length: answer }, () => "🥚").join(" "),
      choices: choicesFor(answer, 2, random),
      answer,
      hint: "Touch each egg once while you count.",
      skillId: "math-counting",
      skillLabel: "Count objects",
      standard: grade < 0 ? "TK.CC.1" : "K.CC.B.5",
      operation: "counting",
    };
  }

  if (grade === 1) {
    const subtraction = gate % 2 === 1;
    if (subtraction) {
      const left = pick(10, 20);
      const right = pick(2, Math.min(9, left));
      const answer = left - right;
      return {
        prompt: `${left} − ${right} = ?`,
        visual: "🦖  DASH MATH  🌋",
        choices: choicesFor(answer, 3, random),
        answer,
        hint: `Start at ${left} and count back ${right}.`,
        skillId: "math-subtraction",
        skillLabel: "Subtract within 20",
        standard: "1.OA.C.6",
        operation: "subtraction",
      };
    }
    const left = pick(4, 12);
    const right = pick(2, Math.min(8, 20 - left));
    const answer = left + right;
    return {
      prompt: `${left} + ${right} = ?`,
      visual: "🦕  TURBO TOTAL  ⚡",
      choices: choicesFor(answer, 3, random),
      answer,
      hint: "Make ten first, then add what remains.",
      skillId: "math-addition",
      skillLabel: "Add within 20",
      standard: "1.OA.C.6",
      operation: "addition",
    };
  }

  if (grade === 2) {
    const subtraction = gate % 2 === 1;
    if (subtraction) {
      const left = pick(45, 99);
      const right = pick(12, Math.min(39, left));
      const answer = left - right;
      return {
        prompt: `${left} − ${right} = ?`,
        visual: "🌋  LAVA GAP  🦖",
        choices: choicesFor(answer, 10, random),
        answer,
        hint: "Subtract the tens, then subtract the ones.",
        skillId: "math-subtraction",
        skillLabel: "Subtract within 100",
        standard: "2.NBT.B.5",
        operation: "subtraction",
      };
    }
    const left = pick(24, 68);
    const right = pick(11, 29);
    const answer = left + right;
    return {
      prompt: `${left} + ${right} = ?`,
      visual: "🦖  BOOST BRIDGE  🌉",
      choices: choicesFor(answer, 10, random),
      answer,
      hint: "Add the tens first, then add the ones.",
      skillId: "math-addition",
      skillLabel: "Add within 100",
      standard: "2.NBT.B.5",
      operation: "addition",
    };
  }

  if (grade === 3) {
    const factorA = pick(2, 9);
    const factorB = pick(2, 10);
    if (gate % 2 === 1) {
      const total = factorA * factorB;
      return {
        prompt: `${total} ÷ ${factorA} = ?`,
        visual: "🦕  SPLIT THE HERD  🦕",
        choices: choicesFor(factorB, 3, random),
        answer: factorB,
        hint: `What number times ${factorA} makes ${total}?`,
        skillId: "math-division",
        skillLabel: "Division facts",
        standard: "3.OA.C.7",
        operation: "division",
      };
    }
    const answer = factorA * factorB;
    return {
      prompt: `${factorA} × ${factorB} = ?`,
      visual: "⚡  ROAR MULTIPLIER  ⚡",
      choices: choicesFor(answer, factorA, random),
      answer,
      hint: `Add ${factorB}, ${factorA} times.`,
      skillId: "math-multiplication",
      skillLabel: "Multiplication facts",
      standard: "3.OA.C.7",
      operation: "multiplication",
    };
  }

  if (grade === 4) {
    if (gate % 2 === 1) {
      const left = pick(320, 890);
      const right = pick(120, Math.min(410, left));
      const answer = left - right;
      return {
        prompt: `${left} − ${right} = ?`,
        visual: "🪨  CANYON CALCULATION  🪨",
        choices: choicesFor(answer, 100, random),
        answer,
        hint: "Line up place values before subtracting.",
        skillId: "math-multi-digit-subtraction",
        skillLabel: "Multi-digit subtraction",
        standard: "4.NBT.B.4",
        operation: "subtraction",
      };
    }
    const left = pick(12, 35);
    const right = pick(3, 8);
    const answer = left * right;
    return {
      prompt: `${left} × ${right} = ?`,
      visual: "🦖  TITAN TURBO  🔥",
      choices: choicesFor(answer, 10, random),
      answer,
      hint: `Break ${left} into tens and ones, then multiply each part by ${right}.`,
      skillId: "math-multi-digit-multiplication",
      skillLabel: "Multiply by one digit",
      standard: "4.NBT.B.5",
      operation: "multiplication",
    };
  }

  if (gate % 2 === 1) {
    const divisor = pick(3, 9);
    const answer = pick(12, 35);
    const dividend = divisor * answer;
    return {
      prompt: `${dividend} ÷ ${divisor} = ?`,
      visual: "🌋  FINAL DIVIDE  🌋",
      choices: choicesFor(answer, 5, random),
      answer,
      hint: `Find the number that multiplied by ${divisor} makes ${dividend}.`,
      skillId: "math-division",
      skillLabel: "Divide whole numbers",
      standard: "5.NBT.B.6",
      operation: "division",
    };
  }

  const left = pick(24, 68);
  const right = pick(4, 9);
  const answer = left * right;
  return {
    prompt: `${left} × ${right} = ?`,
    visual: "☄️  METEOR MULTIPLIER  ☄️",
    choices: choicesFor(answer, 20, random),
    answer,
    hint: `Multiply ${right} by the tens and ones separately, then combine them.`,
    skillId: "math-multiplication",
    skillLabel: "Multi-digit multiplication",
    standard: "5.NBT.B.5",
    operation: "multiplication",
  };
}

export default function DinoDashVolcanoEscapePage() {
  const { activeProfile } = useFamilyProfiles();
  const grade = readProfileGrade(activeProfile);
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [run, setRun] = useState(0);
  const [screen, setScreen] = useState<Screen>("play");
  const [gate, setGate] = useState(0);
  const [phase, setPhase] = useState<DashPhase>("ready");
  const [lane, setLane] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongChoices, setWrongChoices] = useState<Set<number>>(new Set());
  const [wrongLogged, setWrongLogged] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [shields, setShields] = useState(MAX_SHIELDS);
  const [message, setMessage] = useState("Pick the answer gate. Dino dashes there automatically.");
  const [reward, setReward] = useState({ xp: 0, coins: 0 });
  const timerRef = useRef<number | null>(null);

  const questions = useMemo(
    () => Array.from({ length: GATE_COUNT }, (_, index) => makeQuestion(
      grade,
      index,
      `${activeProfile.id}:${run}:${index}`,
    )),
    [activeProfile.id, grade, run],
  );
  const current = questions[gate];

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function later(callback: () => void, delay: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(callback, delay);
  }

  function saveAttempt(correct: boolean) {
    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: "Math",
      skillId: current.skillId,
      skillLabel: current.skillLabel,
      prompt: current.prompt,
      correctAnswer: String(current.answer),
      correct,
      data: {
        answer: current.answer,
        grade,
        gate: gate + 1,
        operation: current.operation,
        standardCode: current.standard,
        retried: wrongLogged,
      },
    }, activeProfile.id);
  }

  function resetGate(nextGate: number) {
    setGate(nextGate);
    setPhase("ready");
    setLane(1);
    setSelected(null);
    setWrongChoices(new Set());
    setWrongLogged(false);
    setMessage("Choose the answer gate. Dino will take the lane.");
  }

  function choose(choice: number, choiceLane: number) {
    if (screen !== "play" || phase !== "ready" || wrongChoices.has(choice)) return;
    setSelected(choice);
    setLane(choiceLane);

    if (choice !== current.answer) {
      if (!wrongLogged) saveAttempt(false);
      setWrongLogged(true);
      setWrongChoices((values) => new Set([...values, choice]));
      setCombo(0);
      const nextShields = shields - 1;
      if (nextShields <= 0) {
        setShields(MAX_SHIELDS);
        setMessage(`Emergency egg shield! ${current.hint}`);
      } else {
        setShields(nextShields);
        setMessage(`Lava shield! ${current.hint}`);
      }
      setPhase("shield");
      later(() => {
        setSelected(null);
        setPhase("ready");
      }, 720);
      return;
    }

    saveAttempt(true);
    const nextCombo = wrongLogged ? 1 : combo + 1;
    const powerMove = nextCombo > 0 && nextCombo % 3 === 0;
    const gradePower = Math.max(0, grade) * 15;
    const points = 100 + gradePower + (powerMove ? 175 : 0);
    const nextScore = score + points;
    const nextFirstTry = firstTry + (wrongLogged ? 0 : 1);
    const xp = 28 + nextFirstTry * 3 + Math.max(0, grade) * 2;
    const coins = 8 + Math.floor(nextFirstTry / 2);

    setScore(nextScore);
    setFirstTry(nextFirstTry);
    setCombo(nextCombo);
    setPhase(powerMove ? "roar" : "boost");
    setMessage(powerMove ? `ROAR BOOST! +${points} points` : `Turbo gate! +${points} points`);

    later(() => {
      if (gate >= GATE_COUNT - 1) {
        setReward({ xp, coins });
        completeGame({ xp, coins, score: nextScore });
        setScreen("complete");
        return;
      }
      resetGate(gate + 1);
    }, powerMove ? 1050 : 760);
  }

  function replay() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    restartGame();
    setRun((value) => value + 1);
    setScreen("play");
    setGate(0);
    setPhase("ready");
    setLane(1);
    setSelected(null);
    setWrongChoices(new Set());
    setWrongLogged(false);
    setScore(0);
    setCombo(0);
    setFirstTry(0);
    setShields(MAX_SHIELDS);
    setReward({ xp: 0, coins: 0 });
    setMessage("Pick the answer gate. Dino dashes there automatically.");
  }

  if (screen === "complete") {
    return (
      <GameFrame title="Dino Dash: Volcano Escape">
        <section className={styles.finish} data-dino-complete="true">
          <div className={styles.finishSky} aria-hidden="true">🌋　☄️　✨　🦖</div>
          <span className={styles.eyebrow}>ESCAPE COMPLETE</span>
          <h1>Volcano escaped!</h1>
          <p>Your dinosaur cleared all {GATE_COUNT} answer gates without a single Next button.</p>
          <div className={styles.finishStats}>
            <div><span>Score</span><strong>{score}</strong></div>
            <div><span>First try</span><strong>{firstTry}/{GATE_COUNT}</strong></div>
            <div><span>Earned</span><strong>+{reward.xp} XP · +{reward.coins} coins</strong></div>
          </div>
          <div className={styles.finishActions}>
            <button type="button" onClick={replay}>Play again</button>
            <Link href="/">Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Dino Dash: Volcano Escape">
      <main
        className={`${styles.shell} ${styles[`phase_${phase}`]}`}
        data-dino-dash="active"
        data-dino-gate={gate + 1}
        data-dino-phase={phase}
        data-dino-score={score}
        data-dino-shields={shields}
      >
        <header className={styles.hud}>
          <div><span>GATE</span><strong>{gate + 1}/{GATE_COUNT}</strong></div>
          <div><span>SCORE</span><strong>{score}</strong></div>
          <div><span>ROAR COMBO</span><strong>{combo > 0 ? `${combo}×` : "READY"}</strong></div>
          <div><span>SHIELDS</span><strong>{Array.from({ length: MAX_SHIELDS }, (_, index) => index < shields ? "🥚" : "·").join("")}</strong></div>
        </header>

        <div className={styles.progress} aria-hidden="true">
          {Array.from({ length: GATE_COUNT }, (_, index) => (
            <i key={index} className={index < gate ? styles.cleared : index === gate ? styles.current : ""} />
          ))}
        </div>

        <section className={styles.arena}>
          <div className={styles.sky} aria-hidden="true">
            <span className={styles.sun}>☀️</span>
            <span className={styles.meteor}>☄️</span>
            <span className={styles.volcano}>🌋</span>
            <span className={styles.smoke}>☁️ ☁️</span>
          </div>

          <div className={styles.track} aria-hidden="true">
            <i /><i /><i />
            <div className={styles.dino} style={{ "--dino-lane": lane } as React.CSSProperties}>
              <span>{phase === "shield" ? "🥚" : "🦖"}</span>
              <small>{phase === "roar" ? "ROAR BOOST!" : phase === "boost" ? "TURBO!" : phase === "shield" ? "SHIELD!" : "DASH!"}</small>
            </div>
            <div className={styles.lava}>🔥　🔥　🔥　🔥　🔥</div>
          </div>

          <div className={styles.questionCard}>
            <div className={styles.questionMeta}>
              <span className={styles.eyebrow}>{gradeLabel(grade)} · {current.standard}</span>
              <span>{current.skillLabel}</span>
            </div>
            <h1>{current.prompt}</h1>
            <div className={styles.visual} aria-hidden="true">{current.visual}</div>
            <p className={styles.message}>{message}</p>
          </div>

          <div className={styles.gates} aria-label="Answer gates">
            {current.choices.map((choice, index) => {
              const correct = choice === current.answer;
              const wrong = wrongChoices.has(choice);
              const chosen = selected === choice;
              return (
                <button
                  type="button"
                  key={choice}
                  className={`${styles.gate}${chosen ? ` ${styles.chosen}` : ""}${wrong ? ` ${styles.wrong}` : ""}`}
                  onClick={() => choose(choice, index)}
                  disabled={phase !== "ready" || wrong}
                  data-dino-answer={choice}
                  data-correct={correct ? "true" : "false"}
                  aria-label={`Lane ${index + 1}, answer ${choice}`}
                >
                  <small>LANE {index + 1}</small>
                  <strong>{choice}</strong>
                  <span aria-hidden="true">{correct && phase !== "ready" ? "⚡" : wrong ? "🛡️" : "🏁"}</span>
                </button>
              );
            })}
          </div>
          <p className={styles.help}>Tap one answer gate. The dinosaur changes lanes automatically.</p>
        </section>
      </main>
    </GameFrame>
  );
}
