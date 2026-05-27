# Status

> Updated: 2026-05-27

## Where we are
The compile-boundary fidelity audit (Ant Newman's silent-failure review series) is nearly fully landed. Merged to main: #64 verification.on_fail (PR #71), #65 ExecutionPlan (PR #74), #66 MCP HTTP 500 (PR #79), #67 postbuild fail-loud (PR #78), #68 fixtures runner loud (PR #80), #69 fmt failure-mode tests (PR #81), plus #76 Dependabot security patch and #77 docs (ROADMAP replaced by STATUS). #72 pre_output gate on_fail is in review (PR #82, not merged). 476 core tests on main, 482 with #72.

## Recent
- 2026-05-27: #72 PR #82 opened. `pre_output` gate `on_fail` now forwarded onto `QualityGateResult.onFail`; mirrors #64. Parametrised across all five `OnFailAction` values plus the absent case.
- 2026-05-26: six PRs merged (#76 deps security, #77 docs, #78 postbuild, #79 mcp http 500, #80 fixtures loud, #81 fmt tests); #65 ExecutionPlan merged (PR #74).
- 2026-05-26: #70 assessed as already covered by the #64/#65 canaries; recommended close, no code (close-comment drafted, awaiting post).
- 2026-05-16: v1.5.0 shipped across all six channels.

## Next
- Merge #72 (PR #82) and #82's CodeRabbit thread once reviewed.
- Close #70 (resolved by #64/#65 canaries) and address #73, the last open audit sibling.
- Wire the executor to consume `CompiledStep.verification`, `CompiledStep.executionPlan`, and the gate `onFail` instead of reaching into the un-compiled spec (closes the "compiled output is the execution plan" loop). The executor (`executor.ts:263`) still reads verification from the un-compiled spec.
- Update the LangGraph adapter to honour `executionPlan` fan-out and fan-in.
- Cut the next release once the audit series is fully merged (CHANGELOG [Unreleased] has the batch).
- Longer horizon: runtime execution engine (live LLM calls), MCP HTTP transport docs, watch mode, LSP, visual editor/playground, template registry, multi-agent orchestration.
