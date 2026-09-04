"use client";

import { useEffect, useRef } from "react";
import { readAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";

/**
 * The one place a session advances.
 *
 * A session step finishes when its activity is genuinely completed, and that
 * can happen anywhere: a kernel route under /games, the Mastery Lab, a
 * story game. Putting the advance in the post-game panel meant only the
 * routes that panel is mounted on could move the session on, and a change of
 * explanation in the Mastery Lab would have left the plan stuck on a step the
 * child had already done.
 *
 * Mounted once, at the root. It renders nothing.
 *
 * The session runtime is loaded on demand rather than imported at the top.
 * This component sits in the root layout, so a static import would put the
 * planner, the learner model, the kernel task banks and the whole game
 * catalogue into the bundle every page of AdrianOS downloads before it can
 * render — including the child\u2019s world, which has to be fast. Nothing here
 * runs until a game has actually been completed, by which point a dynamic
 * import costs nothing anybody notices.
 */
export default function SessionAdvanceBridge() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  /** Evidence rows present before the current activity started. */
  const watermark = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated || !activeProfile.id) return;
    let previous = readAdrianProgress();
    let cancelled = false;

    const onProgress = () => {
      const next = readAdrianProgress();
      // A Map, because both the keys and the values come from storage: a
      // plain object would answer `constructor` with a function.
      const before = new Map(
        Object.entries(previous.games ?? {}).map(
          ([slug, row]) => [slug, row?.completions ?? 0] as const
        )
      );
      const finished = Object.entries(next.games ?? {})
        .filter(([slug, entry]) => (entry?.completions ?? 0) > (before.get(slug) ?? 0))
        .map(([slug]) => slug);
      previous = next;
      if (finished.length > 0) void advance(finished);
    };

    async function advance(slugs: string[]) {
      const runtime = await import("@/lib/adrian-session-runtime");
      if (cancelled) return;
      for (const slug of slugs) {
        runtime.advanceSession(activeProfile.id, {
          grade: readProfileGrade(activeProfile),
          age: activeProfile.age,
          rows: runtime.evidenceSince(
            activeProfile.id,
            watermark.current ?? runtime.evidenceCount(activeProfile.id)
          ),
          slug,
        });
        watermark.current = runtime.evidenceCount(activeProfile.id);
      }
    }

    const onProfileChange = () => {
      previous = readAdrianProgress();
      watermark.current = null;
    };

    window.addEventListener("adrianos-progress-updated", onProgress);
    window.addEventListener("adrianos-family-updated", onProfileChange);
    return () => {
      cancelled = true;
      window.removeEventListener("adrianos-progress-updated", onProgress);
      window.removeEventListener("adrianos-family-updated", onProfileChange);
    };
  }, [activeProfile, hydrated]);

  return null;
}
