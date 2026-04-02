# Requirements: logic-md

**Defined:** 2026-03-31
**Updated:** 2026-04-02 (v1.1 roadmap mapped)
**Core Value:** Developers can define agent reasoning strategies in a portable, declarative file format -- parsed and validated by a standalone library with zero framework lock-in.

## v1.1 Requirements (Reasoning Compiler)

### Step Compiler

- [x] **COMP-01**: `compileStep(spec, stepName, context)` returns a `CompiledStep` with systemPromptSegment, outputSchema, qualityGates, retryPolicy, and metadata
- [x] **COMP-02**: `systemPromptSegment` includes reasoning strategy preamble ("You are using ReAct reasoning with max N iterations...")
- [x] **COMP-03**: `systemPromptSegment` includes current step instructions from `step.instructions`
- [ ] **COMP-04**: `systemPromptSegment` includes branch context if applicable (why this branch was taken, alternatives)
- [ ] **COMP-05**: `systemPromptSegment` includes retry context if applicable (attempt number, previous failure reason)
- [ ] **COMP-06**: `systemPromptSegment` includes output format instructions derived from `output_schema` (JSON schema -> structured output instructions)
- [ ] **COMP-07**: `systemPromptSegment` includes confidence requirements from step confidence thresholds
- [ ] **COMP-08**: `systemPromptSegment` includes active quality gate descriptions ("Before responding, verify: ...")
- [x] **COMP-09**: Compiled prompt segments are human-readable (debugging surface area)
- [ ] **COMP-10**: Output schema compilation produces instructions compatible with both JSON mode and function-calling mode

### Workflow Compiler

- [ ] **WKFL-01**: `compileWorkflow(spec, context)` returns a `CompiledWorkflow` with ordered steps and parallel groups
- [ ] **WKFL-02**: Workflow compilation reuses DAG resolver `_dagLevels` for execution ordering
- [ ] **WKFL-03**: Each step in workflow is pre-compiled with `compileStep`
- [ ] **WKFL-04**: Global quality gates and fallback policies attached to compiled workflow

### Quality Gate Compilation

- [ ] **GATE-01**: Quality gates compile to executable validator functions: `(output) => { passed, message? }`
- [ ] **GATE-02**: Gate evaluation uses existing expression engine (`evaluate()` from expression.ts)
- [ ] **GATE-03**: Self-reflection gates compile to a follow-up prompt template with rubric and minimum score

### Token Estimation

- [ ] **TOKN-01**: `estimateTokens(text)` returns approximate token count (~4 chars per token)
- [ ] **TOKN-02**: Compiled prompt segments warn if exceeding 2000 tokens

### Types

- [x] **TYPE-01**: New types added to types.ts: ExecutionContext, CompiledStep, CompiledWorkflow, QualityGate, RetryPolicy, WorkflowContext
- [x] **TYPE-02**: All new types exported from packages/core/index.ts barrel

### CLI Update

- [ ] **CLIU-01**: `logic-md compile --step <stepName>` compiles a specific step with context
- [ ] **CLIU-02**: Step compilation output includes self-reflection prompt if enabled in spec

### Testing

- [ ] **CTST-01**: 90%+ test coverage on compiler module
- [ ] **CTST-02**: Tests cover linear workflows, branching workflows, retry context, quality gate compilation
- [ ] **CTST-03**: Tests cover self-reflection, parallel step groups, token estimation, edge cases (no steps, single step, missing optional fields)

### Constraints

- [x] **CNST-01**: All compiler functions are pure -- no side effects, no I/O, no LLM calls
- [x] **CNST-02**: Output is model-agnostic -- works with any LLM that accepts text prompts
- [x] **CNST-03**: No new dependencies -- builds entirely on M1 foundation

## v1.0 Requirements (Complete)

All v1.0 requirements shipped and validated. See MILESTONES.md for details.

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM API calls | Compiler produces text, never calls models |
| Visual builder integration (M3) | Separate milestone |
| Template marketplace (M4) | Separate milestone |
| npm publishing | Deferred until stable |
| Framework integrations | Post-M2 |
| Runtime execution engine | Compiler is a text transformer, not an orchestrator |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | Phase 11 | Complete |
| COMP-02 | Phase 11 | Complete |
| COMP-03 | Phase 11 | Complete |
| COMP-04 | Phase 12 | Pending |
| COMP-05 | Phase 12 | Pending |
| COMP-06 | Phase 11 | Pending |
| COMP-07 | Phase 12 | Pending |
| COMP-08 | Phase 12 | Pending |
| COMP-09 | Phase 11 | Complete |
| COMP-10 | Phase 11 | Pending |
| WKFL-01 | Phase 15 | Pending |
| WKFL-02 | Phase 15 | Pending |
| WKFL-03 | Phase 15 | Pending |
| WKFL-04 | Phase 15 | Pending |
| GATE-01 | Phase 13 | Pending |
| GATE-02 | Phase 13 | Pending |
| GATE-03 | Phase 13 | Pending |
| TOKN-01 | Phase 14 | Pending |
| TOKN-02 | Phase 14 | Pending |
| TYPE-01 | Phase 10 | Complete |
| TYPE-02 | Phase 10 | Complete |
| CLIU-01 | Phase 16 | Pending |
| CLIU-02 | Phase 16 | Pending |
| CTST-01 | Phase 17 | Pending |
| CTST-02 | Phase 17 | Pending |
| CTST-03 | Phase 17 | Pending |
| CNST-01 | Phase 10 | Complete |
| CNST-02 | Phase 10 | Complete |
| CNST-03 | Phase 10 | Complete |

**Coverage:**
- v1.1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-03-31 (v1.0)*
*Last updated: 2026-04-02 after v1.1 roadmap mapping*
