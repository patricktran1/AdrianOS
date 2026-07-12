"use client";

import GameFrame from "@/components/GameFrame";
import { readLearningForProfile, recordLearningAttempt, type ReviewItem } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useState } from "react";

const GAME_SLUG = "mastery-rescue-lab";
type Stage = "loading" | "intro" | "play" | "finish";
type Feedback = "question" | "hint" | "explanation";
type Challenge = { id: string; prompt: string; answer: string; choices: string[]; clue: string; explanation: string; subject: ReviewItem["subject"]; skillId: string; skillLabel: string; review: boolean };

const THEMES: Record<ElementaryGrade, { title: string; emoji: string; helper: string; rescued: string; accent: string; background: string }> = {
  [-1]: { title: "Critter Care Lab", emoji: "🐣🧪", helper: "Pip", rescued: "baby critters", accent: "#ffd45c", background: "radial-gradient(circle at top,#315d52,#172c31 58%,#10131b)" },
  0: { title: "Rainbow Fix-It Lab", emoji: "🌈🔧", helper: "Nova", rescued: "rainbow sparks", accent: "#ff9bd2", background: "radial-gradient(circle at top,#344a7b,#1b2442 58%,#10131b)" },
  1: { title: "Robot Repair Lab", emoji: "🤖🧪", helper: "Bolt", rescued: "helper bots", accent: "#7fdcff", background: "radial-gradient(circle at top,#274d68,#18263a 58%,#10131b)" },
  2: { title: "Dino Rescue Lab", emoji: "🦖🧪", helper: "Zip", rescued: "lost hatchlings", accent: "#d9ff5b", background: "radial-gradient(circle at top,#41652d,#21331d 58%,#10131b)" },
  3: { title: "Space Repair Lab", emoji: "🪐🧪", helper: "Comet", rescued: "station drones", accent: "#c6b8ff", background: "radial-gradient(circle at top,#38336b,#211f43 58%,#10131b)" },
  4: { title: "Temple Relic Lab", emoji: "🗿🧪", helper: "Koa", rescued: "ancient relics", accent: "#ffbd6a", background: "radial-gradient(circle at top,#664724,#34291d 58%,#10131b)" },
  5: { title: "Cyber Recovery Lab", emoji: "🌐🧪", helper: "Pulse", rescued: "security programs", accent: "#60f3c4", background: "radial-gradient(circle at top,#164f57,#163037 58%,#10131b)" },
};

const FALLBACKS: Record<ElementaryGrade, Challenge[]> = {
  [-1]: [{ id: "tk-count", prompt: "How many chicks? 🐥🐥🐥", answer: "3", choices: ["2", "3", "4"], clue: "Touch each chick once.", explanation: "There are three chicks.", subject: "Math", skillId: "math-counting", skillLabel: "Count small groups", review: false }],
  0: [{ id: "k-sound", prompt: "Which word begins like moon?", answer: "map", choices: ["map", "sun", "fish"], clue: "Listen for the /m/ sound.", explanation: "Moon and map both begin with /m/.", subject: "Reading", skillId: "reading-spelling-easy", skillLabel: "Beginning sounds", review: false }],
  1: [{ id: "g1-add", prompt: "8 + 5 = ?", answer: "13", choices: ["12", "13", "14"], clue: "Make ten, then add three.", explanation: "8 + 5 = 13.", subject: "Math", skillId: "math-addition", skillLabel: "Addition within 20", review: false }],
  2: [{ id: "g2-add", prompt: "27 + 18 = ?", answer: "45", choices: ["35", "45", "55"], clue: "Add ones, regroup, then add tens.", explanation: "27 + 18 = 45.", subject: "Math", skillId: "math-word-problems", skillLabel: "Add within 100", review: false }],
  3: [{ id: "g3-mult", prompt: "7 × 6 = ?", answer: "42", choices: ["36", "42", "48"], clue: "Add six seven times.", explanation: "7 × 6 = 42.", subject: "Math", skillId: "math-multiplication", skillLabel: "Multiply within 100", review: false }],
  4: [{ id: "g4-frac", prompt: "Which fraction equals 3/4?", answer: "6/8", choices: ["6/8", "4/8", "3/8"], clue: "Multiply top and bottom by two.", explanation: "3/4 and 6/8 are equivalent.", subject: "Math", skillId: "math-fractions", skillLabel: "Equivalent fractions", review: false }],
  5: [{ id: "g5-decimal", prompt: "Which is greater: 0.72 or 0.7?", answer: "0.72", choices: ["0.72", "0.7", "equal"], clue: "Write 0.7 as 0.70.", explanation: "0.72 is greater than 0.70.", subject: "Math", skillId: "math-decimals", skillLabel: "Compare decimals", review: false }],
};

const WORD_BANK: Record<string, string[]> = {
  Math: ["12", "24", "36", "42", "45", "60", "equal", "not enough information"],
  Reading: ["main idea", "supporting detail", "cause", "effect", "careful", "shy", "compare and contrast"],
  Science: ["water", "energy", "gravity", "moving water", "soft foam", "clear glass", "distance"],
  Logic: ["first", "next", "same", "different", "pattern"],
  "Learning Skills": ["try again", "use a clue", "check the evidence"],
  Memory: ["first", "middle", "last"],
  Creativity: ["shape", "sound", "color"],
};

function numericChoices(answer: string): string[] | null {
  const number = Number(answer.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(number) || !/[0-9]/.test(answer)) return null;
  const step = Math.abs(number) >= 20 ? 10 : 1;
  return [String(number - step), answer, String(number + step)];
}

function choicesFor(item: ReviewItem): string[] {
  const numeric = numericChoices(item.correctAnswer);
  if (numeric) return Array.from(new Set(numeric));
  const bank = WORD_BANK[item.subject] ?? WORD_BANK.Logic;
  return [item.correctAnswer, ...bank.filter((choice) => choice.toLowerCase() !== item.correctAnswer.toLowerCase()).slice(0, 2)];
}

function challengeFromReview(item: ReviewItem): Challenge {
  const label = typeof item.data?.skillLabel === "string" ? item.data.skillLabel : item.skillId.replaceAll("-", " ");
  const clue = typeof item.data?.hint === "string" ? item.data.hint : `Slow down and use what you know about ${label}.`;
  const explanation = typeof item.data?.explanation === "string" ? item.data.explanation : `The correct answer is ${item.correctAnswer}.`;
  return { id: item.id, prompt: item.prompt, answer: item.correctAnswer, choices: choicesFor(item), clue, explanation, subject: item.subject, skillId: item.skillId, skillLabel: label, review: true };
}

function tone(enabled: boolean, correct: boolean) {
  if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = correct ? 820 : 190;
  gain.gain.setValueAtTime(.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .18);
  oscillator.start(); oscillator.stop(context.currentTime + .19); oscillator.addEventListener("ended", () => void context.close());
}

export default function MasteryRescueLabPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [deck, setDeck] = useState<Challenge[]>([]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [rescued, setRescued] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    const nextGrade = readProfileGrade(activeProfile);
    const due = readLearningForProfile(activeProfile.id).reviewQueue.filter((item) => item.status === "due").slice(0, 3);
    const nextDeck = due.length
      ? due.flatMap((item) => [challengeFromReview(item), challengeFromReview(item)])
      : Array.from({ length: 4 }, (_, round) => ({ ...FALLBACKS[nextGrade][0], id: `${FALLBACKS[nextGrade][0].id}-${round}` }));
    setGrade(nextGrade);
    setDeck(nextDeck);
    setStage("intro");
  }, [activeProfile, hydrated]);

  const theme = grade === null ? null : THEMES[grade];
  const challenge = deck[index];
  const personalized = useMemo(() => deck.some((item) => item.review), [deck]);

  function choose(choice: string) {
    if (!challenge || feedback === "explanation") return;
    setSelected(choice);
    const correct = choice === challenge.answer;
    if (!correct && misses === 0) {
      recordLearningAttempt({ gameSlug: challenge.review ? challenge.id.split(":")[0] : GAME_SLUG, subject: challenge.subject, skillId: challenge.skillId, skillLabel: challenge.skillLabel, prompt: challenge.prompt, correctAnswer: challenge.answer, correct: false, review: challenge.review, data: { masteryRescue: true } }, activeProfile.id);
      setMisses(1); setFeedback("hint"); setCombo(0); setHearts((value) => Math.max(0, value - 1)); tone(soundOn, false); return;
    }
    if (!correct) { setMisses((value) => value + 1); setFeedback("explanation"); setCombo(0); tone(soundOn, false); return; }
    recordLearningAttempt({ gameSlug: challenge.review ? challenge.id.split(":")[0] : GAME_SLUG, subject: challenge.subject, skillId: challenge.skillId, skillLabel: challenge.skillLabel, prompt: challenge.prompt, correctAnswer: challenge.answer, correct: true, review: challenge.review, data: { masteryRescue: true, independent: misses === 0 } }, activeProfile.id);
    const nextCombo = misses === 0 ? combo + 1 : 0;
    setCombo(nextCombo); setBestCombo((value) => Math.max(value, nextCombo)); setRescued((value) => value + 1); setFeedback("explanation"); tone(soundOn, true);
  }

  function advance() {
    if (index === deck.length - 1) {
      completeGame({ xp: 24 + rescued * 4 + bestCombo * 2, coins: 6 + rescued, score: rescued * 140 + bestCombo * 30 + hearts * 20 });
      setStage("finish");
      return;
    }
    setIndex((value) => value + 1); setFeedback("question"); setSelected(null); setMisses(0);
  }

  function replay() {
    restartGame(); setStage("intro"); setIndex(0); setFeedback("question"); setSelected(null); setMisses(0); setRescued(0); setCombo(0); setBestCombo(0); setHearts(3);
  }

  if (!theme || !challenge || stage === "loading") return <GameFrame title="Mastery Rescue Lab"><main style={loading}>Preparing the rescue lab…</main></GameFrame>;

  if (stage === "intro") return <GameFrame title={theme.title}><style>{css}</style><main style={{ ...page, background: theme.background }}><section style={hero}><div className="lab-float" style={big}>{theme.emoji}</div><span style={{ ...eyebrow, color: theme.accent }}>PERSONALIZED RETRIEVAL ADVENTURE</span><h1 style={title}>{theme.title}</h1><p style={lead}>{personalized ? `${theme.helper} found ${Math.ceil(deck.length / 2)} skills from earlier misses. Rescue them by solving each one twice.` : `No rescue items are waiting, so ${theme.helper} built a fresh grade-matched practice run.`}</p><div style={stats}><strong>🧠 {deck.length} rematches</strong><strong>❤️ 3 hearts</strong><strong>🏆 Real mastery repair</strong></div><button onClick={() => setStage("play")} style={{ ...primary, background: theme.accent }}>Start the rescue →</button><button onClick={() => setSoundOn((value) => !value)} style={secondary}>{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button></section></main></GameFrame>;

  if (stage === "finish") return <GameFrame title={theme.title}><style>{css}</style><main style={{ ...page, background: theme.background }}><section style={hero}><div className="lab-pop" style={big}>🏆{theme.emoji}</div><span style={{ ...eyebrow, color: theme.accent }}>RESCUE COMPLETE</span><h1 style={title}>{activeProfile.name} rescued the {theme.rescued}!</h1><p style={lead}>{personalized ? "Successful rematches updated the real review queue. Skills cleared twice are now marked resolved." : "This practice run strengthened grade-level skills and added fresh mastery evidence."}</p><div style={stats}><strong>🧪 {rescued}/{deck.length} rescues</strong><strong>🔥 {bestCombo}× best combo</strong><strong>❤️ {hearts}</strong></div><button onClick={replay} style={{ ...primary, background: theme.accent }}>Run another rescue →</button></section></main></GameFrame>;

  const reveal = feedback === "explanation";
  return <GameFrame title={theme.title}><style>{css}</style><main style={{ ...page, background: theme.background }}><header style={hud}><strong>{theme.emoji} {theme.helper}</strong><div>❤️ {hearts} · 🧪 {rescued} · 🔥 {combo}× <button onClick={() => setSoundOn((value) => !value)} style={soundButton}>{soundOn ? "🔊" : "🔇"}</button></div></header><div style={track}><div style={{ ...fill, width: `${((index + (reveal ? 1 : 0)) / deck.length) * 100}%`, background: theme.accent }} /></div><section style={card}><div style={top}><span style={{ ...chip, background: theme.accent }}>{challenge.subject}</span><span>Rescue {index + 1}/{deck.length} · {challenge.review ? "From your review queue" : "Fresh practice"}</span></div><div className="lab-float" style={missionEmoji}>{index % 2 === 0 ? "🧫" : "🔬"}</div><h1 style={question}>{challenge.prompt}</h1><div style={choices}>{challenge.choices.map((choice) => { const right = choice === challenge.answer; const wrong = selected === choice && !right; return <button key={choice} data-correct={right ? "true" : "false"} disabled={reveal || wrong} onClick={() => choose(choice)} style={{ ...choiceButton, ...(reveal && right ? correctStyle : wrong ? wrongStyle : {}) }}>{choice}</button>; })}</div><section role="status" style={teaching}><strong style={{ color: theme.accent }}>{feedback === "question" ? "RESCUE SCAN" : feedback === "hint" ? "COACH CLUE" : "LAB REPORT"}</strong><p>{feedback === "question" ? "Choose the best answer. A miss unlocks coaching, not a dead end." : feedback === "hint" ? challenge.clue : selected === challenge.answer ? challenge.explanation : `Correct answer: ${challenge.answer}. ${challenge.explanation}`}</p>{feedback === "hint" ? <span>Try again. The rescue is still active.</span> : reveal ? <button onClick={advance} style={{ ...primary, background: theme.accent }}>{index === deck.length - 1 ? "Complete the rescue →" : "Next rematch →"}</button> : null}</section></section></main></GameFrame>;
}

const css = `@keyframes labFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-8px) rotate(1deg)}}@keyframes labPop{0%{transform:scale(.7);opacity:0}80%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}.lab-float{animation:labFloat 2s ease-in-out infinite}.lab-pop{animation:labPop .48s ease-out both}@media(prefers-reduced-motion:reduce){.lab-float,.lab-pop{animation:none}}`;
const loading: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#10131b", color: "#fff", fontSize: 24, fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 82px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,62px)", borderRadius: 34, textAlign: "center", background: "rgba(18,24,36,.92)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 28px 80px rgba(0,0,0,.32)" };
const big: React.CSSProperties = { fontSize: "clamp(5rem,17vw,9rem)" }; const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" }; const title: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.8rem,8vw,5.6rem)", lineHeight: .9, letterSpacing: "-.06em" }; const lead: React.CSSProperties = { maxWidth: 720, margin: "13px auto 22px", color: "#c6ceda", lineHeight: 1.6, fontWeight: 700 };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 13, flexWrap: "wrap", margin: "20px 0" }; const primary: React.CSSProperties = { margin: 6, minHeight: 58, padding: "14px 22px", borderRadius: 999, border: 0, color: "#10131b", fontWeight: 950, cursor: "pointer" }; const secondary: React.CSSProperties = { ...primary, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const hud: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto 11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 14, borderRadius: 22, background: "rgba(16,19,27,.92)", border: "1px solid rgba(255,255,255,.12)", fontWeight: 850 }; const soundButton: React.CSSProperties = { border: 0, background: "transparent", fontSize: 19, cursor: "pointer" }; const track: React.CSSProperties = { width: "min(920px,100%)", height: 12, margin: "0 auto 12px", borderRadius: 999, background: "rgba(16,19,27,.78)", overflow: "hidden" }; const fill: React.CSSProperties = { height: "100%", borderRadius: 999, transition: "width .35s ease" };
const card: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto", padding: "clamp(22px,5vw,44px)", borderRadius: 30, background: "rgba(18,24,36,.94)", border: "1px solid rgba(255,255,255,.14)", textAlign: "center" }; const top: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#aab1bf", fontSize: 12, fontWeight: 850 }; const chip: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, color: "#10131b", fontSize: 11, fontWeight: 950 }; const missionEmoji: React.CSSProperties = { margin: "20px auto 8px", fontSize: "clamp(4rem,12vw,7rem)" }; const question: React.CSSProperties = { maxWidth: 800, margin: "10px auto 22px", fontSize: "clamp(1.8rem,5.5vw,3.5rem)", lineHeight: 1.04, letterSpacing: "-.04em" };
const choices: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 11 }; const choiceButton: React.CSSProperties = { minHeight: 76, padding: 14, borderRadius: 20, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", fontSize: "clamp(1.05rem,3vw,1.35rem)", fontWeight: 900, cursor: "pointer" }; const correctStyle: React.CSSProperties = { background: "#d9ff5b", color: "#10131b", borderColor: "#d9ff5b" }; const wrongStyle: React.CSSProperties = { background: "#ffb5bf", color: "#10131b", borderColor: "#ffb5bf" }; const teaching: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 20, background: "#10131b", border: "1px solid rgba(255,255,255,.09)" };
