import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";

export type RemixSubject = "Math" | "Reading" | "Science";

export type RemixMission = {
  id: string;
  subject: RemixSubject;
  standard: string;
  skillId: string;
  skillLabel: string;
  prompt: string;
  visual: string;
  choices: string[];
  answer: string;
  hint: string;
  explanation: string;
};

export type RemixTheme = {
  grade: ElementaryGrade;
  eyebrow: string;
  title: string;
  shortTitle: string;
  description: string;
  emoji: string;
  hero: string;
  treasure: string;
  accent: string;
  background: string;
};

export const REMIX_THEMES: Record<ElementaryGrade, RemixTheme> = {
  [-1]: {
    grade: -1,
    eyebrow: "TK CRITTER PARADE",
    title: "Critter Parade Trail",
    shortTitle: "Critter Parade",
    description: "A gentle, read-aloud trail with counting, colors, shapes, patterns, sounds, and nature.",
    emoji: "🐣🐾",
    hero: "Pip the fox",
    treasure: "acorns",
    accent: "#ffd45c",
    background: "radial-gradient(circle at top,#315d52,#172c31 58%,#10131b)",
  },
  0: {
    grade: 0,
    eyebrow: "KINDERGARTEN DAILY ARCADE",
    title: "Rainbow Rocket Sprint",
    shortTitle: "Rocket Sprint",
    description: "Launch through five quick counting, phonics, story, shape, and science gates.",
    emoji: "🌈🚀",
    hero: "Nova the rocket",
    treasure: "stars",
    accent: "#ff9bd2",
    background: "radial-gradient(circle at top,#344a7b,#1b2442 58%,#10131b)",
  },
  1: {
    grade: 1,
    eyebrow: "GRADE 1 DAILY ARCADE",
    title: "Robot Rescue Rush",
    shortTitle: "Robot Rush",
    description: "Repair five surprise city gates with number sense, phonics, reading, and science.",
    emoji: "🤖⚡",
    hero: "Bolt the rescue bot",
    treasure: "gears",
    accent: "#7fdcff",
    background: "radial-gradient(circle at top,#274d68,#18263a 58%,#10131b)",
  },
  2: {
    grade: 2,
    eyebrow: "GRADE 2 DAILY ARCADE",
    title: "Dino Dash Rescue",
    shortTitle: "Dino Dash",
    description: "Race a dinosaur through five rotating math, reading, vocabulary, science, and engineering gates.",
    emoji: "🦖💨",
    hero: "Zip the raptor",
    treasure: "fossils",
    accent: "#d9ff5b",
    background: "radial-gradient(circle at top,#41652d,#21331d 58%,#10131b)",
  },
  3: {
    grade: 3,
    eyebrow: "GRADE 3 DAILY ARCADE",
    title: "Space Station Scramble",
    shortTitle: "Space Scramble",
    description: "Restore five changing station systems with multiplication, fractions, evidence, and science.",
    emoji: "🪐🛰️",
    hero: "Comet the engineer",
    treasure: "stardust",
    accent: "#c6b8ff",
    background: "radial-gradient(circle at top,#38336b,#211f43 58%,#10131b)",
  },
  4: {
    grade: 4,
    eyebrow: "GRADE 4 DAILY ARCADE",
    title: "Temple Torch Run",
    shortTitle: "Temple Run",
    description: "Open five rotating chambers with fractions, multi-digit math, inference, energy, and Earth science.",
    emoji: "🗿🔥",
    hero: "Koa the map keeper",
    treasure: "runes",
    accent: "#ffbd6a",
    background: "radial-gradient(circle at top,#664724,#34291d 58%,#10131b)",
  },
  5: {
    grade: 5,
    eyebrow: "GRADE 5 DAILY ARCADE",
    title: "Cyber Shield Sprint",
    shortTitle: "Cyber Sprint",
    description: "Defend five changing districts with decimals, fractions, volume, evidence, and ecosystems.",
    emoji: "🌐⚡",
    hero: "Pulse the shield program",
    treasure: "data chips",
    accent: "#60f3c4",
    background: "radial-gradient(circle at top,#164f57,#163037 58%,#10131b)",
  },
};

const POOLS: Record<ElementaryGrade, RemixMission[]> = {
  [-1]: [
    { id: "tk-count", subject: "Math", standard: "TK.CC.1", skillId: "math-counting", skillLabel: "Count small groups", prompt: "How many ducklings are marching?", visual: "🐥 🐥 🐥", choices: ["2", "3", "4"], answer: "3", hint: "Touch each duckling once: 1, 2, 3.", explanation: "Three ducklings are marching." },
    { id: "tk-shape", subject: "Math", standard: "TK.G.1", skillId: "math-geometry", skillLabel: "Notice shapes", prompt: "Which shape is round?", visual: "Find the shape with no corners.", choices: ["●", "▲", "■"], answer: "●", hint: "Trace the edge with your finger. The round one has no corners.", explanation: "The circle is round and has no corners." },
    { id: "tk-pattern", subject: "Math", standard: "TK.PATTERN.1", skillId: "logic-patterns", skillLabel: "Continue simple patterns", prompt: "What comes next?", visual: "🍎 🍌 🍎 🍌 ___", choices: ["🍎", "🍌", "🍇"], answer: "🍎", hint: "The pattern switches apple, banana, apple, banana.", explanation: "Apple comes next because the two-part pattern repeats." },
    { id: "tk-sound", subject: "Reading", standard: "TK.RF.2", skillId: "reading-spelling-easy", skillLabel: "Hear beginning sounds", prompt: "Which starts like ball?", visual: "⚽ ball starts with /b/", choices: ["bear", "sun", "cat"], answer: "bear", hint: "Say b-b-ball and b-b-bear.", explanation: "Ball and bear both begin with the /b/ sound." },
    { id: "tk-rhyme", subject: "Reading", standard: "TK.RF.2a", skillId: "reading-rhyming", skillLabel: "Hear rhyming words", prompt: "Which word rhymes with cat?", visual: "🐱 cat", choices: ["hat", "dog", "sun"], answer: "hat", hint: "Cat and hat have the same ending sound.", explanation: "Cat and hat rhyme." },
    { id: "tk-living", subject: "Science", standard: "TK-LS1", skillId: "environment-ecosystems", skillLabel: "Notice living things", prompt: "Which one is alive?", visual: "Look for something that grows.", choices: ["🌱 plant", "🪨 rock", "🧸 toy"], answer: "🌱 plant", hint: "Living things grow and need water.", explanation: "A plant is living. It grows and needs water and light." },
    { id: "tk-weather", subject: "Science", standard: "TK-ESS2", skillId: "science-weather", skillLabel: "Observe weather", prompt: "What should we use in the rain?", visual: "🌧️", choices: ["☂️ umbrella", "🕶️ sunglasses", "🩴 sandals"], answer: "☂️ umbrella", hint: "Choose what keeps water off your head.", explanation: "An umbrella helps keep us dry in rain." },
  ],
  0: [
    { id: "k-count", subject: "Math", standard: "K.CC.B.4", skillId: "math-counting", skillLabel: "Counting and quantity", prompt: "How many stars fuel the rocket?", visual: "⭐ ⭐ ⭐ ⭐ ⭐ ⭐", choices: ["5", "6", "7"], answer: "6", hint: "Touch each star once while counting.", explanation: "There are 6 stars." },
    { id: "k-add", subject: "Math", standard: "K.OA.A.1", skillId: "math-addition", skillLabel: "Add within 5", prompt: "Two rockets join one rocket. How many?", visual: "🚀 🚀 + 🚀", choices: ["2", "3", "4"], answer: "3", hint: "Count all the rockets together.", explanation: "Two plus one equals three." },
    { id: "k-shape", subject: "Math", standard: "K.G.A.2", skillId: "math-geometry", skillLabel: "Recognize shapes", prompt: "Which shape has 3 sides?", visual: "Trace the sides.", choices: ["▲", "■", "●"], answer: "▲", hint: "A triangle has 3 straight sides.", explanation: "The triangle has three sides." },
    { id: "k-sound", subject: "Reading", standard: "RF.K.2", skillId: "reading-spelling-easy", skillLabel: "Beginning sounds", prompt: "Which starts like moon?", visual: "🌙 moon", choices: ["map", "sun", "fish"], answer: "map", hint: "Say m-m-moon and listen for /m/.", explanation: "Moon and map both start with /m/." },
    { id: "k-sequence", subject: "Reading", standard: "W.K.3", skillId: "reading-sequencing", skillLabel: "Story order", prompt: "What happens first before launch?", visual: "1 helmet · 2 buckle · 3 blast off", choices: ["Put on helmet", "Blast off", "Land"], answer: "Put on helmet", hint: "Look for step 1.", explanation: "The helmet goes on first." },
    { id: "k-motion", subject: "Science", standard: "K-PS2-1", skillId: "science-technology", skillLabel: "Pushes and pulls", prompt: "What sends the cart away from you?", visual: "🧒 ➡️ 🛒", choices: ["A push", "A pull", "A shadow"], answer: "A push", hint: "Your hands move the cart away.", explanation: "A push can move an object away." },
    { id: "k-plant", subject: "Science", standard: "K-LS1-1", skillId: "environment-ecosystems", skillLabel: "Needs of living things", prompt: "What does a plant need?", visual: "🌱 + ?", choices: ["Water", "A toy", "A bell"], answer: "Water", hint: "Think about what we give a thirsty plant.", explanation: "Plants need water to live and grow." },
  ],
  1: [
    { id: "g1-add", subject: "Math", standard: "1.OA.C.6", skillId: "math-addition", skillLabel: "Addition within 20", prompt: "Bolt needs 8 gears and finds 5 more. How many?", visual: "8 + 5", choices: ["12", "13", "14"], answer: "13", hint: "Make 10: 8 + 2, then add 3.", explanation: "8 + 5 = 13." },
    { id: "g1-sub", subject: "Math", standard: "1.OA.C.6", skillId: "math-subtraction", skillLabel: "Subtraction within 20", prompt: "The robot has 14 bolts and uses 6. How many remain?", visual: "14 − 6", choices: ["7", "8", "9"], answer: "8", hint: "Count back 6 from 14.", explanation: "14 − 6 = 8." },
    { id: "g1-place", subject: "Math", standard: "1.NBT.B.2", skillId: "math-place-value", skillLabel: "Tens and ones", prompt: "Which number has 3 tens and 4 ones?", visual: "▰▰▰ + ••••", choices: ["34", "43", "304"], answer: "34", hint: "Three tens make 30. Add four ones.", explanation: "30 + 4 is 34." },
    { id: "g1-phonics", subject: "Reading", standard: "RF.1.3", skillId: "reading-spelling-easy", skillLabel: "Decode words", prompt: "Which word has the long a sound?", visual: "a_e", choices: ["cake", "cat", "cap"], answer: "cake", hint: "The silent e helps a say its name.", explanation: "Cake has a long a sound." },
    { id: "g1-detail", subject: "Reading", standard: "RL.1.1", skillId: "reading-comprehension-detail", skillLabel: "Use story details", prompt: "Mia wore boots because puddles covered the road. Why did she wear boots?", visual: "👢 + 💦", choices: ["There were puddles", "It was bedtime", "She lost a shoe"], answer: "There were puddles", hint: "Use the reason stated in the sentence.", explanation: "The sentence says puddles covered the road." },
    { id: "g1-light", subject: "Science", standard: "1-PS4-2", skillId: "science-light-sound", skillLabel: "Light and materials", prompt: "Which material lets most light pass through?", visual: "🔦 → ?", choices: ["Clear glass", "Cardboard", "Wood"], answer: "Clear glass", hint: "Choose the material you can see through.", explanation: "Clear glass lets most light pass through." },
    { id: "g1-design", subject: "Science", standard: "K-2-ETS1-2", skillId: "engineering-design", skillLabel: "Plan a design", prompt: "What should an engineer do before building?", visual: "💡 → ✏️ → 🛠️", choices: ["Draw a plan", "Guess forever", "Hide the tools"], answer: "Draw a plan", hint: "A plan shows what you want to build.", explanation: "Engineers often draw and compare plans before building." },
  ],
  2: [
    { id: "g2-story", subject: "Math", standard: "2.OA.A.1", skillId: "math-word-problems", skillLabel: "Math story problems", prompt: "Zip finds 27 fossils, then 16 more. How many fossils?", visual: "27 + 16", choices: ["33", "43", "53"], answer: "43", hint: "Add ones first: 7 + 6 = 13. Regroup one ten.", explanation: "27 + 16 = 43." },
    { id: "g2-fluency", subject: "Math", standard: "2.OA.B.2", skillId: "math-addition", skillLabel: "Add within 20", prompt: "Open the speed gate: 9 + 8 = ?", visual: "9 + 8", choices: ["16", "17", "18"], answer: "17", hint: "Make 10: move 1 from 8 to 9, then add 7.", explanation: "9 + 8 = 17." },
    { id: "g2-money", subject: "Math", standard: "2.MD.C.8", skillId: "math-money", skillLabel: "Money math", prompt: "A fossil costs 35¢. You have 25¢ and 10¢. Enough?", visual: "25¢ + 10¢", choices: ["Yes, exactly 35¢", "No, only 30¢", "Yes, 45¢"], answer: "Yes, exactly 35¢", hint: "Add 25 and 10.", explanation: "25¢ + 10¢ = 35¢, exactly enough." },
    { id: "g2-evidence", subject: "Reading", standard: "RL.2.1", skillId: "reading-comprehension-detail", skillLabel: "Use story evidence", prompt: "The nest shook after thunder cracked. Why did the dinosaur hide?", visual: "⛈️ → 🦕", choices: ["Thunder frightened it", "It was hungry", "It wanted to dance"], answer: "Thunder frightened it", hint: "Use the detail that happened just before it hid.", explanation: "The thunder and shaking nest explain why it hid." },
    { id: "g2-word", subject: "Reading", standard: "L.2.4", skillId: "reading-vocabulary", skillLabel: "Use context for word meaning", prompt: "The tiny dinosaur was timid and stayed behind the rock. Timid means…", visual: "🦕🪨", choices: ["shy", "loud", "huge"], answer: "shy", hint: "It stays behind the rock instead of coming out.", explanation: "Timid means shy or easily frightened." },
    { id: "g2-material", subject: "Science", standard: "2-PS1-1", skillId: "science-materials", skillLabel: "Compare materials", prompt: "Which material is best for a waterproof dino shelter?", visual: "🌧️ + 🏕️", choices: ["Plastic sheet", "Paper towel", "Cotton ball"], answer: "Plastic sheet", hint: "Choose the material that does not soak up water.", explanation: "A plastic sheet resists water better than absorbent paper or cotton." },
    { id: "g2-land", subject: "Science", standard: "2-ESS2-2", skillId: "science-earth-systems", skillLabel: "Land and water", prompt: "Which is a body of water?", visual: "🏔️ 🏞️ 🌊", choices: ["Lake", "Hill", "Valley"], answer: "Lake", hint: "Look for a place filled with water.", explanation: "A lake is a body of water surrounded by land." },
  ],
  3: [
    { id: "g3-mult", subject: "Math", standard: "3.OA.A.1", skillId: "math-multiplication", skillLabel: "Multiplication", prompt: "Four solar panels hold 6 cells each. How many cells?", visual: "4 × 6", choices: ["20", "24", "28"], answer: "24", hint: "Add four groups of 6.", explanation: "4 × 6 = 24." },
    { id: "g3-div", subject: "Math", standard: "3.OA.A.2", skillId: "math-division", skillLabel: "Division", prompt: "Twenty-four fuel cells go into 4 equal packs. How many per pack?", visual: "24 ÷ 4", choices: ["5", "6", "8"], answer: "6", hint: "Find the number that makes 4 equal groups total 24.", explanation: "24 ÷ 4 = 6." },
    { id: "g3-frac", subject: "Math", standard: "3.NF.A.1", skillId: "math-fractions", skillLabel: "Fractions", prompt: "Three of 8 equal station windows glow. What fraction glows?", visual: "🟩🟩🟩⬛⬛⬛⬛⬛", choices: ["3/8", "5/8", "3/5"], answer: "3/8", hint: "The numerator counts glowing parts; denominator counts all parts.", explanation: "3 of 8 equal parts is 3/8." },
    { id: "g3-main", subject: "Reading", standard: "RI.3.2", skillId: "reading-main-idea", skillLabel: "Main idea", prompt: "A passage explains how astronauts exercise, sleep, and eat in orbit. What is the main idea?", visual: "🏃‍♀️ 😴 🍽️ in space", choices: ["Daily life in space", "How to build a car", "Ocean animals"], answer: "Daily life in space", hint: "Choose the idea that connects all three details.", explanation: "Exercise, sleep, and eating are parts of daily life in space." },
    { id: "g3-character", subject: "Reading", standard: "RL.3.3", skillId: "reading-inference", skillLabel: "Character motivation", prompt: "Kai checks every valve twice before launch. What trait does this show?", visual: "🔧✓✓", choices: ["careful", "careless", "sleepy"], answer: "careful", hint: "Checking twice helps prevent mistakes.", explanation: "Kai is careful because he double-checks the valves." },
    { id: "g3-life", subject: "Science", standard: "3-LS1-1", skillId: "science-life-cycles", skillLabel: "Life cycles", prompt: "Which stage comes after a caterpillar?", visual: "🥚 → 🐛 → ? → 🦋", choices: ["chrysalis", "seed", "tadpole"], answer: "chrysalis", hint: "The caterpillar changes inside a protective case.", explanation: "A caterpillar forms a chrysalis before becoming a butterfly." },
    { id: "g3-force", subject: "Science", standard: "3-PS2-1", skillId: "science-forces", skillLabel: "Forces and motion", prompt: "What happens when a stronger push acts on the same cart?", visual: "💪 ➡️ 🛒", choices: ["It accelerates more", "It vanishes", "It becomes lighter"], answer: "It accelerates more", hint: "A larger force causes a larger change in motion.", explanation: "A stronger push makes the cart speed up more." },
  ],
  4: [
    { id: "g4-mult", subject: "Math", standard: "4.NBT.B.5", skillId: "math-multiplication", skillLabel: "Multi-digit multiplication", prompt: "A temple wall has 24 rows of 6 symbols. How many symbols?", visual: "24 × 6", choices: ["124", "144", "164"], answer: "144", hint: "Multiply 20 × 6 and 4 × 6, then add.", explanation: "120 + 24 = 144." },
    { id: "g4-frac", subject: "Math", standard: "4.NF.A.1", skillId: "math-fractions", skillLabel: "Equivalent fractions", prompt: "Which fraction is equivalent to 3/4?", visual: "3/4 = ?", choices: ["6/8", "4/7", "9/16"], answer: "6/8", hint: "Multiply numerator and denominator by the same number.", explanation: "3 × 2 over 4 × 2 equals 6/8." },
    { id: "g4-area", subject: "Math", standard: "4.MD.A.3", skillId: "math-measurement", skillLabel: "Area and perimeter", prompt: "A chamber is 8 m by 5 m. What is its area?", visual: "8 m × 5 m", choices: ["13 m²", "26 m²", "40 m²"], answer: "40 m²", hint: "Area of a rectangle is length times width.", explanation: "8 × 5 = 40 square meters." },
    { id: "g4-theme", subject: "Reading", standard: "RL.4.2", skillId: "reading-theme", skillLabel: "Theme", prompt: "A hero fails twice, keeps practicing, and finally opens the vault. What theme fits?", visual: "❌ ❌ 🧠 🔓", choices: ["Persistence pays off", "Treasure is heavy", "Night is dark"], answer: "Persistence pays off", hint: "Think about the lesson from continuing after failure.", explanation: "The hero succeeds because practice and persistence continue." },
    { id: "g4-infer", subject: "Reading", standard: "RL.4.1", skillId: "reading-inference", skillLabel: "Inference with evidence", prompt: "Dust covers every doorway except one. What can you infer?", visual: "🚪🌫️ 🚪🌫️ 🚪✨", choices: ["The clean doorway was used recently", "All doors are new", "Nobody entered"], answer: "The clean doorway was used recently", hint: "Compare the clean doorway with the dusty ones.", explanation: "A recently used doorway would be less dusty." },
    { id: "g4-energy", subject: "Science", standard: "4-PS3-2", skillId: "science-energy", skillLabel: "Energy transfer", prompt: "A moving ball hits a still ball and the still ball rolls. What transferred?", visual: "⚪➡️⚪", choices: ["energy", "color", "mass"], answer: "energy", hint: "The first ball's motion caused the second ball to move.", explanation: "Energy transferred from the moving ball to the still ball." },
    { id: "g4-earth", subject: "Science", standard: "4-ESS2-1", skillId: "science-earth-systems", skillLabel: "Weathering and erosion", prompt: "A river slowly carries soil downstream. This is…", visual: "🏞️ → 💧 → 🟫", choices: ["erosion", "freezing", "reflection"], answer: "erosion", hint: "Erosion moves weathered material from one place to another.", explanation: "Flowing water can erode and carry soil downstream." },
  ],
  5: [
    { id: "g5-decimal", subject: "Math", standard: "5.NBT.B.7", skillId: "math-decimals", skillLabel: "Decimal operations", prompt: "A shield uses 2.35 units, then 1.4 more. Total?", visual: "2.35 + 1.40", choices: ["3.39", "3.75", "4.75"], answer: "3.75", hint: "Line up the decimal points before adding.", explanation: "2.35 + 1.40 = 3.75." },
    { id: "g5-frac", subject: "Math", standard: "5.NF.A.1", skillId: "math-fractions", skillLabel: "Add fractions", prompt: "Two circuits use 1/3 and 1/6 of the power grid. Total?", visual: "1/3 + 1/6", choices: ["1/2", "2/9", "1/9"], answer: "1/2", hint: "Rename 1/3 as 2/6, then add.", explanation: "2/6 + 1/6 = 3/6 = 1/2." },
    { id: "g5-volume", subject: "Math", standard: "5.MD.C.5", skillId: "math-volume", skillLabel: "Volume", prompt: "A data vault is 4 by 3 by 2 units. Volume?", visual: "4 × 3 × 2", choices: ["9", "18", "24"], answer: "24", hint: "Multiply length × width × height.", explanation: "4 × 3 × 2 = 24 cubic units." },
    { id: "g5-evidence", subject: "Reading", standard: "RL.5.1", skillId: "reading-comprehension-detail", skillLabel: "Quote evidence", prompt: "The passage says, ‘Mara checked the logs before accusing anyone.’ Which trait is supported?", visual: "📜🔍", choices: ["fair-minded", "reckless", "impatient"], answer: "fair-minded", hint: "She looks for evidence before judging.", explanation: "Checking the logs first shows she is fair-minded and careful." },
    { id: "g5-figurative", subject: "Reading", standard: "L.5.5", skillId: "reading-vocabulary", skillLabel: "Figurative language", prompt: "‘The alarm screamed through the city’ is an example of…", visual: "🚨📣", choices: ["personification", "a literal whisper", "a measurement"], answer: "personification", hint: "A nonhuman alarm is given a human action.", explanation: "The alarm is described as if it can scream, which is personification." },
    { id: "g5-matter", subject: "Science", standard: "5-PS1-1", skillId: "science-materials", skillLabel: "Matter and particles", prompt: "Why does sugar seem to disappear in water?", visual: "🧂 + 💧", choices: ["Its particles spread through the water", "It stops being matter", "It turns into light"], answer: "Its particles spread through the water", hint: "The sugar is still present even when individual grains cannot be seen.", explanation: "Sugar particles spread among water particles but the sugar remains matter." },
    { id: "g5-ecosystem", subject: "Science", standard: "5-LS2-1", skillId: "environment-ecosystems", skillLabel: "Ecosystem relationships", prompt: "If insects disappear, what may happen to birds that eat them?", visual: "🐛 → 🐦", choices: ["Their food supply shrinks", "They gain more food", "Nothing can change"], answer: "Their food supply shrinks", hint: "Follow the food relationship from insects to birds.", explanation: "Birds that depend on insects would have less food available." },
  ],
};

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyRemixDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailyRemixMissions(grade: ElementaryGrade, profileId: string, day = dailyRemixDateKey()): RemixMission[] {
  const random = seededRandom(hashText(`${profileId}:${grade}:${day}:daily-remix-v1`));
  const rows = [...POOLS[grade]];
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [rows[index], rows[swap]] = [rows[swap], rows[index]];
  }
  return rows.slice(0, 5);
}

export type DailyRemixState = { completedToday: boolean; streak: number; bestStreak: number };

function rewardKey(profileId: string, day: string): string {
  return `adrianos-daily-remix-reward:${profileId}:${day}`;
}

function streakKey(profileId: string): string {
  return `adrianos-daily-remix-streak:${profileId}`;
}

export function readDailyRemixState(profileId: string, day = dailyRemixDateKey()): DailyRemixState {
  if (typeof window === "undefined") return { completedToday: false, streak: 0, bestStreak: 0 };
  let streak = 0;
  let bestStreak = 0;
  try {
    const state = JSON.parse(window.localStorage.getItem(streakKey(profileId)) ?? "{}");
    streak = Number(state.streak ?? 0);
    bestStreak = Number(state.bestStreak ?? streak);
  } catch {
    streak = 0;
    bestStreak = 0;
  }
  return { completedToday: window.localStorage.getItem(rewardKey(profileId, day)) === "claimed", streak, bestStreak };
}

export function claimDailyRemix(profileId: string, day = dailyRemixDateKey()): { firstToday: boolean; streak: number; bestStreak: number } {
  if (typeof window === "undefined") return { firstToday: false, streak: 0, bestStreak: 0 };
  const key = rewardKey(profileId, day);
  if (window.localStorage.getItem(key) === "claimed") {
    const current = readDailyRemixState(profileId, day);
    return { firstToday: false, streak: current.streak, bestStreak: current.bestStreak };
  }

  let previous = { lastDay: "", streak: 0, bestStreak: 0 };
  try {
    previous = { ...previous, ...JSON.parse(window.localStorage.getItem(streakKey(profileId)) ?? "{}") };
  } catch {
    previous = { lastDay: "", streak: 0, bestStreak: 0 };
  }

  const yesterday = new Date(`${day}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const nextStreak = previous.lastDay === dailyRemixDateKey(yesterday) ? previous.streak + 1 : 1;
  const bestStreak = Math.max(previous.bestStreak, nextStreak);
  window.localStorage.setItem(key, "claimed");
  window.localStorage.setItem(streakKey(profileId), JSON.stringify({ lastDay: day, streak: nextStreak, bestStreak }));
  return { firstToday: true, streak: nextStreak, bestStreak };
}
