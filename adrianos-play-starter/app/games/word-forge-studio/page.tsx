"use client";

import GameFrame from "@/components/GameFrame";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useGameSession } from "@/lib/game-session";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useEffect, useMemo, useState } from "react";

const GAME_SLUG = "word-forge-studio";
type WordCard = { word: string; clue: string; chunk: string; standard: string };
type Pack = { title: string; emoji: string; accent: string; intro: string; cards: WordCard[] };

const PACKS: Record<ElementaryGrade, Pack> = {
  [-1]: { title: "Sound Spark Shop", emoji: "✨🔤", accent: "#ffd45c", intro: "Match first sounds and build tiny words.", cards: [
    { word: "sun", clue: "It shines in the sky.", chunk: "s", standard: "TK.ELA.2" }, { word: "map", clue: "It helps you find places.", chunk: "m", standard: "TK.ELA.2" }, { word: "bug", clue: "A tiny crawling creature.", chunk: "b", standard: "TK.ELA.2" }, { word: "cat", clue: "A pet that meows.", chunk: "c", standard: "TK.ELA.2" }, { word: "log", clue: "A piece of a tree.", chunk: "l", standard: "TK.ELA.2" },
  ]},
  0: { title: "Rainbow Word Workshop", emoji: "🌈🔤", accent: "#ff9bd2", intro: "Build simple CVC words and listen for every sound.", cards: [
    { word: "ship", clue: "A boat on the water.", chunk: "sh", standard: "RF.K.3" }, { word: "fish", clue: "It swims underwater.", chunk: "sh", standard: "RF.K.3" }, { word: "moon", clue: "It glows at night.", chunk: "oo", standard: "RF.K.3" }, { word: "rain", clue: "Water falling from clouds.", chunk: "ai", standard: "RF.K.3" }, { word: "star", clue: "A bright light in space.", chunk: "ar", standard: "RF.K.3" },
  ]},
  1: { title: "Robot Word Factory", emoji: "🤖⚙️", accent: "#9cff88", intro: "Forge long-vowel and digraph words for the robot city.", cards: [
    { word: "train", clue: "It travels on tracks.", chunk: "ai", standard: "RF.1.3" }, { word: "shape", clue: "A circle or square is one.", chunk: "a_e", standard: "RF.1.3" }, { word: "bright", clue: "Full of light.", chunk: "igh", standard: "RF.1.3" }, { word: "cheese", clue: "A food made from milk.", chunk: "ee", standard: "RF.1.3" }, { word: "storm", clue: "Strong wind and rain.", chunk: "or", standard: "RF.1.3" },
  ]},
  2: { title: "Dino Word Forge", emoji: "🦖⚒️", accent: "#d9ff5b", intro: "Crack syllables, vowel teams, and tricky Grade 2 patterns.", cards: [
    { word: "sunset", clue: "When the sun goes down.", chunk: "sun + set", standard: "RF.2.3" }, { word: "playground", clue: "A place with swings and slides.", chunk: "play + ground", standard: "RF.2.3" }, { word: "careful", clue: "Taking time to avoid mistakes.", chunk: "care + ful", standard: "L.2.4" }, { word: "ancient", clue: "Very old.", chunk: "an + cient", standard: "L.2.4" }, { word: "footprint", clue: "A mark left by a foot.", chunk: "foot + print", standard: "RF.2.3" },
  ]},
  3: { title: "Orbit Word Lab", emoji: "🛰️🧪", accent: "#8dd7ff", intro: "Use roots, prefixes, and multisyllable chunks.", cards: [
    { word: "preview", clue: "To look at something before it is finished.", chunk: "pre + view", standard: "L.3.4" }, { word: "careless", clue: "Not paying enough attention.", chunk: "care + less", standard: "L.3.4" }, { word: "disagree", clue: "To have a different opinion.", chunk: "dis + agree", standard: "L.3.4" }, { word: "sunlight", clue: "Light that comes from the sun.", chunk: "sun + light", standard: "RF.3.3" }, { word: "reporter", clue: "A person who gathers and shares news.", chunk: "report + er", standard: "L.3.4" },
  ]},
  4: { title: "Temple Lexicon Forge", emoji: "🗿📜", accent: "#ffcb66", intro: "Decode Greek and Latin roots to restore ancient words.", cards: [
    { word: "transport", clue: "To carry from one place to another.", chunk: "trans + port", standard: "L.4.4" }, { word: "telescope", clue: "A tool for seeing faraway objects.", chunk: "tele + scope", standard: "L.4.4" }, { word: "biography", clue: "The story of a person's life.", chunk: "bio + graphy", standard: "L.4.4" }, { word: "predict", clue: "To say what may happen before it does.", chunk: "pre + dict", standard: "L.4.4" }, { word: "visible", clue: "Able to be seen.", chunk: "vis + ible", standard: "L.4.4" },
  ]},
  5: { title: "Cyber Lexicon Core", emoji: "🌐💠", accent: "#77f1d0", intro: "Engineer precise academic words from roots and affixes.", cards: [
    { word: "contradict", clue: "To state the opposite of a claim.", chunk: "contra + dict", standard: "L.5.4" }, { word: "microscope", clue: "A tool for seeing very small things.", chunk: "micro + scope", standard: "L.5.4" }, { word: "independent", clue: "Able to act without needing help.", chunk: "in + depend + ent", standard: "L.5.4" }, { word: "unverified", clue: "Not yet checked and confirmed.", chunk: "un + verify + ed", standard: "L.5.4" }, { word: "conclusion", clue: "A final judgment based on evidence.", chunk: "con + clus + ion", standard: "L.5.4" },
  ]},
};

function shuffledLetters(word: string, seed: number) {
  const chars = word.split("");
  return chars.map((letter, index) => ({ letter, sort: (index * 17 + seed * 11) % 23 })).sort((a, b) => a.sort - b.sort).map((item) => item.letter);
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .82;
  window.speechSynthesis.speak(utterance);
}

export default function WordForgeStudio() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);
  const [built, setBuilt] = useState("");
  const [solved, setSolved] = useState(false);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [sparks, setSparks] = useState(0);
  const [message, setMessage] = useState("Tap letters to forge the word.");

  useEffect(() => { if (hydrated) setGrade(readProfileGrade(activeProfile)); }, [activeProfile, hydrated]);
  const pack = grade === null ? null : PACKS[grade];
  const card = pack?.cards[round] ?? null;
  const letters = useMemo(() => card ? shuffledLetters(card.word, round + misses) : [], [card, misses, round]);

  function resetRound() { setBuilt(""); setSolved(false); setMisses(0); setMessage("Tap letters to forge the word."); }
  function tap(letter: string) { if (!card || solved || built.length >= card.word.length) return; setBuilt((value) => value + letter); }
  function undo() { if (!solved) setBuilt((value) => value.slice(0, -1)); }

  function check() {
    if (!card || !pack || solved) return;
    const correct = built.toLowerCase() === card.word;
    recordLearningAttempt({ gameSlug: GAME_SLUG, subject: "Reading", skillId: `spelling-grade-${grade}`, skillLabel: "Word construction and morphology", prompt: `${card.clue} Build the word.`, correctAnswer: card.word, correct, data: { grade: grade ?? 0, standardCode: card.standard, chunk: card.chunk, supportUsed: misses > 0 } }, activeProfile.id);
    if (!correct) {
      const next = misses + 1; setMisses(next); setCombo(0); setBuilt(""); setSolved(false);
      setMessage(next === 1 ? `Coach clue: build it from ${card.chunk}.` : `Sound map: ${card.word.split("").join(" · ")}`);
      speak(card.word);
      return;
    }
    const nextCombo = combo + 1; setCombo(nextCombo); setBestCombo((value) => Math.max(value, nextCombo));
    setSparks((value) => value + (misses === 0 ? 3 : 1));
    setSolved(true);
    setMessage(misses === 0 ? "Perfect forge! +3 sparks." : "Word repaired! +1 spark.");
    speak(`${card.word}. ${card.clue}`);
  }

  function advance() {
    if (!pack || !solved) return;
    if (round >= pack.cards.length - 1) {
      completeGame({ xp: 35 + sparks * 3 + bestCombo * 2, coins: 8 + sparks, score: sparks * 120 + bestCombo * 40 });
      setFinished(true); return;
    }
    setRound((value) => value + 1); resetRound();
  }

  function replay() { restartGame(); setStarted(true); setFinished(false); setRound(0); setCombo(0); setBestCombo(0); setSparks(0); resetRound(); }

  if (!pack || !card) return <GameFrame title="Word Forge Studio"><main style={loading}>Heating the word forge…</main></GameFrame>;
  if (!started) return <GameFrame title={pack.title}><main style={{ ...page, background: `radial-gradient(circle at top,${pack.accent}30,#11151d 55%)` }}><section style={hero}><div style={big}>{pack.emoji}</div><span style={{ ...eyebrow, color: pack.accent }}>{card.standard} · GRADE-SPECIFIC SPELLING</span><h1 style={title}>{pack.title}</h1><p style={lead}>{pack.intro}</p><div style={stats}><strong>🔤 5 words</strong><strong>🔥 combo rewards</strong><strong>🔊 hear every word</strong></div><button onClick={() => setStarted(true)} style={{ ...primary, background: pack.accent }}>Start forging →</button></section></main></GameFrame>;
  if (finished) return <GameFrame title={pack.title}><main style={{ ...page, background: `radial-gradient(circle at top,${pack.accent}30,#11151d 55%)` }}><section style={hero}><div style={big}>🏆{pack.emoji}</div><span style={{ ...eyebrow, color: pack.accent }}>WORD FORGE COMPLETE</span><h1 style={title}>{activeProfile.name} forged the full deck!</h1><p style={lead}>Every word was built, heard, and connected to a useful pattern.</p><div style={stats}><strong>✨ {sparks} sparks</strong><strong>🔥 {bestCombo}× best combo</strong><strong>🔤 5 words</strong></div><button onClick={replay} style={{ ...primary, background: pack.accent }}>Forge a new deck →</button></section></main></GameFrame>;

  return <GameFrame title={pack.title}><main style={{ ...page, background: `radial-gradient(circle at top,${pack.accent}25,#11151d 55%)` }}><header style={hud}><strong>{pack.emoji} Word {round + 1}/5</strong><span>✨ {sparks} · 🔥 {combo}×</span></header><div style={track}><div style={{ ...fill, width: `${((round + (solved ? 1 : 0)) / 5) * 100}%`, background: pack.accent }} /></div><section style={cardStyle}><span style={{ ...eyebrow, color: pack.accent }}>{card.standard}</span><h1 style={clue}>{card.clue}</h1><button onClick={() => speak(card.word)} style={listen}>🔊 Hear the word</button><div aria-label="built word" style={slots}>{card.word.split("").map((_, index) => <span key={index} style={{ ...slot, borderColor: index < built.length ? pack.accent : "rgba(255,255,255,.2)" }}>{built[index] ?? ""}</span>)}</div><div style={letterGrid}>{letters.map((letter, index) => <button key={`${letter}-${index}`} onClick={() => tap(letter)} disabled={solved} style={letterButton}>{letter}</button>)}</div><div style={actions}><button onClick={undo} disabled={solved || built.length === 0} style={secondary}>Undo</button><button onClick={check} disabled={built.length !== card.word.length || solved} style={{ ...primary, background: pack.accent }}>Check word</button></div><div role="status" style={teaching}><strong>{misses === 0 ? "FORGE COACH" : "ADAPTIVE COACH"}</strong><p>{message}</p>{solved && <button onClick={advance} style={{ ...primary, background: pack.accent }}>{round === 4 ? "Open the word vault →" : "Next word →"}</button>}</div></section></main></GameFrame>;
}

const loading: React.CSSProperties = { minHeight: 500, display: "grid", placeItems: "center", background: "#11151d", color: "#fff", fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 80px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "rgba(18,24,36,.94)", border: "1px solid rgba(255,255,255,.14)" };
const big: React.CSSProperties = { fontSize: "clamp(5rem,16vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(3rem,8vw,6rem)", lineHeight: .9, letterSpacing: "-.06em" };
const lead: React.CSSProperties = { maxWidth: 680, margin: "12px auto 22px", color: "#c4ccd8", lineHeight: 1.6, fontWeight: 700 };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", margin: "20px 0" };
const primary: React.CSSProperties = { minHeight: 58, padding: "14px 22px", border: 0, borderRadius: 999, color: "#11151d", fontWeight: 950, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const hud: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto 10px", display: "flex", justifyContent: "space-between", padding: 14, borderRadius: 20, background: "rgba(18,24,36,.94)", fontWeight: 900 };
const track: React.CSSProperties = { width: "min(900px,100%)", height: 12, margin: "0 auto 12px", borderRadius: 999, background: "#222936", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", transition: "width .3s ease" };
const cardStyle: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(22px,5vw,42px)", borderRadius: 30, background: "rgba(18,24,36,.96)", textAlign: "center", border: "1px solid rgba(255,255,255,.14)" };
const clue: React.CSSProperties = { margin: "10px auto 14px", fontSize: "clamp(1.8rem,5vw,3.3rem)", lineHeight: 1.05 };
const listen: React.CSSProperties = { minHeight: 46, padding: "10px 16px", borderRadius: 999, background: "#222936", border: "1px solid rgba(255,255,255,.14)", color: "#fff", fontWeight: 900 };
const slots: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 7, margin: "24px 0" };
const slot: React.CSSProperties = { width: 48, height: 58, display: "grid", placeItems: "center", borderBottom: "4px solid", fontSize: 30, fontWeight: 950, textTransform: "uppercase" };
const letterGrid: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 9 };
const letterButton: React.CSSProperties = { minWidth: 58, minHeight: 64, borderRadius: 18, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", fontSize: 25, fontWeight: 950, textTransform: "uppercase", cursor: "pointer" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 20 };
const teaching: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 20, background: "#10131b", color: "#c4ccd8" };
