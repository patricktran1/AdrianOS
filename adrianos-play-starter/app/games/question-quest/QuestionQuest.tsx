"use client";

import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./QuestionQuest.module.css";

const SLUG = "question-quest";
const LAB_THEMES = ["aurora", "storm", "ocean", "sunrise"] as const;

type Mechanic = "assemble" | "route" | "calibrate";
type Choice = { id: string; emoji: string; label: string; note: string };
type Pod = { id: string; emoji: string; label: string; x: number; y: number };
type Gauge = {
  min: number;
  max: number;
  step: number;
  start: number;
  target: number;
  lowLabel: string;
  highLabel: string;
  targetLabel: string;
};
type Mission = {
  id: string;
  mechanic: Mechanic;
  topic: string;
  prompt: string;
  instruction: string;
  choices?: Choice[];
  answerId?: string;
  gauge?: Gauge;
  hint: string;
  explanation: string;
  skillId: string;
  skillLabel: string;
  standard: string;
  pod: Pod;
};
type World = { title: string; accent: string; intro: string; badge: string };
type Band = "early" | "lower" | "upper";

const PODS: Pod[] = [
  { id: "computer", emoji: "💻", label: "Loading Lab", x: 20, y: 23 },
  { id: "lightning", emoji: "⚡", label: "Storm Chamber", x: 50, y: 13 },
  { id: "snow", emoji: "❄️", label: "Snow Press", x: 80, y: 25 },
  { id: "cooling", emoji: "💧", label: "Cooling Tunnel", x: 82, y: 66 },
  { id: "air", emoji: "🫁", label: "Air Station", x: 50, y: 79 },
  { id: "energy", emoji: "💡", label: "Power Room", x: 18, y: 66 },
];

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: { title: "Little Why Lab", accent: "#ffd45c", intro: "Touch, move, and test six tiny wonders.", badge: "TINY SCIENTIST" },
  0: { title: "Rainbow Wonder Workshop", accent: "#ff9bd2", intro: "Build simple experiments and watch each idea light up.", badge: "WONDER BUILDER" },
  1: { title: "Super Question Station", accent: "#8dd7ff", intro: "Operate machines that explain everyday mysteries.", badge: "QUESTION PILOT" },
  2: { title: "Adrian's Why Lab", accent: "#d9ff5b", intro: "Turn real questions into working experiments, one chamber at a time.", badge: "WHY ENGINEER" },
  3: { title: "Discovery Systems Deck", accent: "#c6b8ff", intro: "Model hidden processes by assembling, routing, and calibrating them.", badge: "SYSTEMS EXPLORER" },
  4: { title: "Wonder Research Command", accent: "#ffcb66", intro: "Use evidence to operate six connected science experiments.", badge: "RESEARCH LEAD" },
  5: { title: "Advanced Curiosity Reactor", accent: "#77f1d0", intro: "Test mechanisms, energy transfers, and cause-effect systems.", badge: "CURIOSITY CHIEF" },
};

function bandForGrade(grade: ElementaryGrade): Band {
  if (grade <= 0) return "early";
  if (grade <= 2) return "lower";
  return "upper";
}

function standardFor(grade: ElementaryGrade, topic: string): string {
  const prefix = grade === -1 ? "TK" : grade === 0 ? "K" : String(grade);
  const suffix: Record<string, string> = {
    computer: "ETS1-1",
    lightning: "PS2-1",
    snow: "PS1-4",
    cooling: "PS3-1",
    air: "LS1-1",
    energy: "PS3-2",
  };
  return `${prefix}-${suffix[topic]}`;
}

function choice(id: string, emoji: string, label: string, note: string): Choice {
  return { id, emoji, label, note };
}

function baseMissionsForGrade(grade: ElementaryGrade): Mission[] {
  const band = bandForGrade(grade);
  const computerPrompt = band === "early"
    ? "The screen is blank. What should the computer gather before it can show the game?"
    : band === "lower"
      ? "Why does a computer need loading time before a game appears?"
      : "Which process best explains why a complex program needs loading time?";
  const computerAnswer = band === "early"
    ? "Instructions and pictures"
    : band === "lower"
      ? "It gathers instructions and data"
      : "It fetches and arranges code, images, and data";
  const computerNote = band === "upper" ? "Resources are retrieved, decoded, and prepared" : "The pieces needed for the next screen";

  const lightningPrompt = band === "early"
    ? "What builds up inside a storm cloud before lightning flashes?"
    : band === "lower"
      ? "Which route best shows how lightning can reach the ground?"
      : "What happens when the electric difference between cloud and ground becomes large enough?";
  const lightningAnswer = band === "early"
    ? "Electric charge"
    : band === "lower"
      ? "Cloud charge → air → ground"
      : "Charge discharges through the air";

  const snowTarget = band === "early" ? 2 : band === "lower" ? 3 : 4;
  const snowPrompt = band === "early"
    ? "Set enough squeeze to help loose snow stick together."
    : band === "lower"
      ? "Calibrate the snow press so pressure and a tiny melt layer can bond the crystals."
      : "Set the compression level that increases crystal contact and briefly melts the surface before refreezing.";

  const coolingPrompt = band === "early"
    ? "Which path helps wet skin become cooler?"
    : band === "lower"
      ? "Which route explains how sweat cools the body?"
      : "Which energy pathway correctly models evaporative cooling?";
  const coolingAnswer = band === "early"
    ? "Sweat → air → cooler skin"
    : band === "lower"
      ? "Sweat → evaporation → cooling"
      : "Liquid sweat absorbs heat → evaporates → temperature falls";

  const airPrompt = band === "early"
    ? "Which part of air does the body need to keep working?"
    : band === "lower"
      ? "Which gas should the air station send from the lungs into the blood?"
      : "Which gas is delivered to cells so they can release usable energy from food?";
  const airAnswer = band === "upper" ? "Oxygen for cellular energy" : "Oxygen";

  const energyPrompt = band === "early"
    ? "Nobody is in the room. Set the unused light to the best power level."
    : band === "lower"
      ? "An empty room's light is still on. Calibrate its power use."
      : "The room is empty and no task needs illumination. Set the efficient power level.";

  return [
    {
      id: "computer",
      mechanic: "assemble",
      topic: "Computer loading",
      prompt: computerPrompt,
      instruction: "Install the piece the computer actually needs. Tap it, or drag it into the loading bay.",
      choices: [
        choice("load", "🧩", computerAnswer, computerNote),
        choice("nap", "😴", "A computer nap", "Rest does not assemble the next screen"),
        choice("moon", "🌙", "Permission from the moon", "The moon is not part of the loading process"),
      ],
      answerId: "load",
      hint: "Think about the instructions, images, sounds, and other pieces the program must collect.",
      explanation: "Loading is the computer finding, reading, and arranging the resources needed for the next screen.",
      skillId: "science-computer-loading",
      skillLabel: "Model why computers load",
      standard: standardFor(grade, "computer"),
      pod: PODS[0],
    },
    {
      id: "lightning",
      mechanic: "route",
      topic: "Lightning",
      prompt: lightningPrompt,
      instruction: "Send the storm energy through the scientifically correct route.",
      choices: [
        choice("charge", "⚡", lightningAnswer, "Separated charge creates a strong electric difference"),
        choice("airplane", "✈️", "Clouds bump airplanes → flash", "Airplanes do not create ordinary lightning"),
        choice("photo", "📸", "Sunlight takes a photograph", "A flash is not a solar camera"),
      ],
      answerId: "charge",
      hint: "Positive and negative charges separate inside the storm cloud.",
      explanation: "When the electric difference becomes strong enough, charge moves rapidly through the air as lightning.",
      skillId: "science-lightning-charge",
      skillLabel: "Explain lightning as electric discharge",
      standard: standardFor(grade, "lightning"),
      pod: PODS[1],
    },
    {
      id: "snow",
      mechanic: "calibrate",
      topic: "Snowball",
      prompt: snowPrompt,
      instruction: "Move the pressure control, then run the experiment. The control stays still while you decide.",
      gauge: {
        min: 0,
        max: 4,
        step: 1,
        start: 0,
        target: snowTarget,
        lowLabel: "Loose snow",
        highLabel: "Firm press",
        targetLabel: `Pressure level ${snowTarget}`,
      },
      hint: band === "early" ? "Loose snow needs a gentle squeeze." : "More contact between crystals helps them bond, but the machine should not stay at zero.",
      explanation: "Pressure pushes snow crystals together and can melt a microscopic layer that refreezes into bonds.",
      skillId: "science-snow-crystal-bonding",
      skillLabel: "Explain how pressure forms a snowball",
      standard: standardFor(grade, "snow"),
      pod: PODS[2],
    },
    {
      id: "cooling",
      mechanic: "route",
      topic: "Sweat cooling",
      prompt: coolingPrompt,
      instruction: "Route heat through the process that lowers skin temperature.",
      choices: [
        choice("evaporate", "💧", coolingAnswer, "Evaporation carries thermal energy away"),
        choice("shine", "✨", "Sweat → shiny skin → cooling", "Shine is an appearance, not the cooling mechanism"),
        choice("store", "🫙", "Sweat → stored water → cooling", "Stored liquid does not remove heat by itself"),
      ],
      answerId: "evaporate",
      hint: "Watch what happens when liquid water disappears into the air.",
      explanation: "Sweat absorbs heat from the skin. When it evaporates, that energy leaves with the water vapor.",
      skillId: "science-evaporative-cooling",
      skillLabel: "Model evaporative cooling",
      standard: standardFor(grade, "cooling"),
      pod: PODS[3],
    },
    {
      id: "air",
      mechanic: "assemble",
      topic: "Breathing",
      prompt: airPrompt,
      instruction: "Install the gas the body needs. Tap it, or drag it into the air station.",
      choices: [
        choice("oxygen", "🫧", airAnswer, "Moves from lungs to blood and cells"),
        choice("smoke", "🌫️", "Smoke", "Particles and gases in smoke can harm breathing"),
        choice("steam", "♨️", "Hot steam", "Water vapor is not the gas cells need for respiration"),
      ],
      answerId: "oxygen",
      hint: "It is the gas carried by red blood cells after you inhale.",
      explanation: "The lungs move oxygen into the blood, which delivers it to cells throughout the body.",
      skillId: "science-oxygen-pathway",
      skillLabel: "Trace oxygen from air to cells",
      standard: standardFor(grade, "air"),
      pod: PODS[4],
    },
    {
      id: "energy",
      mechanic: "calibrate",
      topic: "Energy use",
      prompt: energyPrompt,
      instruction: "Set the light's power from 0 to 4, then test the room.",
      gauge: {
        min: 0,
        max: 4,
        step: 1,
        start: 4,
        target: 0,
        lowLabel: "Off",
        highLabel: "Full power",
        targetLabel: "Power level 0",
      },
      hint: "No one needs the light right now, so no electrical energy needs to become light and heat.",
      explanation: "Turning off an unused light prevents unnecessary electrical energy use.",
      skillId: "science-energy-conservation",
      skillLabel: "Choose efficient energy use",
      standard: standardFor(grade, "energy"),
      pod: PODS[5],
    },
  ];
}

function buildMissions(grade: ElementaryGrade, runSeed: number): Mission[] {
  const base = baseMissionsForGrade(grade);
  const offset = runSeed % base.length;
  return [...base.slice(offset), ...base.slice(0, offset)];
}

function mechanicCopy(mechanic: Mechanic): { eyebrow: string; icon: string } {
  if (mechanic === "route") return { eyebrow: "ROUTE THE PROCESS", icon: "🛤️" };
  if (mechanic === "calibrate") return { eyebrow: "CALIBRATE THE EXPERIMENT", icon: "🎚️" };
  return { eyebrow: "ASSEMBLE THE MACHINE", icon: "🦾" };
}

export default function QuestionQuest() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(SLUG);
  const [grade, setGrade] = useState<ElementaryGrade>(() => readProfileGrade(activeProfile));
  const [runSeed, setRunSeed] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [independent, setIndependent] = useState(0);
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("The first question is already inside the Wonder Engine.");
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [gaugeValue, setGaugeValue] = useState(0);
  const timerRef = useRef<number | null>(null);

  const world = WORLDS[grade];
  const missions = useMemo(() => buildMissions(grade, runSeed), [grade, runSeed]);
  const mission = missions[roundIndex];
  const completed = roundIndex + (solved ? 1 : 0);
  const theme = LAB_THEMES[(grade + 1 + runSeed) % LAB_THEMES.length];
  const copy = mechanicCopy(mission.mechanic);

  useEffect(() => {
    if (hydrated) setGrade(readProfileGrade(activeProfile));
  }, [activeProfile, hydrated]);

  useEffect(() => {
    setGaugeValue(mission.gauge?.start ?? 0);
  }, [mission.id, mission.gauge?.start]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function schedule(callback: () => void) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(callback, 950);
  }

  function recordAttempt(correct: boolean, selectedLabel: string, selectedValue?: number) {
    const correctAnswer = mission.mechanic === "calibrate"
      ? mission.gauge?.targetLabel ?? "Correct experiment setting"
      : mission.choices?.find((item) => item.id === mission.answerId)?.label ?? mission.answerId ?? "";
    recordLearningAttempt({
      gameSlug: SLUG,
      subject: "Science",
      skillId: mission.skillId,
      skillLabel: mission.skillLabel,
      prompt: mission.prompt,
      correctAnswer,
      correct,
      data: {
        grade,
        standardCode: mission.standard,
        supportUsed: misses > 0,
        interaction: `wonder-${mission.mechanic}`,
        topic: mission.topic,
        runSeed,
        selected: selectedLabel,
        ...(typeof selectedValue === "number" ? { experimentValue: selectedValue } : {}),
      },
    }, activeProfile.id);
  }

  function finishOrAdvance(finalIndependent: number) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (roundIndex === missions.length - 1) {
      completeGame({
        xp: 26 + finalIndependent * 4,
        coins: 7 + finalIndependent,
        score: missions.length,
      });
      setDone(true);
      return;
    }
    setRoundIndex((value) => value + 1);
    setMisses(0);
    setSolved(false);
    setLastWrong(null);
    setMessage("A new chamber opened automatically. Build the next explanation.");
  }

  function handleResult(correct: boolean, selectedLabel: string, selectedValue?: number, wrongKey?: string) {
    if (solved || done) return;
    recordAttempt(correct, selectedLabel, selectedValue);
    if (!correct) {
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setLastWrong(wrongKey ?? selectedLabel);
      setMessage(nextMisses === 1 ? `Wonder clue: ${mission.hint}` : `Experiment model: ${mission.explanation}`);
      return;
    }
    const finalIndependent = independent + (misses === 0 ? 1 : 0);
    setIndependent(finalIndependent);
    setSolved(true);
    setLastWrong(null);
    setMessage(`${mission.pod.label} powered. ${mission.explanation}`);
    schedule(() => finishOrAdvance(finalIndependent));
  }

  function chooseAnswer(answerId: string) {
    const selected = mission.choices?.find((item) => item.id === answerId);
    if (!selected) return;
    handleResult(answerId === mission.answerId, selected.label, undefined, answerId);
  }

  function runExperiment() {
    if (!mission.gauge) return;
    handleResult(
      gaugeValue === mission.gauge.target,
      `Experiment level ${gaugeValue}`,
      gaugeValue,
      "gauge",
    );
  }

  function replay() {
    restartGame();
    setRunSeed((value) => value + 1);
    setRoundIndex(0);
    setMisses(0);
    setIndependent(0);
    setSolved(false);
    setDone(false);
    setLastWrong(null);
    setMessage("The Wonder Engine remixed itself. A different experiment is already active.");
  }

  const engine = (
    <section
      className={styles.engine}
      data-wonder-engine="active"
      data-lab-theme={theme}
      data-pods-powered={completed}
      aria-label={`${world.title} Wonder Engine`}
      style={{ "--accent": world.accent } as React.CSSProperties}
    >
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.reactor} data-wonder-reactor="active" aria-hidden="true"><span>?</span><b>{completed}/6</b></div>
      {missions.map((item, index) => {
        const status = index < completed ? "complete" : index === completed ? "active" : "locked";
        return (
          <span
            key={`${item.id}-${index}`}
            className={styles.pod}
            style={{ left: `${item.pod.x}%`, top: `${item.pod.y}%` }}
            data-status={status}
            aria-label={`${item.pod.label}, ${status}`}
          >
            <b aria-hidden="true">{item.pod.emoji}</b>
            <small>{item.pod.label}</small>
          </span>
        );
      })}
      <div className={styles.powerTrack} aria-label={`${completed} of 6 experiment chambers powered`}>
        <span style={{ width: `${(completed / missions.length) * 100}%` }} />
      </div>
    </section>
  );

  if (done) {
    return (
      <main className={styles.page} style={{ "--accent": world.accent } as React.CSSProperties}>
        <section className={styles.complete} data-wonder-complete="true">
          <span className={styles.eyebrow}>WONDER ENGINE ONLINE</span>
          <h1>{activeProfile.name} powered the entire Why Lab.</h1>
          <p>{missions.length} experiments verified · {independent} independent discoveries · one curiosity reactor awake</p>
          {engine}
          <button type="button" onClick={replay} className={styles.primary}>Play again</button>
        </section>
      </main>
    );
  }

  return (
    <main
      className={styles.page}
      style={{ "--accent": world.accent } as React.CSSProperties}
      data-wonder-lab="active"
      data-run-seed={runSeed}
      data-round={roundIndex + 1}
      data-mechanic={mission.mechanic}
    >
      <header className={styles.hud}>
        <div>
          <span className={styles.eyebrow}>EXPERIMENT {roundIndex + 1} OF {missions.length}</span>
          <strong>{world.title}</strong>
          <small>{world.intro}</small>
        </div>
        <div className={styles.hudStats}>
          <span>🔬 {completed}/6</span>
          <span>✨ {independent}</span>
          <span>{world.badge}</span>
        </div>
      </header>

      <div className={styles.layout}>
        {engine}
        <section className={styles.missionCard} data-solved={solved ? "true" : "false"} data-misses={misses}>
          <div className={styles.missionTop}>
            <span className={styles.mechanic}>{copy.eyebrow}</span>
            <span className={styles.standard}>{mission.standard}</span>
          </div>
          <div className={styles.missionIcon} aria-hidden="true">{copy.icon}</div>
          <h1>{mission.prompt}</h1>
          <p className={styles.instruction}>{mission.instruction}</p>

          {mission.mechanic !== "calibrate" && mission.choices && (
            <div className={`${styles.choices} ${styles[`choices_${mission.mechanic}`]}`} aria-label={`${copy.eyebrow} choices`}>
              {mission.choices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.choice}
                  onClick={() => chooseAnswer(item.id)}
                  draggable={mission.mechanic === "assemble" && !solved}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                  disabled={solved}
                  data-correct={item.id === mission.answerId ? "true" : "false"}
                  data-choice-state={lastWrong === item.id ? "wrong" : "idle"}
                  data-coach-target={misses >= 2 && item.id === mission.answerId ? "true" : "false"}
                  aria-label={item.label}
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                  <i>{mission.mechanic === "assemble" ? "TAP OR DRAG" : "SEND THIS ROUTE"}</i>
                </button>
              ))}
            </div>
          )}

          {mission.mechanic === "assemble" && (
            <div
              className={styles.dropZone}
              aria-label="Wonder machine installation bay"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseAnswer(event.dataTransfer.getData("text/plain"));
              }}
            >
              <span aria-hidden="true">⬇</span><strong>INSTALLATION BAY</strong><span aria-hidden="true">⬇</span>
            </div>
          )}

          {mission.mechanic === "calibrate" && mission.gauge && (
            <section className={styles.calibrator} data-gauge-wrong={lastWrong === "gauge" ? "true" : "false"}>
              <div className={styles.gaugeReadout} aria-live="polite">
                <span>{mission.gauge.lowLabel}</span>
                <strong>{gaugeValue}</strong>
                <span>{mission.gauge.highLabel}</span>
              </div>
              <input
                type="range"
                min={mission.gauge.min}
                max={mission.gauge.max}
                step={mission.gauge.step}
                value={gaugeValue}
                onChange={(event) => setGaugeValue(Number(event.currentTarget.value))}
                disabled={solved}
                aria-label={`${mission.topic} experiment level`}
              />
              <button
                type="button"
                className={styles.runButton}
                onClick={runExperiment}
                disabled={solved}
                data-correct={gaugeValue === mission.gauge.target ? "true" : "false"}
                aria-label="Run experiment"
              >
                <span aria-hidden="true">▶</span> RUN EXPERIMENT
              </button>
            </section>
          )}

          <section className={styles.coach} role="status" aria-live="polite">
            <strong>{misses > 0 ? "WONDER COACH" : solved ? "CHAMBER POWERED" : "LAB NOTE"}</strong>
            <p>{message}</p>
            {solved && (
              <button type="button" className={styles.manualAdvance} onClick={() => finishOrAdvance(independent)}>
                {roundIndex === missions.length - 1 ? "See the powered lab" : "Open next chamber"}
              </button>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
