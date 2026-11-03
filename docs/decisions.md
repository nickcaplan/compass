# Decisions

## 2026-10-31 - Repository is private

The repo touches a client's commercial project, so it is private under
nickcaplan. No real rates or customer data are held here regardless; the
demo's content is illustrative.

## 2026-10-31 - React + Vite + TypeScript, static build

Matches the agreed system design (private briefing doc, 31 Oct 2026): the
front end is React/Vite static files; the backend, PostgreSQL database and
PDF worker arrive with the prototype. This repo contains only the front end.

## 2026-10-31 - Render for hosting

Nick chose Render on 31 Oct 2026. The demo deploys as a Render static site
(free tier); the later backend and managed PostgreSQL can live on the same
platform, so nothing needs rewiring. The same static build can move hosts if
that changes.

## 2026-10-31 - Illustrative figures scale linearly from the brief's example

The brief's example scenario is Performance / Lead generation / Procurement /
Manager + Director / GBP 100,000 / 12 weeks. When the demo user enters a
different budget, plan figures scale linearly from that reference so the plan
always reconciles with the brief entered. This is deliberately simple and
labelled illustrative on screen; the real planning engine is a later step
with its own correctness tests.

## 2026-10-31 - Inert actions say so

Save plan, Download PDF, Speak to a specialist, Sign in, My plans and Support
show a note that they are part of the full product. This keeps the demo
honest: nothing implies a working backend that does not exist.

## 2026-10-31 - Four seniority levels from the brief

The mockups showed three; the brief (section 7) lists four: Technician /
Practitioner, Manager, Senior Manager / Head, Director / Executive. The demo
implements the brief's four.

## 2026-10-31 - Objective, KPI and audience are multi-select

A campaign brief can span several objectives, KPIs and audiences, so those
fields are multi-select. KPI options are the union of the selected
objectives' KPIs; deselecting an objective drops only the KPIs that no
remaining objective offers, and re-selecting does not restore them silently.
When several objectives are selected the plan composes one illustrative set
of activities from all of them, deduplicated, with the budget re-split so
spends still sum exactly to the entered budget; headline metrics are the
union of each objective's highlighted figures. Selection order carries no
priority.

## 2026-10-31 - Campaign dates must not be in the past

Campaign dates must be in the future: the start date is tomorrow onward (in
the visitor's local calendar) and the end date no earlier than the start.
Anything earlier shows a warning and the brief does not count as ready.

## 2026-10-31 - Light and dark themes, toggle remembered

Nick asked for a light mode alongside the approved dark design. Both themes
are CSS-variable themes on the same markup; the nav toggle switches them and
the choice is remembered in localStorage (dark stays the default, matching
the approved design). The THH logo asset is white, so it is inverted in
light mode.

## 2026-10-31 - Priority audiences first, rest under "Show more"

Nick asked for the most important audiences first with a Show more. The
brief (section 6) lists the taxonomy without ranking it, so the
first-visible pair is the source-grounded proposal Nick approved on
31 Oct 2026: Procurement (the brief's worked-example audience) and
Laboratory Manager (the other half of the prototype's first audience slice
in the project notes). Selected options stay visible when the list is
collapsed. The pair lives in PRIMARY_AUDIENCES so THH can reorder it when
they supply the final taxonomy.

## 2026-10-31 - Visible calendar icons on the date fields

The native date-input picker indicator is invisible against the dark theme
and varies by browser, so each date field gets its own always-visible
calendar button that opens the native picker (showPicker, focus fallback).
Dates stack vertically on small screens so the fields never clip.

## 2026-11-03 - Market brief selection

Nick's edited combined-feedback document places Market between Objective and
KPI. His authenticated3November14:42/14:58 clarification selects North America,
UK, France and Germany, excluding Europe, and allows multiple choices. Stable
IDs keep the taxonomy extensible. Selection is stored with the brief and shown
in generated and saved summaries. Existing plans have no inferred region and
show Not specified. This standalone demo addition does not impose a new hidden
generation gate. A market requirement and real regional inventory matching can
be addressed with the inventory integration, not invented in this change.

The current concept uses illustrative Publisher A/B/C forecasts, not the master
workbook's real inventory. Market selection records intent only; the form says
forecasts do not change by market. No UK/France/Germany inventory eligibility or
regional cost/coverage is implied. No source document, provider setting or
external account was changed.
