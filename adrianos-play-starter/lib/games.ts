export type Game = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  subject:
    | "Logic"
    | "Memory"
    | "Math"
    | "Reading"
    | "Science"
    | "Creativity";
  age: string;
  status: "playable" | "coming-soon";
};

export const games: Game[] = [
  {
    slug: "guess-who",
    title: "Guess Who",
    description: "Ask smart questions and flip down the wrong cards.",
    emoji: "🕵️",
    subject: "Logic",
    age: "Ages 6+",
    status: "playable",
  },
  {
    slug: "memory-match",
    title: "Memory Match",
    description: "Flip cards, find pairs, and sharpen visual memory.",
    emoji: "🧠",
    subject: "Memory",
    age: "Ages 5+",
    status: "playable",
  },
  {
    slug: "math-blast",
    title: "Math Blast",
    description: "Build streaks with addition and subtraction missions.",
    emoji: "⚡",
    subject: "Math",
    age: "Ages 6+",
    status: "playable",
  },
  {
    slug: "word-builder",
    title: "Word Builder",
    description: "Unscramble letters using clues and build new words.",
    emoji: "🔤",
    subject: "Reading",
    age: "Ages 6+",
    status: "playable",
  },
  {
    slug: "science-quest",
    title: "Science Quest",
    description: "Explore lightning, snow, computers, bodies, and more.",
    emoji: "🔬",
    subject: "Science",
    age: "Ages 6+",
    status: "playable",
  },
  {
    slug: "question-quest",
    title: "Question Quest",
    description: "Race through kid-sized world questions.",
    emoji: "🚀",
    subject: "Reading",
    age: "Ages 6+",
    status: "playable",
  },
];
