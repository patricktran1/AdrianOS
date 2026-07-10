import GameShelf from "@/components/GameShelf";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <main className="shell">
      <GameShelf games={games} />
    </main>
  );
}
