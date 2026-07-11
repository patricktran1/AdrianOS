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
  WORLD_MISSIONS,
  WORLD_SKILLS,
  worldMissionById,
  type WorldLevel,
  type WorldMission,
  type WorldSkill,
} from "@/lib/adrian-world-bank";
import {
  addWorldPassportStamps,
  readWorldPassport,
  type PassportStamp,
} from "@/lib/adrian-world-passport";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: WorldLevel[] = ["Navigator", "Explorer", "World Builder"];
const SKILLS = Object.entries(WORLD_SKILLS) as Array<[WorldSkill, (typeof WORLD_SKILLS)[WorldSkill]]>;

function adaptiveLevel(profileId: string, age: number): WorldLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(WORLD_SKILLS)
    .map((skill) => learning.skills[skill.id])
    .filter((skill) => Boolean(skill));
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length > 0
    ? Math.round(evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length)
    : 0;

  if (age <= 5) return "Navigator";
  if (age <= 7) return mastery >= 70 && attempts >= 12 ? "World Builder" : "Explorer";
  return mastery >= 48 || attempts >= 8 ? "World Builder" : "Explorer";
}

function levelDescription(level: WorldLevel): string {
  if (level === "Navigator") return "Directions, symbols, major landforms, and community basics.";
  if (level === "Explorer") return "Map scale, regions, perspective, settlement, and adaptation.";
  return "Coordinates, watersheds, population, sources, planning, and sustainability.";
}

function focusFromSkillId(value: string | null): WorldSkill | null {
  if (!value) return null;
  const row = SKILLS.find(([, skill]) => skill.id === value);
  return row?.[0] ?? null;
}

export default function WorldExplorerPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggestedLevel = adaptiveLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<WorldLevel>(suggestedLevel);
  const [focus, setFocus] = useState<WorldSkill | null>(null);
  const [session, setSession] = useState<WorldMission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose an expedition level.");
  const [passport, setPassport] = useState(() => readWorldPassport(profileId));
  const [newStamps, setNewStamps] = useState<PassportStamp[]>([]);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "world-explorer");
  const current = session[index] ?? null;
  const bestScore = progress.games["world-explorer"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    const requestedFocus = focusFromSkillId(params.get("focus"));
    if (LEVELS.includes(requestedLevel as WorldLevel)) setLevel(requestedLevel as WorldLevel);
    setFocus(requestedFocus);
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
    return () => window.speechSynthesis?.cancel();
  }, []);

  const collectedStampIds = useMemo(
    () => new Set(passport.stamps.map((stamp) => stamp.id)),
    [passport]
  );

  function reviewItems(): WorldMission[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "world-explorer")
      .map((item) => {
        const missionId = typeof item.data?.missionId === "string" ? item.data.missionId : "";
        if (!missionId || seen.has(missionId)) return null;
        const mission = worldMissionById(missionId);
        if (!mission) return null;
        seen.add(missionId);
        return mission;
      })
      .filter((mission): mission is WorldMission => Boolean(mission))
      .slice(0, 8);
  }

  function normalItems(): WorldMission[] {
    const filtered = WORLD_MISSIONS.filter((mission) =>
      mission.level === level && (!focus || mission.skill === focus)
    );
    const fallback = WORLD_MISSIONS.filter((mission) => mission.level === level);
    const pool = filtered.length > 0 ? filtered : fallback;
    return pickFreshItems(
      pool,
      Math.min(6, pool.length),
      `adrianos-content:world:${profileId}:${level}:${focus ?? "mixed"}`,
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
    setNewStamps([]);
    setMessage("Study the field note, then use its evidence.");
    recordPlay("world-explorer");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = WORLD_SKILLS[current.skill];
    recordLearningAttempt({
      gameSlug: "world-explorer",
      subject: "Geography",
      skillId: skill.id,
      skillLabel: skill.label,
      prompt: `${current.place}: ${current.prompt}`,
      correctAnswer: current.answer,
      correct,
      review: reviewMode,
      data: {
        missionId: current.id,
        level: current.level,
        place: current.place,
        stampId: current.stampId,
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
      setMessage(`Explorer clue: ${current.hint}`);
      return;
    }

    saveAttempt(true);
    setLocked(true);
    const points = recordedMiss ? 6 : 10;
    setScore((value) => value + points);
    setMessage(`Correct. ${current.explanation}`);
  }

  function speakCurrent() {
    if (!current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setMessage("Read aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${current.place}. ${current.scene}. ${current.prompt}`);
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

  function finishExpedition() {
    stopSpeaking();
    if (!reviewMode) {
      const unique = new Map<string, Omit<PassportStamp, "earnedAt">>();
      for (const mission of session) {
        if (!unique.has(mission.stampId)) {
          unique.set(mission.stampId, {
            id: mission.stampId,
            label: mission.stampLabel,
            emoji: mission.emoji,
          });
        }
      }
      const result = addWorldPassportStamps(profileId, [...unique.values()].slice(0, 3));
      setPassport(result.passport);
      setNewStamps(result.added);
    }
    const xp = reviewMode ? 18 + score : 30 + score;
    const coins = reviewMode ? 3 : Math.max(7, Math.floor(score / 6));
    award("world-explorer", { xp, coins, score, completed: !reviewMode });
    setPlaying(false);
    setFinished(true);
  }

  function advance() {
    if (!locked) return;
    if (index >= session.length - 1) {
      finishExpedition();
      return;
    }
    stopSpeaking();
    setIndex((value) => value + 1);
    setSelected("");
    setLocked(false);
    setRecordedMiss(false);
    setMessage("New field note. Find the clue that matters.");
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="World Explorer">
        <section style={menuCard}>
          <div style={{ fontSize: 76 }}>🌍</div>
          <span style={eyebrow}>30 MISSIONS · 5 GEOGRAPHY SKILLS</span>
          <h1 style={heroTitle}>The world is more than landmark trivia.</h1>
          <p style={muted}>Read maps, compare regions, understand communities, and solve how people live with the environments around them.</p>

          <div style={recommendation}>
            <span style={smallLabel}>ADAPTIVE RECOMMENDATION</span>
            <strong>{suggestedLevel}</strong>
            <span>{levelDescription(suggestedLevel)}</span>
          </div>

          <h3>Expedition level</h3>
          <div style={pillRow}>
            {LEVELS.map((item) => (
              <button key={item} onClick={() => setLevel(item)} style={pill(level === item)} type="button">
                {item}{item === suggestedLevel ? " · Suggested" : ""}
              </button>
            ))}
          </div>
          <p style={{ ...muted, marginTop: 8 }}>{levelDescription(level)}</p>

          <h3>Expedition focus</h3>
          <div style={pillRow}>
            <button onClick={() => setFocus(null)} style={pill(focus === null)} type="button">Mixed world tour</button>
            {SKILLS.map(([key, skill]) => (
              <button key={key} onClick={() => setFocus(key)} style={pill(focus === key)} type="button">{skill.label}</button>
            ))}
          </div>

          <div style={passportCard}>
            <div>
              <span style={smallLabel}>WORLD PASSPORT</span>
              <strong style={{ display: "block", fontSize: 28 }}>{passport.stamps.length} stamps</strong>
              <span style={muted}>{passport.expeditions} expedition{passport.expeditions === 1 ? "" : "s"} completed</span>
            </div>
            <div style={stampPreview}>
              {passport.stamps.slice(-8).map((stamp) => <span key={stamp.id} title={stamp.label}>{stamp.emoji}</span>)}
              {passport.stamps.length === 0 && <span style={muted}>Your first stamps are waiting.</span>}
            </div>
          </div>

          <div style={actionRow}>
            <button onClick={() => startGame(false)} style={primaryButton} type="button">Start expedition</button>
            {dueReviews.length > 0 && (
              <button onClick={() => startGame(true)} style={reviewButton} type="button">Review {dueReviews.length} due</button>
            )}
          </div>
          <p style={muted}>Personal best: {bestScore}</p>
        </section>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="World Explorer">
        <section style={finishCard}>
          <div style={{ fontSize: 82 }}>{reviewMode ? "🧠" : "🛂"}</div>
          <span style={eyebrow}>{reviewMode ? "REVIEW EXPEDITION COMPLETE" : "PASSPORT CHECKPOINT"}</span>
          <h1 style={heroTitle}>{score} points</h1>
          <p style={muted}>
            {reviewMode
              ? "The exact clues will return again only if more evidence is still needed."
              : `You completed ${session.length} world stops and added ${newStamps.length} new passport stamp${newStamps.length === 1 ? "" : "s"}.`}
          </p>

          {newStamps.length > 0 && (
            <div style={newStampGrid}>
              {newStamps.map((stamp) => (
                <div key={stamp.id} style={newStampCard}>
                  <span style={{ fontSize: 42 }}>{stamp.emoji}</span>
                  <strong>{stamp.label}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={actionRow}>
            <button onClick={() => startGame(reviewMode)} style={primaryButton} type="button">Another expedition</button>
            <Link href="/school" style={secondaryLink}>Return to School</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (!current) return null;
  const skill = WORLD_SKILLS[current.skill];

  return (
    <GameFrame title="World Explorer">
      <div style={gameShell}>
        <div style={statsRow}>
          <span>{reviewMode ? "Spaced review" : `Stop ${index + 1} of ${session.length}`}</span>
          <span>{current.level}</span>
          <span>Score {score}</span>
        </div>

        <section style={missionCard}>
          <div style={missionHeader}>
            <div style={locationIcon}>{current.emoji}</div>
            <div>
              <span style={smallLabel}>{skill.label.toUpperCase()}</span>
              <h2 style={placeTitle}>{current.place}</h2>
            </div>
            <div style={stampStatus} title={current.stampLabel}>
              {collectedStampIds.has(current.stampId) ? "STAMPED" : "NEW STAMP"}
            </div>
          </div>

          <div style={fieldNote}>
            <span style={fieldLabel}>FIELD NOTE</span>
            <p>{current.scene}</p>
          </div>

          <h1 style={questionTitle}>{current.prompt}</h1>
          <button onClick={voicePlaying ? stopSpeaking : speakCurrent} style={listenButton} type="button">
            {voicePlaying ? "Stop reading" : "🔊 Read field note aloud"}
          </button>

          <div style={answerGrid}>
            {current.options.map((option) => (
              <button
                key={option}
                onClick={() => !locked && setSelected(option)}
                disabled={locked}
                style={answerButton(selected === option, locked && option === current.answer)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>

          <p style={{ ...messageStyle, color: locked ? "#d9ff5b" : recordedMiss ? "#ffcf83" : "#aab1bf" }}>{message}</p>
          <div style={actionRow}>
            {!locked ? (
              <button onClick={checkAnswer} disabled={!selected} style={primaryButton} type="button">Check the evidence</button>
            ) : (
              <button onClick={advance} style={primaryButton} type="button">
                {index === session.length - 1 ? "Finish expedition" : "Next world stop →"}
              </button>
            )}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}

const menuCard: React.CSSProperties = { width: "min(960px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,52px)", borderRadius: 32, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const gameShell: React.CSSProperties = { width: "min(960px,100%)", margin: "0 auto" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".17em" };
const smallLabel: React.CSSProperties = { color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const heroTitle: React.CSSProperties = { margin: "13px 0", fontSize: "clamp(2.8rem,7vw,5.7rem)", lineHeight: .92, letterSpacing: "-.068em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.6 };
const recommendation: React.CSSProperties = { maxWidth: 630, margin: "22px auto", display: "grid", gap: 5, padding: 16, borderRadius: 20, background: "rgba(127,220,255,.09)", border: "1px solid rgba(127,220,255,.24)", color: "#d9f5ff" };
const pillRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" };
const pill = (active: boolean): React.CSSProperties => ({ padding: "10px 14px", borderRadius: 999, border: `1px solid ${active ? "#d9ff5b" : "rgba(255,255,255,.14)"}`, background: active ? "rgba(217,255,91,.12)" : "#222936", color: active ? "#d9ff5b" : "#fff", fontWeight: 900, cursor: "pointer" });
const passportCard: React.CSSProperties = { maxWidth: 760, margin: "24px auto 0", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(220px,1fr)", gap: 18, alignItems: "center", padding: 20, borderRadius: 24, background: "linear-gradient(145deg,rgba(198,184,255,.11),rgba(127,220,255,.07))", border: "1px solid rgba(198,184,255,.28)", textAlign: "left" };
const stampPreview: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", fontSize: 29 };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 22 };
const primaryButton: React.CSSProperties = { minHeight: 48, padding: "13px 20px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontSize: 16, fontWeight: 950, cursor: "pointer" };
const reviewButton: React.CSSProperties = { ...primaryButton, background: "#c6b8ff" };
const secondaryLink: React.CSSProperties = { minHeight: 48, padding: "13px 19px", display: "inline-grid", placeItems: "center", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", textDecoration: "none", fontWeight: 950 };
const finishCard: React.CSSProperties = { width: "min(850px,100%)", margin: "0 auto", padding: "clamp(30px,6vw,64px)", borderRadius: 32, background: "#181d28", border: "1px solid rgba(217,255,91,.25)", textAlign: "center" };
const newStampGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 22 };
const newStampCard: React.CSSProperties = { display: "grid", gap: 8, justifyItems: "center", padding: 17, borderRadius: 20, background: "rgba(217,255,91,.09)", border: "1px solid rgba(217,255,91,.24)" };
const statsRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "10px 14px", borderRadius: 17, background: "#181d28", color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const missionCard: React.CSSProperties = { padding: "clamp(22px,5vw,46px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.1)", textAlign: "center" };
const missionHeader: React.CSSProperties = { display: "grid", gridTemplateColumns: "72px minmax(0,1fr) auto", gap: 15, alignItems: "center", textAlign: "left", marginBottom: 18 };
const locationIcon: React.CSSProperties = { width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: 20, background: "rgba(127,220,255,.11)", fontSize: 38 };
const placeTitle: React.CSSProperties = { margin: "4px 0 0", fontSize: "clamp(1.9rem,5vw,3rem)", letterSpacing: "-.045em" };
const stampStatus: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "rgba(198,184,255,.11)", border: "1px solid rgba(198,184,255,.28)", color: "#c6b8ff", fontSize: 10, fontWeight: 950, letterSpacing: ".1em", whiteSpace: "nowrap" };
const fieldNote: React.CSSProperties = { padding: "clamp(18px,4vw,28px)", borderRadius: 24, background: "#f2ead1", color: "#22251f", fontFamily: "Georgia,serif", fontSize: "clamp(1.15rem,2.7vw,1.55rem)", lineHeight: 1.65, textAlign: "left" };
const fieldLabel: React.CSSProperties = { color: "#6d5f35", fontFamily: "system-ui,sans-serif", fontSize: 10, fontWeight: 950, letterSpacing: ".16em" };
const questionTitle: React.CSSProperties = { margin: "24px 0 12px", fontSize: "clamp(2rem,5vw,3.9rem)", lineHeight: 1, letterSpacing: "-.052em" };
const listenButton: React.CSSProperties = { marginBottom: 18, padding: "9px 13px", borderRadius: 999, border: "1px solid rgba(127,220,255,.3)", background: "rgba(127,220,255,.09)", color: "#7fdcff", fontWeight: 900, cursor: "pointer" };
const answerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 11 };
const answerButton = (selected: boolean, correct: boolean): React.CSSProperties => ({ minHeight: 88, padding: 16, borderRadius: 22, border: `2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background: correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color: "#fff", fontSize: 17, fontWeight: 900, cursor: "pointer" });
const messageStyle: React.CSSProperties = { minHeight: 25, margin: "18px 0 0", lineHeight: 1.5, fontWeight: 850 };
