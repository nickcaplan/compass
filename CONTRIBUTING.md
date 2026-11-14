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
