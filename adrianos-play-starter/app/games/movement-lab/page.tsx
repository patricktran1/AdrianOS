"use client";

import GameFrame from "@/components/GameFrame";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import {
  MOVEMENT_MISSIONS,
  MOVEMENT_SKILLS,
  movementMissionById,
  type MovementLevel,
  type MovementMission,
  type MovementSkill,
} from "@/lib/adrian-movement-bank";
import {
  addMovementTools,
  readMovementToolkit,
  type MovementToolCard,
} from "@/lib/adrian-movement-toolkit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: MovementLevel[] = ["Mover", "Coordinator", "Movement Strategist"];
const SKILLS = Object.entries(MOVEMENT_SKILLS) as Array<[MovementSkill, (typeof MOVEMENT_SKILLS)[MovementSkill]]>;

type Stage = "brief" | "move" | "reflect";

function recommendedLevel(profileId: string, age: number): MovementLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(MOVEMENT_SKILLS).map((skill) => learning.skills[skill.id]).filter(Boolean);
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length ? evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length : 0;
  if (age <= 5) return "Mover";
  if (age <= 7) return mastery >= 72 && attempts >= 15 ? "Movement Strategist" : "Coordinator";
  return mastery >= 50 || attempts >= 8 ? "Movement Strategist" : "Coordinator";
}

function levelBlurb(level: MovementLevel): string {
  if (level === "Mover") return "Simple balance, cross-body movement, comfortable mobility, and safe space awareness.";
  if (level === "Coordinator") return "Movement patterns, direction changes, controlled strength, and body-position challenges.";
  return "Balance variables, combined patterns, movement planning, and adaptable mini-circuits.";
}

function focusFromParam(value: string | null): MovementSkill | null {
  if (!value) return null;
  return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null;
}

export default function MovementLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggested = recommendedLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<MovementLevel>(suggested);
  const [focus, setFocus] = useState<MovementSkill | null>(null);
  const [session, setSession] = useState<MovementMission[]>([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("brief");
  const [remaining, setRemaining] = useState(0);
  const [reflection, setReflection] = useState("");
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose a movement level.");
  const [toolkit, setToolkit] = useState(() => readMovementToolkit(profileId));
  const [newTools, setNewTools] = useState<MovementToolCard[]>([]);
  const [solvedToolIds, setSolvedToolIds] = useState<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "movement-lab");
  const current = session[index] ?? null;
  const bestScore = progress.games["movement-lab"]?.bestScore ?? 0;
  const knownToolIds = useMemo(() => new Set(toolkit.cards.map((card) => card.id)), [toolkit]);
  const totalSeconds = session.reduce((sum, mission) => sum + mission.seconds, 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    if (LEVELS.includes(requestedLevel as MovementLevel)) setLevel(requestedLevel as MovementLevel);
    setFocus(focusFromParam(params.get("focus")));
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (stage !== "move" || remaining <= 0) return;
    timerRef.current = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setStage("reflect");
          setMessage("Movement complete. Notice what your body learned before answering.");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [stage]);

  function reviewItems(): MovementMission[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "movement-lab")
      .map((item) => {
        const id = typeof item.data?.missionId === "string" ? item.data.missionId : "";
        if (!id || seen.has(id)) return null;
        const mission = movementMissionById(id);
        if (!mission) return null;
        seen.add(id);
        return mission;
      })
      .filter((mission): mission is MovementMission => Boolean(mission))
      .slice(0, 6);
  }

  function normalItems(): MovementMission[] {
    const focused = MOVEMENT_MISSIONS.filter((mission) => mission.level === level && (!focus || mission.skill === focus));
    const pool = focused.length ? focused : MOVEMENT_MISSIONS.filter((mission) => mission.level === level);
    return pickFreshItems(pool, Math.min(5, pool.length), `adrianos-content:movement:${profileId}:${level}:${focus ?? "mixed"}`, (mission) => mission.id);
  }

  function startGame(useReview = false) {
    const reviews = reviewItems();
    const next = useReview && reviews.length ? reviews : normalItems();
    if (!next.length) return;
    setSession(next);
    setIndex(0);
    setStage("brief");
    setRemaining(0);
    setReflection("");
    setSelected("");
    setScore(0);
    setPlaying(true);
    setFinished(false);
    setLocked(false);
    setReviewMode(useReview && reviews.length > 0);
    setRecordedMiss(false);
    setMessage("Clear the space, read the safety note, then begin.");
    setNewTools([]);
    setSolvedToolIds([]);
    recordPlay("movement-lab");
  }

  function beginMovement() {
    if (!current) return;
    setRemaining(current.seconds);
    setStage("move");
    setMessage("Move with control. Stop for pain, dizziness, or trouble breathing.");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = MOVEMENT_SKILLS[current.skill];
    recordLearningAttempt({
      gameSlug: "movement-lab",
      subject: "Movement",
      skillId: skill.id,
      skillLabel: skill.label,
      prompt: `${current.title}: ${current.prompt}`,
      correctAnswer: current.answer,
      correct,
      review: reviewMode,
      data: { missionId: current.id, level: current.level, toolId: current.toolId, reflection },
    }, profileId);
  }

  function checkAnswer() {
    if (!current || !selected || !reflection || locked) return;
    if (selected !== current.answer) {
      if (!recordedMiss) {
        saveAttempt(false);
        setRecordedMiss(true);
      }
      setSelected("");
      setMessage(`Movement clue: ${current.hint}`);
      return;
    }
    saveAttempt(true);
    setLocked(true);
    setSolvedToolIds((ids) => ids.includes(current.toolId) ? ids : [...ids, current.toolId]);
    setScore((value) => value + (recordedMiss ? 6 : 10));
    setMessage(`Exactly. ${current.explanation}`);
  }

  function finishMission() {
    if (!reviewMode) {
      const solved = new Set(solvedToolIds);
      const unique = new Map<string, Omit<MovementToolCard, "earnedAt">>();
      for (const mission of session) {
        if (solved.has(mission.toolId) && !unique.has(mission.toolId)) {
          unique.set(mission.toolId, { id: mission.toolId, label: mission.toolLabel, emoji: mission.emoji });
        }
      }
      const result = addMovementTools(profileId, [...unique.values()].slice(0, 3), totalSeconds);
      setToolkit(result.toolkit);
      setNewTools(result.added);
    }
    award("movement-lab", {
      xp: reviewMode ? 16 + score : 30 + score,
      coins: reviewMode ? 3 : Math.max(6, Math.floor(score / 7)),
      score,
      completed: !reviewMode,
    });
    setPlaying(false);
    setFinished(true);
  }

  function advance() {
    if (!locked) return;
    if (index >= session.length - 1) return finishMission();
    setIndex((value) => value + 1);
    setStage("brief");
    setRemaining(0);
    setReflection("");
    setSelected("");
    setLocked(false);
    setRecordedMiss(false);
    setMessage("New movement mission. Check the space before beginning.");
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="Movement Lab">
        <section style={panel}>
          <div style={{ fontSize: 74 }}>🤸</div>
          <span style={eyebrow}>15 MOVEMENT MISSIONS · 5 BODY-BRAIN SKILLS</span>
          <h1 style={hero}>Move with control, not a camera.</h1>
          <p style={muted}>Short guided missions build balance, coordination, mobility, strength, and spatial awareness without recording the child or pretending to grade posture.</p>
          <div style={recommendation}><span style={small}>ADAPTIVE RECOMMENDATION</span><strong>{suggested}</strong><span>{levelBlurb(suggested)}</span></div>
          <div style={row}>{LEVELS.map((item) => <button key={item} type="button" onClick={() => setLevel(item)} style={pill(level === item)}>{item}{item === suggested ? " · Suggested" : ""}</button>)}</div>
          <p style={muted}>{levelBlurb(level)}</p>
          {focus && <div style={focusCard}>Focus: <strong>{MOVEMENT_SKILLS[focus].label}</strong> <button type="button" onClick={() => setFocus(null)} style={clearButton}>Use mixed missions</button></div>}
          <div style={actions}>
            <button type="button" onClick={() => startGame(false)} style={primary}>Start movement mission</button>
            {dueReviews.length > 0 && <button type="button" onClick={() => startGame(true)} style={review}>Review {dueReviews.length} due</button>}
          </div>
          <div style={summary}><span>🧰 {toolkit.cards.length} tools</span><span>⏱️ {toolkit.minutes} minutes</span><span>🏆 Best {bestScore}</span></div>
        </section>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Movement Lab">
        <section style={panel}>
          <div style={{ fontSize: 76 }}>{reviewMode ? "🧠" : "🏃"}</div>
          <span style={eyebrow}>{reviewMode ? "MOVEMENT REVIEW COMPLETE" : "MOVEMENT MISSION COMPLETE"}</span>
          <h1 style={hero}>{score} points</h1>
          <p style={muted}>{reviewMode ? "The exact movement concept will return only if more evidence is needed." : `You completed ${session.length} guided movements and reflected on the body clues behind them.`}</p>
          {!reviewMode && newTools.length > 0 && <div style={toolGrid}>{newTools.map((tool) => <div key={tool.id} style={toolCard}><span style={{ fontSize: 34 }}>{tool.emoji}</span><strong>{tool.label}</strong><span>NEW TOOL</span></div>)}</div>}
          <div style={actions}><button type="button" onClick={() => startGame(reviewMode)} style={primary}>Move again</button><Link href="/school" style={secondary}>Return to School</Link></div>
        </section>
      </GameFrame>
    );
  }

  if (!current) return null;
  const skill = MOVEMENT_SKILLS[current.skill];

  return (
    <GameFrame title="Movement Lab">
      <div style={{ width: "min(940px,100%)", margin: "0 auto" }}>
        <div style={stats}><span>{reviewMode ? "Spaced review" : `Mission ${index + 1} of ${session.length}`}</span><span>{current.level}</span><span>Score {score}</span></div>
        <section style={caseCard}>
          <div style={caseHeader}><div><span style={small}>{skill.label.toUpperCase()}</span><h2 style={caseTitle}>{current.emoji} {current.title}</h2></div><div style={toolTag}>{knownToolIds.has(current.toolId) ? "IN TOOLKIT" : "MOVEMENT TOOL"}<br/><strong>{current.toolLabel}</strong></div></div>

          {stage === "brief" && <>
            <div style={scene}><span style={small}>MOVEMENT BRIEF</span><p>{current.instruction}</p></div>
            <div style={safetyBox}><strong>Safety check:</strong> {current.safety}</div>
            <div style={actions}><button type="button" onClick={beginMovement} style={primary}>Space is clear · Start {current.seconds}s</button></div>
          </>}

          {stage === "move" && <>
            <div style={timer}>{remaining}</div>
            <h1 style={question}>{current.instruction}</h1>
            <p style={muted}>{current.safety}</p>
            <button type="button" onClick={() => { if (timerRef.current) window.clearInterval(timerRef.current); setRemaining(0); setStage("reflect"); }} style={stopButton}>Stop early</button>
          </>}

          {stage === "reflect" && <>
            <span style={eyebrow}>NOTICE, THEN EXPLAIN</span>
            <h1 style={question}>How did that movement feel?</h1>
            <div style={row}>{["Steadier or easier","About the same","Harder or less steady"].map((item) => <button key={item} type="button" disabled={locked} onClick={() => setReflection(item)} style={pill(reflection === item)}>{item}</button>)}</div>
            <h2 style={{ marginTop: 26 }}>{current.prompt}</h2>
            <div style={answerGrid}>{current.options.map((option) => <button key={option} type="button" disabled={locked} onClick={() => !locked && setSelected(option)} style={answerButton(selected === option, locked && option === current.answer)}>{option}</button>)}</div>
            <p style={{ ...messageStyle, color: locked ? "#d9ff5b" : recordedMiss ? "#ffcf83" : "#aab1bf" }}>{message}</p>
            <div style={actions}>{!locked ? <button type="button" disabled={!selected || !reflection} onClick={checkAnswer} style={{ ...primary, opacity: selected && reflection ? 1 : .45 }}>Check the movement idea</button> : <button type="button" onClick={advance} style={primary}>{index === session.length - 1 ? "Finish mission" : "Next movement →"}</button>}</div>
          </>}
        </section>
      </div>
    </GameFrame>
  );
}

const panel: React.CSSProperties = { width:"min(920px,100%)", margin:"0 auto", padding:"clamp(26px,5vw,54px)", borderRadius:32, background:"#181d28", border:"1px solid rgba(255,255,255,.11)", textAlign:"center" };
const eyebrow: React.CSSProperties = { color:"#7ef0b8", fontSize:11, fontWeight:950, letterSpacing:".17em" };
const small: React.CSSProperties = { color:"#7fdcff", fontSize:10, fontWeight:950, letterSpacing:".14em" };
const hero: React.CSSProperties = { margin:"12px 0", fontSize:"clamp(2.8rem,7vw,5.7rem)", lineHeight:.92, letterSpacing:"-.068em" };
const question: React.CSSProperties = { margin:"15px 0 22px", fontSize:"clamp(2rem,5vw,3.8rem)", lineHeight:1, letterSpacing:"-.05em" };
const muted: React.CSSProperties = { color:"#aab1bf", lineHeight:1.6 };
const recommendation: React.CSSProperties = { maxWidth:650, margin:"22px auto", display:"grid", gap:5, padding:17, borderRadius:21, background:"rgba(126,240,184,.08)", border:"1px solid rgba(126,240,184,.25)", color:"#d6ffea" };
const row: React.CSSProperties = { display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" };
const pill = (active:boolean): React.CSSProperties => ({ padding:"11px 15px", borderRadius:999, border:`1px solid ${active ? "#7ef0b8" : "rgba(255,255,255,.14)"}`, background:active ? "rgba(126,240,184,.12)" : "#222936", color:active ? "#7ef0b8" : "#fff", fontWeight:900, cursor:"pointer" });
const focusCard: React.CSSProperties = { maxWidth:600, margin:"18px auto 0", padding:13, borderRadius:17, background:"rgba(127,220,255,.08)", color:"#d9f5ff" };
const clearButton: React.CSSProperties = { marginLeft:10, padding:"7px 10px", borderRadius:999, border:"1px solid rgba(255,255,255,.18)", background:"transparent", color:"#fff", fontWeight:850, cursor:"pointer" };
const actions: React.CSSProperties = { display:"flex", justifyContent:"center", gap:10, flexWrap:"wrap", marginTop:22 };
const primary: React.CSSProperties = { minHeight:48, padding:"13px 20px", borderRadius:999, border:0, background:"#7ef0b8", color:"#10131b", fontSize:16, fontWeight:950, cursor:"pointer" };
const review: React.CSSProperties = { ...primary, background:"#c6b8ff" };
const secondary: React.CSSProperties = { minHeight:48, padding:"13px 19px", borderRadius:999, border:"1px solid rgba(127,220,255,.35)", background:"rgba(127,220,255,.1)", color:"#7fdcff", fontWeight:950, textDecoration:"none", display:"inline-grid", placeItems:"center" };
const summary: React.CSSProperties = { display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap", marginTop:22, color:"#aab1bf", fontSize:13, fontWeight:850 };
const stats: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap", marginBottom:10, padding:"10px 14px", borderRadius:17, background:"#181d28", color:"#aab1bf", fontSize:12, fontWeight:850 };
const caseCard: React.CSSProperties = { padding:"clamp(22px,4vw,42px)", borderRadius:30, background:"#181d28", border:"1px solid rgba(126,240,184,.18)", textAlign:"center" };
const caseHeader: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:14, alignItems:"flex-start", textAlign:"left", flexWrap:"wrap", marginBottom:18 };
const caseTitle: React.CSSProperties = { margin:"6px 0 0", fontSize:"clamp(1.7rem,4vw,2.8rem)", lineHeight:1, letterSpacing:"-.045em" };
const toolTag: React.CSSProperties = { padding:"10px 13px", borderRadius:16, background:"rgba(198,184,255,.1)", border:"1px solid rgba(198,184,255,.24)", color:"#dcd5ff", fontSize:10, lineHeight:1.45, letterSpacing:".08em", textAlign:"right" };
const scene: React.CSSProperties = { padding:"clamp(20px,4vw,30px)", borderRadius:23, background:"#eef9f3", color:"#1f2a24", fontSize:"clamp(1.2rem,2.8vw,1.65rem)", lineHeight:1.65, textAlign:"left" };
const safetyBox: React.CSSProperties = { marginTop:12, padding:14, borderRadius:18, background:"rgba(255,189,89,.1)", border:"1px solid rgba(255,189,89,.25)", color:"#ffe2ad", textAlign:"left" };
const timer: React.CSSProperties = { width:170, height:170, margin:"10px auto 20px", borderRadius:"50%", display:"grid", placeItems:"center", background:"rgba(126,240,184,.1)", border:"5px solid #7ef0b8", color:"#7ef0b8", fontSize:64, fontWeight:950 };
const stopButton: React.CSSProperties = { padding:"10px 15px", borderRadius:999, border:"1px solid rgba(255,255,255,.18)", background:"transparent", color:"#fff", fontWeight:850, cursor:"pointer" };
const answerGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:11 };
const answerButton = (selected:boolean, correct:boolean): React.CSSProperties => ({ minHeight:88, padding:16, borderRadius:22, border:`2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background:correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color:"#fff", fontSize:16, lineHeight:1.35, fontWeight:900, cursor:"pointer" });
const messageStyle: React.CSSProperties = { minHeight:26, margin:"18px 0 0", lineHeight:1.5, fontWeight:850 };
const toolGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginTop:20 };
const toolCard: React.CSSProperties = { display:"grid", gap:6, padding:17, borderRadius:20, background:"rgba(126,240,184,.09)", border:"1px solid rgba(126,240,184,.24)", color:"#d6ffea", fontSize:10, letterSpacing:".08em" };
