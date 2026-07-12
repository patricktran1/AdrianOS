import type { ReactNode } from "react";
import GameFeelShell from "@/components/GameFeelShell";
import "./game-feel.css";

export default function GamesLayout({ children }: { children: ReactNode }) {
  return <GameFeelShell>{children}</GameFeelShell>;
}
