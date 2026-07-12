import type { ReactNode } from "react";
import GameFeelShell from "@/components/GameFeelShell";
import GameFeelAccessibilityGuard from "@/components/GameFeelAccessibilityGuard";
import "./game-feel.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <GameFeelShell>
      <GameFeelAccessibilityGuard />
      {children}
    </GameFeelShell>
  );
}
