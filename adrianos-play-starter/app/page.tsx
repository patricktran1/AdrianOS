import GameShelf from "@/components/GameShelf";
import { games } from "@/lib/generated-games";

export default function Home() {
  return (
    <main className="shell">
      <GameShelf games={games} />
    </main>
  );
}
