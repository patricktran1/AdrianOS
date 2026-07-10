import GameFrame from "@/components/GameFrame";
import GuessWhoGame from "./GuessWhoGame";

export default function GuessWhoPage() {
  return (
    <GameFrame title="Guess Who">
      <GuessWhoGame />
    </GameFrame>
  );
}
