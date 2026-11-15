# Decisions

## 2026-11-13 - KPIs come included with the objective

Nick's feedback (13 November 2026): "you shouldn't be able to select KPIs -
you just select the Objective and the KPIs come for free". KPI selection is
removed from the brief: choosing an objective includes every KPI of that
objective automatically, shown as read-only chips under the objective with
an "Included with your objective(s)" note. The KPI question still counts
toward the brief's answered progress, answered by the objective that
includes it. Saved plans keep their stored KPIs in
read-only views; opening one in the editable form derives KPIs from its
objectives, so a legacy plan with a hand-picked subset is not treated as
changed on open.

## 2026-11-05 - Seniority step removed

Ben's combined feedback (2.2: "Too much going on for now") asked for the
Seniority step to come out, and Nick approved the removal on 5 Nov 2026.
The form, brief model, demo examples, rationale wording and plan summaries
no longer carry seniority; the 31 Oct four-level decision below is kept as
history. Saved plans from before the removal may still hold a seniority
field; it is ignored and preserved untouched in storage.

## 2026-11-04 - Two 31 Oct entries are superseded

"Repository is private" no longer holds: the repo has been public since
1 November 2026. "Inert actions say so" now holds only in part: Save plan
writes plans to the visitor's browser and My plans reads and displays them,
and Speak to a specialist opens the Hybrid House contact page; Sign in
still shows "Not available yet" and Download PDF still shows "Coming soon".
Support was removed from the navigation (3 November 2026). Both entries
stay below as history.

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

The validated Supabase SDK is pinned to2.119.0 in package.json and the lockfile.
Its default refresh path remains unchanged: no deprecated
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
## 2026-11-03 - Market brief selection

Nick's edited combined-feedback document places Market between Objective and
KPI. His authenticated3November16:14:42/16:14:58 clarification selects North America,
UK, France and Germany, excluding Europe, and allows multiple choices. Stable
IDs keep the taxonomy extensible. Selection is stored with the brief and shown
in generated and saved summaries. Existing plans have no inferred region and
show Not specified. Nick made Market required on 3 November at 20:18. At least one market is
needed to generate or regenerate, and progress counts seven required fields.
Older plans without markets remain viewable as Not specified; editing them
requires a market before regeneration. Real regional inventory matching is
not invented in this change.

The current concept uses illustrative Publisher A/B/C forecasts, not the master
workbook's real inventory. Market selection records intent only;
forecasts do not change by market. Nick requested removal of the inline market
hint on 3 November; the form has no market hint text, while this forecast
limitation remains documented here. No UK/France/Germany inventory eligibility or
regional cost/coverage is implied. No source document, provider setting or
external account was changed.

## 2026-11-03 - Specialist button opens Hybrid House contact

Nick approved the shorter specialist prompt in54 and separately requested the
specialist control take visitors to Hybrid House's contact page. The exact
https://thehybridhouse.co.uk/contact/ page was read and verified as Contact,
with "Let's start a conversation" and the business email. The existing
"Speak to a specialist" control becomes a normal link with the same class
and text, opening in a new tab like the site's other external links. No
brief, account or saved plan is sent. Unrelated Contact/mailto controls stay
unchanged. Separate preview PR, not included in54's merge approval.

## 2026-11-03 - Fixed audiences and demo cleanup

Nick initially requested Laboratory Technician and Scientist / Researcher side
by side. After rejecting the equal-column multiline pills as inconsistent with
other pills, Nick approved natural single-line pills on 3 November at16:09.
They share the existing pill typography, padding and height. Choices pair only
where they fit; narrow layouts stack rather than shrink, truncate or wrap labels.
Keyboard multi-select semantics remain unchanged.

Nick confirmed all saved plans are demo data and asked to remove invalid
audiences directly, superseding legacy-choice preservation. On initialization,
retired audiences are removed from persisted demo plans, without mapping them
onto a new audience or deleting a plan. Current audiences and other plan fields
stay unchanged. Empty audiences remain empty until a visitor chooses one before
regenerating. Seed plans likewise no longer introduce retired audiences. A
failed cleanup write uses the existing storage error state and does not pretend
the stored cleanup succeeded.

## 2026-11-03 - Reclaim space for natural audience rows

Follow-up research requested separately from 52: keep the existing full-size,
single-line pills and reclaim nested form whitespace. Planning cards use 8px
insets; below the existing 980px single-column breakpoint, the page gutter is
12px and form horizontal inset 8px. This yields 330px for pills at 390px and 328px
on the 400px desktop form, enough for the approximately 327px long pair. Natural
flex fallback remains on narrower screens and with wider/enlarged text. No
fixed columns, truncation, font shrinking or label changes are introduced.

Nick requested removal of the "Choose at least one audience." helper on
3 November. The helper and its description reference are removed; selection
validation and invalid saved-audience cleanup remain unchanged.

Nick requested a single desktop row for Objective options on 3 November.
The desktop form column is 416px rather than 400px, keeping all three
full-size objective pills together without a pill-specific style exception.
The 980px single-column breakpoint and natural enlarged-text wrapping stay.
Nick clarified demo fill is for testing and must include Market. Generated
example briefs use UK as explicit illustrative test data, not inferred visitor
geography; existing saved plans are not backfilled. The auto-generation flow
continues with all seven required answers populated.

## 2026-11-10 - Unselected Objective choices match

Unselected Awareness, Consideration and Performance choices use the same
outline and text treatment. Objective shades begin when selected; KPIs keep
their objective colour coding. This supersedes distinct unselected Objective
outlines only, not the selected or KPI shades.

## Combined sign-in release integration (11 November 2026)

The combined release replaces the separate #38/#50/#56 stack; preview mirror #57
is never a release candidate. Refresh-safe routes from #37 are retained through
the current shared plan router, with auth callback ownership kept separate.
Profile edit preservation, explicit demo redirect flags and logout draft-restore
revocation from that branch are present in the combined controller flow.

Current-main PDF downloads, equal Edit/Open card actions, edit history, stale-plan
warnings, red destructive confirmations and saved-plan objective colours are
preserved. Plan-only browser regressions use an intercepted fixture account;
auth regressions separately exercise signed-out gating and account transitions.
No test drops its existing assertions to accommodate authentication.

This integration does not change provider settings, authorize real account tests,
sync browser-local saved plans to a server, or approve a production merge. A
bounded real Google plus email signup/verification/reset check still needs an
agreed account and audience before it is attempted. Old-version tabs must close
and existing users log in again when the canonical auth controller is deployed.

## 13 November 2026 - Objective and expanding KPIs

For the desktop brief-first proposal, Objective sits top-right with KPI directly
below it. The remaining fields form an independent left column, so additional
KPI rows do not create gaps between those fields. Phone and tablet keep their
existing single-column field order. The KPI box uses a short eased transition
between measured heights when objectives change, including shrinking after
removal. Reduced-motion users get the final size immediately. No objective or
KPI choices are removed, and existing answers survive responsive layout changes.

- Enlarged-text phone verification also caught the Generate arrow wrapping alone. Keep its final word and arrow in a non-breaking inline group; cover that at 200% text in the KPI layout regression.

## 13 November: audit all brief states, not only all-objectives-selected

- Empty desktop review exposed 344px below the KPI hint. Rebalance the upper section to a narrow Campaign name/Market column and wider Objective/KPI column. Audience gets a full-width row; Budget and Dates share the bottom row. Phone/tablet retain the existing order.
- Actual empty column mismatch is 23px at 1280/1440/1920. At one/two/three objectives it is 11/67/106px. No artificial minimum height, dummy content, hidden labels or fixed final KPI height. Lower rows follow the actual animated upper section.
- Readiness requires pixel review of empty, partial, all-objectives and fully answered/generated states at phone/tablet/desktop, plus enlarged text. A single flattering screenshot is not enough. Apply that review to every future Compass UI PR.

- Partial phone/tablet briefs now show only the real answer summary and next-step guidance, rather than reserving a tall set of empty result blocks before generation. Actual generating-state skeletons remain.

- Keep the visual desktop progress row mounted from zero answers, so the first objective click and final deselection do not snap the Generate button down/up. The screen-reader status still mounts empty and only announces actual answer changes.

- Nick requested exact empty KPI/Market alignment. The Objective control now matches the measured name input height, and the empty KPI hint matches the measured market pills. A ResizeObserver tracks actual font/wrap changes; expanded KPI height stays content-driven and animated. Single-column enlarged-text layout clears these peer minimums.

## 14 November 2026 - Markets on saved plans

All saved plans must have a market, including edited/custom legacy plans with
no market or an empty list. Use UK as the fallback, as any market is acceptable
for this demo data. Keep existing explicit market choices. Persist the repair
without changing IDs, dates, other answers, list order or deleted-plan metadata.
An unsaved brief still requires a deliberate market selection. A storage failure
must not be presented as a successful repair.
