# Compass concept demo - project brief

## Project documents

The working documents for the whole Compass project live in a private Google
Drive folder and are indexed here:

- Project index: https://docs.google.com/document/d/1AxIJQ0wwsJ8aiEFrk5BXLz2ARhlFCnNTVGNg1j7_vys/edit
- Brief: https://docs.google.com/document/d/11TrcImrvRGY03CLRB7jqCbyJVZTbc9KYpmeRhQAiVAM/edit
- Design direction: https://docs.google.com/document/d/1s84IaJ-uFHuIR_n8A9gVGknVRAoQVeJwKVAnSu4QW9Q/edit
- Architecture: https://docs.google.com/document/d/1-L6-FzQe1CaSF5dIZy05Ch8wP_2M3MvpgXdXUkw9aks/edit
- Build plan: https://docs.google.com/document/d/1Ljd8xueDF51b8Jz6FqpMrOerOtrNW-mDXiuhfSEsII4/edit

## Purpose

A persuasive, clickable front-end demonstration of Compass, The Hybrid
House's proposed media planning tool for life sciences marketers. It exists
to show Ben Portnoi what the product feels like before any real build is
committed to.

## What it is

- A single-page front end: the user answers a short brief (objective, KPI,
  audience, budget, campaign dates) and Compass shows a
  recommended media plan on the right.
- Four states, matching the approved design: an explainer before anything is
  answered, "your brief so far" while answering, a generating state that
  recaps the brief, and the recommended plan.
- The plan view shows summary metrics, per-activity spend, expected delivery
  and efficiency, a one-line rationale per choice, suggested timing, and the
  "speak to a Hybrid House specialist" call to action from the brief.
- Objectives, KPIs and audiences come from the Compass
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
