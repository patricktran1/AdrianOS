"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import type { Game } from "@/lib/games";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./DinoHabitatBuilder.module.css";

const SLUG = "dino-habitat-builder";
const DESIGN_ROUNDS = new Set([1, 3]);

type Piece = { id: string; emoji: string; label: string };
type BuildPart = { emoji: string; label: string };
type Challenge = {
  prompt: string;
  instruction: string;
  pieces: Piece[];
  answerId: string;
  hint: string;
  explanation: string;
  subject: Game["subject"];
  skillId: string;
  skillLabel: string;
  standard: string;
  buildPart: BuildPart;
};
type World = { title: string; accent: string; dino: string; intro: string };
type DesignChoice = { emoji: string; label: string; description: string };

const p = (id: string, emoji: string, label: string): Piece => ({ id, emoji, label });
const c = (challenge: Challenge): Challenge => challenge;

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: { title: "Little Dino Garden", accent: "#ffd45c", dino: "🦕", intro: "Count, match, and build a cozy first habitat." },
  0: { title: "Rainbow Raptor Park", accent: "#ff9bd2", dino: "🦖", intro: "Use early math, sounds, and science to open a colorful park." },
  1: { title: "Robot Dino Reserve", accent: "#8dd7ff", dino: "🦖", intro: "Program a smart reserve with number facts and living-world clues." },
  2: { title: "Dino Canyon Sanctuary", accent: "#d9ff5b", dino: "🦕", intro: "Build Adrian's canyon with math strategy, habitat science, and useful clues." },
  3: { title: "Jurassic Systems Station", accent: "#c6b8ff", dino: "🦖", intro: "Use multiplication, division, and ecosystem systems to run the station." },
  4: { title: "Cretaceous Eco Temple", accent: "#ffcb66", dino: "🦕", intro: "Balance fractions, energy, and adaptations inside an ancient reserve." },
  5: { title: "Neo-Jurassic Biosphere", accent: "#77f1d0", dino: "🦖", intro: "Engineer a resilient biosphere with decimals, ecosystems, and design choices." },
};

function challengesForGrade(grade: ElementaryGrade): Challenge[] {
  if (grade === -1) return [
    c({ prompt: "The nest needs 3 eggs.", instruction: "Drag or tap the group with 3 eggs.", pieces: [p("two", "🥚🥚", "2 eggs"), p("three", "🥚🥚🥚", "3 eggs"), p("four", "🥚🥚🥚🥚", "4 eggs")], answerId: "three", hint: "Touch each egg once while you count.", explanation: "There are exactly 3 eggs.", subject: "Math", skillId: "math-counting", skillLabel: "Count objects", standard: "TK.CC.1", buildPart: { emoji: "🪺", label: "Nest" } }),
    c({ prompt: "What does a thirsty dinosaur need?", instruction: "Choose the thing that helps a living animal.", pieces: [p("water", "💧", "Water"), p("block", "🧱", "Toy block"), p("bell", "🔔", "Bell")], answerId: "water", hint: "Living animals need something to drink.", explanation: "Animals need water to live.", subject: "Science", skillId: "science-living-needs", skillLabel: "Living things need resources", standard: "TK-LS1-1", buildPart: { emoji: "💦", label: "Water pool" } }),
    c({ prompt: "Which roof shape has 3 sides?", instruction: "Pick the shape for the shelter roof.", pieces: [p("circle", "🔵", "Circle"), p("triangle", "🔺", "Triangle"), p("square", "🟩", "Square")], answerId: "triangle", hint: "Count the straight sides.", explanation: "A triangle has 3 sides.", subject: "Math", skillId: "math-shapes", skillLabel: "Identify shapes", standard: "TK.G.1", buildPart: { emoji: "⛺", label: "Shelter" } }),
    c({ prompt: "Finish the path: leaf, rock, leaf, rock...", instruction: "Choose what comes next.", pieces: [p("leaf", "🍃", "Leaf"), p("rock", "🪨", "Rock"), p("flower", "🌼", "Flower")], answerId: "leaf", hint: "The path repeats two pieces.", explanation: "Leaf comes after rock in the repeating pattern.", subject: "Math", skillId: "math-patterns", skillLabel: "Continue patterns", standard: "TK.MD.3", buildPart: { emoji: "🪨", label: "Walking path" } }),
    c({ prompt: "Which plant is tallest?", instruction: "Pick the tallest plant for the garden.", pieces: [p("short", "🌱", "Short sprout"), p("tall", "🌴", "Tall tree"), p("medium", "🌿", "Medium bush")], answerId: "tall", hint: "Look for the plant that reaches highest.", explanation: "The tall tree reaches highest.", subject: "Math", skillId: "math-measurement", skillLabel: "Compare height", standard: "TK.MD.1", buildPart: { emoji: "🌴", label: "Tall tree" } }),
  ];
  if (grade === 0) return [
    c({ prompt: "Four berries plus three berries makes how many?", instruction: "Choose the food basket total.", pieces: [p("six", "🫐 6", "6 berries"), p("seven", "🫐 7", "7 berries"), p("eight", "🫐 8", "8 berries")], answerId: "seven", hint: "Count on three from 4: 5, 6, 7.", explanation: "4 + 3 = 7.", subject: "Math", skillId: "math-addition", skillLabel: "Add within 10", standard: "K.OA.A.2", buildPart: { emoji: "🫐", label: "Berry patch" } }),
    c({ prompt: "What helps a park plant grow?", instruction: "Choose the resource the plant uses.", pieces: [p("sun", "☀️", "Sunlight"), p("shoe", "👟", "Shoe"), p("drum", "🥁", "Drum")], answerId: "sun", hint: "Plants use light to grow.", explanation: "Plants need sunlight and water.", subject: "Science", skillId: "science-plant-needs", skillLabel: "Plant needs", standard: "K-LS1-1", buildPart: { emoji: "🌻", label: "Sunny garden" } }),
    c({ prompt: "Which word starts with the same sound as sun?", instruction: "Pick the matching beginning sound.", pieces: [p("sock", "🧦", "Sock"), p("moon", "🌙", "Moon"), p("fish", "🐟", "Fish")], answerId: "sock", hint: "Sun starts with /s/.", explanation: "Sun and sock both start with /s/.", subject: "Reading", skillId: "reading-phonemic-awareness", skillLabel: "Beginning sounds", standard: "K.RF.2", buildPart: { emoji: "🪧", label: "Sound sign" } }),
    c({ prompt: "What happens after a dinosaur egg cracks?", instruction: "Choose the next life-cycle picture.", pieces: [p("hatchling", "🐣", "Hatchling"), p("cloud", "☁️", "Cloud"), p("boat", "⛵", "Boat")], answerId: "hatchling", hint: "A young animal comes out of an egg.", explanation: "A hatchling comes after the egg cracks.", subject: "Science", skillId: "science-life-cycles", skillLabel: "Animal life cycles", standard: "K-LS1-1", buildPart: { emoji: "🐣", label: "Hatchery" } }),
    c({ prompt: "Which shape has 4 equal sides?", instruction: "Choose the strongest floor tile.", pieces: [p("square", "🟦", "Square"), p("triangle", "🔺", "Triangle"), p("circle", "🟣", "Circle")], answerId: "square", hint: "Count the sides and compare their lengths.", explanation: "A square has 4 equal sides.", subject: "Math", skillId: "math-shapes", skillLabel: "Describe shapes", standard: "K.G.B.4", buildPart: { emoji: "🟦", label: "Floor tiles" } }),
  ];
  if (grade === 1) return [
    c({ prompt: "The feeder has 8 leaves. Add 7 more.", instruction: "Choose the new feeder total.", pieces: [p("14", "🌿 14", "14 leaves"), p("15", "🌿 15", "15 leaves"), p("16", "🌿 16", "16 leaves")], answerId: "15", hint: "Make 10 with 2, then add the remaining 5.", explanation: "8 + 7 = 15.", subject: "Math", skillId: "math-addition", skillLabel: "Add within 20", standard: "1.OA.C.6", buildPart: { emoji: "🌿", label: "Leaf feeder" } }),
    c({ prompt: "The pond has 17 fish. Nine swim away.", instruction: "Choose how many fish remain.", pieces: [p("7", "🐟 7", "7 fish"), p("8", "🐟 8", "8 fish"), p("9", "🐟 9", "9 fish")], answerId: "8", hint: "Count back from 17, or think 9 + 8 = 17.", explanation: "17 − 9 = 8.", subject: "Math", skillId: "math-subtraction", skillLabel: "Subtract within 20", standard: "1.OA.C.6", buildPart: { emoji: "🐟", label: "Fish pond" } }),
    c({ prompt: "Which plant part pulls water from the soil?", instruction: "Choose the part hidden underground.", pieces: [p("roots", "🪴", "Roots"), p("flower", "🌸", "Flower"), p("fruit", "🍎", "Fruit")], answerId: "roots", hint: "It grows below the stem.", explanation: "Roots absorb water from soil.", subject: "Science", skillId: "science-plant-parts", skillLabel: "Plant structures", standard: "1-LS1-1", buildPart: { emoji: "🌳", label: "Root grove" } }),
    c({ prompt: "The path counts by 2s: 4, 6, 8, 10...", instruction: "Choose the next checkpoint.", pieces: [p("11", "🚩 11", "11"), p("12", "🚩 12", "12"), p("13", "🚩 13", "13")], answerId: "12", hint: "Add 2 to 10.", explanation: "The next number is 12.", subject: "Math", skillId: "math-place-value", skillLabel: "Skip count by twos", standard: "1.NBT.A.1", buildPart: { emoji: "🚩", label: "Checkpoint path" } }),
    c({ prompt: "Which sentence tells why the shelter has a roof?", instruction: "Choose the useful design reason.", pieces: [p("dry", "🌧️➡️🏠", "It keeps rain off the dinosaurs."), p("loud", "📣", "It makes the habitat louder."), p("roll", "🛞", "It helps the shelter roll.")], answerId: "dry", hint: "Think about what a roof blocks.", explanation: "A roof helps keep animals dry.", subject: "Reading", skillId: "reading-key-details", skillLabel: "Use a key detail", standard: "1.RI.1", buildPart: { emoji: "🏠", label: "Rain shelter" } }),
  ];
  if (grade === 2) return [
    c({ prompt: "The watering tank holds 27 liters. Add 18 more.", instruction: "Choose the meter the tank should show.", pieces: [p("35", "💧 35", "35 liters"), p("45", "💧 45", "45 liters"), p("55", "💧 55", "55 liters")], answerId: "45", hint: "Jump 3 to 30, then add the remaining 15.", explanation: "27 + 18 = 45.", subject: "Math", skillId: "math-addition", skillLabel: "Add within 100", standard: "2.NBT.B.5", buildPart: { emoji: "💦", label: "Watering pond" } }),
    c({ prompt: "Which plant belongs in a Triceratops feeding zone?", instruction: "Choose food for a plant-eating dinosaur.", pieces: [p("fern", "🌿", "Fern"), p("candy", "🍭", "Candy"), p("plastic", "🧸", "Plastic toy")], answerId: "fern", hint: "A Triceratops was a herbivore.", explanation: "Herbivores eat plants such as ferns.", subject: "Science", skillId: "science-habitats", skillLabel: "Match animals to resources", standard: "2-LS4-1", buildPart: { emoji: "🌿", label: "Fern meadow" } }),
    c({ prompt: "A fence has 52 boards. Seventeen are used.", instruction: "Choose how many boards remain.", pieces: [p("25", "🪵 25", "25 boards"), p("35", "🪵 35", "35 boards"), p("45", "🪵 45", "45 boards")], answerId: "35", hint: "Jump back 2 to 50, then 15 more.", explanation: "52 − 17 = 35.", subject: "Math", skillId: "math-subtraction", skillLabel: "Subtract within 100", standard: "2.NBT.B.5", buildPart: { emoji: "🪵", label: "Safety fence" } }),
    c({ prompt: "Why should the shelter roof be wide?", instruction: "Choose the design reason supported by habitat needs.", pieces: [p("shade", "🌤️", "It gives shade and keeps the resting area dry."), p("music", "🎵", "It teaches the dinosaurs music."), p("speed", "🏎️", "It makes the dinosaurs run faster.")], answerId: "shade", hint: "A shelter protects an animal from weather.", explanation: "A wide roof provides shade and protection from rain.", subject: "Reading", skillId: "reading-key-details", skillLabel: "Explain a design using details", standard: "2.RI.1", buildPart: { emoji: "⛺", label: "Wide shelter" } }),
    c({ prompt: "Count by 5s: 25, 30, 35, 40, 45, __", instruction: "Choose the observation-tower height.", pieces: [p("48", "🗼 48", "48 feet"), p("50", "🗼 50", "50 feet"), p("55", "🗼 55", "55 feet")], answerId: "50", hint: "Add 5 to 45.", explanation: "The next multiple of 5 is 50.", subject: "Math", skillId: "math-place-value", skillLabel: "Skip count by fives", standard: "2.NBT.A.2", buildPart: { emoji: "🗼", label: "Observation tower" } }),
  ];
  if (grade === 3) return [
    c({ prompt: "Six feeding trays hold 4 bundles each.", instruction: "Choose the total number of bundles.", pieces: [p("20", "🌾 20", "20 bundles"), p("24", "🌾 24", "24 bundles"), p("28", "🌾 28", "28 bundles")], answerId: "24", hint: "Add 4 six times.", explanation: "6 × 4 = 24.", subject: "Math", skillId: "math-multiplication", skillLabel: "Multiply within 100", standard: "3.OA.A.1", buildPart: { emoji: "🌾", label: "Feeding station" } }),
    c({ prompt: "Which sequence shows a dinosaur life cycle?", instruction: "Choose the sequence in order.", pieces: [p("cycle", "🥚 → 🐣 → 🦕", "Egg, hatchling, adult"), p("reverse", "🦕 → 🥚 → 🐣", "Adult, egg, hatchling"), p("weather", "☀️ → 🌧️ → ❄️", "Sun, rain, snow")], answerId: "cycle", hint: "Life begins in the egg.", explanation: "Egg, hatchling, then adult is the correct sequence.", subject: "Science", skillId: "science-life-cycles", skillLabel: "Model a life cycle", standard: "3-LS1-1", buildPart: { emoji: "🥚", label: "Hatchery lab" } }),
    c({ prompt: "Twenty-eight fence lights are split into groups of 7.", instruction: "Choose the number of groups.", pieces: [p("3", "💡 3", "3 groups"), p("4", "💡 4", "4 groups"), p("5", "💡 5", "5 groups")], answerId: "4", hint: "What number times 7 equals 28?", explanation: "28 ÷ 7 = 4.", subject: "Math", skillId: "math-division", skillLabel: "Divide within 100", standard: "3.OA.A.2", buildPart: { emoji: "💡", label: "Fence lights" } }),
    c({ prompt: "Which feature helps a small dinosaur hide?", instruction: "Choose the useful adaptation.", pieces: [p("camouflage", "🍃🦎", "Colors that match leaves"), p("bell", "🔔", "A loud bell"), p("glitter", "✨", "Bright glitter")], answerId: "camouflage", hint: "Hiding works best when colors blend in.", explanation: "Camouflage makes an animal harder to see.", subject: "Science", skillId: "science-adaptations", skillLabel: "Explain adaptations", standard: "3-LS4-2", buildPart: { emoji: "🍃", label: "Camouflage grove" } }),
    c({ prompt: "A rectangular nesting floor is 6 feet by 3 feet.", instruction: "Choose its area.", pieces: [p("9", "⬛ 9", "9 square feet"), p("18", "⬛ 18", "18 square feet"), p("20", "⬛ 20", "20 square feet")], answerId: "18", hint: "Multiply length by width.", explanation: "6 × 3 = 18 square feet.", subject: "Math", skillId: "math-area", skillLabel: "Find rectangle area", standard: "3.MD.C.7", buildPart: { emoji: "⬛", label: "Nesting floor" } }),
  ];
  if (grade === 4) return [
    c({ prompt: "Three of four water gates should be open.", instruction: "Choose the matching fraction.", pieces: [p("half", "◐", "1/2"), p("three-fourths", "◕", "3/4"), p("one-fourth", "◔", "1/4")], answerId: "three-fourths", hint: "Three selected parts out of four is three fourths.", explanation: "3 of 4 equal parts is 3/4.", subject: "Math", skillId: "math-fractions", skillLabel: "Model fractions", standard: "4.NF.B.3", buildPart: { emoji: "🚰", label: "Water gates" } }),
    c({ prompt: "Which organism starts this habitat food chain?", instruction: "Choose the producer.", pieces: [p("grass", "🌱", "Grass"), p("raptor", "🦖", "Raptor"), p("fungus", "🍄", "Fungus")], answerId: "grass", hint: "A producer makes food using sunlight.", explanation: "Grass is a producer at the base of the food chain.", subject: "Science", skillId: "science-food-webs", skillLabel: "Trace energy in a food web", standard: "4-LS1-1", buildPart: { emoji: "🌱", label: "Producer field" } }),
    c({ prompt: "Seven paddocks need 36 stones each.", instruction: "Choose the total number of stones.", pieces: [p("242", "🪨 242", "242 stones"), p("252", "🪨 252", "252 stones"), p("262", "🪨 262", "262 stones")], answerId: "252", hint: "Multiply 7 by 30 and 7 by 6, then combine.", explanation: "7 × 36 = 252.", subject: "Math", skillId: "math-multi-digit-multiplication", skillLabel: "Multiply by one digit", standard: "4.NBT.B.5", buildPart: { emoji: "🪨", label: "Stone paddocks" } }),
    c({ prompt: "Which trait would help a dinosaur reach high leaves?", instruction: "Choose the helpful body structure.", pieces: [p("neck", "🦒", "A long neck"), p("tiny", "🤏", "Tiny feet"), p("flat", "🪨", "A flat tail")], answerId: "neck", hint: "The food is above the dinosaur.", explanation: "A long neck helps an herbivore reach high leaves.", subject: "Science", skillId: "science-structures", skillLabel: "Connect structures to function", standard: "4-LS1-1", buildPart: { emoji: "🌳", label: "High canopy" } }),
    c({ prompt: "Which fraction is equal to 2/4?", instruction: "Choose the equivalent viewing-platform length.", pieces: [p("one-half", "1/2", "1/2"), p("one-third", "1/3", "1/3"), p("three-fourths", "3/4", "3/4")], answerId: "one-half", hint: "Divide the numerator and denominator by 2.", explanation: "2/4 is equivalent to 1/2.", subject: "Math", skillId: "math-fractions", skillLabel: "Equivalent fractions", standard: "4.NF.A.1", buildPart: { emoji: "🌉", label: "Halfway bridge" } }),
  ];
  return [
    c({ prompt: "The reservoir is 0.40 full. Add 0.32.", instruction: "Choose the new fill level.", pieces: [p("0.62", "💧 .62", "0.62"), p("0.72", "💧 .72", "0.72"), p("0.82", "💧 .82", "0.82")], answerId: "0.72", hint: "Add the hundredths: 40 + 32.", explanation: "0.40 + 0.32 = 0.72.", subject: "Math", skillId: "math-decimals", skillLabel: "Add decimals", standard: "5.NBT.B.7", buildPart: { emoji: "💧", label: "Smart reservoir" } }),
    c({ prompt: "Which organism recycles dead material in the biosphere?", instruction: "Choose the decomposer.", pieces: [p("fungus", "🍄", "Fungus"), p("fern", "🌿", "Fern"), p("raptor", "🦖", "Raptor")], answerId: "fungus", hint: "Decomposers break down dead matter.", explanation: "Fungi return nutrients to an ecosystem.", subject: "Science", skillId: "science-ecosystems", skillLabel: "Model ecosystem roles", standard: "5-LS2-1", buildPart: { emoji: "🍄", label: "Nutrient garden" } }),
    c({ prompt: "Eighty-four solar tiles are placed in rows of 7.", instruction: "Choose the number of rows.", pieces: [p("10", "☀️ 10", "10 rows"), p("12", "☀️ 12", "12 rows"), p("14", "☀️ 14", "14 rows")], answerId: "12", hint: "Find the number that makes 7 × ? = 84.", explanation: "84 ÷ 7 = 12.", subject: "Math", skillId: "math-division", skillLabel: "Divide whole numbers", standard: "5.NBT.B.6", buildPart: { emoji: "☀️", label: "Solar array" } }),
    c({ prompt: "The wetland uses 1/2 of the zone and trees use 1/4.", instruction: "Choose the combined fraction.", pieces: [p("two-fourths", "2/4", "2/4"), p("three-fourths", "3/4", "3/4"), p("four-fourths", "4/4", "4/4")], answerId: "three-fourths", hint: "One half equals two fourths.", explanation: "1/2 + 1/4 = 3/4.", subject: "Math", skillId: "math-fractions", skillLabel: "Add fractions", standard: "5.NF.A.1", buildPart: { emoji: "🌊", label: "Wetland zone" } }),
    c({ prompt: "Which ground layer drains storm water best?", instruction: "Choose the material with spaces for water to pass through.", pieces: [p("gravel", "🪨", "Gravel"), p("plastic", "🧱", "Solid plastic"), p("glass", "🪟", "Glass sheet")], answerId: "gravel", hint: "Water can move through gaps between small stones.", explanation: "Gravel is permeable and improves drainage.", subject: "Engineering", skillId: "engineering-materials", skillLabel: "Choose materials by function", standard: "3-5-ETS1-2", buildPart: { emoji: "🪨", label: "Drainage bed" } }),
  ];
}

const DESIGN_CHOICES: DesignChoice[][] = [
  [{ emoji: "🌋", label: "Volcano skyline", description: "Add a glowing volcano beyond the habitat." }, { emoji: "🌈", label: "Rainbow falls", description: "Add a bright waterfall and mist." }],
  [{ emoji: "🦴", label: "Fossil gate", description: "Open the reserve through a fossil arch." }, { emoji: "🚀", label: "Future lab", description: "Add a glass research pod." }],
];

function rotate<T>(items: T[], amount: number): T[] {
  const offset = ((amount % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export default function DinoHabitatBuilderGame() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(SLUG);
  const [grade, setGrade] = useState<ElementaryGrade>(() => readProfileGrade(activeProfile));
  const [runSeed, setRunSeed] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [independent, setIndependent] = useState(0);
  const [builtParts, setBuiltParts] = useState<BuildPart[]>([]);
  const [designs, setDesigns] = useState<DesignChoice[]>([]);
  const [solved, setSolved] = useState(false);
  const [designPending, setDesignPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("Drag or tap the best habitat piece.");
  const timerRef = useRef<number | null>(null);
  const world = WORLDS[grade];
  const challenges = useMemo(() => rotate(challengesForGrade(grade), runSeed), [grade, runSeed]);
  const challenge = challenges[roundIndex];

  useEffect(() => {
    if (hydrated) setGrade(readProfileGrade(activeProfile));
  }, [activeProfile, hydrated]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function schedule(callback: () => void, delay: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(callback, delay);
  }

  function finishOrAdvance(finalIndependent: number) {
    if (roundIndex === challenges.length - 1) {
      completeGame({ xp: 38 + finalIndependent * 4, coins: 10 + finalIndependent, score: 1320 + finalIndependent * 90 + designs.length * 75 });
      setDone(true);
      return;
    }
    setRoundIndex((value) => value + 1);
    setMisses(0);
    setSolved(false);
    setDesignPending(false);
    setMessage("New build order ready. Drag or tap the best piece.");
  }

  function choosePiece(pieceId: string) {
    if (solved || designPending || done) return;
    const chosen = challenge.pieces.find((candidate) => candidate.id === pieceId);
    if (!chosen) return;
    const correct = chosen.id === challenge.answerId;
    recordLearningAttempt({ gameSlug: SLUG, subject: challenge.subject, skillId: challenge.skillId, skillLabel: challenge.skillLabel, prompt: challenge.prompt, correctAnswer: challenge.pieces.find((candidate) => candidate.id === challenge.answerId)?.label ?? challenge.answerId, correct, data: { grade, standardCode: challenge.standard, supportUsed: misses > 0, interaction: "habitat-build", runSeed } }, activeProfile.id);
    if (!correct) {
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setMessage(nextMisses === 1 ? `Builder clue: ${challenge.hint}` : `Blueprint answer: ${challenge.explanation}`);
      return;
    }
    const finalIndependent = independent + (misses === 0 ? 1 : 0);
    setIndependent(finalIndependent);
    setSolved(true);
    setBuiltParts((parts) => [...parts, challenge.buildPart]);
    setMessage(`${challenge.buildPart.label} installed. ${challenge.explanation}`);
    if (DESIGN_ROUNDS.has(roundIndex)) {
      setDesignPending(true);
      return;
    }
    schedule(() => finishOrAdvance(finalIndependent), 720);
  }

  function chooseDesign(choice: DesignChoice) {
    if (!designPending) return;
    setDesigns((items) => [...items, choice]);
    setDesignPending(false);
    setMessage(`${choice.label} added. Loading the next build order…`);
    schedule(() => finishOrAdvance(independent), 520);
  }

  function replay() {
    restartGame();
    setRunSeed((value) => value + 1);
    setRoundIndex(0);
    setMisses(0);
    setIndependent(0);
    setBuiltParts([]);
    setDesigns([]);
    setSolved(false);
    setDesignPending(false);
    setDone(false);
    setMessage("New blueprint shuffled. Drag or tap the best habitat piece.");
  }

  const scene = (
    <section className={styles.scene} style={{ "--accent": world.accent } as React.CSSProperties} aria-label="Dinosaur habitat construction zone" data-habitat-parts={builtParts.length} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choosePiece(event.dataTransfer.getData("text/plain")); }}>
      <div className={styles.skyGlow} />
      <div className={styles.designLayer} aria-label="Chosen habitat designs">{designs.map((choice, index) => <span key={`${choice.label}-${index}`} className={styles.designItem} title={choice.label}>{choice.emoji}</span>)}</div>
      <div className={styles.dino} aria-hidden="true">{world.dino}</div>
      <div className={styles.buildGrid}>{Array.from({ length: 5 }, (_, index) => { const part = builtParts[index]; return <div key={index} className={styles.buildSlot} data-filled={part ? "true" : "false"}>{part ? <><span>{part.emoji}</span><small>{part.label}</small></> : <span className={styles.emptySlot}>{index + 1}</span>}</div>; })}</div>
      <div className={styles.ground} />
    </section>
  );

  if (done) return <GameFrame title={world.title}><main className={styles.page} style={{ "--accent": world.accent } as React.CSSProperties}><section className={styles.complete} data-habitat-complete="true"><span className={styles.eyebrow}>HABITAT COMPLETE</span><h1>{activeProfile.name} built a living dino world.</h1><p>{builtParts.length} verified build orders · {independent} independent solves · {designs.length} design choices</p>{scene}<button type="button" onClick={replay} className={styles.primary}>Remix the habitat →</button></section></main></GameFrame>;

  const selectedDesignChoices = DESIGN_CHOICES[roundIndex === 1 ? 0 : 1];
  return <GameFrame title={world.title}><main className={styles.page} style={{ "--accent": world.accent } as React.CSSProperties} data-habitat-game="active" data-run-seed={runSeed}><header className={styles.hud}><div><span className={styles.eyebrow}>BUILD {roundIndex + 1} OF {challenges.length}</span><strong>{world.title}</strong></div><div className={styles.hudStats}><span>🏗️ {builtParts.length}/5</span><span>✨ {independent}</span></div></header><div className={styles.layout}>{scene}<section className={styles.challengeCard}><div className={styles.challengeTop}><span className={styles.standard}>{challenge.standard}</span><span className={styles.subject}>{challenge.subject}</span></div><h1>{challenge.prompt}</h1><p className={styles.instruction}>{challenge.instruction}</p><div className={styles.pieceTray} aria-label="Habitat pieces">{challenge.pieces.map((item) => <button key={item.id} type="button" draggable={!solved} onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)} onClick={() => choosePiece(item.id)} disabled={solved || designPending} className={styles.pieceButton} data-piece-id={item.id} data-correct={item.id === challenge.answerId ? "true" : "false"}><span aria-hidden="true">{item.emoji}</span><strong>{item.label}</strong><small>Tap or drag</small></button>)}</div>{designPending && <section className={styles.designChoice} aria-label="Choose a habitat design" data-design-choice="active"><span className={styles.eyebrow}>YOUR WORLD, YOUR CALL</span><h2>Choose what appears next.</h2><div className={styles.designGrid}>{selectedDesignChoices.map((choice) => <button key={choice.label} type="button" onClick={() => chooseDesign(choice)}><span aria-hidden="true">{choice.emoji}</span><strong>{choice.label}</strong><small>{choice.description}</small></button>)}</div></section>}<section role="status" aria-live="polite" className={styles.coach} data-misses={misses}><strong>{misses > 0 ? "BUILD COACH" : solved ? "PIECE INSTALLED" : "BLUEPRINT"}</strong><p>{message}</p></section></section></div></main></GameFrame>;
}
