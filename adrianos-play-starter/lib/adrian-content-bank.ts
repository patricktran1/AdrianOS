export type ScienceTopic = "Earth" | "Body" | "Space" | "Technology";

export type ScienceQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  topic: ScienceTopic;
  emoji: string;
  level: 1 | 2 | 3;
};

export const SCIENCE_QUESTIONS: ScienceQuestion[] = [
  { id: "earth-lightning", prompt: "Why does lightning happen?", choices: ["Electric charge builds up in clouds", "The Moon shakes the sky", "Clouds are made of fire"], answer: 0, explanation: "Positive and negative charges separate inside storm clouds. Electricity jumps when the difference becomes large enough.", topic: "Earth", emoji: "⚡", level: 2 },
  { id: "earth-snowball", prompt: "Why can snow become a snowball?", choices: ["Snow is magnetic", "Pressure helps crystals stick together", "Snow contains glue"], answer: 1, explanation: "Pressing snow can melt a tiny layer of water. It refreezes and locks the crystals together.", topic: "Earth", emoji: "❄️", level: 2 },
  { id: "earth-day-night", prompt: "What causes day and night?", choices: ["Earth spins", "The Sun turns off", "Clouds cover the sky"], answer: 0, explanation: "Earth rotates once about every 24 hours. The side facing the Sun has day.", topic: "Earth", emoji: "🌍", level: 1 },
  { id: "earth-volcano", prompt: "Why do volcanoes erupt?", choices: ["Hot rock and gas push upward", "Mountains get angry", "Rain fills them up"], answer: 0, explanation: "Magma and gas build pressure below Earth’s surface until they escape.", topic: "Earth", emoji: "🌋", level: 2 },
  { id: "earth-rain", prompt: "Where does rain come from?", choices: ["Water vapor cools into droplets", "Stars melt", "Trees throw water upward"], answer: 0, explanation: "Water evaporates, rises, cools into cloud droplets, and falls when the droplets grow heavy.", topic: "Earth", emoji: "🌧️", level: 1 },
  { id: "earth-seasons", prompt: "Why do seasons change?", choices: ["Earth’s tilted axis changes the angle of sunlight", "The Sun gets much closer every summer", "Trees control the weather"], answer: 0, explanation: "Earth’s axis is tilted. As Earth orbits the Sun, each hemisphere receives different angles and lengths of sunlight.", topic: "Earth", emoji: "🍂", level: 3 },
  { id: "earth-wind", prompt: "What makes wind move?", choices: ["Air moves from higher pressure toward lower pressure", "The ocean pulls every cloud", "Birds push the air together"], answer: 0, explanation: "Uneven heating creates pressure differences. Air flows from areas of higher pressure toward lower pressure.", topic: "Earth", emoji: "💨", level: 2 },
  { id: "earth-rocks", prompt: "How can a rock slowly become sand?", choices: ["Weathering breaks it into smaller pieces", "It forgets how to be a rock", "Moonlight dissolves it"], answer: 0, explanation: "Water, wind, ice, roots, and temperature changes can slowly break rock into smaller grains.", topic: "Earth", emoji: "🪨", level: 2 },
  { id: "earth-ocean-salty", prompt: "Why is ocean water salty?", choices: ["Dissolved minerals wash from rocks into rivers and seas", "Fish add salt", "The Sun sprinkles salt from space"], answer: 0, explanation: "Water dissolves tiny amounts of minerals from rocks. Rivers carry many of those dissolved salts to the ocean.", topic: "Earth", emoji: "🌊", level: 3 },
  { id: "earth-earthquake", prompt: "What causes most earthquakes?", choices: ["Pieces of Earth’s crust suddenly shift", "Thunder pushes the ground", "Mountains jump"], answer: 0, explanation: "Tectonic plates can stick, build stress, and then suddenly move, releasing energy as an earthquake.", topic: "Earth", emoji: "📳", level: 3 },
  { id: "earth-clouds", prompt: "What are clouds mostly made of?", choices: ["Tiny water droplets or ice crystals", "Smoke from the Sun", "Soft cotton"], answer: 0, explanation: "Clouds form when water vapor cools into tiny liquid droplets or ice crystals suspended in air.", topic: "Earth", emoji: "☁️", level: 1 },
  { id: "earth-groundwater", prompt: "Where can rainwater go after soaking into soil?", choices: ["It can collect underground as groundwater", "It disappears forever", "It turns directly into rock"], answer: 0, explanation: "Some water seeps through soil and rock and collects in underground spaces called aquifers.", topic: "Earth", emoji: "💧", level: 3 },

  { id: "body-sweat", prompt: "Why do people sweat?", choices: ["To make skin shiny", "To cool the body", "To store extra water"], answer: 1, explanation: "Sweat carries heat away when it evaporates from the skin.", topic: "Body", emoji: "💧", level: 1 },
  { id: "body-heart", prompt: "What does the heart do?", choices: ["Pumps blood", "Stores memories", "Makes bones grow"], answer: 0, explanation: "The heart is a muscular pump that moves blood, oxygen, and nutrients through the body.", topic: "Body", emoji: "❤️", level: 1 },
  { id: "body-air", prompt: "Why do we need air?", choices: ["Cells use oxygen to release energy", "Air makes us taller", "Bones are filled with air"], answer: 0, explanation: "Your cells use oxygen to help release energy from food.", topic: "Body", emoji: "🫁", level: 2 },
  { id: "body-skull", prompt: "What protects your brain?", choices: ["The skull", "The stomach", "The elbow"], answer: 0, explanation: "The skull is a strong bony case surrounding the brain.", topic: "Body", emoji: "🧠", level: 1 },
  { id: "body-muscles-tired", prompt: "Why do muscles get tired?", choices: ["They use energy and need recovery", "They forget how to move", "They turn into bone"], answer: 0, explanation: "Working muscles use stored energy and need oxygen, nutrients, and rest to recover.", topic: "Body", emoji: "💪", level: 2 },
  { id: "body-digestion", prompt: "What is digestion?", choices: ["Breaking food into nutrients the body can use", "Turning bones into muscles", "Cooling the blood"], answer: 0, explanation: "Digestion breaks food into smaller molecules that can be absorbed and used for energy, growth, and repair.", topic: "Body", emoji: "🍎", level: 2 },
  { id: "body-blink", prompt: "Why do we blink?", choices: ["To spread tears and protect the eyes", "To recharge the ears", "To make the brain sleep"], answer: 0, explanation: "Blinking spreads a thin tear film over the eye and helps remove dust and protect the surface.", topic: "Body", emoji: "👁️", level: 1 },
  { id: "body-bones", prompt: "What is one important job of bones?", choices: ["Support and protect the body", "Make thoughts", "Pump air"], answer: 0, explanation: "Bones support your shape, help movement with muscles, and protect organs such as the brain and heart.", topic: "Body", emoji: "🦴", level: 1 },
  { id: "body-immune", prompt: "What does the immune system help do?", choices: ["Fight germs and damaged cells", "Turn food into sunlight", "Move the planets"], answer: 0, explanation: "The immune system recognizes and responds to germs and other threats inside the body.", topic: "Body", emoji: "🛡️", level: 3 },
  { id: "body-pupils", prompt: "Why do pupils get smaller in bright light?", choices: ["To limit how much light enters the eye", "To hear better", "To cool the nose"], answer: 0, explanation: "The iris changes pupil size. In bright light, a smaller pupil protects the retina from too much light.", topic: "Body", emoji: "🔦", level: 3 },
  { id: "body-blood", prompt: "What does blood carry around the body?", choices: ["Oxygen, nutrients, and wastes", "Only water", "Thoughts and memories"], answer: 0, explanation: "Blood delivers oxygen and nutrients and carries carbon dioxide and other wastes away from cells.", topic: "Body", emoji: "🩸", level: 2 },
  { id: "body-sleep", prompt: "Why does the body need sleep?", choices: ["To restore energy and support learning and repair", "To stop the heart", "To make bones disappear"], answer: 0, explanation: "Sleep helps the brain organize learning and allows many body systems to restore and repair themselves.", topic: "Body", emoji: "😴", level: 2 },

  { id: "space-sun", prompt: "What is the Sun?", choices: ["A planet", "A star", "A moon"], answer: 1, explanation: "The Sun is a star made mostly of extremely hot hydrogen and helium.", topic: "Space", emoji: "☀️", level: 1 },
  { id: "space-moon-phases", prompt: "Why does the Moon seem to change shape?", choices: ["We see different sunlit portions", "It loses pieces", "Clouds paint it"], answer: 0, explanation: "As the Moon orbits Earth, we see different amounts of its sunlit half.", topic: "Space", emoji: "🌙", level: 2 },
  { id: "space-mars", prompt: "Which planet is called the red planet?", choices: ["Mars", "Venus", "Neptune"], answer: 0, explanation: "Iron minerals in Martian soil oxidize, giving Mars its rusty red color.", topic: "Space", emoji: "🔴", level: 1 },
  { id: "space-orbit", prompt: "What keeps planets moving around the Sun?", choices: ["Gravity", "Wind", "Magnets in space"], answer: 0, explanation: "The Sun’s gravity bends each planet’s forward motion into an orbit.", topic: "Space", emoji: "🪐", level: 2 },
  { id: "space-float", prompt: "Why do astronauts float in orbit?", choices: ["They are continuously falling around Earth", "Space has magic air", "Their suits lift them"], answer: 0, explanation: "Astronauts and their spacecraft fall together around Earth, creating microgravity.", topic: "Space", emoji: "🧑‍🚀", level: 3 },
  { id: "space-day-year", prompt: "What makes one year on Earth?", choices: ["Earth completing one orbit around the Sun", "The Moon circling Earth once", "Earth spinning once"], answer: 0, explanation: "One Earth year is the time Earth takes to travel once around the Sun, about 365 days.", topic: "Space", emoji: "📅", level: 2 },
  { id: "space-craters", prompt: "Why does the Moon have so many craters?", choices: ["Objects have hit its surface and little weather erases the marks", "The Moon grows holes at night", "Astronauts dug them all"], answer: 0, explanation: "Impacts made many craters. With almost no atmosphere, rain, or flowing water, the marks remain for a very long time.", topic: "Space", emoji: "🌑", level: 3 },
  { id: "space-comet-tail", prompt: "Why can a comet grow a bright tail near the Sun?", choices: ["Sunlight heats its ice and releases gas and dust", "It turns on a flashlight", "The planets pull paint from it"], answer: 0, explanation: "Heat from the Sun makes frozen material release gas and dust, which sunlight and solar wind push into a tail.", topic: "Space", emoji: "☄️", level: 3 },
  { id: "space-stars-twinkle", prompt: "Why do stars seem to twinkle from Earth?", choices: ["Their light bends through moving air", "Stars blink on purpose", "The Moon covers them quickly"], answer: 0, explanation: "Turbulent layers of Earth’s atmosphere bend starlight slightly differently from moment to moment.", topic: "Space", emoji: "✨", level: 3 },
  { id: "space-satellites", prompt: "What is an artificial satellite?", choices: ["A human-made object placed in orbit", "A star that fell to Earth", "A cloud shaped like a machine"], answer: 0, explanation: "Artificial satellites are machines launched into orbit for communication, weather, navigation, science, and more.", topic: "Space", emoji: "🛰️", level: 2 },
  { id: "space-gas-giant", prompt: "Which planet is the largest in our solar system?", choices: ["Jupiter", "Mercury", "Earth"], answer: 0, explanation: "Jupiter is the largest planet in our solar system and is mostly made of hydrogen and helium.", topic: "Space", emoji: "🟠", level: 1 },
  { id: "space-light-time", prompt: "Why do we see the Sun as it was about eight minutes ago?", choices: ["Light takes time to travel from the Sun to Earth", "The Sun is eight minutes behind a clock", "Earth stores old sunlight"], answer: 0, explanation: "Light moves extremely fast, but the Sun is so far away that its light still takes about eight minutes to reach Earth.", topic: "Space", emoji: "🔭", level: 3 },

  { id: "tech-loading", prompt: "Why do computers need time to load?", choices: ["They gather and process instructions", "They get tired", "They wait for permission from the Moon"], answer: 0, explanation: "A computer must find, process, and arrange information before showing the next screen.", topic: "Technology", emoji: "💻", level: 1 },
  { id: "tech-battery", prompt: "What does a battery store?", choices: ["Chemical energy", "Tiny robots", "Cold air"], answer: 0, explanation: "A battery stores chemical energy that can be changed into electrical energy.", topic: "Technology", emoji: "🔋", level: 1 },
  { id: "tech-robot", prompt: "What is a robot?", choices: ["A machine that follows instructions", "A metal animal", "A talking battery"], answer: 0, explanation: "Robots are machines designed to sense, compute, and perform actions.", topic: "Technology", emoji: "🤖", level: 1 },
  { id: "tech-internet", prompt: "What carries information through the internet?", choices: ["Data signals", "Paper airplanes", "Ocean waves only"], answer: 0, explanation: "Information is encoded into signals that travel through cables, fiber optics, and radio waves.", topic: "Technology", emoji: "🌐", level: 2 },
  { id: "tech-bulb", prompt: "Why does a light bulb glow?", choices: ["Electrical energy becomes light and heat", "It stores sunlight", "Glass creates fire"], answer: 0, explanation: "A bulb converts electrical energy into light, with some energy also becoming heat.", topic: "Technology", emoji: "💡", level: 2 },
  { id: "tech-code", prompt: "What is computer code?", choices: ["Instructions written for a computer", "A secret battery", "A type of metal"], answer: 0, explanation: "Code is a set of instructions and rules that tells a computer what operations to perform.", topic: "Technology", emoji: "⌨️", level: 1 },
  { id: "tech-sensor", prompt: "What does a sensor do?", choices: ["Detects information about the world", "Creates gravity", "Stores every sound forever"], answer: 0, explanation: "Sensors measure things such as light, motion, temperature, sound, or pressure and turn them into usable signals.", topic: "Technology", emoji: "📡", level: 2 },
  { id: "tech-wifi", prompt: "How can Wi-Fi send information without a wire?", choices: ["It uses radio waves", "It throws tiny paper notes", "It bends gravity"], answer: 0, explanation: "Wi-Fi encodes information into radio waves that travel between devices and a wireless router.", topic: "Technology", emoji: "📶", level: 2 },
  { id: "tech-memory", prompt: "What does computer memory help a device do?", choices: ["Hold information for current or future use", "Grow stronger muscles", "Create oxygen"], answer: 0, explanation: "Computer memory stores data and instructions so a processor can use them now or retrieve them later.", topic: "Technology", emoji: "🧠", level: 2 },
  { id: "tech-encryption", prompt: "What does encryption do?", choices: ["Scrambles information so only authorized readers can understand it", "Makes a screen brighter", "Turns sound into heat"], answer: 0, explanation: "Encryption uses mathematical rules to transform readable data into protected data that requires a key to decode.", topic: "Technology", emoji: "🔐", level: 3 },
  { id: "tech-ai", prompt: "What is one thing an AI model can do?", choices: ["Find patterns in data and produce a response", "Know every fact with perfect certainty", "Think without any information"], answer: 0, explanation: "AI models learn statistical patterns from data and use those patterns to classify, predict, or generate outputs.", topic: "Technology", emoji: "🧩", level: 3 },
  { id: "tech-pixels", prompt: "What are pixels?", choices: ["Tiny picture elements that form a digital image", "Small batteries inside a screen", "Invisible keyboard buttons"], answer: 0, explanation: "A digital screen or image is built from many tiny picture elements called pixels, each showing a color and brightness.", topic: "Technology", emoji: "🖼️", level: 2 },
];

export type WordCategory = "Animals" | "Space" | "Science" | "Everyday";

export type WordCard = {
  id: string;
  word: string;
  hint: string;
  category: WordCategory;
};

export const WORD_CARDS: WordCard[] = [
  { id: "animal-bear", word: "BEAR", hint: "A large animal that can hibernate.", category: "Animals" },
  { id: "animal-frog", word: "FROG", hint: "An animal that hops and says ribbit.", category: "Animals" },
  { id: "animal-tiger", word: "TIGER", hint: "A striped big cat.", category: "Animals" },
  { id: "animal-whale", word: "WHALE", hint: "A giant mammal that lives in the ocean.", category: "Animals" },
  { id: "animal-shark", word: "SHARK", hint: "A fish with rows of sharp teeth.", category: "Animals" },
  { id: "animal-rabbit", word: "RABBIT", hint: "An animal with long ears that hops.", category: "Animals" },
  { id: "animal-monkey", word: "MONKEY", hint: "A clever primate that can climb trees.", category: "Animals" },
  { id: "animal-turtle", word: "TURTLE", hint: "An animal protected by a shell.", category: "Animals" },
  { id: "animal-lizard", word: "LIZARD", hint: "A scaly animal with four legs and a long tail.", category: "Animals" },
  { id: "animal-dolphin", word: "DOLPHIN", hint: "A smart ocean mammal that uses clicks and whistles.", category: "Animals" },
  { id: "animal-penguin", word: "PENGUIN", hint: "A bird that waddles and swims.", category: "Animals" },
  { id: "animal-elephant", word: "ELEPHANT", hint: "A huge animal with a trunk.", category: "Animals" },
  { id: "animal-butterfly", word: "BUTTERFLY", hint: "An insect with colorful wings.", category: "Animals" },
  { id: "animal-crocodile", word: "CROCODILE", hint: "A large reptile with powerful jaws.", category: "Animals" },
  { id: "animal-chameleon", word: "CHAMELEON", hint: "A lizard known for changing its colors.", category: "Animals" },

  { id: "space-moon", word: "MOON", hint: "It shines in the night sky by reflecting sunlight.", category: "Space" },
  { id: "space-mars", word: "MARS", hint: "The red planet.", category: "Space" },
  { id: "space-comet", word: "COMET", hint: "An icy object that can grow a glowing tail.", category: "Space" },
  { id: "space-orbit", word: "ORBIT", hint: "The curved path of one object around another.", category: "Space" },
  { id: "space-star", word: "STAR", hint: "A giant glowing ball of hot gas.", category: "Space" },
  { id: "space-planet", word: "PLANET", hint: "A world that travels around a star.", category: "Space" },
  { id: "space-rocket", word: "ROCKET", hint: "It blasts into space.", category: "Space" },
  { id: "space-saturn", word: "SATURN", hint: "A planet famous for its rings.", category: "Space" },
  { id: "space-crater", word: "CRATER", hint: "A bowl-shaped hole made by an impact.", category: "Space" },
  { id: "space-galaxy", word: "GALAXY", hint: "A huge collection of stars, gas, and dust.", category: "Space" },
  { id: "space-astronaut", word: "ASTRONAUT", hint: "A person trained to travel in space.", category: "Space" },
  { id: "space-telescope", word: "TELESCOPE", hint: "A tool that makes distant objects easier to see.", category: "Space" },
  { id: "space-meteorite", word: "METEORITE", hint: "A space rock that reaches the ground.", category: "Space" },
  { id: "space-universe", word: "UNIVERSE", hint: "Everything in space, including all matter and energy.", category: "Space" },
  { id: "space-satellite", word: "SATELLITE", hint: "An object that travels around a planet or other body.", category: "Space" },

  { id: "science-atom", word: "ATOM", hint: "A tiny building block of matter.", category: "Science" },
  { id: "science-light", word: "LIGHT", hint: "It helps your eyes see.", category: "Science" },
  { id: "science-cell", word: "CELL", hint: "The smallest basic unit of a living thing.", category: "Science" },
  { id: "science-force", word: "FORCE", hint: "A push or a pull.", category: "Science" },
  { id: "science-brain", word: "BRAIN", hint: "The organ that helps you think and control your body.", category: "Science" },
  { id: "science-energy", word: "ENERGY", hint: "It makes things move or change.", category: "Science" },
  { id: "science-magnet", word: "MAGNET", hint: "An object that can pull certain metals.", category: "Science" },
  { id: "science-oxygen", word: "OXYGEN", hint: "A gas your body needs from the air.", category: "Science" },
  { id: "science-crystal", word: "CRYSTAL", hint: "A solid whose particles form an orderly pattern.", category: "Science" },
  { id: "science-gravity", word: "GRAVITY", hint: "It pulls objects toward Earth.", category: "Science" },
  { id: "science-thunder", word: "THUNDER", hint: "The sound that follows lightning.", category: "Science" },
  { id: "science-volcano", word: "VOLCANO", hint: "A mountain that can erupt.", category: "Science" },
  { id: "science-electric", word: "ELECTRIC", hint: "Describes energy made by moving charges.", category: "Science" },
  { id: "science-molecule", word: "MOLECULE", hint: "Two or more atoms joined together.", category: "Science" },
  { id: "science-temperature", word: "TEMPERATURE", hint: "A measure of how hot or cold something is.", category: "Science" },

  { id: "everyday-chair", word: "CHAIR", hint: "You sit on it.", category: "Everyday" },
  { id: "everyday-pizza", word: "PIZZA", hint: "A cheesy food often cut into slices.", category: "Everyday" },
  { id: "everyday-clock", word: "CLOCK", hint: "It shows the time.", category: "Everyday" },
  { id: "everyday-shirt", word: "SHIRT", hint: "Clothing worn on the upper body.", category: "Everyday" },
  { id: "everyday-house", word: "HOUSE", hint: "A building where people live.", category: "Everyday" },
  { id: "everyday-school", word: "SCHOOL", hint: "A place where students learn.", category: "Everyday" },
  { id: "everyday-pencil", word: "PENCIL", hint: "A tool used for writing and drawing.", category: "Everyday" },
  { id: "everyday-window", word: "WINDOW", hint: "A glass opening that lets you see outside.", category: "Everyday" },
  { id: "everyday-blanket", word: "BLANKET", hint: "A warm covering used on a bed.", category: "Everyday" },
  { id: "everyday-kitchen", word: "KITCHEN", hint: "The room where food is prepared.", category: "Everyday" },
  { id: "everyday-computer", word: "COMPUTER", hint: "A machine that follows digital instructions.", category: "Everyday" },
  { id: "everyday-backpack", word: "BACKPACK", hint: "A bag carried on your back.", category: "Everyday" },
  { id: "everyday-breakfast", word: "BREAKFAST", hint: "The first meal of the day.", category: "Everyday" },
  { id: "everyday-playground", word: "PLAYGROUND", hint: "An outdoor place with equipment for children to play.", category: "Everyday" },
  { id: "everyday-adventure", word: "ADVENTURE", hint: "An exciting experience or journey.", category: "Everyday" },
];

export function scienceByPrompt(): Record<string, ScienceQuestion> {
  return Object.fromEntries(SCIENCE_QUESTIONS.map((question) => [question.prompt, question]));
}

export function wordsByHint(): Record<string, WordCard> {
  return Object.fromEntries(WORD_CARDS.map((card) => [card.hint, card]));
}
