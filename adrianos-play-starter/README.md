# AdrianOS Learning

A parent-managed learning playground built with Next.js. It includes educational games, School Mode, multiple child profiles, parent reporting, optional Supabase cloud sync, structured family-beta feedback, and an installable family-device experience.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Useful routes:

- `/join` — shareable family beta landing page
- `/join?cohort=adrian-2nd-grade` — Adrian’s 2nd grade share link
- `/join?cohort=piedmont-families` — Piedmont families share link
- `/family/setup?local=1` — local-only family profile setup
- `/install` — iPhone, Android, and computer installation guide
- `/school` — child School Mode
- `/parent` — parent dashboard

## Deploy

1. Import this repository into Vercel.
2. Set the project root to `adrianos-play-starter`.
3. Add the Supabase environment variables when cloud accounts are enabled.
4. Connect a custom domain when ready.

## Supabase family accounts

Run `supabase/family-beta.sql` in the Supabase SQL editor. It creates or updates:

- `adrianos_family_snapshots` for per-parent family progress
- `adrianos_beta_feedback` for signed-in parent feedback
- row-level security policies limiting every row to `auth.uid() = user_id`

Add these Vercel environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

In Supabase Auth:

1. Enable the Google provider and add its Google OAuth client credentials.
2. Add the production origin and `/family/setup` callback destination to the allowed redirect URLs.
3. Keep email OTP enabled when parent magic-link sign-in should remain available.

The parent authenticates. Child profiles never require their own email or Google account. The setup-pending guard prevents the built-in demo family from syncing into a brand-new parent account before onboarding is completed.

## Family beta behavior

- One authenticated parent account owns one family snapshot.
- A family can contain multiple child profiles.
- The active child can be switched from the home or School Mode screens.
- Progress is stored locally first and synchronizes across signed-in computers and phones.
- A returning family on a new device restores the existing cloud snapshot automatically after Google sign-in.
- A new family receives a blank profile form instead of the Adrian/Elliot starter profiles.
- Share-link cohort tags are stored locally and attached to parent feedback.
- The global Parent feedback launcher records rating, category, message, child profile, cohort, page, and device context for signed-in households.

## Installable family app

- `app/manifest.ts` launches installed copies directly into School Mode.
- `/install` detects iPhone/iPad, Android, or desktop and gives platform-specific instructions.
- The active child remains device-local, so the installed app resumes the most recently selected learner.
- `public/sw.js` caches the app shell and previously visited same-origin pages and assets.
- The service worker skips API, auth, Supabase, and all cross-origin traffic.
- `/offline` explains which actions still require a connection.
- Generated 192px, 512px, and Apple touch icons are validated in browser QA.

## Production Google OAuth smoke

`.github/workflows/production-auth-smoke.yml` runs after every successful `main` build. It opens the production `/join` page, presses Continue with Google, and verifies:

- the production Google button is enabled
- the browser reaches `accounts.google.com`
- a nonempty Google `client_id` is present
- the OAuth request contains the Supabase `/auth/v1/callback`
- Google does not show `redirect_uri_mismatch` or Error 400

The smoke stops before entering credentials and uploads a screenshot if verification fails.

## Add a new game

1. Create a route, for example:

```text
app/games/spelling-sprint/page.tsx
```

2. Add its metadata to `lib/games.ts`.
3. Keep game controls large and touch-friendly.
4. Use the shared game-session completion layer so School Mode and family progress receive a verified completion.
5. Add a deterministic Playwright completion recipe when the game can be automated safely.

## Product roadmap

- Broader game-session SDK migration
- Adaptive difficulty and mastery recommendations
- Parent-controlled cohort and classroom sharing
