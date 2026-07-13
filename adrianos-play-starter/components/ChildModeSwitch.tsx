"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ChildModeSwitch.module.css";

export default function ChildModeSwitch() {
  const pathname = usePathname();
  const arcadeActive = pathname === "/";
  const schoolActive = pathname.startsWith("/school") || pathname.startsWith("/daily-session");

  return (
    <nav className={styles.shell} aria-label="Choose child mode" data-child-mode-switch="active">
      <Link
        href="/"
        className={styles.mode}
        data-active={arcadeActive ? "true" : "false"}
        aria-current={arcadeActive ? "page" : undefined}
      >
        <span aria-hidden="true">🕹️</span>
        <span>
          <strong>Arcade</strong>
          <small>Pick any game</small>
        </span>
      </Link>
      <Link
        href="/school"
        className={styles.mode}
        data-active={schoolActive ? "true" : "false"}
        aria-current={schoolActive ? "page" : undefined}
      >
        <span aria-hidden="true">🚀</span>
        <span>
          <strong>Today&apos;s School</strong>
          <small>Follow my route</small>
        </span>
      </Link>
    </nav>
  );
}
