import type { ReactNode } from "react";
import AdaptiveAdventureChain from "@/components/AdaptiveAdventureChain";
import GameFeelShell from "@/components/GameFeelShell";
import GameFlowDirector from "@/components/GameFlowDirector";
import GamePowerLoop from "@/components/GamePowerLoop";
import "./adventure-chain.css";
import "./game-feel.css";
import "./game-feel-stability.css";
import "./game-flow.css";
import "./game-power-loop.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <GameFeelShell>
      <GamePowerLoop />
      <GameFlowDirector />
      <AdaptiveAdventureChain />
      {children}
    </GameFeelShell>
  );
}
