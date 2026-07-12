"use client";

import { useEffect } from "react";
import FamilySetup from "@/components/FamilySetup";
import { ELEMENTARY_AGE_OPTIONS } from "@/lib/adrian-elementary-scope";

const allowedAges = new Set(ELEMENTARY_AGE_OPTIONS.map(String));

function applyElementarySetupScope() {
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    'select[aria-label^="Child "][aria-label$=" age"]',
  )) {
    for (const option of Array.from(select.options)) {
      if (!allowedAges.has(option.value)) option.remove();
    }
    select.dataset.elementaryScope = "tk5";
    select.title = "AdrianOS supports elementary learners ages 4 through 11.";
  }

  const header = document.querySelector<HTMLElement>(".family-setup-header");
  if (header && !header.querySelector("[data-elementary-scope-note]")) {
    const note = document.createElement("div");
    note.dataset.elementaryScopeNote = "true";
    note.setAttribute("role", "note");
    note.textContent = "AdrianOS is intentionally focused on elementary learning: TK through Grade 5, typically ages 4–11.";
    Object.assign(note.style, {
      gridColumn: "1 / -1",
      padding: "12px 15px",
      borderRadius: "16px",
      border: "1px solid rgba(217,255,91,.28)",
      background: "rgba(217,255,91,.08)",
      color: "#d9ff5b",
      fontWeight: "850",
      lineHeight: "1.45",
    });
    header.appendChild(note);
  }
}

export default function ElementaryFamilySetup() {
  useEffect(() => {
    applyElementarySetupScope();
    const observer = new MutationObserver(applyElementarySetupScope);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <FamilySetup />;
}
