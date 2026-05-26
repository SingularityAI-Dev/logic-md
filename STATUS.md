# Status

> Updated: 2026-05-26

## Where we are
Post-v1.5.0, working a compile-boundary fidelity audit (Ant Newman's review series): the compiler accepts authored spec fields and silently drops them from compiled output, so a runtime cannot execute from the compiled artifact alone. #64 (verification.on_fail) is fixed and merged to main (PR #71). #65 (parallel execution: execution, parallel_steps, join, join_timeout) is fixed and in review (PR #74, not merged). Sibling findings #66, #72, #73 remain open in the same class. 472 core tests passing.

## Recent
- 2026-05-26: #65 PR #74 opened. First-class `ExecutionPlan` on a singular `CompiledStep.executionPlan`; `join_timeout` carried as a duration string (matching RetryPolicy), not parsed to ms. Design doc at `docs/superpowers/specs/2026-05-26-execution-plan-design.md`.
- 2026-05-26: #64 merged (PR #71). `CompiledVerification` plus `QualityGateResult` plus a singular `CompiledStep.verification`.
- 2026-05-16: v1.5.0 shipped across all six channels (npm core/cli/mcp, VS Code 0.1.4, PyPI 0.1.1, GitHub release).
- 2026-04-09: v1.4.0 milestone, M4+M5+M6 merge from Modular9 (9-command CLI, 16 templates, MCP 7 tools, Claude Code plugin).

## Next
- Merge #65 (PR #74) after review.
- Triage remaining audit siblings #66, #72, #73; apply the same pattern (first-class typed field on CompiledStep, mirror the source, null absent case, parametrised canary test).
- Wire the executor to consume `CompiledStep.verification` and `CompiledStep.executionPlan` instead of reaching into the un-compiled spec (closes the "compiled output is the execution plan" loop).
- Update the LangGraph adapter to honour `executionPlan` fan-out and fan-in.
- Runtime execution engine: execute compiled workflows with real LLM calls (dry-run executor landed in Phase 2; live execution still to build).
- MCP server HTTP transport: testing and documentation.
- Watch mode, LSP, visual editor/playground, template registry, multi-agent orchestration (longer horizon).
