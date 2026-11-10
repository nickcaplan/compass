# Robin advisory pilot

One public CSS PR only: #89. No automatic PR/push reviews. Nick can manually run the workflow on main with PR89's exact full head SHA, or post exactly `/review` on PR89. Comment dispatch is restricted to nickcaplan, who is the repository owner. Other maintainers and other PRs do not run this pilot.

The direct action is pinned to reviewed commit 808e18045c93f80f917a41be8fa3f80fa03d70a0. Native comment events use Robin's supported comment handler. Manual workflow dispatch uses a validated local PR-shaped payload because this Robin version has no workflow_dispatch handler. The manual adapter downloads only the exact pinned action bundle, verifies its SHA256, and runs it in Node 24 with an explicit child-process event context. It does not attempt to overwrite reserved GitHub step environment variables. That adapter still needs a live compatibility test.

No repository checkout, PR code execution, paid models, or blocking review. The secret is repository-only OPENROUTER_ROBIN_PILOT. Diff-only mode sends the full filtered diff, not repository snapshots, to OpenRouter/free providers. Only public code is in scope. Size/token caps are per request, not whole-run accounting; retries can consume several free requests. The job has a 5-minute deadline. Both original and rerun initiator must be nickcaplan.

Required CI, CodeRabbit and Nick's per-PR Merge remain unchanged. A Robin result is advisory only. If PR89 changes during the run, do not rely on its review. The end check rejects a changed head but cannot undo a review already posted. Do not rerun with a different PR or increased limits without agreement.

Before running: confirm key expiry and a $0 total cap with no reset, no account credits/payment method/auto-recharge, and explicit permission for the single review run. A $0 key may reject even free inference; do not increase its cap as a workaround. No inference call has been validated by the preparation checks.

## First-run output fix

The first native run on PR89 failed after its free router selected recursive/flint-v1.0:free. It used 3765 of the 4000 completion tokens for reasoning and returned incomplete output. No review findings were published. [Failed run](https://github.com/nickcaplan/compass/actions/runs/42896941038).

Both triggers now select one named free model, nvidia/nemotron-3-ultra-550b-a55b:free, and send reasoning-effort: none. The output cap remains 4000. Robin's off value omits reasoning controls; none is passed through as reasoning.effort and requests reasoning disabled. The live OpenRouter catalog on10November lists this model with zero input/output price, optional reasoning and supported effort none. No paid-model fallback is configured.

This is preparation, not a proven live fix. No additional inference has run. A new run needs separate approval after Merge. Free availability, provider compliance and review quality remain untested. Robin may retry an unsupported reasoning setting without the override and emit a warning; inspect the run and do not treat incomplete output as a review. Do not raise the cap, change model, add a paid fallback or rerun without agreement. The same one-PR, owner, rerun-actor, exact-head, file, diff-only, advisory and time/token guards remain.

Sources: [reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [live catalog](https://openrouter.ai/api/v1/models), [free variants](https://openrouter.ai/docs/guides/routing/model-variants/free), [pinned Robin inputs](https://github.com/antongulin/robin/blob/808e18045c93f80f917a41be8fa3f80fa03d70a0/action.yml).
