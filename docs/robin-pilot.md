# Robin advisory pilot

One public CSS PR only: #89. No automatic PR/push reviews. Nick can manually run the workflow on main with PR89's exact full head SHA, or post exactly `/review` on PR89. Comment dispatch is restricted to nickcaplan, who is the repository owner. Other maintainers and other PRs do not run this pilot.

The direct action is pinned to reviewed commit808e18045c93f80f917a41be8fa3f80fa03d70a0. Native comment events use Robin's supported comment handler. Manual workflow dispatch uses a validated local PR-shaped payload because this Robin version has no workflow_dispatch handler. The manual adapter downloads only the exact pinned action bundle, verifies its SHA256, and runs it in Node24 with an explicit child-process event context. It does not attempt to overwrite reserved GitHub step environment variables. That adapter still needs a live compatibility test.

No repository checkout, PR code execution, paid models, or blocking review. The secret is repository-only OPENROUTER_ROBIN_PILOT. Diff-only mode sends the full filtered diff, not repository snapshots, to OpenRouter/free providers. Only public code is in scope. Size/token caps are per request, not whole-run accounting; retries can consume several free requests. The job has a5minute deadline.

Required CI, CodeRabbit and Nick's per-PR Merge remain unchanged. A Robin result is advisory only. If PR89 changes during the run, do not rely on its review. The end check rejects a changed head but cannot undo a review already posted. Do not rerun with a different PR or increased limits without agreement.

Before running: confirm key expiry and a $0 total cap with no reset, no account credits/payment method/auto-recharge, and explicit permission for the single review run. A $0 key may reject even free inference; do not increase its cap as a workaround. No inference call has been validated by the preparation checks.
