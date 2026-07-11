"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CoachMode, { type CoachCheck } from "@/components/CoachMode";
import { scienceByPrompt, wordsByHint, type ScienceQuestion } from "@/lib/adrian-content-bank";

type CoachContext = {
  gameSlug: string;
  skillId: string;
  skillLabel: string;
  prompt: string;
  hints: string[];
  explanation: string;
  check: CoachCheck;
};

const SCIENCE_FACTS = scienceByPrompt();
const WORDS = wordsByHint();

function visibleHeadings(): string[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLElement>(".game-stage h1"))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);
}

function shuffledChoices(answer: string, alternatives: string[]): { choices: string[]; answerIndex: number } {
  const unique = [answer, ...alternatives.filter((item) => item !== answer)]
    .filter((item, index, source) => source.indexOf(item) === index)
    .slice(0, 3);
  const rotated = unique.length === 3 ? [unique[1], unique[0], unique[2]] : unique;
  return { choices: rotated, answerIndex: rotated.indexOf(answer) };
}

function parseAmount(raw: string, money: boolean): number {
  return money ? Math.round(Number(raw.replace("$", "")) * 100) : Number(raw.replace("$", ""));
}

function mathContext(headings: string[]): CoachContext | null {
  const heading = headings.find((text) =>
    /\$?\d+(?:\.\d{2})?\s*[+−-]\s*\$?\d+(?:\.\d{2})?/.test(text) ||
    /\?\s*[+−-]\s*\d+\s*=\s*\d+/.test(text) ||
    /\d+\s*[+−-]\s*\?\s*=\s*\d+/.test(text)
  );
  if (!heading) return null;

  const standard = heading.match(/(\$?\d+(?:\.\d{2})?)\s*([+−-])\s*(\$?\d+(?:\.\d{2})?)/);
  const missingLeft = heading.match(/\?\s*([+−-])\s*(\d+)\s*=\s*(\d+)/);
  const missingRight = heading.match(/(\d+)\s*([+−-])\s*\?\s*=\s*(\d+)/);
  const story = /\b(has|gets|gives|remain|altogether|how many)\b/i.test(heading);

  let left = 0;
  let right = 0;
  let answer = 0;
  let operator: "+" | "−" = "+";
  let money = false;
  let missing = false;

  if (missingLeft) {
    operator = missingLeft[1] === "+" ? "+" : "−";
    right = Number(missingLeft[2]);
    const target = Number(missingLeft[3]);
    answer = operator === "+" ? target - right : target + right;
    left = answer;
    missing = true;
  } else if (missingRight) {
    left = Number(missingRight[1]);
    operator = missingRight[2] === "+" ? "+" : "−";
    const target = Number(missingRight[3]);
    answer = operator === "+" ? target - left : left - target;
    right = answer;
    missing = true;
  } else if (standard) {
    money = standard[1].includes("$") || standard[3].includes("$") || standard[1].includes(".") || standard[3].includes(".");
    left = parseAmount(standard[1], money);
    right = parseAmount(standard[3], money);
    operator = standard[2] === "+" ? "+" : "−";
    answer = operator === "+" ? left + right : left - right;
  } else {
    return null;
  }

  const format = (value: number) => money ? `$${(value / 100).toFixed(2)}` : String(value);
  const skillId = story
    ? "math-word-problems"
    : money
      ? "math-money"
      : operator === "+"
        ? "math-addition"
        : "math-subtraction";
  const skillLabel = story
    ? "Math word problems"
    : money
      ? "Money math"
      : operator === "+"
        ? "Addition"
        : "Subtraction";

  const hints = missing
    ? operator === "+"
      ? [
          "The question mark is a missing part. Ask what must be added to reach the total.",
          `Start at the known number and count up to the number after the equals sign.`,
          `The missing number is ${format(answer)}. Check by placing it back into the equation.`,
        ]
      : [
          "The question mark is the amount being removed or the starting amount.",
          "Use the inverse operation. Addition can check subtraction, and subtraction can check addition.",
          `The missing number is ${format(answer)}. Put it into the equation and verify both sides match.`,
        ]
    : story
      ? [
          "Find the quantities in the story and decide whether they are joining together or being taken apart.",
          `The words in this story point to ${operator === "+" ? "addition" : "subtraction"}.`,
          `Use ${format(left)} ${operator} ${format(right)} to solve the story.`,
        ]
      : money
        ? [
            "Turn each dollar amount into cents first. That removes the decimal point.",
            `Decide whether the sign tells you to combine the cents or take some away.`,
            `Work with ${left} cents ${operator} ${right} cents, then turn the result back into dollars.`,
          ]
        : operator === "+"
          ? [
              "Start with the larger number and count on.",
              `Break ${right} into smaller jumps, such as tens and ones.`,
              `${left} + ${right} equals ${answer}. Check by counting forward.`,
            ]
          : [
              "Subtraction means finding what remains or the distance between two numbers.",
              `Take away ${right} in smaller chunks. Friendly numbers such as 10 can help.`,
              `${left} − ${right} equals ${answer}. Check by adding ${answer} + ${right}.`,
            ];

  const checkAnswer = operator === "+" ? left + 1 : Math.max(0, left - 1);
  const checkChoices = money
    ? ["100 cents", "10 cents", "1 cent"]
    : [String(checkAnswer), String(Math.max(0, checkAnswer - 1)), String(checkAnswer + 1)];

  return {
    gameSlug: "math-blast",
    skillId,
    skillLabel,
    prompt: heading,
    hints,
    explanation: missing
      ? `${format(answer)} replaces the question mark because it makes both sides of the equation equal.`
      : `${format(left)} ${operator} ${format(right)} equals ${format(answer)}. ${operator === "+" ? "The quantities were combined." : "The second quantity was removed from the first."}`,
    check: {
      prompt: money
        ? "How many cents are in one dollar?"
        : operator === "+"
          ? `What is ${left} + 1?`
          : `What is ${left} − 1?`,
      choices: checkChoices,
      answerIndex: 0,
      explanation: money
        ? "One dollar is made of 100 cents."
        : operator === "+"
          ? `Adding one moves ${left} to ${checkAnswer}.`
          : `Taking away one moves ${left} to ${checkAnswer}.`,
    },
  };
}

function scienceContext(headings: string[]): CoachContext | null {
  const prompt = headings.find((text) => SCIENCE_FACTS[text]);
  if (!prompt) return null;
  const fact: ScienceQuestion = SCIENCE_FACTS[prompt];
  const answer = fact.choices[fact.answer];
  const check = shuffledChoices(answer, fact.choices);
  const topicClue: Record<ScienceQuestion["topic"], string> = {
    Earth: "Think about a real process involving weather, water, rocks, motion, or energy.",
    Body: "Think about the job a body part or body process performs to keep us working.",
    Space: "Think about motion, light, gravity, and what objects in space really are.",
    Technology: "Think about how energy, information, or instructions move through a machine.",
  };
  return {
    gameSlug: "science-quest",
    skillId: `science-${fact.topic.toLowerCase()}`,
    skillLabel: `${fact.topic} science`,
    prompt,
    hints: [
      topicClue[fact.topic],
      "Cross out choices that depend on magic, feelings, or impossible events. Science answers describe a real mechanism.",
      fact.explanation,
    ],
    explanation: fact.explanation,
    check: {
      prompt: "Which idea best matches what you just learned?",
      choices: check.choices,
      answerIndex: check.answerIndex,
      explanation: `${answer} is the scientific idea supported by the explanation.`,
    },
  };
}

function wordContext(headings: string[]): CoachContext | null {
  const prompt = headings.find((text) => WORDS[text]);
  if (!prompt) return null;
  const item = WORDS[prompt];
  const first = item.word[0];
  const last = item.word[item.word.length - 1];
  const difficulty = item.word.length <= 5 ? "easy" : item.word.length <= 7 ? "medium" : "hard";
  const distractors = [
    String.fromCharCode(((first.charCodeAt(0) - 65 + 1) % 26) + 65),
    String.fromCharCode(((first.charCodeAt(0) - 65 + 2) % 26) + 65),
  ];
  const check = shuffledChoices(first, distractors);
  return {
    gameSlug: "word-builder",
    skillId: `reading-spelling-${difficulty}`,
    skillLabel: `${difficulty[0].toUpperCase()}${difficulty.slice(1)} spelling`,
    prompt,
    hints: [
      `The answer belongs to ${item.category} and has ${item.word.length} letters.`,
      `Listen to the first sound. The word starts with ${first}.`,
      `The first letter is ${first}, the last letter is ${last}, and the word is ${item.word}.`,
    ],
    explanation: `${item.word} matches the clue “${prompt}” and is spelled ${item.word.split("").join("-")}.`,
    check: {
      prompt: `Which letter does ${item.word} begin with?`,
      choices: check.choices,
      answerIndex: check.answerIndex,
      explanation: `${item.word} begins with the ${first} sound and the letter ${first}.`,
    },
  };
}

function detectContext(pathname: string): CoachContext | null {
  const headings = visibleHeadings();
  if (pathname.includes("/games/math-blast")) return mathContext(headings);
  if (pathname.includes("/games/science-quest")) return scienceContext(headings);
  if (pathname.includes("/games/word-builder")) return wordContext(headings);
  return null;
}

export default function UniversalCoach() {
  const pathname = usePathname();
  const [context, setContext] = useState<CoachContext | null>(null);

  useEffect(() => {
    let previousKey = "";
    const scan = () => {
      const next = detectContext(pathname);
      const nextKey = next ? `${next.gameSlug}:${next.skillId}:${next.prompt}` : "";
      if (nextKey !== previousKey) {
        previousKey = nextKey;
        setContext(next);
      }
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(scan, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [pathname]);

  if (!context) return null;

  return (
    <aside style={wrapper}>
      <CoachMode {...context} />
    </aside>
  );
}

const wrapper: React.CSSProperties = {
  position: "fixed",
  left: 16,
  bottom: 16,
  zIndex: 120,
  width: "min(460px,calc(100vw - 32px))",
  maxHeight: "78vh",
  overflowY: "auto",
  borderRadius: 24,
};
