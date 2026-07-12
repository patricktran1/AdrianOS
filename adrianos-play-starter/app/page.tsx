import FamilyProfileBar from "@/components/FamilyProfileBar";
import GameShelf from "@/components/GameShelf";
import { games } from "@/lib/generated-games";

export default function Home() {
  return (
    <>
      <FamilyProfileBar />
      <main className="shell">
        <GameShelf games={games} />
      </main>
    </>
  );
}
