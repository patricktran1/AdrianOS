"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { elementaryGradeLabel, type ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { dueReviewCount } from "@/lib/adventure-arcade";
import { readDailyRemixState } from "@/lib/daily-adventure-remix-state";

const GRADE_MISSION: Record<ElementaryGrade, {
  slug: string;
  emoji: string;
  title: string;
  description: string;
}> = {
  [-1]: {
    slug: "adaptive-boss-arena",
    emoji: "🌈",
    title: "Critter challenge",
    description: "Finish a playful challenge that adjusts as you go.",
  },
  0: {
    slug: "rainbow-rocket-park",
    emoji: "🚀",
    title: "Rainbow Rocket Park",
    description: "Complete today’s kindergarten story mission.",
  },
  1: {
    slug: "robot-rescue-city",
    emoji: "🤖",
    title: "Robot Rescue City",
    description: "Complete today’s Grade 1 story mission.",
  },
  2: {
    slug: "dino-time-rescue",
    emoji: "🦖",
    title: "Dino Time Rescue",
    description: "Complete today’s Grade 2 dinosaur mission.",
  },
  3: {
    slug: "space-station-sigma",
    emoji: "🪐",
    title: "Space Station Sigma",
    description: "Complete today’s Grade 3 space mission.",
  },
  4: {
    slug: "mystery-temple",
    emoji: "🏛️",
    title: "Mystery Temple",
    description: "Complete today’s Grade 4 temple mission.",
  },
  5: {
    slug: "cyber-city-five",
    emoji: "🌐",
    title: "Cyber City Five",
    description: "Complete today’s Grade 5 cyber mission.",
  },
};

type Mission = {
  id: string;
  slug: string;
  emoji: string;
  eyebrow: string;
  title: string;
  description: string;
  complete: boolean;
  readyLabel: string;
  completeLabel: string;
};

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function happenedToday(timestamp: string | null | undefined): boolean {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) && localDateKey(date) === localDateKey();
}

export default function DailyMissionControl() {
  const { activeProfile } = useFamilyProfiles();
  const { progress, hydrated } = useAdrianProgress();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const grade = readProfileGrade(activeProfile);
  const gradeMission = GRADE_MISSION[grade];
  const daily = readDailyRemixState(activeProfile.id);
  const reviews = dueReviewCount(activeProfile.id);
  void revision;

  const missions = useMemo<Mission[]>(() => [
    {
      id: "daily-remix",
      slug: "daily-adventure-remix",
      emoji: "⚡",
      eyebrow: "WARM UP",
      title: "Today’s fresh remix",
      description: "Open five quick gates across math, reading, science, and thinking.",
      complete: daily.completedToday,
      readyLabel: "Run today’s remix",
      completeLabel: "Daily treasure claimed",
    },
    {
      id: "reading",
      slug: "story-expedition",
      emoji: "📚",
      eyebrow: "READ",
      title: "Story Expedition",
      description: "Read, choose, explain, and steer a branching adventure.",
      complete: happenedToday(progress.games["story-expedition"]?.lastCompleted),
      readyLabel: "Enter the story",
      completeLabel: "Reading mission cleared",
    },
    {
      id: "rescue",
      slug: "mastery-rescue-lab",
      emoji: reviews > 0 ? "🛟" : "🧠",
      eyebrow: "REMEMBER",
      title: reviews > 0
        ? `Rescue ${reviews} skill${reviews === 1 ? "" : "s"}`
        : "Memory systems clear",
      description: reviews > 0
        ? "Give tricky ideas a short, playful rematch before they fade."
        : "Nothing is waiting for review. Your memory queue is clean.",
      complete: reviews === 0,
      readyLabel: `Rescue ${reviews} skill${reviews === 1 ? "" : "s"}`,
      completeLabel: "No rescues waiting",
    },
    {
      id: "grade-adventure",
      slug: gradeMission.slug,
      emoji: gradeMission.emoji,
      eyebrow: elementaryGradeLabel(grade).toUpperCase(),
      title: gradeMission.title,
      description: gradeMission.description,
      complete: happenedToday(progress.games[gradeMission.slug]?.lastCompleted),
      readyLabel: "Launch grade adventure",
      completeLabel: "Grade mission cleared",
    },
  ], [daily.completedToday, grade, gradeMission, progress.games, reviews]);

  if (!hydrated) return null;

  const completeCount = missions.filter((mission) => mission.complete).length;
  const progressPercent = Math.round((completeCount / missions.length) * 100);
  const nextMission = missions.find((mission) => mission.id === "rescue" && !mission.complete)
    ?? missions.find((mission) => !mission.complete);
  const allComplete = completeCount === missions.length;

  return (
    <section className="mission-shell" aria-label="Daily mission control" data-testid="daily-mission-control">
      <div className="mission-header">
        <div className="mission-copy">
          <span className="mission-eyebrow">TODAY’S MISSION CONTROL</span>
          <h1>{activeProfile.name}’s launch plan</h1>
          <p>
            One clear route through the best parts of AdrianOS. Finish the essentials, then the whole arcade opens up for bonus play.
          </p>
        </div>

        <div className="mission-status" aria-label={`${completeCount} of ${missions.length} missions complete`}>
          <strong>{completeCount}/{missions.length}</strong>
          <span>{allComplete ? "DAY COMPLETE" : "SYSTEMS GREEN"}</span>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="mission-grid">
        {missions.map((mission, index) => (
          <article
            key={mission.id}
            className={`mission-card ${mission.complete ? "is-complete" : ""}`}
            aria-label={`${mission.title}: ${mission.complete ? "complete" : "ready"}`}
          >
            <div className="mission-card-top">
              <span className="mission-number">{index + 1}</span>
              <span className="mission-icon" aria-hidden="true">{mission.emoji}</span>
              <span className={`mission-badge ${mission.complete ? "complete" : "ready"}`}>
                {mission.complete ? "✓ CLEAR" : "READY"}
              </span>
            </div>
            <small>{mission.eyebrow}</small>
            <h2>{mission.title}</h2>
            <p>{mission.description}</p>
            {mission.complete ? (
              <span className="mission-result">{mission.completeLabel}</span>
            ) : (
              <Link href={`/games/${mission.slug}`} className="mission-link">
                {mission.readyLabel} →
              </Link>
            )}
          </article>
        ))}
      </div>

      <div className={`mission-next ${allComplete ? "complete" : ""}`}>
        <div>
          <span>{allComplete ? "🏆 DAILY LAUNCH COMPLETE" : "NEXT BEST MOVE"}</span>
          <strong>
            {allComplete
              ? "Core learning is done. Bonus adventures are unlocked."
              : `${nextMission?.emoji ?? "🚀"} ${nextMission?.title ?? "Choose an adventure"}`}
          </strong>
        </div>
        <Link
          href={allComplete ? "/games/family-quest-party" : `/games/${nextMission?.slug ?? "daily-adventure-remix"}`}
          className="primary-mission-button"
        >
          {allComplete ? "Play a bonus quest →" : `${nextMission?.readyLabel ?? "Start"} →`}
        </Link>
      </div>

      <style jsx>{`
        .mission-shell {
          margin: 0 0 24px;
          padding: clamp(20px, 4vw, 34px);
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 30px;
          background:
            radial-gradient(circle at 8% 8%, rgba(197,255,89,.18), transparent 28%),
            radial-gradient(circle at 92% 12%, rgba(203,163,255,.24), transparent 30%),
            linear-gradient(145deg, #171d2a 0%, #252c3c 55%, #151a25 100%);
          color: #fff;
          box-shadow: 0 24px 70px rgba(0,0,0,.28);
          overflow: hidden;
        }
        .mission-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }
        .mission-copy { max-width: 720px; }
        .mission-eyebrow,
        .mission-card small,
        .mission-next span {
          display: block;
          color: #c5ff59;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: .13em;
        }
        h1 {
          margin: 8px 0 10px;
          font-size: clamp(30px, 5vw, 54px);
          line-height: .98;
          letter-spacing: -.045em;
        }
        .mission-copy p {
          max-width: 650px;
          margin: 0;
          color: rgba(255,255,255,.76);
          font-size: clamp(15px, 2vw, 18px);
          line-height: 1.55;
        }
        .mission-status {
          flex: 0 0 150px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 22px;
          background: rgba(0,0,0,.2);
          text-align: center;
        }
        .mission-status strong {
          display: block;
          font-size: 38px;
          line-height: 1;
        }
        .mission-status span {
          display: block;
          margin: 7px 0 12px;
          color: rgba(255,255,255,.7);
          font-size: 10px;
          font-weight: 1000;
          letter-spacing: .12em;
        }
        .progress-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.11);
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #c5ff59, #cba3ff);
          transition: width .25s ease;
        }
        .mission-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 26px;
        }
        .mission-card {
          min-width: 0;
          padding: 17px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 22px;
          background: rgba(255,255,255,.065);
        }
        .mission-card.is-complete {
          background: rgba(197,255,89,.075);
          border-color: rgba(197,255,89,.22);
        }
        .mission-card-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
        }
        .mission-number {
          display: grid;
          width: 26px;
          height: 26px;
          place-items: center;
          border-radius: 50%;
          background: rgba(255,255,255,.1);
          font-size: 12px;
          font-weight: 1000;
        }
        .mission-icon { font-size: 28px; }
        .mission-badge {
          margin-left: auto;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 1000;
          letter-spacing: .1em;
        }
        .mission-badge.ready { background: rgba(203,163,255,.18); color: #e6d3ff; }
        .mission-badge.complete { background: rgba(197,255,89,.14); color: #d9ff91; }
        .mission-card small { color: rgba(255,255,255,.54); font-size: 10px; }
        .mission-card h2 {
          margin: 7px 0 8px;
          font-size: 19px;
          line-height: 1.08;
          letter-spacing: -.02em;
        }
        .mission-card p {
          min-height: 58px;
          margin: 0 0 15px;
          color: rgba(255,255,255,.66);
          font-size: 13px;
          line-height: 1.45;
        }
        .mission-link,
        .mission-result {
          display: inline-flex;
          min-height: 35px;
          align-items: center;
          font-size: 12px;
          font-weight: 950;
        }
        .mission-link { color: #fff; text-decoration: none; }
        .mission-link:hover { text-decoration: underline; }
        .mission-result { color: #c5ff59; }
        .mission-next {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 14px;
          padding: 17px 18px;
          border-radius: 20px;
          background: #f3efff;
          color: #191a21;
        }
        .mission-next.complete { background: #efffcf; }
        .mission-next span { color: #6a4fa0; font-size: 10px; }
        .mission-next strong { display: block; margin-top: 4px; font-size: 16px; }
        .primary-mission-button {
          flex: 0 0 auto;
          padding: 13px 17px;
          border-radius: 14px;
          background: #191a21;
          color: #fff;
          font-size: 13px;
          font-weight: 1000;
          text-decoration: none;
          box-shadow: 0 10px 25px rgba(0,0,0,.18);
        }
        @media (max-width: 980px) {
          .mission-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .mission-shell { border-radius: 24px; padding: 19px; }
          .mission-header { display: block; }
          .mission-status {
            display: grid;
            grid-template-columns: auto 1fr;
            align-items: center;
            gap: 6px 12px;
            width: auto;
            margin-top: 18px;
            text-align: left;
          }
          .mission-status strong { grid-row: 1 / 3; font-size: 32px; }
          .mission-status span { margin: 0; }
          .progress-track { align-self: start; }
          .mission-grid { grid-template-columns: 1fr; }
          .mission-card p { min-height: auto; }
          .mission-next { align-items: stretch; flex-direction: column; }
          .primary-mission-button { text-align: center; }
        }
      `}</style>
    </section>
  );
}
