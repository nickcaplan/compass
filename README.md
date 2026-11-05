# Compass concept demo

A static, clickable walkthrough of the Compass front end: the media planning
tool proposed by The Hybrid House (THH) for life sciences marketers.

Every figure, publisher name and rationale on screen is illustrative,
adapted from the example scenario in the Compass brief; there is no real
rate or audience data. Saved plans persist in the visitor's own browser;
a Supabase backend (sign-in and plan sync) is in progress on separate
branches.

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

## Tests

```
npm test
```

Builds the app, then runs the browser-level regression tests (node:test +
puppeteer against a local preview of the build). CI runs lint, build and
these tests on every pull request and push to main.

## Deploy

Deploys as a Render static site: build command `npm run build`, publish
directory `dist`. The production demo serves the main branch at
https://compass-demo.websitesbynick.co.uk/ behind Cloudflare.

## Layout

- `src/App.tsx` - the four-state walkthrough (explainer, brief building,
  generating, recommended plan)
- `src/data.ts` - taxonomy from the brief and the illustrative plan content
- `src/styles.css` - the approved dark premium design in THH's brand
- `docs/project-brief.md` - what this demo is and is not
- `docs/decisions.md` - design and technical decisions with reasons
