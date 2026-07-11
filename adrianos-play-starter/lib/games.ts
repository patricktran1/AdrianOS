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
    | "Geography"
    | "Coding"
    | "Creativity";
  age: string;
  status: "playable" | "coming-soon";
};
