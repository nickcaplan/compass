# Compass concept demo

A static, clickable walkthrough of the Compass front end: the media planning
tool proposed by The Hybrid House (THH) for life sciences marketers.

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

## Deploy

Designed to deploy as a Render static site: build command `npm run build`,
publish directory `dist`.

## Layout

- `src/App.tsx` - the four-state walkthrough (explainer, brief building,
  generating, recommended plan)
- `src/data.ts` - taxonomy from the brief and the illustrative plan content
- `src/styles.css` - the approved dark premium design in THH's brand
- `docs/project-brief.md` - what this demo is and is not
- `docs/decisions.md` - design and technical decisions with reasons
