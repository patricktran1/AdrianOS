"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import {
  READING_SKILLS,
  READING_STORIES,
  readingQuestionById,
  readingStoryById,
  type ReadingLevel,
  type ReadingQuestion,
  type ReadingStory,
  type ReadingTheme,
} from "@/lib/adrian-reading-bank";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ThemeChoice = "All" | ReadingTheme;
type MissionItem = { storyId: string; questionId: string };

const LEVELS: ReadingLevel[] = ["Starter", "Growing", "Challenge"];
const THEMES: ReadingTheme[] = ["Animals", "Space", "Science", "Everyday", "Adventure"];
const READING_SKILL_IDS = Object.values(READING_SKILLS).map((skill) => skill.id);

function adaptiveLevel(profileId: string, age: number): ReadingLevel {
  const state = readLearningForProfile(profileId);
  const evidence = READING_SKILL_IDS
    .map((id) => state.skills[id])
    .filter((skill) => Boolean(skill));
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length > 0
    ? Math.round(evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length)
    : 0;

  if (age <= 5) return "Starter";
  if (age === 6) return mastery >= 58 && attempts >= 8 ? "Growing" : "Starter";
  if (mastery >= 72 && attempts >= 12) return "Challenge";
  return "Growing";
}

function levelDescription(level: ReadingLevel): string {
  if (level === "Starter") return "Short passages with clear details and simple sequence clues.";
  if (level === "Growing") return "Longer stories with cause, effect, vocabulary, and inference.";
  return "Rich passages that require evidence, reasoning, and stronger vocabulary.";
}

function missionFromStory(story: ReadingStory): MissionItem[] {
  return story.questions.map((question) => ({ storyId: story.id, questionId: question.id }));
}

function questionLabel(question: ReadingQuestion): string {
  if (question.skill === "detail") return "STORY DETAIL";
  if (question.skill === "sequence") return "WHAT HAPPENED WHEN";
  if (question.skill === "vocabulary") return "WORD MEANING";
  return "READ BETWEEN THE LINES";
}

export default function ReadingLabPage() {
  const { recordPlay, award, progress } = useAdrianProgress();
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggestedLevel = adaptiveLevel(profileId, profile.age);
  const [level, setLevel] = useState<ReadingLevel>(suggestedLevel);
  const [theme, setTheme] = useState<ThemeChoice>("All");
  const [session, setSession] = useState<MissionItem[]>([]);
  const [index, setIndex] = useState(0);
  const [readingStage, setReadingStage] = useState(true);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose a reading level and story world.");
  const [voicePlaying, setVoicePlaying] = useState(false);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "reading-lab");
  const currentItem = session[index] ?? null;
  const currentStory = currentItem ? readingStoryById(currentItem.storyId) : null;
  const currentQuestion = currentStory && currentItem
    ? readingQuestionById(currentStory, currentItem.questionId)
    : null;
  const bestScore = progress.games["reading-lab"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    if (LEVELS.includes(requestedLevel as ReadingLevel)) {
      setLevel(requestedLevel as ReadingLevel);
    } else {
      setLevel(adaptiveLevel(profileId, profile.age));
    }
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      startGame(true);
    }
    return () => window.speechSynthesis?.cancel();
  }, []);

  const sessionStoryCount = useMemo(
    () => new Set(session.map((item) => item.storyId)).size,
    [session]
  );

  function reviewItems(): MissionItem[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "reading-lab")
      .map((item) => {
        const storyId = typeof item.data?.storyId === "string" ? item.data.storyId : "";
        const questionId = typeof item.data?.questionId === "string" ? item.data.questionId : "";
        const story = readingStoryById(storyId);
        const question = story ? readingQuestionById(story, questionId) : null;
        const key = `${storyId}:${questionId}`;
        if (!story || !question || seen.has(key)) return null;
        seen.add(key);
        return { storyId, questionId };
      })
      .filter((item): item is MissionItem => Boolean(item))
      .slice(0, 8);
  }

  function normalItems(): MissionItem[] {
    const eligible = READING_STORIES.filter((story) =>
      story.level === level && (theme === "All" || story.theme === theme)
    );
    const fallback = READING_STORIES.filter((story) => story.level === level);
    const pool = eligible.length > 0 ? eligible : fallback;
    const stories = pickFreshItems(
      pool,
      Math.min(2, pool.length),
      `adrianos-content:reading:${profileId}:${level}:${theme}`,
      (story) => story.id
    );
    return stories.flatMap(missionFromStory);
  }

  function startGame(useReview = false) {
    const reviews = reviewItems();
    const nextSession = useReview && reviews.length > 0 ? reviews : normalItems();
    if (nextSession.length === 0) return;
    setSession(nextSession);
    setIndex(0);
    setReadingStage(true);
    setSelected("");
    setScore(0);
    setPlaying(true);
    setFinished(false);
    setLocked(false);
    setReviewMode(useReview && reviews.length > 0);
    setRecordedMiss(false);
    setMessage("Read the passage carefully. You can listen as many times as you need.");
    recordPlay("reading-lab");
  }

  function speakStory() {
    if (!currentStory || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setMessage("Read aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${currentStory.title}. ${currentStory.passage}`);
    utterance.rate = profile.age <= 5 ? 0.82 : 0.92;
    utterance.pitch = 1.04;
    utterance.onstart = () => setVoicePlaying(true);
    utterance.onend = () => setVoicePlaying(false);
    utterance.onerror = () => setVoicePlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setVoicePlaying(false);
  }

  function beginQuestions() {
    stopSpeaking();
    setReadingStage(false);
    setMessage("Use the passage as evidence. It is okay to look back.");
  }

  function saveAttempt(correct: boolean) {
    if (!currentStory || !currentQuestion) return;
    const skill = READING_SKILLS[currentQuestion.skill];
    recordLearningAttempt({
      gameSlug: "reading-lab",
      subject: "Reading",
      skillId: skill.id,
      skillLabel: skill.label,
      prompt: `${currentStory.title}: ${currentQuestion.prompt}`,
      correctAnswer: currentQuestion.answer,
      correct,
      review: reviewMode,
      data: {
        storyId: currentStory.id,
        questionId: currentQuestion.id,
        storyTitle: currentStory.title,
        level: currentStory.level,
        theme: currentStory.theme,
      },
    }, profileId);
  }

  function checkAnswer() {
    if (!currentQuestion || !selected || locked) return;
    if (selected !== currentQuestion.answer) {
      if (!recordedMiss) {
        saveAttempt(false);
        setRecordedMiss(true);
      }
      setSelected("");
      setMessage(`Story clue: ${currentQuestion.hint}`);
      return;
    }

    saveAttempt(true);
    setLocked(true);
    const points = Math.max(5, 12 - (recordedMiss ? 4 : 0));
    setScore((value) => value + points);
    setMessage(`Correct. ${currentQuestion.explanation}`);
  }

  function advance() {
    if (!locked || !currentItem) return;
    if (index >= session.length - 1) {
      const xp = reviewMode ? 16 + score : 34 + score;
      const coins = reviewMode ? 3 : Math.max(6, Math.floor(score / 7));
      award("reading-lab", { xp, coins, score, completed: !reviewMode });
      stopSpeaking();
      setPlaying(false);
      setFinished(true);
      return;
    }

    const nextIndex = index + 1;
    const nextItem = session[nextIndex];
    const storyChanged = nextItem.storyId !== currentItem.storyId;
    setIndex(nextIndex);
    setReadingStage(storyChanged);
    setSelected("");
    setLocked(false);
    setRecordedMiss(false);
    setMessage(storyChanged
      ? "A new story is ready. Read it carefully before answering."
      : "Use the same passage to solve the next question.");
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="Reading Lab">
        <section style={panel}>
          <div style={{ fontSize: 70 }}>📖</div>
          <span style={eyebrow}>15 ORIGINAL STORIES · 60 QUESTIONS</span>
          <h1 style={title}>Enter a story. Hunt for evidence.</h1>
          <p style={muted}>Reading Lab measures understanding, not how quickly a child taps. Every mission includes details, sequence, vocabulary, and inference.</p>

          <div style={suggestionCard}>
            <span style={smallLabel}>ADAPTIVE RECOMMENDATION</span>
            <strong>{suggestedLevel}</strong>
            <span>{levelDescription(suggestedLevel)}</span>
          </div>

          <h3>Reading level</h3>
          <div style={optionRow}>
            {LEVELS.map((item) => (
              <button key={item} onClick={() => setLevel(item)} style={pill(level === item)} type="button">
                {item}{item === suggestedLevel ? " · Suggested" : ""}
              </button>
            ))}
          </div>
          <p style={{ ...muted, marginTop: 8 }}>{levelDescription(level)}</p>

          <h3>Story world</h3>
          <div style={optionRow}>
            {(["All", ...THEMES] as ThemeChoice[]).map((item) => (
              <button key={item} onClick={() => setTheme(item)} style={pill(theme === item)} type="button">{item}</button>
            ))}
          </div>

          <div style={menuActions}>
            <button onClick={() => startGame(false)} style={primaryButton} type="button">Start reading mission</button>
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
      <GameFrame title="Reading Lab">
        <section style={panel}>
          <div style={{ fontSize: 76 }}>{reviewMode ? "🧠" : "🏆"}</div>
          <span style={eyebrow}>{reviewMode ? "SPACED REVIEW COMPLETE" : "READING MISSION COMPLETE"}</span>
          <h1 style={title}>{score} points</h1>
          <p style={muted}>
            {reviewMode
              ? "These exact story clues will return only if the learning engine still needs more evidence."
              : `You read ${sessionStoryCount} stor${sessionStoryCount === 1 ? "y" : "ies"} and answered ${session.length} evidence questions.`}
          </p>
          <div style={menuActions}>
            <button onClick={() => startGame(reviewMode)} style={primaryButton} type="button">Read another mission</button>
            <Link href="/school" style={secondaryLink}>Return to School</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (!currentStory || !currentQuestion) return null;

  return (
    <GameFrame title="Reading Lab">
      <div style={gameShell}>
        <div style={stats}>
          <span>{reviewMode ? "Spaced review" : `Question ${index + 1} of ${session.length}`}</span>
          <span>{currentStory.level}</span>
          <span>Score {score}</span>
        </div>

        {readingStage ? (
          <section style={readingCard}>
            <span style={eyebrow}>{currentStory.theme.toUpperCase()} STORY</span>
            <h1 style={storyTitle}>{currentStory.emoji} {currentStory.title}</h1>
            <div style={passage}>{currentStory.passage}</div>
            <div style={vocabGrid}>
              {currentStory.vocabulary.map((item) => (
                <div key={item.word} style={vocabCard}><strong>{item.word}</strong><span>{item.meaning}</span></div>
              ))}
            </div>
            <p style={messageStyle}>{message}</p>
            <div style={menuActions}>
              <button onClick={voicePlaying ? stopSpeaking : speakStory} style={secondaryButton} type="button">
                {voicePlaying ? "Stop reading" : "🔊 Read story aloud"}
              </button>
              <button onClick={beginQuestions} style={primaryButton} type="button">I finished reading →</button>
            </div>
          </section>
        ) : (
          <section style={questionCard}>
            <div style={compactPassage}>
              <div>
                <span style={smallLabel}>{currentStory.emoji} {currentStory.title.toUpperCase()}</span>
                <p>{currentStory.passage}</p>
              </div>
              <button onClick={voicePlaying ? stopSpeaking : speakStory} style={readSmallButton} type="button">
                {voicePlaying ? "Stop" : "🔊 Listen"}
              </button>
            </div>

            <span style={eyebrow}>{questionLabel(currentQuestion)}</span>
            <h1 style={questionTitle}>{currentQuestion.prompt}</h1>
            <div style={answerGrid}>
              {currentQuestion.options.map((option) => (
                <button
                  key={option}
                  onClick={() => !locked && setSelected(option)}
                  style={answerButton(selected === option, locked && option === currentQuestion.answer)}
                  disabled={locked}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <p style={{ ...messageStyle, color: locked ? "#d9ff5b" : recordedMiss ? "#ffcf83" : "#aab1bf" }}>{message}</p>
            <div style={menuActions}>
              {!locked ? (
                <button onClick={checkAnswer} style={primaryButton} disabled={!selected} type="button">Check with the passage</button>
              ) : (
                <button onClick={advance} style={primaryButton} type="button">
                  {index === session.length - 1 ? "Finish reading mission" : "Next question →"}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </GameFrame>
  );
}

const panel: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,52px)", borderRadius: 32, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const gameShell: React.CSSProperties = { width: "min(980px,100%)", margin: "0 auto" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".17em" };
const smallLabel: React.CSSProperties = { color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const title: React.CSSProperties = { margin: "13px 0", fontSize: "clamp(2.8rem,7vw,5.7rem)", lineHeight: .92, letterSpacing: "-.068em" };
const storyTitle: React.CSSProperties = { margin: "10px 0 20px", fontSize: "clamp(2.7rem,7vw,5.6rem)", lineHeight: .94, letterSpacing: "-.062em" };
const questionTitle: React.CSSProperties = { margin: "12px 0 20px", fontSize: "clamp(2rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-.052em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.6 };
const suggestionCard: React.CSSProperties = { maxWidth: 620, margin: "22px auto", display: "grid", gap: 5, padding: 16, borderRadius: 20, background: "rgba(127,220,255,.09)", border: "1px solid rgba(127,220,255,.24)", color: "#d9f5ff" };
const optionRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" };
const pill = (active: boolean): React.CSSProperties => ({ padding: "10px 14px", borderRadius: 999, border: `1px solid ${active ? "#d9ff5b" : "rgba(255,255,255,.14)"}`, background: active ? "rgba(217,255,91,.12)" : "#222936", color: active ? "#d9ff5b" : "#fff", fontWeight: 900, cursor: "pointer" });
const menuActions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 22 };
const primaryButton: React.CSSProperties = { minHeight: 48, padding: "13px 20px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontSize: 16, fontWeight: 950, cursor: "pointer" };
const reviewButton: React.CSSProperties = { ...primaryButton, background: "#c6b8ff" };
const secondaryButton: React.CSSProperties = { minHeight: 48, padding: "13px 19px", borderRadius: 999, border: "1px solid rgba(127,220,255,.35)", background: "rgba(127,220,255,.1)", color: "#7fdcff", fontWeight: 950, cursor: "pointer" };
const secondaryLink: React.CSSProperties = { ...secondaryButton, display: "inline-grid", placeItems: "center", textDecoration: "none" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "10px 14px", borderRadius: 17, background: "#181d28", color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const readingCard: React.CSSProperties = { padding: "clamp(24px,5vw,48px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(217,255,91,.22)", textAlign: "center" };
const questionCard: React.CSSProperties = { padding: "clamp(22px,4vw,40px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.1)", textAlign: "center" };
const passage: React.CSSProperties = { padding: "clamp(20px,4vw,32px)", borderRadius: 24, background: "#f5efd9", color: "#20231f", fontFamily: "Georgia,serif", fontSize: "clamp(1.25rem,3vw,1.72rem)", lineHeight: 1.75, textAlign: "left" };
const compactPassage: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "start", marginBottom: 24, padding: 18, borderRadius: 22, background: "#f5efd9", color: "#20231f", textAlign: "left", fontFamily: "Georgia,serif", lineHeight: 1.6 };
const readSmallButton: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(32,35,31,.2)", background: "#fff", color: "#20231f", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
const vocabGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 9, marginTop: 14 };
const vocabCard: React.CSSProperties = { display: "grid", gap: 4, padding: 13, borderRadius: 17, background: "rgba(198,184,255,.1)", border: "1px solid rgba(198,184,255,.24)", color: "#dcd5ff", textAlign: "left" };
const answerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 11 };
const answerButton = (selected: boolean, correct: boolean): React.CSSProperties => ({ minHeight: 88, padding: 16, borderRadius: 22, border: `2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background: correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color: "#fff", fontSize: 17, fontWeight: 900, cursor: "pointer" });
const messageStyle: React.CSSProperties = { minHeight: 25, margin: "18px 0 0", color: "#aab1bf", lineHeight: 1.5, fontWeight: 850 };
