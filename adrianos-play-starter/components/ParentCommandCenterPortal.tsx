"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ParentCommandCenter from "@/components/ParentCommandCenter";
import type { Game } from "@/lib/games";

export default function ParentCommandCenterPortal({ games }: { games: Game[] }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem("adrianos-parent-unlocked") !== "yes") return;
    const main = document.querySelector("main");
    const header = main?.querySelector("header");
    if (!main || !header) return;

    const existing = main.querySelector<HTMLDivElement>("[data-parent-command-center-host]");
    if (existing) {
      setHost(existing);
      return;
    }

    const node = document.createElement("div");
    node.dataset.parentCommandCenterHost = "true";
    header.insertAdjacentElement("afterend", node);
    setHost(node);

    return () => node.remove();
  }, []);

  return host ? createPortal(<ParentCommandCenter games={games} />, host) : null;
}
