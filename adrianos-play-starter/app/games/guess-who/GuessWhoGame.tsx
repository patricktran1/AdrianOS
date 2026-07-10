"use client";

import { useMemo, useState } from "react";
import {
  characters,
  getCharacter,
  questions,
  randomCharacter,
  type Character,
  type Question,
} from "./characters";
import styles from "./guess-who.module.css";

type Mode = "computer" | "two-player";
type Screen = "home" | "reveal" | "play" | "result";
type Player = 1 | 2;
type Result = {
  title: string;
  message: string;
  winner?: string;
};

type RevealStep =
  | "computer-human"
  | "player-one"
  | "pass-to-two"
  | "player-two"
  | "pass-to-one"
  | "turn-pass";

function otherPlayer(player: Player): Player {
  return player === 1 ? 2 : 1;
}

function chooseComputerQuestion(
  candidateIds: string[],
  askedQuestionIds: string[]
): Question | null {
  const candidateCharacters = characters.filter((character) =>
    candidateIds.includes(character.id)
  );

  const available = questions.filter(
    (question) => !askedQuestionIds.includes(question.id)
  );

  let best: Question | null = null;
  let bestDifference = Number.POSITIVE_INFINITY;

  for (const question of available) {
    const yesCount = candidateCharacters.filter(question.matches).length;

    if (yesCount === 0 || yesCount === candidateCharacters.length) {
      continue;
    }

    const difference = Math.abs(candidateCharacters.length / 2 - yesCount);

    if (difference < bestDifference) {
      best = question;
      bestDifference = difference;
    }
  }

  return best ?? available[0] ?? null;
}

export default function GuessWhoGame() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [revealStep, setRevealStep] = useState<RevealStep>("computer-human");
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);

  const [playerOneSecretId, setPlayerOneSecretId] = useState<string | null>(null);
  const [playerTwoSecretId, setPlayerTwoSecretId] = useState<string | null>(null);
  const [humanSecretId, setHumanSecretId] = useState<string | null>(null);
  const [computerSecretId, setComputerSecretId] = useState<string | null>(null);

  const [playerOneEliminated, setPlayerOneEliminated] = useState<Set<string>>(
    new Set()
  );
  const [playerTwoEliminated, setPlayerTwoEliminated] = useState<Set<string>>(
    new Set()
  );
  const [humanEliminated, setHumanEliminated] = useState<Set<string>>(new Set());

  const [computerCandidates, setComputerCandidates] = useState<string[]>(
    characters.map((character) => character.id)
  );
  const [askedComputerQuestions, setAskedComputerQuestions] = useState<string[]>(
    []
  );
  const [computerQuestion, setComputerQuestion] = useState<Question | null>(null);
  const [selectedHumanQuestion, setSelectedHumanQuestion] =
    useState<Question | null>(null);
  const [humanAnswer, setHumanAnswer] = useState<boolean | null>(null);
  const [turnOwner, setTurnOwner] = useState<"human" | "computer">("human");

  const [guessOpen, setGuessOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rounds, setRounds] = useState(0);

  const activeEliminated = useMemo(() => {
    if (mode === "computer") return humanEliminated;
    return currentPlayer === 1 ? playerOneEliminated : playerTwoEliminated;
  }, [
    mode,
    currentPlayer,
    humanEliminated,
    playerOneEliminated,
    playerTwoEliminated,
  ]);

  const remaining = characters.length - activeEliminated.size;

  const revealCharacter = useMemo(() => {
    if (revealStep === "computer-human") return getCharacter(humanSecretId);
    if (revealStep === "player-one") return getCharacter(playerOneSecretId);
    if (revealStep === "player-two") return getCharacter(playerTwoSecretId);
    return null;
  }, [
    revealStep,
    humanSecretId,
    playerOneSecretId,
    playerTwoSecretId,
  ]);

  function resetSharedState() {
    setCurrentPlayer(1);
    setPlayerOneEliminated(new Set());
    setPlayerTwoEliminated(new Set());
    setHumanEliminated(new Set());
    setComputerCandidates(characters.map((character) => character.id));
    setAskedComputerQuestions([]);
    setComputerQuestion(null);
    setSelectedHumanQuestion(null);
    setHumanAnswer(null);
    setTurnOwner("human");
    setGuessOpen(false);
    setResult(null);
    setRounds(0);
  }

  function startComputerMode() {
    resetSharedState();

    const human = randomCharacter();
    const computer = randomCharacter(human.id);

    setMode("computer");
    setHumanSecretId(human.id);
    setComputerSecretId(computer.id);
    setPlayerOneSecretId(null);
    setPlayerTwoSecretId(null);
    setRevealStep("computer-human");
    setScreen("reveal");
  }

  function startTwoPlayerMode() {
    resetSharedState();

    const playerOne = randomCharacter();
    const playerTwo = randomCharacter(playerOne.id);

    setMode("two-player");
    setPlayerOneSecretId(playerOne.id);
    setPlayerTwoSecretId(playerTwo.id);
    setHumanSecretId(null);
    setComputerSecretId(null);
    setRevealStep("player-one");
    setScreen("reveal");
  }

  function returnHome() {
    setMode(null);
    setScreen("home");
    setGuessOpen(false);
    setResult(null);
  }

  function advanceReveal() {
    if (mode === "computer") {
      setScreen("play");
      setTurnOwner("human");
      return;
    }

    if (revealStep === "player-one") {
      setRevealStep("pass-to-two");
      return;
    }

    if (revealStep === "pass-to-two") {
      setRevealStep("player-two");
      return;
    }

    if (revealStep === "player-two") {
      setRevealStep("pass-to-one");
      return;
    }

    setCurrentPlayer(1);
    setScreen("play");
  }

  function toggleEliminated(id: string) {
    if (screen !== "play") return;
    if (mode === "computer" && turnOwner !== "human") return;

    const update = (current: Set<string>) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    };

    if (mode === "computer") {
      setHumanEliminated(update);
      return;
    }

    if (currentPlayer === 1) setPlayerOneEliminated(update);
    else setPlayerTwoEliminated(update);
  }

  function resetBoard() {
    if (mode === "computer") {
      setHumanEliminated(new Set());
      return;
    }

    if (currentPlayer === 1) setPlayerOneEliminated(new Set());
    else setPlayerTwoEliminated(new Set());
  }

  function askComputer(question: Question) {
    if (mode !== "computer" || turnOwner !== "human") return;

    const secret = getCharacter(computerSecretId);
    if (!secret) return;

    setSelectedHumanQuestion(question);
    setHumanAnswer(question.matches(secret));
  }

  function autoFlipNonMatches() {
    if (!selectedHumanQuestion || humanAnswer === null) return;

    setHumanEliminated((current) => {
      const next = new Set(current);

      for (const character of characters) {
        const matchesAnswer =
          selectedHumanQuestion.matches(character) === humanAnswer;

        if (!matchesAnswer) next.add(character.id);
      }

      return next;
    });

    setSelectedHumanQuestion(null);
    setHumanAnswer(null);
    startComputerTurn();
  }

  function keepManualFlipsAndEndTurn() {
    setSelectedHumanQuestion(null);
    setHumanAnswer(null);
    startComputerTurn();
  }

  function startComputerTurn() {
    const question = chooseComputerQuestion(
      computerCandidates,
      askedComputerQuestions
    );

    if (!question || computerCandidates.length <= 2) {
      computerMakeGuess(computerCandidates);
      return;
    }

    setComputerQuestion(question);
    setTurnOwner("computer");
  }

  function answerComputer(answer: boolean) {
    if (!computerQuestion || mode !== "computer") return;

    const nextCandidates = computerCandidates.filter((id) => {
      const character = getCharacter(id);
      return character
        ? computerQuestion.matches(character) === answer
        : false;
    });

    setComputerCandidates(nextCandidates);
    setAskedComputerQuestions((current) => [
      ...current,
      computerQuestion.id,
    ]);
    setComputerQuestion(null);
    setRounds((current) => current + 1);

    if (nextCandidates.length <= 2) {
      computerMakeGuess(nextCandidates);
      return;
    }

    setTurnOwner("human");
  }

  function computerMakeGuess(candidateIds: string[]) {
    const humanSecret = getCharacter(humanSecretId);
    if (!humanSecret) return;

    const candidates =
      candidateIds.length > 0
        ? candidateIds
        : characters.map((character) => character.id);

    const guessId = candidates[0];
    const guess = getCharacter(guessId);

    if (guess?.id === humanSecret.id) {
      finishGame({
        title: "The computer solved it!",
        message: `It correctly guessed ${humanSecret.name}.`,
        winner: "Computer",
      });
      return;
    }

    finishGame({
      title: "You fooled the computer!",
      message: `It guessed ${guess?.name ?? "the wrong person"}, but your secret was ${humanSecret.name}.`,
      winner: "You",
    });
  }

  function endTwoPlayerTurn() {
    if (mode !== "two-player") return;

    setRevealStep("turn-pass");
    setScreen("reveal");
  }

  function finishTurnPass() {
    const nextPlayer = otherPlayer(currentPlayer);
    setCurrentPlayer(nextPlayer);
    setRounds((current) => current + 1);
    setScreen("play");
  }

  function submitGuess(character: Character) {
    setGuessOpen(false);

    if (mode === "computer") {
      const target = getCharacter(computerSecretId);
      if (!target) return;

      if (character.id === target.id) {
        finishGame({
          title: "You beat the computer!",
          message: `The mystery person was ${target.name}.`,
          winner: "You",
        });
      } else {
        finishGame({
          title: "The computer wins",
          message: `You guessed ${character.name}, but the mystery person was ${target.name}.`,
          winner: "Computer",
        });
      }

      return;
    }

    const target =
      currentPlayer === 1
        ? getCharacter(playerTwoSecretId)
        : getCharacter(playerOneSecretId);

    if (!target) return;

    if (character.id === target.id) {
      finishGame({
        title: `Player ${currentPlayer} wins!`,
        message: `The mystery person was ${target.name}.`,
        winner: `Player ${currentPlayer}`,
      });
    } else {
      const winner = otherPlayer(currentPlayer);
      finishGame({
        title: `Player ${winner} wins!`,
        message: `Player ${currentPlayer} guessed ${character.name}, but the mystery person was ${target.name}.`,
        winner: `Player ${winner}`,
      });
    }
  }

  function finishGame(nextResult: Result) {
    setResult(nextResult);
    setScreen("result");
  }

  function playAgain() {
    if (mode === "computer") startComputerMode();
    else startTwoPlayerMode();
  }

  const resultSecrets = useMemo(() => {
    if (mode === "computer") {
      return [
        { label: "Computer's mystery person", character: getCharacter(computerSecretId) },
        { label: "Your secret person", character: getCharacter(humanSecretId) },
      ];
    }

    return [
      { label: "Player 1's secret", character: getCharacter(playerOneSecretId) },
      { label: "Player 2's secret", character: getCharacter(playerTwoSecretId) },
    ];
  }, [
    mode,
    computerSecretId,
    humanSecretId,
    playerOneSecretId,
    playerTwoSecretId,
  ]);

  if (screen === "home") {
    return (
      <div className={styles.home}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>GUESS WITH ADRIAN</span>
            <h1>Who is the mystery person?</h1>
            <p>
              Ask smart yes-or-no questions, flip down the wrong people, and
              solve the mystery before your opponent.
            </p>
          </div>

          <div className={styles.modeGrid}>
            <button
              type="button"
              className={styles.modeCard}
              onClick={startComputerMode}
            >
              <span className={styles.modeEmoji}>🤖</span>
              <strong>Play the computer</strong>
              <span>
                Take turns asking questions against a computer opponent.
              </span>
            </button>

            <button
              type="button"
              className={styles.modeCard}
              onClick={startTwoPlayerMode}
            >
              <span className={styles.modeEmoji}>🧑‍🤝‍🧑</span>
              <strong>Play with another person</strong>
              <span>
                Pass one device back and forth with private secret cards.
              </span>
            </button>
          </div>
        </section>

        <section className={styles.how}>
          <article>
            <span>1</span>
            <h2>Look closely</h2>
            <p>Notice hats, glasses, hair, ages, and facial hair.</p>
          </article>
          <article>
            <span>2</span>
            <h2>Ask wisely</h2>
            <p>Use questions that can remove lots of people at once.</p>
          </article>
          <article>
            <span>3</span>
            <h2>Flip and solve</h2>
            <p>Tap cards to flip them down, then make your final guess.</p>
          </article>
        </section>
      </div>
    );
  }

  if (screen === "reveal") {
    const isPassScreen =
      revealStep === "pass-to-two" ||
      revealStep === "pass-to-one" ||
      revealStep === "turn-pass";

    let title = "Your secret person";
    let text = "Remember this person. The computer will try to guess them.";
    let buttonText = "Start game";

    if (revealStep === "player-one") {
      title = "Player 1's secret person";
      text = "Player 2, look away. Player 1 should remember this person.";
      buttonText = "Hide and pass";
    }

    if (revealStep === "pass-to-two") {
      title = "Pass to Player 2";
      text = "Player 1, look away. Tap below when Player 2 is ready.";
      buttonText = "Player 2 is ready";
    }

    if (revealStep === "player-two") {
      title = "Player 2's secret person";
      text = "Player 1, look away. Player 2 should remember this person.";
      buttonText = "Hide and pass";
    }

    if (revealStep === "pass-to-one") {
      title = "Pass back to Player 1";
      text = "Both secret people are ready. Player 1 goes first.";
      buttonText = "Start game";
    }

    if (revealStep === "turn-pass") {
      const nextPlayer = otherPlayer(currentPlayer);
      title = `Pass to Player ${nextPlayer}`;
      text = `Player ${currentPlayer}, look away while Player ${nextPlayer} takes the device.`;
      buttonText = `Player ${nextPlayer} is ready`;
    }

    return (
      <div className={styles.revealPage}>
        <section className={styles.revealPanel}>
          <span className={styles.revealEmoji}>{isPassScreen ? "🙈" : "🔐"}</span>
          <span className={styles.eyebrow}>PRIVATE SCREEN</span>
          <h1>{title}</h1>
          <p>{text}</p>

          {!isPassScreen && revealCharacter && (
            <CharacterCard
              character={revealCharacter}
              large
              disabled
              eliminated={false}
            />
          )}

          <div className={styles.revealActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={
                revealStep === "turn-pass" ? finishTurnPass : advanceReveal
              }
            >
              {buttonText}
            </button>

            <button
              type="button"
              className={styles.textButton}
              onClick={returnHome}
            >
              Cancel game
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (screen === "result" && result) {
    return (
      <div className={styles.resultPage}>
        <section className={styles.resultPanel}>
          <div className={styles.confetti}>🎉 ✨ 🎊</div>
          <span className={styles.eyebrow}>GAME OVER</span>
          <h1>{result.title}</h1>
          <p>{result.message}</p>

          <div className={styles.secretResults}>
            {resultSecrets.map(({ label, character }) =>
              character ? (
                <div key={label}>
                  <strong>{label}</strong>
                  <CharacterCard
                    character={character}
                    large
                    disabled
                    eliminated={false}
                  />
                </div>
              ) : null
            )}
          </div>

          <div className={styles.resultActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={playAgain}
            >
              Play again
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={returnHome}
            >
              Choose mode
            </button>
          </div>
        </section>
      </div>
    );
  }

  const isHumanTurn = mode !== "computer" || turnOwner === "human";

  return (
    <div className={styles.game}>
      <section className={styles.statusBar}>
        <div className={styles.statusCard}>
          <span>Mode</span>
          <strong>
            {mode === "computer"
              ? "You vs Computer"
              : `Player ${currentPlayer}'s turn`}
          </strong>
        </div>

        <div className={styles.turnPill}>
          {mode === "computer"
            ? turnOwner === "human"
              ? "Your turn"
              : "Computer's turn"
            : `Player ${currentPlayer}`}
        </div>

        <div className={styles.statusCard}>
          <span>Board</span>
          <strong>{remaining} remaining</strong>
        </div>
      </section>

      <section
        className={[
          styles.board,
          !isHumanTurn ? styles.boardLocked : "",
        ].join(" ")}
        aria-label="Guess Who character board"
      >
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            eliminated={activeEliminated.has(character.id)}
            disabled={!isHumanTurn}
            onClick={() => toggleEliminated(character.id)}
          />
        ))}
      </section>

      {mode === "computer" && turnOwner === "human" && (
        <section className={styles.questionPanel}>
          <div>
            <span className={styles.eyebrow}>ASK THE COMPUTER</span>
            <h2>Choose a yes-or-no question</h2>

            <div className={styles.questions}>
              {questions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  className={[
                    styles.questionButton,
                    selectedHumanQuestion?.id === question.id
                      ? styles.questionSelected
                      : "",
                  ].join(" ")}
                  onClick={() => askComputer(question)}
                >
                  {question.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.answerBox}>
            <span>ANSWER</span>
            <strong>
              {humanAnswer === null ? "Choose a question" : humanAnswer ? "YES" : "NO"}
            </strong>

            {humanAnswer !== null && (
              <>
                <p>
                  Flip cards yourself, or let the game remove every non-match.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={autoFlipNonMatches}
                >
                  Flip all incorrect cards
                </button>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={keepManualFlipsAndEndTurn}
                >
                  I flipped them myself
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {mode === "computer" && turnOwner === "computer" && computerQuestion && (
        <section className={styles.computerPanel}>
          <span className={styles.computerEmoji}>🤖</span>
          <span className={styles.eyebrow}>COMPUTER QUESTION</span>
          <h2>{computerQuestion.label}</h2>
          <p>Answer honestly about your secret person.</p>
          <div>
            <button
              type="button"
              className={styles.yesButton}
              onClick={() => answerComputer(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={styles.noButton}
              onClick={() => answerComputer(false)}
            >
              No
            </button>
          </div>
        </section>
      )}

      {mode === "two-player" && (
        <section className={styles.playerInstructions}>
          <div>
            <span className={styles.eyebrow}>PLAYER {currentPlayer}</span>
            <h2>Ask your opponent a yes-or-no question.</h2>
            <p>
              They answer out loud. Tap every person who no longer matches,
              then end your turn or make a guess.
            </p>
          </div>
        </section>
      )}

      <nav className={styles.bottomBar}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={resetBoard}
          disabled={!isHumanTurn}
        >
          Reset board
        </button>

        {mode === "two-player" && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={endTwoPlayerTurn}
          >
            End turn
          </button>
        )}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setGuessOpen(true)}
          disabled={!isHumanTurn}
        >
          Make a guess
        </button>
      </nav>

      {guessOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <section className={styles.guessModal}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setGuessOpen(false)}
              aria-label="Close guess window"
            >
              ×
            </button>

            <span className={styles.eyebrow}>FINAL GUESS</span>
            <h1>Who is the mystery person?</h1>
            <p>A wrong final guess loses the round.</p>

            <div className={styles.guessGrid}>
              {characters
                .filter((character) => !activeEliminated.has(character.id))
                .map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    eliminated={false}
                    onClick={() => submitGuess(character)}
                  />
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CharacterCard({
  character,
  eliminated,
  onClick,
  large = false,
  disabled = false,
}: {
  character: Character;
  eliminated: boolean;
  onClick?: () => void;
  large?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        styles.card,
        eliminated ? styles.eliminated : "",
        large ? styles.largeCard : "",
      ].join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={eliminated}
      aria-label={`${character.name}${eliminated ? ", eliminated" : ""}`}
    >
      <div
        className={styles.portrait}
        style={{ background: character.background }}
      >
        <span aria-hidden="true">{character.emoji}</span>
      </div>

      <div className={styles.cardFooter}>
        <strong>{character.name}</strong>
        {!large && (
          <span>{eliminated ? "Tap to restore" : "Tap to flip"}</span>
        )}
      </div>

      {eliminated && (
        <div className={styles.flipCover} aria-hidden="true">
          <span>×</span>
        </div>
      )}
    </button>
  );
}
