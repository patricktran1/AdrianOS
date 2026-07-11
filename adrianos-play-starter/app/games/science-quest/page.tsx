"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { SCIENCE_QUESTIONS, type ScienceQuestion, type ScienceTopic } from "@/lib/adrian-content-bank";
import { pickFreshItems, shuffled } from "@/lib/adrian-content-rotation";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { getDueReviewItems, recordLearningAttempt } from "@/lib/adrian-learning";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Topic = "All" | ScienceTopic;

const ROUND_SIZE = 8;
const TOPICS: ScienceTopic[] = ["Earth", "Body", "Space", "Technology"];

export default function ScienceQuestPage() {
  const { recordPlay, award, progress } = useAdrianProgress();
  const [topic, setTopic] = useState<Topic>("All");
  const [session, setSession] = useState<ScienceQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState<ScienceQuestion[]>([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
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
    if (topic !== "All") {
      const pool = SCIENCE_QUESTIONS.filter((question) => question.topic === topic);
      return pickFreshItems(
        pool,
        ROUND_SIZE,
        `adrianos-content:science:${profileId}:${topic}`,
        (question) => question.id
      );
    }

    const balanced = TOPICS.flatMap((scienceTopic) =>
      pickFreshItems(
        SCIENCE_QUESTIONS.filter((question) => question.topic === scienceTopic),
        2,
        `adrianos-content:science:${profileId}:${scienceTopic}`,
        (question) => question.id
      )
    );
    return shuffled(balanced).slice(0, ROUND_SIZE);
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
    setChoice(null);
    setScore(0);
    setStreak(0);
    if (!useMissed) setMissed([]);
    setPlaying(true);
    setDone(false);
    setReviewMode(useMissed || usePersistent);
    recordPlay("science-quest");
  }

  function answer(value: number) {
    if (choice !== null || !current) return;
    setChoice(value);
    const isCorrect = value === current.answer;

    recordLearningAttempt({
      gameSlug: "science-quest",
      subject: "Science",
      skillId: `science-${current.topic.toLowerCase()}`,
      skillLabel: `${current.topic} science`,
      prompt: current.prompt,
      correctAnswer: current.choices[current.answer],
      correct: isCorrect,
      review: reviewMode,
      data: {
        questionId: current.id,
        topic: current.topic,
        level: current.level,
      },
    }, profileId);

    if (isCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setScore((currentScore) => currentScore + 8 + current.level * 3 + Math.min(10, nextStreak * 2));
    } else {
      setStreak(0);
      setMissed((items) => items.some((item) => item.id === current.id) ? items : [...items, current]);
    }
  }

  function next() {
    if (index < session.length - 1) {
      setIndex((value) => value + 1);
      setChoice(null);
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
          <span style={eyebrowStyle}>48 SCIENCE MISSIONS</span>
          <h1 style={titleStyle}>Choose a science world.</h1>
          <p style={mutedStyle}>
            Each round prioritizes questions this profile has not seen recently and mixes explorer, investigator, and challenge levels.
          </p>
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
    return (
      <GameFrame title="Science Quest">
        <section style={panelStyle}>
          <div style={{ fontSize: 68 }}>{missed.length === 0 ? "🏆" : "🧪"}</div>
          <span style={eyebrowStyle}>{reviewMode ? "REVIEW COMPLETE" : "QUEST COMPLETE"}</span>
          <h1 style={titleStyle}>{score} points</h1>
          <p style={mutedStyle}>
            {missed.length === 0
              ? "Perfect expedition. Every answer was correct."
              : `${missed.length} question${missed.length === 1 ? "" : "s"} scheduled for another look.`}
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
          <span>Score {score} · Streak {streak}</span>
        </div>
        <section style={panelStyle}>
          <div style={{ fontSize: 64 }}>{current.emoji}</div>
          <span style={eyebrowStyle}>{levelName.toUpperCase()} SCIENCE</span>
          <h1 style={{ ...titleStyle, fontSize: "clamp(2rem,6vw,4rem)" }}>{current.prompt}</h1>
          <div style={{ display: "grid", gap: 11 }}>
            {current.choices.map((answerText, answerIndex) => {
              const showCorrect = choice !== null && answerIndex === current.answer;
              const showWrong = choice === answerIndex && answerIndex !== current.answer;
              return (
                <button
                  key={answerText}
                  onClick={() => answer(answerIndex)}
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
          {choice !== null && (
            <div style={feedbackStyle}>
              <strong style={{ color: correct ? "#d9ff5b" : "#ffb5bf" }}>{correct ? "Correct." : "Good try."}</strong>
              <p style={mutedStyle}>{current.explanation}</p>
              <button onClick={next} style={primaryStyle}>{index === session.length - 1 ? "See Results" : "Next Question"}</button>
            </div>
          )}
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
const pillStyle = (active: boolean): React.CSSProperties => ({ padding: "11px 15px", borderRadius: 999, border: active ? "2px solid #d9ff5b" : "1px solid rgba(255,255,255,.15)", background: active ? "rgba(217,255,91,.12)" : "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" });
const statsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14, color: "#aab1bf", fontWeight: 800 };
const answerStyle: React.CSSProperties = { minHeight: 62, padding: "14px 16px", borderRadius: 17, border: "1px solid rgba(255,255,255,.13)", textAlign: "left", fontSize: 16, fontWeight: 800, cursor: "pointer" };
const feedbackStyle: React.CSSProperties = { marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.1)" };
