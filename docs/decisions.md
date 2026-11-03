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

## 2026-11-02 - Sign-in: Google or emailed link, no password

Nick chose an emailed sign-in link over a password mechanism ("happy with an
email link", 2 Nov 2026). The sign-in page offers Continue with Google
(Supabase OAuth, redirecting back to the current origin) and Continue with
email (Supabase magic link). Supabase Auth holds the accounts; the app only
ever sees the publishable key. Saved plans remain in browser localStorage,
not a server-side saved_plans table. The sign-in gate is a product UI gate,
not data access control; generated demo plans are computed in the browser.
Server-side storage would need its own row-level security before use.

## 2026-11-02 - Sign-in gate uses real auth; demo bypass removed

The earlier gate collected a name, email and company and announced "Signed
in for this demo - no account created". Once real sign-in shipped that copy
became misleading, so the gate now offers the same two real sign-in options
as the sign-in page, and a signed-in user skips the gate entirely. The demo
gate was lead capture, not authentication; account auth replaces it rather
than being equated with it.

## 2026-11-02 - Brief and plan survive the sign-in round trip

Signing in navigates away (Google) or reloads (email link), which would drop
the in-progress brief and generated plan. Starting either flow stashes a
snapshot in localStorage, restored when the user lands back signed in. The
snapshot expires after an hour and never leaves the device.

## 2026-11-02 - Redirect URLs kept exact, per environment

Supabase redirect URLs list only the production origin and localhost for
development; each PR preview adds its own exact origin when its wiring
preview exists. No wildcard preview entry. The Google OAuth consent screen
stays in Testing (only Nick's account can sign in) until Nick chooses to
publish; publishing needs no Google verification because the app uses only
the pre-filled non-sensitive Sign-In scopes.


## 2026-11-02 - Current email and password implementation

This branch supersedes the earlier magic-link implementation above: the
email controls now use password sign-in, account creation, verification
email and password-reset email, alongside Google sign-in. Verification and
recovery callbacks can reload the page, so the browser-local draft snapshot
remains necessary. The gate offers these same account flows plus profile
completion. These are implementation notes for this unmerged branch, not a
claim that the earlier product decision or production site has changed.

## 2026-11-03 - Bind unfinished auth drafts to an account or originating flow

Unfinished planner state is no longer handed to the next account using the
same browser. An account transition stashes the prior account's unfinished
work under its account ID and clears visible planner state. That account
can resume its own work after logging in again. Anonymous email attempts
are bound to the first submitted address; changing the address does not
relabel the previous attempt's draft. Google redirects use an originating
tab's one-time flow token, not an email-bound draft. Legacy ownerless
snapshots are not restored. Drafts expire after an hour. The existing
browser-wide demo saved-plan list is unchanged and is not account storage.

## 2026-11-03 - Readable PR evidence

Post one readable screenshot per PR comment. Do not combine screenshot
proof into a composite or a grouped comment; Nick found that hard to read.
