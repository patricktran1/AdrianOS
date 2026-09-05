/**
 * Paragraphs written to be put back in order.
 *
 * A scrambled paragraph is only a fair task if exactly one ordering reads
 * correctly. That is much harder to guarantee than it sounds: "reveal the
 * outcome first, then explain how" is a structure children are taught, and
 * any paragraph that tolerates it has two right answers.
 *
 * So these were not hand-picked. Sixty were drafted, then every one was
 * attacked from three angles — unresolved pronouns and definite reference,
 * time and cause words, and an ordinary reader's judgement — with a
 * conservative adjudicator ruling on any claimed second ordering and a fresh
 * reviewer re-attacking the survivors. Eight were thrown out, including one
 * whose alternative was exactly that reveal-first recount. These 52 are what
 * nobody could reorder.
 *
 * Deliberately not reused from the story bank: a child who met a passage in
 * Spyglass Bay would be reordering text they had already read in order, which
 * measures memory rather than organisation.
 */

export type WritingParagraphLevel = "Starter" | "Growing" | "Challenge";

export type WritingParagraph = {
  id: string;
  level: WritingParagraphLevel;
  title: string;
  /** In their one correct order. */
  sentences: string[];
};

export const WRITING_PARAGRAPHS: WritingParagraph[] = [
  // Starter — TK and Grade 1. Three sentences, one link each.
  {
    id: "s-balloon-and-paper-bits",
    level: "Starter",
    title: "The Sticky Balloon",
    sentences: [
      "I rubbed a balloon on my woolly hat.",
      "Then I held it over tiny paper bits.",
      "So the bits jumped up onto the balloon.",
    ],
  },
  {
    id: "s-black-dot-colors",
    level: "Starter",
    title: "The Dot That Split",
    sentences: [
      "Our teacher drew a black dot on paper.",
      "Then she dipped the paper into some water.",
      "So the black dot spread into many colors.",
    ],
  },
  {
    id: "s-bottle-return-ticket",
    level: "Starter",
    title: "Bottles to the Machine",
    sentences: [
      "Mila carried a bag of empty bottles.",
      "She fed them into a loud machine.",
      "Finally the machine gave her a ticket.",
    ],
  },
  {
    id: "s-breeze-wet-paintings",
    level: "Starter",
    title: "The Cool Breeze",
    sentences: [
      "Hot air made our classroom feel sticky.",
      "Then a cool breeze slipped through the window.",
      "That breeze blew our paintings off the wall.",
    ],
  },
  {
    id: "s-cloud-over-recess",
    level: "Starter",
    title: "A Cloud at Recess",
    sentences: [
      "A dark cloud slid over the playground.",
      "Then it dropped cold raindrops on our heads.",
      "Those drops chased us back into class.",
    ],
  },
  {
    id: "s-cup-string-phone",
    level: "Starter",
    title: "Cup Phone",
    sentences: [
      "Ben poked holes in two paper cups.",
      "Then he pulled string through both holes.",
      "Now his sister hears him from downstairs.",
    ],
  },
  {
    id: "s-dusty-mat-shake",
    level: "Starter",
    title: "The Dusty Mat",
    sentences: [
      "Ivy found a dusty mat by the door.",
      "She shook it hard over the grass.",
      "Now the mat felt soft and clean.",
    ],
  },
  {
    id: "s-frost-slide-morning",
    level: "Starter",
    title: "Frost on the Slide",
    sentences: [
      "Cold frost covered our slide this morning.",
      "Then the sun climbed over our fence.",
      "Its warm light melted the frost away.",
    ],
  },
  {
    id: "s-goat-kid-stump",
    level: "Starter",
    title: "Goat on the Stump",
    sentences: [
      "A baby goat wanted to climb a stump.",
      "First she jumped and slid right back down.",
      "After two more tries, she stood on top.",
    ],
  },
  {
    id: "s-last-sock-pairs",
    level: "Starter",
    title: "The Last Sock",
    sentences: [
      "Dad dumped warm socks onto Ben's bed.",
      "Then Ben matched them into neat pairs.",
      "So the last sock had no pair.",
    ],
  },
  {
    id: "s-paperclips-in-rice",
    level: "Starter",
    title: "Clips in the Rice",
    sentences: [
      "Dad hid paperclips in a bowl of rice.",
      "Then I dragged a magnet through the rice.",
      "So every clip came out on the magnet.",
    ],
  },
  {
    id: "s-pepper-runs-away",
    level: "Starter",
    title: "Pepper Runs Away",
    sentences: [
      "I shook pepper onto a bowl of water.",
      "Then I dipped one soapy finger in it.",
      "So the pepper raced away from my finger.",
    ],
  },
  {
    id: "s-pill-bug-shadow",
    level: "Starter",
    title: "The Rolling Pill Bug",
    sentences: [
      "A pill bug crawled onto a warm step.",
      "Then a big shadow moved over the step.",
      "So the bug rolled into a tiny ball.",
    ],
  },
  {
    id: "s-pip-water-bowl",
    level: "Starter",
    title: "Pip's Water Bowl",
    sentences: [
      "Nora saw Pip's water bowl was empty.",
      "So she filled it at the tap.",
      "Then Pip drank the cold water happily.",
    ],
  },
  {
    id: "s-potato-star-stamp",
    level: "Starter",
    title: "The Potato Stamp",
    sentences: [
      "Dad cut one potato in half.",
      "Then Nina carved a star into it.",
      "Now that star prints on every card.",
    ],
  },
  {
    id: "s-spoon-wind-chime",
    level: "Starter",
    title: "Spoon Chime",
    sentences: [
      "Grandpa gave Sam six old metal spoons.",
      "Then Sam tied them onto a stick.",
      "Now that stick clinks in every breeze.",
    ],
  },
  {
    id: "s-thumb-dent-pot",
    level: "Starter",
    title: "The Clay Bowl",
    sentences: [
      "Ivy rolled soft clay into a ball.",
      "Then she pressed her thumb deep into it.",
      "That dent now holds all her rings.",
    ],
  },

  // Growing — Grade 2 and 3. Four sentences; some positions rest on
  // reference rather than on a connective.
  {
    id: "g-balloon-grabs-paper-pile",
    level: "Growing",
    title: "The Balloon and the Paper Pile",
    sentences: [
      "Sam ripped an old note into a pile of bits.",
      "Then he rubbed a balloon hard on his woolly hat.",
      "That rubbing gave the balloon a strong hidden pull.",
      "Because of that pull, the pile jumped onto the balloon.",
    ],
  },
  {
    id: "g-bay-fog-bell",
    level: "Growing",
    title: "Fog Over the Bay",
    sentences: [
      "Thick fog sat over the bay when the fishing boats left.",
      "Because of that fog, the captain rang her bell often.",
      "At lunchtime a fresh wind pushed the fog out to sea.",
      "Then the little island appeared again, and the bell stayed quiet.",
    ],
  },
  {
    id: "g-blue-bench-stripes",
    level: "Growing",
    title: "The Blue Bench",
    sentences: [
      "The park keeper painted the old bench blue that sunny morning.",
      "He left the paint to dry and went home for lunch.",
      "While he was gone, a sudden storm dropped fat raindrops.",
      "Because of that rain, the bench now has drippy blue stripes.",
    ],
  },
  {
    id: "g-bottle-machine-ticket",
    level: "Growing",
    title: "Bottles for Coins",
    sentences: [
      "Sam loaded the empty bottles into a big cloth bag.",
      "He dragged the bag to the recycling machine at the shop.",
      "The machine ate each bottle and printed a small paper ticket.",
      "Sam swapped that ticket for coins and bought a red apple.",
    ],
  },
  {
    id: "g-dew-web-gate",
    level: "Growing",
    title: "The Web by the Gate",
    sentences: [
      "Cold dew hung on a spider's web beside our garden gate.",
      "The morning sun dried those tiny drops before we ate breakfast.",
      "Later a strong wind tore the empty web into loose threads.",
      "So the spider spent all evening spinning a brand new one.",
    ],
  },
  {
    id: "g-egg-floats-in-salt",
    level: "Growing",
    title: "The Egg That Floated",
    sentences: [
      "Nina lowered a fresh egg into a jar of water.",
      "It sank straight to the bottom and stayed there.",
      "So she stirred in spoonful after spoonful of salt.",
      "Slowly the heavy salt water pushed the egg back up.",
    ],
  },
  {
    id: "g-glued-school-shoe",
    level: "Growing",
    title: "The Mended Shoe",
    sentences: [
      "Leo's school shoe had a hole under the toe.",
      "So Mum walked with him to the little repair shop.",
      "A worker there glued the sole and left it drying overnight.",
      "Next morning the shoe was strong again, and Leo wore it.",
    ],
  },
  {
    id: "g-hermit-crab-shell-swap",
    level: "Growing",
    title: "The Shell Line",
    sentences: [
      "A small hermit crab found a big empty shell today.",
      "The shell was too large, so she waited beside it.",
      "While she waited, other crabs lined up behind her by size.",
      "Then everyone swapped shells at once and got a better home.",
    ],
  },
  {
    id: "g-odd-sock-hunt",
    level: "Growing",
    title: "The Missing Sock",
    sentences: [
      "Dad tipped a basket of clean socks onto the big bed.",
      "Mia sorted them into pairs, but one blue sock was alone.",
      "She shook a shirt sleeve, and the missing sock tumbled out.",
      "At last every sock had a partner, so Mia folded them.",
    ],
  },
  {
    id: "g-pepper-runs-from-soap",
    level: "Growing",
    title: "The Pepper That Ran Away",
    sentences: [
      "Mia filled a wide bowl with cold tap water.",
      "Then she shook black pepper across the water.",
      "Next she poked the floating pepper with a soapy finger.",
      "Because of the soap, the pepper zoomed to the edges.",
    ],
  },
  {
    id: "g-popcorn-tin-drum",
    level: "Growing",
    title: "The Popcorn Tin Drum",
    sentences: [
      "An empty popcorn tin sat on a shelf in our shed.",
      "First I found a balloon big enough to cover the tin.",
      "Then I stretched the balloon tight and taped it down.",
      "Now the taped drum booms whenever I thump it.",
    ],
  },
  {
    id: "g-pressed-leaf-bookmark",
    level: "Growing",
    title: "The Pressed Leaf Bookmark",
    sentences: [
      "A red maple leaf blew onto our front steps.",
      "I slid the leaf between two pages of a heavy book.",
      "A week later the leaf came out flat and dry.",
      "Finally I glued it to thick paper and cut a bookmark.",
    ],
  },
  {
    id: "g-raisins-dance-in-fizz",
    level: "Growing",
    title: "Raisins That Danced",
    sentences: [
      "Omar poured clear fizzy water into a tall glass.",
      "Then he dropped six raisins into the bubbly drink.",
      "The raisins sank, but tiny bubbles stuck to them.",
      "Those bubbles carried them up, popped, and dropped them again.",
    ],
  },
  {
    id: "g-shirt-strip-jump-rope",
    level: "Growing",
    title: "A Rope From an Old Shirt",
    sentences: [
      "My old red shirt had a rip in the sleeve.",
      "So Dad helped me cut the shirt into long strips.",
      "Then I braided the strips into one thick rope.",
      "Now my friends turn that rope while I jump over.",
    ],
  },
  {
    id: "g-squirrel-fake-hole",
    level: "Growing",
    title: "The Fake Hole",
    sentences: [
      "A squirrel picked up a fat acorn under the oak tree.",
      "Then she noticed a magpie watching her from the wall.",
      "Because of that, she dug a fake hole and patted it.",
      "She hid the real acorn far away when the magpie left.",
    ],
  },
  {
    id: "g-swallow-mud-cup",
    level: "Growing",
    title: "The Mud Cup",
    sentences: [
      "A swallow found a wet puddle beside the farm gate.",
      "She rolled the mud into a tiny ball with her beak.",
      "Next she stuck the ball high under the barn roof.",
      "After many trips, the little mud cup became a nest.",
    ],
  },
  {
    id: "g-tube-marble-run",
    level: "Growing",
    title: "The Tube Marble Run",
    sentences: [
      "I saved six cardboard tubes from the recycling bin.",
      "First I taped the tubes onto a big flat board.",
      "Then I tipped the board so the tubes pointed down.",
      "Finally a marble raced through them into my little cup.",
    ],
  },
  {
    id: "g-wasp-paper-fence",
    level: "Growing",
    title: "The Paper Wasp",
    sentences: [
      "A wasp landed on the old wooden fence one morning.",
      "She scraped the dry wood with her strong little jaws.",
      "The scraps turned into soft paper when she chewed them.",
      "Later she carried that paper home and built her nest.",
    ],
  },

  // Challenge — Grade 4 and 5. Five sentences, with chains that cross more
  // than one step.
  {
    id: "c-bent-spoon-chime",
    level: "Challenge",
    title: "Grandpa's Spoon Chime",
    sentences: [
      "Grandpa keeps a box of bent spoons that nobody wants to use.",
      "He let me flatten five of them with a hammer on his workbench.",
      "Next we drilled a small hole through the handle of each flat spoon.",
      "We threaded string through those holes and hung the spoons from a wooden ring.",
      "Because they hang so close together, the smallest breeze makes them sing.",
    ],
  },
  {
    id: "c-black-ink-bands",
    level: "Challenge",
    title: "Hidden Colors in Ink",
    sentences: [
      "Leo wondered whether black marker ink is really made of only one color.",
      "He drew a fat dot near the bottom of a coffee filter strip.",
      "Then he dipped the strip's edge in water, keeping the dot just above it.",
      "As the water crept upward, the dot split into blue, purple, and pink bands.",
      "Those bands proved that black ink hides several colors mixed quietly together.",
    ],
  },
  {
    id: "c-bottle-return-machine",
    level: "Challenge",
    title: "The Bag of Bottles",
    sentences: [
      "A tall bag of empty bottles had been leaning by our front door for weeks.",
      "On Saturday I dragged the bag down the street to the little corner shop.",
      "Inside, a noisy machine swallowed each bottle and printed a paper ticket for me.",
      "I handed that ticket to the shopkeeper, who counted out four shiny coins.",
      "Those coins now sit in my jar, saved for the kite I want.",
    ],
  },
  {
    id: "c-coin-drop-dome",
    level: "Challenge",
    title: "Drops on a Coin",
    sentences: [
      "Omar guessed that only three drops of water would fit on a coin.",
      "He used a dropper and counted every drop until the water spilled over.",
      "That wobbly dome held twenty-eight drops, nine times more than he expected.",
      "Next he stirred a drop of soap into the water and tried again.",
      "This time the dome collapsed early, so soap must weaken water's stretchy skin.",
    ],
  },
  {
    id: "c-crow-crosswalk-walnut",
    level: "Challenge",
    title: "The Crow and the Walnut",
    sentences: [
      "A clever crow in the city found a walnut she could not crack.",
      "She dropped the nut onto the road and waited by the traffic light.",
      "When the cars rolled past, their heavy tires split the shell wide open.",
      "Because the traffic never stopped, the crow could not reach her broken walnut.",
      "Finally the signal turned red, and she hopped out to collect her meal.",
    ],
  },
  {
    id: "c-floating-needle-compass",
    level: "Challenge",
    title: "The Floating Needle",
    sentences: [
      "Priya read that a magnet can turn an ordinary sewing needle into a compass.",
      "She stroked the needle forty times with one end of a fridge magnet.",
      "Next she rested the magnetized needle on a leaf in a bowl of water.",
      "The leaf spun slowly and stopped with the needle aimed at the north wall.",
      "Because of that, Priya knew her plain needle had become a working compass.",
    ],
  },
  {
    id: "c-hermit-crab-shell-swap",
    level: "Challenge",
    title: "The Crab Shell Swap",
    sentences: [
      "A hermit crab crawled along the beach in a shell that pinched badly.",
      "Then he spotted an empty snail shell, but it was far too roomy.",
      "So he waited beside it while other crabs gathered in a wobbly line.",
      "The crabs sorted themselves by size, from largest down to the tiniest.",
      "One by one they traded shells up the line, until everyone fit comfortably.",
    ],
  },
  {
    id: "c-orange-windsock-airfield",
    level: "Challenge",
    title: "The Orange Windsock",
    sentences: [
      "An orange windsock hung limp in the fog above the little grass airfield.",
      "By ten o'clock a warm wind filled the sock and stretched it straight out.",
      "That steady breeze meant the fog had lifted, so two pilots took off.",
      "An hour later the sock swung around, warning them that a storm was coming.",
      "By sunset the storm had passed, and the sock drooped just like at dawn.",
    ],
  },
  {
    id: "c-potato-star-stamp",
    level: "Challenge",
    title: "The Potato Star Stamp",
    sentences: [
      "My cousin's birthday was coming, and our wrapping paper had run out.",
      "So I cut a large potato in half and drew a star on it.",
      "Then I carved away everything around the star with a blunt knife.",
      "I pressed that raised star into red paint and stamped it across newspaper.",
      "By morning the paint was dry, and the wrapping looked better than shop paper.",
    ],
  },
  {
    id: "c-rusty-wool-jars",
    level: "Challenge",
    title: "The Rusty Pad Test",
    sentences: [
      "Mia wanted to learn what makes shiny steel wool turn orange and crumbly.",
      "She placed a pad in each of two jars and added water to one.",
      "Then she screwed both lids on tightly and waited for three whole days.",
      "The soaked pad had turned orange, but the dry one still looked silver.",
      "Because of that, Mia decided that steel needs water before it can rust.",
    ],
  },
  {
    id: "c-scout-bee-lavender-dance",
    level: "Challenge",
    title: "The Bee Who Danced Directions",
    sentences: [
      "A scout bee left the hive early to hunt for fresh flowers.",
      "Far past the orchard, she discovered a wide field of purple lavender.",
      "She flew home and danced a wobbling figure eight on the honeycomb.",
      "The other bees read her steps, then flew straight toward the lavender.",
      "By evening the whole hive smelled sweetly of that faraway purple field.",
    ],
  },
  {
    id: "c-slush-crust-hill",
    level: "Challenge",
    title: "The Sledding Hill",
    sentences: [
      "Fresh snow covered the steep hill behind the school before anyone woke up.",
      "At first the powder was so soft that sleds sank instead of sliding.",
      "By afternoon the sun had turned the top layer into slush and puddles.",
      "When the temperature dropped at dusk, that slush froze into a smooth crust.",
      "By dark the sleds raced down that icy crust faster than ever before.",
    ],
  },
  {
    id: "c-sock-mountain-match",
    level: "Challenge",
    title: "The Sock Mountain",
    sentences: [
      "Our laundry basket held a mountain of clean socks with no pairs at all.",
      "I tipped the whole mountain onto the rug and spread the socks out flat.",
      "Then I hunted for stripes first, because they were the easiest ones to spot.",
      "After the stripes, only three grey socks were left, and one had no partner.",
      "That lonely sock waits on the shelf until its twin comes out of the wash.",
    ],
  },
  {
    id: "c-toaster-crumb-tray",
    level: "Challenge",
    title: "The Burnt Smell",
    sentences: [
      "Every morning our toaster puffed out a burnt smell that filled the kitchen.",
      "Mum said the crumbs underneath were burning, so she showed me the hidden tray.",
      "I slid the tray out slowly and carried it straight to the bin.",
      "A little black hill of crumbs tipped in, and the tray went back empty.",
      "Our toast smells like warm bread again, and nobody opens the window at breakfast.",
    ],
  },
  {
    id: "c-wet-paint-bench",
    level: "Challenge",
    title: "The Painted Bench",
    sentences: [
      "A park worker painted the old bench green early on Saturday morning.",
      "The damp air kept the paint sticky, so she left a warning sign.",
      "By noon the sun had dried it, and she carried the sign away.",
      "Right away two hikers sat down and ate lunch in the warm sunshine.",
      "Then a sudden shower chased them off, leaving the bench wet and empty.",
    ],
  },
  {
    id: "c-wobbly-kitchen-stool",
    level: "Challenge",
    title: "The Wobbly Stool",
    sentences: [
      "Our kitchen stool wobbled whenever anyone leaned back on it.",
      "Dad tipped it over and discovered that one wooden leg was shorter.",
      "So he cut a wedge of wood and glued it under the short leg.",
      "After the glue dried overnight, he sanded the wedge until it felt smooth.",
      "Now nobody notices the repair, because the stool finally sits perfectly still.",
    ],
  },
  {
    id: "c-wood-frog-frozen-winter",
    level: "Challenge",
    title: "The Frog That Froze",
    sentences: [
      "A wood frog dug under wet leaves as the first frost arrived.",
      "During the night, ice crept through his body and stopped his heart.",
      "He stayed frozen and still beneath the leaves for the entire winter.",
      "When spring sunshine warmed the ground, his heart slowly began beating again.",
      "After that, the thawed frog hopped away and called for a mate.",
    ],
  },
];
