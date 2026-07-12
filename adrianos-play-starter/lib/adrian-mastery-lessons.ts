import type { MasteryIntervention } from "@/lib/adrian-mastery-loop";

export type MasteryLesson = {
  title: string;
  principle: string;
  steps: string[];
  workedExample: string;
  checkPrompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

const EXACT_LESSONS: Record<string, MasteryLesson> = {
  "math-addition": {
    title: "Make a friendly number first",
    principle: "Addition gets easier when one number is moved toward 10, 20, or another friendly landmark.",
    steps: ["Find how much the first number needs to reach 10.", "Split that amount from the second number.", "Add what remains after making 10."],
    workedExample: "8 + 7 becomes 8 + 2 + 5. First make 10, then 10 + 5 = 15.",
    checkPrompt: "Which plan makes 8 + 7 easier?",
    choices: ["Make 10: 8 + 2 + 5", "Count backward from 8", "Ignore the 7", "Multiply 8 × 7"],
    answerIndex: 0,
    explanation: "Breaking 7 into 2 and 5 lets 8 reach 10 first. Then 10 + 5 = 15.",
  },
  "math-subtraction": {
    title: "Count up to find the gap",
    principle: "Subtraction can mean finding the distance between two numbers, not only taking objects away.",
    steps: ["Start at the smaller number.", "Jump to a friendly number.", "Keep jumping to the larger number and add the jumps."],
    workedExample: "For 14 − 6, jump 6 → 10 (+4), then 10 → 14 (+4). The gap is 8.",
    checkPrompt: "What is the best count-up plan for 14 − 6?",
    choices: ["6 → 10 → 14", "14 → 20 → 26", "6 → 5 → 4", "14 + 6"],
    answerIndex: 0,
    explanation: "The jumps are 4 and 4, so the distance from 6 to 14 is 8.",
  },
  "math-money": {
    title: "Build money with coin-sized jumps",
    principle: "Money problems are ordinary addition and subtraction with cents grouped into useful jumps.",
    steps: ["Write every amount in cents.", "Use jumps of 5, 10, 25, or 100.", "Regroup 100 cents as one dollar."],
    workedExample: "25¢ + 35¢ = 25¢ + 25¢ + 10¢ = 60¢.",
    checkPrompt: "How much is 25¢ + 35¢?",
    choices: ["50¢", "55¢", "60¢", "70¢"],
    answerIndex: 2,
    explanation: "Twenty-five cents plus thirty-five cents equals sixty cents.",
  },
  "math-word-problems": {
    title: "Name what changes in the story",
    principle: "The action in a story tells you which operation represents it.",
    steps: ["Find the starting amount.", "Circle the action: joins, leaves, compares, or shares.", "Estimate whether the answer should grow or shrink."],
    workedExample: "Maya has 6 shells and gets 4 more. The group grows, so use 6 + 4.",
    checkPrompt: "A child has 7 books and gets 3 more. Which operation fits?",
    choices: ["7 + 3", "7 − 3", "7 × 3", "7 ÷ 3"],
    answerIndex: 0,
    explanation: "The amount grows because more books are added, so addition fits the story.",
  },
  "reading-spelling-easy": {
    title: "Stretch the word into sounds",
    principle: "Short words become easier to spell when each sound is heard in order.",
    steps: ["Say the word slowly.", "Tap once for each sound.", "Match a letter or letter team to every sound."],
    workedExample: "FROG can be stretched as /f/ /r/ /o/ /g/.",
    checkPrompt: "Which word matches the sounds /c/ /a/ /t/?",
    choices: ["CAT", "COT", "ACT", "CAP"],
    answerIndex: 0,
    explanation: "C-A-T records the sounds /c/ /a/ /t/ in the same order.",
  },
  "reading-spelling-medium": {
    title: "Chunk a longer word",
    principle: "A longer word is easier to hold when it is divided into syllables or familiar chunks.",
    steps: ["Say the word naturally.", "Clap or tap the syllables.", "Spell one chunk at a time, then reread the whole word."],
    workedExample: "VOLCANO can be held as VOL + CA + NO.",
    checkPrompt: "Which chunking plan is most useful for REMEMBER?",
    choices: ["RE + MEM + BER", "R + EMEMBER", "REMEMB + ER", "All letters at once"],
    answerIndex: 0,
    explanation: "RE + MEM + BER creates three manageable sound chunks.",
  },
  "reading-spelling-hard": {
    title: "Use meaning, chunks, and a memory hook",
    principle: "Advanced spelling improves when sound patterns and meaningful word parts are studied together.",
    steps: ["Find a familiar base or word part.", "Mark the surprising letters.", "Create a short memory sentence or visual hook."],
    workedExample: "ASTRONAUT contains ASTRO, meaning stars or space, plus NAUT, meaning traveler.",
    checkPrompt: "Which spelling is correct?",
    choices: ["ASTRONAUT", "ASTRANOT", "ASTRONOT", "ASTRONAUGHT"],
    answerIndex: 0,
    explanation: "ASTRONAUT keeps the meaningful parts ASTRO and NAUT.",
  },
  "reading-comprehension-detail": {
    title: "Return to the exact sentence",
    principle: "A detail question is answered from evidence in the passage, not from a guess or outside knowledge.",
    steps: ["Name the key word in the question.", "Scan for that word or a synonym.", "Read the sentence before and after it."],
    workedExample: "If the question asks where the fox slept, find the sentence that names the fox and its sleeping place.",
    checkPrompt: "Where should you look first for a story-detail answer?",
    choices: ["The matching sentence in the passage", "Your favorite guess", "A different story", "The title only"],
    answerIndex: 0,
    explanation: "The passage contains the evidence needed for a detail question.",
  },
  "reading-sequencing": {
    title: "Build a beginning, middle, and end chain",
    principle: "Sequence is the order in which events actually happen.",
    steps: ["Find time words such as first, then, after, and finally.", "Write one event on each mental card.", "Check that each event can lead to the next."],
    workedExample: "First the seed is planted, then it sprouts, and finally it grows leaves.",
    checkPrompt: "Which word usually signals the last event?",
    choices: ["Finally", "Before", "Meanwhile", "Because"],
    answerIndex: 0,
    explanation: "Finally commonly introduces the last step or event.",
  },
  "reading-vocabulary": {
    title: "Use the words around the mystery word",
    principle: "Nearby examples, contrasts, and explanations often reveal an unfamiliar word’s meaning.",
    steps: ["Read the whole sentence.", "Look for a clue before or after the word.", "Substitute your possible meaning and reread."],
    workedExample: "The desert was arid, so almost no plants grew. The second clause suggests arid means very dry.",
    checkPrompt: "Which clue best helps define an unfamiliar word?",
    choices: ["Nearby examples and explanations", "The number of letters", "The page color", "The reader's mood"],
    answerIndex: 0,
    explanation: "Context clues in nearby language can reveal meaning.",
  },
  "reading-inference": {
    title: "Combine a clue with what you know",
    principle: "An inference is a careful conclusion supported by text clues, not a random prediction.",
    steps: ["Name the strongest clue.", "Connect it to relevant background knowledge.", "State a conclusion that both pieces support."],
    workedExample: "Wet footprints and a dripping umbrella suggest that it is raining outside.",
    checkPrompt: "A character yawns, rubs her eyes, and turns off the lamp. What is a supported inference?",
    choices: ["She is getting ready to sleep", "She won a race", "She is cooking dinner", "She is outside in the rain"],
    answerIndex: 0,
    explanation: "Yawning, rubbing eyes, and turning off a lamp all support the idea that she is tired and preparing to sleep.",
  },
  "science-earth": {
    title: "Look for an observable Earth process",
    principle: "Earth science explanations connect something we can observe to a process such as motion, heating, cooling, erosion, or the water cycle.",
    steps: ["Name what changed.", "Identify the energy or motion involved.", "Connect the process to the observation."],
    workedExample: "Day and night happen because Earth rotates, changing which side faces the Sun.",
    checkPrompt: "What causes day and night?",
    choices: ["Earth rotates", "The Sun switches off", "Clouds cover Earth", "The Moon stops moving"],
    answerIndex: 0,
    explanation: "Earth's rotation moves locations into and out of sunlight.",
  },
  "science-body": {
    title: "Match each body part to its job",
    principle: "Body systems make sense when structures are connected to the jobs they perform.",
    steps: ["Name the body part.", "Ask what it moves, carries, protects, or controls.", "Connect it to the larger body system."],
    workedExample: "The heart squeezes to move blood through blood vessels.",
    checkPrompt: "What is the heart's main job?",
    choices: ["Pump blood", "Store memories", "Digest food", "Make bones"],
    answerIndex: 0,
    explanation: "The heart pumps blood so oxygen and nutrients can move through the body.",
  },
  "science-space": {
    title: "Use gravity, light, motion, and distance",
    principle: "Most early space questions can be explained by one or more of four ideas: gravity, light, motion, and distance.",
    steps: ["Identify which objects are involved.", "Ask what is moving or shining.", "Choose the force or pattern that explains it."],
    workedExample: "The Sun's gravity continually bends a planet's path into an orbit.",
    checkPrompt: "What keeps planets moving around the Sun?",
    choices: ["Gravity", "Wind", "Sound", "Clouds"],
    answerIndex: 0,
    explanation: "The Sun's gravity pulls planets inward while their motion carries them forward.",
  },
  "science-technology": {
    title: "Trace input, process, and output",
    principle: "A technology system receives an input, processes information or energy, and produces an output.",
    steps: ["Name the input.", "Describe what the system does to it.", "Name the output or result."],
    workedExample: "A keyboard press is input, the computer processes it, and a letter appears as output.",
    checkPrompt: "Why can a computer need time to load?",
    choices: ["It is processing instructions and data", "It is getting sleepy", "It waits for the Moon", "It grows new wires"],
    answerIndex: 0,
    explanation: "Loading takes time because the computer must retrieve and process information before displaying it.",
  },
  "memory-matching": {
    title: "Name, place, cover, recall",
    principle: "Memory strengthens when information is actively retrieved instead of only viewed again.",
    steps: ["Name what you see.", "Connect it to a location.", "Cover it and recall both the item and place."],
    workedExample: "Say 'rocket, top left,' cover the card, then point to the remembered location.",
    checkPrompt: "Which action best strengthens memory?",
    choices: ["Cover and recall", "Keep staring without testing", "Look away permanently", "Guess without looking first"],
    answerIndex: 0,
    explanation: "Retrieval practice strengthens the path used to remember information later.",
  },
  "memory-working-memory": {
    title: "Group information into chunks",
    principle: "Working memory holds more when separate details are organized into a few meaningful groups.",
    steps: ["Find details that belong together.", "Give each group a short name.", "Repeat the groups instead of every isolated detail."],
    workedExample: "Red circle, red square, blue circle, blue square can become two groups: red shapes and blue shapes.",
    checkPrompt: "Which strategy reduces working-memory load?",
    choices: ["Group details into chunks", "Add unrelated details", "Repeat everything faster", "Avoid naming patterns"],
    answerIndex: 0,
    explanation: "Chunking turns many separate details into fewer meaningful units.",
  },
  "logic-patterns": {
    title: "Find the smallest repeating unit",
    principle: "A pattern is easier to extend after its shortest repeating block is identified.",
    steps: ["Mark where the sequence seems to restart.", "Name the repeating block.", "Repeat that block one more time."],
    workedExample: "Blue, yellow, blue, yellow repeats the block blue-yellow.",
    checkPrompt: "What comes next? 2, 4, 2, 4, __",
    choices: ["2", "3", "4", "6"],
    answerIndex: 0,
    explanation: "The repeating block is 2, 4, so the next number is 2.",
  },
  "logic-multi-step": {
    title: "Hold one fact at a time",
    principle: "Multi-step reasoning becomes manageable when each fact is translated into a small, visible relationship.",
    steps: ["Write or say the first relationship.", "Add the next fact without dropping the first.", "Check which conclusion follows from both."],
    workedExample: "Mia is taller than Leo, and Leo is taller than Sam. The chain is Mia > Leo > Sam.",
    checkPrompt: "Mia is taller than Leo, and Leo is taller than Sam. Who is shortest?",
    choices: ["Mia", "Leo", "Sam", "They are equal"],
    answerIndex: 2,
    explanation: "The chain Mia > Leo > Sam places Sam at the shortest end.",
  },
};

function genericLesson(intervention: MasteryIntervention): MasteryLesson {
  const subject = intervention.subject;
  const subjectStrategies: Partial<Record<typeof subject, { principle: string; steps: string[]; example: string }>> = {
    Math: {
      principle: "A hard math task becomes easier when quantities are represented, broken into smaller steps, and checked with a second strategy.",
      steps: ["Represent the quantities.", "Solve one small step at a time.", "Estimate or use an inverse operation to check."],
      example: "Draw, count, or write a number sentence before calculating.",
    },
    Reading: {
      principle: "Reading improves when the learner returns to exact words, notices structure, and explains the evidence aloud.",
      steps: ["Name what the question asks.", "Find the matching words or clues.", "Explain why the evidence supports the answer."],
      example: "Point to the sentence that proves the answer before choosing.",
    },
    Science: {
      principle: "Science explanations connect an observation to a cause, system, or testable process.",
      steps: ["Describe what is observed.", "Name the process or system involved.", "Connect the cause to the effect."],
      example: "Use because to connect evidence to the scientific explanation.",
    },
    Logic: {
      principle: "Reasoning is easier when rules and clues are made visible one at a time.",
      steps: ["State the rule.", "Apply it to one clue.", "Check the conclusion against every clue."],
      example: "Translate a long clue into a short relationship or diagram.",
    },
    Memory: {
      principle: "Memory grows through organization and retrieval, not repeated looking alone.",
      steps: ["Group related information.", "Cover it.", "Recall it without looking, then check."],
      example: "Give a group a name, hide it, and reconstruct it from memory.",
    },
    Geography: {
      principle: "Geography connects location, physical features, people, and the choices they make.",
      steps: ["Locate the place.", "Notice land, water, climate, or resources.", "Explain how those features affect people or movement."],
      example: "Use a map symbol or direction before drawing a conclusion about a place.",
    },
    History: {
      principle: "Historical reasoning uses sequence, evidence, perspective, and cause rather than memorizing isolated facts.",
      steps: ["Place events in order.", "Identify the available evidence.", "Explain a cause, effect, or perspective."],
      example: "Ask what happened before, what changed, and whose viewpoint the source represents.",
    },
    Civics: {
      principle: "Civic choices can be evaluated by rules, rights, responsibilities, evidence, and effects on a community.",
      steps: ["Name the community problem.", "Identify rights and responsibilities.", "Choose a fair action and explain its effect."],
      example: "Compare a proposed rule with the reason the community needs it.",
    },
    Engineering: {
      principle: "Engineering improves through requirements, testing, evidence, and revision.",
      steps: ["Name what the design must do.", "Test one feature.", "Change one variable based on evidence."],
      example: "A failed test is information about which part to redesign.",
    },
    Coding: {
      principle: "Code can be understood by tracing inputs, instructions, state changes, and outputs in order.",
      steps: ["Name the starting state.", "Run one instruction at a time.", "Compare the expected and actual output."],
      example: "Use a small test case to find the first step where behavior changes unexpectedly.",
    },
    Wellbeing: {
      principle: "Social and emotional problems become easier when feelings, needs, choices, and consequences are named separately.",
      steps: ["Name the feeling or need.", "Pause before acting.", "Choose a safe, respectful next step."],
      example: "Use a calm sentence that describes the problem and asks for what is needed.",
    },
  };
  const strategy = subjectStrategies[subject] ?? {
    principle: "A sticky skill becomes easier when it is broken into visible steps and explained in the learner's own words.",
    steps: ["Name the goal.", "Try one small step.", "Explain what worked and check the result."],
    example: "Use a diagram, example, gesture, or spoken explanation before trying again.",
  };
  return {
    title: `A new path for ${intervention.skillLabel}`,
    principle: strategy.principle,
    steps: strategy.steps,
    workedExample: strategy.example,
    checkPrompt: "Which approach is most likely to help when a skill feels sticky?",
    choices: ["Break it into steps and explain each one", "Guess faster", "Skip every difficult part", "Repeat the same mistake without checking"],
    answerIndex: 0,
    explanation: "Breaking the task into steps and explaining the reasoning creates useful evidence about what is understood and what needs another path.",
  };
}

export function masteryLessonFor(intervention: MasteryIntervention): MasteryLesson {
  return EXACT_LESSONS[intervention.skillId] ?? genericLesson(intervention);
}
