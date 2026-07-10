export type Game = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  subject: "Logic" | "Memory" | "Math" | "Reading" | "Creativity";
  age: string;
  status: "playable" | "coming-soon";
};

export const games: Game[] = [
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
    slug: "question-quest",
    title: "Question Quest",
    description: "Race through kid-sized science and world questions.",
    emoji: "🚀",
    subject: "Reading",
    age: "Ages 6+",
    status: "playable",
  },
  {
    slug: "guess-who",
    title: "Guess Who",
    description: "Ask smart questions and flip down the wrong cards.",
    emoji: "🕵️",
    subject: "Logic",
    age: "Ages 6+",
    status: "coming-soon",
  },
];
