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
    | "History"
    | "Civics"
    | "Economics"
    | "Wellbeing"
    | "Health"
    | "Digital Citizenship"
    | "Music"
    | "Art"
    | "Engineering"
    | "Movement"
    | "Life Skills"
    | "Environment"
    | "Learning Skills"
    | "Coding"
    | "Creativity";
  age: string;
  status: "playable" | "coming-soon";
};
