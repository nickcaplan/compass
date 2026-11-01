# Compass concept demo

A static front-end demo of Compass, the media planning tool proposed by The
Hybrid House (THH) for life sciences marketers. Fill in a brief, get an
illustrative recommended plan, and save plans in your browser.

This is a concept demo only. Every figure, publisher name and rationale on
screen is illustrative, adapted from the example scenario in the Compass
brief. There is no backend, no database and no real rate or audience data.

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

## Test

```
npm test
```

Builds the app first (`pretest`), then runs the Vitest unit tests for the
plan-generation logic (`test:unit`) and the browser regression tests against
the built app (`test:browser`).

## Deploy

Designed to deploy as a Render static site: build command `npm run build`,
publish directory `dist`. Production: https://compass-demo.websitesbynick.co.uk/

## Layout

- `src/App.tsx` - the planner flow (explainer, brief building, generating,
  recommended plan), the My plans page (save, reopen, edit and delete plans
  in this browser's localStorage) and the sign-in preview
- `src/data.ts` - taxonomy from the brief and the illustrative plan content
- `src/styles.css` - the approved dark premium design in THH's brand
- `docs/project-brief.md` - what this demo is and is not
- `docs/decisions.md` - design and technical decisions with reasons
