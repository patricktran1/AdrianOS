"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ParentCommandCenter from "@/components/ParentCommandCenter";
import type { Game } from "@/lib/games";

function clickVisibleTool(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((item) => {
      const text = item.textContent?.trim() ?? "";
      return item.offsetParent !== null && text !== label && text.includes(label);
    });
  button?.click();
}

export default function ParentCommandCenterPortal({ games }: { games: Game[] }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem("adrianos-parent-unlocked") !== "yes") return;
    let mountedNode: HTMLDivElement | null = null;

    const mount = () => {
      const main = document.querySelector("main");
      const header = main?.querySelector("header");
      if (!main || !header) return false;

      const existing = main.querySelector<HTMLDivElement>("[data-parent-command-center-host]");
      if (existing) {
        setHost(existing);
        return true;
      }

      const node = document.createElement("div");
      node.dataset.parentCommandCenterHost = "true";
      header.insertAdjacentElement("afterend", node);
      mountedNode = node;
      setHost(node);
      return true;
    };

    const bridgeShortcuts = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      const label = button?.textContent?.trim();
      if (label === "Weekly report") window.setTimeout(() => clickVisibleTool("Weekly report"), 0);
      if (label === "Adjust learning goals →") window.setTimeout(() => clickVisibleTool("Skill goals"), 0);
    };
    document.addEventListener("click", bridgeShortcuts);

    if (mount()) {
      return () => {
        document.removeEventListener("click", bridgeShortcuts);
        mountedNode?.remove();
      };
    }

    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", bridgeShortcuts);
      observer.disconnect();
      mountedNode?.remove();
    };
  }, []);

  return host ? createPortal(<ParentCommandCenter games={games} />, host) : null;
}
