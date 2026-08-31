"use client";

import { useMemo } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { readLearningProfile } from "@/lib/adrian-learning-profile";
import { readArcadeState } from "@/lib/adventure-arcade";
import { buildAdventureWorld } from "@/lib/adventure-world";
import { useLearnerModel } from "@/lib/adrian-evidence";
import {
  actionLabel,
  confidenceLabel,
  explainSkillForAdult,
  graspLabel,
  recommendNextActivity,
  type SkillSignal,
} from "@/lib/adrian-learner-model";
import { buildWorldMap, describeWorldDecision } from "@/lib/adrian-world-map";
import type { Game } from "@/lib/games";
import styles from "./LearningEvidencePanel.module.css";

function seconds(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function relativeDay(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * What the child actually did, and what AdrianOS concluded from it.
 *
 * Every number here is computed from recorded answers: response times,
 * hint use, retries, and the specific wrong answers the child gave. Nothing
 * is summarized from completion counts alone, and nothing is invented when
 * the evidence is thin — the panel says so instead.
 */
export default function LearningEvidencePanel({ games }: { games: Game[] }) {
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const { model, hydrated: modelReady } = useLearnerModel(
    profilesReady ? activeProfile.id : ""
  );

  const next = useMemo(() => recommendNextActivity(model), [model]);

  const decision = useMemo(() => {
    if (!profilesReady || !progressReady) return null;
    const world = buildAdventureWorld({
      profileId: activeProfile.id,
      age: activeProfile.age,
      grade: readProfileGrade(activeProfile),
      interests: readLearningProfile(activeProfile.id)?.interests ?? [],
      games,
      progress,
      arcade: readArcadeState(activeProfile.id),
    });
    if (!world) return null;
    return describeWorldDecision(buildWorldMap(world, model, next), model);
  }, [activeProfile, games, model, next, profilesReady, progress, progressReady]);

  if (!profilesReady || !modelReady) return null;

  const ranked: SkillSignal[] = [...model.skills]
    .filter((skill) => skill.attempts >= 2)
    .sort((a, b) => a.fluency - b.fluency)
    .slice(0, 6);

  return (
    <section className={styles.shell} aria-label="Learning evidence" data-learning-evidence="active">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>LEARNING EVIDENCE</span>
          <h2 className={styles.title}>What {activeProfile.name} is actually doing</h2>
          <p className={styles.lead}>
            Built from {model.sampleSize} recorded answer{model.sampleSize === 1 ? "" : "s"} —
            response times, hint use, retries, and the exact answers given.
          </p>
        </div>
      </header>

      {model.sampleSize === 0 ? (
        <p className={styles.empty} data-evidence-empty="true">
          No answers recorded yet. Evidence appears here as soon as {activeProfile.name}
          {" "}plays a game with questions in it. Nothing is estimated before then.
        </p>
      ) : (
        <>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{seconds(model.baselineResponseMs)}</span>
              <span className={styles.statLabel}>Typical answer time</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {model.pace === "unknown" ? "—" : model.pace}
              </span>
              <span className={styles.statLabel}>Working pace</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {model.readiness === "unknown" ? "—" : model.readiness}
              </span>
              <span className={styles.statLabel}>Readiness</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {model.momentum > 0.55 ? "improving" : model.momentum < 0.45 ? "dipping" : "steady"}
              </span>
              <span className={styles.statLabel}>Recent trend</span>
            </div>
          </div>

          {model.misconceptions.length > 0 ? (
            <>
              <p className={styles.sectionLabel}>Repeated misunderstandings</p>
              <ul className={styles.misconceptionList} data-misconceptions="present">
                {model.misconceptions.slice(0, 4).map((row) => (
                  <li key={`${row.skillId}-${row.answer}`} className={styles.misconception}>
                    <span className={styles.misconceptionSkill}>{row.skillLabel}</span>
                    <p className={styles.misconceptionPrompt}>“{row.examplePrompt}”</p>
                    <p className={styles.misconceptionAnswer}>
                      Answered <strong>{row.answer}</strong> {row.count} times · expected{" "}
                      <strong>{row.expected || "—"}</strong> · last {relativeDay(row.lastSeenAt)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className={styles.note}>
                A wrong answer that repeats is usually a method the child believes is
                correct. More practice on its own tends to reinforce it, so AdrianOS
                reteaches these before adding difficulty.
              </p>
            </>
          ) : null}

          {ranked.some((skill) => skill.state !== "unknown") ? (
            <>
              <p className={styles.sectionLabel}>What AdrianOS is doing, and why</p>
              <ul className={styles.misconceptionList} data-teaching-notes="present">
                {ranked
                  .filter((skill) => skill.state !== "unknown")
                  .slice(0, 4)
                  .map((skill) => (
                    <li
                      key={`note-${skill.skillId}`}
                      className={styles.misconception}
                      data-skill-state={skill.state}
                    >
                      <span className={styles.misconceptionSkill}>{skill.skillLabel}</span>
                      <p className={styles.misconceptionAnswer}>
                        {explainSkillForAdult(skill, activeProfile.name)}
                      </p>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}

          {ranked.length > 0 ? (
            <>
              <p className={styles.sectionLabel}>Skill by skill</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Skill</th>
                      <th scope="col">Accuracy</th>
                      <th scope="col">Answer time</th>
                      <th scope="col">Support used</th>
                      <th scope="col">Reads as</th>
                      <th scope="col">Seen across</th>
                      <th scope="col">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((skill) => (
                      <tr key={skill.skillId} data-skill-row={skill.skillId}>
                        <th scope="row">
                          {skill.skillLabel}
                          <small>{skill.subject} · {skill.attempts} attempts</small>
                        </th>
                        <td>{percent(skill.accuracy)}</td>
                        <td>{seconds(skill.medianResponseMs)}</td>
                        <td>{percent(skill.supportReliance)}</td>
                        <td>{confidenceLabel(skill.confidence)}</td>
                        <td data-skill-grasp={skill.grasp}>{graspLabel(skill)}</td>
                        <td data-skill-action={skill.action}>{actionLabel(skill.action)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}

      <p className={styles.sectionLabel}>What the world is doing about it</p>
      <p className={styles.decision} data-world-rationale="true">
        {decision ?? next.adultReason}
      </p>
    </section>
  );
}
