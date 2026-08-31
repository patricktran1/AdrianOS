import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonSignature,
  describeSignature,
  fractionSignature,
  integerSignature,
  isKnownSignature,
  sequenceSignature,
  signatureFavoursVerb,
} from "../../lib/learning/error-signatures.ts";

test("the same structural error clusters across different literal answers", () => {
  // The case that motivates the whole module: three different wrong answers,
  // one observable relationship.
  assert.equal(integerSignature(47, 7, { composed: true }), "place-value.tens-omitted");
  assert.equal(integerSignature(36, 6, { composed: true }), "place-value.tens-omitted");
  assert.equal(integerSignature(52, 2, { composed: true }), "place-value.tens-omitted");
});

test("whole-number relationships are named only when they are real", () => {
  assert.equal(integerSignature(47, 40, { composed: true }), "place-value.ones-omitted");
  assert.equal(integerSignature(47, 74), "place-value.digits-transposed");
  assert.equal(integerSignature(8, 9), "number.off-by-one");
  assert.equal(integerSignature(8, 9, { composed: true }), "count.over-by-one");
  assert.equal(integerSignature(8, 7, { composed: true }), "count.short-by-one");
  assert.equal(integerSignature(40, 400), "number.magnitude-displaced");

  // A correct answer is never an error, and unrelated numbers stay unnamed
  // rather than being forced into the nearest category.
  assert.equal(integerSignature(47, 47), null);
  assert.equal(integerSignature(47, 23), null);
  assert.equal(integerSignature(44, 44), null);
});

test("a repeated digit cannot fake a transposition", () => {
  // 44 "transposed" is still 44, so claiming a swap would be nonsense.
  assert.equal(integerSignature(44, 44), null);
  assert.equal(integerSignature(33, 33), null);
});

test("malformed numbers produce no signature rather than a guess", () => {
  assert.equal(integerSignature(Number.NaN, 5), null);
  assert.equal(integerSignature(5, Number.POSITIVE_INFINITY), null);
  assert.equal(integerSignature(4.5, 4), null);
  assert.equal(integerSignature(-4, 4), null);
});

test("fraction errors distinguish which half of the fraction moved", () => {
  const threeQuarters = { numerator: 3, denominator: 4 };
  assert.equal(fractionSignature(threeQuarters, { numerator: 4, denominator: 3 }), "fraction.inverted");
  assert.equal(fractionSignature(threeQuarters, { numerator: 3, denominator: 8 }), "fraction.denominator-changed");
  assert.equal(fractionSignature(threeQuarters, { numerator: 2, denominator: 4 }), "fraction.numerator-changed");
  // The right amount written differently is a different situation from a
  // wrong amount, and must not be reported as an error of size.
  assert.equal(
    fractionSignature({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 }),
    "fraction.equivalent-form"
  );
  assert.equal(fractionSignature(threeQuarters, threeQuarters), null);
  assert.equal(fractionSignature(threeQuarters, { numerator: 1, denominator: 0 }), null);
});

test("sequence errors name the shape of the disorder", () => {
  const order = ["a", "b", "c", "d"];
  assert.equal(sequenceSignature(order, ["a", "b", "d", "c"]), "sequence.adjacent-swap");
  assert.equal(sequenceSignature(order, ["d", "c", "b", "a"]), "sequence.reversed");
  assert.equal(sequenceSignature(order, ["d", "b", "c", "a"]), "sequence.first-last-swapped");
  assert.equal(sequenceSignature(order, ["b", "c", "d", "a"]), "sequence.cyclic-shift");
  assert.equal(sequenceSignature(order, ["a", "b", "c"]), "sequence.incomplete");
  assert.equal(sequenceSignature(order, order), null);
  // Items that are not the same set answer a different question entirely.
  assert.equal(sequenceSignature(order, ["a", "b", "c", "z"]), null);
  assert.equal(sequenceSignature([], []), null);
});

test("a reversed comparison is distinguished from choosing equals", () => {
  assert.equal(comparisonSignature(">", "<"), "comparison.reversed");
  assert.equal(comparisonSignature("<", ">"), "comparison.reversed");
  assert.equal(comparisonSignature(">", "="), null);
  assert.equal(comparisonSignature(">", ">"), null);
});

test("every signature has parent-facing wording that describes, not diagnoses", () => {
  const signatures = [
    "place-value.tens-omitted", "place-value.ones-omitted", "place-value.digits-transposed",
    "number.off-by-one", "number.magnitude-displaced", "count.short-by-one", "count.over-by-one",
    "fraction.numerator-changed", "fraction.denominator-changed", "fraction.inverted",
    "fraction.equivalent-form", "sequence.adjacent-swap", "sequence.reversed",
    "sequence.first-last-swapped", "sequence.cyclic-shift", "sequence.incomplete",
    "comparison.reversed",
  ];
  for (const signature of signatures) {
    assert.ok(isKnownSignature(signature), `${signature} should be known`);
    const phrase = describeSignature(signature);
    assert.ok(phrase && phrase.length > 0, `${signature} needs wording`);
    // Nothing may claim knowledge of the child's mind or label them.
    assert.doesNotMatch(
      phrase,
      /understand|know|deficit|weak|struggl|unable|cannot|bad at|behind/i,
      `${signature} wording makes a claim about the child`
    );
  }
});

test("unknown signatures are rejected rather than passed through", () => {
  assert.equal(isKnownSignature("child-does-not-understand-place-value"), false);
  assert.equal(isKnownSignature("made-up"), false);
  assert.equal(isKnownSignature(42), false);
  assert.equal(isKnownSignature(null), false);
  assert.equal(describeSignature("made-up"), null);
});

test("prototype key names are not signatures", () => {
  // Signatures arrive from stored evidence, which a corrupted or edited
  // profile controls. On a plain object "constructor" would both validate
  // and resolve to native function source, which would then be shown to a
  // parent as an observation about their child.
  for (const hostile of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.equal(isKnownSignature(hostile), false, `${hostile} must not validate`);
    assert.equal(describeSignature(hostile), null, `${hostile} must not describe`);
  }
});

test("signatures point at the representation that makes them concrete", () => {
  assert.equal(signatureFavoursVerb("place-value.tens-omitted"), "build");
  assert.equal(signatureFavoursVerb("count.short-by-one"), "build");
  assert.equal(signatureFavoursVerb("sequence.adjacent-swap"), "place");
  assert.equal(signatureFavoursVerb("comparison.reversed"), "place");
  assert.equal(signatureFavoursVerb("number.off-by-one"), null);
});
