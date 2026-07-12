"use client";

import Link from "next/link";
import { useCloudSyncStatus } from "@/lib/adrian-cloud-sync";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import "@/app/family-beta.css";

export default function FamilyProfileBar() {
  const { family, activeProfile, switchProfile, hydrated } = useFamilyProfiles();
  const cloud = useCloudSyncStatus();

  if (!hydrated) return null;

  const manageHref = cloud.userEmail
    ? "/family/setup?manage=1"
    : "/family/setup?manage=1&local=1";

  return (
    <section className="family-profile-bar" aria-label="Choose child profile">
      <div className="family-profile-list">
        {family.profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={`family-profile-button${profile.id === activeProfile.id ? " active" : ""}`}
            onClick={() => switchProfile(profile.id)}
          >
            <span>{profile.emoji}</span>
            <span>{profile.name}</span>
          </button>
        ))}
      </div>
      <div className="family-profile-actions">
        <small style={{ color: "#8f99a8" }}>
          {cloud.userEmail ? `Synced to ${cloud.userEmail}` : "Progress saved on this device"}
        </small>
        <Link href={manageHref}>Manage children</Link>
        {!cloud.userEmail && <Link href="/join">Connect family</Link>}
      </div>
    </section>
  );
}
