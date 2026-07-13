import type { ReactNode } from "react";
import AdaptiveAdventureChain from "@/components/AdaptiveAdventureChain";
import GameFeelShell from "@/components/GameFeelShell";
import GameFlowDirector from "@/components/GameFlowDirector";
import GamePowerLoop from "@/components/GamePowerLoop";
import GameStartDirector from "@/components/GameStartDirector";
import GameSurpriseDirector from "@/components/GameSurpriseDirector";
import PowerLockerCompanion from "@/components/PowerLockerCompanion";
import "./adventure-chain.css";
import "./game-feel.css";
import "./game-feel-stability.css";
import "./game-flow.css";
import "./game-power-loop.css";
import "./game-start.css";
import "./game-surprise.css";
import "./power-locker.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <GameFeelShell>
      <PowerLockerCompanion />
      <GamePowerLoop />
      <GameSurpriseDirector />
      <GameStartDirector />
      <GameFlowDirector />
      <AdaptiveAdventureChain />
      {children}
    </GameFeelShell>
  );
}
