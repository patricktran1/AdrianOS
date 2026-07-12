import type { ReactNode } from "react";
import GameFeelShell from "@/components/GameFeelShell";
import GamePowerLoop from "@/components/GamePowerLoop";
import "./game-feel.css";
import "./game-feel-stability.css";
import "./game-power-loop.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <GameFeelShell>
      <GamePowerLoop />
      {children}
    </GameFeelShell>
  );
}
