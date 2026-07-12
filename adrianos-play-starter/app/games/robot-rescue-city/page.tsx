"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import Link from "next/link";
import { useMemo, useState } from "react";

const GAME_SLUG = "robot-rescue-city";

type Subject = "Math" | "Reading" | "Science";
type Stage = "intro" | "play" | "garage" | "finish";
type Feedback = "question" | "hint" | "explanation";
type BotId = "spark" | "bolt" | "pixel";

type Mission = {
  zone: string;
  emoji: string;
  subject: Subject;
  standard: string;
  skillId: string;
  skillLabel: string;
  story: string;
  prompt: string;
  choices: string[];
  answer: string;
  hint: string;
  explanation: string;
  part: string;
};

const BOTS = {
  spark: { id: "spark" as const, emoji: "🤖", name: "Spark", power: "Clue battery", description: "Starts with two free clues that keep your combo alive." },
  bolt: { id: "bolt" as const, emoji: "🦾", name: "Bolt", power: "Power boost", description: "Earns an extra gear for first-try answers." },
  pixel: { id: "pixel" as const, emoji: "🛸", name: "Pixel", power: "Repair shield", description: "Blocks the first battery loss." },
};

const MISSIONS: Mission[] = [
  {
    zone: "Counting Crosswalk",
    emoji: "🚦",
    subject: "Math",
    standard: "1.OA.C.6",
    skillId: "math-addition-within-20",
    skillLabel: "Addition within 20",
    story: "Six delivery bots are waiting. Five more roll up to the crossing.",
    prompt: "How many bots are waiting now?",
    choices: ["9", "10", "11", "12"],
    answer: "11",
    hint: "Start at 6 and count on 5 more: 7, 8, 9, 10, 11.",
    explanation: "6 + 5 = 11. Counting on is a fast Grade 1 strategy.",
    part: "🛞 Wheels",
  },
  {
    zone: "Message Station",
    emoji: "📡",
    subject: "Reading",
    standard: "RL.1.1",
    skillId: "reading-key-details",
    skillLabel: "Key details",
    story: "The red robot carried the map because the blue robot needed both hands to lift a battery.",
    prompt: "Why did the red robot carry the map?",
    choices: ["The blue robot was lifting a battery", "The map was red", "The battery was tiny", "The road was closed"],
    answer: "The blue robot was lifting a battery",
    hint: "Find the part of the sentence that tells why.",
    explanation: "The sentence says the blue robot needed both hands to lift the battery.",
    part: "📡 Antenna",
  },
  {
    zone: "Shape Factory",
    emoji: "🏭",
    subject: "Math",
    standard: "1.G.A.2",
    skillId: "geometry-compose-shapes",
    skillLabel: "Compose shapes",
    story: "A repair panel needs one shape made from two equal triangles.",
    prompt: "Which shape can two equal triangles make?",
    choices: ["A square", "A circle", "A sphere", "A cone"],
    answer: "A square",
    hint: "Imagine cutting a square from corner to corner.",
    explanation: "A diagonal can split a square into two equal triangles, so the triangles can rebuild the square.",
    part: "🧩 Body panel",
  },
  {
    zone: "Weather Roof",
    emoji: "🌦️",
    subject: "Science",
    standard: "1-ESS1-2",
    skillId: "science-seasonal-patterns",
    skillLabel: "Seasonal patterns",
    story: "The city wants to schedule its longest outdoor robot parade when daylight lasts the longest.",
    prompt: "Which season usually has the longest daylight?",
    choices: ["Summer", "Winter", "Autumn", "All are always equal"],
    answer: "Summer",
    hint: "Think about the season when the sun stays up later.",
    explanation: "Summer usually has the longest daylight, while winter usually has the shortest.",
    part: "☀️ Solar panel",
  },
  {
    zone: "Word Workshop",
    emoji: "🔤",
    subject: "Reading",
    standard: "RF.1.3",
    skillId: "phonics-long-vowels",
    skillLabel: "Long-vowel patterns",
    story: "The robot needs the word that has the same long-a sound as cake.",
    prompt: "Which word has the same long-a sound?",
    choices: ["Game", "Cat", "Bed", "Fish"],
    answer: "Game",
    hint: "Look for a word with silent e making the vowel say its name.",
    explanation: "Game and cake both use a_e to make the long-a sound.",
    part: "🔊 Voice chip",
  },
  {
    zone: "Power Plant",
    emoji: "⚡",
    subject: "Science",
    standard: "1-PS4-4",
    skillId: "engineering-light-communication",
    skillLabel: "Light communication",
    story: "Two rescue teams are far apart in a noisy tunnel and need a silent signal.",
    prompt: "What could they use to send a message?",
    choices: ["Flashing lights", "A soft pillow", "A paper cup with no string", "A painted rock"],
    answer: "Flashing lights",
    hint: "Choose something the other team can see from far away.",
    explanation: "A pattern of flashing lights can communicate information without sound.",
    part: "💡 Signal light",
  },
];

function playTone(enabled: boolean, correct: boolean) {
  if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = correct ? "square" : "sine";
  oscillator.frequency.value = correct ? 720 : 190;
  gain.gain.setValueAtTime(0.06, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.15);
  oscillator.addEventListener("ended", () => void context.close());
}

export default function RobotRescueCityPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [stage, setStage] = useState<Stage>("intro");
  const [botId, setBotId] = useState<BotId>("spark");
  const [missionIndex, setMissionIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [battery, setBattery] = useState(3);
  const [shield, setShield] = useState(0);
  const [clues, setClues] = useState(2);
  const [gears, setGears] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [parts, setParts] = useState<string[]>([]);
  const [message, setMessage] = useState("Choose the best repair command.");
  const [soundOn, setSoundOn] = useState(true);

  const bot = BOTS[botId];
  const mission = MISSIONS[missionIndex];
  const grade = hydrated ? readProfileGrade(activeProfile) : 1;
  const batteryIcons = useMemo(() => Array.from({ length: Math.max(0, battery) }, () => "🔋").join(" ") || "🪫", [battery]);

  function startGame() {
    setBattery(3);
    setShield(botId === "pixel" ? 1 : 0);
    setClues(botId === "spark" ? 2 : 0);
    setStage("play");
  }

  function saveAttempt(correct: boolean) {
    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: mission.subject,
      skillId: mission.skillId,
      skillLabel: mission.skillLabel,
      prompt: `${mission.story} ${mission.prompt}`,
      correctAnswer: mission.answer,
      correct,
      data: { standardCode: mission.standard, zone: mission.zone, adaptiveSupport: wrongAttempts > 0 },
    }, activeProfile.id);
  }

  function loseBattery() {
    if (shield > 0) {
      setShield(0);
      return;
    }
    setBattery((value) => Math.max(0, value - 1));
  }

  function choose(choice: string) {
    if (feedback === "explanation") return;
    setSelected(choice);
    const correct = choice === mission.answer;

    if (!correct && wrongAttempts === 0) {
      saveAttempt(false);
      setWrongAttempts(1);
      setFeedback("hint");
      setCombo(0);
      loseBattery();
      setMessage(`Repair scan: ${mission.hint}`);
      playTone(soundOn, false);
      return;
    }

    if (!correct) {
      setWrongAttempts((value) => value + 1);
      setFeedback("explanation");
      setCombo(0);
      setMessage(`Auto-repair loaded the answer: ${mission.answer}. ${mission.explanation}`);
      playTone(soundOn, false);
      return;
    }

    saveAttempt(true);
    const firstTry = wrongAttempts === 0;
    const nextCombo = firstTry ? combo + 1 : 0;
    const reward = firstTry ? 2 + (botId === "bolt" ? 1 : 0) : 1;
    setGears((value) => value + reward);
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setParts((value) => [...value, mission.part]);
    setFeedback("explanation");
    setMessage(`${firstTry ? `Perfect repair! +${reward} gears.` : "Repair completed with support."} ${mission.explanation}`);
    playTone(soundOn, true);
  }

  function showHint() {
    if (feedback !== "question") return;
    setFeedback("hint");
    if (clues > 0) {
      setClues((value) => value - 1);
      setMessage(`Spark clue: ${mission.hint}`);
    } else {
      setCombo(0);
      setMessage(mission.hint);
    }
  }

  function advance() {
    if (missionIndex === MISSIONS.length - 1) {
      const score = gears * 100 + bestCombo * 25 + battery * 20;
      completeGame({ xp: 35 + gears + bestCombo * 2, coins: 8 + gears, score });
      setStage("finish");
      return;
    }
    if ((missionIndex + 1) % 2 === 0) {
      setStage("garage");
      return;
    }
    setMissionIndex((value) => value + 1);
    setFeedback("question");
    setSelected(null);
    setWrongAttempts(0);
    setMessage("Choose the best repair command.");
  }

  function continueFromGarage() {
    setBattery((value) => Math.max(value, 2));
    setMissionIndex((value) => value + 1);
    setFeedback("question");
    setSelected(null);
    setWrongAttempts(0);
    setMessage("A new city alert just arrived.");
    setStage("play");
  }

  function replay() {
    restartGame();
    setStage("intro");
    setMissionIndex(0);
    setFeedback("question");
    setSelected(null);
    setWrongAttempts(0);
    setBattery(3);
    setShield(0);
    setClues(2);
    setGears(0);
    setCombo(0);
    setBestCombo(0);
    setParts([]);
    setMessage("Choose the best repair command.");
  }

  if (stage === "intro") {
    return <GameFrame title="Robot Rescue City"><main style={page}><section style={heroCard}>
      <div style={heroEmoji}>🏙️🤖</div><span style={eyebrow}>GRADE 1 BUILD-AND-RESCUE ADVENTURE</span>
      <h1 style={heroTitle}>Robot City lost its power.</h1>
      <p style={lead}>Choose a helper bot, repair six city zones, collect robot parts, and rebuild the rescue machine with Grade 1 math, reading, and science.</p>
      <p style={gradeNote}>Playing as {activeProfile.name} · Learning path: {gradeLabel(grade)} · Tuned for Grade 1.</p>
      <div style={botGrid}>{Object.values(BOTS).map((candidate) => <button key={candidate.id} type="button" onClick={() => setBotId(candidate.id)} aria-pressed={botId === candidate.id} style={{...botCard,...(botId === candidate.id ? selectedBot : {})}}><span style={botEmoji}>{candidate.emoji}</span><strong>{candidate.name}</strong><small>{candidate.power}</small><p>{candidate.description}</p></button>)}</div>
      <div style={actions}><button type="button" onClick={startGame} style={primaryButton}>Launch the rescue →</button><button type="button" onClick={() => setSoundOn((value) => !value)} style={secondaryButton}>{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button></div>
    </section></main></GameFrame>;
  }

  if (stage === "garage") {
    return <GameFrame title="Robot Rescue City"><main style={page}><section style={garageCard}><div style={heroEmoji}>🛠️</div><span style={eyebrow}>GARAGE CHECKPOINT</span><h1 style={sectionTitle}>Two city zones repaired!</h1><p style={lead}>Install the parts you earned, recharge to at least two batteries, and roll into the next district.</p><div style={partsShelf}>{parts.map((part, index) => <span key={`${part}-${index}`} style={partChip}>{part}</span>)}</div><button type="button" onClick={continueFromGarage} style={primaryButton}>Open the next district →</button></section></main></GameFrame>;
  }

  if (stage === "finish") {
    const score = gears * 100 + bestCombo * 25 + battery * 20;
    return <GameFrame title="Robot Rescue City"><main style={page}><section style={finishCard}><div style={heroEmoji}>🤖✨🏙️</div><span style={eyebrow}>CITY POWER RESTORED</span><h1 style={sectionTitle}>{activeProfile.name} rebuilt the rescue robot!</h1><p style={lead}>Every part came from a real Grade 1 skill: number strategies, story details, phonics, geometry, weather patterns, and engineering communication.</p><div style={stats}><div><strong>{score}</strong><span>Score</span></div><div><strong>{gears}</strong><span>Gears</span></div><div><strong>{bestCombo}×</strong><span>Best combo</span></div><div><strong>{parts.length}/6</strong><span>Parts</span></div></div><div style={partsShelf}>{parts.map((part, index) => <span key={`${part}-${index}`} style={partChip}>{part}</span>)}</div><div style={actions}><button type="button" onClick={replay} style={primaryButton}>Build another robot</button><Link href="/school" style={linkButton}>Return to School Mode</Link></div></section></main></GameFrame>;
  }

  return <GameFrame title="Robot Rescue City"><main style={page}>
    <header style={hud}><div><small>{bot.name}</small><strong>{batteryIcons}</strong></div><div style={hudStats}><span>⚙️ {gears}</span><span>🔥 {combo}×</span><button type="button" onClick={() => setSoundOn((value) => !value)} style={soundButton}>{soundOn ? "🔊" : "🔇"}</button></div></header>
    <section style={progressCard}><div style={progressTop}><span>{mission.zone}</span><strong>{missionIndex + 1}/{MISSIONS.length}</strong></div><div style={track}><div style={{...fill,width:`${((missionIndex + 1) / MISSIONS.length) * 100}%`}} /></div><div style={partsShelf}>{parts.length ? parts.map((part, index) => <span key={`${part}-${index}`} style={partChip}>{part}</span>) : <span style={emptyParts}>Robot parts will appear here.</span>}</div></section>
    <section style={missionCard}><div style={missionHeader}><div><span style={subjectChip}>{mission.subject}</span><span style={standardChip}>{mission.standard}</span></div><span style={zoneBadge}>CITY ALERT</span></div><div style={missionEmoji}>{mission.emoji}</div><p style={story}>{mission.story}</p><h1 style={question}>{mission.prompt}</h1>
      <div style={choiceGrid}>{mission.choices.map((choice) => { const isCorrect = choice === mission.answer; const wrong = selected === choice && !isCorrect; const reveal = feedback === "explanation" && isCorrect; return <button key={choice} type="button" data-correct={isCorrect ? "true" : "false"} disabled={feedback === "explanation" || wrong} onClick={() => choose(choice)} style={{...choiceButton,...(reveal ? correctChoice : wrong ? wrongChoice : {})}}>{choice}</button>; })}</div>
      <section style={teachingCard} aria-live="polite"><div><small style={teachingLabel}>{feedback === "question" ? "YOUR MOVE" : feedback === "hint" ? "REPAIR CLUE" : "REPAIR REPORT"}</small><p style={messageText}>{message}</p></div>{feedback === "question" ? <button type="button" onClick={showHint} style={hintButton}>{clues > 0 ? `Use free clue (${clues})` : "Show a clue"}</button> : feedback === "hint" ? <span style={retryText}>Try again. The robot is still counting on you.</span> : <button type="button" onClick={advance} style={primaryButton}>{missionIndex === MISSIONS.length - 1 ? "Power up the city →" : "Install the part →"}</button>}</section>
    </section>
  </main></GameFrame>;
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "24px 16px 54px", background: "radial-gradient(circle at top,#17334e 0,#0e1725 42%,#090d15 100%)", color: "#fff" };
const heroCard: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "clamp(24px,5vw,48px)", borderRadius: 34, background: "linear-gradient(145deg,rgba(127,220,255,.15),rgba(198,184,255,.08),#151b28)", border: "1px solid rgba(127,220,255,.28)", textAlign: "center" };
const heroEmoji: React.CSSProperties = { fontSize: "clamp(4rem,11vw,7rem)", marginBottom: 8 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const heroTitle: React.CSSProperties = { margin: "10px auto", maxWidth: 760, fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: .92, letterSpacing: "-.055em" };
const sectionTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.2rem,6vw,4rem)", lineHeight: .95 };
const lead: React.CSSProperties = { maxWidth: 720, margin: "12px auto", color: "#c6cfdb", lineHeight: 1.55, fontWeight: 700 };
const gradeNote: React.CSSProperties = { color: "#8fa3b8", fontSize: 13, fontWeight: 800 };
const botGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginTop: 24 };
const botCard: React.CSSProperties = { padding: 18, borderRadius: 24, border: "1px solid #33435a", background: "#111927", color: "#fff", cursor: "pointer", display: "grid", gap: 7 };
const selectedBot: React.CSSProperties = { borderColor: "#7fdcff", boxShadow: "0 0 0 3px rgba(127,220,255,.13)" };
const botEmoji: React.CSSProperties = { fontSize: 48 };
const actions: React.CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 24 };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 999, padding: "13px 19px", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { borderRadius: 999, padding: "12px 18px", background: "#172234", color: "#fff", border: "1px solid #3a4c65", fontWeight: 900, cursor: "pointer" };
const linkButton: React.CSSProperties = { ...secondaryButton, textDecoration: "none" };
const hud: React.CSSProperties = { maxWidth: 900, margin: "0 auto 14px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 14, borderRadius: 22, background: "#111927", border: "1px solid #2b3c53" };
const hudStats: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontWeight: 950 };
const soundButton: React.CSSProperties = { border: 0, background: "transparent", color: "#fff", cursor: "pointer", fontSize: 18 };
const progressCard: React.CSSProperties = { maxWidth: 900, margin: "0 auto 14px", padding: 14, borderRadius: 22, background: "rgba(17,25,39,.9)", border: "1px solid #2b3c53" };
const progressTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontWeight: 950 };
const track: React.CSSProperties = { height: 10, margin: "10px 0", borderRadius: 999, background: "#263348", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#d9ff5b)" };
const partsShelf: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginTop: 12 };
const partChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#1c2b3e", border: "1px solid #38516c", color: "#d9ff5b", fontSize: 12, fontWeight: 900 };
const emptyParts: React.CSSProperties = { color: "#7f8da1", fontSize: 12 };
const missionCard: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "clamp(20px,4vw,34px)", borderRadius: 30, background: "linear-gradient(150deg,#151e2d,#101620)", border: "1px solid rgba(127,220,255,.28)" };
const missionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const subjectChip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#7fdcff", color: "#0b1420", fontSize: 11, fontWeight: 950 };
const standardChip: React.CSSProperties = { marginLeft: 7, padding: "6px 9px", borderRadius: 999, background: "#222d40", color: "#afbdd0", fontSize: 11, fontWeight: 900 };
const zoneBadge: React.CSSProperties = { color: "#ffb5bf", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const missionEmoji: React.CSSProperties = { textAlign: "center", fontSize: "clamp(4rem,10vw,6rem)", margin: "10px 0" };
const story: React.CSSProperties = { color: "#bac7d8", lineHeight: 1.55, fontWeight: 750, textAlign: "center" };
const question: React.CSSProperties = { textAlign: "center", margin: "14px auto 18px", maxWidth: 720, fontSize: "clamp(1.8rem,5vw,3rem)", lineHeight: 1.02 };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 10 };
const choiceButton: React.CSSProperties = { minHeight: 64, borderRadius: 18, border: "1px solid #35465e", background: "#172234", color: "#fff", padding: 14, fontWeight: 900, cursor: "pointer" };
const correctChoice: React.CSSProperties = { background: "rgba(217,255,91,.14)", borderColor: "#d9ff5b", color: "#efffc0" };
const wrongChoice: React.CSSProperties = { background: "rgba(255,181,191,.12)", borderColor: "#ffb5bf", color: "#ffd5da" };
const teachingCard: React.CSSProperties = { marginTop: 18, padding: 16, borderRadius: 20, background: "#0d131d", border: "1px solid #29374b", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 };
const teachingLabel: React.CSSProperties = { color: "#7fdcff", fontWeight: 950, letterSpacing: ".12em" };
const messageText: React.CSSProperties = { margin: "5px 0 0", color: "#d4dce7", lineHeight: 1.5, fontWeight: 750 };
const hintButton: React.CSSProperties = { ...secondaryButton, color: "#d9ff5b" };
const retryText: React.CSSProperties = { color: "#ffcf7f", fontWeight: 900 };
const garageCard: React.CSSProperties = { ...heroCard, maxWidth: 760 };
const finishCard: React.CSSProperties = { ...heroCard, maxWidth: 820 };
const stats: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, margin: "22px 0" };
