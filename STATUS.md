# Status

> Updated: 2026-05-27

## Where we are
All compile-fidelity fixes from the audit (Ant Newman's silent-failure review series) are merged. Merged to main: #64 verification.on_fail (PR #71), #65 ExecutionPlan (PR #74), #66 MCP HTTP 500 (PR #79), #67 postbuild fail-loud (PR #78), #68 fixtures runner loud (PR #80), #69 fmt failure-mode tests (PR #81), #72 pre_output gate on_fail (PR #82), plus #76 Dependabot security patch and #77 docs (ROADMAP replaced by STATUS). The only remaining audit work is the executor-consumption follow-ups (#73, #75) and the perf scaling assertions (#46). 482 core tests on main.

## Recent
- 2026-05-27: #72 merged (PR #82). `pre_output` gate `on_fail` now forwarded onto `QualityGateResult.onFail`; mirrors #64. Parametrised across all five `OnFailAction` values plus the absent case.
- 2026-05-26: six PRs merged (#76 deps security, #77 docs, #78 postbuild, #79 mcp http 500, #80 fixtures loud, #81 fmt tests); #65 ExecutionPlan merged (PR #74).
- 2026-05-26: #70 assessed as already covered by the #64/#65 canaries; recommended close, no code (close-comment drafted, awaiting post).
- 2026-05-16: v1.5.0 shipped across all six channels.

## Next
- Land the executor-consumption follow-ups: #73 (executor reads CompiledStep.verification) and #75 (executor + LangGraph adapter consume CompiledStep.executionPlan), plus #46 (perf scaling assertions).
- Wire the executor to consume `CompiledStep.verification`, `CompiledStep.executionPlan`, and the gate `onFail` instead of reaching into the un-compiled spec (closes the "compiled output is the execution plan" loop). The executor (`executor.ts:263`) still reads verification from the un-compiled spec.
- Update the LangGraph adapter to honour `executionPlan` fan-out and fan-in.
- Cut the next release once the audit series is fully merged (CHANGELOG [Unreleased] has the batch).
- Longer horizon: runtime execution engine (live LLM calls), MCP HTTP transport docs, watch mode, LSP, visual editor/playground, template registry, multi-agent orchestration.
