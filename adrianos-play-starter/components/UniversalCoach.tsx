"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CoachMode, { type CoachCheck } from "@/components/CoachMode";

type CoachContext = {
  gameSlug: string;
  skillId: string;
  skillLabel: string;
  prompt: string;
  hints: string[];
  explanation: string;
  check: CoachCheck;
};

type ScienceFact = {
  topic: "Earth" | "Body" | "Space" | "Technology";
  answer: string;
  choices: string[];
  explanation: string;
};

const SCIENCE_FACTS: Record<string, ScienceFact> = {
  "Why does lightning happen?": { topic: "Earth", answer: "Electric charge builds up in clouds", choices: ["Electric charge builds up in clouds", "The moon shakes the sky", "Clouds are made of fire"], explanation: "Positive and negative charges separate inside storm clouds. Electricity jumps when the difference becomes large enough." },
  "Why can snow become a snowball?": { topic: "Earth", answer: "Pressure helps crystals stick together", choices: ["Snow is magnetic", "Pressure helps crystals stick together", "Snow contains glue"], explanation: "Pressing snow can melt a tiny layer of water. It refreezes and locks the crystals together." },
  "What causes day and night?": { topic: "Earth", answer: "Earth spins", choices: ["Earth spins", "The Sun turns off", "Clouds cover the sky"], explanation: "Earth rotates once about every 24 hours. The side facing the Sun has day." },
  "Why do volcanoes erupt?": { topic: "Earth", answer: "Hot rock and gas push upward", choices: ["Hot rock and gas push upward", "Mountains get angry", "Rain fills them up"], explanation: "Magma and gas build pressure below Earth’s surface until they escape." },
  "Where does rain come from?": { topic: "Earth", answer: "Water vapor cools into droplets", choices: ["Water vapor cools into droplets", "Stars melt", "Trees throw water upward"], explanation: "Water evaporates, rises, cools into cloud droplets, and falls when the droplets grow heavy." },
  "Why do people sweat?": { topic: "Body", answer: "To cool the body", choices: ["To make skin shiny", "To cool the body", "To store extra water"], explanation: "Sweat carries heat away when it evaporates from the skin." },
  "What does the heart do?": { topic: "Body", answer: "Pumps blood", choices: ["Pumps blood", "Stores memories", "Makes bones grow"], explanation: "The heart is a muscular pump that moves blood, oxygen, and nutrients through the body." },
  "Why do we need air?": { topic: "Body", answer: "Cells use oxygen to release energy", choices: ["Cells use oxygen to release energy", "Air makes us taller", "Bones are filled with air"], explanation: "Your cells use oxygen to help release energy from food." },
  "What protects your brain?": { topic: "Body", answer: "The skull", choices: ["The skull", "The stomach", "The elbow"], explanation: "The skull is a strong bony case surrounding the brain." },
  "Why do muscles get tired?": { topic: "Body", answer: "They use energy and need recovery", choices: ["They use energy and need recovery", "They forget how to move", "They turn into bone"], explanation: "Working muscles use stored energy and need oxygen, nutrients, and rest to recover." },
  "What is the Sun?": { topic: "Space", answer: "A star", choices: ["A planet", "A star", "A moon"], explanation: "The Sun is a star made mostly of extremely hot hydrogen and helium." },
  "Why does the Moon seem to change shape?": { topic: "Space", answer: "We see different sunlit portions", choices: ["We see different sunlit portions", "It loses pieces", "Clouds paint it"], explanation: "As the Moon orbits Earth, we see different amounts of its sunlit half." },
  "Which planet is called the red planet?": { topic: "Space", answer: "Mars", choices: ["Mars", "Venus", "Neptune"], explanation: "Iron minerals in Martian soil oxidize, giving Mars its rusty red color." },
  "What keeps planets moving around the Sun?": { topic: "Space", answer: "Gravity", choices: ["Gravity", "Wind", "Magnets in space"], explanation: "The Sun’s gravity bends each planet’s forward motion into an orbit." },
  "Why do astronauts float in orbit?": { topic: "Space", answer: "They are continuously falling around Earth", choices: ["They are continuously falling around Earth", "Space has magic air", "Their suits lift them"], explanation: "Astronauts and their spacecraft fall together around Earth, creating microgravity." },
  "Why do computers need time to load?": { topic: "Technology", answer: "They gather and process instructions", choices: ["They gather and process instructions", "They get tired", "They wait for permission from the Moon"], explanation: "A computer must find, process, and arrange information before showing the next screen." },
  "What does a battery store?": { topic: "Technology", answer: "Chemical energy", choices: ["Chemical energy", "Tiny robots", "Cold air"], explanation: "A battery stores chemical energy that can be changed into electrical energy." },
  "What is a robot?": { topic: "Technology", answer: "A machine that follows instructions", choices: ["A machine that follows instructions", "A metal animal", "A talking battery"], explanation: "Robots are machines designed to sense, compute, and perform actions." },
  "What carries information through the internet?": { topic: "Technology", answer: "Data signals", choices: ["Data signals", "Paper airplanes", "Ocean waves only"], explanation: "Information is encoded into signals that travel through cables, fiber optics, and radio waves." },
  "Why does a light bulb glow?": { topic: "Technology", answer: "Electrical energy becomes light and heat", choices: ["Electrical energy becomes light and heat", "It stores sunlight", "Glass creates fire"], explanation: "A bulb converts electrical energy into light, with some energy also becoming heat." },
};

const WORDS: Record<string, { word: string; category: string }> = {
  "A large animal that can hibernate.": { word: "BEAR", category: "Animals" },
  "An animal that hops and says ribbit.": { word: "FROG", category: "Animals" },
  "A striped big cat.": { word: "TIGER", category: "Animals" },
  "A giant mammal that lives in the ocean.": { word: "WHALE", category: "Animals" },
  "A bird that waddles and swims.": { word: "PENGUIN", category: "Animals" },
  "A huge animal with a trunk.": { word: "ELEPHANT", category: "Animals" },
  "It shines in the night sky.": { word: "MOON", category: "Space" },
  "The red planet.": { word: "MARS", category: "Space" },
  "An icy object with a glowing tail.": { word: "COMET", category: "Space" },
  "A world that travels around a star.": { word: "PLANET", category: "Space" },
  "It blasts into space.": { word: "ROCKET", category: "Space" },
  "A person trained to travel in space.": { word: "ASTRONAUT", category: "Space" },
  "A tiny building block of matter.": { word: "ATOM", category: "Science" },
  "It helps your eyes see.": { word: "LIGHT", category: "Science" },
  "It makes things move or change.": { word: "ENERGY", category: "Science" },
  "The sound that follows lightning.": { word: "THUNDER", category: "Science" },
  "A mountain that can erupt.": { word: "VOLCANO", category: "Science" },
  "It pulls objects toward Earth.": { word: "GRAVITY", category: "Science" },
  "You sit on it.": { word: "CHAIR", category: "Everyday" },
  "A cheesy food cut into slices.": { word: "PIZZA", category: "Everyday" },
  "A place where students learn.": { word: "SCHOOL", category: "Everyday" },
  "Something you solve piece by piece.": { word: "PUZZLE", category: "Everyday" },
  "The room where food is prepared.": { word: "KITCHEN", category: "Everyday" },
  "A machine that follows digital instructions.": { word: "COMPUTER", category: "Everyday" },
};

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
  const choices = [answer, ...alternatives.filter((item) => item !== answer)].slice(0, 3);
  const rotated = choices.length === 3 ? [choices[1], choices[0], choices[2]] : choices;
  return { choices: rotated, answerIndex: rotated.indexOf(answer) };
}

function mathContext(headings: string[]): CoachContext | null {
  const expression = headings.find((text) => /\$?\d+(?:\.\d{2})?\s*[+−-]\s*\$?\d+(?:\.\d{2})?/.test(text));
  if (!expression) return null;
  const match = expression.match(/(\$?)(\d+(?:\.\d{2})?)\s*([+−-])\s*(\$?)(\d+(?:\.\d{2})?)/);
  if (!match) return null;
  const money = Boolean(match[1] || match[4] || match[2].includes(".") || match[5].includes("."));
  const left = money ? Math.round(Number(match[2]) * 100) : Number(match[2]);
  const right = money ? Math.round(Number(match[5]) * 100) : Number(match[5]);
  const operator = match[3] === "+" ? "+" : "−";
  const answer = operator === "+" ? left + right : left - right;
  const format = (value: number) => money ? `$${(value / 100).toFixed(2)}` : String(value);
  const skillId = money ? "math-money" : operator === "+" ? "math-addition" : "math-subtraction";
  const skillLabel = money ? "Money math" : operator === "+" ? "Addition" : "Subtraction";
  const checkAnswer = money ? 100 : operator === "+" ? left + 1 : Math.max(0, left - 1);
  const checkChoices = money
    ? ["100 cents", "10 cents", "1 cent"]
    : [String(checkAnswer), String(Math.max(0, checkAnswer - 1)), String(checkAnswer + 1)];
  const checkPrompt = money
    ? "How many cents are in one dollar?"
    : operator === "+"
      ? `Before adding ${right}, what is ${left} + 1?`
      : `Before taking away ${right}, what is ${left} − 1?`;

  return {
    gameSlug: "math-blast",
    skillId,
    skillLabel,
    prompt: expression,
    hints: money
      ? [
          "Turn each dollar amount into cents first. That removes the decimal point.",
          `Decide whether the sign tells you to combine the cents or take some away.`,
          `Work with ${left} cents ${operator} ${right} cents, then turn the result back into dollars.`,
        ]
      : operator === "+"
        ? [
            "Start with the larger number. Keep it in your head.",
            `Break ${right} into smaller jumps, such as tens and ones, and count up.`,
            `${left} + ${right} equals ${answer}. Check by counting on from ${left}.`,
          ]
        : [
            "Subtraction means finding what remains after taking some away.",
            `Take away ${right} in smaller chunks. Reaching a friendly number such as 10 can help.`,
            `${left} − ${right} equals ${answer}. Check by adding ${answer} + ${right}.`,
          ],
    explanation: `${expression} equals ${format(answer)}. ${operator === "+" ? "We combined the two amounts." : "We removed the second amount from the first."}`,
    check: {
      prompt: checkPrompt,
      choices: checkChoices,
      answerIndex: 0,
      explanation: money
        ? "One dollar is made of 100 cents. Converting dollars to cents makes money problems easier to organize."
        : operator === "+"
          ? `Adding one moves ${left} to ${checkAnswer}. That same count-up idea works for the larger problem.`
          : `Taking away one moves ${left} to ${checkAnswer}. Larger subtraction can be done through several small take-away steps.`,
    },
  };
}

function scienceContext(headings: string[]): CoachContext | null {
  const prompt = headings.find((text) => SCIENCE_FACTS[text]);
  if (!prompt) return null;
  const fact = SCIENCE_FACTS[prompt];
  const check = shuffledChoices(fact.answer, fact.choices);
  const topicClue: Record<ScienceFact["topic"], string> = {
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
      explanation: `${fact.answer} is the scientific idea supported by the explanation.`,
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
  const distractors = [String.fromCharCode(((first.charCodeAt(0) - 65 + 1) % 26) + 65), String.fromCharCode(((first.charCodeAt(0) - 65 + 2) % 26) + 65)];
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
