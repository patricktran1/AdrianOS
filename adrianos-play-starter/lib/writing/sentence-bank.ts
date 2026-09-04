/**
 * Sentences written to be rebuilt, not to be read.
 *
 * The story bank looked like free content for this — 69 sentences already
 * written for children — but prose written to be read scrambles badly. Two
 * thirds of it carries "and", "or", or a comma, and those sentences have more
 * than one correct order: a child who builds "He put on red boots and a
 * yellow raincoat" has written a correct sentence and would be marked wrong.
 * After filtering them out, four usable sentences remained at two of the
 * three levels, which is not practice.
 *
 * So these are authored under one rule: exactly one order reads correctly.
 * No coordination, no commas, no leading time phrase that could equally sit
 * at the end. Each carries its own capital and its own ending mark, because
 * placing those is the conventions half of building a sentence.
 */

export type WritingLevel = "Starter" | "Growing" | "Challenge";

export type WritingSentence = {
  id: string;
  level: WritingLevel;
  /** The sentence as it should end up, punctuation included. */
  text: string;
};

export const WRITING_SENTENCES: WritingSentence[] = [
  // Starter — TK and Grade 1. Subject, verb, and one short addition.
  { id: "s-nap", level: "Starter", text: "The cat naps on my bed." },
  { id: "s-ball", level: "Starter", text: "My dog chased the red ball." },
  { id: "s-bus", level: "Starter", text: "We ride the bus to school." },
  { id: "s-soup", level: "Starter", text: "Dad made soup for lunch." },
  { id: "s-moon", level: "Starter", text: "The moon glows above the trees." },
  { id: "s-boots", level: "Starter", text: "I found my boots under the chair." },
  { id: "s-bird", level: "Starter", text: "A small bird landed on the fence." },
  { id: "s-cake", level: "Starter", text: "Grandma baked a cake for me." },
  { id: "s-rain", level: "Starter", text: "The rain tapped on our window." },
  { id: "s-book", level: "Starter", text: "She reads a book every night." },
  { id: "s-frog", level: "Starter", text: "The frog jumped into the pond." },
  { id: "s-kite", level: "Starter", text: "My kite flew above the field." },

  // Growing — Grade 2 and 3. A longer object or a second describing word.
  { id: "g-garden", level: "Growing", text: "Our class planted beans in the school garden." },
  { id: "g-letter", level: "Growing", text: "Mia wrote a long letter to her cousin." },
  { id: "g-shells", level: "Growing", text: "We collected smooth shells along the quiet beach." },
  { id: "g-bridge", level: "Growing", text: "The engineers built a bridge across the wide river." },
  { id: "g-recipe", level: "Growing", text: "My brother followed the recipe without any help." },
  { id: "g-museum", level: "Growing", text: "Our teacher took us to the science museum." },
  { id: "g-puppy", level: "Growing", text: "The puppy hid behind the tall green fence." },
  { id: "g-story", level: "Growing", text: "He told a funny story about his grandfather." },
  { id: "g-snow", level: "Growing", text: "Thick snow covered the roof of our house." },
  { id: "g-map", level: "Growing", text: "She drew a careful map of her neighbourhood." },
  { id: "g-band", level: "Growing", text: "The school band practised inside the empty hall." },
  { id: "g-lantern", level: "Growing", text: "We hung a paper lantern above the front door." },

  // Challenge — Grade 4 and 5. Precise verbs and a fuller ending phrase.
  { id: "c-rover", level: "Challenge", text: "The rover measured minerals beneath the dusty red surface." },
  { id: "c-octopus", level: "Challenge", text: "An octopus arranged smooth stones around its narrow rocky den." },
  { id: "c-signal", level: "Challenge", text: "The engineers waited patiently for the delayed radio signal." },
  { id: "c-river", level: "Challenge", text: "The winter flood carried heavy sediment into the old river channel." },
  { id: "c-detector", level: "Challenge", text: "Mika recorded every faint bat call near the old fig tree." },
  { id: "c-fridge", level: "Challenge", text: "The class labelled each garden vegetable with a clear printed date." },
  { id: "c-shadow", level: "Challenge", text: "His long shadow stretched across the frosty meadow at sunrise." },
  { id: "c-orbit", level: "Challenge", text: "The quiet station falls continuously around our spinning blue planet." },
  { id: "c-canyon", level: "Challenge", text: "Her cheerful voice bounced off the distant rocky canyon wall." },
  { id: "c-ice", level: "Challenge", text: "The cold metal tray pulled heat from the melting ice cube." },
  { id: "c-library", level: "Challenge", text: "The librarian stamped a neat return date inside the front cover." },
  { id: "c-seed", level: "Challenge", text: "A pale green stem curled above the damp brown soil." },
];
