"use client";

import GameFrame from "@/components/GameFrame";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { DIGITAL_SCENARIOS, DIGITAL_SKILLS, digitalScenarioById, type DigitalLevel, type DigitalScenario, type DigitalSkill } from "@/lib/adrian-digital-bank";
import { addDigitalToolCards, readDigitalToolkit, type DigitalToolCard } from "@/lib/adrian-digital-toolkit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: DigitalLevel[] = ["Safe Starter", "Smart Sharer", "Digital Detective"];
const SKILLS = Object.entries(DIGITAL_SKILLS) as Array<[DigitalSkill, (typeof DIGITAL_SKILLS)[DigitalSkill]]>;

function adaptiveLevel(profileId: string, age: number): DigitalLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(DIGITAL_SKILLS).map((skill) => learning.skills[skill.id]).filter(Boolean);
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length ? evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length : 0;
  if (age <= 5) return "Safe Starter";
  if (age <= 7) return mastery >= 68 && attempts >= 12 ? "Digital Detective" : "Smart Sharer";
  return mastery >= 45 || attempts >= 8 ? "Digital Detective" : "Smart Sharer";
}

function focusFromSkillId(value: string | null): DigitalSkill | null {
  return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null;
}

export default function DigitalCitizenshipLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggested = adaptiveLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<DigitalLevel>(suggested);
  const [focus, setFocus] = useState<DigitalSkill | null>(null);
  const [session, setSession] = useState<DigitalScenario[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose a digital-safety level.");
  const [toolkit, setToolkit] = useState(() => readDigitalToolkit(profileId));
  const [newCards, setNewCards] = useState<DigitalToolCard[]>([]);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "digital-citizenship-lab");
  const current = session[index] ?? null;
  const bestScore = progress.games["digital-citizenship-lab"]?.bestScore ?? 0;
  const knownCards = useMemo(() => new Set(toolkit.cards.map((card) => card.id)), [toolkit]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    if (LEVELS.includes(requestedLevel as DigitalLevel)) setLevel(requestedLevel as DigitalLevel);
    setFocus(focusFromSkillId(params.get("focus")));
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
    return () => window.speechSynthesis?.cancel();
  }, []);

  function reviewItems(): DigitalScenario[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "digital-citizenship-lab")
      .map((item) => {
        const id = typeof item.data?.scenarioId === "string" ? item.data.scenarioId : "";
        if (!id || seen.has(id)) return null;
        const scenario = digitalScenarioById(id);
        if (!scenario) return null;
        seen.add(id);
        return scenario;
      })
      .filter((item): item is DigitalScenario => Boolean(item))
      .slice(0, 6);
  }

  function normalItems(): DigitalScenario[] {
    const focused = DIGITAL_SCENARIOS.filter((item) => item.level === level && (!focus || item.skill === focus));
    const fallback = DIGITAL_SCENARIOS.filter((item) => item.level === level);
    const pool = focused.length ? focused : fallback;
    return pickFreshItems(pool, Math.min(5, pool.length), `adrianos-content:digital:${profileId}:${level}:${focus ?? "mixed"}`, (item) => item.id);
  }

  function startGame(useReview = false) {
    const reviews = reviewItems();
    const next = useReview && reviews.length ? reviews : normalItems();
    if (!next.length) return;
    setSession(next);
    setIndex(0);
    setSelected("");
    setScore(0);
    setPlaying(true);
    setFinished(false);
    setLocked(false);
    setReviewMode(useReview && reviews.length > 0);
    setRecordedMiss(false);
    setMessage("Read the situation. Choose the safest, kindest, most evidence-based response.");
    setNewCards([]);
    setSolvedIds([]);
    recordPlay("digital-citizenship-lab");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = DIGITAL_SKILLS[current.skill];
    recordLearningAttempt({
      gameSlug: "digital-citizenship-lab",
      subject: "Digital Citizenship",
      skillId: skill.id,
      skillLabel: skill.label,
      prompt: `${current.title}: ${current.prompt}`,
      correctAnswer: current.answer,
      correct,
      review: reviewMode,
      data: { scenarioId: current.id, level: current.level, toolId: current.toolId },
    }, profileId);
  }

  function checkAnswer() {
    if (!current || !selected || locked) return;
    if (selected !== current.answer) {
      if (!recordedMiss) {
        saveAttempt(false);
        setRecordedMiss(true);
      }
      setSelected("");
      setMessage(`Safety clue: ${current.hint}`);
      return;
    }
    saveAttempt(true);
    setLocked(true);
    setSolvedIds((ids) => ids.includes(current.toolId) ? ids : [...ids, current.toolId]);
    setScore((value) => value + (recordedMiss ? 6 : 10));
    setMessage(`Strong choice. ${current.explanation}`);
  }

  function speakCurrent() {
    if (!current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${current.title}. ${current.situation}. ${current.prompt}`);
    utterance.rate = profile.age <= 5 ? 0.82 : 0.94;
    utterance.onstart = () => setVoicePlaying(true);
    utterance.onend = () => setVoicePlaying(false);
    utterance.onerror = () => setVoicePlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setVoicePlaying(false);
  }

  function finishMission() {
    stopSpeaking();
    if (!reviewMode) {
      const solved = new Set(solvedIds);
      const cards = session.filter((item) => solved.has(item.toolId)).map((item) => ({ id: item.toolId, label: item.toolLabel, emoji: item.emoji }));
      const unique = [...new Map(cards.map((card) => [card.id, card])).values()].slice(0, 3);
      const result = addDigitalToolCards(profileId, unique);
      setToolkit(result.toolkit);
      setNewCards(result.added);
    }
    award("digital-citizenship-lab", { xp: (reviewMode ? 18 : 32) + score, coins: reviewMode ? 3 : Math.max(7, Math.floor(score / 6)), score, completed: !reviewMode });
    setPlaying(false);
    setFinished(true);
  }

  function advance() {
    if (!locked) return;
    if (index >= session.length - 1) return finishMission();
    stopSpeaking();
    setIndex((value) => value + 1);
    setSelected("");
    setLocked(false);
    setRecordedMiss(false);
    setMessage("New digital situation. Pause before you tap.");
  }

  if (!playing && !finished) {
    return <GameFrame title="Digital Citizenship Lab"><section style={panel}>
      <div style={{ fontSize: 76 }}>🛡️</div>
      <span style={eyebrow}>15 REAL-WORLD DIGITAL SITUATIONS</span>
      <h1 style={hero}>Use technology without letting it use you.</h1>
      <p style={muted}>Practice privacy, account safety, online kindness, media and AI literacy, and healthy stopping points.</p>
      <div style={recommendation}><small>ADAPTIVE RECOMMENDATION</small><strong>{suggested}</strong></div>
      <div style={row}>{LEVELS.map((item) => <button key={item} onClick={() => setLevel(item)} style={pill(level === item)} type="button">{item}{item === suggested ? " · Suggested" : ""}</button>)}</div>
      {focus && <p style={focusStyle}>Focus: <strong>{DIGITAL_SKILLS[focus].label}</strong> <button type="button" onClick={() => setFocus(null)} style={clear}>Use mixed situations</button></p>}
      <div style={actions}><button type="button" onClick={() => startGame(false)} style={primary}>Start digital mission</button>{dueReviews.length > 0 && <button type="button" onClick={() => startGame(true)} style={review}>Review {dueReviews.length} due</button>}</div>
      <div style={summary}><span>🧰 {toolkit.cards.length} tools</span><span>🛡️ {toolkit.missions} missions</span><span>🏆 Best {bestScore}</span></div>
    </section></GameFrame>;
  }

  if (finished) {
    return <GameFrame title="Digital Citizenship Lab"><section style={panel}>
      <div style={{ fontSize: 76 }}>{reviewMode ? "🧠" : "🧰"}</div>
      <span style={eyebrow}>{reviewMode ? "DIGITAL REVIEW COMPLETE" : "MISSION COMPLETE"}</span>
      <h1 style={hero}>{score} points</h1>
      <p style={muted}>You practiced choices that protect privacy, attention, accounts, evidence, and people.</p>
      {newCards.length > 0 && <div style={cardGrid}>{newCards.map((card) => <div key={card.id} style={toolCard}><span style={{ fontSize: 34 }}>{card.emoji}</span><strong>{card.label}</strong><small>NEW TOOL</small></div>)}</div>}
      <div style={actions}><button type="button" onClick={() => startGame(reviewMode)} style={primary}>Practice another mission</button><Link href="/school" style={secondary}>Return to School</Link></div>
    </section></GameFrame>;
  }

  if (!current) return null;
  const skill = DIGITAL_SKILLS[current.skill];
  return <GameFrame title="Digital Citizenship Lab"><div style={shell}>
    <div style={stats}><span>{reviewMode ? "Spaced review" : `Situation ${index + 1} of ${session.length}`}</span><span>{current.level}</span><span>Score {score}</span></div>
    <section style={caseCard}>
      <div style={caseHeader}><div><span style={eyebrow}>{skill.label.toUpperCase()}</span><h2 style={title}>{current.emoji} {current.title}</h2></div><div style={tag}>{knownCards.has(current.toolId) ? "TOOL EARNED" : "TOOL AVAILABLE"}<br/><strong>{current.toolLabel}</strong></div></div>
      <div style={situation}><small>DIGITAL SITUATION</small><p>{current.situation}</p></div>
      <button type="button" onClick={voicePlaying ? stopSpeaking : speakCurrent} style={listen}>{voicePlaying ? "Stop reading" : "🔊 Read aloud"}</button>
      <h1 style={question}>{current.prompt}</h1>
      <div style={answerGrid}>{current.options.map((option) => <button key={option} type="button" disabled={locked} onClick={() => !locked && setSelected(option)} style={answer(selected === option, locked && option === current.answer)}>{option}</button>)}</div>
      <p style={{ ...messageStyle, color: locked ? "#d9ff5b" : recordedMiss ? "#ffcf83" : "#aab1bf" }}>{message}</p>
      <div style={actions}>{!locked ? <button type="button" onClick={checkAnswer} disabled={!selected} style={{ ...primary, opacity: selected ? 1 : .45 }}>Check the choice</button> : <button type="button" onClick={advance} style={primary}>{index === session.length - 1 ? "Finish mission" : "Next situation →"}</button>}</div>
    </section>
  </div></GameFrame>;
}

const panel: React.CSSProperties = { width:"min(900px,100%)", margin:"0 auto", padding:"clamp(26px,5vw,54px)", borderRadius:32, background:"#181d28", border:"1px solid rgba(255,255,255,.11)", textAlign:"center" };
const shell: React.CSSProperties = { width:"min(980px,100%)", margin:"0 auto" };
const eyebrow: React.CSSProperties = { color:"#78f0d2", fontSize:11, fontWeight:950, letterSpacing:".16em" };
const hero: React.CSSProperties = { margin:"12px 0", fontSize:"clamp(2.8rem,7vw,5.6rem)", lineHeight:.92, letterSpacing:"-.065em" };
const muted: React.CSSProperties = { color:"#aab1bf", lineHeight:1.6 };
const recommendation: React.CSSProperties = { maxWidth:560, margin:"20px auto", padding:16, display:"grid", gap:4, borderRadius:19, background:"rgba(120,240,210,.08)", border:"1px solid rgba(120,240,210,.24)" };
const row: React.CSSProperties = { display:"flex", justifyContent:"center", flexWrap:"wrap", gap:8 };
const pill = (active:boolean):React.CSSProperties => ({ padding:"11px 15px", borderRadius:999, border:`1px solid ${active ? "#78f0d2" : "rgba(255,255,255,.14)"}`, background:active ? "rgba(120,240,210,.12)" : "#222936", color:active ? "#78f0d2" : "#fff", fontWeight:900, cursor:"pointer" });
const focusStyle: React.CSSProperties = { margin:"18px auto 0", padding:12, maxWidth:600, borderRadius:16, background:"rgba(127,220,255,.08)" };
const clear: React.CSSProperties = { marginLeft:8, padding:"6px 10px", borderRadius:999, border:"1px solid rgba(255,255,255,.18)", background:"transparent", color:"#fff", cursor:"pointer" };
const actions: React.CSSProperties = { display:"flex", justifyContent:"center", gap:10, flexWrap:"wrap", marginTop:22 };
const primary: React.CSSProperties = { minHeight:48, padding:"13px 20px", borderRadius:999, border:0, background:"#78f0d2", color:"#10131b", fontWeight:950, fontSize:16, cursor:"pointer" };
const review: React.CSSProperties = { ...primary, background:"#c6b8ff" };
const secondary: React.CSSProperties = { minHeight:48, padding:"13px 19px", borderRadius:999, border:"1px solid rgba(127,220,255,.35)", color:"#7fdcff", textDecoration:"none", display:"inline-grid", placeItems:"center", fontWeight:950 };
const summary: React.CSSProperties = { display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap", marginTop:20, color:"#aab1bf", fontSize:13, fontWeight:850 };
const stats: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap", marginBottom:10, padding:"10px 14px", borderRadius:17, background:"#181d28", color:"#aab1bf", fontSize:12, fontWeight:850 };
const caseCard: React.CSSProperties = { padding:"clamp(22px,4vw,42px)", borderRadius:30, background:"#181d28", border:"1px solid rgba(120,240,210,.18)", textAlign:"center" };
const caseHeader: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:14, alignItems:"flex-start", textAlign:"left", flexWrap:"wrap", marginBottom:18 };
const title: React.CSSProperties = { margin:"6px 0 0", fontSize:"clamp(1.7rem,4vw,2.8rem)", lineHeight:1 };
const tag: React.CSSProperties = { padding:"10px 13px", borderRadius:16, background:"rgba(198,184,255,.1)", border:"1px solid rgba(198,184,255,.24)", color:"#dcd5ff", fontSize:10, textAlign:"right" };
const situation: React.CSSProperties = { padding:"clamp(18px,4vw,28px)", borderRadius:22, background:"#edf8f5", color:"#1e2926", fontSize:"clamp(1.15rem,2.6vw,1.5rem)", lineHeight:1.65, textAlign:"left" };
const listen: React.CSSProperties = { margin:"13px 0 20px", padding:"9px 13px", borderRadius:999, border:"1px solid rgba(127,220,255,.28)", background:"rgba(127,220,255,.08)", color:"#7fdcff", fontWeight:900, cursor:"pointer" };
const question: React.CSSProperties = { margin:"10px 0 20px", fontSize:"clamp(2rem,5vw,3.7rem)", lineHeight:1, letterSpacing:"-.05em" };
const answerGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:11 };
const answer = (selected:boolean, correct:boolean):React.CSSProperties => ({ minHeight:92, padding:16, borderRadius:22, border:`2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background:correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color:"#fff", fontSize:16, fontWeight:900, cursor:"pointer" });
const messageStyle: React.CSSProperties = { minHeight:26, margin:"18px 0 0", lineHeight:1.5, fontWeight:850 };
const cardGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10, marginTop:20 };
const toolCard: React.CSSProperties = { display:"grid", gap:6, padding:17, borderRadius:20, background:"rgba(120,240,210,.08)", border:"1px solid rgba(120,240,210,.24)" };
