"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/school", label: "School", icon: "▶" },
  { href: "/curriculum", label: "Learning", icon: "◎" },
] as const;

export default function MobileAppDock() {
  const pathname = usePathname();
  if (pathname === "/join" || pathname.startsWith("/family/setup") || pathname === "/install") return null;

  return (
    <nav className="mobile-app-dock" aria-label="AdrianOS navigation">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            href={item.href}
            key={item.href}
            className="mobile-app-dock-link"
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true" className="mobile-app-dock-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
