"use client";

import GameFrame from "@/components/GameFrame";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import {
  STUDY_MISSIONS,
  STUDY_SKILLS,
  studyMissionById,
  type StudyLevel,
  type StudyMission,
  type StudySkill,
} from "@/lib/adrian-study-skills-bank";
import { addStudyTools, readStudyToolkit, type StudyTool } from "@/lib/adrian-study-toolkit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: StudyLevel[] = ["Learning Starter", "Study Builder", "Learning Strategist"];
const SKILLS = Object.entries(STUDY_SKILLS) as Array<[StudySkill, (typeof STUDY_SKILLS)[StudySkill]]>;

function adaptiveLevel(profileId: string, age: number): StudyLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(STUDY_SKILLS).map((skill) => learning.skills[skill.id]).filter(Boolean);
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length > 0
    ? Math.round(evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length)
    : 0;
  if (age <= 6) return "Learning Starter";
  if (age <= 8) return mastery >= 70 && attempts >= 15 ? "Learning Strategist" : "Study Builder";
  return mastery >= 45 || attempts >= 8 ? "Learning Strategist" : "Study Builder";
}

function levelDescription(level: StudyLevel): string {
  if (level === "Learning Starter") return "Tiny starts, keyword notes, teach-back, specific questions, and simple revision.";
  if (level === "Study Builder") return "Spaced practice, self-testing notes, mixed practice, and confidence checks.";
  return "Feedback loops, strategy selection, calibration, and independent learning plans.";
}

function focusFromSkillId(value: string | null): StudySkill | null {
  if (!value) return null;
  return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null;
}

export default function StudySkillsLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggested = adaptiveLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<StudyLevel>(suggested);
  const [focus, setFocus] = useState<StudySkill | null>(null);
  const [session, setSession] = useState<StudyMission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose a learning level.");
  const [toolkit, setToolkit] = useState(() => readStudyToolkit(profileId));
  const [newTools, setNewTools] = useState<StudyTool[]>([]);
  const [solvedToolIds, setSolvedToolIds] = useState<string[]>([]);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "study-skills-lab");
  const current = session[index] ?? null;
  const bestScore = progress.games["study-skills-lab"]?.bestScore ?? 0;
  const knownToolIds = useMemo(() => new Set(toolkit.tools.map((tool) => tool.id)), [toolkit]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    const requestedFocus = focusFromSkillId(params.get("focus"));
    if (LEVELS.includes(requestedLevel as StudyLevel)) setLevel(requestedLevel as StudyLevel);
    setFocus(requestedFocus);
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
    return () => window.speechSynthesis?.cancel();
  }, []);

  function reviewItems(): StudyMission[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "study-skills-lab")
      .map((item) => {
        const missionId = typeof item.data?.missionId === "string" ? item.data.missionId : "";
        if (!missionId || seen.has(missionId)) return null;
        const mission = studyMissionById(missionId);
        if (!mission) return null;
        seen.add(missionId);
        return mission;
      })
      .filter((mission): mission is StudyMission => Boolean(mission))
      .slice(0, 8);
  }

  function normalItems(): StudyMission[] {
    const filtered = STUDY_MISSIONS.filter((mission) => mission.level === level && (!focus || mission.skill === focus));
    const fallback = STUDY_MISSIONS.filter((mission) => mission.level === level);
    const pool = filtered.length > 0 ? filtered : fallback;
    return pickFreshItems(
      pool,
      Math.min(6, pool.length),
      `adrianos-content:study:${profileId}:${level}:${focus ?? "mixed"}`,
      (mission) => mission.id
    );
  }

  function startGame(useReview = false) {
    const reviews = reviewItems();
    const nextSession = useReview && reviews.length > 0 ? reviews : normalItems();
    if (nextSession.length === 0) return;
    setSession(nextSession);
    setIndex(0);
    setSelected("");
    setScore(0);
    setPlaying(true);
    setFinished(false);
    setLocked(false);
    setReviewMode(useReview && reviews.length > 0);
    setRecordedMiss(false);
    setMessage("Read the learning problem and choose the strategy that produces evidence, not just comfort.");
    setNewTools([]);
    setSolvedToolIds([]);
    recordPlay("study-skills-lab");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = STUDY_SKILLS[current.skill];
    recordLearningAttempt({
      gameSlug: "study-skills-lab",
      subject: "Learning Skills",
      skillId: skill.id,
      skillLabel: skill.label,
      prompt: `${current.title}: ${current.prompt}`,
      correctAnswer: current.answer,
      correct,
      review: reviewMode,
      data: { missionId: current.id, level: current.level, toolId: current.toolId },
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
      setMessage(`Learning clue: ${current.hint}`);
      return;
    }
    saveAttempt(true);
    setLocked(true);
    setSolvedToolIds((ids) => ids.includes(current.toolId) ? ids : [...ids, current.toolId]);
    setScore((value) => value + (recordedMiss ? 6 : 10));
    setMessage(`Strong strategy. ${current.explanation}`);
  }

  function speakCurrent() {
    if (!current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setMessage("Read aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${current.title}. ${current.scene}. ${current.prompt}`);
    utterance.rate = profile.age <= 6 ? 0.84 : 0.94;
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
      const solved = new Set(solvedToolIds);
      const unique = new Map<string, Omit<StudyTool, "earnedAt">>();
      for (const mission of session) {
        if (!solved.has(mission.toolId) || unique.has(mission.toolId)) continue;
        unique.set(mission.toolId, { id: mission.toolId, label: mission.toolLabel, emoji: mission.emoji });
      }
      const result = addStudyTools(profileId, [...unique.values()].slice(0, 3));
      setToolkit(result.toolkit);
      setNewTools(result.added);
    }
    award("study-skills-lab", {
      xp: (reviewMode ? 18 : 32) + score,
      coins: reviewMode ? 3 : Math.max(7, Math.floor(score / 6)),
      score,
      completed: !reviewMode,
    });
    setPlaying(false);
    setFinished(true);
  }

  function advance() {
    if (!locked) return;
    if (index >= session.length - 1) {
      finishMission();
      return;
    }
    stopSpeaking();
    setIndex((value) => value + 1);
    setSelected("");
    setLocked(false);
    setRecordedMiss(false);
    setMessage("New learning problem. Choose the strategy that makes understanding visible.");
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="Study Skills Lab">
        <section style={panel}>
          <div style={{ fontSize: 76 }}>🧠</div>
          <span style={eyebrow}>15 LEARNING PROBLEMS · 5 META-SKILLS</span>
          <h1 style={heroTitle}>Learn how to learn.</h1>
          <p style={muted}>Plan practice, take useful notes, test memory, ask sharper questions, and turn feedback into better work.</p>
          <div style={recommendation}>
            <span style={smallLabel}>ADAPTIVE RECOMMENDATION</span>
            <strong>{suggested}</strong>
            <span>{levelDescription(suggested)}</span>
          </div>
          <div style={row}>
            {LEVELS.map((item) => (
              <button key={item} type="button" onClick={() => setLevel(item)} style={pill(level === item)}>
                {item}{item === suggested ? " · Suggested" : ""}
              </button>
            ))}
          </div>
          <p style={{ ...muted, marginTop: 10 }}>{levelDescription(level)}</p>
          {focus && (
            <div style={focusCard}>
              Focus: <strong>{STUDY_SKILLS[focus].label}</strong>
              <button type="button" onClick={() => setFocus(null)} style={clearButton}>Use mixed skills</button>
            </div>
          )}
          <div style={actions}>
            <button type="button" onClick={() => startGame(false)} style={primaryButton}>Start learning mission</button>
            {dueReviews.length > 0 && <button type="button" onClick={() => startGame(true)} style={reviewButton}>Review {dueReviews.length} due</button>}
          </div>
          <div style={summaryRow}>
            <span>🧰 {toolkit.tools.length} tools</span>
            <span>🧠 {toolkit.missions} missions</span>
            <span>🏆 Best {bestScore}</span>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Study Skills Lab">
        <section style={panel}>
          <div style={{ fontSize: 76 }}>{reviewMode ? "🔁" : "🧰"}</div>
          <span style={eyebrow}>{reviewMode ? "REVIEW COMPLETE" : "LEARNING PLAN FILED"}</span>
          <h1 style={heroTitle}>{score} points</h1>
          <p style={muted}>{reviewMode ? "The exact strategy returns only if more evidence is needed." : "You solved learning problems and added demonstrated strategies to your toolkit."}</p>
          {!reviewMode && newTools.length > 0 && (
            <div style={toolGrid}>
              {newTools.map((tool) => <div key={tool.id} style={toolCard}><span style={{ fontSize: 34 }}>{tool.emoji}</span><strong>{tool.label}</strong><span>NEW TOOL</span></div>)}
            </div>
          )}
          <div style={actions}>
            <button type="button" onClick={() => startGame(reviewMode)} style={primaryButton}>Try another mission</button>
            <Link href="/school" style={secondaryLink}>Return to School</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (!current) return null;
  const currentSkill = STUDY_SKILLS[current.skill];

  return (
    <GameFrame title="Study Skills Lab">
      <div style={gameShell}>
        <div style={stats}><span>{reviewMode ? "Spaced review" : `Problem ${index + 1} of ${session.length}`}</span><span>{current.level}</span><span>Score {score}</span></div>
        <section style={caseCard}>
          <div style={caseHeader}>
            <div><span style={smallLabel}>{currentSkill.label.toUpperCase()}</span><h2 style={caseTitle}>{current.emoji} {current.title}</h2></div>
            <div style={toolTag}>{knownToolIds.has(current.toolId) ? "KNOWN TOOL" : "TOOL TO EARN"}<br /><strong>{current.toolLabel}</strong></div>
          </div>
          <div style={sceneBox}>{current.scene}</div>
          <button type="button" onClick={voicePlaying ? stopSpeaking : speakCurrent} style={listenButton}>{voicePlaying ? "Stop reading" : "🔊 Read aloud"}</button>
          <h1 style={questionTitle}>{current.prompt}</h1>
          <div style={answerGrid}>
            {current.options.map((option) => (
              <button key={option} type="button" disabled={locked} onClick={() => !locked && setSelected(option)} style={answerButton(selected === option, locked && option === current.answer)}>{option}</button>
            ))}
          </div>
          <p style={{ ...messageStyle, color: locked ? "#d9ff5b" : recordedMiss ? "#ffcf83" : "#aab1bf" }}>{message}</p>
          <div style={actions}>
            {!locked
              ? <button type="button" onClick={checkAnswer} style={{ ...primaryButton, opacity: selected ? 1 : .45 }} disabled={!selected}>Test the strategy</button>
              : <button type="button" onClick={advance} style={primaryButton}>{index === session.length - 1 ? "Finish mission" : "Next problem →"}</button>}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}

const panel: React.CSSProperties = { width:"min(920px,100%)", margin:"0 auto", padding:"clamp(26px,5vw,54px)", borderRadius:32, background:"#181d28", border:"1px solid rgba(255,255,255,.11)", textAlign:"center" };
const gameShell: React.CSSProperties = { width:"min(980px,100%)", margin:"0 auto" };
const eyebrow: React.CSSProperties = { color:"#d9ff5b", fontSize:11, fontWeight:950, letterSpacing:".17em" };
const smallLabel: React.CSSProperties = { color:"#7fdcff", fontSize:10, fontWeight:950, letterSpacing:".14em" };
const heroTitle: React.CSSProperties = { margin:"12px 0", fontSize:"clamp(2.8rem,7vw,5.7rem)", lineHeight:.92, letterSpacing:"-.068em" };
const caseTitle: React.CSSProperties = { margin:"6px 0 0", fontSize:"clamp(1.65rem,4vw,2.7rem)", lineHeight:1, letterSpacing:"-.045em" };
const questionTitle: React.CSSProperties = { margin:"14px 0 22px", fontSize:"clamp(2rem,5vw,3.8rem)", lineHeight:1, letterSpacing:"-.052em" };
const muted: React.CSSProperties = { color:"#aab1bf", lineHeight:1.6 };
const recommendation: React.CSSProperties = { maxWidth:650, margin:"22px auto", display:"grid", gap:5, padding:17, borderRadius:21, background:"rgba(217,255,91,.08)", border:"1px solid rgba(217,255,91,.22)", color:"#efffc0" };
const row: React.CSSProperties = { display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" };
const pill = (active:boolean): React.CSSProperties => ({ padding:"11px 15px", borderRadius:999, border:`1px solid ${active ? "#d9ff5b" : "rgba(255,255,255,.14)"}`, background:active ? "rgba(217,255,91,.12)" : "#222936", color:active ? "#d9ff5b" : "#fff", fontWeight:900, cursor:"pointer" });
const focusCard: React.CSSProperties = { maxWidth:600, margin:"18px auto 0", padding:13, borderRadius:17, background:"rgba(127,220,255,.08)", color:"#d9f5ff" };
const clearButton: React.CSSProperties = { marginLeft:10, padding:"7px 10px", borderRadius:999, border:"1px solid rgba(255,255,255,.18)", background:"transparent", color:"#fff", fontWeight:850, cursor:"pointer" };
const actions: React.CSSProperties = { display:"flex", justifyContent:"center", gap:10, flexWrap:"wrap", marginTop:23 };
const primaryButton: React.CSSProperties = { minHeight:48, padding:"13px 20px", borderRadius:999, border:0, background:"#d9ff5b", color:"#10131b", fontSize:16, fontWeight:950, cursor:"pointer" };
const reviewButton: React.CSSProperties = { ...primaryButton, background:"#c6b8ff" };
const secondaryLink: React.CSSProperties = { minHeight:48, padding:"13px 19px", borderRadius:999, border:"1px solid rgba(127,220,255,.35)", background:"rgba(127,220,255,.1)", color:"#7fdcff", fontWeight:950, textDecoration:"none", display:"inline-grid", placeItems:"center" };
const summaryRow: React.CSSProperties = { display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap", marginTop:22, color:"#aab1bf", fontSize:13, fontWeight:850 };
const stats: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap", marginBottom:10, padding:"10px 14px", borderRadius:17, background:"#181d28", color:"#aab1bf", fontSize:12, fontWeight:850 };
const caseCard: React.CSSProperties = { padding:"clamp(22px,4vw,42px)", borderRadius:30, background:"#181d28", border:"1px solid rgba(217,255,91,.18)", textAlign:"center" };
const caseHeader: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:14, alignItems:"flex-start", textAlign:"left", flexWrap:"wrap", marginBottom:18 };
const toolTag: React.CSSProperties = { padding:"10px 13px", borderRadius:16, background:"rgba(198,184,255,.1)", border:"1px solid rgba(198,184,255,.24)", color:"#dcd5ff", fontSize:10, lineHeight:1.45, letterSpacing:".08em", textAlign:"right" };
const sceneBox: React.CSSProperties = { marginBottom:13, padding:"clamp(19px,4vw,30px)", borderRadius:23, background:"#eef3df", color:"#25291e", fontFamily:"Georgia,serif", fontSize:"clamp(1.18rem,2.7vw,1.58rem)", lineHeight:1.7, textAlign:"left" };
const listenButton: React.CSSProperties = { margin:"0 0 20px", padding:"9px 13px", borderRadius:999, border:"1px solid rgba(127,220,255,.28)", background:"rgba(127,220,255,.08)", color:"#7fdcff", fontWeight:900, cursor:"pointer" };
const answerGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:11 };
const answerButton = (selected:boolean, correct:boolean): React.CSSProperties => ({ minHeight:92, padding:16, borderRadius:22, border:`2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background:correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color:"#fff", fontSize:16, lineHeight:1.35, fontWeight:900, cursor:"pointer" });
const messageStyle: React.CSSProperties = { minHeight:26, margin:"18px 0 0", lineHeight:1.5, fontWeight:850 };
const toolGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginTop:20 };
const toolCard: React.CSSProperties = { display:"grid", gap:6, padding:17, borderRadius:20, background:"rgba(217,255,91,.09)", border:"1px solid rgba(217,255,91,.24)", color:"#efffc0", fontSize:10, letterSpacing:".08em" };
