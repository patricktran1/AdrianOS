"use client";

import GameFrame from "@/components/GameFrame";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProgressForProfile, useAdrianProgress } from "@/lib/adrian-progress";
import {
  readPlacementReport,
  savePlacementReport,
  skillLabel,
  type PlacementAnswer,
  type PlacementDomain,
  type PlacementReport,
} from "@/lib/adrian-placement";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Screen = "intro" | "play" | "results";

type PlacementQuestion = {
  id: string;
  domain: PlacementDomain;
  subject: "Math" | "Reading" | "Science" | "Memory" | "Logic";
  skillId: string;
  skillLabel: string;
  level: 1 | 2 | 3;
  minAge: number;
  maxAge?: number;
  emoji: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  flash?: string;
};

const DOMAINS: PlacementDomain[] = ["Math", "Reading", "Science", "Memory", "Logic"];

const QUESTIONS: PlacementQuestion[] = [
  {
    id: "pre-count-3",
    domain: "Math",
    subject: "Math",
    skillId: "math-addition",
    skillLabel: "Early number sense",
    level: 1,
    minAge: 2,
    maxAge: 4,
    emoji: "🍎",
    prompt: "How many apples are here? 🍎 🍎 🍎",
    choices: ["2", "3", "4"],
    answer: 1,
    explanation: "There are three apples.",
  },
  {
    id: "pre-letter-s",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-easy",
    skillLabel: "Early letter sounds",
    level: 1,
    minAge: 2,
    maxAge: 4,
    emoji: "☀️",
    prompt: "Which letter starts the word SUN?",
    choices: ["M", "S", "T"],
    answer: 1,
    explanation: "Sun starts with the S sound.",
  },
  {
    id: "pre-animal-home",
    domain: "Science",
    subject: "Science",
    skillId: "science-earth",
    skillLabel: "Early observation",
    level: 1,
    minAge: 2,
    maxAge: 4,
    emoji: "🐟",
    prompt: "Which animal lives in water?",
    choices: ["🐟", "🐈", "🐦"],
    answer: 0,
    explanation: "Fish live in water.",
  },
  {
    id: "pre-memory-two",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-matching",
    skillLabel: "Visual matching",
    level: 1,
    minAge: 2,
    maxAge: 4,
    emoji: "🧠",
    flash: "🚀  🌙",
    prompt: "Which picture came first?",
    choices: ["🌙", "🚀", "⭐"],
    answer: 1,
    explanation: "The rocket came first.",
  },
  {
    id: "pre-pattern",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-patterns",
    skillLabel: "Recognizing patterns",
    level: 1,
    minAge: 2,
    maxAge: 4,
    emoji: "🧩",
    prompt: "What comes next? 🔵 🟡 🔵 🟡",
    choices: ["🔵", "🟢", "🟡"],
    answer: 0,
    explanation: "The colors repeat blue, yellow, blue, yellow.",
  },
  {
    id: "math-add-1a",
    domain: "Math",
    subject: "Math",
    skillId: "math-addition",
    skillLabel: "Addition",
    level: 1,
    minAge: 5,
    emoji: "➕",
    prompt: "What is 4 + 3?",
    choices: ["6", "7", "8", "9"],
    answer: 1,
    explanation: "Four plus three equals seven.",
  },
  {
    id: "math-add-1b",
    domain: "Math",
    subject: "Math",
    skillId: "math-addition",
    skillLabel: "Addition",
    level: 1,
    minAge: 5,
    emoji: "➕",
    prompt: "What is 6 + 5?",
    choices: ["10", "11", "12", "13"],
    answer: 1,
    explanation: "Six plus five equals eleven.",
  },
  {
    id: "math-sub-2a",
    domain: "Math",
    subject: "Math",
    skillId: "math-subtraction",
    skillLabel: "Subtraction",
    level: 2,
    minAge: 5,
    emoji: "➖",
    prompt: "What is 14 − 6?",
    choices: ["6", "7", "8", "9"],
    answer: 2,
    explanation: "Fourteen minus six equals eight.",
  },
  {
    id: "math-sub-2b",
    domain: "Math",
    subject: "Math",
    skillId: "math-subtraction",
    skillLabel: "Subtraction",
    level: 2,
    minAge: 5,
    emoji: "➖",
    prompt: "What is 18 − 9?",
    choices: ["7", "8", "9", "10"],
    answer: 2,
    explanation: "Eighteen minus nine equals nine.",
  },
  {
    id: "math-money-3a",
    domain: "Math",
    subject: "Math",
    skillId: "math-money",
    skillLabel: "Money math",
    level: 3,
    minAge: 6,
    emoji: "🪙",
    prompt: "You have 25¢ and get 35¢ more. How much do you have?",
    choices: ["50¢", "55¢", "60¢", "70¢"],
    answer: 2,
    explanation: "Twenty-five cents plus thirty-five cents equals sixty cents.",
  },
  {
    id: "math-money-3b",
    domain: "Math",
    subject: "Math",
    skillId: "math-money",
    skillLabel: "Money math",
    level: 3,
    minAge: 6,
    emoji: "🪙",
    prompt: "A toy costs 75¢. You pay $1.00. How much change do you get?",
    choices: ["15¢", "20¢", "25¢", "30¢"],
    answer: 2,
    explanation: "One dollar minus seventy-five cents equals twenty-five cents.",
  },
  {
    id: "read-easy-1a",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-easy",
    skillLabel: "Short-word spelling",
    level: 1,
    minAge: 5,
    emoji: "🔤",
    prompt: "Which word is spelled correctly?",
    choices: ["FROG", "FROGGE", "FRAG", "FOGR"],
    answer: 0,
    explanation: "FROG is spelled F-R-O-G.",
  },
  {
    id: "read-easy-1b",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-easy",
    skillLabel: "Short-word spelling",
    level: 1,
    minAge: 5,
    emoji: "🔤",
    prompt: "Which word means a place where you sit?",
    choices: ["CHAIR", "CHAIN", "CHEER", "CHAR"],
    answer: 0,
    explanation: "A chair is something you sit on.",
  },
  {
    id: "read-medium-2a",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-medium",
    skillLabel: "Medium-word spelling",
    level: 2,
    minAge: 5,
    emoji: "📖",
    prompt: "Which word is spelled correctly?",
    choices: ["VOLCANO", "VOLKANO", "VOLCANOE", "VOCALNO"],
    answer: 0,
    explanation: "VOLCANO is spelled V-O-L-C-A-N-O.",
  },
  {
    id: "read-medium-2b",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-medium",
    skillLabel: "Medium-word spelling",
    level: 2,
    minAge: 5,
    emoji: "📖",
    prompt: "Which word completes the sentence? The rocket flew into ____.",
    choices: ["spice", "space", "spoon", "speed"],
    answer: 1,
    explanation: "A rocket flies into space.",
  },
  {
    id: "read-hard-3a",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-hard",
    skillLabel: "Advanced spelling",
    level: 3,
    minAge: 7,
    emoji: "📚",
    prompt: "Which word is spelled correctly?",
    choices: ["ASTRONAUT", "ASTRANOT", "ASTRONAUGHT", "ASTRONUT"],
    answer: 0,
    explanation: "ASTRONAUT is spelled A-S-T-R-O-N-A-U-T.",
  },
  {
    id: "read-hard-3b",
    domain: "Reading",
    subject: "Reading",
    skillId: "reading-spelling-hard",
    skillLabel: "Advanced spelling",
    level: 3,
    minAge: 7,
    emoji: "📚",
    prompt: "Which word means a force that pulls objects together?",
    choices: ["gravity", "energy", "weather", "battery"],
    answer: 0,
    explanation: "Gravity is the force that pulls objects together.",
  },
  {
    id: "science-earth-1a",
    domain: "Science",
    subject: "Science",
    skillId: "science-earth",
    skillLabel: "Earth science",
    level: 1,
    minAge: 5,
    emoji: "🌍",
    prompt: "What causes day and night?",
    choices: ["Earth spins", "The Sun turns off", "Clouds move", "The Moon hides the Sun"],
    answer: 0,
    explanation: "Earth spins, so different sides face the Sun.",
  },
  {
    id: "science-earth-1b",
    domain: "Science",
    subject: "Science",
    skillId: "science-earth",
    skillLabel: "Earth science",
    level: 1,
    minAge: 5,
    emoji: "🌧️",
    prompt: "Where does rain come from?",
    choices: ["Cloud droplets", "Stars", "Mountains only", "The Moon"],
    answer: 0,
    explanation: "Water droplets in clouds grow heavy and fall as rain.",
  },
  {
    id: "science-body-2a",
    domain: "Science",
    subject: "Science",
    skillId: "science-body",
    skillLabel: "Human body",
    level: 2,
    minAge: 5,
    emoji: "❤️",
    prompt: "What does the heart do?",
    choices: ["Pumps blood", "Stores memories", "Makes bones", "Cools the air"],
    answer: 0,
    explanation: "The heart pumps blood through the body.",
  },
  {
    id: "science-space-2b",
    domain: "Science",
    subject: "Science",
    skillId: "science-space",
    skillLabel: "Space science",
    level: 2,
    minAge: 5,
    emoji: "🪐",
    prompt: "What keeps planets moving around the Sun?",
    choices: ["Gravity", "Wind", "Sound", "Clouds"],
    answer: 0,
    explanation: "The Sun's gravity keeps planets in orbit.",
  },
  {
    id: "science-tech-3a",
    domain: "Science",
    subject: "Science",
    skillId: "science-technology",
    skillLabel: "Technology systems",
    level: 3,
    minAge: 7,
    emoji: "💻",
    prompt: "Why does a computer need time to load?",
    choices: ["It processes instructions and data", "It gets sleepy", "It waits for the Moon", "It grows new wires"],
    answer: 0,
    explanation: "A computer must find and process information before showing it.",
  },
  {
    id: "science-tech-3b",
    domain: "Science",
    subject: "Science",
    skillId: "science-technology",
    skillLabel: "Technology systems",
    level: 3,
    minAge: 7,
    emoji: "🔋",
    prompt: "What kind of energy does a battery store?",
    choices: ["Chemical energy", "Wind only", "Moonlight", "Sound energy only"],
    answer: 0,
    explanation: "A battery stores chemical energy that can become electrical energy.",
  },
  {
    id: "memory-match-1a",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-matching",
    skillLabel: "Visual matching",
    level: 1,
    minAge: 5,
    emoji: "🧠",
    flash: "🚀  🌙",
    prompt: "Which picture came second?",
    choices: ["🚀", "🌙", "⭐", "🪐"],
    answer: 1,
    explanation: "The Moon came second.",
  },
  {
    id: "memory-match-1b",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-matching",
    skillLabel: "Visual matching",
    level: 1,
    minAge: 5,
    emoji: "🧠",
    flash: "🐯  🐸",
    prompt: "Which animal came first?",
    choices: ["🐸", "🐯", "🐧", "🐻"],
    answer: 1,
    explanation: "The tiger came first.",
  },
  {
    id: "memory-work-2a",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-working-memory",
    skillLabel: "Working memory",
    level: 2,
    minAge: 5,
    emoji: "🧠",
    flash: "⭐  🚀  🌍",
    prompt: "Which picture was in the middle?",
    choices: ["⭐", "🚀", "🌍", "🌙"],
    answer: 1,
    explanation: "The rocket was in the middle.",
  },
  {
    id: "memory-work-2b",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-working-memory",
    skillLabel: "Working memory",
    level: 2,
    minAge: 5,
    emoji: "🧠",
    flash: "🍎  🍕  🍌",
    prompt: "Which food came last?",
    choices: ["🍎", "🍌", "🍕", "🥕"],
    answer: 1,
    explanation: "The banana came last.",
  },
  {
    id: "memory-work-3a",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-working-memory",
    skillLabel: "Working memory",
    level: 3,
    minAge: 7,
    emoji: "🧠",
    flash: "🌙  🐸  🚀  ⭐",
    prompt: "Which two pictures were next to the rocket?",
    choices: ["🐸 and ⭐", "🌙 and 🐸", "🌙 and ⭐", "🚀 and ⭐"],
    answer: 0,
    explanation: "The frog was before the rocket and the star was after it.",
  },
  {
    id: "memory-work-3b",
    domain: "Memory",
    subject: "Memory",
    skillId: "memory-working-memory",
    skillLabel: "Working memory",
    level: 3,
    minAge: 7,
    emoji: "🧠",
    flash: "🔵  🟡  🟢  🔴",
    prompt: "Which color was third?",
    choices: ["🔵", "🟡", "🟢", "🔴"],
    answer: 2,
    explanation: "Green was the third color.",
  },
  {
    id: "logic-pattern-1a",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-patterns",
    skillLabel: "Recognizing patterns",
    level: 1,
    minAge: 5,
    emoji: "🧩",
    prompt: "What comes next? 2, 4, 2, 4, __",
    choices: ["2", "3", "4", "6"],
    answer: 0,
    explanation: "The pattern repeats two, four.",
  },
  {
    id: "logic-pattern-1b",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-patterns",
    skillLabel: "Recognizing patterns",
    level: 1,
    minAge: 5,
    emoji: "🧩",
    prompt: "What comes next? 🔺 🔺 ⚪ 🔺 🔺 ⚪ __",
    choices: ["⚪", "🔺", "🟦", "⭐"],
    answer: 1,
    explanation: "The pattern is triangle, triangle, circle.",
  },
  {
    id: "logic-step-2a",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-multi-step",
    skillLabel: "Multi-step reasoning",
    level: 2,
    minAge: 5,
    emoji: "🕵️",
    prompt: "Mia is taller than Leo. Leo is taller than Sam. Who is shortest?",
    choices: ["Mia", "Leo", "Sam", "They are equal"],
    answer: 2,
    explanation: "Sam is shorter than Leo, and Leo is shorter than Mia.",
  },
  {
    id: "logic-step-2b",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-multi-step",
    skillLabel: "Multi-step reasoning",
    level: 2,
    minAge: 5,
    emoji: "🕵️",
    prompt: "A box has a red key and a blue key. The red key does not open the door. Which key should you try next?",
    choices: ["Red", "Blue", "Neither", "Both at once"],
    answer: 1,
    explanation: "The blue key is the remaining choice.",
  },
  {
    id: "logic-step-3a",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-multi-step",
    skillLabel: "Multi-step reasoning",
    level: 3,
    minAge: 7,
    emoji: "🧠",
    prompt: "A robot faces north, turns right, then turns right again. Which way is it facing?",
    choices: ["North", "East", "South", "West"],
    answer: 2,
    explanation: "Two right turns from north point south.",
  },
  {
    id: "logic-step-3b",
    domain: "Logic",
    subject: "Logic",
    skillId: "logic-multi-step",
    skillLabel: "Multi-step reasoning",
    level: 3,
    minAge: 7,
    emoji: "🧠",
    prompt: "Every glim is blue. This object is not blue. Can it be a glim?",
    choices: ["Yes", "No", "Only at night", "Not enough information"],
    answer: 1,
    explanation: "If every glim is blue, a non-blue object cannot be a glim.",
  },
];

function eligibleQuestions(age: number, domain: PlacementDomain): PlacementQuestion[] {
  return QUESTIONS.filter(
    (question) =>
      question.domain === domain &&
      question.minAge <= age &&
      (question.maxAge === undefined || age <= question.maxAge)
  );
}

function nextQuestion(age: number, answers: PlacementAnswer[]): PlacementQuestion | null {
  const used = new Set(answers.map((answer) => answer.questionId));
  const preschool = age <= 4;

  for (const domain of DOMAINS) {
    const domainAnswers = answers.filter((answer) => answer.domain === domain);
    const maxQuestions = preschool ? 1 : 3;
    if (domainAnswers.length >= maxQuestions) continue;

    let desiredLevel: 1 | 2 | 3 = 1;
    if (!preschool && domainAnswers.length === 1) {
      desiredLevel = domainAnswers[0].correct ? 2 : 1;
    } else if (!preschool && domainAnswers.length === 2) {
      const correct = domainAnswers.filter((answer) => answer.correct).length;
      if (correct === 0) continue;
      desiredLevel = correct === 2 ? 3 : 2;
    }

    const candidates = eligibleQuestions(age, domain)
      .filter((question) => !used.has(question.id))
      .sort((a, b) => Math.abs(a.level - desiredLevel) - Math.abs(b.level - desiredLevel));
    if (candidates[0]) return candidates[0];
  }

  return null;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default function PlacementAdventurePage() {
  const { activeProfile: profile, hydrated: profilesReady } = useFamilyProfiles();
  const { recordPlay, award } = useAdrianProgress();
  const [screen, setScreen] = useState<Screen>("intro");
  const [current, setCurrent] = useState<PlacementQuestion | null>(null);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [report, setReport] = useState<PlacementReport | null>(null);
  const [reward, setReward] = useState({ xp: 0, coins: 0 });
  const startedAt = useRef(0);
  const hadPlacement = useRef(false);

  useEffect(() => {
    if (!profilesReady) return;
    const currentReport = readPlacementReport(profile.id);
    setReport(currentReport);
    hadPlacement.current = Boolean(currentReport);
  }, [profile.id, profilesReady]);

  useEffect(() => {
    if (!current?.flash) {
      setShowFlash(false);
      return;
    }
    setShowFlash(true);
    const timer = window.setTimeout(() => setShowFlash(false), profile.age <= 4 ? 2600 : 2100);
    return () => window.clearTimeout(timer);
  }, [current?.id, current?.flash, profile.age]);

  function start() {
    hadPlacement.current = Boolean(readPlacementReport(profile.id));
    const first = nextQuestion(profile.age, []);
    if (!first) return;
    startedAt.current = Date.now();
    setAnswers([]);
    setCurrent(first);
    setSelected(null);
    setLocked(false);
    setScreen("play");
    recordPlay("placement-adventure");
  }

  function finish(finalAnswers: PlacementAnswer[]) {
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const currentProgress = readProgressForProfile(profile.id);
    const nextReport = savePlacementReport(profile, currentProgress, finalAnswers, durationSeconds);
    const firstCompletion = !hadPlacement.current;
    const nextReward = firstCompletion ? { xp: 80, coins: 20 } : { xp: 20, coins: 5 };
    award("placement-adventure", {
      ...nextReward,
      score: nextReport.accuracy,
      completed: true,
    });
    setReward(nextReward);
    setReport(nextReport);
    setScreen("results");
    setCurrent(null);
  }

  function choose(choiceIndex: number) {
    if (!current || locked || showFlash) return;
    setSelected(choiceIndex);
    setLocked(true);
    const answer: PlacementAnswer = {
      questionId: current.id,
      domain: current.domain,
      skillId: current.skillId,
      skillLabel: current.skillLabel,
      subject: current.subject,
      level: current.level,
      correct: choiceIndex === current.answer,
    };
    const updated = [...answers, answer];
    setAnswers(updated);

    window.setTimeout(() => {
      const next = nextQuestion(profile.age, updated);
      if (!next) {
        finish(updated);
        return;
      }
      setCurrent(next);
      setSelected(null);
      setLocked(false);
    }, 900);
  }

  if (screen === "intro") {
    return (
      <GameFrame title="Placement Adventure">
        <section style={introCard}>
          <div style={{ fontSize: 74 }}>🧭</div>
          <span style={eyebrow}>MAP YOUR STARTING POINT</span>
          <h1 style={heroTitle}>{profile.name}’s Placement Adventure</h1>
          <p style={muted}>
            This is a short game, not a test. Questions change as you play so AdrianOS can find the best place to begin.
          </p>
          <div style={featureGrid}>
            <Feature emoji="🧮" title="Five worlds" text="Math, reading, science, memory, and logic." />
            <Feature emoji="🪄" title="Adaptive" text="Questions get easier or harder based on each answer." />
            <Feature emoji="🗺️" title="Your map" text="Finish with strengths, next skills, and a seven-day plan." />
          </div>
          <button onClick={start} style={primaryButton} type="button">
            {report ? "Retake the Adventure" : "Start the Adventure"}
          </button>
          <p style={smallText}>{profile.age <= 4 ? "About 5 minutes" : "About 10–15 minutes"}</p>
        </section>
      </GameFrame>
    );
  }

  if (screen === "results" && report) {
    return (
      <GameFrame title="Placement Adventure">
        <section style={resultCard}>
          <div style={{ fontSize: 72 }}>🗺️</div>
          <span style={eyebrow}>STARTING MAP COMPLETE</span>
          <h1 style={heroTitle}>{profile.name} found the trail.</h1>
          <div style={metricGrid}>
            <Metric label="Accuracy" value={`${report.accuracy}%`} />
            <Metric label="Questions" value={String(report.totalQuestions)} />
            <Metric label="Adventure time" value={formatDuration(report.durationSeconds)} />
            <Metric label="Daily plan" value={`${report.recommendedMinutes} min`} />
          </div>

          <div style={reportGrid}>
            <ReportBlock
              title="Strong starting points"
              items={report.strengths.map(skillLabel)}
              empty="Strengths will sharpen as more games are played."
            />
            <ReportBlock
              title="Skills to build"
              items={report.building.map(skillLabel)}
              empty="No major gaps appeared in this short adventure."
            />
          </div>

          <div style={nextCard}>
            <span style={eyebrow}>BEST NEXT SKILL</span>
            <h2 style={{ margin: "8px 0", fontSize: 32 }}>
              {report.nextSkillId ? skillLabel(report.nextSkillId) : "Keep exploring"}
            </h2>
            <p style={{ ...muted, margin: 0 }}>
              AdrianOS has added this starting point to Today’s Adventure and created a seven-day practice path.
            </p>
          </div>

          <p style={rewardText}>Reward: +{reward.xp} XP and +{reward.coins} coins</p>
          <div style={actionRow}>
            <Link href="/" style={primaryLink}>See Today’s Adventure</Link>
            <button onClick={() => setScreen("intro")} style={secondaryButton} type="button">Retake later</button>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (!current) return null;
  const answeredCount = answers.length;
  const targetEstimate = profile.age <= 4 ? 5 : 15;
  const progressPercent = Math.min(96, Math.round((answeredCount / targetEstimate) * 100));
  const correct = selected !== null && selected === current.answer;

  return (
    <GameFrame title="Placement Adventure">
      <main style={{ width: "min(820px,100%)", margin: "0 auto" }}>
        <div style={progressHeader}>
          <span>{current.domain} world</span>
          <span>{answeredCount + 1} questions explored</span>
        </div>
        <div style={progressTrack}>
          <div style={{ ...progressFill, width: `${Math.max(7, progressPercent)}%` }} />
        </div>

        <section style={questionCard}>
          {showFlash && current.flash ? (
            <div style={flashStage}>
              <span style={eyebrow}>REMEMBER THIS</span>
              <div style={flashText}>{current.flash}</div>
              <p style={muted}>It will disappear in a moment.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 58 }}>{current.emoji}</div>
              <span style={eyebrow}>{current.skillLabel.toUpperCase()}</span>
              <h1 style={questionTitle}>{current.prompt}</h1>
              <div style={choiceGrid}>
                {current.choices.map((choice, index) => {
                  const showCorrect = locked && index === current.answer;
                  const showWrong = locked && selected === index && index !== current.answer;
                  return (
                    <button
                      key={`${choice}-${index}`}
                      onClick={() => choose(index)}
                      disabled={locked}
                      style={{
                        ...choiceButton,
                        background: showCorrect ? "#d9ff5b" : showWrong ? "#ffb5bf" : "#222936",
                        color: showCorrect || showWrong ? "#10131b" : "#fff",
                      }}
                      type="button"
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {locked && (
                <div style={feedbackBox}>
                  <strong style={{ color: correct ? "#d9ff5b" : "#ffb5bf" }}>
                    {correct ? "Nice work." : "Good try."}
                  </strong>
                  <p style={{ ...muted, marginBottom: 0 }}>{current.explanation}</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </GameFrame>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div style={featureCard}>
      <span style={{ fontSize: 32 }}>{emoji}</span>
      <strong>{title}</strong>
      <small style={smallText}>{text}</small>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function ReportBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div style={reportBlock}>
      <strong>{title}</strong>
      {items.length > 0 ? (
        <div style={chipRow}>{items.map((item) => <span key={item} style={chip}>{item}</span>)}</div>
      ) : (
        <p style={muted}>{empty}</p>
      )}
    </div>
  );
}

const introCard: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(26px,5vw,58px)", borderRadius: 32, background: "linear-gradient(145deg,rgba(127,220,255,.12),rgba(198,184,255,.10),#181d28)", border: "1px solid rgba(127,220,255,.24)", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.28)" };
const resultCard: React.CSSProperties = { ...introCard, textAlign: "left" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".17em" };
const heroTitle: React.CSSProperties = { margin: "12px auto", maxWidth: 760, fontSize: "clamp(2.7rem,7vw,5.5rem)", lineHeight: .93, letterSpacing: "-.065em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const smallText: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.45 };
const featureGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, margin: "28px 0" };
const featureCard: React.CSSProperties = { display: "grid", gap: 8, padding: 18, borderRadius: 20, background: "rgba(16,19,27,.72)", border: "1px solid rgba(255,255,255,.09)" };
const primaryButton: React.CSSProperties = { padding: "14px 22px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, fontSize: 16, cursor: "pointer" };
const progressHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "#aab1bf", fontWeight: 850, marginBottom: 10 };
const progressTrack: React.CSSProperties = { height: 8, borderRadius: 999, background: "#222936", overflow: "hidden", marginBottom: 16 };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)", transition: "width .3s ease" };
const questionCard: React.CSSProperties = { minHeight: 520, padding: "clamp(24px,5vw,52px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center", display: "grid", alignContent: "center" };
const questionTitle: React.CSSProperties = { margin: "14px auto 28px", maxWidth: 720, fontSize: "clamp(2rem,5vw,4.2rem)", lineHeight: 1.02, letterSpacing: "-.05em" };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 11 };
const choiceButton: React.CSSProperties = { minHeight: 76, padding: "14px", borderRadius: 19, border: "1px solid rgba(255,255,255,.13)", fontSize: "clamp(1rem,3vw,1.5rem)", fontWeight: 900, cursor: "pointer" };
const feedbackBox: React.CSSProperties = { marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.1)" };
const flashStage: React.CSSProperties = { display: "grid", placeItems: "center", minHeight: 360 };
const flashText: React.CSSProperties = { margin: "30px 0", fontSize: "clamp(4rem,12vw,8rem)", letterSpacing: ".1em" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, margin: "24px 0" };
const metricCard: React.CSSProperties = { display: "grid", gap: 5, padding: 15, borderRadius: 17, background: "#222936", textAlign: "center" };
const reportGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 };
const reportBlock: React.CSSProperties = { padding: 18, borderRadius: 20, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const chipRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 };
const chip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontWeight: 850, fontSize: 12 };
const nextCard: React.CSSProperties = { marginTop: 16, padding: 20, borderRadius: 22, background: "rgba(217,255,91,.08)", border: "1px solid rgba(217,255,91,.25)" };
const rewardText: React.CSSProperties = { color: "#d9ff5b", fontWeight: 900, textAlign: "center", marginTop: 22 };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 18 };
const primaryLink: React.CSSProperties = { ...primaryButton, display: "inline-block", textDecoration: "none" };
const secondaryButton: React.CSSProperties = { padding: "14px 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
