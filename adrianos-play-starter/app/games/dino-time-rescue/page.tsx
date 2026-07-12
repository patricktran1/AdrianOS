"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import Link from "next/link";
import { useMemo, useState } from "react";

const GAME_SLUG = "dino-time-rescue";

type Subject = "Math" | "Reading" | "Science";
type SidekickId = "trike" | "raptor" | "brachio";
type Stage = "intro" | "play" | "checkpoint" | "finish";
type Feedback = "question" | "hint" | "explanation";

type Mission = {
  chapter: string;
  location: string;
  emoji: string;
  boss?: boolean;
  subject: Subject;
  skillId: string;
  skillLabel: string;
  standard: string;
  story: string;
  prompt: string;
  choices: string[];
  answer: string;
  hint: string;
  explanation: string;
};

const SIDEKICKS = {
  trike: {
    id: "trike" as const,
    emoji: "🦕",
    name: "Trix the Triceratops",
    power: "Shield",
    description: "Blocks the first energy hit.",
  },
  raptor: {
    id: "raptor" as const,
    emoji: "🦖",
    name: "Zip the Raptor",
    power: "Speed bonus",
    description: "Earns one extra fossil on first-try solves.",
  },
  brachio: {
    id: "brachio" as const,
    emoji: "🦕",
    name: "Bronto the Brachiosaurus",
    power: "Wisdom",
    description: "Three clues do not break your combo.",
  },
};

const MISSIONS: Mission[] = [
  {
    chapter: "Jungle Signal",
    location: "Fern Forest",
    emoji: "🌿",
    subject: "Reading",
    skillId: "reading-comprehension-detail",
    skillLabel: "Story details",
    standard: "RL.2.1",
    story: "A baby ankylosaurus is hiding beneath the widest fern because thunder frightened it.",
    prompt: "Why is the baby ankylosaurus hiding?",
    choices: ["Thunder frightened it", "It is hungry", "It lost a race", "The fern is cold"],
    answer: "Thunder frightened it",
    hint: "Look for the part of the sentence that explains the reason.",
    explanation: "The story directly says thunder frightened the baby. That detail answers why it is hiding.",
  },
  {
    chapter: "Jungle Signal",
    location: "Egg Nest",
    emoji: "🥚",
    subject: "Math",
    skillId: "math-addition",
    skillLabel: "Addition within 20",
    standard: "2.OA.B.2",
    story: "The rescue team finds 8 blue eggs and 7 spotted eggs.",
    prompt: "How many eggs are there altogether?",
    choices: ["13", "14", "15", "16"],
    answer: "15",
    hint: "Make 10: move 2 from 7 to 8. Then add the 5 left over.",
    explanation: "8 + 7 can become 10 + 5, which equals 15.",
  },
  {
    chapter: "Jungle Signal",
    location: "River Gate",
    emoji: "🌊",
    boss: true,
    subject: "Science",
    skillId: "engineering-materials",
    skillLabel: "Material properties",
    standard: "2-PS1-1",
    story: "A dinosaur needs a rescue raft that floats and does not soak up water.",
    prompt: "Which material is the best choice?",
    choices: ["Dry leaf", "Paper towel", "Solid plastic", "Cotton cloth"],
    answer: "Solid plastic",
    hint: "Choose a material that is waterproof and can stay on the surface.",
    explanation: "Solid plastic does not absorb water and can be shaped into a floating raft.",
  },
  {
    chapter: "Volcano Run",
    location: "Lava Ridge",
    emoji: "🌋",
    subject: "Science",
    skillId: "science-earth",
    skillLabel: "Fast and slow Earth changes",
    standard: "2-ESS1-1",
    story: "The ground near the time portal changes in two different ways.",
    prompt: "Which change can happen very quickly?",
    choices: ["A canyon slowly wearing away", "A volcano erupting", "A mountain weathering", "A beach slowly shrinking"],
    answer: "A volcano erupting",
    hint: "Think about which event can change the land in minutes or hours.",
    explanation: "A volcanic eruption can change land quickly. Weathering and erosion usually take much longer.",
  },
  {
    chapter: "Volcano Run",
    location: "Crystal Tunnel",
    emoji: "💎",
    subject: "Math",
    skillId: "math-subtraction",
    skillLabel: "Subtraction within 100",
    standard: "2.NBT.B.5",
    story: "The team collected 63 glowing crystals. The portal used 28 of them.",
    prompt: "How many crystals remain?",
    choices: ["35", "41", "45", "91"],
    answer: "35",
    hint: "Subtract 20 first, then subtract 8 more: 63 − 20 − 8.",
    explanation: "63 − 20 = 43, and 43 − 8 = 35.",
  },
  {
    chapter: "Volcano Run",
    location: "T-Rex Bridge",
    emoji: "🦖",
    boss: true,
    subject: "Reading",
    skillId: "reading-vocabulary",
    skillLabel: "Vocabulary in context",
    standard: "L.2.4",
    story: "The bridge began to tremble, so Adrian moved cautiously across it.",
    prompt: "What does cautiously mean here?",
    choices: ["Carefully", "Loudly", "Quickly", "Angrily"],
    answer: "Carefully",
    hint: "The bridge is shaking. How would someone move to stay safe?",
    explanation: "Cautiously means carefully and with attention to possible danger.",
  },
  {
    chapter: "Portal Lab",
    location: "Timeline Chamber",
    emoji: "⏳",
    subject: "Reading",
    skillId: "reading-sequencing",
    skillLabel: "Sequence of events",
    standard: "RL.2.5",
    story: "First the team found the portal key. Next they charged it with crystals. Last they opened the portal.",
    prompt: "What happened immediately before the portal opened?",
    choices: ["They found the key", "They charged the key", "They crossed the river", "They built a raft"],
    answer: "They charged the key",
    hint: "Look for the event marked next. It comes right before last.",
    explanation: "The key was charged after it was found and immediately before the portal opened.",
  },
  {
    chapter: "Portal Lab",
    location: "Gear Workshop",
    emoji: "⚙️",
    subject: "Science",
    skillId: "engineering-iteration",
    skillLabel: "Testing and improving designs",
    standard: "K-2-ETS1-3",
    story: "Two portal stabilizers were tested. Design A stood for 8 seconds. Design B stood for 25 seconds.",
    prompt: "What should the team do with this evidence?",
    choices: ["Choose B and study why it worked", "Choose A because it was first", "Ignore both tests", "Pick randomly"],
    answer: "Choose B and study why it worked",
    hint: "Use the test result that shows which design performed better.",
    explanation: "Design B lasted longer. Engineers compare test evidence and improve the stronger design.",
  },
  {
    chapter: "Portal Lab",
    location: "Final Time Gate",
    emoji: "🌀",
    boss: true,
    subject: "Math",
    skillId: "math-word-problems",
    skillLabel: "Addition and subtraction story problems",
    standard: "2.OA.A.1",
    story: "Nine dinosaurs entered the portal. Four more joined them, but three ran back to the jungle.",
    prompt: "How many dinosaurs went through the portal?",
    choices: ["10", "12", "13", "16"],
    answer: "10",
    hint: "First add the dinosaurs who joined. Then subtract the dinosaurs who ran back.",
    explanation: "9 + 4 = 13, then 13 − 3 = 10 dinosaurs.",
  },
];

function playTone(enabled: boolean, kind: "correct" | "miss" | "boss") {
  if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = kind === "boss" ? "sawtooth" : "sine";
  oscillator.frequency.value = kind === "correct" ? 660 : kind === "boss" ? 260 : 180;
  gain.gain.setValueAtTime(0.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.17);
  oscillator.addEventListener("ended", () => void context.close());
}

function subjectColor(subject: Subject) {
  if (subject === "Math") return "#d9ff5b";
  if (subject === "Reading") return "#c6b8ff";
  return "#7fdcff";
}

export default function DinoTimeRescuePage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [stage, setStage] = useState<Stage>("intro");
  const [sidekickId, setSidekickId] = useState<SidekickId>("trike");
  const [missionIndex, setMissionIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [energy, setEnergy] = useState(3);
  const [shield, setShield] = useState(1);
  const [wisdom, setWisdom] = useState(3);
  const [fossils, setFossils] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [message, setMessage] = useState("Choose the best answer.");
  const [soundOn, setSoundOn] = useState(true);

  const sidekick = SIDEKICKS[sidekickId];
  const mission = MISSIONS[missionIndex];
  const grade = hydrated ? readProfileGrade(activeProfile) : 2;
  const progressPercent = Math.round((missionIndex / MISSIONS.length) * 100);
  const hearts = useMemo(() => Array.from({ length: Math.max(0, energy) }, () => "❤️").join(" ") || "✨", [energy]);

  function resetQuestion(nextMessage = "Choose the best answer.") {
    setFeedback("question");
    setSelected(null);
    setWrongAttempts(0);
    setUsedHint(false);
    setMessage(nextMessage);
  }

  function startGame() {
    setEnergy(sidekickId === "trike" ? 4 : 3);
    setShield(sidekickId === "trike" ? 1 : 0);
    setWisdom(sidekickId === "brachio" ? 3 : 0);
    setStage("play");
    playTone(soundOn, "boss");
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
      data: {
        standardCode: mission.standard,
        chapter: mission.chapter,
        location: mission.location,
        boss: mission.boss === true,
      },
    }, activeProfile.id);
  }

  function loseEnergy() {
    if (shield > 0) {
      setShield(0);
      setMessage(`${sidekick.name} blocked the energy hit. ${mission.hint}`);
      return;
    }
    setEnergy((value) => Math.max(0, value - 1));
  }

  function choose(choice: string) {
    if (feedback === "explanation" || (selected === choice && choice !== mission.answer)) return;
    setSelected(choice);
    const correct = choice === mission.answer;

    if (!correct && wrongAttempts === 0) {
      saveAttempt(false);
      setWrongAttempts(1);
      setUsedHint(true);
      setFeedback("hint");
      setCombo(0);
      loseEnergy();
      playTone(soundOn, "miss");
      setMessage(mission.hint);
      return;
    }

    if (!correct) {
      setWrongAttempts((value) => value + 1);
      setCombo(0);
      setFeedback("explanation");
      setMessage(`The answer is ${mission.answer}. ${mission.explanation}`);
      playTone(soundOn, "miss");
      return;
    }

    saveAttempt(true);
    const firstTry = wrongAttempts === 0 && !usedHint;
    const fossilReward = firstTry ? 2 + (sidekickId === "raptor" ? 1 : 0) : 1;
    const nextCombo = firstTry ? combo + 1 : 0;
    setFossils((value) => value + fossilReward);
    setCorrectCount((value) => value + 1);
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setFeedback("explanation");
    setMessage(`${firstTry ? `Perfect rescue! +${fossilReward} fossils.` : "Rescue complete with support."} ${mission.explanation}`);
    playTone(soundOn, mission.boss ? "boss" : "correct");
  }

  function showHint() {
    if (feedback !== "question") return;
    setUsedHint(true);
    setFeedback("hint");
    if (sidekickId === "brachio" && wisdom > 0) {
      setWisdom((value) => value - 1);
      setMessage(`Bronto's wisdom clue: ${mission.hint}`);
    } else {
      setCombo(0);
      setMessage(mission.hint);
    }
  }

  function advance() {
    if (feedback !== "explanation") return;
    if (missionIndex === MISSIONS.length - 1) {
      const score = fossils * 100 + correctCount * 25 + energy * 10 + bestCombo * 15;
      completeGame({
        xp: 45 + correctCount * 5 + bestCombo * 3,
        coins: 10 + fossils,
        score,
      });
      setStage("finish");
      return;
    }

    if (mission.boss) {
      setStage("checkpoint");
      setEnergy((value) => Math.max(value, 2));
      return;
    }

    setMissionIndex((value) => value + 1);
    resetQuestion();
  }

  function continueChapter() {
    setMissionIndex((value) => value + 1);
    resetQuestion("A new time signal is waiting.");
    setStage("play");
  }

  function replay() {
    restartGame();
    setStage("intro");
    setMissionIndex(0);
    setFeedback("question");
    setSelected(null);
    setWrongAttempts(0);
    setUsedHint(false);
    setEnergy(3);
    setShield(1);
    setWisdom(3);
    setFossils(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectCount(0);
    setMessage("Choose the best answer.");
  }

  if (stage === "intro") {
    return (
      <GameFrame title="Dino Time Rescue">
        <style>{animationCss}</style>
        <main style={page}>
          <section style={heroCard}>
            <div style={portalVisual} className="dino-float">🌀🦖</div>
            <span style={eyebrow}>GRADE 2 STORY ADVENTURE</span>
            <h1 style={heroTitle}>The dinosaurs are trapped in time.</h1>
            <p style={lead}>Rescue them through three worlds. Solve story, math, and science gates, survive boss rounds, and bring every dinosaur home.</p>
            <div style={storyStrip}>
              <span>🌿 Jungle Signal</span><span>🌋 Volcano Run</span><span>⚙️ Portal Lab</span>
            </div>
            <p style={gradeNote}>Playing as {activeProfile.name} · Learning path: {gradeLabel(grade)} · This adventure is tuned for Grade 2.</p>
          </section>

          <section style={sidekickSection}>
            <span style={eyebrow}>CHOOSE YOUR SIDEKICK</span>
            <div style={sidekickGrid}>
              {Object.values(SIDEKICKS).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSidekickId(candidate.id)}
                  style={{ ...sidekickCard, ...(sidekickId === candidate.id ? selectedSidekick : {}) }}
                  aria-pressed={sidekickId === candidate.id}
                >
                  <span style={sidekickEmoji}>{candidate.emoji}</span>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.power}</small>
                  <p>{candidate.description}</p>
                </button>
              ))}
            </div>
            <div style={introActions}>
              <button type="button" onClick={startGame} style={primaryButton}>Open the time portal →</button>
              <button type="button" onClick={() => setSoundOn((value) => !value)} style={secondaryButton}>{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button>
            </div>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (stage === "checkpoint") {
    const nextMission = MISSIONS[missionIndex + 1];
    return (
      <GameFrame title="Dino Time Rescue">
        <style>{animationCss}</style>
        <main style={page}>
          <section style={checkpointCard}>
            <div style={checkpointEmoji} className="dino-pop">🏕️</div>
            <span style={eyebrow}>CHAPTER CLEARED</span>
            <h1 style={checkpointTitle}>{mission.chapter} is safe.</h1>
            <p style={lead}>{sidekick.name} found a calm checkpoint. Your energy is restored to at least two hearts before the next world.</p>
            <div style={checkpointStats}>
              <div><strong>{fossils}</strong><span>Fossils</span></div>
              <div><strong>{bestCombo}×</strong><span>Best combo</span></div>
              <div><strong>{correctCount}</strong><span>Rescues</span></div>
            </div>
            <button type="button" onClick={continueChapter} style={primaryButton}>Enter {nextMission.chapter} →</button>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (stage === "finish") {
    const finalScore = fossils * 100 + correctCount * 25 + energy * 10 + bestCombo * 15;
    return (
      <GameFrame title="Dino Time Rescue">
        <style>{animationCss}</style>
        <main style={page}>
          <section style={finishCard}>
            <div style={finishDinos} className="dino-pop">🦕 🦖 🦴 🦕</div>
            <span style={eyebrow}>TIME PORTAL RESTORED</span>
            <h1 style={finishTitle}>{activeProfile.name} saved the dinosaur timeline!</h1>
            <p style={lead}>You used evidence, number strategies, vocabulary, sequencing, and engineering thinking to complete the rescue.</p>
            <div style={finishStats}>
              <div><strong>{finalScore}</strong><span>Score</span></div>
              <div><strong>{fossils}</strong><span>Fossils</span></div>
              <div><strong>{bestCombo}×</strong><span>Best combo</span></div>
              <div><strong>{correctCount}/9</strong><span>Rescued</span></div>
            </div>
            <div style={introActions}>
              <button type="button" onClick={replay} style={primaryButton}>Rescue again</button>
              <Link href="/school" style={linkButton}>Return to School Mode</Link>
            </div>
          </section>
        </main>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Dino Time Rescue">
      <style>{animationCss}</style>
      <main style={page}>
        <header style={hud}>
          <div style={hudProfile}><span style={hudDino}>{sidekick.emoji}</span><div><small>{sidekick.name}</small><strong>{hearts}</strong></div></div>
          <div style={hudStats}><span>🦴 {fossils}</span><span>🔥 {combo}×</span><button type="button" onClick={() => setSoundOn((value) => !value)} style={soundButton} aria-label={soundOn ? "Turn sound off" : "Turn sound on"}>{soundOn ? "🔊" : "🔇"}</button></div>
        </header>

        <section style={mapCard} aria-label="Dino rescue map">
          <div style={mapTop}><span>{mission.chapter}</span><strong>{missionIndex + 1}/{MISSIONS.length}</strong></div>
          <div style={mapTrack}><div style={{ ...mapFill, width: `${progressPercent}%` }} /></div>
          <div style={mapDots}>{MISSIONS.map((item, index) => <span key={`${item.location}-${index}`} title={item.location} style={{ ...mapDot, ...(index < missionIndex ? clearedDot : index === missionIndex ? activeDot : {}) }}>{item.boss ? "👑" : "•"}</span>)}</div>
        </section>

        <section style={{ ...missionCard, borderColor: mission.boss ? "rgba(255,181,191,.55)" : `${subjectColor(mission.subject)}55` }}>
          <div style={missionTop}>
            <div>
              <span style={{ ...subjectChip, background: subjectColor(mission.subject) }}>{mission.subject}</span>
              <span style={standardChip}>{mission.standard}</span>
            </div>
            {mission.boss && <span style={bossBadge}>BOSS GATE</span>}
          </div>
          <div style={locationVisual} className={mission.boss ? "dino-shake" : "dino-float"}>{mission.emoji}</div>
          <span style={locationLabel}>{mission.location}</span>
          <p style={storyText}>{mission.story}</p>
          <h1 style={questionTitle}>{mission.prompt}</h1>

          <div style={choiceGrid}>
            {mission.choices.map((choice) => {
              const isCorrect = choice === mission.answer;
              const chosenWrong = selected === choice && !isCorrect;
              const revealCorrect = feedback === "explanation" && isCorrect;
              return (
                <button
                  key={choice}
                  type="button"
                  data-correct={isCorrect ? "true" : "false"}
                  onClick={() => choose(choice)}
                  disabled={feedback === "explanation" || chosenWrong}
                  style={{ ...choiceButton, ...(revealCorrect ? correctChoice : chosenWrong ? wrongChoice : {}) }}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          <section style={teachingCard} aria-live="polite">
            <div>
              <small style={teachingLabel}>{feedback === "question" ? "YOUR MOVE" : feedback === "hint" ? "CLUE UNLOCKED" : "RESCUE REPORT"}</small>
              <p style={messageText}>{message}</p>
            </div>
            {feedback === "question" ? (
              <button type="button" onClick={showHint} style={hintButton}>{sidekickId === "brachio" && wisdom > 0 ? `Use wisdom clue (${wisdom})` : "Show a clue"}</button>
            ) : feedback === "hint" ? (
              <span style={retryText}>Choose again. The rescue is still on.</span>
            ) : (
              <button type="button" onClick={advance} style={primaryButton}>{missionIndex === MISSIONS.length - 1 ? "Seal the time portal →" : mission.boss ? "Clear the boss gate →" : "Next rescue →"}</button>
            )}
          </section>
        </section>
      </main>
    </GameFrame>
  );
}

const animationCss = `
@keyframes dinoFloat { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-10px) rotate(2deg); } }
@keyframes dinoPop { 0% { transform: scale(.7); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@keyframes dinoShake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
.dino-float { animation: dinoFloat 2.2s ease-in-out infinite; }
.dino-pop { animation: dinoPop .55s ease-out both; }
.dino-shake { animation: dinoShake .65s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .dino-float,.dino-pop,.dino-shake { animation: none; } }
`;

const page: React.CSSProperties = { width: "min(980px,100%)", margin: "0 auto", paddingBottom: 94, color: "#fff" };
const heroCard: React.CSSProperties = { padding: "clamp(28px,7vw,66px)", borderRadius: 34, textAlign: "center", background: "radial-gradient(circle at 50% 0%,rgba(127,220,255,.18),transparent 42%),linear-gradient(145deg,#1f2c2a,#181d28 55%,#251d31)", border: "1px solid rgba(127,220,255,.26)", overflow: "hidden" };
const portalVisual: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)", marginBottom: 10 };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { margin: "12px auto 16px", maxWidth: 850, fontSize: "clamp(3.2rem,9vw,7rem)", lineHeight: .86, letterSpacing: "-.075em" };
const lead: React.CSSProperties = { maxWidth: 760, margin: "0 auto", color: "#c8ced8", lineHeight: 1.6, fontSize: "clamp(1rem,2.3vw,1.2rem)" };
const storyStrip: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 9, margin: "24px auto 12px" };
const gradeNote: React.CSSProperties = { margin: "18px 0 0", color: "#8992a1", fontSize: 12, fontWeight: 800 };
const sidekickSection: React.CSSProperties = { marginTop: 15, padding: "clamp(22px,5vw,38px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.1)", textAlign: "center" };
const sidekickGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 11, marginTop: 18 };
const sidekickCard: React.CSSProperties = { minHeight: 225, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 20, borderRadius: 23, border: "1px solid rgba(255,255,255,.12)", background: "#10131b", color: "#fff", cursor: "pointer" };
const selectedSidekick: React.CSSProperties = { borderColor: "#d9ff5b", boxShadow: "0 0 0 3px rgba(217,255,91,.12)", background: "rgba(217,255,91,.07)" };
const sidekickEmoji: React.CSSProperties = { fontSize: 52 };
const introActions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 20 };
const primaryButton: React.CSSProperties = { minHeight: 46, padding: "12px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer", textDecoration: "none", textAlign: "center" };
const secondaryButton: React.CSSProperties = { minHeight: 46, padding: "11px 17px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const linkButton: React.CSSProperties = { ...secondaryButton, display: "inline-grid", placeItems: "center", textDecoration: "none" };
const hud: React.CSSProperties = { position: "sticky", top: "max(10px,env(safe-area-inset-top))", zIndex: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 12, marginBottom: 12, borderRadius: 22, background: "rgba(16,19,27,.94)", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(14px)" };
const hudProfile: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const hudDino: React.CSSProperties = { width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 15, background: "#222936", fontSize: 28 };
const hudStats: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, fontWeight: 950 };
const soundButton: React.CSSProperties = { width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", cursor: "pointer" };
const mapCard: React.CSSProperties = { marginBottom: 12, padding: 14, borderRadius: 20, background: "#181d28", border: "1px solid rgba(255,255,255,.09)" };
const mapTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", color: "#aab1bf", fontSize: 12, fontWeight: 900 };
const mapTrack: React.CSSProperties = { height: 8, marginTop: 9, borderRadius: 999, background: "#10131b", overflow: "hidden" };
const mapFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)", transition: "width .3s ease" };
const mapDots: React.CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${MISSIONS.length},1fr)`, gap: 3, marginTop: 8, textAlign: "center" };
const mapDot: React.CSSProperties = { minWidth: 0, color: "#4c5563", fontSize: 16 };
const clearedDot: React.CSSProperties = { color: "#d9ff5b" };
const activeDot: React.CSSProperties = { color: "#7fdcff", transform: "scale(1.25)" };
const missionCard: React.CSSProperties = { padding: "clamp(22px,6vw,52px)", borderRadius: 32, background: "linear-gradient(155deg,#181d28,#10131b)", border: "1px solid rgba(255,255,255,.12)", textAlign: "center" };
const missionTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
const subjectChip: React.CSSProperties = { display: "inline-block", padding: "7px 10px", borderRadius: 999, color: "#10131b", fontWeight: 950, fontSize: 11 };
const standardChip: React.CSSProperties = { display: "inline-block", marginLeft: 7, padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#fff", fontWeight: 900, fontSize: 11 };
const bossBadge: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "#ffb5bf", color: "#10131b", fontWeight: 950, fontSize: 11, letterSpacing: ".1em" };
const locationVisual: React.CSSProperties = { margin: "22px auto 4px", fontSize: "clamp(5rem,18vw,9rem)" };
const locationLabel: React.CSSProperties = { color: "#7fdcff", fontSize: 12, fontWeight: 950, letterSpacing: ".14em" };
const storyText: React.CSSProperties = { maxWidth: 720, margin: "18px auto 8px", color: "#aab1bf", lineHeight: 1.55, fontWeight: 750 };
const questionTitle: React.CSSProperties = { maxWidth: 850, margin: "10px auto 26px", fontSize: "clamp(2.2rem,6vw,4.5rem)", lineHeight: .95, letterSpacing: "-.055em" };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 11 };
const choiceButton: React.CSSProperties = { minHeight: 82, padding: 13, borderRadius: 20, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", fontSize: "clamp(1rem,2.8vw,1.25rem)", fontWeight: 900, cursor: "pointer" };
const correctChoice: React.CSSProperties = { background: "#d9ff5b", color: "#10131b", borderColor: "#d9ff5b" };
const wrongChoice: React.CSSProperties = { background: "#ffb5bf", color: "#10131b", borderColor: "#ffb5bf" };
const teachingCard: React.CSSProperties = { marginTop: 18, padding: 16, borderRadius: 20, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center", textAlign: "left", background: "rgba(127,220,255,.06)", border: "1px solid rgba(127,220,255,.2)" };
const teachingLabel: React.CSSProperties = { color: "#d9ff5b", fontSize: 10, fontWeight: 950, letterSpacing: ".14em" };
const messageText: React.CSSProperties = { margin: "5px 0 0", color: "#d6dbe3", lineHeight: 1.5, fontWeight: 750 };
const hintButton: React.CSSProperties = { ...secondaryButton, minWidth: 145 };
const retryText: React.CSSProperties = { color: "#7fdcff", fontWeight: 900, fontSize: 13 };
const checkpointCard: React.CSSProperties = { padding: "clamp(30px,8vw,72px)", borderRadius: 34, textAlign: "center", background: "linear-gradient(145deg,rgba(217,255,91,.09),rgba(127,220,255,.08),#181d28)", border: "1px solid rgba(217,255,91,.25)" };
const checkpointEmoji: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)" };
const checkpointTitle: React.CSSProperties = { margin: "10px auto 16px", fontSize: "clamp(3rem,8vw,6rem)", lineHeight: .88, letterSpacing: "-.07em" };
const checkpointStats: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 9, maxWidth: 600, margin: "24px auto" };
const finishCard: React.CSSProperties = { padding: "clamp(30px,8vw,72px)", borderRadius: 34, textAlign: "center", background: "radial-gradient(circle at top,rgba(217,255,91,.16),transparent 42%),#181d28", border: "1px solid rgba(217,255,91,.3)" };
const finishDinos: React.CSSProperties = { fontSize: "clamp(4rem,13vw,8rem)" };
const finishTitle: React.CSSProperties = { margin: "12px auto 16px", maxWidth: 860, fontSize: "clamp(3rem,8vw,6rem)", lineHeight: .9, letterSpacing: "-.07em" };
const finishStats: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 9, margin: "26px auto", maxWidth: 760 };

for (const grid of [checkpointStats, finishStats]) {
  Object.assign(grid, { color: "#fff" });
}
