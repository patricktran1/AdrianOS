import type { ReactNode } from "react";
import AdaptiveAdventureChain from "@/components/AdaptiveAdventureChain";
import GameFeelShell from "@/components/GameFeelShell";
import GameFlowDirector from "@/components/GameFlowDirector";
import GamePowerLoop from "@/components/GamePowerLoop";
import GameStartDirector from "@/components/GameStartDirector";
import "./adventure-chain.css";
import "./game-feel.css";
import "./game-feel-stability.css";
import "./game-flow.css";
import "./game-power-loop.css";
import "./game-start.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <GameFeelShell>
      <GamePowerLoop />
      <GameStartDirector />
      <GameFlowDirector />
      <AdaptiveAdventureChain />
      {children}
    </GameFeelShell>
  );
}
