"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./HumanBodyExplorer.module.css";

const SLUG = "human-body-explorer";
const LAB_MODES = ["neon", "ocean", "sunrise", "midnight"] as const;
const MECHANICS = ["scan", "place", "route", "scan", "place", "route"] as const;

type Mechanic = (typeof MECHANICS)[number];
type Choice = { id: string; emoji: string; label: string; note: string };
type BodySystem = { id: string; emoji: string; label: string; x: number; y: number };
type Mission = {
  mechanic: Mechanic;
  prompt: string;
  instruction: string;
  choices: Choice[];
  answerId: string;
  hint: string;
  explanation: string;
  skillId: string;
  skillLabel: string;
  standard: string;
  system: BodySystem;
};
type MissionSeed = Omit<Mission, "mechanic" | "system">;
type World = { title: string; accent: string; patient: string; intro: string };

const SYSTEMS: BodySystem[] = [
  { id: "circulation", emoji: "🫀", label: "Circulation", x: 45, y: 42 },
  { id: "breathing", emoji: "🫁", label: "Breathing", x: 58, y: 38 },
  { id: "control", emoji: "🧠", label: "Control", x: 51, y: 13 },
  { id: "digestion", emoji: "🥣", label: "Digestion", x: 52, y: 58 },
  { id: "protection", emoji: "🦴", label: "Protection", x: 34, y: 66 },
  { id: "signals", emoji: "⚡", label: "Signals", x: 68, y: 69 },
];

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: { title: "Tiny Body Helper Lab", accent: "#ffd45c", patient: "🧒", intro: "Find the body helpers that keep a person moving, breathing, and thinking." },
  0: { title: "Rainbow Body Rescue", accent: "#ff9bd2", patient: "🧒", intro: "Wake up six body systems with simple clues and careful repairs." },
  1: { title: "Superhero Health Station", accent: "#8dd7ff", patient: "🦸", intro: "Scan organs, install body modules, and route messages through a superhero suit." },
  2: { title: "Dino-Medic Rescue Lab", accent: "#d9ff5b", patient: "🧑‍🚀", intro: "Repair a living exploration suit by proving how the body really works." },
  3: { title: "Bio-Tech Systems Bay", accent: "#c6b8ff", patient: "🤖", intro: "Bring connected organ systems online and trace how they work together." },
  4: { title: "Human Systems Command", accent: "#ffcb66", patient: "🧑‍🔬", intro: "Diagnose system failures, place critical structures, and restore body pathways." },
  5: { title: "Deep Biology Rescue Deck", accent: "#77f1d0", patient: "🧬", intro: "Use evidence about interacting systems to stabilize the whole body." },
};

function choice(id: string, emoji: string, label: string, note: string): Choice {
  return { id, emoji, label, note };
}

function seed(
  prompt: string,
  answerId: string,
  choices: Choice[],
  details: Pick<MissionSeed, "instruction" | "hint" | "explanation" | "skillId" | "skillLabel" | "standard">,
): MissionSeed {
  return { prompt, answerId, choices, ...details };
}

function earlyMissions(grade: ElementaryGrade): MissionSeed[] {
  const standard = grade === -1 ? "TK-LS1-1" : "K-LS1-1";
  return [
    seed("Which body helper pushes blood everywhere?", "heart", [
      choice("heart", "🫀", "Heart", "Strong pump"),
      choice("lungs", "🫁", "Lungs", "Air helpers"),
      choice("stomach", "🥣", "Stomach", "Food mixer"),
    ], { instruction: "Tap the scanner window with the blood pump.", hint: "Put a hand on your chest and feel the beat.", explanation: "The heart squeezes again and again to move blood.", skillId: "health-heart-function", skillLabel: "Identify the heart's job", standard }),
    seed("The patient needs the parts that bring air in. Which module belongs in the chest?", "lungs", [
      choice("brain", "🧠", "Brain", "Thinking center"),
      choice("lungs", "🫁", "Lungs", "Breathing pair"),
      choice("skull", "💀", "Skull", "Hard protector"),
    ], { instruction: "Tap the lung module, or drag it into the repair dock.", hint: "Take a slow breath. Which parts fill with air?", explanation: "The lungs pull oxygen from the air into the body.", skillId: "health-lung-function", skillLabel: "Identify the lungs' job", standard }),
    seed("Which control center tells your body when to move?", "brain", [
      choice("brain", "🧠", "Brain → body", "Movement command"),
      choice("stomach", "🥣", "Stomach → body", "Food mixing"),
      choice("heart", "🫀", "Heart → body", "Blood pumping"),
    ], { instruction: "Launch the movement message from the correct control center.", hint: "It is protected inside your head.", explanation: "The brain controls movement, senses, thoughts, and memory.", skillId: "health-brain-function", skillLabel: "Identify the brain's job", standard }),
    seed("Which body helper mixes food after you swallow?", "stomach", [
      choice("lungs", "🫁", "Lungs", "Move air"),
      choice("stomach", "🥣", "Stomach", "Mix food"),
      choice("heart", "🫀", "Heart", "Move blood"),
    ], { instruction: "Scan the organ that helps break food down.", hint: "It sits in your belly, not your chest or head.", explanation: "The stomach churns food and mixes it with digestive juices.", skillId: "health-digestion-function", skillLabel: "Identify the stomach's job", standard }),
    seed("Which hard structure protects the brain?", "skull", [
      choice("muscle", "💪", "Muscle", "Pulls to move"),
      choice("skin", "🖐️", "Skin", "Outer covering"),
      choice("skull", "💀", "Skull", "Hard helmet"),
    ], { instruction: "Place the strongest protector around the control center.", hint: "Feel the hard shape around your head.", explanation: "The skull is bone that protects the brain.", skillId: "health-skeleton-function", skillLabel: "Identify how bones protect", standard }),
    seed("What carries fast messages between the brain and the rest of the body?", "nerves", [
      choice("nerves", "⚡", "Brain → nerves → body", "Fast signals"),
      choice("food", "🍎", "Food → stomach → mouth", "Wrong direction"),
      choice("air", "💨", "Air → bones → hand", "No signal path"),
    ], { instruction: "Route the message through the pathway that carries signals.", hint: "The pathway is a network of tiny message-carrying fibers.", explanation: "Nerves carry electrical signals between the brain, spinal cord, and body.", skillId: "health-nervous-system", skillLabel: "Trace a simple nerve signal", standard }),
  ];
}

function lowerElementaryMissions(grade: ElementaryGrade): MissionSeed[] {
  const standards = grade === 1
    ? ["1-LS1-1", "1-LS1-1", "1-LS1-1", "1-LS1-1", "1-LS1-1", "1-LS1-1"]
    : ["2-LS1-1", "2-LS2-1", "2-LS1-1", "2-LS1-1", "2-LS1-1", "2-LS2-1"];
  return [
    seed("The patient needs blood moving to every body part. Which organ powers the trip?", "heart", [
      choice("heart", "🫀", "Heart", "Pumps blood"),
      choice("lungs", "🫁", "Lungs", "Exchange gases"),
      choice("stomach", "🥣", "Stomach", "Digests food"),
    ], { instruction: "Use the scanner to find the organ that pumps blood.", hint: "Look for the muscular organ that beats in the chest.", explanation: "The heart is a muscle that pumps blood through blood vessels.", skillId: "health-circulatory-system", skillLabel: "Explain the heart's role", standard: standards[0] }),
    seed("Oxygen must enter the body before the blood can deliver it. Which organ module goes in the chest?", "lungs", [
      choice("brain", "🧠", "Brain", "Processes information"),
      choice("lungs", "🫁", "Lungs", "Exchange oxygen and carbon dioxide"),
      choice("skull", "💀", "Skull", "Protects the brain"),
    ], { instruction: "Tap the correct module, or drag it into the body repair dock.", hint: "Think about which organs expand when you inhale.", explanation: "The lungs move oxygen into the body and carbon dioxide out.", skillId: "health-respiratory-system", skillLabel: "Explain the lungs' role", standard: standards[1] }),
    seed("A hand touches something hot. Which control center helps the body react?", "brain", [
      choice("brain", "🧠", "Sense → brain → action", "Process and respond"),
      choice("stomach", "🥣", "Sense → stomach → action", "Digestive route"),
      choice("heart", "🫀", "Sense → heart → action", "Circulation route"),
    ], { instruction: "Route the warning signal through the correct control center.", hint: "The organ in the skull interprets what the senses detect.", explanation: "The brain receives information and coordinates a response through the nervous system.", skillId: "health-brain-and-senses", skillLabel: "Connect senses to brain responses", standard: standards[2] }),
    seed("Food has been chewed and swallowed. Which organ begins the next mixing stage?", "stomach", [
      choice("lungs", "🫁", "Lungs", "Gas exchange"),
      choice("stomach", "🥣", "Stomach", "Churns food"),
      choice("heart", "🫀", "Heart", "Pumps blood"),
    ], { instruction: "Scan the organ that churns food during digestion.", hint: "This muscular sac sits below the ribs.", explanation: "The stomach mechanically churns food and mixes it with digestive juices.", skillId: "health-digestive-system", skillLabel: "Sequence early digestion", standard: standards[3] }),
    seed("The brain needs a rigid shield. Which structure should the repair arm install?", "skull", [
      choice("muscle", "💪", "Muscle", "Creates movement"),
      choice("skin", "🖐️", "Skin", "Covers the outside"),
      choice("skull", "💀", "Skull", "Protective bone"),
    ], { instruction: "Tap or drag the protective structure into the repair dock.", hint: "Choose the hard bone surrounding the brain.", explanation: "The skull protects the brain from many everyday impacts.", skillId: "health-skeletal-system", skillLabel: "Explain a protective bone function", standard: standards[4] }),
    seed("The brain has decided to move the hand. Which route carries the command?", "nerves", [
      choice("nerves", "⚡", "Brain → nerves → muscles", "Movement signal"),
      choice("blood", "🩸", "Brain → blood → bones", "Circulation path"),
      choice("air", "💨", "Lungs → air → fingers", "Breathing path"),
    ], { instruction: "Launch the command along the correct body pathway.", hint: "Electrical messages travel through the nervous system to muscles.", explanation: "Nerves carry the brain's command, then muscles contract to create movement.", skillId: "health-neuromuscular-pathway", skillLabel: "Trace a movement command", standard: standards[5] }),
  ];
}

function upperElementaryMissions(grade: ElementaryGrade): MissionSeed[] {
  const standard = grade === 3 ? "3-LS3-2" : grade === 4 ? "4-LS1-1" : "5-LS1-1";
  return [
    seed("Which organ creates the pressure that drives blood through the circulatory system?", "heart", [
      choice("heart", "🫀", "Heart", "Muscular pressure pump"),
      choice("lungs", "🫁", "Lungs", "Gas-exchange surface"),
      choice("stomach", "🥣", "Stomach", "Digestive chamber"),
    ], { instruction: "Scan for the organ whose contractions drive circulation.", hint: "Its chambers squeeze in a repeating cycle.", explanation: "Coordinated heart contractions generate pressure that moves blood through vessels.", skillId: "health-circulatory-system", skillLabel: "Model circulation as a pumping system", standard }),
    seed("Which paired organs provide the exchange surface where oxygen enters blood?", "lungs", [
      choice("brain", "🧠", "Brain", "Information processing"),
      choice("lungs", "🫁", "Lungs", "Gas exchange"),
      choice("skull", "💀", "Skull", "Mechanical protection"),
    ], { instruction: "Install the gas-exchange module in the chest repair dock.", hint: "Choose the organs containing millions of tiny air sacs.", explanation: "At the lungs' air sacs, oxygen diffuses into blood while carbon dioxide leaves it.", skillId: "health-respiratory-system", skillLabel: "Explain gas exchange", standard }),
    seed("Which route best models how a sensory warning becomes a coordinated action?", "brain", [
      choice("brain", "🧠", "Sense receptor → nerves → brain → motor nerves", "Process then respond"),
      choice("stomach", "🥣", "Sense receptor → stomach → muscles", "Digestive detour"),
      choice("heart", "🫀", "Sense receptor → heart → bones", "Circulatory detour"),
    ], { instruction: "Route the warning through the system that processes information and sends a response.", hint: "Information travels inward through sensory nerves and outward through motor nerves.", explanation: "The nervous system detects a stimulus, processes it, and coordinates a motor response.", skillId: "health-nervous-system", skillLabel: "Model a stimulus-response pathway", standard }),
    seed("Which organ mechanically churns food and begins strong chemical digestion of proteins?", "stomach", [
      choice("lungs", "🫁", "Lungs", "Exchange gases"),
      choice("stomach", "🥣", "Stomach", "Churns and acidifies food"),
      choice("heart", "🫀", "Heart", "Pressurizes blood"),
    ], { instruction: "Scan the digestive chamber described by the evidence.", hint: "It uses muscular walls and acidic digestive fluid.", explanation: "The stomach combines mechanical churning with acid and enzymes to continue digestion.", skillId: "health-digestive-system", skillLabel: "Explain stomach digestion", standard }),
    seed("Which rigid structure protects the brain while giving muscles attachment points for head movement?", "skull", [
      choice("muscle", "💪", "Muscle", "Contracts to pull"),
      choice("skin", "🖐️", "Skin", "Flexible outer barrier"),
      choice("skull", "💀", "Skull", "Rigid protection and support"),
    ], { instruction: "Install the structure that provides both protection and support.", hint: "It is part of the skeletal system and surrounds the brain.", explanation: "The skull protects the brain and provides structure for the face and muscle attachment.", skillId: "health-skeletal-system", skillLabel: "Connect skeletal structure to function", standard }),
    seed("Which pathway correctly connects a decision in the brain to movement at the hand?", "nerves", [
      choice("nerves", "⚡", "Brain → spinal cord → motor nerves → muscles", "Coordinated movement"),
      choice("blood", "🩸", "Brain → arteries → bones → hand", "Circulation only"),
      choice("air", "💨", "Lungs → trachea → fingers", "Respiration only"),
    ], { instruction: "Launch the motor command through the complete signal route.", hint: "The command travels through the central nervous system, then peripheral nerves, before muscles contract.", explanation: "Motor signals pass from the brain through the spinal cord and nerves to activate muscles.", skillId: "health-neuromuscular-pathway", skillLabel: "Trace a motor pathway", standard }),
  ];
}

function missionSeedsForGrade(grade: ElementaryGrade): MissionSeed[] {
  if (grade <= 0) return earlyMissions(grade);
  if (grade <= 2) return lowerElementaryMissions(grade);
  return upperElementaryMissions(grade);
}

function rotate<T>(items: T[], amount: number): T[] {
  if (items.length === 0) return items;
  const offset = ((amount % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function buildMissions(grade: ElementaryGrade, runSeed: number): Mission[] {
  const seeds = rotate(missionSeedsForGrade(grade), runSeed);
  const systems = rotate(SYSTEMS, runSeed);
  const mechanics = rotate([...MECHANICS], runSeed % MECHANICS.length);
  return seeds.map((mission, index) => ({ ...mission, mechanic: mechanics[index], system: systems[index] }));
}

function mechanicCopy(mechanic: Mechanic): { label: string; icon: string; coach: string } {
  if (mechanic === "place") return { label: "REPAIR ARM", icon: "🦾", coach: "Choose a module, then tap it or drag it into the dock." };
  if (mechanic === "route") return { label: "SIGNAL ROUTER", icon: "⚡", coach: "Choose the pathway that correctly connects the body systems." };
  return { label: "BODY SCANNER", icon: "🔬", coach: "Compare the scan results and select the organ supported by the clue." };
}

export default function Page() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(SLUG);
  const [grade, setGrade] = useState<ElementaryGrade>(() => readProfileGrade(activeProfile));
  const [runSeed, setRunSeed] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [independent, setIndependent] = useState(0);
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("Emergency scan active. The first body system needs help now.");
  const timerRef = useRef<number | null>(null);
  const world = WORLDS[grade];
  const missions = useMemo(() => buildMissions(grade, runSeed), [grade, runSeed]);
  const mission = missions[roundIndex];
  const completed = roundIndex + (solved ? 1 : 0);
  const labMode = LAB_MODES[(grade + 1 + runSeed) % LAB_MODES.length];
  const copy = mechanicCopy(mission.mechanic);

  useEffect(() => {
    if (hydrated) setGrade(readProfileGrade(activeProfile));
  }, [activeProfile, hydrated]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function schedule(callback: () => void, delay: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(callback, delay);
  }

  function finishOrAdvance(finalIndependent: number) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (roundIndex === missions.length - 1) {
      completeGame({ xp: 24 + finalIndependent * 4, coins: 6 + finalIndependent, score: missions.length });
      setDone(true);
      return;
    }
    setRoundIndex((value) => value + 1);
    setMisses(0);
    setSolved(false);
    setMessage("System online. The rescue computer has already opened the next repair.");
  }

  function chooseAnswer(answerId: string) {
    if (solved || done) return;
    const selected = mission.choices.find((item) => item.id === answerId);
    if (!selected) return;
    const correct = answerId === mission.answerId;
    const correctChoice = mission.choices.find((item) => item.id === mission.answerId);

    recordLearningAttempt({
      gameSlug: SLUG,
      subject: "Science",
      skillId: mission.skillId,
      skillLabel: mission.skillLabel,
      prompt: mission.prompt,
      correctAnswer: correctChoice?.label ?? mission.answerId,
      correct,
      data: {
        grade,
        standardCode: mission.standard,
        supportUsed: misses > 0,
        interaction: `body-${mission.mechanic}`,
        runSeed,
      },
    }, activeProfile.id);

    if (!correct) {
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setMessage(nextMisses === 1 ? `Med-bot clue: ${mission.hint}` : `System model: ${mission.explanation}`);
      return;
    }

    const finalIndependent = independent + (misses === 0 ? 1 : 0);
    setIndependent(finalIndependent);
    setSolved(true);
    setMessage(`${mission.system.label} online. ${mission.explanation}`);
    schedule(() => finishOrAdvance(finalIndependent), 950);
  }

  function replay() {
    restartGame();
    setRunSeed((value) => value + 1);
    setRoundIndex(0);
    setMisses(0);
    setIndependent(0);
    setSolved(false);
    setDone(false);
    setMessage("New patient profile loaded. The lab is already scanning a different system order.");
  }

  const patient = (
    <section
      className={styles.patientBay}
      data-body-patient="active"
      data-lab-mode={labMode}
      data-systems-online={completed}
      aria-label={`${world.title} body systems display`}
      style={{ "--accent": world.accent } as React.CSSProperties}
    >
      <div className={styles.labGlow} />
      <div className={styles.monitor}><span>VITAL SYSTEMS</span><strong>{completed}/6 ONLINE</strong></div>
      <div className={styles.patientSilhouette} aria-hidden="true">
        <span className={styles.patientHead}>{world.patient}</span>
        <span className={styles.bodyCore} />
        <span className={styles.leftArm} />
        <span className={styles.rightArm} />
        <span className={styles.leftLeg} />
        <span className={styles.rightLeg} />
        <span className={styles.scanBeam} data-repair-pulse={completed} />
      </div>
      {missions.map((item, index) => {
        const system = item.system;
        const status = index < completed ? "complete" : index === completed ? "active" : "locked";
        return (
          <span
            key={`${system.id}-${index}`}
            className={styles.systemNode}
            style={{ left: `${system.x}%`, top: `${system.y}%` }}
            data-status={status}
            aria-label={`${system.label}, ${status}`}
          >
            <b aria-hidden="true">{system.emoji}</b>
            <small>{system.label}</small>
          </span>
        );
      })}
      <div className={styles.energyTrack} aria-label={`${completed} of 6 body systems online`}>
        <span style={{ width: `${(completed / missions.length) * 100}%` }} />
      </div>
    </section>
  );

  if (done) {
    return (
      <GameFrame title="Human Body Explorer">
        <main className={styles.page} style={{ "--accent": world.accent } as React.CSSProperties}>
          <section className={styles.complete} data-body-complete="true">
            <span className={styles.eyebrow}>BODY MISSION COMPLETE</span>
            <h1>{activeProfile.name} restored every system.</h1>
            <p>{missions.length} verified repairs · {independent} independent solves · one fully powered patient</p>
            {patient}
            <button type="button" onClick={replay} className={styles.primary}>Play again</button>
          </section>
        </main>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Human Body Explorer">
      <main
        className={styles.page}
        style={{ "--accent": world.accent } as React.CSSProperties}
        data-body-lab="active"
        data-run-seed={runSeed}
        data-round={roundIndex + 1}
        data-mechanic={mission.mechanic}
      >
        <header className={styles.hud}>
          <div>
            <span className={styles.eyebrow}>RESCUE {roundIndex + 1} OF {missions.length}</span>
            <strong>{world.title}</strong>
            <small>{world.intro}</small>
          </div>
          <div className={styles.hudStats}>
            <span>🧬 {completed}/6</span>
            <span>✨ {independent}</span>
          </div>
        </header>

        <div className={styles.layout}>
          {patient}
          <section className={styles.missionCard} data-misses={misses} data-solved={solved ? "true" : "false"}>
            <div className={styles.missionTop}>
              <span className={styles.mechanic}>{copy.label}</span>
              <span className={styles.standard}>{mission.standard}</span>
            </div>
            <div className={styles.missionIcon} aria-hidden="true">{copy.icon}</div>
            <h1>{mission.prompt}</h1>
            <p className={styles.instruction}>{mission.instruction}</p>

            <div className={`${styles.choices} ${styles[`choices_${mission.mechanic}`]}`} aria-label={`${copy.label} choices`}>
              {mission.choices.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.choice}
                  onClick={() => chooseAnswer(item.id)}
                  draggable={mission.mechanic === "place" && !solved}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                  disabled={solved}
                  data-correct={item.id === mission.answerId ? "true" : "false"}
                  data-coach-target={misses >= 2 && item.id === mission.answerId ? "true" : "false"}
                  aria-label={item.label}
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                  {mission.mechanic === "scan" && <i aria-hidden="true">SCAN {index + 1}</i>}
                  {mission.mechanic === "route" && <i aria-hidden="true">LAUNCH ➜</i>}
                </button>
              ))}
            </div>

            {mission.mechanic === "place" && (
              <div
                className={styles.dropZone}
                aria-label="Body repair dock"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  chooseAnswer(event.dataTransfer.getData("text/plain"));
                }}
              >
                <span aria-hidden="true">⬇</span><strong>BODY REPAIR DOCK</strong><span aria-hidden="true">⬇</span>
              </div>
            )}

            <section className={styles.coach} role="status" aria-live="polite">
              <strong>{misses > 0 ? "MED-BOT COACH" : solved ? "SYSTEM ONLINE" : copy.label}</strong>
              <p>{misses === 0 && !solved ? copy.coach : message}</p>
              {solved && (
                <button type="button" className={styles.manualAdvance} onClick={() => finishOrAdvance(independent)}>
                  {roundIndex === missions.length - 1 ? "See restored body" : "Next repair"}
                </button>
              )}
            </section>
          </section>
        </div>
      </main>
    </GameFrame>
  );
}
