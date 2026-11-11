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

- No real publisher rates, audience sizes or benchmarks appear anywhere.
  Publishers are anonymised (Publisher A, B, C) and every figure is marked
  illustrative on screen.
- Saved plans do persist, in the visitor's own browser. A Supabase
  backend (sign-in and plan sync) is in progress on separate branches.
- Speak to a specialist opens the Hybrid House contact page. Saved-plan Download PDF exports a print-ready report in a light theme, including the full brief, metrics, publisher allocations, explanations, timing and illustrative-data note. Rendering is local in the browser; no campaign data is uploaded. The generated unsaved plan still shows a coming-soon note. Support is no longer in the navigation.

## Requirements

- Static build deployable to Render as a static site.
- Works on desktop and mobile; readable at 200% text zoom.
- THH brand: Poppins and Roboto, THH yellow, the real THH logo.
- The plan content scales sensibly when the budget or dates change, and stays
  internally consistent (spend adds up to the budget entered).

## Style and review requirements

- Use ordinary ASCII hyphens for prose dashes, not en dashes or em dashes (confirmed 31 October 2026).
- Match objective/KPI colours across Planner and My plans, keep ordinary saved-card metadata neutral and use red for destructive Delete confirmation. Active cards have equal Edit/Open actions; expired plans are read-only. Save success stays with the action, and missing Regenerate answers are explained beside it. Detailed decisions and source PRs are in [decisions.md](decisions.md).
- Before calling a visible change ready, inspect hosted phone/desktop, light/dark and enlarged-text states. Make separate whole-journey and whole-page passes: controls, repeated actions, loading/errors, then hierarchy, spacing, readability and consistency. Passing tests or finding no overlap is not a design verdict (confirmed 5 November 2026).
- Check performance after changes (confirmed 2 November 2026). For loading or animation changes, compare like-for-like phone/desktop cold/warm measurements before and after, flag measured slowdowns before merge and check production after deployment. A missing baseline is unmeasured, not zero impact.
