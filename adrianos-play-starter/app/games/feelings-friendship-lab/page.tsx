"use client";

import GameFrame from "@/components/GameFrame";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import {
  getDueReviewItems,
  readLearningForProfile,
  recordLearningAttempt,
} from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import {
  WELLBEING_MISSIONS,
  WELLBEING_SKILLS,
  wellbeingMissionById,
  type WellbeingLevel,
  type WellbeingMission,
  type WellbeingSkill,
} from "@/lib/adrian-wellbeing-bank";
import {
  addWellbeingToolCards,
  readWellbeingToolkit,
  type WellbeingToolCard,
} from "@/lib/adrian-wellbeing-toolkit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: WellbeingLevel[] = ["Feelings Finder", "Friendship Builder", "Calm Problem Solver"];
const SKILLS = Object.entries(WELLBEING_SKILLS) as Array<[
  WellbeingSkill,
  (typeof WELLBEING_SKILLS)[WellbeingSkill]
]>;

function adaptiveLevel(profileId: string, age: number): WellbeingLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(WELLBEING_SKILLS)
    .map((skill) => learning.skills[skill.id])
    .filter((skill) => Boolean(skill));
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length > 0
    ? Math.round(evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length)
    : 0;

  if (age <= 5) return "Feelings Finder";
  if (age <= 7) return mastery >= 72 && attempts >= 15 ? "Calm Problem Solver" : "Friendship Builder";
  return mastery >= 45 || attempts >= 8 ? "Calm Problem Solver" : "Friendship Builder";
}

function levelDescription(level: WellbeingLevel): string {
  if (level === "Feelings Finder") {
    return "Name feelings, notice body clues, ask clearly, take turns, and practice simple boundaries.";
  }
  if (level === "Friendship Builder") {
    return "Handle mixed feelings, use calming plans, listen carefully, show empathy, and repair everyday conflicts.";
  }
  return "Separate feelings from facts, pause escalating arguments, navigate impact and intent, and hold stronger boundaries.";
}

function focusFromSkillId(value: string | null): WellbeingSkill | null {
  if (!value) return null;
  return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null;
}

function skillPrompt(skill: WellbeingSkill): string {
  if (skill === "emotions") return "NOTICE THE FEELING CLUES";
  if (skill === "regulation") return "PAUSE BEFORE REACTING";
  if (skill === "communication") return "SAY IT CLEARLY · LISTEN CAREFULLY";
  if (skill === "empathy") return "LOOK THROUGH ANOTHER WINDOW";
  return "SOLVE THE CONFLICT · KEEP THE BOUNDARY";
}

export default function FeelingsFriendshipLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggestedLevel = adaptiveLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<WellbeingLevel>(suggestedLevel);
  const [focus, setFocus] = useState<WellbeingSkill | null>(null);
  const [session, setSession] = useState<WellbeingMission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose a practice level.");
  const [toolkit, setToolkit] = useState(() => readWellbeingToolkit(profileId));
  const [newCards, setNewCards] = useState<WellbeingToolCard[]>([]);
  const [solvedToolIds, setSolvedToolIds] = useState<string[]>([]);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "feelings-friendship-lab");
  const current = session[index] ?? null;
  const bestScore = progress.games["feelings-friendship-lab"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    const requestedFocus = focusFromSkillId(params.get("focus"));
    if (LEVELS.includes(requestedLevel as WellbeingLevel)) {
      setLevel(requestedLevel as WellbeingLevel);
    }
    setFocus(requestedFocus);
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
    return () => window.speechSynthesis?.cancel();
  }, []);

  const knownToolIds = useMemo(
    () => new Set(toolkit.cards.map((card) => card.id)),
    [toolkit]
  );

  function reviewItems(): WellbeingMission[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "feelings-friendship-lab")
      .map((item) => {
        const missionId = typeof item.data?.missionId === "string" ? item.data.missionId : "";
        if (!missionId || seen.has(missionId)) return null;
        const mission = wellbeingMissionById(missionId);
        if (!mission) return null;
        seen.add(missionId);
        return mission;
      })
      .filter((mission): mission is WellbeingMission => Boolean(mission))
      .slice(0, 8);
  }

  function normalItems(): WellbeingMission[] {
    const filtered = WELLBEING_MISSIONS.filter((mission) =>
      mission.level === level && (!focus || mission.skill === focus)
    );
    const fallback = WELLBEING_MISSIONS.filter((mission) => mission.level === level);
    const pool = filtered.length > 0 ? filtered : fallback;
    return pickFreshItems(
      pool,
      Math.min(6, pool.length),
      `adrianos-content:wellbeing:${profileId}:${level}:${focus ?? "mixed"}`,
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
    setMessage("Read the situation. Choose the response that protects people, facts, and boundaries.");
    setNewCards([]);
    setSolvedToolIds([]);
    recordPlay("feelings-friendship-lab");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = WELLBEING_SKILLS[current.skill];
    recordLearningAttempt({
      gameSlug: "feelings-friendship-lab",
      subject: "Wellbeing",
      skillId: skill.id,
      skillLabel: skill.label,
      prompt: `${current.setting}: ${current.prompt}`,
      correctAnswer: current.answer,
      correct,
      review: reviewMode,
      data: {
        missionId: current.id,
        level: current.level,
        setting: current.setting,
        toolId: current.toolId,
      },
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
      setMessage(`Try this clue: ${current.hint}`);
      return;
    }

    saveAttempt(true);
    setLocked(true);
    setSolvedToolIds((ids) => ids.includes(current.toolId) ? ids : [...ids, current.toolId]);
    const points = recordedMiss ? 6 : 10;
    setScore((value) => value + points);
    setMessage(`Strong choice. ${current.explanation}`);
  }

  function speakCurrent() {
    if (!current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setMessage("Read aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${current.setting}. ${current.scene}. ${current.prompt}`);
    utterance.rate = profile.age <= 5 ? 0.82 : 0.93;
    utterance.pitch = 1.03;
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
      const unique = new Map<string, Omit<WellbeingToolCard, "earnedAt">>();
      for (const mission of session) {
        if (!solved.has(mission.toolId) || unique.has(mission.toolId)) continue;
        unique.set(mission.toolId, {
          id: mission.toolId,
          label: mission.toolLabel,
          emoji: mission.emoji,
        });
      }
      const result = addWellbeingToolCards(profileId, [...unique.values()].slice(0, 3));
      setToolkit(result.toolkit);
      setNewCards(result.added);
    }
    const xp = reviewMode ? 18 + score : 32 + score;
    const coins = reviewMode ? 3 : Math.max(7, Math.floor(score / 6));
    award("feelings-friendship-lab", { xp, coins, score, completed: !reviewMode });
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
    setMessage("New situation. Notice the feeling, the facts, the need, and the boundary.");
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="Feelings & Friendship Lab">
        <section style={menuCard}>
          <div style={{ fontSize: 76 }}>💛</div>
          <span style={eyebrow}>30 SITUATIONS · 5 HUMAN SKILLS</span>
          <h1 style={heroTitle}>Feelings are signals. Actions are choices.</h1>
          <p style={muted}>
            Practice emotional awareness, calm responses, clear communication, empathy, conflict repair, and respectful boundaries.
          </p>

          <div style={safetyNote}>
            This lab teaches everyday strategies. It does not diagnose feelings, score private moods, or replace support from a trusted adult.
          </div>

          <div style={recommendation}>
            <span style={smallLabel}>ADAPTIVE RECOMMENDATION</span>
            <strong>{suggestedLevel}</strong>
            <span>{levelDescription(suggestedLevel)}</span>
          </div>

          <div style={levelRow}>
            {LEVELS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLevel(item)}
                style={levelButton(level === item)}
              >
                {item}{item === suggestedLevel ? " · Suggested" : ""}
              </button>
            ))}
          </div>
          <p style={{ ...muted, marginTop: 10 }}>{levelDescription(level)}</p>

          {focus && (
            <div style={focusCard}>
              Focus mission: <strong>{WELLBEING_SKILLS[focus].label}</strong>
              <button type="button" onClick={() => setFocus(null)} style={clearButton}>Use mixed situations</button>
            </div>
          )}

          <div style={menuActions}>
            <button type="button" onClick={() => startGame(false)} style={primaryButton}>
              Begin practice
            </button>
            {dueReviews.length > 0 && (
              <button type="button" onClick={() => startGame(true)} style={reviewButton}>
                Review {dueReviews.length} due
              </button>
            )}
          </div>

          <div style={toolkitSummary}>
            <span>🧰 {toolkit.cards.length} calm & friendship tools</span>
            <span>💛 {toolkit.missions} missions</span>
            <span>🏆 Best score {bestScore}</span>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Feelings & Friendship Lab">
        <section style={finishCard}>
          <div style={{ fontSize: 78 }}>{reviewMode ? "🧠" : "🧰"}</div>
          <span style={eyebrow}>{reviewMode ? "SKILL REVIEW COMPLETE" : "TOOLS ADDED"}</span>
          <h1 style={heroTitle}>{score} points</h1>
          <p style={muted}>
            {reviewMode
              ? "The exact situation returns only when AdrianOS still needs stronger evidence for that skill."
              : `You practiced ${session.length} real-life situation${session.length === 1 ? "" : "s"} and strengthened your Calm & Friendship Toolkit.`}
          </p>

          {!reviewMode && newCards.length > 0 && (
            <div style={newCardGrid}>
              {newCards.map((card) => (
                <div key={card.id} style={newCard}>
                  <span style={{ fontSize: 35 }}>{card.emoji}</span>
                  <strong>{card.label}</strong>
                  <span>NEW TOOL</span>
                </div>
              ))}
            </div>
          )}

          {!reviewMode && newCards.length === 0 && (
            <p style={muted}>These tools were already in the toolkit. The practice still strengthened mastery.</p>
          )}

          <div style={menuActions}>
            <button type="button" onClick={() => startGame(reviewMode)} style={primaryButton}>
              Practice another set
            </button>
            <Link href="/school" style={secondaryLink}>Return to School</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (!current) return null;
  const currentSkill = WELLBEING_SKILLS[current.skill];
  const toolAlreadyKnown = knownToolIds.has(current.toolId);

  return (
    <GameFrame title="Feelings & Friendship Lab">
      <div style={gameShell}>
        <div style={statsRow}>
          <span>{reviewMode ? "Spaced review" : `Situation ${index + 1} of ${session.length}`}</span>
          <span>{current.level}</span>
          <span>Score {score}</span>
        </div>

        <section style={caseCard}>
          <div style={caseHeader}>
            <div>
              <span style={smallLabel}>{skillPrompt(current.skill)}</span>
              <h2 style={settingTitle}>{current.emoji} {current.setting}</h2>
            </div>
            <div style={toolTag}>
              {toolAlreadyKnown ? "IN YOUR TOOLKIT" : "PRACTICE TOOL"}<br />
              <strong>{current.toolLabel}</strong>
            </div>
          </div>

          <div style={sceneBox}>
            <span style={sceneLabel}>SITUATION</span>
            <p>{current.scene}</p>
          </div>

          <button type="button" onClick={voicePlaying ? stopSpeaking : speakCurrent} style={listenButton}>
            {voicePlaying ? "Stop reading" : "🔊 Read situation aloud"}
          </button>

          <span style={eyebrow}>{currentSkill.label.toUpperCase()}</span>
          <h1 style={questionTitle}>{current.prompt}</h1>

          <div style={answerGrid}>
            {current.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={locked}
                onClick={() => !locked && setSelected(option)}
                style={answerButton(
                  selected === option,
                  locked && option === current.answer
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <p style={{
            ...messageStyle,
            color: locked ? "#d9ff5b" : recordedMiss ? "#ffcf83" : "#aab1bf",
          }}>
            {message}
          </p>

          <div style={menuActions}>
            {!locked ? (
              <button
                type="button"
                onClick={checkAnswer}
                style={{ ...primaryButton, opacity: selected ? 1 : .45 }}
                disabled={!selected}
              >
                Check the response
              </button>
            ) : (
              <button type="button" onClick={advance} style={primaryButton}>
                {index === session.length - 1 ? "Add tools to toolkit" : "Next situation →"}
              </button>
            )}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}

const menuCard: React.CSSProperties = {
  width: "min(920px,100%)",
  margin: "0 auto",
  padding: "clamp(26px,5vw,54px)",
  borderRadius: 32,
  background: "#181d28",
  border: "1px solid rgba(255,255,255,.11)",
  textAlign: "center",
};
const finishCard: React.CSSProperties = { ...menuCard, width: "min(820px,100%)" };
const gameShell: React.CSSProperties = { width: "min(980px,100%)", margin: "0 auto" };
const eyebrow: React.CSSProperties = { color: "#ffb9d5", fontSize: 11, fontWeight: 950, letterSpacing: ".17em" };
const smallLabel: React.CSSProperties = { color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".14em" };
const heroTitle: React.CSSProperties = { margin: "12px 0", fontSize: "clamp(2.8rem,7vw,5.7rem)", lineHeight: .92, letterSpacing: "-.068em" };
const settingTitle: React.CSSProperties = { margin: "6px 0 0", fontSize: "clamp(1.65rem,4vw,2.7rem)", lineHeight: 1, letterSpacing: "-.045em" };
const questionTitle: React.CSSProperties = { margin: "12px 0 22px", fontSize: "clamp(2rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-.052em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.6 };
const safetyNote: React.CSSProperties = { maxWidth: 680, margin: "18px auto", padding: 14, borderRadius: 18, background: "rgba(255,185,213,.07)", border: "1px solid rgba(255,185,213,.2)", color: "#ffdbe9", lineHeight: 1.5, fontSize: 13 };
const recommendation: React.CSSProperties = { maxWidth: 650, margin: "22px auto", display: "grid", gap: 5, padding: 17, borderRadius: 21, background: "rgba(255,185,213,.08)", border: "1px solid rgba(255,185,213,.25)", color: "#ffe2ee" };
const levelRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" };
const levelButton = (active: boolean): React.CSSProperties => ({ padding: "11px 15px", borderRadius: 999, border: `1px solid ${active ? "#ffb9d5" : "rgba(255,255,255,.14)"}`, background: active ? "rgba(255,185,213,.12)" : "#222936", color: active ? "#ffb9d5" : "#fff", fontWeight: 900, cursor: "pointer" });
const focusCard: React.CSSProperties = { maxWidth: 620, margin: "18px auto 0", padding: 13, borderRadius: 17, background: "rgba(127,220,255,.08)", color: "#d9f5ff" };
const clearButton: React.CSSProperties = { marginLeft: 10, padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", background: "transparent", color: "#fff", fontWeight: 850, cursor: "pointer" };
const menuActions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 23 };
const primaryButton: React.CSSProperties = { minHeight: 48, padding: "13px 20px", borderRadius: 999, border: 0, background: "#ffb9d5", color: "#10131b", fontSize: 16, fontWeight: 950, cursor: "pointer" };
const reviewButton: React.CSSProperties = { ...primaryButton, background: "#c6b8ff" };
const secondaryLink: React.CSSProperties = { minHeight: 48, padding: "13px 19px", borderRadius: 999, border: "1px solid rgba(127,220,255,.35)", background: "rgba(127,220,255,.1)", color: "#7fdcff", fontWeight: 950, textDecoration: "none", display: "inline-grid", placeItems: "center" };
const toolkitSummary: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 22, color: "#aab1bf", fontSize: 13, fontWeight: 850 };
const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "10px 14px", borderRadius: 17, background: "#181d28", color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const caseCard: React.CSSProperties = { padding: "clamp(22px,4vw,42px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,185,213,.2)", textAlign: "center" };
const caseHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", textAlign: "left", flexWrap: "wrap", marginBottom: 18 };
const toolTag: React.CSSProperties = { padding: "10px 13px", borderRadius: 16, background: "rgba(198,184,255,.1)", border: "1px solid rgba(198,184,255,.24)", color: "#dcd5ff", fontSize: 10, lineHeight: 1.45, letterSpacing: ".08em", textAlign: "right" };
const sceneBox: React.CSSProperties = { marginBottom: 13, padding: "clamp(19px,4vw,30px)", borderRadius: 23, background: "#f6eadf", color: "#27231f", fontFamily: "Georgia,serif", fontSize: "clamp(1.18rem,2.7vw,1.58rem)", lineHeight: 1.7, textAlign: "left" };
const sceneLabel: React.CSSProperties = { display: "block", marginBottom: 8, fontFamily: "system-ui,sans-serif", fontSize: 10, fontWeight: 950, letterSpacing: ".16em", color: "#8a4f69" };
const listenButton: React.CSSProperties = { margin: "0 0 20px", padding: "9px 13px", borderRadius: 999, border: "1px solid rgba(127,220,255,.28)", background: "rgba(127,220,255,.08)", color: "#7fdcff", fontWeight: 900, cursor: "pointer" };
const answerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 11 };
const answerButton = (selected: boolean, correct: boolean): React.CSSProperties => ({ minHeight: 92, padding: 16, borderRadius: 22, border: `2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background: correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color: "#fff", fontSize: 16, lineHeight: 1.35, fontWeight: 900, cursor: "pointer" });
const messageStyle: React.CSSProperties = { minHeight: 26, margin: "18px 0 0", lineHeight: 1.5, fontWeight: 850 };
const newCardGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 20 };
const newCard: React.CSSProperties = { display: "grid", gap: 6, padding: 17, borderRadius: 20, background: "rgba(255,185,213,.09)", border: "1px solid rgba(255,185,213,.24)", color: "#ffe2ee", fontSize: 10, letterSpacing: ".08em" };
