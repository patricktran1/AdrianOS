"use client";

import { useEffect } from "react";

/**
 * The shared game-feel announcer is supplementary to each game's own
 * instructional status region. Keep aria-live announcements, but avoid
 * exposing a second role=status that makes the page's primary teaching
 * feedback ambiguous to assistive technology and browser tests.
 */
export default function GameFeelAccessibilityGuard() {
  useEffect(() => {
    const normalize = () => {
      document.querySelectorAll<HTMLElement>(".game-feel-live").forEach((region) => {
        region.removeAttribute("role");
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-atomic", "true");
      });
    };

    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
