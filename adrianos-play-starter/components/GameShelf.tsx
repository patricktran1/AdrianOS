"use client";

import Link from "next/link";
import DailyMissionControl from "@/components/DailyMissionControl";
import AdventureArcade from "@/components/AdventureArcade";
import PrizeVault from "@/components/PrizeVault";
import PlacementBanner from "@/components/PlacementBanner";
import SchoolModeBanner from "@/components/SchoolModeBanner";
import TodaysAdventure from "@/components/TodaysAdventure";
import SkillMap from "@/components/SkillMap";
import HomeHub from "@/components/HomeHub";
import type { Game } from "@/lib/games";

export default function GameShelf({ games }: { games: Game[] }) {
  return (
    <>
      <DailyMissionControl />
      <AdventureArcade games={games} />
      <PrizeVault />

      <SchoolModeBanner />
      <PlacementBanner />
      <TodaysAdventure games={games} />
      <SkillMap games={games} />
      <HomeHub games={games} />

      <div style={parentCtaRow}>
        <Link href="/parent" style={parentCta}>
          <span style={{ fontSize: 32 }}>🔐</span>
          <span>
            <strong style={{ display: "block", fontSize: 18 }}>Parent Dashboard</strong>
            <small style={{ display: "block", marginTop: 3, opacity: .72 }}>
              Reports, goals, profiles, schedule, and cloud sync
            </small>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 24 }}>→</span>
        </Link>
      </div>

      <footer>
        <span>Built first for Adrian, now opening to more curious kids.</span>
        <span>No ads. No feeds. Parent-managed learning.</span>
      </footer>
    </>
  );
}

const parentCtaRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  margin: "20px 0 4px",
};

const parentCta: React.CSSProperties = {
  width: "min(430px,100%)",
  minHeight: 82,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 20px",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,.14)",
  background: "#222936",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 900,
  boxShadow: "0 18px 45px rgba(0,0,0,.22)",
};
