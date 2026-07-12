"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { readBetaCohort } from "@/lib/beta-cohort";

const FEEDBACK_TABLE = "adrianos_beta_feedback";

export type BetaFeedbackCategory =
  | "signup"
  | "school-mode"
  | "game"
  | "progress"
  | "bug"
  | "idea"
  | "other";

export type BetaFeedbackInput = {
  rating: number;
  category: BetaFeedbackCategory;
  message: string;
  contactAllowed: boolean;
};

export type BetaFeedbackResult = {
  ok: boolean;
  requiresSignIn?: boolean;
  message: string;
};

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipod/.test(ua)) return "iphone";
  if (/ipad/.test(ua)) return "ipad";
  if (/android/.test(ua)) return "android";
  if (/macintosh|mac os x/.test(ua)) return "mac";
  if (/windows/.test(ua)) return "windows";
  return "other";
}

export async function submitBetaFeedback(input: BetaFeedbackInput): Promise<BetaFeedbackResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Cloud feedback is not configured on this deployment yet.",
    };
  }

  const message = input.message.trim();
  if (input.rating < 1 || input.rating > 5 || !message) {
    return { ok: false, message: "Choose a rating and add a short note." };
  }

  const client = getSupabaseBrowserClient();
  if (!client) return { ok: false, message: "Could not open the family account client." };

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) return { ok: false, message: sessionError.message };
  const session = sessionData.session;
  if (!session) {
    return {
      ok: false,
      requiresSignIn: true,
      message: "Sign in with the parent account to send this feedback.",
    };
  }

  const profile = getActiveProfile();
  const payload = {
    user_id: session.user.id,
    profile_id: profile.id,
    profile_name: profile.name,
    cohort: readBetaCohort(),
    rating: Math.round(input.rating),
    category: input.category,
    message: message.slice(0, 4000),
    contact_allowed: input.contactAllowed,
    page_path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    device: deviceLabel(),
    viewport_width: window.innerWidth,
    user_agent: navigator.userAgent.slice(0, 1000),
  };

  const { error } = await client.from(FEEDBACK_TABLE).insert(payload);
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Feedback sent. Thank you for helping shape AdrianOS." };
}
