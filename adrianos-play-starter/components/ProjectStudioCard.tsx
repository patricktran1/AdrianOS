"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  ensureWeeklyProject,
  getProjectTemplate,
  PROJECT_STUDIO_EVENT,
  type ProjectWork,
} from "@/lib/adrian-projects";

export default function ProjectStudioCard() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [project, setProject] = useState<ProjectWork | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => setProject(ensureWeeklyProject(activeProfile));
    refresh();
    window.addEventListener(PROJECT_STUDIO_EVENT, refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(PROJECT_STUDIO_EVENT, refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [activeProfile.id, activeProfile.age, hydrated]);

  if (!hydrated || !project) return null;
  const template = getProjectTemplate(project.templateId);
  if (!template) return null;
  const complete = Boolean(project.completedAt);

  return (
    <section style={shell}>
      <div style={icon}>{template.emoji}</div>
      <div style={{ minWidth: 0 }}>
        <span style={eyebrow}>THIS WEEK’S PROJECT</span>
        <h2 style={title}>{project.projectName || template.title}</h2>
        <p style={muted}>
          {complete
            ? "Finished and saved in the learning portfolio."
            : `${template.subjects.join(" · ")} · about ${template.minutes} minutes · stage ${project.currentStep + 1} of 3`}
        </p>
      </div>
      <Link href="/projects" style={{ ...button, background: complete ? "#c6b8ff" : "#d9ff5b" }}>
        {complete ? "View project →" : project.startedAt ? "Resume project →" : "Start project →"}
      </Link>
    </section>
  );
}

const shell: React.CSSProperties = { maxWidth: 1040, margin: "16px auto", display: "grid", gridTemplateColumns: "72px minmax(0,1fr) auto", gap: 18, alignItems: "center", padding: "clamp(20px,4vw,28px)", borderRadius: 28, border: "1px solid rgba(217,255,91,.26)", background: "linear-gradient(145deg,rgba(217,255,91,.08),rgba(198,184,255,.06),#181d28)", boxShadow: "0 24px 58px rgba(0,0,0,.22)" };
const icon: React.CSSProperties = { width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: 20, background: "#222936", fontSize: 38 };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 10, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0", fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-.045em" };
const muted: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5 };
const button: React.CSSProperties = { padding: "14px 19px", borderRadius: 999, color: "#10131b", textDecoration: "none", fontWeight: 950, whiteSpace: "nowrap" };
