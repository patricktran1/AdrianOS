"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { getDueReviewItems, recordLearningAttempt, type ReviewItem } from "@/lib/adrian-learning";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "mission" | "timer" | "daily" | "review";
type Topic = "mixed" | "addition" | "subtraction" | "money" | "word-problems";
type Screen = "menu" | "play" | "results";
type ProblemKind = "equation" | "missing" | "story";

type Problem = {
  left: number;
  right: number;
  operator: "+" | "−";
  answer: number;
  money: boolean;
  kind: ProblemKind;
  prompt: string;
  missingSide?: "left" | "right";
};

const GAME_SLUG = "math-blast";
const MISSION_LENGTH = 10;
const DAILY_LENGTH = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function formatValue(value: number, money: boolean) {
  return money ? `$${(value / 100).toFixed(2)}` : String(value);
}

function arithmeticValues(topic: "addition" | "subtraction" | "money", difficulty: number, random: () => number) {
  if (topic === "money") {
    const maxCents = 100 + difficulty * 75;
    const left = (Math.floor(random() * Math.max(2, Math.floor(maxCents / 5))) + 1) * 5;
    const subtract = random() > 0.55;
    const rightLimit = subtract ? left : maxCents;
    const right = Math.floor(random() * Math.max(1, Math.floor(rightLimit / 5) + 1)) * 5;
    return { left, right, operator: subtract ? "−" as const : "+" as const, money: true };
  }

  const max = 10 + difficulty * 12;
  if (topic === "subtraction") {
    const left = Math.floor(random() * max) + 1;
    const right = Math.floor(random() * (left + 1));
    return { left, right, operator: "−" as const, money: false };
  }

  return {
    left: Math.floor(random() * max),
    right: Math.floor(random() * max),
    operator: "+" as const,
    money: false,
  };
}

function makeStoryProblem(difficulty: number, random: () => number): Problem {
  const addition = random() > 0.45;
  const max = 10 + difficulty * 10;
  const names = ["Adrian", "Elliot", "Maya", "Leo", "Nora", "Kai"];
  const objects = ["shells", "stickers", "blocks", "marbles", "books", "toy cars", "berries", "stars"];
  const name = names[Math.floor(random() * names.length)];
  const object = objects[Math.floor(random() * objects.length)];

  if (addition) {
    const left = Math.floor(random() * max) + 1;
    const right = Math.floor(random() * max) + 1;
    return {
      left,
      right,
      operator: "+",
      answer: left + right,
      money: false,
      kind: "story",
      prompt: `${name} has ${left} ${object} and gets ${right} more. How many ${object} are there now? ${left} + ${right} = ?`,
    };
  }

  const left = Math.floor(random() * max) + Math.max(3, difficulty);
  const right = Math.floor(random() * (left + 1));
  return {
    left,
    right,
    operator: "−",
    answer: left - right,
    money: false,
    kind: "story",
    prompt: `${name} has ${left} ${object} and gives away ${right}. How many ${object} remain? ${left} − ${right} = ?`,
  };
}

function chooseMixedTopic(random: () => number): Exclude<Topic, "mixed"> {
  const roll = random();
  if (roll < 0.3) return "addition";
  if (roll < 0.58) return "subtraction";
  if (roll < 0.78) return "word-problems";
  return "money";
}

function makeProblem(topic: Topic, difficulty: number, random = Math.random): Problem {
  const selectedTopic = topic === "mixed" ? chooseMixedTopic(random) : topic;
  if (selectedTopic === "word-problems") return makeStoryProblem(difficulty, random);

  const values = arithmeticValues(selectedTopic, difficulty, random);
  const total = values.operator === "+" ? values.left + values.right : values.left - values.right;
  const useMissing = !values.money && difficulty >= 2 && random() < 0.35;

  if (useMissing) {
    const missingSide = values.operator === "+" && random() > 0.5 ? "left" : "right";
    const answer = missingSide === "left" ? values.left : values.right;
    const prompt = missingSide === "left"
      ? `? ${values.operator} ${values.right} = ${total}`
      : `${values.left} ${values.operator} ? = ${total}`;
    return { ...values, answer, kind: "missing", prompt, missingSide };
  }

  return {
    ...values,
    answer: total,
    kind: "equation",
    prompt: `${formatValue(values.left, values.money)} ${values.operator} ${formatValue(values.right, values.money)}`,
  };
}

function makeChoices(problem: Problem, random = Math.random): number[] {
  const choices = new Set<number>([problem.answer]);
  const step = problem.money ? 5 : 1;
  const spread = problem.money ? 8 : Math.max(5, Math.ceil(problem.answer / 5));

  while (choices.size < 4) {
    let offset = Math.floor(random() * (spread * 2 + 1)) - spread;
    if (offset === 0) offset = spread;
    choices.add(Math.max(0, problem.answer + offset * step));
  }

  return Array.from(choices).sort(() => random() - 0.5);
}

function problemKey(problem: Problem) {
  return `${problem.kind}:${problem.prompt}:${problem.answer}`;
}

function problemFromReview(item: ReviewItem): Problem | null {
  const left = item.data?.left;
  const right = item.data?.right;
  const operator = item.data?.operator;
  const money = item.data?.money;
  if (typeof left !== "number" || typeof right !== "number") return null;
  if (operator !== "+" && operator !== "−") return null;
  const kind = item.data?.kind === "missing" || item.data?.kind === "story" ? item.data.kind : "equation";
  const storedAnswer = item.data?.answer;
  const answer = typeof storedAnswer === "number"
    ? storedAnswer
    : operator === "+" ? left + right : left - right;
  const prompt = typeof item.data?.prompt === "string"
    ? item.data.prompt
    : `${formatValue(left, money === true)} ${operator} ${formatValue(right, money === true)}`;
  const missingSide = item.data?.missingSide === "left" || item.data?.missingSide === "right"
    ? item.data.missingSide
    : undefined;
  return { left, right, operator, answer, money: money === true, kind, prompt, missingSide };
}

export default function MathBlastPage() {
  const { progress, recordPlay, award } = useAdrianProgress();
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("mission");
  const [topic, setTopic] = useState<Topic>("mixed");
  const [initialDifficulty, setInitialDifficulty] = useState(1);
  const [problem, setProblem] = useState<Problem>(() => makeProblem("mixed", 1));
  const [reviewProblems, setReviewProblems] = useState<Problem[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("Choose the correct answer.");
  const [lastReward, setLastReward] = useState({ xp: 0, coins: 0 });
  const sessionEndedRef = useRef(false);
  const autoStarted = useRef(false);
  const seenProblemsRef = useRef<Set<string>>(new Set());
  const profile = getActiveProfile();
  const profileId = profile.id;
  const dueReviews = getDueReviewItems(profileId, GAME_SLUG);

  const bestScore = progress.games[GAME_SLUG]?.bestScore ?? 0;
  const difficulty = clamp(initialDifficulty + Math.floor(correct / 4) - Math.floor(wrong / 3), 1, 7);
  const choices = useMemo(() => makeChoices(problem), [problem]);
  const targetQuestions = mode === "review"
    ? Math.max(1, reviewProblems.length)
    : mode === "daily"
      ? DAILY_LENGTH
      : MISSION_LENGTH;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDifficulty = Number(params.get("difficulty"));
    if (Number.isFinite(requestedDifficulty) && requestedDifficulty >= 1) {
      setInitialDifficulty(clamp(Math.round(requestedDifficulty), 1, 7));
    }
    const requestedTopic = params.get("topic");
    if (["mixed", "addition", "subtraction", "money", "word-problems"].includes(requestedTopic ?? "")) {
      setTopic(requestedTopic as Topic);
    }
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      startSession("review", "mixed");
    }
  }, []);

  useEffect(() => {
    if (screen !== "play" || mode !== "timer") return;
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [screen, mode]);

  useEffect(() => {
    if (screen === "play" && mode === "timer" && secondsLeft === 0) finishSession(false);
  }, [secondsLeft, screen, mode]);

  function freshProblem(nextTopic: Topic, nextDifficulty: number, random = Math.random): Problem {
    let candidate = makeProblem(nextTopic, nextDifficulty, random);
    for (let attempt = 0; attempt < 20 && seenProblemsRef.current.has(problemKey(candidate)); attempt += 1) {
      candidate = makeProblem(nextTopic, nextDifficulty, random);
    }
    seenProblemsRef.current.add(problemKey(candidate));
    return candidate;
  }

  function dailyProblem(number: number, nextDifficulty: number) {
    const random = seededRandom(hashText(`${dateKey()}-${profileId}-${number}-${nextDifficulty}`));
    return freshProblem("mixed", nextDifficulty, random);
  }

  function queuedProblems(): Problem[] {
    return getDueReviewItems(profileId, GAME_SLUG)
      .map(problemFromReview)
      .filter((item): item is Problem => Boolean(item))
      .slice(0, DAILY_LENGTH);
  }

  function nextProblem(nextQuestion: number, nextDifficulty: number) {
    if (mode === "review") {
      setProblem(reviewProblems[nextQuestion - 1] ?? reviewProblems[0]);
    } else {
      setProblem(mode === "daily" ? dailyProblem(nextQuestion, nextDifficulty) : freshProblem(topic, nextDifficulty));
    }
    setQuestionNumber(nextQuestion);
    setLocked(false);
    setMessage("Choose the correct answer.");
  }

  function startSession(nextMode: Mode, nextTopic: Topic) {
    const queued = nextMode === "review" ? queuedProblems() : [];
    if (nextMode === "review" && queued.length === 0) return;
    seenProblemsRef.current = new Set();
    const firstProblem = nextMode === "review"
      ? queued[0]
      : nextMode === "daily"
        ? dailyProblem(1, initialDifficulty)
        : freshProblem(nextTopic, initialDifficulty);

    setMode(nextMode);
    setTopic(nextMode === "daily" || nextMode === "review" ? "mixed" : nextTopic);
    setReviewProblems(queued);
    setQuestionNumber(1);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setStreak(0);
    setSecondsLeft(60);
    setLocked(false);
    setMessage(nextMode === "review" ? "This one came back for another look." : "Choose the correct answer.");
    setLastReward({ xp: 0, coins: 0 });
    sessionEndedRef.current = false;
    setProblem(firstProblem);
    setScreen("play");
    recordPlay(GAME_SLUG);
  }

  function finishSession(completed: boolean, snapshot?: { score: number; correct: number; wrong: number }) {
    if (sessionEndedRef.current || screen !== "play") return;
    sessionEndedRef.current = true;

    const finalScore = snapshot?.score ?? score;
    const finalCorrect = snapshot?.correct ?? correct;
    let xp = mode === "review" ? 8 + finalCorrect * 3 : 15 + finalCorrect * 4 + Math.floor(finalScore / 100) * 3;
    let coins = mode === "review" ? 2 : 3 + Math.floor(finalCorrect / 3);

    if (mode === "daily" && completed) {
      const dailyKey = `adrianos-math-daily-${profileId}-${dateKey()}`;
      if (!window.localStorage.getItem(dailyKey)) {
        xp += 30;
        coins += 10;
        window.localStorage.setItem(dailyKey, "complete");
      }
    }

    setLastReward({ xp, coins });
    award(GAME_SLUG, { xp, coins, score: finalScore, completed: completed && mode !== "review" });
    setScreen("results");
    setLocked(true);
  }

  function pick(value: number) {
    if (locked || screen !== "play") return;
    setLocked(true);

    const isCorrect = value === problem.answer;
    const skillId = problem.kind === "story"
      ? "math-word-problems"
      : problem.money
        ? "math-money"
        : problem.operator === "+"
          ? "math-addition"
          : "math-subtraction";
    const skillLabel = problem.kind === "story"
      ? "Math word problems"
      : problem.money
        ? "Money math"
        : problem.operator === "+"
          ? "Addition"
          : "Subtraction";

    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: "Math",
      skillId,
      skillLabel,
      prompt: problem.prompt,
      correctAnswer: formatValue(problem.answer, problem.money),
      correct: isCorrect,
      review: mode === "review",
      data: {
        left: problem.left,
        right: problem.right,
        operator: problem.operator,
        money: problem.money,
        answer: problem.answer,
        kind: problem.kind,
        prompt: problem.prompt,
        missingSide: problem.missingSide ?? false,
      },
    }, profileId);

    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextWrong = wrong + (isCorrect ? 0 : 1);
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextDifficulty = clamp(initialDifficulty + Math.floor(nextCorrect / 4) - Math.floor(nextWrong / 3), 1, 7);
    let nextScore = score;

    if (isCorrect) {
      const formatBonus = problem.kind === "story" ? 8 : problem.kind === "missing" ? 5 : 0;
      const points = 10 + difficulty * 3 + formatBonus + Math.min(20, nextStreak * 2);
      nextScore = score + points;
      setScore(nextScore);
      setCorrect(nextCorrect);
      setStreak(nextStreak);
      setMessage(nextStreak > 0 && nextStreak % 5 === 0 ? `🔥 ${nextStreak} in a row!` : `Correct! +${points}`);
    } else {
      setWrong(nextWrong);
      setStreak(0);
      setMessage(`The answer was ${formatValue(problem.answer, problem.money)}.`);
    }

    const complete = mode !== "timer" && questionNumber >= targetQuestions;
    window.setTimeout(() => {
      if (complete) finishSession(true, { score: nextScore, correct: nextCorrect, wrong: nextWrong });
      else nextProblem(questionNumber + 1, nextDifficulty);
    }, isCorrect ? 650 : 950);
  }

  if (screen === "menu") {
    return (
      <GameFrame title="Math Blast">
        <div style={{ width: "min(900px,100%)", margin: "0 auto" }}>
          <section style={menuCard}>
            <span style={eyebrow}>CHOOSE A MISSION</span>
            <h1 style={menuTitle}>Make math feel like a game.</h1>
            <p style={mutedText}>Direct equations, missing-number puzzles, and real-world stories all feed the same adaptive path.</p>

            <div style={modeGrid}>
              <button style={modeButton} onClick={() => startSession("mission", topic)}><span style={{ fontSize: 42 }}>🚀</span><strong>10-Question Mission</strong><small>Starts at adaptive level {initialDifficulty}.</small></button>
              <button style={modeButton} onClick={() => startSession("timer", topic)}><span style={{ fontSize: 42 }}>⏱️</span><strong>60-Second Blast</strong><small>Score as much as you can.</small></button>
              <button style={{ ...modeButton, borderColor: "rgba(217,255,91,.45)" }} onClick={() => startSession("daily", "mixed")}><span style={{ fontSize: 42 }}>🎁</span><strong>Daily Challenge</strong><small>Eight varied questions with a daily bonus.</small></button>
              {dueReviews.length > 0 && <button style={{ ...modeButton, borderColor: "rgba(198,184,255,.55)" }} onClick={() => startSession("review", "mixed")}><span style={{ fontSize: 42 }}>🧠</span><strong>Review {dueReviews.length} Due</strong><small>Practice exact missed problems.</small></button>}
            </div>

            <h2 style={{ marginTop: 30 }}>Choose a skill</h2>
            <div style={topicRow}>
              {(["mixed", "addition", "subtraction", "money", "word-problems"] as Topic[]).map((item) => (
                <button key={item} onClick={() => setTopic(item)} style={{ ...topicButton, background: topic === item ? "#d9ff5b" : "#222936", color: topic === item ? "#10131b" : "#fff" }}>
                  {item === "mixed" ? "Mixed" : item === "money" ? "Money" : item === "word-problems" ? "Word Problems" : item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <p style={{ ...mutedText, marginTop: 24 }}>Best score: {bestScore}</p>
          </section>
        </div>
      </GameFrame>
    );
  }

  if (screen === "results") {
    const attempts = correct + wrong;
    const accuracy = attempts === 0 ? 0 : Math.round((correct / attempts) * 100);
    return (
      <GameFrame title="Math Blast">
        <section style={finishCard}>
          <div style={{ fontSize: 66 }}>{mode === "review" ? "🧠" : score >= bestScore && score > 0 ? "🏆" : "⚡"}</div>
          <span style={eyebrow}>{mode === "review" ? "REVIEW COMPLETE" : "MISSION COMPLETE"}</span>
          <h1 style={finishTitle}>{score} points</h1>
          <div style={resultGrid}>
            <div><span>Correct</span><strong>{correct}</strong></div>
            <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
            <div><span>Best</span><strong>{Math.max(bestScore, score)}</strong></div>
          </div>
          <p style={mutedText}>You earned +{lastReward.xp} XP and +{lastReward.coins} coins.</p>
          <div style={actionRow}>
            <button style={primaryButton} onClick={() => startSession(mode, topic)}>Play Again</button>
            <button style={secondaryButton} onClick={() => setScreen("menu")}>Choose Mode</button>
            <Link href="/" style={linkButton}>Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  const formatLabel = problem.kind === "story" ? "WORD PROBLEM" : problem.kind === "missing" ? "MISSING NUMBER" : topic.toUpperCase();
  return (
    <GameFrame title="Math Blast">
      <main style={{ width: "min(780px,100%)", margin: "0 auto" }}>
        <section style={statsGrid}>
          <div><span>{mode === "timer" ? "Time" : "Question"}</span><strong>{mode === "timer" ? `${secondsLeft}s` : `${questionNumber}/${targetQuestions}`}</strong></div>
          <div><span>Score</span><strong>{score}</strong></div>
          <div><span>Streak</span><strong>{streak}</strong></div>
          <div><span>Level</span><strong>{difficulty}</strong></div>
        </section>

        <section style={playCard}>
          <span style={eyebrow}>{mode === "daily" ? "DAILY CHALLENGE" : mode === "review" ? "SPACED REVIEW" : formatLabel}</span>
          <h1 style={{ ...problemText, fontSize: problem.kind === "story" ? "clamp(2rem,6vw,3.8rem)" : problemText.fontSize, lineHeight: problem.kind === "story" ? 1.05 : .9 }}>
            {problem.prompt}
          </h1>
          <div style={choiceGrid}>
            {choices.map((choice) => (
              <button key={choice} onClick={() => pick(choice)} disabled={locked} style={choiceButton}>
                {formatValue(choice, problem.money)}
              </button>
            ))}
          </div>
          <p style={messageStyle}>{message}</p>
          <button style={quitButton} onClick={() => finishSession(false)}>End Session</button>
        </section>
      </main>
    </GameFrame>
  );
}

const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const menuCard: React.CSSProperties = { padding: "clamp(26px,5vw,52px)", border: "1px solid rgba(255,255,255,.11)", borderRadius: 30, background: "#181d28", textAlign: "center" };
const menuTitle: React.CSSProperties = { margin: "12px auto", maxWidth: 700, fontSize: "clamp(2.7rem,7vw,5.4rem)", lineHeight: .94, letterSpacing: "-.065em" };
const mutedText: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const modeGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 28 };
const modeButton: React.CSSProperties = { minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20, borderRadius: 22, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", cursor: "pointer" };
const topicRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 };
const topicButton: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.13)", fontWeight: 900, cursor: "pointer" };
const statsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 15 };
const playCard: React.CSSProperties = { padding: "clamp(25px,6vw,58px)", border: "1px solid rgba(255,255,255,.11)", borderRadius: 30, background: "#181d28", textAlign: "center" };
const problemText: React.CSSProperties = { fontSize: "clamp(3.4rem,12vw,7rem)", margin: "22px 0 32px", lineHeight: .9, letterSpacing: "-.07em" };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 };
const choiceButton: React.CSSProperties = { minHeight: 88, border: "1px solid rgba(255,255,255,.13)", borderRadius: 21, color: "#fff", background: "#222936", fontSize: "clamp(1.6rem,4vw,2.8rem)", fontWeight: 950, cursor: "pointer" };
const messageStyle: React.CSSProperties = { minHeight: 28, margin: "22px 0 10px", color: "#c6b8ff", fontWeight: 850 };
const quitButton: React.CSSProperties = { border: 0, background: "transparent", color: "#7f8898", cursor: "pointer" };
const finishCard: React.CSSProperties = { width: "min(760px,100%)", margin: "0 auto", padding: "clamp(30px,7vw,70px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const finishTitle: React.CSSProperties = { fontSize: "clamp(3rem,9vw,6rem)", lineHeight: .92, letterSpacing: "-.07em", margin: "14px 0 24px" };
const resultGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, margin: "20px 0" };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 22 };
const primaryButton: React.CSSProperties = { padding: "13px 19px", borderRadius: 999, border: "2px solid #d9ff5b", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { padding: "13px 19px", borderRadius: 999, border: "2px solid #fff", background: "#fff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const linkButton: React.CSSProperties = { display: "inline-block", padding: "13px 19px", borderRadius: 999, border: "1px solid rgba(255,255,255,.2)", background: "#222936", color: "#fff", fontWeight: 950, textDecoration: "none" };
