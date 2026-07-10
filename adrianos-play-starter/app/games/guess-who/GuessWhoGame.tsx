"use client";

import { useMemo, useState } from "react";
import { characters, type Character } from "./characters";
import styles from "./guess-who.module.css";

type Phase = "ready" | "playing" | "finished";

function randomCharacter(): Character {
  return characters[Math.floor(Math.random() * characters.length)];
}

export default function GuessWhoGame() {
  const [secret, setSecret] = useState<Character>(() => randomCharacter());
  const [phase, setPhase] = useState<Phase>("ready");
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const [showSecret, setShowSecret] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [result, setResult] = useState<"won" | "missed" | null>(null);
  const [lastGuess, setLastGuess] = useState<Character | null>(null);

  const remaining = useMemo(
    () => characters.filter((character) => !eliminated.has(character.id)).length,
    [eliminated]
  );

  function beginGame() {
    setShowSecret(false);
    setPhase("playing");
  }

  function toggleEliminated(id: string) {
    if (phase !== "playing" || guessing) return;

    setEliminated((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function makeGuess(character: Character) {
    if (!guessing || phase !== "playing") return;

    setLastGuess(character);
    if (character.id === secret.id) {
      setResult("won");
      setPhase("finished");
      setGuessing(false);
      return;
    }

    setResult("missed");
    setGuessing(false);
    setEliminated((current) => new Set(current).add(character.id));
  }

  function newRound() {
    setSecret(randomCharacter());
    setPhase("ready");
    setEliminated(new Set());
    setShowSecret(false);
    setGuessing(false);
    setResult(null);
    setLastGuess(null);
  }

  function continueAfterMiss() {
    setResult(null);
    setLastGuess(null);
  }

  return (
    <div className={styles.game}>
      <section className={styles.statusBar}>
        <div>
          <span className={styles.statusLabel}>Remaining</span>
          <strong>{remaining}</strong>
        </div>

        <div className={styles.actions}>
          {phase === "playing" && (
            <>
              <button
                type="button"
                className={guessing ? styles.cancelButton : styles.secondaryButton}
                onClick={() => setGuessing((value) => !value)}
              >
                {guessing ? "Cancel guess" : "Make a guess"}
              </button>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setShowSecret(true)}
              >
                Show secret
              </button>
            </>
          )}

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={newRound}
          >
            New round
          </button>
        </div>
      </section>

      {guessing && phase === "playing" && (
        <div className={styles.guessBanner}>
          Tap the person you think is the secret character.
        </div>
      )}

      <section className={styles.board} aria-label="Guess Who character board">
        {characters.map((character) => {
          const isEliminated = eliminated.has(character.id);

          return (
            <button
              key={character.id}
              type="button"
              className={[
                styles.card,
                isEliminated ? styles.eliminated : "",
                guessing ? styles.guessMode : "",
              ].join(" ")}
              onClick={() =>
                guessing ? makeGuess(character) : toggleEliminated(character.id)
              }
              aria-pressed={isEliminated}
              aria-label={`${character.name}${isEliminated ? ", eliminated" : ""}`}
            >
              <div
                className={styles.portrait}
                style={{ background: character.background }}
              >
                <span aria-hidden="true">{character.emoji}</span>
              </div>

              <div className={styles.cardFooter}>
                <strong>{character.name}</strong>
                <span>{isEliminated ? "Tap to restore" : "Tap to flip"}</span>
              </div>

              {isEliminated && (
                <div className={styles.flipCover} aria-hidden="true">
                  <span>×</span>
                </div>
              )}
            </button>
          );
        })}
      </section>

      {phase === "ready" && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={beginGame}
              aria-label="Close"
            >
              ×
            </button>

            <span className={styles.eyebrow}>SECRET CHARACTER</span>
            <h1>Remember this person.</h1>
            <p>
              Let the guesser look away, then reveal the secret character.
            </p>

            <button
              type="button"
              className={styles.secretCard}
              onClick={() => setShowSecret((value) => !value)}
            >
              <div
                className={styles.secretPortrait}
                style={{
                  background: showSecret ? secret.background : "#202634",
                }}
              >
                <span aria-hidden="true">
                  {showSecret ? secret.emoji : "?"}
                </span>
              </div>
              <strong>{showSecret ? secret.name : "Tap to reveal"}</strong>
            </button>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={beginGame}
            >
              Start game
            </button>
          </div>
        </div>
      )}

      {showSecret && phase === "playing" && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setShowSecret(false)}
              aria-label="Close"
            >
              ×
            </button>

            <span className={styles.eyebrow}>YOUR SECRET</span>
            <h1>{secret.name}</h1>

            <div
              className={styles.largeSecretPortrait}
              style={{ background: secret.background }}
            >
              <span aria-hidden="true">{secret.emoji}</span>
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setShowSecret(false)}
            >
              Back to board
            </button>
          </div>
        </div>
      )}

      {result === "missed" && lastGuess && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={continueAfterMiss}
              aria-label="Close"
            >
              ×
            </button>

            <span className={styles.eyebrow}>NOT THIS ONE</span>
            <h1>{lastGuess.name} is not the secret.</h1>
            <p>That card has been flipped down. Keep asking questions.</p>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={continueAfterMiss}
            >
              Keep playing
            </button>
          </div>
        </div>
      )}

      {phase === "finished" && result === "won" && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={newRound}
              aria-label="Close"
            >
              ×
            </button>

            <span className={styles.eyebrow}>YOU GOT IT</span>
            <h1>The secret was {secret.name}.</h1>

            <div
              className={styles.largeSecretPortrait}
              style={{ background: secret.background }}
            >
              <span aria-hidden="true">{secret.emoji}</span>
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={newRound}
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
