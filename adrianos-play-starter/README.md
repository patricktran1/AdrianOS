# AdrianOS Play

A child-friendly game portal built with Next.js. It ships with playable sample games.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

1. Create a GitHub repository and upload this folder.
2. Import the repository into Vercel.
3. Vercel will build and publish it automatically.
4. Connect a custom domain when ready.

## Add a new game

1. Create a route, for example:

```text
app/games/spelling-sprint/page.tsx
```

2. Add its metadata to `lib/games.ts`.
3. Keep game controls large, touch-friendly, and provide a clear Home button.
4. Save lightweight progress in `localStorage`. Add Supabase later only when cross-device accounts are needed.

## Bring in an existing standalone game

Best option: move its React components into a route under `app/games/`.

Temporary option: host the old game separately and change its entry in `lib/games.ts` to an external URL, then launch it from the portal.

## Product roadmap

- Phase 1: game shelf, local progress, PWA installability
- Phase 2: parent PIN, profiles, progress dashboard
- Phase 3: adaptive difficulty, rewards, game-builder workflow
