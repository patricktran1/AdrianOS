"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  beginGoogleFamilySignIn,
  clearFamilySetupPending,
  finishFamilyCloudSetup,
  inspectFamilyCloudAccount,
  restoreExistingFamily,
} from "@/lib/family-beta-account";
import {
  currentFamilyDrafts,
  isStarterFamilyState,
  replaceFamilyChildren,
  type FamilyChildDraft,
} from "@/lib/family-profile-admin";
import { GRADE_OPTIONS, inferredGradeForAge } from "@/lib/adrian-profile-grade";
import {
  LEARNER_INTERESTS,
  LEARNING_PRIORITIES,
  SESSION_LENGTHS,
  type LearnerInterest,
  type LearningPriority,
} from "@/lib/adrian-learning-profile";
import { isSupabaseConfigured } from "@/lib/supabase-browser";
import "@/app/family-beta.css";

function emptyChild(emoji = "⭐"): FamilyChildDraft {
  return {
    name: "",
    age: 7,
    grade: 2,
    emoji,
    interests: [],
    priorities: ["Math", "Reading"],
    sessionMinutes: 12,
  };
}

type Phase = "checking" | "signed-out" | "editing" | "restoring" | "saving" | "error";

function starterDrafts(manage: boolean): FamilyChildDraft[] {
  const current = currentFamilyDrafts();
  if (current.length > 0 && (manage || !isStarterFamilyState())) return current;
  return [emptyChild()];
}

export default function FamilySetup() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [drafts, setDrafts] = useState<FamilyChildDraft[]>([emptyChild()]);
  const [message, setMessage] = useState("Checking the family account…");
  const [email, setEmail] = useState<string | null>(null);
  const [cloudAccount, setCloudAccount] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [parentConfirmed, setParentConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const params = new URLSearchParams(window.location.search);
      const localOnly = params.get("local") === "1";
      const manage = params.get("manage") === "1";
      setManageMode(manage);

      if (localOnly || !isSupabaseConfigured()) {
        if (cancelled) return;
        setCloudAccount(false);
        setDrafts(starterDrafts(manage));
        setMessage(localOnly
          ? "Profiles will stay on this device until a parent connects a cloud account."
          : "Cloud accounts are not configured here, so this setup will remain on this device.");
        setPhase("editing");
        return;
      }

      const inspection = await inspectFamilyCloudAccount();
      if (cancelled) return;
      setEmail(inspection.email);
      setMessage(inspection.message);

      if (inspection.state === "signed-out") {
        setPhase("signed-out");
        return;
      }
      if (inspection.state === "error") {
        setPhase("error");
        return;
      }
      if (inspection.state === "not-configured") {
        setCloudAccount(false);
        setDrafts(starterDrafts(manage));
        setPhase("editing");
        return;
      }
      if (inspection.state === "existing-family") {
        setCloudAccount(true);
        setPhase("restoring");
        const restored = await restoreExistingFamily();
        if (cancelled) return;
        if (!restored.ok) {
          setMessage(restored.message);
          setPhase("error");
          return;
        }
        if (manage) {
          setDrafts(starterDrafts(true));
          setMessage("Family learning is synced. Edit each learner’s profile below.");
          setPhase("editing");
        } else {
          router.replace("/school");
        }
        return;
      }

      setCloudAccount(true);
      setDrafts(starterDrafts(manage));
      setPhase("editing");
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function updateDraft(index: number, change: Partial<FamilyChildDraft>) {
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, ...change } : draft
    )));
  }

  function updateAge(index: number, age: number) {
    updateDraft(index, { age, grade: inferredGradeForAge(age) });
  }

  function toggleInterest(index: number, interest: LearnerInterest) {
    const current = drafts[index]?.interests ?? [];
    updateDraft(index, {
      interests: current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    });
  }

  function togglePriority(index: number, priority: LearningPriority) {
    const current = drafts[index]?.priorities ?? [];
    if (!current.includes(priority) && current.length >= 3) {
      setMessage("Choose up to three learning priorities per child.");
      return;
    }
    updateDraft(index, {
      priorities: current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority],
    });
  }

  function addChild() {
    setDrafts((current) => [...current, emptyChild(current.length % 2 ? "🦖" : "🚀")]);
  }

  function removeChild(index: number) {
    setDrafts((current) => current.length === 1 ? current : current.filter((_, draftIndex) => draftIndex !== index));
  }

  async function signIn() {
    setMessage("Opening Google sign-in…");
    const result = await beginGoogleFamilySignIn();
    setMessage(result.message);
    if (!result.ok) setPhase("error");
  }

  async function saveFamily() {
    if (drafts.some((draft) => !draft.name.trim())) {
      setMessage("Give each child profile a name before continuing.");
      return;
    }
    if (!manageMode && !parentConfirmed) {
      setMessage("Please confirm that you are the parent, guardian, or have permission to create these profiles.");
      return;
    }

    setPhase("saving");
    setMessage("Building each learner’s personalized starting route…");
    try {
      replaceFamilyChildren(drafts);
      if (cloudAccount) {
        const result = await finishFamilyCloudSetup();
        setMessage(result.message);
        if (!result.ok) {
          setPhase("editing");
          return;
        }
      } else {
        clearFamilySetupPending();
      }
      router.push("/school");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The family profiles could not be saved.");
      setPhase("editing");
    }
  }

  return (
    <main className="family-setup-page">
      <div className="family-setup-shell">
        <header className="family-setup-header">
          <div>
            <span className="family-beta-eyebrow">PARENT-MANAGED LEARNER PROFILES</span>
            <h1>{manageMode ? "Tune each learning path." : "Who is learning?"}</h1>
            <p>
              Create one private profile per child. Age controls developmental fit, grade selects curriculum goals,
              and interests plus parent priorities shape the daily route.
            </p>
          </div>
          <Link href={manageMode ? "/parent" : "/"} className="family-beta-secondary">
            {manageMode ? "Back to Parent Mode" : "Back home"}
          </Link>
        </header>

        <section className="family-setup-card">
          {email && (
            <div className="family-setup-account">
              <span><strong>Parent account</strong><br /><small>{email}</small></span>
              <span className="family-beta-chip">CLOUD SYNC ON</span>
            </div>
          )}

          {(phase === "checking" || phase === "restoring") && (
            <div className="family-setup-status">{message}</div>
          )}

          {phase === "signed-out" && (
            <div>
              <div className="family-setup-status">{message}</div>
              <div className="family-setup-toolbar">
                <button type="button" className="family-setup-primary" onClick={() => void signIn()}>Continue with Google</button>
                <Link href="/family/setup?local=1" className="family-setup-secondary">Continue on this device only</Link>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div>
              <div className="family-setup-status">{message}</div>
              <div className="family-setup-toolbar">
                <button type="button" className="family-setup-primary" onClick={() => window.location.reload()}>Try again</button>
                <Link href="/family/setup?local=1" className="family-setup-secondary">Use local setup</Link>
              </div>
            </div>
          )}

          {(phase === "editing" || phase === "saving") && (
            <>
              <div className="family-setup-account">
                <span>
                  <strong>{cloudAccount ? "Synced learner profiles" : "Profiles on this device"}</strong><br />
                  <small>{message}</small>
                </span>
                <span className="family-beta-chip">{drafts.length} LEARNER{drafts.length === 1 ? "" : "S"}</span>
              </div>

              <div className="family-setup-grid">
                {drafts.map((draft, index) => (
                  <div className="family-child-card" key={draft.id ?? `new-${index}`}>
                    <input
                      className="family-child-emoji"
                      aria-label={`Child ${index + 1} emoji`}
                      value={draft.emoji}
                      maxLength={8}
                      onChange={(event) => updateDraft(index, { emoji: event.target.value })}
                    />
                    <input
                      aria-label={`Child ${index + 1} name`}
                      value={draft.name}
                      placeholder="Child’s first name"
                      maxLength={24}
                      onChange={(event) => updateDraft(index, { name: event.target.value })}
                    />
                    <select
                      aria-label={`Child ${index + 1} age`}
                      value={draft.age}
                      onChange={(event) => updateAge(index, Number(event.target.value))}
                    >
                      {Array.from({ length: 16 }, (_, ageIndex) => ageIndex + 3).map((age) => (
                        <option value={age} key={age}>Age {age}</option>
                      ))}
                    </select>
                    <select
                      aria-label={`Child ${index + 1} learning grade`}
                      value={draft.grade}
                      onChange={(event) => updateDraft(index, { grade: Number(event.target.value) })}
                    >
                      {GRADE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>

                    <div className="family-child-personalization">
                      <fieldset className="family-choice-group">
                        <legend>What does {draft.name.trim() || "this learner"} love?</legend>
                        <small>Interest picks make practice more inviting. Choose any that fit.</small>
                        <div className="family-choice-chips">
                          {LEARNER_INTERESTS.map((interest) => (
                            <button
                              key={interest}
                              type="button"
                              aria-pressed={draft.interests.includes(interest)}
                              className={draft.interests.includes(interest) ? "family-choice-chip active" : "family-choice-chip"}
                              onClick={() => toggleInterest(index, interest)}
                            >
                              {interest}
                            </button>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset className="family-choice-group">
                        <legend>What should AdrianOS strengthen?</legend>
                        <small>Choose up to three parent priorities. Grade-level needs and missed work still come first.</small>
                        <div className="family-choice-chips">
                          {LEARNING_PRIORITIES.map((priority) => (
                            <button
                              key={priority}
                              type="button"
                              aria-pressed={draft.priorities.includes(priority)}
                              className={draft.priorities.includes(priority) ? "family-choice-chip active" : "family-choice-chip"}
                              onClick={() => togglePriority(index, priority)}
                            >
                              {priority}
                            </button>
                          ))}
                        </div>
                      </fieldset>

                      <label className="family-session-length">
                        <span><strong>Daily guided session</strong><small>Parents can change the weekly schedule later.</small></span>
                        <select
                          aria-label={`Child ${index + 1} daily session length`}
                          value={draft.sessionMinutes}
                          onChange={(event) => updateDraft(index, { sessionMinutes: Number(event.target.value) as 8 | 12 | 18 })}
                        >
                          {SESSION_LENGTHS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="family-setup-danger"
                      disabled={drafts.length === 1}
                      onClick={() => removeChild(index)}
                    >
                      Remove learner
                    </button>
                  </div>
                ))}
              </div>

              <div className="family-setup-toolbar">
                <button type="button" className="family-setup-secondary" onClick={addChild}>+ Add another learner</button>
              </div>

              {!manageMode && (
                <label className="family-setup-consent">
                  <input
                    type="checkbox"
                    checked={parentConfirmed}
                    onChange={(event) => setParentConfirmed(event.target.checked)}
                  />
                  <span>I am the parent or guardian, or I have permission to create these child profiles and use this family beta.</span>
                </label>
              )}

              <div className="family-setup-toolbar">
                <button
                  type="button"
                  className="family-setup-primary"
                  disabled={phase === "saving"}
                  onClick={() => void saveFamily()}
                >
                  {phase === "saving" ? "Building learning routes…" : manageMode ? "Save learner profiles" : "Create family and personalize School Mode"}
                </button>
              </div>
              <p className="family-setup-muted">Children do not receive accounts or provide email addresses. The parent controls profiles, learning priorities, grade selection, and cloud access.</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
