"use client";

import GameFrame from "@/components/GameFrame";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useRef, useState } from "react";

const GAME_SLUG = "number-quest";
const QUESTION_COUNT = 6;

type MathSkill = "math-counting" | "math-addition" | "math-subtraction" | "math-place-value" | "math-multiplication" | "math-division" | "math-fractions" | "math-decimals" | "math-measurement" | "math-geometry";
type FeedbackStage = "question" | "hint" | "explanation";
type QuestQuestion = { skillId: MathSkill; skillLabel: string; standardCode: string; prompt: string; visual?: string; answer: string; choices: string[]; hint: string; explanation: string };
type Theme = { world: string; hero: string; mission: string; enemy: string; icon: string; accent: string };

function hashText(text: string) { let hash = 2166136261; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seededRandom(seed: number) { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let result = value; result = Math.imul(result ^ (result >>> 15), result | 1); result ^= result + Math.imul(result ^ (result >>> 7), result | 61); return ((result ^ (result >>> 14)) >>> 0) / 4294967296; }; }
function shuffle<T>(values: T[], random: () => number) { const next = [...values]; for (let i = next.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; } return next; }
function choices(answer: string, distractors: string[], random: () => number) { return shuffle([...new Set([answer, ...distractors])].slice(0, 4), random); }
function numericChoices(answer: number, random: () => number, step = 1) { const out: string[] = []; for (const offset of shuffle([-2, -1, 1, 2, 3], random)) { const value = answer + offset * step; if (value >= 0) out.push(String(value)); if (out.length === 3) break; } return choices(String(answer), out, random); }
function dateKey() { return new Date().toISOString().slice(0, 10); }

function themeForGrade(grade: number): Theme {
  if (grade < 0) return { world: "Dino Counting Valley", hero: "Tiny Trailblazer", mission: "Wake six sleepy dinosaurs", enemy: "the Fog Cloud", icon: "🦕", accent: "#ffcf8b" };
  if (grade === 0) return { world: "Rainbow Rocket Park", hero: "Number Cadet", mission: "Fuel six rainbow rockets", enemy: "the Empty Tank", icon: "🚀", accent: "#ff8fda" };
  if (grade === 1) return { world: "Robot Rescue City", hero: "Code Captain", mission: "Repair six friendly robots", enemy: "the Glitch Gremlin", icon: "🤖", accent: "#7fdcff" };
  if (grade === 2) return { world: "Dragon Castle", hero: "Math Knight", mission: "Unlock six dragon gates", enemy: "the Shadow Wizard", icon: "🐉", accent: "#d9ff5b" };
  if (grade === 3) return { world: "Space Station Sigma", hero: "Galaxy Engineer", mission: "Restore six power cores", enemy: "the Meteor Swarm", icon: "🪐", accent: "#c6b8ff" };
  if (grade === 4) return { world: "Mystery Temple", hero: "Puzzle Ranger", mission: "Recover six lost relics", enemy: "the Stone Sphinx", icon: "🗿", accent: "#ffcf8b" };
  return { world: "Cyber City 5", hero: "Master Strategist", mission: "Hack six number vaults", enemy: "the Null Virus", icon: "⚡", accent: "#7fdcff" };
}

function skillsForGrade(grade: number): MathSkill[] {
  if (grade < 0) return ["math-counting", "math-addition", "math-geometry"];
  if (grade === 0) return ["math-counting", "math-addition", "math-subtraction", "math-geometry"];
  if (grade === 1) return ["math-addition", "math-subtraction", "math-place-value", "math-measurement"];
  if (grade === 2) return ["math-place-value", "math-addition", "math-subtraction", "math-geometry"];
  if (grade === 3) return ["math-multiplication", "math-division", "math-fractions", "math-measurement"];
  if (grade === 4) return ["math-multiplication", "math-fractions", "math-measurement", "math-geometry"];
  return ["math-decimals", "math-fractions", "math-multiplication", "math-measurement"];
}

function standardFor(grade: number, skill: MathSkill) {
  if (grade < 0) return skill === "math-counting" ? "TK.MATH.1" : "TK.MATH.2";
  if (grade === 0) return skill === "math-counting" ? "K.CC.A.1" : skill === "math-geometry" ? "K.G.A.2" : "K.OA.A.1";
  if (grade === 1) return skill === "math-place-value" ? "1.NBT.B.2" : skill === "math-measurement" ? "1.MD.A.1" : "1.OA.C.6";
  if (grade === 2) return skill === "math-place-value" ? "2.NBT.B.5" : skill === "math-geometry" ? "2.G.A.1" : "2.OA.B.2";
  if (grade === 3) return skill === "math-multiplication" ? "3.OA.A.1" : skill === "math-division" ? "3.OA.B.6" : skill === "math-fractions" ? "3.NF.A.1" : "3.MD.B.3";
  if (grade === 4) return skill === "math-multiplication" ? "4.NBT.B.5" : skill === "math-fractions" ? "4.NF.A.1" : skill === "math-measurement" ? "4.MD.A.3" : "4.G.A.1";
  return skill === "math-decimals" ? "5.NBT.A.3" : skill === "math-fractions" ? "5.NF.A.1" : skill === "math-measurement" ? "5.MD.C.3" : "5.NBT.B.5";
}

function makeQuestion(grade: number, skill: MathSkill, random: () => number): QuestQuestion {
  const standardCode = standardFor(grade, skill);
  if (skill === "math-counting") { const count = 3 + Math.floor(random() * (grade < 0 ? 6 : 12)); const icon = ["⭐", "🦕", "🍎", "🚀"][Math.floor(random() * 4)]; return { skillId: skill, skillLabel: "Counting and quantity", standardCode, prompt: "How many objects are in this group?", visual: Array.from({ length: count }, () => icon).join(" "), answer: String(count), choices: numericChoices(count, random), hint: "Touch each object once while counting out loud.", explanation: `There are ${count} objects. The last number counted tells the total.` }; }
  if (skill === "math-addition" || skill === "math-subtraction") { const max = grade <= 0 ? 5 : grade === 1 ? 20 : 100; const left = 1 + Math.floor(random() * Math.max(3, max)); const right = skill === "math-subtraction" ? Math.floor(random() * (left + 1)) : 1 + Math.floor(random() * Math.max(2, Math.min(max - left, max / 2))); const answer = skill === "math-addition" ? left + right : left - right; const symbol = skill === "math-addition" ? "+" : "−"; return { skillId: skill, skillLabel: skill === "math-addition" ? "Addition" : "Subtraction", standardCode, prompt: `${left} ${symbol} ${right} = ?`, answer: String(answer), choices: numericChoices(answer, random), hint: skill === "math-addition" ? "Make a friendly number first." : "Count up or take away in chunks.", explanation: `${left} ${symbol} ${right} = ${answer}.` }; }
  if (skill === "math-place-value") { const number = grade <= 1 ? 10 + Math.floor(random() * 89) : 100 + Math.floor(random() * 899); const tens = Math.floor((number % 100) / 10); return { skillId: skill, skillLabel: "Place value", standardCode, prompt: `In ${number}, what digit is in the tens place?`, answer: String(tens), choices: choices(String(tens), [String(Math.floor(number / 100)), String(number % 10), String((tens + 1) % 10)], random), hint: "Read right to left: ones, tens, hundreds.", explanation: `The tens digit is ${tens}, worth ${tens * 10}.` }; }
  if (skill === "math-multiplication") { const left = 2 + Math.floor(random() * (grade === 3 ? 9 : 11)); const right = 2 + Math.floor(random() * 9); const answer = left * right; return { skillId: skill, skillLabel: "Multiplication", standardCode, prompt: `${left} × ${right} = ?`, answer: String(answer), choices: numericChoices(answer, random, Math.min(left, right)), hint: `Think of ${left} groups of ${right}.`, explanation: `${left} groups of ${right} make ${answer}.` }; }
  if (skill === "math-division") { const divisor = 2 + Math.floor(random() * 8); const quotient = 2 + Math.floor(random() * 10); const dividend = divisor * quotient; return { skillId: skill, skillLabel: "Division", standardCode, prompt: `${dividend} ÷ ${divisor} = ?`, answer: String(quotient), choices: numericChoices(quotient, random), hint: `What times ${divisor} equals ${dividend}?`, explanation: `${divisor} × ${quotient} = ${dividend}.` }; }
  if (skill === "math-fractions") { const denominator = [2, 3, 4, 6, 8][Math.floor(random() * 5)]; const numerator = 1 + Math.floor(random() * (denominator - 1)); return { skillId: skill, skillLabel: grade >= 4 ? "Fraction strategy" : "Fractions", standardCode, prompt: `What fraction is shaded?`, visual: `${"■ ".repeat(numerator)}${"□ ".repeat(denominator - numerator)}`.trim(), answer: `${numerator}/${denominator}`, choices: choices(`${numerator}/${denominator}`, [`${denominator}/${numerator}`, `${Math.max(1, numerator - 1)}/${denominator}`, `${numerator}/${denominator + 1}`], random), hint: "Bottom number is total parts; top number is shaded parts.", explanation: `${numerator} of ${denominator} equal parts are shaded.` }; }
  if (skill === "math-decimals") { const first = (Math.floor(random() * 90) + 10) / 10; const second = (Math.floor(random() * 90) + 10) / 10; const answer = first === second ? "=" : first > second ? ">" : "<"; return { skillId: skill, skillLabel: "Decimals and place value", standardCode, prompt: `${first.toFixed(1)}  ?  ${second.toFixed(1)}`, answer, choices: shuffle([">", "<", "="], random), hint: "Compare whole numbers, then tenths.", explanation: `${first.toFixed(1)} ${answer} ${second.toFixed(1)}.` }; }
  if (skill === "math-measurement") { const length = 2 + Math.floor(random() * 8); const width = 2 + Math.floor(random() * 6); const volume = grade >= 5; const answer = volume ? length * width * 2 : length * width; return { skillId: skill, skillLabel: volume ? "Volume" : "Area and measurement", standardCode, prompt: volume ? `A box is ${length} × ${width} × 2. What is its volume?` : `A rectangle is ${length} by ${width}. What is its area?`, answer: String(answer), choices: numericChoices(answer, random, 2), hint: volume ? "Multiply length × width × height." : "Multiply length × width.", explanation: volume ? `${length} × ${width} × 2 = ${answer}.` : `${length} × ${width} = ${answer}.` }; }
  const shapes = [{ name: "triangle", sides: 3 }, { name: "square", sides: 4 }, { name: "pentagon", sides: 5 }, { name: "hexagon", sides: 6 }]; const shape = shapes[Math.floor(random() * shapes.length)]; return { skillId: "math-geometry", skillLabel: "Geometry", standardCode, prompt: `How many sides does a ${shape.name} have?`, answer: String(shape.sides), choices: numericChoices(shape.sides, random), hint: "Trace the edge and count each side once.", explanation: `A ${shape.name} has ${shape.sides} sides.` };
}

export default function NumberQuestPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState(2); const [focus, setFocus] = useState<MathSkill | null>(null); const [index, setIndex] = useState(0); const [question, setQuestion] = useState<QuestQuestion | null>(null); const [score, setScore] = useState(0); const [firstTry, setFirstTry] = useState(0); const [selected, setSelected] = useState<string | null>(null); const [wrongAttempts, setWrongAttempts] = useState(0); const [stage, setStage] = useState<FeedbackStage>("question"); const [finished, setFinished] = useState(false); const [combo, setCombo] = useState(0); const [bestCombo, setBestCombo] = useState(0); const [shield, setShield] = useState(1); const initialized = useRef(false);
  const theme = useMemo(() => themeForGrade(grade), [grade]);
  const progressPercent = ((index + (stage === "explanation" ? 1 : 0)) / QUESTION_COUNT) * 100;

  function buildQuestion(nextIndex: number, nextGrade = grade, nextFocus = focus) { const available = skillsForGrade(nextGrade); const selectedSkill = nextFocus && available.includes(nextFocus) ? nextFocus : available[nextIndex % available.length]; const random = seededRandom(hashText(`${activeProfile.id}:${dateKey()}:${nextGrade}:${nextIndex}:${selectedSkill}`)); setQuestion(makeQuestion(nextGrade, selectedSkill, random)); setSelected(null); setWrongAttempts(0); setStage("question"); }
  useEffect(() => { if (!hydrated || initialized.current) return; initialized.current = true; const selectedGrade = readProfileGrade(activeProfile); const requested = new URLSearchParams(window.location.search).get("focus") as MathSkill | null; setGrade(selectedGrade); setFocus(requested); buildQuestion(0, selectedGrade, requested); }, [activeProfile.id, hydrated]);
  const feedback = useMemo(() => !question ? "" : stage === "hint" ? question.hint : stage === "explanation" ? question.explanation : `${theme.enemy} is blocking the path. Choose your move.`, [question, stage, theme.enemy]);
  function record(correct: boolean) { if (!question) return; recordLearningAttempt({ gameSlug: GAME_SLUG, subject: "Math", skillId: question.skillId, skillLabel: question.skillLabel, prompt: question.prompt, correctAnswer: question.answer, correct, data: { standardCode: question.standardCode, grade, numberQuest: true, combo } }, activeProfile.id); }
  function choose(value: string) { if (!question || stage === "explanation") return; setSelected(value); const correct = value === question.answer; if (!correct && wrongAttempts === 0) { record(false); if (shield > 0) setShield(0); setCombo(0); setWrongAttempts(1); setStage("hint"); return; } if (!correct) { setCombo(0); setWrongAttempts((current) => current + 1); setStage("explanation"); return; } record(true); const nextCombo = wrongAttempts === 0 ? combo + 1 : 0; const comboBonus = wrongAttempts === 0 ? nextCombo * 15 : 0; setCombo(nextCombo); setBestCombo((current) => Math.max(current, nextCombo)); setScore((current) => current + (wrongAttempts === 0 ? 100 : 65) + comboBonus); if (wrongAttempts === 0) setFirstTry((current) => current + 1); setStage("explanation"); }
  function next() { if (stage !== "explanation") return; if (index >= QUESTION_COUNT - 1) { completeGame({ xp: 25 + firstTry * 4 + bestCombo * 2, coins: 8 + Math.floor(firstTry / 2) + (bestCombo >= 3 ? 3 : 0), score }); setFinished(true); return; } const nextIndex = index + 1; setIndex(nextIndex); buildQuestion(nextIndex); }
  function restart() { restartGame(); setIndex(0); setScore(0); setFirstTry(0); setCombo(0); setBestCombo(0); setShield(1); setFinished(false); buildQuestion(0); }

  if (!hydrated || !question) return <GameFrame title="Number Quest"><section style={card}><h1>Building your number trail…</h1></section></GameFrame>;
  if (finished) return <GameFrame title="Number Quest"><section style={{ ...card, textAlign: "center" }}><div style={{ fontSize: 88 }}>{theme.icon}</div><span style={eyebrow}>QUEST COMPLETE</span><h1 style={heroTitle}>{theme.world} is saved.</h1><p style={muted}>{score} points · {firstTry}/{QUESTION_COUNT} independent solves · best combo ×{bestCombo}</p><div style={rewardRow}><span>⭐ Combo bonus</span><span>🪙 Treasure bonus {bestCombo >= 3 ? "unlocked" : "next time"}</span></div><button type="button" style={primaryButton} onClick={restart}>Play another trail</button></section></GameFrame>;

  return <GameFrame title="Number Quest"><main style={shell}><section style={{ ...mapHeader, borderColor: theme.accent }}><div><span style={eyebrow}>{theme.world.toUpperCase()} · {gradeLabel(grade).toUpperCase()}</span><h1 style={heroTitle}>Cross six math gates.</h1><p style={muted}>{theme.hero}, {theme.mission.toLowerCase()}. Build a combo for bonus points and treasure.</p></div><div style={hud}><div style={scoreOrb}><strong>{score}</strong><span>POINTS</span></div><div style={comboOrb}><strong>×{combo}</strong><span>COMBO</span></div></div></section><div style={missionStrip}><span>{theme.icon} {theme.mission}</span><span>{shield ? "🛡️ Clue shield ready" : "🛡️ Shield used"}</span></div><div style={track}><div style={{ ...fill, width: `${progressPercent}%` }} /></div><div style={routeLabels}><span>Gate {index + 1} of {QUESTION_COUNT}</span><span>{question.standardCode}</span></div><section style={card}><div style={standardRow}><span style={standardChip}>{question.standardCode}</span><span style={skillChip}>{question.skillLabel}</span>{combo >= 2 && <span style={comboChip}>🔥 {combo} streak</span>}</div><h2 style={questionTitle}>{question.prompt}</h2>{question.visual && <div style={visual} aria-label="Question objects">{question.visual}</div>}<div style={answerGrid}>{question.choices.map((choice) => { const correct = choice === question.answer; const chosen = selected === choice; return <button type="button" key={choice} data-correct={correct ? "true" : "false"} onClick={() => choose(choice)} style={{ ...answerButton, ...(stage === "explanation" && correct ? correctButton : {}), ...(chosen && !correct ? wrongButton : {}) }}>{choice}</button>; })}</div><div role="status" style={{ ...feedbackCard, ...(stage === "hint" ? hintCard : stage === "explanation" ? explanationCard : {}) }}><strong>{stage === "hint" ? "CLUE UNLOCKED" : stage === "explanation" ? selected === question.answer ? combo >= 2 ? `COMBO ×${combo}!` : "GATE CLEARED" : "NEW PATH" : "YOUR MOVE"}</strong><p>{feedback}</p>{stage === "explanation" && <button type="button" style={primaryButton} onClick={next}>{index === QUESTION_COUNT - 1 ? "Open the treasure →" : "Next gate →"}</button>}</div></section></main></GameFrame>;
}

const shell: React.CSSProperties = { width: "min(960px,100%)", margin: "0 auto", display: "grid", gap: 16 };
const mapHeader: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 20, alignItems: "center", padding: "clamp(22px,5vw,42px)", borderRadius: 30, background: "linear-gradient(145deg,rgba(217,255,91,.12),rgba(127,220,255,.1),#181d28)", border: "1px solid" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 11, letterSpacing: ".15em" };
const heroTitle: React.CSSProperties = { margin: "8px 0 12px", fontSize: "clamp(2.8rem,8vw,5.8rem)", lineHeight: .9, letterSpacing: "-.065em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55, fontWeight: 700 };
const hud: React.CSSProperties = { justifySelf: "end", display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" };
const scoreOrb: React.CSSProperties = { width: 112, height: 112, borderRadius: 999, display: "grid", placeContent: "center", textAlign: "center", background: "#d9ff5b", color: "#10131b" };
const comboOrb: React.CSSProperties = { ...scoreOrb, background: "#ffcf8b" };
const missionStrip: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 16, background: "#181d28", color: "#dfe5ec", fontWeight: 900 };
const track: React.CSSProperties = { height: 12, borderRadius: 999, background: "#222936", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)", transition: "width .3s ease" };
const routeLabels: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, color: "#8e97a6", fontSize: 12, fontWeight: 900 };
const card: React.CSSProperties = { padding: "clamp(22px,5vw,44px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.1)", color: "#fff" };
const standardRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const standardChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontSize: 12, fontWeight: 950 };
const skillChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 12, fontWeight: 900 };
const comboChip: React.CSSProperties = { ...skillChip, color: "#ffcf8b" };
const questionTitle: React.CSSProperties = { margin: "20px 0 16px", fontSize: "clamp(2rem,6vw,4.4rem)", lineHeight: 1, letterSpacing: "-.05em" };
const visual: React.CSSProperties = { padding: 20, marginBottom: 18, borderRadius: 20, background: "#10131b", fontSize: "clamp(1.5rem,5vw,3rem)", lineHeight: 1.6, textAlign: "center", letterSpacing: ".08em" };
const answerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 };
const answerButton: React.CSSProperties = { minHeight: 72, padding: "14px 16px", borderRadius: 18, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", fontSize: "clamp(1.15rem,4vw,1.8rem)", fontWeight: 950, cursor: "pointer" };
const correctButton: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.14)", color: "#d9ff5b" };
const wrongButton: React.CSSProperties = { borderColor: "#ff8f9c", background: "rgba(255,143,156,.1)" };
const feedbackCard: React.CSSProperties = { minHeight: 108, marginTop: 16, padding: 18, borderRadius: 20, background: "#10131b", border: "1px solid rgba(255,255,255,.08)", color: "#aab1bf" };
const hintCard: React.CSSProperties = { borderColor: "rgba(255,207,139,.38)", background: "rgba(255,207,139,.08)", color: "#ffcf8b" };
const explanationCard: React.CSSProperties = { borderColor: "rgba(217,255,91,.3)", color: "#dfe5ec" };
const primaryButton: React.CSSProperties = { marginTop: 8, padding: "13px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const rewardRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "18px 0" };