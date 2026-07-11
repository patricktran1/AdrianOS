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
  CIVIC_MISSIONS,
  CIVIC_SKILLS,
  civicMissionById,
  type CivicLevel,
  type CivicMission,
  type CivicSkill,
} from "@/lib/adrian-civic-bank";
import {
  addCivicToolCards,
  readCivicToolbox,
  type CivicToolCard,
} from "@/lib/adrian-civic-toolbox";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: CivicLevel[] = ["Community Helper", "Citizen", "Civic Designer"];
const SKILLS = Object.entries(CIVIC_SKILLS) as Array<[
  CivicSkill,
  (typeof CIVIC_SKILLS)[CivicSkill]
]>;

function adaptiveLevel(profileId: string, age: number): CivicLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(CIVIC_SKILLS)
    .map((skill) => learning.skills[skill.id])
    .filter((skill) => Boolean(skill));
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length > 0
    ? Math.round(evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length)
    : 0;

  if (age <= 5) return "Community Helper";
  if (age <= 7) return mastery >= 72 && attempts >= 15 ? "Civic Designer" : "Citizen";
  return mastery >= 48 || attempts >= 8 ? "Civic Designer" : "Citizen";
}

function levelDescription(level: CivicLevel): string {
  if (level === "Community Helper") {
    return "Shared rules, helpful services, fair turns, simple voting, and checking basic claims.";
  }
  if (level === "Citizen") {
    return "Rights and responsibilities, public goods, fair process, budgets, and source context.";
  }
  return "Policy trade-offs, accountability, equitable access, deliberation, and information verification.";
}

function focusFromSkillId(value: string | null): CivicSkill | null {
  if (!value) return null;
  return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null;
}

function missionLabel(skill: CivicSkill): string {
  if (skill === "rules") return "RULES AND RESPONSIBILITIES";
  if (skill === "services") return "PUBLIC SERVICES";
  if (skill === "rights") return "RIGHTS AND FAIRNESS";
  if (skill === "decisions") return "COMMUNITY DECISION";
  return "CHECK THE INFORMATION";
}

export default function CivicLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggestedLevel = adaptiveLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<CivicLevel>(suggestedLevel);
  const [focus, setFocus] = useState<CivicSkill | null>(null);
  const [session, setSession] = useState<CivicMission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose a civic mission level.");
  const [toolbox, setToolbox] = useState(() => readCivicToolbox(profileId));
  const [newCards, setNewCards] = useState<CivicToolCard[]>([]);
  const [solvedCardIds, setSolvedCardIds] = useState<string[]>([]);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "civic-lab");
  const current = session[index] ?? null;
  const bestScore = progress.games["civic-lab"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    const requestedFocus = focusFromSkillId(params.get("focus"));
    if (LEVELS.includes(requestedLevel as CivicLevel)) {
      setLevel(requestedLevel as CivicLevel);
    }
    setFocus(requestedFocus);
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
    return () => window.speechSynthesis?.cancel();
  }, []);

  const knownCardIds = useMemo(
    () => new Set(toolbox.cards.map((card) => card.id)),
    [toolbox]
  );

  function reviewItems(): CivicMission[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "civic-lab")
      .map((item) => {
        const missionId = typeof item.data?.missionId === "string" ? item.data.missionId : "";
        if (!missionId || seen.has(missionId)) return null;
        const mission = civicMissionById(missionId);
        if (!mission) return null;
        seen.add(missionId);
        return mission;
      })
      .filter((mission): mission is CivicMission => Boolean(mission))
      .slice(0, 8);
  }

  function normalItems(): CivicMission[] {
    const filtered = CIVIC_MISSIONS.filter((mission) =>
      mission.level === level && (!focus || mission.skill === focus)
    );
    const fallback = CIVIC_MISSIONS.filter((mission) => mission.level === level);
    const pool = filtered.length > 0 ? filtered : fallback;
    return pickFreshItems(
      pool,
      Math.min(6, pool.length),
      `adrianos-content:civic:${profileId}:${level}:${focus ?? "mixed"}`,
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
    setMessage("Read the community brief. Choose the action best supported by fairness, evidence, and purpose.");
    setNewCards([]);
    setSolvedCardIds([]);
    recordPlay("civic-lab");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = CIVIC_SKILLS[current.skill];
    recordLearningAttempt({
      gameSlug: "civic-lab",
      subject: "Civics",
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
        cardId: current.cardId,
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
      setMessage(`Civic clue: ${current.hint}`);
      return;
    }

    saveAttempt(true);
    setLocked(true);
    setSolvedCardIds((ids) => ids.includes(current.cardId) ? ids : [...ids, current.cardId]);
    const points = recordedMiss ? 6 : 10;
    setScore((value) => value + points);
    setMessage(`Good civic reasoning. ${current.explanation}`);
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
      const solved = new Set(solvedCardIds);
      const unique = new Map<string, Omit<CivicToolCard, "earnedAt">>();
      for (const mission of session) {
        if (!solved.has(mission.cardId) || unique.has(mission.cardId)) continue;
        unique.set(mission.cardId, {
          id: mission.cardId,
          label: mission.cardLabel,
          emoji: mission.emoji,
        });
      }
      const result = addCivicToolCards(profileId, [...unique.values()].slice(0, 3));
      setToolbox(result.toolbox);
      setNewCards(result.added);
    }
    const xp = reviewMode ? 18 + score : 32 + score;
    const coins = reviewMode ? 3 : Math.max(7, Math.floor(score / 6));
    award("civic-lab", { xp, coins, score, completed: !reviewMode });
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
    setMessage("New community brief. Look for the purpose, evidence, rights, and trade-offs.");
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="Civic Lab">
        <section style={menuCard}>
          <div style={{ fontSize: 76 }}>🏙️</div>
          <span style={eyebrow}>30 COMMUNITY CASES · 5 CIVIC SKILLS</span>
          <h1 style={heroTitle}>Communities run on more than loud opinions.</h1>
          <p style={muted}>
            Match problems to public services, balance rights and responsibilities, make fair decisions, and check claims before sharing them.
          </p>

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
              Focus mission: <strong>{CIVIC_SKILLS[focus].label}</strong>
              <button type="button" onClick={() => setFocus(null)} style={clearButton}>Use mixed cases</button>
            </div>
          )}

          <div style={menuActions}>
            <button type="button" onClick={() => startGame(false)} style={primaryButton}>
              Start civic mission
            </button>
            {dueReviews.length > 0 && (
              <button type="button" onClick={() => startGame(true)} style={reviewButton}>
                Review {dueReviews.length} due
              </button>
            )}
          </div>

          <div style={toolboxSummary}>
            <span>🧰 {toolbox.cards.length} civic tools</span>
            <span>🏙️ {toolbox.missions} missions</span>
            <span>🏆 Best score {bestScore}</span>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Civic Lab">
        <section style={finishCard}>
          <div style={{ fontSize: 78 }}>{reviewMode ? "🧠" : "🧰"}</div>
          <span style={eyebrow}>{reviewMode ? "CIVIC REVIEW COMPLETE" : "MISSION COMPLETE"}</span>
          <h1 style={heroTitle}>{score} points</h1>
          <p style={muted}>
            {reviewMode
              ? "The exact community case will return only if the learning engine still needs stronger evidence."
              : `You solved ${session.length} community case${session.length === 1 ? "" : "s"} and added reasoning tools to your Civic Toolbox.`}
          </p>

          {!reviewMode && newCards.length > 0 && (
            <div style={newCardGrid}>
              {newCards.map((card) => (
                <div key={card.id} style={newCard}>
                  <span style={{ fontSize: 35 }}>{card.emoji}</span>
                  <strong>{card.label}</strong>
                  <span>NEW CIVIC TOOL</span>
                </div>
              ))}
            </div>
          )}

          {!reviewMode && newCards.length === 0 && (
            <p style={muted}>These tools were already saved. The mission still strengthened mastery.</p>
          )}

          <div style={menuActions}>
            <button type="button" onClick={() => startGame(reviewMode)} style={primaryButton}>
              Solve another mission
            </button>
            <Link href="/school" style={secondaryLink}>Return to School</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (!current) return null;
  const currentSkill = CIVIC_SKILLS[current.skill];
  const cardAlreadyKnown = knownCardIds.has(current.cardId);

  return (
    <GameFrame title="Civic Lab">
      <div style={gameShell}>
        <div style={statsRow}>
          <span>{reviewMode ? "Spaced review" : `Case ${index + 1} of ${session.length}`}</span>
          <span>{current.level}</span>
          <span>Score {score}</span>
        </div>

        <section style={caseCard}>
          <div style={caseHeader}>
            <div>
              <span style={smallLabel}>{missionLabel(current.skill)}</span>
              <h2 style={settingTitle}>{current.emoji} {current.setting}</h2>
            </div>
            <div style={cardTag}>
              {cardAlreadyKnown ? "IN TOOLBOX" : "CIVIC TOOL"}<br />
              <strong>{current.cardLabel}</strong>
            </div>
          </div>

          <div style={briefBox}>
            <span style={briefLabel}>COMMUNITY BRIEF</span>
            <p>{current.scene}</p>
          </div>

          <button type="button" onClick={voicePlaying ? stopSpeaking : speakCurrent} style={listenButton}>
            {voicePlaying ? "Stop reading" : "🔊 Read brief aloud"}
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
                Test the decision
              </button>
            ) : (
              <button type="button" onClick={advance} style={primaryButton}>
                {index === session.length - 1 ? "Complete the mission" : "Next case →"}
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
const eyebrow: React.CSSProperties = { color: "#7ff0c4", fontSize: 11, fontWeight: 950, letterSpacing: ".17em" };
const smallLabel: React.CSSProperties = { color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".14em" };
const heroTitle: React.CSSProperties = { margin: "12px 0", fontSize: "clamp(2.8rem,7vw,5.7rem)", lineHeight: .92, letterSpacing: "-.068em" };
const settingTitle: React.CSSProperties = { margin: "6px 0 0", fontSize: "clamp(1.65rem,4vw,2.7rem)", lineHeight: 1, letterSpacing: "-.045em" };
const questionTitle: React.CSSProperties = { margin: "12px 0 22px", fontSize: "clamp(2rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-.052em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.6 };
const recommendation: React.CSSProperties = { maxWidth: 650, margin: "22px auto", display: "grid", gap: 5, padding: 17, borderRadius: 21, background: "rgba(127,240,196,.08)", border: "1px solid rgba(127,240,196,.25)", color: "#d7fff0" };
const levelRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" };
const levelButton = (active: boolean): React.CSSProperties => ({ padding: "11px 15px", borderRadius: 999, border: `1px solid ${active ? "#7ff0c4" : "rgba(255,255,255,.14)"}`, background: active ? "rgba(127,240,196,.12)" : "#222936", color: active ? "#7ff0c4" : "#fff", fontWeight: 900, cursor: "pointer" });
const focusCard: React.CSSProperties = { maxWidth: 600, margin: "18px auto 0", padding: 13, borderRadius: 17, background: "rgba(127,220,255,.08)", color: "#d9f5ff" };
const clearButton: React.CSSProperties = { marginLeft: 10, padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", background: "transparent", color: "#fff", fontWeight: 850, cursor: "pointer" };
const menuActions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 23 };
const primaryButton: React.CSSProperties = { minHeight: 48, padding: "13px 20px", borderRadius: 999, border: 0, background: "#7ff0c4", color: "#10131b", fontSize: 16, fontWeight: 950, cursor: "pointer" };
const reviewButton: React.CSSProperties = { ...primaryButton, background: "#c6b8ff" };
const secondaryLink: React.CSSProperties = { minHeight: 48, padding: "13px 19px", borderRadius: 999, border: "1px solid rgba(127,220,255,.35)", background: "rgba(127,220,255,.1)", color: "#7fdcff", fontWeight: 950, textDecoration: "none", display: "inline-grid", placeItems: "center" };
const toolboxSummary: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 22, color: "#aab1bf", fontSize: 13, fontWeight: 850 };
const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "10px 14px", borderRadius: 17, background: "#181d28", color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const caseCard: React.CSSProperties = { padding: "clamp(22px,4vw,42px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(127,240,196,.18)", textAlign: "center" };
const caseHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", textAlign: "left", flexWrap: "wrap", marginBottom: 18 };
const cardTag: React.CSSProperties = { padding: "10px 13px", borderRadius: 16, background: "rgba(198,184,255,.1)", border: "1px solid rgba(198,184,255,.24)", color: "#dcd5ff", fontSize: 10, lineHeight: 1.45, letterSpacing: ".08em", textAlign: "right" };
const briefBox: React.CSSProperties = { marginBottom: 13, padding: "clamp(19px,4vw,30px)", borderRadius: 23, background: "#e8f2ec", color: "#1c2a24", fontFamily: "Georgia,serif", fontSize: "clamp(1.18rem,2.7vw,1.58rem)", lineHeight: 1.7, textAlign: "left" };
const briefLabel: React.CSSProperties = { display: "block", marginBottom: 8, fontFamily: "system-ui,sans-serif", fontSize: 10, fontWeight: 950, letterSpacing: ".16em", color: "#2b7155" };
const listenButton: React.CSSProperties = { margin: "0 0 20px", padding: "9px 13px", borderRadius: 999, border: "1px solid rgba(127,220,255,.28)", background: "rgba(127,220,255,.08)", color: "#7fdcff", fontWeight: 900, cursor: "pointer" };
const answerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 11 };
const answerButton = (selected: boolean, correct: boolean): React.CSSProperties => ({ minHeight: 92, padding: 16, borderRadius: 22, border: `2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background: correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color: "#fff", fontSize: 16, lineHeight: 1.35, fontWeight: 900, cursor: "pointer" });
const messageStyle: React.CSSProperties = { minHeight: 26, margin: "18px 0 0", lineHeight: 1.5, fontWeight: 850 };
const newCardGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 20 };
const newCard: React.CSSProperties = { display: "grid", gap: 6, padding: 17, borderRadius: 20, background: "rgba(127,240,196,.09)", border: "1px solid rgba(127,240,196,.24)", color: "#d7fff0", fontSize: 10, letterSpacing: ".08em" };
