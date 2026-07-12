"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useState } from "react";

const GAME_SLUG = "adaptive-boss-arena";
type Step = { prompt: string; visual: string; choices: string[]; answer: string; hint: string; skillId: string; skillLabel: string; standard: string };
type GradeSet = { title: string; boss: string; emoji: string; color: string; easy: Step[]; hard: Step[] };

const SETS: Record<ElementaryGrade, GradeSet> = {
  [-1]: { title: "Critter Cloud Boss", boss: "Stormy", emoji: "☁️🐣", color: "#ffd45c", easy: [
    { prompt: "How many chicks?", visual: "🐥 🐥", choices: ["1", "2", "3"], answer: "2", hint: "Touch each chick once.", skillId: "math-counting", skillLabel: "Count small groups", standard: "TK.CC.1" },
    { prompt: "Which is round?", visual: "● ▲ ■", choices: ["●", "▲", "■"], answer: "●", hint: "Find the shape with no corners.", skillId: "math-geometry", skillLabel: "Notice shapes", standard: "TK.G.1" },
    { prompt: "Which starts like ball?", visual: "b-b-ball", choices: ["bear", "sun", "cat"], answer: "bear", hint: "Listen for the /b/ sound.", skillId: "reading-spelling-easy", skillLabel: "Hear beginning sounds", standard: "TK.RF.2" }], hard: [
    { prompt: "What comes next?", visual: "🍎 🍌 🍎 🍌 ___", choices: ["🍎", "🍌", "🍇"], answer: "🍎", hint: "The two-part pattern repeats.", skillId: "logic-patterns", skillLabel: "Continue patterns", standard: "TK.PATTERN.1" },
    { prompt: "Which rhymes with cat?", visual: "🐱 cat", choices: ["hat", "dog", "sun"], answer: "hat", hint: "Listen to the ending sound.", skillId: "reading-rhyming", skillLabel: "Hear rhymes", standard: "TK.RF.2a" },
    { prompt: "What helps in rain?", visual: "🌧️", choices: ["☂️ umbrella", "🕶️ glasses", "🩴 sandals"], answer: "☂️ umbrella", hint: "Choose what keeps you dry.", skillId: "science-weather", skillLabel: "Observe weather", standard: "TK-ESS2" }] },
  0: { title: "Rainbow Meteor Boss", boss: "Glitch Comet", emoji: "🌈☄️", color: "#ff9bd2", easy: [
    { prompt: "How many stars?", visual: "⭐ ⭐ ⭐ ⭐", choices: ["3", "4", "5"], answer: "4", hint: "Count each star once.", skillId: "math-counting", skillLabel: "Count quantities", standard: "K.CC.B.4" },
    { prompt: "Which starts like moon?", visual: "🌙 moon", choices: ["map", "sun", "fish"], answer: "map", hint: "Listen for /m/.", skillId: "reading-spelling-easy", skillLabel: "Beginning sounds", standard: "RF.K.2" },
    { prompt: "Which shape has 3 sides?", visual: "▲ ■ ●", choices: ["▲", "■", "●"], answer: "▲", hint: "Count the sides.", skillId: "math-geometry", skillLabel: "Recognize shapes", standard: "K.G.A.2" }], hard: [
    { prompt: "Two rockets join two rockets. How many?", visual: "🚀🚀 + 🚀🚀", choices: ["3", "4", "5"], answer: "4", hint: "Count all rockets together.", skillId: "math-addition", skillLabel: "Add within 5", standard: "K.OA.A.1" },
    { prompt: "What happens first?", visual: "helmet → buckle → launch", choices: ["helmet", "launch", "land"], answer: "helmet", hint: "Follow the arrows from the start.", skillId: "reading-sequencing", skillLabel: "Story order", standard: "W.K.3" },
    { prompt: "What does a plant need?", visual: "🌱 + ?", choices: ["water", "toy", "bell"], answer: "water", hint: "Think about a thirsty plant.", skillId: "environment-ecosystems", skillLabel: "Living things", standard: "K-LS1-1" }] },
  1: { title: "Robot Wrecking Boss", boss: "Mega Rust", emoji: "🤖⚙️", color: "#7fdcff", easy: [
    { prompt: "7 + 5 = ?", visual: "7 + 5", choices: ["11", "12", "13"], answer: "12", hint: "Make ten, then add two.", skillId: "math-addition", skillLabel: "Addition within 20", standard: "1.OA.C.6" },
    { prompt: "Which has long a?", visual: "a_e", choices: ["cake", "cat", "cap"], answer: "cake", hint: "Silent e helps a say its name.", skillId: "reading-spelling-easy", skillLabel: "Decode words", standard: "RF.1.3" },
    { prompt: "Which lets light through?", visual: "🔦 → ?", choices: ["clear glass", "wood", "cardboard"], answer: "clear glass", hint: "Choose what you can see through.", skillId: "science-light-sound", skillLabel: "Light and materials", standard: "1-PS4-2" }], hard: [
    { prompt: "15 − 7 = ?", visual: "15 − 7", choices: ["7", "8", "9"], answer: "8", hint: "Count back seven.", skillId: "math-subtraction", skillLabel: "Subtraction within 20", standard: "1.OA.C.6" },
    { prompt: "Which number has 4 tens and 2 ones?", visual: "40 + 2", choices: ["24", "42", "402"], answer: "42", hint: "Four tens make forty.", skillId: "math-place-value", skillLabel: "Tens and ones", standard: "1.NBT.B.2" },
    { prompt: "Why did Mia wear boots?", visual: "Puddles covered the road.", choices: ["puddles", "bedtime", "lost shoe"], answer: "puddles", hint: "Use the sentence detail.", skillId: "reading-comprehension-detail", skillLabel: "Use story details", standard: "RL.1.1" }] },
  2: { title: "Dino Volcano Boss", boss: "Lava Rex", emoji: "🦖🌋", color: "#d9ff5b", easy: [
    { prompt: "27 + 16 = ?", visual: "27 + 16", choices: ["33", "43", "53"], answer: "43", hint: "Add ones, then regroup.", skillId: "math-word-problems", skillLabel: "Add within 100", standard: "2.NBT.B.5" },
    { prompt: "9 + 8 = ?", visual: "9 + 8", choices: ["16", "17", "18"], answer: "17", hint: "Make ten, then add seven.", skillId: "math-addition", skillLabel: "Add within 20", standard: "2.OA.B.2" },
    { prompt: "Which is a solid?", visual: "🧊 💧 💨", choices: ["ice", "water", "steam"], answer: "ice", hint: "A solid keeps its shape.", skillId: "science-matter", skillLabel: "States of matter", standard: "2-PS1-1" }], hard: [
    { prompt: "63 − 28 = ?", visual: "63 − 28", choices: ["35", "45", "55"], answer: "35", hint: "Regroup one ten.", skillId: "math-subtraction", skillLabel: "Subtract within 100", standard: "2.NBT.B.5" },
    { prompt: "Which detail proves the nest was safe?", visual: "The nest sat high above the fox.", choices: ["high above", "made of twigs", "near a tree"], answer: "high above", hint: "Choose the detail that blocks the fox.", skillId: "reading-comprehension-detail", skillLabel: "Use text evidence", standard: "RL.2.1" },
    { prompt: "Which material best protects an egg?", visual: "🥚 needs a cushion", choices: ["soft foam", "thin paper", "metal spoon"], answer: "soft foam", hint: "Choose the material that absorbs impact.", skillId: "engineering-design", skillLabel: "Compare materials", standard: "K-2-ETS1-3" }] },
  3: { title: "Cosmic Reactor Boss", boss: "Void Core", emoji: "🪐⚡", color: "#c6b8ff", easy: [
    { prompt: "6 × 4 = ?", visual: "6 groups of 4", choices: ["20", "24", "28"], answer: "24", hint: "Add four six times.", skillId: "math-multiplication", skillLabel: "Multiply within 100", standard: "3.OA.C.7" },
    { prompt: "24 ÷ 6 = ?", visual: "24 split into 6 groups", choices: ["3", "4", "5"], answer: "4", hint: "What times six equals 24?", skillId: "math-division", skillLabel: "Division facts", standard: "3.OA.C.7" },
    { prompt: "What do roots absorb?", visual: "🌱", choices: ["water", "sunlight", "wind"], answer: "water", hint: "Roots are underground.", skillId: "science-life-cycles", skillLabel: "Plant structures", standard: "3-LS1-1" }], hard: [
    { prompt: "A ship travels 4 legs of 18 miles. Total?", visual: "4 × 18", choices: ["62", "72", "82"], answer: "72", hint: "4 × 10 plus 4 × 8.", skillId: "math-word-problems", skillLabel: "Two-step reasoning", standard: "3.OA.D.8" },
    { prompt: "Which detail best supports the claim?", visual: "The bridge held 50 heavy crates.", choices: ["held 50 crates", "painted blue", "near a river"], answer: "held 50 crates", hint: "Choose evidence about strength.", skillId: "reading-comprehension-detail", skillLabel: "Use text evidence", standard: "RI.3.1" },
    { prompt: "Which design is strongest?", visual: "triangle brace vs flat strip", choices: ["triangle brace", "flat strip", "paper loop"], answer: "triangle brace", hint: "Triangles resist changing shape.", skillId: "engineering-design", skillLabel: "Compare designs", standard: "3-5-ETS1-2" }] },
  4: { title: "Temple Titan Boss", boss: "Stone Colossus", emoji: "🗿🔥", color: "#ffbd6a", easy: [
    { prompt: "Which equals 1/2?", visual: "1/2 = ?", choices: ["2/4", "2/3", "3/4"], answer: "2/4", hint: "Multiply top and bottom by two.", skillId: "math-fractions", skillLabel: "Equivalent fractions", standard: "4.NF.A.1" },
    { prompt: "23 × 4 = ?", visual: "23 × 4", choices: ["82", "92", "102"], answer: "92", hint: "4 × 20 plus 4 × 3.", skillId: "math-multiplication", skillLabel: "Multi-digit multiplication", standard: "4.NBT.B.5" },
    { prompt: "What causes erosion?", visual: "river moving soil", choices: ["moving water", "moonlight", "shadows"], answer: "moving water", hint: "Look for something carrying soil away.", skillId: "science-earth", skillLabel: "Weathering and erosion", standard: "4-ESS2-1" }], hard: [
    { prompt: "A team packs 6 boxes with 24 torches each. Total?", visual: "6 × 24", choices: ["124", "144", "164"], answer: "144", hint: "6 × 20 plus 6 × 4.", skillId: "math-word-problems", skillLabel: "Multistep problems", standard: "4.OA.A.3" },
    { prompt: "Which detail supports the inference that Koa was nervous?", visual: "His hands shook as the door opened.", choices: ["hands shook", "door opened", "room was old"], answer: "hands shook", hint: "Choose the physical clue about emotion.", skillId: "reading-inference", skillLabel: "Make inferences", standard: "RL.4.1" },
    { prompt: "Which transfers energy fastest?", visual: "metal vs wood spoon", choices: ["metal spoon", "wood spoon", "paper straw"], answer: "metal spoon", hint: "Metals conduct heat well.", skillId: "science-energy", skillLabel: "Energy transfer", standard: "4-PS3-2" }] },
  5: { title: "Cyber Dragon Boss", boss: "Hexabyte", emoji: "🐉💻", color: "#60f3c4", easy: [
    { prompt: "Which is greater?", visual: "0.72 or 0.7", choices: ["0.72", "0.7", "equal"], answer: "0.72", hint: "Write 0.7 as 0.70.", skillId: "math-decimals", skillLabel: "Compare decimals", standard: "5.NBT.A.3" },
    { prompt: "1/2 + 1/4 = ?", visual: "1/2 + 1/4", choices: ["2/6", "3/4", "1/8"], answer: "3/4", hint: "Rename one half as two fourths.", skillId: "math-fractions", skillLabel: "Add fractions", standard: "5.NF.A.1" },
    { prompt: "What pulls objects toward Earth?", visual: "🍎 ↓", choices: ["gravity", "light", "sound"], answer: "gravity", hint: "It is the force that causes falling.", skillId: "science-forces", skillLabel: "Gravitational force", standard: "5-PS2-1" }], hard: [
    { prompt: "Volume of a 4 × 3 × 5 prism?", visual: "4 × 3 × 5", choices: ["12", "20", "60"], answer: "60", hint: "Multiply length, width, and height.", skillId: "math-volume", skillLabel: "Calculate volume", standard: "5.MD.C.5" },
    { prompt: "Which evidence best supports the claim?", visual: "Solar panels cut school electricity use by 30%.", choices: ["30% reduction", "panels are blue", "roof is flat"], answer: "30% reduction", hint: "Choose measurable evidence tied to the claim.", skillId: "reading-claims", skillLabel: "Evaluate evidence", standard: "RI.5.8" },
    { prompt: "Why can a distant star look dim?", visual: "⭐ far away", choices: ["distance", "gravity stops", "no heat"], answer: "distance", hint: "Apparent brightness changes with distance.", skillId: "science-space", skillLabel: "Star brightness", standard: "5-ESS1-1" }] }
};

function sound(correct: boolean) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = correct ? 720 : 190;
  gain.gain.setValueAtTime(.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .16);
  oscillator.start(); oscillator.stop(context.currentTime + .17); oscillator.addEventListener("ended", () => void context.close());
}

export default function AdaptiveBossArenaPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [stage, setStage] = useState<"loading" | "intro" | "play" | "finish">("loading");
  const [round, setRound] = useState(0); const [level, setLevel] = useState<"easy" | "hard">("easy");
  const [bossHp, setBossHp] = useState(3); const [hearts, setHearts] = useState(3); const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0); const [feedback, setFeedback] = useState<"question" | "hint" | "result">("question");
  const [misses, setMisses] = useState(0); const [soundOn, setSoundOn] = useState(true);

  useEffect(() => { if (!hydrated) return; setGrade(readProfileGrade(activeProfile)); setStage("intro"); }, [activeProfile, hydrated]);
  const set = grade === null ? null : SETS[grade];
  const mission = useMemo(() => set ? set[level][round] : null, [level, round, set]);

  function choose(choice: string) {
    if (!mission || feedback === "result") return;
    const correct = choice === mission.answer;
    recordLearningAttempt({ gameSlug: GAME_SLUG, subject: mission.skillId.startsWith("math") ? "Math" : mission.skillId.startsWith("reading") ? "Reading" : "Science", skillId: mission.skillId, skillLabel: mission.skillLabel, prompt: mission.prompt, correctAnswer: mission.answer, correct, data: { standardCode: mission.standard, adaptiveLevel: level, bossRound: round + 1 } }, activeProfile.id);
    sound(soundOn && correct);
    if (!correct) { setMisses((v) => v + 1); setHearts((v) => Math.max(0, v - 1)); setCombo(0); setFeedback("hint"); return; }
    const nextCombo = misses === 0 ? combo + 1 : 0;
    setCombo(nextCombo); setBossHp((v) => Math.max(0, v - 1)); setScore((v) => v + (level === "hard" ? 200 : 120) + nextCombo * 25);
    setFeedback("result");
  }

  function nextRound() {
    if (round === 2) { completeGame({ xp: 28 + score / 100, coins: 7 + combo, score }); setStage("finish"); return; }
    setLevel(misses === 0 ? "hard" : "easy"); setRound((v) => v + 1); setMisses(0); setFeedback("question");
  }

  function replay() { restartGame(); setStage("intro"); setRound(0); setLevel("easy"); setBossHp(3); setHearts(3); setCombo(0); setScore(0); setFeedback("question"); setMisses(0); }
  if (!set || stage === "loading" || !mission) return <GameFrame title="Adaptive Boss Arena"><main style={base}>Loading arena…</main></GameFrame>;

  return <GameFrame title={set.title}><main style={{ ...base, background: `radial-gradient(circle at top, ${set.color}33, #111827 62%)` }}>
    <section style={card}>
      {stage === "intro" && <><div style={boss}>{set.emoji}</div><p style={eyebrow}>ADAPTIVE BOSS BATTLE</p><h1>{set.title}</h1><p>Beat {set.boss} in three rounds. Clean hits unlock tougher attacks. A miss activates coach mode and keeps the next round approachable.</p><button style={{ ...primary, background: set.color }} onClick={() => setStage("play")}>Enter the arena →</button></>}
      {stage === "play" && <><div style={hud}><span>❤️ {hearts}</span><span>🔥 {combo}</span><span>Boss {"●".repeat(bossHp)}{"○".repeat(3 - bossHp)}</span><button onClick={() => setSoundOn((v) => !v)} style={soundButton}>{soundOn ? "🔊" : "🔇"}</button></div>
        <p style={eyebrow}>ROUND {round + 1} · {level === "hard" ? "POWER ATTACK" : "WARM-UP ATTACK"}</p><div style={boss}>{set.emoji}</div><h1>{mission.prompt}</h1><div style={visual}>{mission.visual}</div>
        {feedback === "hint" && <div style={hint}><strong>COACH MODE</strong><br />{mission.hint}</div>}
        <div style={choices}>{mission.choices.map((choice) => <button data-correct={choice === mission.answer} key={choice} onClick={() => choose(choice)} style={choiceButton}>{choice}</button>)}</div>
        {feedback === "result" && <div style={result}><strong>DIRECT HIT!</strong><p>{mission.answer} is correct.</p><button style={{ ...primary, background: set.color }} onClick={nextRound}>{round === 2 ? "Claim boss treasure →" : "Next adaptive round →"}</button></div>}
      </>}
      {stage === "finish" && <><div style={boss}>🏆{set.emoji}</div><p style={eyebrow}>BOSS DEFEATED</p><h1>{activeProfile.name} saved the arena!</h1><p>Score {score} · Best combo {combo} · The battle adapted after every round.</p><button style={{ ...primary, background: set.color }} onClick={replay}>Battle again →</button></>}
    </section>
  </main></GameFrame>;
}

const base = { minHeight: "100vh", padding: "32px 16px", color: "white", display: "grid", placeItems: "center", fontFamily: "system-ui" };
const card = { width: "min(720px, 100%)", padding: "28px", borderRadius: 28, background: "#0f172acc", border: "1px solid #ffffff22", textAlign: "center" as const, boxShadow: "0 24px 80px #0008" };
const boss = { fontSize: 74, animation: "pulse 1s ease-in-out infinite alternate" };
const eyebrow = { letterSpacing: 2, fontSize: 13, fontWeight: 900 };
const visual = { fontSize: 32, padding: 18, margin: "16px 0", borderRadius: 18, background: "#ffffff12" };
const hud = { display: "flex", gap: 14, flexWrap: "wrap" as const, justifyContent: "center", alignItems: "center", fontWeight: 800 };
const choices = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginTop: 18 };
const choiceButton = { minHeight: 76, borderRadius: 18, border: "1px solid #ffffff30", background: "#ffffff14", color: "white", fontSize: 20, fontWeight: 850, padding: 14, cursor: "pointer" };
const primary = { marginTop: 18, minHeight: 58, border: 0, borderRadius: 18, padding: "14px 22px", fontSize: 18, fontWeight: 900, cursor: "pointer", color: "#10131b" };
const hint = { marginTop: 16, padding: 16, borderRadius: 16, background: "#fbbf2430", border: "1px solid #fbbf2466" };
const result = { marginTop: 18, padding: 18, borderRadius: 18, background: "#22c55e22", border: "1px solid #22c55e66" };
const soundButton = { border: 0, borderRadius: 12, background: "#ffffff18", color: "white", padding: 8, cursor: "pointer" };
