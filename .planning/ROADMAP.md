# Roadmap: logic-md

## Overview

This roadmap takes logic-md from zero to a complete CLI toolkit for parsing, validating, and compiling LOGIC.md files. The work flows from project scaffolding through the core library modules (parser, validator, expression engine, DAG resolver, import resolver), then up to the CLI layer, and finally a dedicated testing and integration phase to hit 90%+ coverage. Each phase delivers a coherent, independently verifiable capability.

## Milestones

- v1.0 MVP - Phases 1-9 (shipped 2026-04-01)
- v1.1 Reasoning Compiler - Phases 10-17 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-9) - SHIPPED 2026-04-01</summary>

- [x] **Phase 1: Project Scaffolding** - Monorepo structure, tooling, CI, and repo hygiene (completed 2026-03-31)
- [x] **Phase 2: Type System & JSON Schema** - LogicSpec types and embedded validation schema (completed 2026-04-01)
- [x] **Phase 3: Parser** - Extract and parse YAML frontmatter into typed LogicSpec objects (completed 2026-04-01)
- [x] **Phase 4: Schema Validator** - Validate parsed specs against JSON Schema with rich error reporting (completed 2026-04-01)
- [x] **Phase 5: Expression Engine** - Parse and evaluate template expressions with context injection (completed 2026-04-01)
- [x] **Phase 6: DAG Resolver** - Topological sorting, cycle detection, and parallel group resolution (completed 2026-04-01)
- [x] **Phase 7: Import Resolver** - File-based imports with namespace composition and circular detection (completed 2026-04-01)
- [x] **Phase 8: CLI** - Validate, lint, and compile commands with proper exit codes and output (completed 2026-04-01)
- [x] **Phase 9: Test Coverage & Integration** - 90%+ coverage across all modules and end-to-end integration tests (completed 2026-04-01)

### Phase 1: Project Scaffolding
**Goal**: Developer can clone the repo, install dependencies, and run passing tests/lint/typecheck in one command
**Depends on**: Nothing (first phase)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05, SCAF-06, SCAF-07, SCAF-08, SCAF-09, SCAF-10
**Success Criteria** (what must be TRUE):
  1. Running `npm install` at the repo root installs all workspace dependencies and packages/cli can import from packages/core
  2. Running `npm test` executes vitest and passes in both packages
  3. Running `npm run lint` executes biome and passes with zero warnings
  4. Pushing a PR to main triggers GitHub Actions that run test + lint + typecheck
  5. Repository has MIT license, README with project description, .gitignore, and main + develop branches
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold monorepo with workspaces, TypeScript, Biome, Vitest, and repo docs
- [x] 01-02-PLAN.md -- GitHub Actions CI pipeline and develop branch strategy

### Phase 2: Type System & JSON Schema
**Goal**: The complete LogicSpec type hierarchy and embedded JSON Schema exist as the foundation for all downstream modules
**Depends on**: Phase 1
**Requirements**: PARS-02
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Complete TypeScript type hierarchy for LogicSpec v1.0
- [x] 02-02-PLAN.md -- JSON Schema draft-07 and ajv schema loader with validation tests

### Phase 3: Parser
**Goal**: Developers can parse any LOGIC.md file and get back a typed LogicSpec object or clear error messages
**Depends on**: Phase 2
**Requirements**: PARS-01, PARS-06
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md -- TDD parser: tests for frontmatter extraction and edge cases, then implementation

### Phase 4: Schema Validator
**Goal**: Developers can validate parsed LogicSpec objects and get actionable, multi-error reports with line numbers
**Depends on**: Phase 3
**Requirements**: PARS-03, PARS-04, PARS-05
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- TDD core validate() function with ajv schema validation and multi-error collection
- [x] 04-02-PLAN.md -- Line number accuracy tests and barrel export wiring

### Phase 5: Expression Engine
**Goal**: Template expressions in LOGIC.md files can be parsed and evaluated safely against injected context
**Depends on**: Phase 2
**Requirements**: EXPR-01, EXPR-02, EXPR-03, EXPR-04, EXPR-05, EXPR-06, EXPR-07, EXPR-08
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- TDD lexer and Pratt parser: tokenization and AST construction
- [x] 05-02-PLAN.md -- TDD tree-walk evaluator: operator dispatch, array methods, context injection
- [x] 05-03-PLAN.md -- Barrel export wiring and integration tests with realistic expressions

### Phase 6: DAG Resolver
**Goal**: Step dependency graphs in LOGIC.md files are resolved into correct execution order with full error reporting
**Depends on**: Phase 2
**Requirements**: DAG-01, DAG-02, DAG-03, DAG-04
**Plans**: 1 plan

Plans:
- [x] 06-01-PLAN.md -- TDD DAG resolver: Kahn's algorithm with cycle detection, unreachable identification, and parallel grouping

### Phase 7: Import Resolver
**Goal**: LOGIC.md files can import and compose reasoning scaffolds from other LOGIC.md files
**Depends on**: Phase 3
**Requirements**: IMPT-01, IMPT-02, IMPT-03, IMPT-04
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- TDD import resolver: fixtures, tests, resolveImports with namespace merging and circular detection
- [x] 07-02-PLAN.md -- Barrel export wiring and edge case tests

### Phase 8: CLI
**Goal**: Developers can run logic-md commands from the terminal to validate, lint, and compile LOGIC.md files
**Depends on**: Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md -- CLI entry point, format utility, and validate/lint/compile command handlers
- [x] 08-02-PLAN.md -- CLI integration tests with test fixtures and end-to-end verification

### Phase 9: Test Coverage & Integration
**Goal**: All core modules have 90%+ test coverage and end-to-end integration tests prove the full pipeline works
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md -- Install coverage tooling, configure vitest, run baseline coverage and document gaps
- [x] 09-02-PLAN.md -- Fill coverage gaps with targeted tests to reach 90%+ on parser, validator, expression, dag
- [x] 09-03-PLAN.md -- Full pipeline integration tests (parse -> validate -> DAG -> imports -> expressions)

</details>

### v1.1 Reasoning Compiler (In Progress)

**Milestone Goal:** Build the reasoning compiler that transforms a parsed LOGIC.md into injectable prompt segments -- the runtime middleware layer between system prompt and user message.

- [x] **Phase 10: Compiler Types & Foundation** - New types, barrel exports, and pure-function architecture constraints (completed 2026-04-01)
- [x] **Phase 11: Step Compiler Core** - Compile a single step into a prompt segment with reasoning strategy, instructions, and output format (completed 2026-04-02)
- [x] **Phase 12: Step Compiler Context** - Branch context, retry context, confidence thresholds, and quality gate descriptions in prompt segments (completed 2026-04-02)
- [x] **Phase 13: Quality Gate Compilation** - Quality gates compile to executable validators using the expression engine (completed 2026-04-02)
- [x] **Phase 14: Token Estimation** - Approximate token counting and prompt size warnings (completed 2026-04-02)
- [x] **Phase 15: Workflow Compiler** - Compile full workflow with DAG execution plan and pre-compiled steps (completed 2026-04-02)
- [ ] **Phase 16: CLI Compile Step** - Add --step flag to compile command and self-reflection output
- [ ] **Phase 17: Compiler Test Coverage** - 90%+ coverage across compiler modules with comprehensive scenario tests

## Phase Details

### Phase 10: Compiler Types & Foundation
**Goal**: All compiler types exist, are exported, and the pure-function / zero-dependency / model-agnostic constraints are established
**Depends on**: Phase 9 (v1.0 complete)
**Requirements**: TYPE-01, TYPE-02, CNST-01, CNST-02, CNST-03
**Success Criteria** (what must be TRUE):
  1. ExecutionContext, CompiledStep, CompiledWorkflow, QualityGate, RetryPolicy, and WorkflowContext types exist in types.ts and are importable from packages/core
  2. A developer importing from packages/core can access all new types without reaching into internal paths
  3. The compiler module skeleton exists with function signatures that accept and return the new types (pure functions, no I/O)
**Plans**: 1 plan

Plans:
- [x] 10-01-PLAN.md -- Add compiler types to types.ts, create compiler.ts skeleton with pure-function stubs, update barrel exports

### Phase 11: Step Compiler Core
**Goal**: A developer can compile any single step into a human-readable prompt segment that includes reasoning strategy, step instructions, and output format instructions
**Depends on**: Phase 10
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-06, COMP-09, COMP-10
**Success Criteria** (what must be TRUE):
  1. Calling `compileStep(spec, stepName, context)` returns a CompiledStep with a systemPromptSegment containing the reasoning strategy preamble, step instructions, and output format instructions
  2. The systemPromptSegment is human-readable plain text that a developer can inspect and debug
  3. Output schema compilation produces instructions that work for both JSON mode and function-calling mode LLM interfaces
  4. The returned CompiledStep includes outputSchema, qualityGates, retryPolicy, and metadata fields
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md -- TDD compileStep core: strategy preamble, step instructions, and metadata via DAG resolver
- [x] 11-02-PLAN.md -- TDD output schema compilation, retry policy compilation, and integration tests against research-synthesizer

### Phase 12: Step Compiler Context
**Goal**: Compiled step prompt segments include all contextual information: branch reasoning, retry state, confidence requirements, and quality gate checklists
**Depends on**: Phase 11
**Requirements**: COMP-04, COMP-05, COMP-07, COMP-08
**Success Criteria** (what must be TRUE):
  1. When a step is reached via a decision branch, the prompt segment explains why this branch was taken and what alternatives exist
  2. When a step is being retried, the prompt segment includes the attempt number and the reason the previous attempt failed
  3. Steps with confidence thresholds include instructions requiring the agent to meet the minimum confidence level
  4. Steps with active quality gates include a "Before responding, verify: ..." checklist in the prompt segment
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md -- TDD branch context and retry context sections in systemPromptSegment
- [ ] 12-02-PLAN.md -- TDD confidence thresholds and quality gate checklist sections in systemPromptSegment

### Phase 13: Quality Gate Compilation
**Goal**: Quality gates from LOGIC.md specs compile into executable validator functions that can evaluate step output
**Depends on**: Phase 11
**Requirements**: GATE-01, GATE-02, GATE-03
**Success Criteria** (what must be TRUE):
  1. A quality gate with a `check` expression compiles to an executable function `(output) => { passed, message? }` that evaluates using the expression engine
  2. Self-reflection gates compile to a follow-up prompt template containing the rubric and minimum score threshold
  3. Gate validators correctly pass or fail when given sample outputs (no false positives or negatives on test fixtures)
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md -- TDD check-expression gate compilation: step verification + spec pre_output gates to validator functions
- [ ] 13-02-PLAN.md -- TDD self-reflection compilation: rubric/reflection strategies to prompt templates with minimum scores

### Phase 14: Token Estimation
**Goal**: Developers can estimate token counts for compiled prompts and receive warnings when segments are too large
**Depends on**: Phase 11
**Requirements**: TOKN-01, TOKN-02
**Success Criteria** (what must be TRUE):
  1. `estimateTokens(text)` returns an approximate count using the ~4 chars/token heuristic
  2. Compiled prompt segments that exceed 2000 tokens include a warning in the compilation result
**Plans**: 1 plan

Plans:
- [ ] 14-01-PLAN.md -- TDD estimateTokens implementation and tokenWarning integration in compileStep

### Phase 15: Workflow Compiler
**Goal**: A developer can compile an entire LOGIC.md workflow into an ordered execution plan with pre-compiled steps and global policies
**Depends on**: Phase 12, Phase 13
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04
**Success Criteria** (what must be TRUE):
  1. `compileWorkflow(spec, context)` returns a CompiledWorkflow with steps ordered by the DAG resolver's `_dagLevels`
  2. Each step in the compiled workflow is pre-compiled via compileStep (not deferred)
  3. Steps at the same DAG level are grouped as parallel-executable
  4. Global quality gates and fallback policies from the spec are attached to the compiled workflow
**Plans**: 1 plan

Plans:
- [ ] 15-01-PLAN.md -- TDD compileWorkflow: DAG-ordered pre-compiled steps with global quality gates and fallback policies

### Phase 16: CLI Compile Step
**Goal**: Developers can compile individual steps from the command line and see self-reflection prompts when applicable
**Depends on**: Phase 15
**Requirements**: CLIU-01, CLIU-02
**Success Criteria** (what must be TRUE):
  1. Running `logic-md compile example.logic.md --step analyze` compiles and outputs only the specified step
  2. When a step has self-reflection enabled, the CLI output includes the self-reflection prompt alongside the compiled step
**Plans**: TBD

### Phase 17: Compiler Test Coverage
**Goal**: The compiler module has 90%+ test coverage with tests covering every workflow shape and edge case
**Depends on**: Phase 16
**Requirements**: CTST-01, CTST-02, CTST-03
**Success Criteria** (what must be TRUE):
  1. vitest coverage report shows 90%+ on all compiler module files (lines, branches, functions, statements)
  2. Tests cover linear workflows, branching workflows, retry context injection, and quality gate compilation
  3. Tests cover self-reflection prompts, parallel step groups, token estimation warnings, and edge cases (no steps, single step, missing optional fields)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17
Note: Phase 13 depends on Phase 11 (not 12), so 12 and 13 can run in parallel after 11. Phase 14 depends only on Phase 11.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Scaffolding | v1.0 | 2/2 | Complete | 2026-03-31 |
| 2. Type System & JSON Schema | v1.0 | 2/2 | Complete | 2026-04-01 |
| 3. Parser | v1.0 | 1/1 | Complete | 2026-04-01 |
| 4. Schema Validator | v1.0 | 2/2 | Complete | 2026-04-01 |
| 5. Expression Engine | v1.0 | 3/3 | Complete | 2026-04-01 |
| 6. DAG Resolver | v1.0 | 1/1 | Complete | 2026-04-01 |
| 7. Import Resolver | v1.0 | 2/2 | Complete | 2026-04-01 |
| 8. CLI | v1.0 | 2/2 | Complete | 2026-04-01 |
| 9. Test Coverage & Integration | v1.0 | 3/3 | Complete | 2026-04-01 |
| 10. Compiler Types & Foundation | v1.1 | 1/1 | Complete | 2026-04-01 |
| 11. Step Compiler Core | 2/2 | Complete    | 2026-04-02 | - |
| 12. Step Compiler Context | 2/2 | Complete    | 2026-04-02 | - |
| 13. Quality Gate Compilation | 2/2 | Complete    | 2026-04-02 | - |
| 14. Token Estimation | v1.1 | Complete    | 2026-04-02 | - |
| 15. Workflow Compiler | 1/1 | Complete    | 2026-04-02 | - |
| 16. CLI Compile Step | v1.1 | 0/0 | Not started | - |
| 17. Compiler Test Coverage | v1.1 | 0/0 | Not started | - |
