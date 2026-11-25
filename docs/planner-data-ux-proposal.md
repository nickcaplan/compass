# Planner UX proposal based on Ben's developer guide

Status: proposal for review, not an implementation or approval to change the planner.
This PR changes no runtime code, data, scoring, costs or saved plans.

## What we know

Source: Ben's 11 November 2026 "Compass Database Feedback" email, attached
Compass_Developer_Guide_CPM_CTR_and_Tactic_Descriptions.docx (all seven sections
and field table), and its companion workbook. Guide:
https://docs.google.com/document/d/1Tuom6MGKMtDFucv4DpH6DoPsGwCZ1Phh/edit

The source has 349 workbook rows repeated across five simulated markets,
1,745 rows in total. There are 319 distinct publisher/product names. These are
not 1,745 distinct products. No publisher's
market availability or rates have been validated. Global is a separate
simulated market, not the union of the other four. All rows are mock data.
The guide says three tabs early on, then adds Tactic Descriptions in section 7;
the actual companion workbook has four tabs. Use actual header names, not
stale column references or the earlier filename.

The planner now uses the imported workbook-backed source-option result for
new generated plans. The former illustrative Publisher A/B/C allocation
builders remain only for existing saved plans and their PDF export.

## Proposed result page

Keep the brief simple. Use its market, objective and an approved audience
mapping to find suitable inventory. Do not add a general data explorer to the
planner. Missing mappings should produce an honest limitation, not a guessed
match or an empty screen that looks like no publishers exist.

Show sections by tactic, such as Email, Webinars and Display Advertising.
At the top of each section, show the short description from Tactic Descriptions
once. Below it show all suitable publisher-format options, with:

- publisher and product/format;
- one primary KPI, including its rate where applicable;
- expected delivery and its correct unit;
- estimated cost, currency and buying unit;
- a short publisher-specific rationale only where supplied;
- a clear "Illustrative, not validated" status, with source detail secondary.

For example, an Email section explains Email once, followed by each eligible
publisher's actual format, CTR, expected clicks and source cost. A Webinar
shows registrations, not assumed attendees or leads. Do not add clicks,
registrations and completed views into a meaningless combined result.

Show no "Preferred" badge until THH approves and tests scoring. "Suitable
options" is more honest than a claimed ranked recommendation while those
rules are missing. Do not quietly substitute a different market or count the
five market copies as five different packages.

## Budget changes and buying models

Rebuild from the actual buying model, volumes and package constraints. Do not
multiply every forecast linearly with the budget or force all budget to be
spent. If valid packages cannot fit the budget, show the unallocated amount
and explain the limitation. Exact allocation rules still need agreement.

CPM pricing and CTR delivery are separate:

- CPM cost = impressions / 1,000 x CPM rate.
- CTR clicks = impressions x CTR fraction.
- CPL source values currently describe a one-lead unit, not a full campaign.
- Flat-fee and other packages retain their own units and constraints.

The guide's missing-volume default of 5,000 is for the mock only and must be
visible as an assumption. No unlimited inventory, linear delivery or package
availability should be invented. Keep source currencies until currency
labels and any FX policy are agreed. A GBP brief does not make a USD rate GBP.

## What must be decided before implementation

1. THH classifies Other and Other / Review, and supplies the missing
   Print/Audio/Directory rules and descriptions.
2. Map the workbook's five broad audience groups to Compass's six job roles,
   including exclusions and what to show for missing mappings.
3. Agree package/volume limits, multi-market deduplication, budget allocation,
   and whether under-spend is accepted.
4. Agree currency labels and any exchange-rate source/update policy.
5. Agree preferred-option scoring, including objective fit, audience fit,
   value and data quality. No preferred recommendation before this.
6. Validate publisher availability, rates, volume and benchmarks before live use.

## Data-review implications

The simple report remains a separate inspection tool, not another planner mode.
A fresh import reproduced all existing counts: 1,595 rows carry review flags,
150 pass these checks. Passing them does not mean validated or live-ready.

- 1,470 rows still need a tactic category, not blank tactics: 735 raw Other
  and 735 Other / Review, representing 294 original formats. The READ ME says
  170 originals; that discrepancy needs Ben's clarification.
- 95 CPL rows are a documented demo limitation, not evidence of bad maths.
- 45 CPM rates exceed our chosen 1,000 review threshold, not a vendor rule or
  proof the rates are invalid.
- 115 missing-rule and 115 missing-description flags affect the same rows.
- 315 price-like product names remain review candidates, not proven errors.
- Cost and result formula checks found no mismatches under the current importer.

Show the evidence value and source reference for each report item without
adding filters or modes. Keep mock status and overlapping-count caveats.

## Suggested delivery sequence after approval

1. Agree the open data/rule decisions above with THH.
2. Mock one tactic section on phone and desktop using a verified source slice,
   including no-options and missing-data states. Review it before coding.
3. Implement the adapter and unit-aware calculations with tests, separately
   from the UI change; keep the old saved-plan contract intact or migrate it
   explicitly.
4. Connect the tactic-led results page, then verify market separation,
   budget/package limits, KPI units, source currency, no preferred badge,
   keyboard flow, small screens, saved plans and PDF output.

Not checked: real-world publisher inventory/pricing, live availability, FX,
source-PDF formatting exclusions, approved audience mapping/scoring, or the
current production planner's pixels in this research pass. None is implied by
this proposal, the mocked data, or passing structural checks.
