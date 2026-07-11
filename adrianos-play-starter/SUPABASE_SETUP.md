# AdrianOS Supabase Cloud Sync

The application code is already wired for local-first cloud sync. Complete these one-time project steps to activate it.

## 1. Create or select a Supabase project

In Supabase, copy the project URL and the publishable key from the project API settings.

## 2. Create the cloud table

Open the Supabase SQL editor and run:

`supabase/migrations/202607100001_adrianos_cloud_sync.sql`

This creates one JSON family snapshot per authenticated parent and enables Row Level Security so each account can only access its own row.

## 3. Configure authentication URLs

In Supabase Auth URL configuration, set the production site URL to:

`https://adrian-os-murex.vercel.app`

Add these redirect URLs:

- `https://adrian-os-murex.vercel.app/parent`
- `http://localhost:3000/parent`

Email magic-link authentication must be enabled.

## 4. Add Vercel environment variables

Add these variables to the AdrianOS Vercel project for Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Older Supabase projects may expose an anon key instead. The app also accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Redeploy after adding the variables.

## How syncing behaves

- The games always save locally first and continue to work offline.
- A parent signs in from `/parent` using an email magic link.
- Local changes sync automatically after game progress, profile changes, reconnecting, returning to the tab, and once per minute.
- A new device signs in with the same email and merges the cloud family snapshot into its local copy.
- Parent PIN hashes are intentionally not uploaded. Set a local parent PIN on each device.
- The existing download/restore backup remains available as a second safety net.
