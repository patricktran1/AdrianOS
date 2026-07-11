export type ReadingLevel = "Starter" | "Growing" | "Challenge";
export type ReadingTheme = "Animals" | "Space" | "Science" | "Everyday" | "Adventure";
export type ReadingSkill = "detail" | "sequence" | "vocabulary" | "inference";

export type ReadingQuestion = {
  id: string;
  skill: ReadingSkill;
  prompt: string;
  options: string[];
  answer: string;
  hint: string;
  explanation: string;
};

export type ReadingStory = {
  id: string;
  title: string;
  emoji: string;
  level: ReadingLevel;
  theme: ReadingTheme;
  passage: string;
  vocabulary: Array<{ word: string; meaning: string }>;
  questions: ReadingQuestion[];
};

export const READING_SKILLS: Record<ReadingSkill, { id: string; label: string }> = {
  detail: { id: "reading-comprehension-detail", label: "Finding story details" },
  sequence: { id: "reading-sequencing", label: "Story sequencing" },
  vocabulary: { id: "reading-vocabulary", label: "Vocabulary in context" },
  inference: { id: "reading-inference", label: "Reading inference" },
};

export const READING_STORIES: ReadingStory[] = [
  {
    id: "starter-pip-raincoat",
    title: "Pip's Raincoat",
    emoji: "🐥",
    level: "Starter",
    theme: "Animals",
    passage: "Pip the chick saw dark clouds. He put on a yellow raincoat and red boots. Soon, rain tapped on the barn roof. Pip splashed in one small puddle, then hurried inside for warm corn soup.",
    vocabulary: [{ word: "hurried", meaning: "moved quickly" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What color was Pip's raincoat?", options: ["Yellow", "Blue", "Green"], answer: "Yellow", hint: "Look at the sentence about what Pip put on.", explanation: "The passage says Pip put on a yellow raincoat." },
      { id: "sequence", skill: "sequence", prompt: "What did Pip do after he splashed in a puddle?", options: ["Went inside", "Found the clouds", "Put on boots"], answer: "Went inside", hint: "Find the words after 'then.'", explanation: "After splashing, Pip hurried inside." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does hurried mean in this story?", options: ["Moved quickly", "Slept quietly", "Sang loudly"], answer: "Moved quickly", hint: "Pip wanted to get out of the rain.", explanation: "Hurried means moved quickly." },
      { id: "inference", skill: "inference", prompt: "Why did Pip put on a raincoat?", options: ["Rain was coming", "He was cold inside", "He wanted to fly"], answer: "Rain was coming", hint: "Think about the dark clouds and the sound on the roof.", explanation: "The dark clouds showed that rain was coming." },
    ],
  },
  {
    id: "starter-moon-mail",
    title: "Moon Mail",
    emoji: "🌙",
    level: "Starter",
    theme: "Space",
    passage: "Mara drew a silver moon on a card. She wrote, 'Good night, Grandpa.' Dad helped her place the card in an envelope. In the morning, Mara put the envelope in the blue mailbox before school.",
    vocabulary: [{ word: "envelope", meaning: "a paper cover that holds a letter or card" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "Who was the card for?", options: ["Grandpa", "Dad", "Mara's teacher"], answer: "Grandpa", hint: "Read the words Mara wrote.", explanation: "Mara wrote 'Good night, Grandpa.'" },
      { id: "sequence", skill: "sequence", prompt: "What happened first?", options: ["Mara drew a moon", "Mara used the mailbox", "Mara went to school"], answer: "Mara drew a moon", hint: "Look at the first sentence.", explanation: "The story begins when Mara draws a silver moon." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What is an envelope used for?", options: ["Holding a card", "Drawing a moon", "Opening a door"], answer: "Holding a card", hint: "Dad helped Mara put the card inside it.", explanation: "An envelope is a paper cover that holds a letter or card." },
      { id: "inference", skill: "inference", prompt: "Why did Mara use the mailbox?", options: ["To send the card", "To hide her pencil", "To find breakfast"], answer: "To send the card", hint: "Mailboxes help letters travel to people.", explanation: "Mara placed the envelope in the mailbox so it could be sent to Grandpa." },
    ],
  },
  {
    id: "starter-seed-window",
    title: "The Window Seed",
    emoji: "🌱",
    level: "Starter",
    theme: "Science",
    passage: "Leo pushed a bean seed into soft soil. He set the cup by a sunny window and gave it a little water. Four days later, a green stem curled above the soil. Leo called Mom to come see.",
    vocabulary: [{ word: "stem", meaning: "the part of a plant that holds up its leaves" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "Where did Leo put the cup?", options: ["By a sunny window", "Under his bed", "In the freezer"], answer: "By a sunny window", hint: "Look for the place with sunlight.", explanation: "Leo set the cup by a sunny window." },
      { id: "sequence", skill: "sequence", prompt: "What did Leo do right after planting the seed?", options: ["Put the cup by a window", "Called Mom", "Picked a leaf"], answer: "Put the cup by a window", hint: "Follow the actions in the second sentence.", explanation: "After planting, Leo set the cup by the window and watered it." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What is a plant stem?", options: ["The part that holds up leaves", "A kind of seed", "A spot of sunlight"], answer: "The part that holds up leaves", hint: "The green part rose above the soil.", explanation: "A stem supports the leaves and other parts of a plant." },
      { id: "inference", skill: "inference", prompt: "Why was Leo excited?", options: ["The seed began to grow", "The cup broke", "The window closed"], answer: "The seed began to grow", hint: "Think about why he called Mom to look.", explanation: "Leo was excited because the seed had grown a green stem." },
    ],
  },
  {
    id: "starter-library-card",
    title: "Nina's Library Card",
    emoji: "📚",
    level: "Starter",
    theme: "Everyday",
    passage: "Nina chose two books at the library. One book was about sharks. The other had silly poems. At the desk, she showed her library card. The librarian stamped a date and placed both books in Nina's bag.",
    vocabulary: [{ word: "librarian", meaning: "a person who helps people use a library" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What was one book about?", options: ["Sharks", "Trains", "Cakes"], answer: "Sharks", hint: "Read the second sentence.", explanation: "One of Nina's books was about sharks." },
      { id: "sequence", skill: "sequence", prompt: "What happened after Nina showed her card?", options: ["The librarian stamped a date", "Nina chose the books", "Nina wrote a poem"], answer: "The librarian stamped a date", hint: "Look at the final sentence.", explanation: "After Nina showed her card, the librarian stamped a date." },
      { id: "vocabulary", skill: "vocabulary", prompt: "Who is a librarian?", options: ["A person who helps at a library", "A person who fixes roads", "A person who flies a plane"], answer: "A person who helps at a library", hint: "This person worked at the library desk.", explanation: "A librarian helps people find and borrow books." },
      { id: "inference", skill: "inference", prompt: "What will Nina probably do with the books?", options: ["Read them", "Plant them", "Cook them"], answer: "Read them", hint: "Why do people borrow library books?", explanation: "Nina borrowed the books so she could read them." },
    ],
  },
  {
    id: "starter-bridge-sticks",
    title: "A Bridge of Sticks",
    emoji: "🌉",
    level: "Starter",
    theme: "Adventure",
    passage: "Owen's toy truck could not cross a wide crack in the sandbox. He laid three flat sticks across the gap. Then he pressed sand around the ends. The truck rolled over the new bridge without falling.",
    vocabulary: [{ word: "gap", meaning: "an open space between two things" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "How many sticks did Owen use?", options: ["Three", "Two", "Five"], answer: "Three", hint: "Find the number before 'flat sticks.'", explanation: "Owen laid three flat sticks across the gap." },
      { id: "sequence", skill: "sequence", prompt: "What did Owen do before the truck crossed?", options: ["Pressed sand around the sticks", "Put the truck away", "Dug a lake"], answer: "Pressed sand around the sticks", hint: "Look at the step just before the last sentence.", explanation: "Owen pressed sand around the stick ends before rolling the truck across." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What is a gap?", options: ["An open space", "A toy truck", "A pile of sand"], answer: "An open space", hint: "The sticks went across it.", explanation: "A gap is an open space between two things." },
      { id: "inference", skill: "inference", prompt: "Why did Owen press sand around the sticks?", options: ["To hold the bridge steady", "To color the truck", "To make the crack wider"], answer: "To hold the bridge steady", hint: "Think about what keeps a bridge from moving.", explanation: "The sand helped hold the ends of the stick bridge in place." },
    ],
  },
  {
    id: "growing-fox-shadow",
    title: "The Fox and the Long Shadow",
    emoji: "🦊",
    level: "Growing",
    theme: "Animals",
    passage: "At sunrise, Fenn the fox noticed that his shadow stretched far across the meadow. He leaped toward it, but the shadow moved whenever he moved. At noon, the shadow became short and hid beneath him. By evening it grew long again, pointing the other way. Fenn finally understood that the shadow changed as the sun crossed the sky.",
    vocabulary: [{ word: "stretched", meaning: "reached across a long distance" }, { word: "meadow", meaning: "an open field covered with grass" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "When was Fenn's shadow shortest?", options: ["At noon", "At sunrise", "In the evening"], answer: "At noon", hint: "Find when the shadow hid beneath him.", explanation: "The passage says the shadow became short at noon." },
      { id: "sequence", skill: "sequence", prompt: "Which order matches the story?", options: ["Long, short, long", "Short, long, gone", "Long, gone, short"], answer: "Long, short, long", hint: "Track sunrise, noon, and evening.", explanation: "The shadow was long at sunrise, short at noon, and long again in the evening." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does stretched mean here?", options: ["Reached far", "Fell asleep", "Turned bright"], answer: "Reached far", hint: "The shadow went across the meadow.", explanation: "Stretched means reached across a long distance." },
      { id: "inference", skill: "inference", prompt: "What caused the shadow to change?", options: ["The sun's position", "The grass growing", "Fenn changing color"], answer: "The sun's position", hint: "Use the final sentence and the times of day.", explanation: "As the sun changed position in the sky, the shadow changed length and direction." },
    ],
  },
  {
    id: "growing-orbit-cafe",
    title: "Breakfast in Orbit",
    emoji: "🛰️",
    level: "Growing",
    theme: "Space",
    passage: "Commander Vale opened a pouch of oatmeal aboard the space station. She added warm water through a small valve, then squeezed the oatmeal onto a spoon. The spoon began to float when she let go. Vale caught it before it drifted into a vent. In orbit, the station and everything inside it are falling around Earth together, so objects seem weightless.",
    vocabulary: [{ word: "valve", meaning: "a part that controls the flow of liquid or gas" }, { word: "orbit", meaning: "a curved path around a planet or other object" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What food did Commander Vale prepare?", options: ["Oatmeal", "Pizza", "Soup"], answer: "Oatmeal", hint: "Read the first sentence.", explanation: "Commander Vale opened a pouch of oatmeal." },
      { id: "sequence", skill: "sequence", prompt: "What did Vale do after adding water?", options: ["Squeezed oatmeal onto a spoon", "Opened the station door", "Put the spoon in a vent"], answer: "Squeezed oatmeal onto a spoon", hint: "Follow the steps in the second sentence.", explanation: "After adding water, she squeezed the oatmeal onto a spoon." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does orbit mean?", options: ["A path around an object", "A kind of breakfast", "A door in a wall"], answer: "A path around an object", hint: "The station travels around Earth.", explanation: "An orbit is a curved path around a planet or other object." },
      { id: "inference", skill: "inference", prompt: "Why did the spoon float?", options: ["Everything was falling around Earth together", "The spoon was made of air", "Vale threw it upward"], answer: "Everything was falling around Earth together", hint: "Use the final sentence.", explanation: "Objects seem weightless because the station and everything in it are falling around Earth together." },
    ],
  },
  {
    id: "growing-ice-cube-race",
    title: "The Ice Cube Race",
    emoji: "🧊",
    level: "Growing",
    theme: "Science",
    passage: "Suri placed one ice cube on a metal tray and another on a folded towel. She predicted that the towel would melt its cube first because the towel felt warmer. Ten minutes later, the cube on the metal tray was much smaller. Metal transfers heat quickly from the room into the ice, even though the metal may feel cool to a hand.",
    vocabulary: [{ word: "predicted", meaning: "made a careful guess about what would happen" }, { word: "transfers", meaning: "moves something from one place to another" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "Where was the faster-melting ice cube?", options: ["On the metal tray", "On the towel", "In a cup"], answer: "On the metal tray", hint: "Find which cube became much smaller.", explanation: "The ice cube on the metal tray melted faster." },
      { id: "sequence", skill: "sequence", prompt: "What happened before Suri checked the cubes?", options: ["She made a prediction", "She heated the towel", "She froze the tray"], answer: "She made a prediction", hint: "The story tells her guess before the ten-minute wait.", explanation: "Suri predicted the towel would melt its cube first before checking the result." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What is a prediction?", options: ["A careful guess", "A metal object", "A final answer copied later"], answer: "A careful guess", hint: "Suri said what she thought would happen before the test.", explanation: "A prediction is a careful guess about what will happen." },
      { id: "inference", skill: "inference", prompt: "What did Suri learn from the test?", options: ["How something feels does not always show how quickly it moves heat", "Towels are made of ice", "Metal cannot transfer heat"], answer: "How something feels does not always show how quickly it moves heat", hint: "The metal felt cool but still melted the ice faster.", explanation: "The result showed that cool-feeling metal can still transfer heat quickly." },
    ],
  },
  {
    id: "growing-missing-recipe",
    title: "The Missing Recipe Step",
    emoji: "🥞",
    level: "Growing",
    theme: "Everyday",
    passage: "Jay and Aunt Mina mixed flour, milk, and an egg for pancakes. Their first pancake stuck to the pan and tore when Jay tried to flip it. Aunt Mina reread the recipe and noticed they had skipped one instruction: lightly oil the pan. They added a thin coat of oil, and the next pancake slid free in one golden circle.",
    vocabulary: [{ word: "instruction", meaning: "a direction that tells what to do" }, { word: "coat", meaning: "a thin layer covering a surface" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What ingredient step had they skipped?", options: ["Oil the pan", "Add an egg", "Warm the milk"], answer: "Oil the pan", hint: "Aunt Mina found the missing instruction.", explanation: "They had forgotten to lightly oil the pan." },
      { id: "sequence", skill: "sequence", prompt: "What happened immediately after they added oil?", options: ["The next pancake slid free", "They reread the recipe", "The first pancake tore"], answer: "The next pancake slid free", hint: "Look at the final sentence.", explanation: "After adding oil, the next pancake slid free from the pan." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does a thin coat of oil mean?", options: ["A thin layer of oil", "A jacket made of oil", "A deep bowl of oil"], answer: "A thin layer of oil", hint: "The oil covered the pan's surface.", explanation: "A coat is a thin layer covering a surface." },
      { id: "inference", skill: "inference", prompt: "Why did the second pancake work better?", options: ["Oil kept it from sticking", "They removed the flour", "The pan became cold"], answer: "Oil kept it from sticking", hint: "Compare the pan before and after the missing step.", explanation: "The thin layer of oil stopped the pancake from sticking to the pan." },
    ],
  },
  {
    id: "growing-canyon-echo",
    title: "The Canyon Answered",
    emoji: "🏜️",
    level: "Growing",
    theme: "Adventure",
    passage: "On a canyon trail, Bea called, 'Hello!' A moment later, a faint 'Hello!' returned from the cliffs. Her brother said the canyon was not speaking. Bea's voice made sound waves that traveled through the air, struck the rock wall, and bounced back. Bea tried again with a clap and heard a second sharp clap answer her.",
    vocabulary: [{ word: "faint", meaning: "quiet and hard to notice" }, { word: "echo", meaning: "a sound heard again after it bounces back" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What sound did Bea try after calling hello?", options: ["A clap", "A whistle", "A drum"], answer: "A clap", hint: "Read the final sentence.", explanation: "Bea tried again by clapping." },
      { id: "sequence", skill: "sequence", prompt: "Which event happened second?", options: ["The sound struck the cliff", "Bea heard the echo", "The sound bounced back"], answer: "The sound struck the cliff", hint: "The sound traveled, struck the rock, then bounced back.", explanation: "The sound first traveled through the air, then struck the cliff, and finally bounced back." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does faint mean?", options: ["Quiet and hard to notice", "Very bright", "Heavy and solid"], answer: "Quiet and hard to notice", hint: "The returning hello was not loud.", explanation: "Faint means quiet and difficult to notice." },
      { id: "inference", skill: "inference", prompt: "Why was the second clap delayed?", options: ["The sound needed time to travel to the cliff and back", "Bea forgot to clap", "The cliff moved away"], answer: "The sound needed time to travel to the cliff and back", hint: "Think about the path of the sound waves.", explanation: "The echo arrived later because sound needed time to travel to the cliff and return." },
    ],
  },
  {
    id: "challenge-octopus-garden",
    title: "The Octopus's Garden Wall",
    emoji: "🐙",
    level: "Challenge",
    theme: "Animals",
    passage: "A diver named Ren noticed an octopus carrying shells across the sea floor. The animal placed each shell beside the entrance to its den, then pushed small stones into the spaces between them. Over several trips, the octopus formed a low wall. The wall did not seal the den, but it narrowed the opening and made the entrance harder for a large predator to reach. Ren recorded the behavior instead of moving the shells, because changing the wall might have disturbed the octopus's careful work.",
    vocabulary: [{ word: "predator", meaning: "an animal that hunts other animals" }, { word: "disturbed", meaning: "interrupted or changed something" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What did the octopus place between the shells?", options: ["Small stones", "Seaweed", "Sand dollars"], answer: "Small stones", hint: "Look at how the octopus filled the spaces.", explanation: "The octopus pushed small stones between the shells." },
      { id: "sequence", skill: "sequence", prompt: "What did the octopus do before forming a wall?", options: ["Carried shells to the den", "Sealed the den", "Chased the diver"], answer: "Carried shells to the den", hint: "The wall was built over several trips.", explanation: "The octopus first carried shells to the den entrance, then arranged them into a wall." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What is a predator?", options: ["An animal that hunts other animals", "A place where an animal sleeps", "A scientist underwater"], answer: "An animal that hunts other animals", hint: "The wall made the den harder for this animal to reach.", explanation: "A predator hunts other animals for food." },
      { id: "inference", skill: "inference", prompt: "Why did Ren avoid moving the shells?", options: ["The wall may have helped protect the octopus", "The shells were too bright", "Ren did not see the wall"], answer: "The wall may have helped protect the octopus", hint: "Use the purpose of the narrowed entrance.", explanation: "Ren left the wall alone because it appeared to be a protective structure the octopus had built carefully." },
    ],
  },
  {
    id: "challenge-red-planet-signal",
    title: "Signal from the Red Planet",
    emoji: "📡",
    level: "Challenge",
    theme: "Space",
    passage: "A rover on Mars drilled a shallow hole and measured the minerals in the powder below the surface. When the rover sent its data toward Earth, the message did not arrive immediately. Mars and Earth were millions of kilometers apart, and radio signals could travel no faster than light. Engineers waited, then received the data several minutes later. They studied the mineral pattern for clues that liquid water may once have flowed through the rock.",
    vocabulary: [{ word: "mineral", meaning: "a natural solid substance found in rock" }, { word: "data", meaning: "facts or measurements collected for study" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What did the rover measure?", options: ["Minerals in powder", "Wind inside Earth", "The color of engineers' screens"], answer: "Minerals in powder", hint: "Read the first sentence.", explanation: "The rover measured minerals in powder from below the surface." },
      { id: "sequence", skill: "sequence", prompt: "What happened after the rover sent its message?", options: ["Engineers waited", "The rover reached Earth", "Water flowed immediately"], answer: "Engineers waited", hint: "The signal needed time to cross the distance.", explanation: "After the rover sent the data, engineers waited for it to arrive." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does data mean?", options: ["Collected facts or measurements", "A hole in the ground", "A kind of planet"], answer: "Collected facts or measurements", hint: "The engineers studied what the rover measured.", explanation: "Data are facts or measurements collected for study." },
      { id: "inference", skill: "inference", prompt: "Why did engineers study the mineral pattern?", options: ["It might show that water once flowed there", "It could make the rover faster", "It would shorten the radio delay"], answer: "It might show that water once flowed there", hint: "Use the final sentence.", explanation: "Certain mineral patterns can provide evidence that liquid water once moved through rock." },
    ],
  },
  {
    id: "challenge-bat-detector",
    title: "Building a Bat Detector",
    emoji: "🔊",
    level: "Challenge",
    theme: "Science",
    passage: "Mika wanted to know when bats visited the garden, but many bat calls were too high for human ears to hear. She built a detector with a microphone that could sense ultrasonic sound. The device changed each high-frequency call into a lower sound and saved the time of the recording. After one week, Mika found that most calls occurred shortly after sunset near the fig tree. She could not prove why the bats gathered there, but she formed a new question about whether insects were more plentiful near the fruit.",
    vocabulary: [{ word: "ultrasonic", meaning: "having a frequency higher than humans can hear" }, { word: "plentiful", meaning: "present in a large amount" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "Where did Mika record most bat calls?", options: ["Near the fig tree", "Inside the house", "Beside a pond at noon"], answer: "Near the fig tree", hint: "Look at the results after one week.", explanation: "Most calls occurred near the fig tree shortly after sunset." },
      { id: "sequence", skill: "sequence", prompt: "What did the detector do before saving the time?", options: ["Changed the call into a lower sound", "Counted the insects", "Moved the fig tree"], answer: "Changed the call into a lower sound", hint: "Follow the device's two actions in order.", explanation: "The detector changed the high call into a lower sound and then saved the recording time." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does ultrasonic mean?", options: ["Too high for humans to hear", "Very quiet because it is far away", "Made by a machine only"], answer: "Too high for humans to hear", hint: "The microphone could sense sounds human ears could not.", explanation: "Ultrasonic sound has a frequency above the range of human hearing." },
      { id: "inference", skill: "inference", prompt: "What is the best next investigation for Mika?", options: ["Compare insect numbers near the fig tree and elsewhere", "Paint the detector", "Listen only at noon"], answer: "Compare insect numbers near the fig tree and elsewhere", hint: "Her new question was about insects near the fruit.", explanation: "Comparing insect numbers would test whether food availability helps explain the bats' location." },
    ],
  },
  {
    id: "challenge-community-fridge",
    title: "The Community Fridge Plan",
    emoji: "🥕",
    level: "Challenge",
    theme: "Everyday",
    passage: "The school garden produced more zucchini than the cafeteria could use. Sam proposed placing the extra vegetables in a community refrigerator where families could take what they needed. Before starting, the class listed possible problems: food could spoil, the refrigerator could become messy, and some families might not know it existed. They created date labels, a daily cleaning schedule, and picture signs in three languages. After a month, less garden food was thrown away, although the class still needed a plan for weekends.",
    vocabulary: [{ word: "proposed", meaning: "suggested a plan for others to consider" }, { word: "community", meaning: "people who live, learn, or work in the same area" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "Why did the class make signs in three languages?", options: ["So more families could understand them", "To make the refrigerator colder", "To grow more zucchini"], answer: "So more families could understand them", hint: "One concern was that families might not know about the fridge.", explanation: "Multilingual picture signs helped more families understand how to use the refrigerator." },
      { id: "sequence", skill: "sequence", prompt: "What did the class do before opening the refrigerator project?", options: ["Listed possible problems", "Measured one month of results", "Stopped the garden"], answer: "Listed possible problems", hint: "Find the planning step before the solutions.", explanation: "The class first identified possible problems, then designed solutions." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What does proposed mean?", options: ["Suggested a plan", "Cleaned a shelf", "Refused to help"], answer: "Suggested a plan", hint: "Sam shared an idea for the extra vegetables.", explanation: "Proposed means suggested a plan for others to consider." },
      { id: "inference", skill: "inference", prompt: "Which result shows the project helped?", options: ["Less garden food was thrown away", "The class found another problem", "The zucchini stopped growing"], answer: "Less garden food was thrown away", hint: "Look for a change connected to the project's goal.", explanation: "Reducing wasted garden food was evidence that the community fridge helped." },
    ],
  },
  {
    id: "challenge-river-map",
    title: "The Map That Changed",
    emoji: "🗺️",
    level: "Challenge",
    theme: "Adventure",
    passage: "During a hike, Noor compared the river beside the trail with an old park map. The map showed a tight bend near a cluster of boulders, but the river now followed a straighter channel several meters away. A ranger explained that a winter flood had carried branches and sediment into the old bend. Water then found an easier route across lower ground. Noor marked the new channel in her notebook and wrote that maps are records of a place at a particular time, not promises that the place will never change.",
    vocabulary: [{ word: "sediment", meaning: "small pieces of rock, sand, or soil carried by water" }, { word: "channel", meaning: "the path through which a river flows" }],
    questions: [
      { id: "detail", skill: "detail", prompt: "What blocked part of the old river bend?", options: ["Branches and sediment", "A new bridge", "A herd of animals"], answer: "Branches and sediment", hint: "Use the ranger's explanation.", explanation: "A flood carried branches and sediment into the old bend." },
      { id: "sequence", skill: "sequence", prompt: "What happened after the old bend filled?", options: ["Water found an easier route", "Noor printed the old map", "The boulders disappeared"], answer: "Water found an easier route", hint: "Follow the cause and effect in the ranger's explanation.", explanation: "After material collected in the old bend, water moved across lower ground and formed a new channel." },
      { id: "vocabulary", skill: "vocabulary", prompt: "What is a river channel?", options: ["The path where a river flows", "A television station", "A kind of hiking shoe"], answer: "The path where a river flows", hint: "The river changed from an old path to a new one.", explanation: "A channel is the path through which a river flows." },
      { id: "inference", skill: "inference", prompt: "What larger lesson did Noor learn?", options: ["Landscapes can change after maps are made", "All old maps are useless", "Rivers always move in straight lines"], answer: "Landscapes can change after maps are made", hint: "Use Noor's final note.", explanation: "Noor learned that maps record a place at one time, while natural places can continue changing." },
    ],
  },
];

export function readingStoryById(id: string): ReadingStory | null {
  return READING_STORIES.find((story) => story.id === id) ?? null;
}

export function readingQuestionById(story: ReadingStory, id: string): ReadingQuestion | null {
  return story.questions.find((question) => question.id === id) ?? null;
}
