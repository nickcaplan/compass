# Compass concept demo

A static, clickable walkthrough of the Compass front end: the media planning
tool proposed by The Hybrid House (THH) for life sciences marketers.

This is a concept demo only. Every figure, publisher name and rationale on
screen is illustrative, adapted from the example scenario in the Compass
brief. There is no server-side planning engine or real rate or audience data.
This branch uses Supabase Auth for Google sign-in and email/password
accounts, including verification and password recovery. Name and optional
company are stored as account profile metadata. Plans and pending briefs
remain in this browser's localStorage, not in a server-side plans database.
Signing in does not sync plans across browsers or devices.

This is an unmerged authentication branch. Its capabilities and preview
configuration must not be read as the state of the production site.

## Run locally

```
npm install
npm run dev
```

## Build

```
npm run build
```

Outputs static files to `dist/`, deployable to any static host.

## Deploy

Designed to deploy as a Render static site: build command `npm run build`,
publish directory `dist`.

## Layout

- `src/App.tsx` - planner, browser-local saved plans, account/profile gate
  and refresh-safe navigation
- `src/EmailAuth.tsx` - email/password sign-in, signup and recovery
- `src/supabase.ts` - Supabase Auth client with a publishable browser key
- `src/data.ts` - taxonomy from the brief and the illustrative plan content
- `src/styles.css` - the approved dark premium design in THH's brand
- `docs/project-brief.md` - what this demo is and is not
- `docs/decisions.md` - design and technical decisions with reasons


## Authentication scope

Supabase holds accounts and profile metadata, not saved campaign plans.
The sign-in gate is a product UI gate, not protection for private plan data
on a server. A future server-side plan store would need its own access
controls. Authentication redirects and email delivery also depend on the
provider's settings for each deployed origin; a working local build alone
does not establish public sign-up readiness.
