# Decisions

## 2026-11-04 - Two 31 Oct entries are superseded

"Repository is private" no longer holds: the repo has been public since
1 November 2026. "Inert actions say so" no longer holds either: Save plan
and My plans save to the visitor's browser, Speak to a specialist opens
the Hybrid House contact page, and Support was removed from the navigation
(3 November 2026). Both entries stay below as history.

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
