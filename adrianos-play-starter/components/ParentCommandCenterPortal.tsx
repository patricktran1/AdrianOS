"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ParentCommandCenter from "@/components/ParentCommandCenter";
import type { Game } from "@/lib/games";

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

    if (mount()) return () => mountedNode?.remove();

    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mountedNode?.remove();
    };
  }, []);

  return host ? createPortal(<ParentCommandCenter games={games} />, host) : null;
}
