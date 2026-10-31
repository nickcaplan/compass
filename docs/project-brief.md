# Compass concept demo - project brief

## Purpose

A persuasive, clickable front-end demonstration of Compass, The Hybrid
House's proposed media planning tool for life sciences marketers. It exists
to show Ben Portnoi what the product feels like before any real build is
committed to.

## What it is

- A single-page front end: the user answers a short brief (objective, KPI,
  audience, seniority, budget, campaign dates) and Compass shows a
  recommended media plan on the right.
- Four states, matching the approved design: an explainer before anything is
  answered, "your brief so far" while answering, a generating state that
  recaps the brief, and the recommended plan.
- The plan view shows summary metrics, per-activity spend, expected delivery
  and efficiency, a one-line rationale per choice, suggested timing, and the
  "speak to a Hybrid House specialist" call to action from the brief.
- Objectives, KPIs, audiences and seniority levels come from the Compass
  brief's own taxonomy. KPI options follow the selected objective, as the
  brief requires.
- Metrics shown adapt to the objective (awareness shows reach and
  impressions; consideration shows engagements; performance shows leads and
  CPL), as the brief requires.

## What it is not

- Not connected to any backend, database or real data. No real publisher
  rates, audience sizes or benchmarks appear anywhere.
- Publishers are anonymised (Publisher A, B, C) and every figure is marked
  illustrative on screen.
- Save plan, Download PDF, Speak to a specialist, Sign in, My plans and
  Support are visual affordances only; clicking them says they are part of
  the full product.

## Requirements

- Static build deployable to Render as a static site.
- Works on desktop and mobile; readable at 200% text zoom.
- THH brand: Poppins and Roboto, THH yellow, the real THH logo.
- The plan content scales sensibly when the budget or dates change, and stays
  internally consistent (spend adds up to the budget entered).
