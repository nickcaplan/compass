# Contributing

If CodeRabbit is rate-limited or skipped, run Robin straight away (/review comment or workflow run).

## Production QA agents

Two standing QA prompts run against the live production site. The post-merge prompt runs after every merge to main; the general prompt runs twice a day. QA findings are advice, not permission to change code: fixes still go through a PR with independent review and Nick's explicit merge approval.

### Post-merge production QA prompt (runs after every merge)

> A change has just merged to main and reached production. Test the live site thoroughly. First read the merged PR and its complete diff: the agreed requirements, the intended behaviour and the exact code paths changed. Then exercise the changed functionality in production with varied data and realistic mutations: empty, partial and full states; minimum, typical and extreme values; invalid and unexpected input; repeated actions; and interrupted flows such as navigating away mid-task. Follow each code path the change can take, not only the happy path. Check neighbouring pages, shared components and shared formatters for regressions. Inspect rendered phone, tablet and desktop layouts in every supported theme, with normal and enlarged text where the site supports it. Report only verified results and mark anything not exercised as not checked.

Post the result as a comment on the merged PR:

1. Start with **Passed**, **Issues found** or **Not checked**. Identify the merge commit SHA and PR number tested.
2. Number each finding with severity (critical, high, medium or low), reproduction steps, expected versus actual behaviour and the environment (device class, viewport, theme, text size).
3. List what was checked and how, and what was not checked and why. A blocked check is not a pass.

Open a GitHub issue for each reproducible defect and link it from the comment. Do not commit fixes directly.

### General production QA prompt (runs twice a day)

> Explore the live production site as an adversarial visitor and try to break it. Do not follow a fixed script: probe forms, navigation, state and media with sequences a real user could produce. Try rapid repeated clicks, double submission, back and forward navigation mid-flow, deep links, stale or hand-edited local state, malformed and over-long input, special characters, boundary viewport sizes, slow or interrupted network and theme or text-size changes mid-task. Cross the boundaries the site relies on: signed-in versus signed-out state, filters and pagination at their edges, players and modals opened in unusual orders, empty and over-full content. Check complete journeys, not isolated components. Never enter real personal data, never trigger real purchases, bookings, emails or external form submissions and never attempt to access or modify another user's data. Report only verified, reproduced results; mark suspected but unreproduced issues as unconfirmed.

Report the result through the agent's normal channel:

1. Start with **No issues found**, **Issues found** or **Not checked**.
2. For each reproducible defect, open a GitHub issue with severity, reproduction steps, expected versus actual behaviour and the environment. Check open issues first and update an existing issue instead of filing a duplicate.
3. List the areas covered and the areas not covered. State clearly when a run was cut short.

### Compass QA focus

- The production demo is `https://compass-demo.websitesbynick.co.uk/`, serving the main branch as a Render static site.
- Sign-in is a critical path: sign in and out repeatedly, clear or expire the session mid-journey and try gated routes while signed out. Do not infer server-side protection from the UI sign-in gate; report any data reachable without authentication.
- Exercise planner state: save, edit and delete plans, reload with saved plans present, corrupt or hand-edit the stored plan data and check the recovery path. Watch for layout jumps when saved state changes.
- On the data review page, filter by market and objective, open source details, include held-back rows and verify the shown counts against the underlying dataset.
- Mocked figures are not live quotes or validated recommendations; report any copy or behaviour that implies otherwise.

## Standing maintenance agents

Four further standing prompts keep the site healthy between merges. Suggested cadences are marked on each; scheduling lives outside the repo. Findings are advice, not permission to change code: fixes still go through a PR with independent review and Nick's explicit merge approval. Each prompt reports verdict first (**No issues found**, **Issues found** or **Not checked**), then numbered findings with severity, reproduction or evidence and environment, then what was and was not checked. Open a GitHub issue for each actionable finding, after checking for duplicates.

### Enlarged text and phone checker (suggested: after every UI merge)

> Check the live site at phone widths and at enlarged text sizes, up to 200% where the site supports it, in every supported theme. Look for the defects this kind of site keeps having: text overflowing its container, buttons or pills that clip, wrap mid-word or lose equal widths, icons drifting out of alignment, columns becoming unreadably narrow and controls overlapping or becoming unreachable. Exercise interactive controls at these settings: menus, dropdowns, forms, modals and media players. Judge actual rendered layouts from DOM measurements and screenshots, not source or test output alone. Use Android/Pixel 8 as the phone reference where practical and distinguish emulation from a real device. Report viewport, theme and text size for every finding.

### Link and content checker (suggested: weekly)

> Crawl the live site and check every internal and external link, button and asset: broken links, redirects to dead ends, wrong anchors and missing images, audio, video or documents. Then read the visible copy for content problems: placeholder or TBC text, stale dates, expired events still presented as upcoming, totals or counts that no longer match their source and pages that contradict each other. Do not invent replacement facts: report the stale or inconsistent content and its location, with the correct source when one exists in the repository or its linked references. Never submit forms or complete external flows while checking.

### Dependency and security watcher (suggested: weekly)

> Review the repository's dependencies and automation for risk: known vulnerabilities (run the repository's audit tooling, such as `npm audit`, and read the dependency-scan results in CI), outdated packages with security fixes, new or unexpected dependencies in recent PRs, secrets or tokens in any committed file, workflow permissions broader than needed and unpinned or unsafe third-party actions. On the live site, check security headers and any exposed endpoints where applicable. Never expose a credential in a finding: describe its location and type only. Rank findings by severity with a suggested fix and open an issue for anything actionable.

### Page speed check (suggested: weekly, and after merges that touch loading, media or scripts)

> Measure the live site's speed like-for-like and compare it with the previous recorded baseline: cold and warm loads on phone and desktop class connections, covering the main pages and the heaviest page. Record the numbers, method and date so the next run can compare. Flag regressions with the likely cause from recent changes, such as new images, scripts, fonts or embeds. Check that media players and other embeds do not block first render. Report measured results only; if a baseline is missing, say the change is unmeasured rather than zero impact.

### Compass maintenance focus

- Enlarged text and phone: include the sign-in screens, planner and the data review table; filters, dropdowns and source-detail panels must stay usable at phone width and 200% text, and the page must not jump when saved state loads.
- Link and content: verify data-review counts, tactic categories and currency labels against the underlying dataset, and check mailto and external links; flagged rows must not read as live quotes.
- Dependency and security: check the authentication configuration for each deployed origin, gated-route protection beyond the UI and that no dataset or internal note is exposed without sign-in.
- Page speed: the dataset drives the data review page; measure its load and filter responsiveness, and compare Compass load times against the recorded baseline.
