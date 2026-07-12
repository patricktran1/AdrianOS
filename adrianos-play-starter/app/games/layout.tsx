import type { ReactNode } from "react";
import AdaptiveAdventureChain from "@/components/AdaptiveAdventureChain";
import GameFeelShell from "@/components/GameFeelShell";
import GamePowerLoop from "@/components/GamePowerLoop";
import "./adventure-chain.css";
import "./game-feel.css";
import "./game-feel-stability.css";
import "./game-power-loop.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <GameFeelShell>
      <GamePowerLoop />
      <AdaptiveAdventureChain />
      {children}
    </GameFeelShell>
  );
}
