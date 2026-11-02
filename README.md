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

## Runtime

Use the Node version requested by CI (currently Node 22). The sample-plan branch
requires Node 22.13 or newer for its storage regression helper.

## Test

```
npm test
```

The browser suite uses `puppeteer-core` and requires Google Chrome installed at
`/usr/bin/google-chrome` on Linux or
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS.
CI uses the Chrome preinstalled on GitHub's Ubuntu runner. Other operating
systems or Chrome locations need the test executable path adjusted first.

Builds the app first (`pretest`), then runs the Vitest unit tests for the
plan-generation logic (`test:unit`) and the browser regression tests against
the built app (`test:browser`).

The unit suite covers the plan calculations. The browser suite covers selected
planner and saved-plan flows. A green suite is not a full UX or scope audit:
review phone/desktop, both themes, normal/loading/failure states and the original
request before calling a change complete. See `docs/project-brief.md` for the
separate outstanding previews and their limits.

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
