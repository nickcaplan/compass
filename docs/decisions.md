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

## 2026-11-03 - Redirect configuration verified live

The earlier exact-origin-only description was incorrect. The live Supabase
allowlist has wildcard paths for production, localhost, preview26 and preview41.
Preview41 therefore covers the demo query redirect. Preview51 is absent and is
fixture-only evidence, not a validated real-auth return route. Real-auth checks
use preview41. No provider settings were changed by this correction.

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

## 2026-11-03 - Auth lifecycle follow-up

Only an OAuth-shaped callback with a fresh
provider token, no email/recovery type, Google provider metadata and the
originating tab's pending one-time flow may restore a Google draft. Email
callbacks invalidate a pending Google flow. Provider redirect URLs
are unchanged. An immediate Google-start failure keeps current work and
removes only its failed flow snapshot. Successful email login consumes its
matching snapshot even when current work stays in memory. Known expired
unfinished snapshots are removed during draft access/startup; the saved
plan store and unrecognized work are not touched.

## 2026-11-03 - Profile metadata does not own auth-session persistence

The SDK alone persists auth sessions. Profile saves use a captured bearer token,
check the active principal before applying a result in memory, and never write
captured session credentials to localStorage. Startup reads canonical metadata
with a captured token, guarded by account epoch and profile revision. Late reads
cannot undo a newer save or carry metadata into a replacement account. Lookup
failure retains the profile gate rather than inferring completion.

## 2026-11-03 - Preview-only canonical auth controller

This branch is an unmerged follow-up to the held auth/rate-limit work, not a
production rollout. Supabase remains the authentication service. Saved plans
and draft records keep their existing stores; this change never migrates or
clears them.

Auth persistence uses a new `compass-auth-v2` IndexedDB store. A transaction
advances the intent generation and every SDK storage adapter is permanently
bound to the generation that created it. Stale reads return null, stale writes
and removes reject inside the same transaction as their comparison. SDK events
and cross-tab notifications are hints to reread canonical state, not authority
to replace it. No SDK internals are patched. Callback links carry a one-use
binding to the original generation; missing, used or superseded bindings are
not adopted as fresh intent. Callback hydration publishes no intermediate UI
state. Secure-storage failure stops authentication with inline feedback.

Rollout, if separately approved, requires old Compass tabs to close/reload and
visitors to log in again. Legacy SDK tokens are not imported. Links created
before the rollout need reissuing. This branch does not change provider
settings, accounts, email templates, billing, or real user credentials.

Regression tests use only fixture credentials and intercepted provider
responses. Helpers in `tests/helpers` translate old test fixtures into the new
store, never production tokens. Inherited assertions on profile, drafts,
recovery, saved-plan lifecycle and inline errors remain. New controller tests
must not install that compatibility helper when proving legacy-token rejection.

Recovery mode is persisted only for the verified principal and intent generation,
so a reload keeps the reset form while a new intent or successful completion
removes that mode. The callback URL is cleaned even when verification fails.
Runtime storage failure is fail-closed until reload, including pending writes.

The pinned auth-js 2.118.0 default refresh path remains unchanged: no deprecated
custom lock, external lock wrapper or internal SDK patch. Two-tab regressions
exercise concurrent same-generation refresh with a delayed successful rotation
and an already-used-token rejection. Generation fences cover replacement and
logout independently of SDK/server refresh-race handling. This is not proof of
every provider/network interleaving. Direct profile/password requests already
sent cannot be undone; guards reject stale local acceptance and prevent a later
request from silently taking a replacement account token.

Email links work only in the browser profile where they were requested. Opening
one in another browser, device or in-app browser fails the binding check and
shows the mismatch notice. Request a fresh link in the intended browser. An
already used or superseded link also fails. Strict binding is not relaxed.
