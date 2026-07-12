"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useGameSession } from "@/lib/game-session";
import Link from "next/link";
import { useMemo, useState } from "react";

const GAME_SLUG = "rainbow-rocket-park";
type Stage = "intro" | "play" | "launch" | "finish";
type Feedback = "question" | "hint" | "explanation";
type Mission = { zone: string; emoji: string; subject: "Math" | "Reading" | "Science"; standard: string; skillId: string; skillLabel: string; prompt: string; visual: string; choices: string[]; answer: string; hint: string; explanation: string; color: string };

const MISSIONS: Mission[] = [
  { zone: "Star Garden", emoji: "⭐", subject: "Math", standard: "K.CC.B.4", skillId: "math-counting", skillLabel: "Counting and quantity", prompt: "How many stars are glowing?", visual: "⭐ ⭐ ⭐ ⭐ ⭐", choices: ["3", "4", "5", "6"], answer: "5", hint: "Touch each star once while you count.", explanation: "There are 5 stars. The last number counted tells how many.", color: "#ffd45c" },
  { zone: "Shape Station", emoji: "🔷", subject: "Math", standard: "K.G.A.2", skillId: "math-geometry", skillLabel: "Recognize shapes", prompt: "Which one is a triangle?", visual: "Find the shape with 3 straight sides.", choices: ["●", "▲", "■", "◆"], answer: "▲", hint: "Trace the sides. A triangle has 3.", explanation: "▲ is a triangle because it has 3 straight sides.", color: "#7fdcff" },
  { zone: "Sound Tunnel", emoji: "🔤", subject: "Reading", standard: "RF.K.2", skillId: "reading-spelling-easy", skillLabel: "Beginning sounds", prompt: "Which word starts like moon?", visual: "🌙 moon", choices: ["map", "sun", "cat", "fish"], answer: "map", hint: "Say mmmmoon. Listen for /m/.", explanation: "Moon and map both begin with the /m/ sound.", color: "#c6b8ff" },
  { zone: "Story Clouds", emoji: "☁️", subject: "Reading", standard: "W.K.3", skillId: "reading-sequencing", skillLabel: "Story order", prompt: "What happens first?", visual: "1. Put on helmet  2. Climb in  3. Blast off", choices: ["Put on helmet", "Climb in", "Blast off", "Land"], answer: "Put on helmet", hint: "Look for number 1.", explanation: "Putting on the helmet happens first.", color: "#ff9bd2" },
  { zone: "Motion Ramp", emoji: "🛝", subject: "Science", standard: "K-PS2-1", skillId: "science-technology", skillLabel: "Pushes and pulls", prompt: "What makes the rocket cart move away from you?", visual: "🧒 ➡️ 🚀", choices: ["A push", "A pull", "A whisper", "A shadow"], answer: "A push", hint: "Your hands move the cart away.", explanation: "A push can make an object move away from you.", color: "#d9ff5b" },
  { zone: "Living World", emoji: "🌱", subject: "Science", standard: "K-LS1-1", skillId: "environment-ecosystems", skillLabel: "Living things need resources", prompt: "What does a plant need to grow?", visual: "🌱 + ?", choices: ["Water", "A toy", "A shoe", "A bell"], answer: "Water", hint: "Think about what we give thirsty plants.", explanation: "Plants need water to live and grow.", color: "#7ff0ae" },
];

function tone(enabled: boolean, correct: boolean) {
  if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
  const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = correct ? 760 : 210; gain.gain.setValueAtTime(.06, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16); osc.start(); osc.stop(ctx.currentTime + .17); osc.addEventListener("ended", () => void ctx.close());
}

export default function RainbowRocketParkPage() {
  const { activeProfile } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [fuel, setFuel] = useState(3);
  const [soundOn, setSoundOn] = useState(true);
  const mission = MISSIONS[index];
  const fuelIcons = useMemo(() => Array.from({ length: fuel }, () => "🌈").join(" ") || "✨", [fuel]);

  function save(correct: boolean) {
    recordLearningAttempt({ gameSlug: GAME_SLUG, subject: mission.subject, skillId: mission.skillId, skillLabel: mission.skillLabel, prompt: mission.prompt, correctAnswer: mission.answer, correct, data: { standardCode: mission.standard, zone: mission.zone, adaptiveSupport: wrongAttempts > 0 } }, activeProfile.id);
  }

  function choose(choice: string) {
    if (feedback === "explanation") return;
    setSelected(choice);
    const correct = choice === mission.answer;
    if (!correct && wrongAttempts === 0) {
      save(false); setWrongAttempts(1); setFeedback("hint"); setCombo(0); setFuel((value) => Math.max(0, value - 1)); tone(soundOn, false); return;
    }
    if (!correct) { setWrongAttempts((value) => value + 1); setFeedback("explanation"); setCombo(0); tone(soundOn, false); return; }
    save(true); const firstTry = wrongAttempts === 0; const nextCombo = firstTry ? combo + 1 : 0; setStars((value) => value + (firstTry ? 2 : 1)); setCombo(nextCombo); setBestCombo((value) => Math.max(value, nextCombo)); setFeedback("explanation"); tone(soundOn, true);
  }

  function next() {
    if (index === MISSIONS.length - 1) { completeGame({ xp: 30 + stars + bestCombo * 2, coins: 8 + stars, score: stars * 100 + bestCombo * 25 + fuel * 20 }); setStage("finish"); return; }
    if ((index + 1) % 2 === 0) { setStage("launch"); return; }
    setIndex((value) => value + 1); resetQuestion();
  }

  function resetQuestion() { setFeedback("question"); setSelected(null); setWrongAttempts(0); }
  function continueLaunch() { setFuel((value) => Math.max(value, 2)); setIndex((value) => value + 1); resetQuestion(); setStage("play"); }
  function replay() { restartGame(); setStage("intro"); setIndex(0); setFeedback("question"); setSelected(null); setStars(0); setCombo(0); setBestCombo(0); setWrongAttempts(0); setFuel(3); }

  if (stage === "intro") return <GameFrame title="Rainbow Rocket Park"><style>{css}</style><main style={page}><section style={hero}><div className="float" style={bigEmoji}>🌈🚀</div><span style={eyebrow}>KINDERGARTEN TOUCH ADVENTURE</span><h1 style={heroTitle}>Build a rainbow rocket.</h1><p style={lead}>Tap through six quick missions with counting, shapes, sounds, story order, motion, and living things. Earn stars and launch after every two missions.</p><button type="button" onClick={() => setStage("play")} style={primary}>Start building →</button><button type="button" onClick={() => setSoundOn((v) => !v)} style={secondary}>{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button></section></main></GameFrame>;

  if (stage === "launch") return <GameFrame title="Rainbow Rocket Park"><style>{css}</style><main style={page}><section style={hero}><div className="pop" style={bigEmoji}>🚀✨</div><span style={eyebrow}>MINI LAUNCH</span><h1 style={sectionTitle}>Two rocket parts are ready!</h1><p style={lead}>Your rainbow fuel refills to at least two. Next stop: a new learning world.</p><div style={stats}><strong>⭐ {stars}</strong><strong>🔥 {bestCombo}×</strong><strong>{fuelIcons}</strong></div><button type="button" onClick={continueLaunch} style={primary}>Fly to the next world →</button></section></main></GameFrame>;

  if (stage === "finish") return <GameFrame title="Rainbow Rocket Park"><style>{css}</style><main style={page}><section style={hero}><div className="pop" style={bigEmoji}>🌈🚀⭐</div><span style={eyebrow}>RAINBOW ROCKET COMPLETE</span><h1 style={sectionTitle}>{activeProfile.name} launched the rocket!</h1><p style={lead}>You practiced six real Kindergarten skills and used clues when the mission got tricky.</p><div style={stats}><strong>⭐ {stars} stars</strong><strong>🔥 {bestCombo}× combo</strong><strong>🎯 6 missions</strong></div><button type="button" onClick={replay} style={primary}>Build another rocket</button><Link href="/school" style={link}>Return to School Mode</Link></section></main></GameFrame>;

  return <GameFrame title="Rainbow Rocket Park"><style>{css}</style><main style={page}><header style={hud}><strong>{fuelIcons}</strong><div><span>⭐ {stars}</span><span>🔥 {combo}×</span><button type="button" onClick={() => setSoundOn((v) => !v)} style={soundButton}>{soundOn ? "🔊" : "🔇"}</button></div></header><section style={track}><div style={{ ...fill, width: `${((index + 1) / MISSIONS.length) * 100}%` }} /></section><section style={{ ...card, borderColor: mission.color }}><div style={topRow}><span style={{ ...chip, background: mission.color }}>{mission.subject}</span><span>{index + 1}/{MISSIONS.length}</span></div><div className="float" style={missionEmoji}>{mission.emoji}</div><span style={zone}>{mission.zone}</span><h1 style={question}>{mission.prompt}</h1><div style={visual}>{mission.visual}</div><div style={choices}>{mission.choices.map((choice) => { const right = choice === mission.answer; const wrong = selected === choice && !right; const reveal = feedback === "explanation" && right; return <button key={choice} type="button" data-correct={right ? "true" : "false"} onClick={() => choose(choice)} disabled={feedback === "explanation" || wrong} style={{ ...choiceButton, ...(reveal ? correctStyle : wrong ? wrongStyle : {}) }}>{choice}</button>; })}</div><section role="status" style={teaching}><strong>{feedback === "question" ? "YOUR TURN" : feedback === "hint" ? "CLUE" : "ROCKET REPORT"}</strong><p>{feedback === "question" ? "Tap the best answer." : feedback === "hint" ? mission.hint : selected === mission.answer ? mission.explanation : `The answer is ${mission.answer}. ${mission.explanation}`}</p>{feedback === "hint" ? <span>Try again. Your rocket is still waiting.</span> : feedback === "explanation" ? <button type="button" onClick={next} style={primary}>{index === MISSIONS.length - 1 ? "Launch the rainbow rocket →" : "Add the rocket part →"}</button> : null}</section></section></main></GameFrame>;
}

const css = `@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes pop{0%{transform:scale(.7);opacity:0}80%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}.float{animation:float 2s ease-in-out infinite}.pop{animation:pop .5s ease-out both}@media(prefers-reduced-motion:reduce){.float,.pop{animation:none}}`;
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 70px", background: "radial-gradient(circle at top,#253458,#11172a 55%,#0b0f1c)", color: "#fff" };
const hero: React.CSSProperties = { maxWidth: 850, margin: "0 auto", padding: "clamp(26px,7vw,60px)", borderRadius: 34, textAlign: "center", background: "linear-gradient(145deg,rgba(255,155,210,.15),rgba(127,220,255,.12),#171d31)", border: "1px solid rgba(255,255,255,.15)" };
const bigEmoji: React.CSSProperties = { fontSize: "clamp(5rem,18vw,9rem)" };
const eyebrow: React.CSSProperties = { color: "#ffd45c", fontSize: 11, fontWeight: 950, letterSpacing: ".14em" };
const heroTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(3rem,9vw,6rem)", lineHeight: .9 };
const sectionTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.5rem,8vw,5rem)", lineHeight: .92 };
const lead: React.CSSProperties = { maxWidth: 700, margin: "12px auto 22px", color: "#d0d7e5", lineHeight: 1.55, fontWeight: 700 };
const primary: React.CSSProperties = { margin: 6, padding: "14px 19px", border: 0, borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, background: "#222b43", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const link: React.CSSProperties = { ...secondary, display: "inline-block", textDecoration: "none" };
const hud: React.CSSProperties = { maxWidth: 860, margin: "0 auto 12px", padding: 14, borderRadius: 22, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(19,25,43,.94)", border: "1px solid rgba(255,255,255,.12)" };
const soundButton: React.CSSProperties = { marginLeft: 10, border: 0, background: "transparent", fontSize: 18, cursor: "pointer" };
const track: React.CSSProperties = { maxWidth: 860, height: 10, margin: "0 auto 12px", borderRadius: 999, background: "#29334d", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#ff9bd2,#7fdcff,#d9ff5b)" };
const card: React.CSSProperties = { maxWidth: 860, margin: "0 auto", padding: "clamp(20px,5vw,40px)", borderRadius: 32, background: "#171d31", border: "2px solid", textAlign: "center" };
const topRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 950 };
const chip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, color: "#10131b", fontSize: 11 };
const missionEmoji: React.CSSProperties = { fontSize: "clamp(4rem,15vw,8rem)", marginTop: 12 };
const zone: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".14em" };
const question: React.CSSProperties = { margin: "10px auto 14px", fontSize: "clamp(2rem,7vw,4rem)", lineHeight: .98 };
const visual: React.CSSProperties = { margin: "0 auto 18px", padding: 18, borderRadius: 20, background: "#0f1424", fontSize: "clamp(1.2rem,5vw,2.6rem)", fontWeight: 900 };
const choices: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 };
const choiceButton: React.CSSProperties = { minHeight: 72, padding: 13, borderRadius: 20, border: "1px solid #3a4662", background: "#222b43", color: "#fff", fontSize: "clamp(1.15rem,5vw,1.8rem)", fontWeight: 950, cursor: "pointer" };
const correctStyle: React.CSSProperties = { background: "rgba(217,255,91,.15)", borderColor: "#d9ff5b", color: "#efffc1" };
const wrongStyle: React.CSSProperties = { background: "rgba(255,155,210,.13)", borderColor: "#ff9bd2" };
const teaching: React.CSSProperties = { marginTop: 16, padding: 16, borderRadius: 20, background: "#0f1424", border: "1px solid #2f3953", textAlign: "left" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: 18 };
