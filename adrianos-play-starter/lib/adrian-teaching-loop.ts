export type ResponseQuality = "first-try" | "with-support" | "not-yet";

export type ResponseEvidence = {
  correct: boolean;
  wrongAttempts: number;
  usedHint: boolean;
};

export function classifyResponse(evidence: ResponseEvidence): ResponseQuality {
  if (!evidence.correct) return "not-yet";
  if (evidence.wrongAttempts === 0 && !evidence.usedHint) return "first-try";
  return "with-support";
}

export function responseQualityLabel(quality: ResponseQuality): string {
  if (quality === "first-try") return "Independent solve";
  if (quality === "with-support") return "Solved with support";
  return "Ready for review";
}

export function responsePoints(base: number, quality: ResponseQuality): number {
  if (quality === "first-try") return base;
  if (quality === "with-support") return Math.max(4, Math.round(base * 0.68));
  return 2;
}

export function nextAdaptiveDifficulty(
  current: number,
  quality: ResponseQuality,
  independentStreak: number,
  min = 1,
  max = 7
): number {
  const change = quality === "not-yet"
    ? -1
    : quality === "first-try" && independentStreak >= 2
      ? 1
      : 0;
  return Math.max(min, Math.min(max, current + change));
}

export type ArithmeticTeachingProblem = {
  left: number;
  right: number;
  operator: "+" | "−";
  answer: number;
  money: boolean;
  kind: "equation" | "missing" | "story";
  missingSide?: "left" | "right";
};

export type TeachingSupport = {
  standardCode: string;
  learningGoal: string;
  hint: string;
  explanation: string;
};

function formatNumber(value: number, money: boolean): string {
  return money ? `$${(value / 100).toFixed(2)}` : String(value);
}

export function arithmeticTeachingSupport(problem: ArithmeticTeachingProblem): TeachingSupport {
  const left = formatNumber(problem.left, problem.money);
  const right = formatNumber(problem.right, problem.money);
  const answer = formatNumber(problem.answer, problem.money);

  if (problem.money) {
    return {
      standardCode: "2.MD.C.8",
      learningGoal: "I can combine or compare money amounts and explain my strategy.",
      hint: problem.operator === "+"
        ? "Count the larger amount first, then add the smaller amount in friendly coin jumps."
        : "Count up from the smaller amount to the larger amount to find the difference.",
      explanation: problem.operator === "+"
        ? `${left} + ${right} = ${answer}. Add the cents in parts, then regroup 100 cents as one dollar when needed.`
        : `${left} − ${right} = ${answer}. The difference is the amount left after taking away ${right}.`,
    };
  }

  if (problem.kind === "story") {
    const grows = problem.operator === "+";
    return {
      standardCode: "2.OA.A.1",
      learningGoal: "I can decide what a story problem is asking and solve it with addition or subtraction.",
      hint: grows
        ? "The amount grows. Combine the starting group and the group that was added."
        : "The amount shrinks. Start with the whole group and remove what was given away.",
      explanation: grows
        ? `The story joins two groups, so use addition: ${left} + ${right} = ${answer}.`
        : `The story removes part of a group, so use subtraction: ${left} − ${right} = ${answer}.`,
    };
  }

  if (problem.kind === "missing") {
    const missing = problem.missingSide === "left" ? "first number" : "second number";
    return {
      standardCode: "2.OA.B.2",
      learningGoal: "I can use related addition and subtraction facts to find a missing number.",
      hint: `Treat the question mark as the unknown ${missing}. Use the inverse operation to work backward from the total.`,
      explanation: problem.operator === "+"
        ? `Use subtraction to undo addition. The missing number is ${answer}.`
        : `Use the related addition fact to check the subtraction. The missing number is ${answer}.`,
    };
  }

  const withinTwenty = Math.max(problem.left, problem.right, problem.answer) <= 20;
  if (withinTwenty) {
    return {
      standardCode: "2.OA.B.2",
      learningGoal: "I can add and subtract within 20 accurately and explain a strategy.",
      hint: problem.operator === "+"
        ? "Try making 10 first, then add what remains."
        : "Count up from the smaller number or break the amount you subtract into easier parts.",
      explanation: `${left} ${problem.operator} ${right} = ${answer}. Check it with the related ${problem.operator === "+" ? "subtraction" : "addition"} fact.`,
    };
  }

  return {
    standardCode: "2.NBT.B.5",
    learningGoal: "I can use tens, ones, and number relationships to add and subtract within 100.",
    hint: problem.operator === "+"
      ? "Separate each number into tens and ones. Combine the tens, then combine the ones."
      : "Subtract tens and ones in manageable chunks, or count up to find the difference.",
    explanation: `${left} ${problem.operator} ${right} = ${answer}. A place-value strategy keeps the tens and ones organized.`,
  };
}

export function scienceTopicHint(topic: "Earth" | "Body" | "Space" | "Technology"): string {
  if (topic === "Earth") return "Think about weather, rocks, water, and changes you could observe on Earth.";
  if (topic === "Body") return "Ask what job each body part performs and what the body needs to stay alive.";
  if (topic === "Space") return "Look for an explanation based on gravity, light, motion, or distance.";
  return "Think about how a system uses energy, information, inputs, and outputs.";
}
