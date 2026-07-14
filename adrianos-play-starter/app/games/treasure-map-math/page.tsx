"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TreasureMapMath.module.css";

const SLUG = "treasure-map-math";
const BIOMES = ["lagoon", "volcano", "jungle", "moonlit"] as const;
const MAP_POINTS = [
  { x: 10, y: 78 },
  { x: 24, y: 60 },
  { x: 42, y: 70 },
  { x: 57, y: 45 },
  { x: 73, y: 56 },
  { x: 88, y: 30 },
  { x: 92, y: 14 },
] as const;

type Mechanic = "sail" | "cannon" | "cargo";
type Choice = { id: string; emoji: string; label: string };
type Mission = {
  mechanic: Mechanic;
  prompt: string;
  instruction: string;
  choices: Choice[];
  answerId: string;
  hint: string;
  explanation: string;
  skillId: string;
  skillLabel: string;
  standard: string;
  landmark: { emoji: string; label: string };
};
type World = { title: string; accent: string; ship: string; intro: string };

type MissionSeed = Omit<Mission, "mechanic" | "landmark"> & {
  mechanic?: Mechanic;
  landmark?: Mission["landmark"];
};

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: { title: "Little Pirate Lagoon", accent: "#ffd45c", ship: "⛵", intro: "Count shells and steer to tiny treasure islands." },
  0: { title: "Rainbow Treasure Bay", accent: "#ff9bd2", ship: "⛵", intro: "Use early number clues to sail a bright island chain." },
  1: { title: "Robot Pirate Passage", accent: "#8dd7ff", ship: "🚤", intro: "Use number facts to guide a clever treasure ship." },
  2: { title: "Dino Treasure Archipelago", accent: "#d9ff5b", ship: "🏴‍☠️", intro: "Steer through dino islands with addition, subtraction, groups, and sharing." },
  3: { title: "Multiplication Marauder Sea", accent: "#c6b8ff", ship: "🏴‍☠️", intro: "Use multiplication and division to unlock a legendary route." },
  4: { title: "Fraction Temple Waters", accent: "#ffcb66", ship: "⛵", intro: "Navigate fractions and multi-digit clues around ancient islands." },
  5: { title: "Decimal Deep-Sea Expedition", accent: "#77f1d0", ship: "🚢", intro: "Pilot through decimals, fractions, and volume challenges." },
};

const LANDMARKS: Mission["landmark"][] = [
  { emoji: "🌴", label: "Palm Key" },
  { emoji: "🌋", label: "Volcano Rock" },
  { emoji: "🦜", label: "Parrot Point" },
  { emoji: "🗿", label: "Statue Isle" },
  { emoji: "🐙", label: "Octopus Reef" },
  { emoji: "💎", label: "Treasure Crown" },
];

const MECHANICS: Mechanic[] = ["sail", "cannon", "cargo", "sail", "cannon", "cargo"];

function choice(id: string | number, emoji: string, label?: string): Choice {
  return { id: String(id), emoji, label: label ?? String(id) };
}

function seed(
  prompt: string,
  answerId: string | number,
  options: Array<[string | number, string, string?]>,
  details: Pick<Mission, "instruction" | "hint" | "explanation" | "skillId" | "skillLabel" | "standard">,
): MissionSeed {
  return {
    prompt,
    answerId: String(answerId),
    choices: options.map(([id, emoji, label]) => choice(id, emoji, label)),
    ...details,
  };
}

function missionSeedsForGrade(grade: ElementaryGrade): MissionSeed[] {
  if (grade === -1) return [
    seed("Three shells mark the safe route. Which group has 3?", 3, [[2, "🐚🐚", "2 shells"], [3, "🐚🐚🐚", "3 shells"], [4, "🐚🐚🐚🐚", "4 shells"]], { instruction: "Tap or drag the route with exactly 3 shells.", hint: "Touch each shell once while you count.", explanation: "Three shells point to Palm Key.", skillId: "math-counting", skillLabel: "Count objects", standard: "TK.CC.1" }),
    seed("The cannon needs 2 star sparks. Which power has 2?", 2, [[1, "⭐", "1 spark"], [2, "⭐⭐", "2 sparks"], [3, "⭐⭐⭐", "3 sparks"]], { instruction: "Load the cannon with 2 sparks.", hint: "Count the stars slowly.", explanation: "Two sparks wake the volcano beacon.", skillId: "math-counting", skillLabel: "Count objects", standard: "TK.CC.1" }),
    seed("One coin plus one coin makes how many?", 2, [[1, "🪙", "1 coin"], [2, "🪙🪙", "2 coins"], [3, "🪙🪙🪙", "3 coins"]], { instruction: "Load the cargo crate with the total.", hint: "Start with 1 and count one more.", explanation: "1 + 1 = 2.", skillId: "math-addition", skillLabel: "Join small groups", standard: "TK.OA.1" }),
    seed("Which flag comes next: red, blue, red, blue...?", "red", [["red", "🚩", "Red flag"], ["blue", "🏳️", "Blue flag"], ["green", "🟩", "Green flag"]], { instruction: "Choose the next flag in the pattern.", hint: "The colors take turns.", explanation: "Red comes after blue in the repeating pattern.", skillId: "math-patterns", skillLabel: "Continue patterns", standard: "TK.MD.3" }),
    seed("The bridge needs the shape with 3 sides.", "triangle", [["circle", "⚪", "Circle"], ["triangle", "🔺", "Triangle"], ["square", "🟦", "Square"]], { instruction: "Fire at the 3-sided bridge tile.", hint: "Count the straight sides.", explanation: "A triangle has 3 sides.", skillId: "math-shapes", skillLabel: "Identify shapes", standard: "TK.G.1" }),
    seed("Four coins are shared by 2 pirates. Which picture gives each pirate the same amount?", 2, [[1, "🪙", "1 each"], [2, "🪙🪙", "2 each"], [3, "🪙🪙🪙", "3 each"]], { instruction: "Choose the equal share for each pirate.", hint: "Give one coin to each pirate, then do it again.", explanation: "Each pirate gets 2 coins.", skillId: "math-sharing", skillLabel: "Share equally", standard: "TK.OA.2" }),
  ];
  if (grade === 0) return [
    seed("Four coconuts plus 3 coconuts makes how many?", 7, [[6, "🥥 6"], [7, "🥥 7"], [8, "🥥 8"]], { instruction: "Set a course for the correct total.", hint: "Count on three from 4: 5, 6, 7.", explanation: "4 + 3 = 7.", skillId: "math-addition", skillLabel: "Add within 10", standard: "K.OA.A.2" }),
    seed("The fort has 8 flags. Two blow away. How many remain?", 6, [[5, "🚩 5"], [6, "🚩 6"], [7, "🚩 7"]], { instruction: "Aim the cannon at the remaining number.", hint: "Count back twice from 8.", explanation: "8 − 2 = 6.", skillId: "math-subtraction", skillLabel: "Subtract within 10", standard: "K.OA.A.2" }),
    seed("Which crate holds a group of 5 gems?", 5, [[4, "💎💎💎💎", "4 gems"], [5, "💎💎💎💎💎", "5 gems"], [6, "💎 6", "6 gems"]], { instruction: "Load the crate with exactly 5 gems.", hint: "Count each gem once.", explanation: "The five-gem crate is ready.", skillId: "math-counting", skillLabel: "Count objects", standard: "K.CC.B.5" }),
    seed("Find the number that comes after 6.", 7, [[5, "🧭 5"], [7, "🧭 7"], [8, "🧭 8"]], { instruction: "Steer to the next number.", hint: "Count one more than 6.", explanation: "The number after 6 is 7.", skillId: "math-counting", skillLabel: "Count forward", standard: "K.CC.A.2" }),
    seed("Which island shape has 4 equal sides?", "square", [["triangle", "🔺", "Triangle"], ["square", "🟦", "Square"], ["circle", "🟣", "Circle"]], { instruction: "Fire at the four-equal-side shape.", hint: "A square has four straight sides of the same length.", explanation: "The square unlocks Statue Isle.", skillId: "math-shapes", skillLabel: "Describe shapes", standard: "K.G.B.4" }),
    seed("Six coins split equally between 2 pirates gives how many each?", 3, [[2, "🪙 2"], [3, "🪙 3"], [4, "🪙 4"]], { instruction: "Load the equal share into each chest.", hint: "Deal one coin to each pirate until all 6 are used.", explanation: "Each pirate gets 3 coins.", skillId: "math-sharing", skillLabel: "Share equally", standard: "K.OA.A.3" }),
  ];
  if (grade === 1) return [
    seed("Eight map marks plus 7 more makes how many?", 15, [[14, "🗺️ 14"], [15, "🗺️ 15"], [16, "🗺️ 16"]], { instruction: "Steer to the route total.", hint: "Make 10 with 2, then add the remaining 5.", explanation: "8 + 7 = 15.", skillId: "math-addition", skillLabel: "Add within 20", standard: "1.OA.C.6" }),
    seed("Seventeen cannonballs minus 9 leaves how many?", 8, [[7, "💣 7"], [8, "💣 8"], [9, "💣 9"]], { instruction: "Set the cannon to the number left.", hint: "Think 9 + 8 = 17.", explanation: "17 − 9 = 8.", skillId: "math-subtraction", skillLabel: "Subtract within 20", standard: "1.OA.C.6" }),
    seed("Three crates hold 4 coins each. How many coins altogether?", 12, [[10, "📦 10"], [12, "📦 12"], [14, "📦 14"]], { instruction: "Load the cargo total.", hint: "Add 4 + 4 + 4.", explanation: "Three groups of 4 make 12.", skillId: "math-equal-groups", skillLabel: "Build equal groups", standard: "1.OA.A.1" }),
    seed("The route counts by 2s: 4, 6, 8, 10, __.", 12, [[11, "🧭 11"], [12, "🧭 12"], [13, "🧭 13"]], { instruction: "Steer to the next checkpoint.", hint: "Add 2 to 10.", explanation: "The next checkpoint is 12.", skillId: "math-place-value", skillLabel: "Skip count by twos", standard: "1.NBT.A.1" }),
    seed("A bridge uses 13 planks. Five break. How many remain?", 8, [[7, "🪵 7"], [8, "🪵 8"], [9, "🪵 9"]], { instruction: "Aim at the number of safe planks.", hint: "Count back five from 13.", explanation: "13 − 5 = 8.", skillId: "math-subtraction", skillLabel: "Subtract within 20", standard: "1.OA.C.6" }),
    seed("Ten gems split equally between 2 captains gives how many each?", 5, [[4, "💎 4"], [5, "💎 5"], [6, "💎 6"]], { instruction: "Load the equal gem share.", hint: "Five and five make 10.", explanation: "Each captain gets 5 gems.", skillId: "math-sharing", skillLabel: "Share equally", standard: "1.OA.A.1" }),
  ];
  if (grade === 2) return [
    seed("You found 4 gold coins, then 3 more. How many coins?", 7, [[6, "🪙 6"], [7, "🪙 7"], [8, "🪙 8"]], { instruction: "Steer to the island marked with the total.", hint: "Count on three from 4.", explanation: "4 + 3 = 7.", skillId: "math-addition", skillLabel: "Add within 20", standard: "2.OA.A.1" }),
    seed("A pirate had 10 gems and gave away 4. How many remain?", 6, [[5, "💎 5"], [6, "💎 6"], [7, "💎 7"]], { instruction: "Aim the cannon at the number remaining.", hint: "Count back four from 10.", explanation: "10 − 4 = 6.", skillId: "math-subtraction", skillLabel: "Subtract within 20", standard: "2.OA.A.1" }),
    seed("There are 3 treasure chests with 2 coins each. How many coins?", 6, [[4, "📦 4"], [6, "📦 6"], [8, "📦 8"]], { instruction: "Load the cargo total onto the ship.", hint: "Add 2 + 2 + 2.", explanation: "Three groups of 2 make 6.", skillId: "math-equal-groups", skillLabel: "Model equal groups", standard: "2.OA.C.4" }),
    seed("You walked 5 steps north and 5 more east. How many steps total?", 10, [[9, "🧭 9"], [10, "🧭 10"], [11, "🧭 11"]], { instruction: "Steer along the route with the total distance.", hint: "Combine the two groups of 5.", explanation: "5 + 5 = 10 steps.", skillId: "math-addition", skillLabel: "Add within 20", standard: "2.OA.A.1" }),
    seed("A map has 12 marks. You crossed off 5. How many remain?", 7, [[6, "❌ 6"], [7, "❌ 7"], [8, "❌ 8"]], { instruction: "Fire at the number of marks left.", hint: "Think 5 + 7 = 12.", explanation: "12 − 5 = 7.", skillId: "math-subtraction", skillLabel: "Subtract within 20", standard: "2.OA.A.1" }),
    seed("You split 8 coins equally between 2 pirates. How many each?", 4, [[3, "🪙 3"], [4, "🪙 4"], [5, "🪙 5"]], { instruction: "Load each pirate's equal share.", hint: "Deal one coin to each pirate until all 8 are used.", explanation: "Each pirate gets 4 coins.", skillId: "math-sharing", skillLabel: "Partition equally", standard: "2.OA.C.4" }),
  ];
  if (grade === 3) return [
    seed("Six islands each hide 4 coins. How many coins?", 24, [[20, "🏝️ 20"], [24, "🏝️ 24"], [28, "🏝️ 28"]], { instruction: "Steer to the product.", hint: "Use six groups of 4.", explanation: "6 × 4 = 24.", skillId: "math-multiplication", skillLabel: "Multiply within 100", standard: "3.OA.A.1" }),
    seed("Twenty-eight gems fill bags of 7. How many bags?", 4, [[3, "💎 3 bags"], [4, "💎 4 bags"], [5, "💎 5 bags"]], { instruction: "Set the cannon to the quotient.", hint: "How many groups of 7 make 28?", explanation: "28 ÷ 7 = 4.", skillId: "math-division", skillLabel: "Divide within 100", standard: "3.OA.A.2" }),
    seed("Five cargo nets hold 8 fish each. How many fish?", 40, [[35, "🐟 35"], [40, "🐟 40"], [45, "🐟 45"]], { instruction: "Load the full catch total.", hint: "Use 5 × 8.", explanation: "5 × 8 = 40.", skillId: "math-multiplication", skillLabel: "Multiply within 100", standard: "3.OA.C.7" }),
    seed("The ship sails 36 miles, then 27 more. How far?", 63, [[53, "🧭 53"], [63, "🧭 63"], [73, "🧭 73"]], { instruction: "Steer to the total distance.", hint: "Add 4 to make 40, then add 23.", explanation: "36 + 27 = 63.", skillId: "math-addition", skillLabel: "Add within 1,000", standard: "3.NBT.A.2" }),
    seed("Forty-two planks are split across 6 bridges. How many per bridge?", 7, [[6, "🪵 6"], [7, "🪵 7"], [8, "🪵 8"]], { instruction: "Fire at the equal group size.", hint: "Think 6 × 7 = 42.", explanation: "42 ÷ 6 = 7.", skillId: "math-division", skillLabel: "Divide within 100", standard: "3.OA.C.7" }),
    seed("A treasure room has 9 rows of 6 coins. How many coins?", 54, [[48, "🪙 48"], [54, "🪙 54"], [60, "🪙 60"]], { instruction: "Load the treasure total.", hint: "Use 9 × 6.", explanation: "9 × 6 = 54.", skillId: "math-multiplication", skillLabel: "Multiply within 100", standard: "3.OA.C.7" }),
  ];
  if (grade === 4) return [
    seed("Three fourths of the route is safe. Which marker shows 3/4?", "3/4", [["1/2", "🧭 1/2"], ["3/4", "🧭 3/4"], ["4/3", "🧭 4/3"]], { instruction: "Steer to the equivalent route marker.", hint: "Three of four equal route parts are safe.", explanation: "The safe route is 3/4.", skillId: "math-fractions", skillLabel: "Represent fractions", standard: "4.NF.A.1" }),
    seed("The cannon travels 6 × 14 meters. How far?", 84, [[74, "💥 74"], [84, "💥 84"], [94, "💥 94"]], { instruction: "Set the cannon range.", hint: "Use 6 × 10 plus 6 × 4.", explanation: "6 × 14 = 84.", skillId: "math-multiplication", skillLabel: "Multiply multi-digit numbers", standard: "4.NBT.B.5" }),
    seed("Two crates weigh 1/4 ton each. What is the total weight?", "1/2", [["1/4", "📦 1/4"], ["1/2", "📦 1/2"], ["3/4", "📦 3/4"]], { instruction: "Load the combined fraction.", hint: "Two fourths equal one half.", explanation: "1/4 + 1/4 = 1/2.", skillId: "math-fractions", skillLabel: "Add fractions", standard: "4.NF.B.3" }),
    seed("The ship traveled 1,275 miles, then 648 more. How far?", 1923, [[1823, "🧭 1,823"], [1923, "🧭 1,923"], [2023, "🧭 2,023"]], { instruction: "Steer to the total distance.", hint: "Add hundreds, tens, and ones carefully.", explanation: "1,275 + 648 = 1,923.", skillId: "math-addition", skillLabel: "Add multi-digit numbers", standard: "4.NBT.B.4" }),
    seed("A 96-meter rope is cut into 8 equal pieces. How long is each?", 12, [[10, "🪢 10"], [12, "🪢 12"], [14, "🪢 14"]], { instruction: "Aim at the equal piece length.", hint: "Think 8 × 12 = 96.", explanation: "96 ÷ 8 = 12.", skillId: "math-division", skillLabel: "Divide whole numbers", standard: "4.NBT.B.6" }),
    seed("A chest is 2/3 full. Add another 1/3. How full is it?", 1, [["2/3", "💎 2/3"], [1, "💎 1 whole"], ["4/3", "💎 4/3"]], { instruction: "Load the completed chest amount.", hint: "Two thirds plus one third makes three thirds.", explanation: "2/3 + 1/3 = 1 whole.", skillId: "math-fractions", skillLabel: "Add fractions", standard: "4.NF.B.3" }),
  ];
  return [
    seed("The safe route is 0.72 of a mile. Which marker matches?", "0.72", [["0.27", "🧭 0.27"], ["0.72", "🧭 0.72"], ["7.2", "🧭 7.2"]], { instruction: "Steer to the matching decimal.", hint: "Seventy-two hundredths is written 0.72.", explanation: "0.72 is seventy-two hundredths.", skillId: "math-decimals", skillLabel: "Read decimals", standard: "5.NBT.A.3" }),
    seed("The cannon needs 3.6 × 4 units of power. What setting?", "14.4", [["12.4", "💥 12.4"], ["14.4", "💥 14.4"], ["16.4", "💥 16.4"]], { instruction: "Set the decimal cannon power.", hint: "36 × 4 = 144, then place the decimal.", explanation: "3.6 × 4 = 14.4.", skillId: "math-decimals", skillLabel: "Multiply decimals", standard: "5.NBT.B.7" }),
    seed("Three crates each weigh 1 1/2 tons. What is the total?", "4 1/2", [["3 1/2", "📦 3 1/2"], ["4 1/2", "📦 4 1/2"], ["5 1/2", "📦 5 1/2"]], { instruction: "Load the combined mixed number.", hint: "Three groups of one and one half make four and one half.", explanation: "3 × 1 1/2 = 4 1/2.", skillId: "math-fractions", skillLabel: "Multiply fractions", standard: "5.NF.B.4" }),
    seed("The ship sails 12.75 miles, then 8.6 more. How far?", "21.35", [["20.35", "🧭 20.35"], ["21.35", "🧭 21.35"], ["22.35", "🧭 22.35"]], { instruction: "Steer to the decimal sum.", hint: "Line up the decimal points before adding.", explanation: "12.75 + 8.60 = 21.35.", skillId: "math-decimals", skillLabel: "Add decimals", standard: "5.NBT.B.7" }),
    seed("A 4.8-meter rope is cut into 6 equal pieces. How long is each?", "0.8", [["0.6", "🪢 0.6"], ["0.8", "🪢 0.8"], ["1.2", "🪢 1.2"]], { instruction: "Aim at the equal piece length.", hint: "48 tenths divided by 6 is 8 tenths.", explanation: "4.8 ÷ 6 = 0.8.", skillId: "math-decimals", skillLabel: "Divide decimals", standard: "5.NBT.B.7" }),
    seed("A treasure room is 6 m long, 4 m wide, and 3 m high. Its volume?", 72, [[62, "💎 62 m³"], [72, "💎 72 m³"], [82, "💎 82 m³"]], { instruction: "Load the room volume.", hint: "Multiply length × width × height.", explanation: "6 × 4 × 3 = 72 cubic meters.", skillId: "math-volume", skillLabel: "Find rectangular volume", standard: "5.MD.C.5" }),
  ];
}

function buildMissions(grade: ElementaryGrade, runSeed: number): Mission[] {
  const seeds = missionSeedsForGrade(grade);
  const offset = ((runSeed % seeds.length) + seeds.length) % seeds.length;
  const rotated = [...seeds.slice(offset), ...seeds.slice(0, offset)];
  return rotated.map((item, index) => ({
    ...item,
    mechanic: item.mechanic ?? MECHANICS[index % MECHANICS.length],
    landmark: item.landmark ?? LANDMARKS[index % LANDMARKS.length],
  }));
}

function mechanicCopy(mechanic: Mechanic): { eyebrow: string; verb: string } {
  if (mechanic === "cannon") return { eyebrow: "CANNON RANGE", verb: "Fire" };
  if (mechanic === "cargo") return { eyebrow: "CARGO DECK", verb: "Load" };
  return { eyebrow: "SEA ROUTE", verb: "Sail" };
}

export default function Page() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(SLUG);
  const [grade, setGrade] = useState<ElementaryGrade>(() => readProfileGrade(activeProfile));
  const [runSeed, setRunSeed] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [independent, setIndependent] = useState(0);
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("Captain, the first clue is already on deck.");
  const timerRef = useRef<number | null>(null);
  const world = WORLDS[grade];
  const missions = useMemo(() => buildMissions(grade, runSeed), [grade, runSeed]);
  const mission = missions[roundIndex];
  const completed = roundIndex + (solved ? 1 : 0);
  const biome = BIOMES[(grade + 1 + runSeed) % BIOMES.length];
  const shipPoint = MAP_POINTS[Math.min(completed, MAP_POINTS.length - 1)];
  const routePoints = MAP_POINTS.map((point) => `${point.x},${point.y}`).join(" ");
  const completedRoutePoints = MAP_POINTS.slice(0, Math.min(completed + 1, MAP_POINTS.length)).map((point) => `${point.x},${point.y}`).join(" ");
  const copy = mechanicCopy(mission.mechanic);

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
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (roundIndex === missions.length - 1) {
      completeGame({
        xp: 26 + finalIndependent * 4,
        coins: 7 + finalIndependent,
        score: missions.length,
      });
      setDone(true);
      return;
    }
    setRoundIndex((value) => value + 1);
    setMisses(0);
    setSolved(false);
    setMessage("New island sighted. Read the clue and choose your move.");
  }

  function chooseAnswer(answerId: string) {
    if (solved || done) return;
    const selected = mission.choices.find((item) => item.id === answerId);
    if (!selected) return;
    const correct = answerId === mission.answerId;
    recordLearningAttempt({
      gameSlug: SLUG,
      subject: "Math",
      skillId: mission.skillId,
      skillLabel: mission.skillLabel,
      prompt: mission.prompt,
      correctAnswer: mission.choices.find((item) => item.id === mission.answerId)?.label ?? mission.answerId,
      correct,
      data: {
        grade,
        standardCode: mission.standard,
        supportUsed: misses > 0,
        interaction: `treasure-${mission.mechanic}`,
        runSeed,
      },
    }, activeProfile.id);

    if (!correct) {
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setMessage(nextMisses === 1 ? `Compass clue: ${mission.hint}` : `Captain's map: ${mission.explanation}`);
      return;
    }

    const finalIndependent = independent + (misses === 0 ? 1 : 0);
    setIndependent(finalIndependent);
    setSolved(true);
    setMessage(`${mission.landmark.label} reached. ${mission.explanation}`);
    schedule(() => finishOrAdvance(finalIndependent), 1_050);
  }

  function replay() {
    restartGame();
    setRunSeed((value) => value + 1);
    setRoundIndex(0);
    setMisses(0);
    setIndependent(0);
    setSolved(false);
    setDone(false);
    setMessage("The island chain shifted. A new expedition is already underway.");
  }

  const map = (
    <section
      className={styles.map}
      data-treasure-map="active"
      data-biome={biome}
      data-landmarks-complete={completed}
      aria-label={`${world.title} expedition map`}
      style={{ "--accent": world.accent } as React.CSSProperties}
    >
      <div className={styles.sky} />
      <div className={styles.water} />
      <svg className={styles.route} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline className={styles.routeBase} points={routePoints} />
        <polyline className={styles.routeComplete} points={completedRoutePoints} />
      </svg>
      <span
        className={styles.ship}
        style={{ left: `${shipPoint.x}%`, top: `${shipPoint.y}%` }}
        data-ship-stop={completed}
        aria-hidden="true"
      >
        {world.ship}
      </span>
      <span className={styles.compass} aria-hidden="true">🧭</span>
      <span className={styles.monster} aria-hidden="true">🐋</span>
      {missions.map((item, index) => {
        const point = MAP_POINTS[index + 1];
        const status = index < completed ? "complete" : index === completed ? "active" : "locked";
        return (
          <span
            key={`${item.landmark.label}-${index}`}
            className={styles.landmark}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            data-status={status}
            aria-label={`${item.landmark.label}, ${status}`}
          >
            <b aria-hidden="true">{item.landmark.emoji}</b>
            <small>{item.landmark.label}</small>
          </span>
        );
      })}
      <span className={styles.treasure} data-open={done ? "true" : "false"} aria-hidden="true">{done ? "🏆" : "🗝️"}</span>
    </section>
  );

  if (done) {
    return (
      <GameFrame title="Treasure Map Math">
        <main className={styles.page} style={{ "--accent": world.accent } as React.CSSProperties}>
          <section className={styles.complete} data-treasure-complete="true">
            <span className={styles.eyebrow}>TREASURE FOUND</span>
            <h1>{activeProfile.name} conquered {world.title}.</h1>
            <p>{missions.length} islands reached · {independent} independent solves · one legendary route</p>
            {map}
            <button type="button" onClick={replay} className={styles.primary}>Play again</button>
          </section>
        </main>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Treasure Map Math">
      <main
        className={styles.page}
        style={{ "--accent": world.accent } as React.CSSProperties}
        data-treasure-expedition="active"
        data-run-seed={runSeed}
        data-round={roundIndex + 1}
        data-mechanic={mission.mechanic}
      >
        <header className={styles.hud}>
          <div>
            <span className={styles.eyebrow}>ISLAND {roundIndex + 1} OF {missions.length}</span>
            <strong>{world.title}</strong>
            <small>{world.intro}</small>
          </div>
          <div className={styles.hudStats}>
            <span>🗺️ {completed}/6</span>
            <span>✨ {independent}</span>
          </div>
        </header>

        <div className={styles.layout}>
          {map}
          <section className={styles.missionCard} data-misses={misses} data-solved={solved ? "true" : "false"}>
            <div className={styles.missionTop}>
              <span className={styles.mechanic}>{copy.eyebrow}</span>
              <span className={styles.standard}>{mission.standard}</span>
            </div>
            <div className={styles.missionIcon} aria-hidden="true">
              {mission.mechanic === "cannon" ? "💥" : mission.mechanic === "cargo" ? "📦" : "🧭"}
            </div>
            <h1>{mission.prompt}</h1>
            <p className={styles.instruction}>{mission.instruction}</p>

            <div
              className={`${styles.choices} ${styles[`choices_${mission.mechanic}`]}`}
              aria-label={`${copy.eyebrow} choices`}
            >
              {mission.choices.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.choice}
                  onClick={() => chooseAnswer(item.id)}
                  draggable={!solved}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                  disabled={solved}
                  data-correct={item.id === mission.answerId ? "true" : "false"}
                  data-compass-hint={misses >= 2 && item.id === mission.answerId ? "true" : "false"}
                  aria-label={`${item.label}`}
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <strong>{item.label}</strong>
                  <small>{mission.mechanic === "cargo" ? "Tap or drag aboard" : `${copy.verb} here`}</small>
                  {mission.mechanic === "sail" && <i aria-hidden="true">{index === 0 ? "↖" : index === 1 ? "↑" : "↗"}</i>}
                </button>
              ))}
            </div>

            {mission.mechanic === "cargo" && (
              <div
                className={styles.dropZone}
                aria-label="Ship cargo drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  chooseAnswer(event.dataTransfer.getData("text/plain"));
                }}
              >
                <span aria-hidden="true">⬇</span><strong>SHIP CARGO DROP</strong><span aria-hidden="true">⬇</span>
              </div>
            )}

            <section className={styles.coach} role="status" aria-live="polite">
              <strong>{misses > 0 ? "COMPASS COACH" : solved ? "LANDMARK REACHED" : "CAPTAIN'S LOG"}</strong>
              <p>{message}</p>
              {solved && (
                <button type="button" className={styles.manualAdvance} onClick={() => finishOrAdvance(independent)}>
                  {roundIndex === missions.length - 1 ? "See treasure" : "Next clue"}
                </button>
              )}
            </section>
          </section>
        </div>
      </main>
    </GameFrame>
  );
}
