"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { SCIENCE_QUESTIONS, type ScienceQuestion, type ScienceTopic } from "@/lib/adrian-content-bank";
import { pickFreshItems, shuffled } from "@/lib/adrian-content-rotation";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import {
  classifyResponse,
  responsePoints,
  responseQualityLabel,
  scienceTopicHint,
  type ResponseQuality,
} from "@/lib/adrian-teaching-loop";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Topic = "All" | ScienceTopic;
type FeedbackStage = "question" | "hint" | "explanation";

const ROUND_SIZE = 8;
const TOPICS: ScienceTopic[] = ["Earth", "Body", "Space", "Technology"];

function targetLevel(profileId: string, topic: ScienceTopic): 1 | 2 | 3 {
  const skill = readLearningForProfile(profileId).skills[`science-${topic.toLowerCase()}`];
  if (!skill || skill.attempts < 3 || skill.mastery < 42) return 1;
  if (skill.mastery < 74 || skill.attempts < 8) return 2;
  return 3;
}

function adaptiveTopicQuestions(profileId: string, topic: ScienceTopic, count: number): ScienceQuestion[] {
  const level = targetLevel(profileId, topic);
  const exact = SCIENCE_QUESTIONS.filter((question) => question.topic === topic && question.level === level);
  const adjacent = SCIENCE_QUESTIONS.filter(
    (question) => question.topic === topic && Math.abs(question.level - level) <= 1
  );
  const pool = exact.length >= count ? exact : adjacent.length >= count ? adjacent : SCIENCE_QUESTIONS.filter((question) => question.topic === topic);
  return pickFreshItems(
    pool,
    Math.min(count, pool.length),
    `adrianos-content:science:${profileId}:${topic}:level-${level}`,
    (question) => question.id
  );
}

export default function ScienceQuestPage() {
  const { recordPlay, award, progress } = useAdrianProgress();
  const [topic, setTopic] = useState<Topic>("All");
  const [session, setSession] = useState<ScienceQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [missed, setMissed] = useState<ScienceQuestion[]>([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [feedbackStage, setFeedbackStage] = useState<FeedbackStage>("question");
  const [quality, setQuality] = useState<ResponseQuality | null>(null);
  const [message, setMessage] = useState("Choose the answer that best fits the evidence.");
  const autoStarted = useRef(false);
  const profileId = getActiveProfile().id;
  const dueReviews = getDueReviewItems(profileId, "science-quest");

  const current = session[index];
  const bestScore = progress.games["science-quest"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTopic = params.get("topic");
    if (TOPICS.includes(requestedTopic as ScienceTopic)) {
      setTopic(requestedTopic as ScienceTopic);
    }
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      startGame(false, true);
    }
  }, []);

  function normalQuestions(): ScienceQuestion[] {
    if (topic !== "All") return adaptiveTopicQuestions(profileId, topic, ROUND_SIZE);
    const balanced = TOPICS.flatMap((scienceTopic) => adaptiveTopicQuestions(profileId, scienceTopic, 2));
    return shuffled(balanced).slice(0, ROUND_SIZE);
  }

  function resetQuestionState() {
    setChoice(null);
    setWrongAttempts(0);
    setUsedHint(false);
    setFeedbackStage("question");
    setQuality(null);
    setMessage("Choose the answer that best fits the evidence.");
  }

  function startGame(useMissed = false, usePersistent = false) {
    const persistentPrompts = new Set(
      getDueReviewItems(profileId, "science-quest").map((item) => item.prompt)
    );
    const selected = usePersistent
      ? SCIENCE_QUESTIONS.filter((question) => persistentPrompts.has(question.prompt)).slice(0, ROUND_SIZE)
      : useMissed
        ? [...missed].slice(0, ROUND_SIZE)
        : normalQuestions();
    if (selected.length === 0) return;

    setSession(selected);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setFirstTryCorrect(0);
    if (!useMissed) setMissed([]);
    setPlaying(true);
    setDone(false);
    setReviewMode(useMissed || usePersistent);
    resetQuestionState();
    recordPlay("science-quest");
  }

  function saveAttempt(question: ScienceQuestion, correct: boolean) {
    recordLearningAttempt({
      gameSlug: "science-quest",
      subject: "Science",
      skillId: `science-${question.topic.toLowerCase()}`,
      skillLabel: `${question.topic} science`,
      prompt: question.prompt,
      correctAnswer: question.choices[question.answer],
      correct,
      review: reviewMode,
      data: {
        questionId: question.id,
        topic: question.topic,
        level: question.level,
        usedHint,
        wrongAttempts,
      },
    }, profileId);
  }

  function rememberMiss(question: ScienceQuestion) {
    setMissed((items) => items.some((item) => item.id === question.id) ? items : [...items, question]);
  }

  function showHint() {
    if (!current || feedbackStage === "explanation") return;
    setUsedHint(true);
    setFeedbackStage("hint");
    setMessage(scienceTopicHint(current.topic));
  }

  function answer(value: number) {
    if (!current || feedbackStage === "explanation") return;
    if (choice === value && value !== current.answer) return;
    setChoice(value);
    const isCorrect = value === current.answer;

    if (!isCorrect && wrongAttempts === 0) {
      saveAttempt(current, false);
      rememberMiss(current);
      setWrongAttempts(1);
      setUsedHint(true);
      setStreak(0);
      setFeedbackStage("hint");
      setMessage(scienceTopicHint(current.topic));
      return;
    }

    if (!isCorrect) {
      const nextQuality = classifyResponse({ correct: false, wrongAttempts: wrongAttempts + 1, usedHint: true });
      setWrongAttempts((attempts) => attempts + 1);
      rememberMiss(current);
      setQuality(nextQuality);
      setStreak(0);
      setFeedbackStage("explanation");
      setMessage(`The strongest answer is “${current.choices[current.answer]}.” ${current.explanation}`);
      return;
    }

    saveAttempt(current, true);
    const nextQuality = classifyResponse({ correct: true, wrongAttempts, usedHint });
    const nextStreak = nextQuality === "first-try" ? streak + 1 : 0;
    const points = responsePoints(8 + current.level * 3 + Math.min(10, nextStreak * 2), nextQuality);
    setScore((currentScore) => currentScore + points);
    setStreak(nextStreak);
    if (nextQuality === "first-try") setFirstTryCorrect((count) => count + 1);
    setQuality(nextQuality);
    setFeedbackStage("explanation");
    setMessage(`${responseQualityLabel(nextQuality)}. +${points} points. ${current.explanation}`);
  }

  function next() {
    if (feedbackStage !== "explanation") return;
    if (index < session.length - 1) {
      setIndex((value) => value + 1);
      resetQuestionState();
      return;
    }

    const xp = reviewMode ? 10 + Math.floor(score / 3) : 35 + Math.floor(score / 2);
    const coins = reviewMode ? 2 : Math.max(5, Math.floor(score / 18));
    award("science-quest", { xp, coins, score, completed: !reviewMode });
    setPlaying(false);
    setDone(true);
  }

  if (!playing && !done) {
    return (
      <GameFrame title="Science Quest">
        <section style={panelStyle}>
          <div style={{ fontSize: 68 }}>🔬</div>
          <span style={eyebrowStyle}>ADAPTIVE SCIENCE MISSIONS</span>
          <h1 style={titleStyle}>Choose a science world.</h1>
          <p style={mutedStyle}>
            Each topic now starts near this learner’s current mastery. A first miss opens a clue and a retry; the explanation appears before the next question.
          </p>
          <div style={levelGrid}>
            {TOPICS.map((scienceTopic) => (
              <div key={scienceTopic} style={levelCard}>
                <small>{scienceTopic.toUpperCase()}</small>
                <strong>Level {targetLevel(profileId, scienceTopic)}</strong>
              </div>
            ))}
          </div>
          <div style={optionRowStyle}>
            {(["All", ...TOPICS] as Topic[]).map((item) => (
              <button key={item} onClick={() => setTopic(item)} style={pillStyle(topic === item)}>{item}</button>
            ))}
          </div>
          <button onClick={() => startGame(false, false)} style={primaryStyle}>Launch Quest</button>
          {dueReviews.length > 0 && (
            <button onClick={() => startGame(false, true)} style={{ ...primaryStyle, marginLeft: 10, background: "#c6b8ff", borderColor: "#c6b8ff" }}>
              Review {dueReviews.length} Due
            </button>
          )}
          <p style={mutedStyle}>Personal best: {bestScore}</p>
        </section>
      </GameFrame>
    );
  }

  if (done) {
    const firstTryAccuracy = session.length > 0 ? Math.round((firstTryCorrect / session.length) * 100) : 0;
    return (
      <GameFrame title="Science Quest">
        <section style={panelStyle}>
          <div style={{ fontSize: 68 }}>{missed.length === 0 ? "🏆" : "🧪"}</div>
          <span style={eyebrowStyle}>{reviewMode ? "REVIEW COMPLETE" : "QUEST COMPLETE"}</span>
          <h1 style={titleStyle}>{score} points</h1>
          <div style={resultGrid}>
            <div><small>FIRST TRY</small><strong>{firstTryAccuracy}%</strong></div>
            <div><small>REVIEW QUEUE</small><strong>{missed.length}</strong></div>
            <div><small>BEST</small><strong>{Math.max(bestScore, score)}</strong></div>
          </div>
          <p style={mutedStyle}>
            {missed.length === 0
              ? "Every question was solved independently. The next fresh quest can raise the challenge."
              : `${missed.length} question${missed.length === 1 ? " is" : "s are"} saved for another look. Supported solves still count as learning.`}
          </p>
          <div style={optionRowStyle}>
            {missed.length > 0 && !reviewMode && <button onClick={() => startGame(true, false)} style={primaryStyle}>Review Missed Questions</button>}
            <button onClick={() => startGame(false, false)} style={primaryStyle}>New Fresh Quest</button>
            <Link href="/" style={secondaryLinkStyle}>Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  const correct = choice !== null && choice === current.answer;
  const levelName = current.level === 1 ? "Explorer" : current.level === 2 ? "Investigator" : "Challenge";

  return (
    <GameFrame title="Science Quest">
      <div style={{ width: "min(840px,100%)", margin: "0 auto" }}>
        <div style={statsStyle}>
          <span>{reviewMode ? "Spaced Review" : current.topic}</span>
          <span>{levelName} · Question {index + 1} of {session.length}</span>
          <span>Score {score} · Independent streak {streak}</span>
        </div>
        <section style={panelStyle}>
          <div style={{ fontSize: 64 }}>{current.emoji}</div>
          <span style={eyebrowStyle}>{levelName.toUpperCase()} SCIENCE</span>
          <h1 style={{ ...titleStyle, fontSize: "clamp(2rem,6vw,4rem)" }}>{current.prompt}</h1>
          <div style={{ display: "grid", gap: 11 }}>
            {current.choices.map((answerText, answerIndex) => {
              const showCorrect = feedbackStage === "explanation" && answerIndex === current.answer;
              const showWrong = choice === answerIndex && answerIndex !== current.answer;
              return (
                <button
                  key={answerText}
                  onClick={() => answer(answerIndex)}
                  disabled={feedbackStage === "explanation" || showWrong}
                  style={{
                    ...answerStyle,
                    background: showCorrect ? "#d9ff5b" : showWrong ? "#ffb5bf" : "#222936",
                    color: showCorrect || showWrong ? "#10131b" : "#fff",
                  }}
                >
                  <strong>{String.fromCharCode(65 + answerIndex)}</strong> {answerText}
                </button>
              );
            })}
          </div>

          <div style={feedbackStyle} aria-live="polite">
            <div>
              <small style={feedbackLabel}>{feedbackStage === "question" ? "THINK LIKE A SCIENTIST" : feedbackStage === "hint" ? "CLUE" : quality ? responseQualityLabel(quality).toUpperCase() : "EXPLANATION"}</small>
              <p style={mutedStyle}>{message}</p>
            </div>
            {feedbackStage === "question" ? (
              <button type="button" onClick={showHint} style={hintStyle}>Show a clue</button>
            ) : feedbackStage === "hint" ? (
              <span style={retryStyle}>Use the clue and choose again.</span>
            ) : (
              <button onClick={next} style={primaryStyle}>{index === session.length - 1 ? "See Results" : "Next Question"}</button>
            )}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}

const panelStyle: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const eyebrowStyle: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const titleStyle: React.CSSProperties = { margin: "14px 0", fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: .96, letterSpacing: "-.06em" };
const mutedStyle: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const optionRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "18px 0" };
const primaryStyle: React.CSSProperties = { padding: "13px 20px", border: "2px solid #d9ff5b", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, background: "#fff", color: "#10131b", fontWeight: 950, textDecoration: "none" };
const statsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, color: "#aab1bf", fontSize: 13, fontWeight: 850 };
const answerStyle: React.CSSProperties = { minHeight: 66, borderRadius: 18, border: "1px solid rgba(255,255,255,.13)", padding: "14px 16px", textAlign: "left", fontSize: 17, cursor: "pointer" };
const feedbackStyle: React.CSSProperties = { marginTop: 20, padding: 18, borderRadius: 20, border: "1px solid rgba(127,220,255,.25)", background: "#10131b", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center", textAlign: "left" };
const feedbackLabel: React.CSSProperties = { color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".14em" };
const hintStyle: React.CSSProperties = { padding: "12px 16px", borderRadius: 999, border: "1px solid rgba(127,220,255,.35)", background: "rgba(127,220,255,.1)", color: "#7fdcff", fontWeight: 950, cursor: "pointer" };
const retryStyle: React.CSSProperties = { maxWidth: 170, color: "#c6b8ff", fontSize: 12, fontWeight: 850, lineHeight: 1.4 };
const levelGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, margin: "22px 0" };
const levelCard: React.CSSProperties = { display: "grid", gap: 5, padding: 12, borderRadius: 16, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const resultGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 9, margin: "22px 0" };
const pillStyle = (active: boolean): React.CSSProperties => ({ padding: "10px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: active ? "#d9ff5b" : "#222936", color: active ? "#10131b" : "#fff", fontWeight: 900, cursor: "pointer" });
