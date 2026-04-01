# Roadmap: logic-md

## Overview

This roadmap takes logic-md from zero to a complete CLI toolkit for parsing, validating, and compiling LOGIC.md files. The work flows from project scaffolding through the core library modules (parser, validator, expression engine, DAG resolver, import resolver), then up to the CLI layer, and finally a dedicated testing and integration phase to hit 90%+ coverage. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Scaffolding** - Monorepo structure, tooling, CI, and repo hygiene (completed 2026-03-31)
- [x] **Phase 2: Type System & JSON Schema** - LogicSpec types and embedded validation schema (completed 2026-04-01)
- [x] **Phase 3: Parser** - Extract and parse YAML frontmatter into typed LogicSpec objects (completed 2026-04-01)
- [x] **Phase 4: Schema Validator** - Validate parsed specs against JSON Schema with rich error reporting (completed 2026-04-01)
- [x] **Phase 5: Expression Engine** - Parse and evaluate template expressions with context injection (completed 2026-04-01)
- [x] **Phase 6: DAG Resolver** - Topological sorting, cycle detection, and parallel group resolution (completed 2026-04-01)
- [x] **Phase 7: Import Resolver** - File-based imports with namespace composition and circular detection (completed 2026-04-01)
- [x] **Phase 8: CLI** - Validate, lint, and compile commands with proper exit codes and output (completed 2026-04-01)
- [ ] **Phase 9: Test Coverage & Integration** - 90%+ coverage across all modules and end-to-end integration tests

## Phase Details

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
- [ ] 01-01-PLAN.md — Scaffold monorepo with workspaces, TypeScript, Biome, Vitest, and repo docs
- [ ] 01-02-PLAN.md — GitHub Actions CI pipeline and develop branch strategy

### Phase 2: Type System & JSON Schema
**Goal**: The complete LogicSpec type hierarchy and embedded JSON Schema exist as the foundation for all downstream modules
**Depends on**: Phase 1
**Requirements**: PARS-02
**Success Criteria** (what must be TRUE):
  1. A `LogicSpec` TypeScript interface exists that models the full LOGIC.md v1.0 specification (strategies, steps, gates, contracts)
  2. All sub-types are exported and importable from packages/core
  3. An embedded JSON Schema file validates against the LogicSpec structure
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Complete TypeScript type hierarchy for LogicSpec v1.0
- [ ] 02-02-PLAN.md — JSON Schema draft-07 and ajv schema loader with validation tests

### Phase 3: Parser
**Goal**: Developers can parse any LOGIC.md file and get back a typed LogicSpec object or clear error messages
**Depends on**: Phase 2
**Requirements**: PARS-01, PARS-06
**Success Criteria** (what must be TRUE):
  1. Calling `parse(fileContent)` with valid LOGIC.md returns a fully typed LogicSpec object
  2. Calling `parse()` with missing delimiters, empty frontmatter, or invalid YAML returns descriptive errors (not crashes)
  3. Parser uses gray-matter for frontmatter extraction
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md — TDD parser: tests for frontmatter extraction and edge cases, then implementation

### Phase 4: Schema Validator
**Goal**: Developers can validate parsed LogicSpec objects and get actionable, multi-error reports with line numbers
**Depends on**: Phase 3
**Requirements**: PARS-03, PARS-04, PARS-05
**Success Criteria** (what must be TRUE):
  1. Calling `validate(spec)` returns all validation errors in a single pass (not bailing on first error)
  2. Each validation error includes a line number and a human-readable message describing what is wrong and where
  3. Valid specs return a clean success result
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — TDD core validate() function with ajv schema validation and multi-error collection
- [ ] 04-02-PLAN.md — Line number accuracy tests and barrel export wiring

### Phase 5: Expression Engine
**Goal**: Template expressions in LOGIC.md files can be parsed and evaluated safely against injected context
**Depends on**: Phase 2
**Requirements**: EXPR-01, EXPR-02, EXPR-03, EXPR-04, EXPR-05, EXPR-06, EXPR-07, EXPR-08
**Success Criteria** (what must be TRUE):
  1. `evaluate("{{ output.findings.length > 0 }}", context)` returns the correct boolean result
  2. All operators work: dot access, comparisons (==, !=, <, >, <=, >=), logical (&&, ||, !), ternary (? :)
  3. Array methods (.length, .every(), .some(), .contains()) evaluate correctly
  4. Context variables (steps, input, output) are injectable and accessible in expressions
  5. No eval() or Function constructor is used anywhere in the implementation
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — TDD lexer and Pratt parser: tokenization and AST construction
- [ ] 05-02-PLAN.md — TDD tree-walk evaluator: operator dispatch, array methods, context injection
- [ ] 05-03-PLAN.md — Barrel export wiring and integration tests with realistic expressions

### Phase 6: DAG Resolver
**Goal**: Step dependency graphs in LOGIC.md files are resolved into correct execution order with full error reporting
**Depends on**: Phase 2
**Requirements**: DAG-01, DAG-02, DAG-03, DAG-04
**Success Criteria** (what must be TRUE):
  1. Given steps with `needs` dependencies, the resolver returns a topologically sorted execution order
  2. Circular dependencies are detected and reported with the cycle path (e.g., "A -> B -> C -> A")
  3. Steps with no path from any root are identified as unreachable
  4. Independent steps at the same depth level are grouped as parallel-executable
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md — TDD DAG resolver: Kahn's algorithm with cycle detection, unreachable identification, and parallel grouping

### Phase 7: Import Resolver
**Goal**: LOGIC.md files can import and compose reasoning scaffolds from other LOGIC.md files
**Depends on**: Phase 3
**Requirements**: IMPT-01, IMPT-02, IMPT-03, IMPT-04
**Success Criteria** (what must be TRUE):
  1. A LOGIC.md file with an `imports` array resolves referenced files from relative paths and namespaces them correctly
  2. Imported configs merge with local configs where local values take precedence over imported ones
  3. Circular imports (A imports B imports A) are detected and reported with the import chain
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — TDD import resolver: fixtures, tests, resolveImports with namespace merging and circular detection
- [ ] 07-02-PLAN.md — Barrel export wiring and edge case tests

### Phase 8: CLI
**Goal**: Developers can run logic-md commands from the terminal to validate, lint, and compile LOGIC.md files
**Depends on**: Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05
**Success Criteria** (what must be TRUE):
  1. `logic-md validate example.logic.md` reports validation errors or confirms the file is valid
  2. `logic-md lint example.logic.md` reports best-practice issues (unused steps, unreachable branches, missing fallbacks)
  3. `logic-md compile example.logic.md` outputs the compiled reasoning scaffold
  4. Exit codes are correct: 0 for success, 1 for validation errors, 2 for file not found
  5. Terminal output is colorized with distinct error/warning/info levels
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — CLI entry point, format utility, and validate/lint/compile command handlers
- [ ] 08-02-PLAN.md — CLI integration tests with test fixtures and end-to-end verification

### Phase 9: Test Coverage & Integration
**Goal**: All core modules have 90%+ test coverage and end-to-end integration tests prove the full pipeline works
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. vitest coverage report shows 90%+ on parser, validator, expression engine, and DAG resolver modules
  2. Integration tests parse a real LOGIC.md file through the full pipeline: parse -> validate -> resolve DAG -> resolve imports -> compile
  3. Edge cases and error paths are covered (malformed files, circular deps, invalid expressions)
**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md — Install coverage tooling, configure vitest, run baseline coverage and document gaps
- [ ] 09-02-PLAN.md — Fill coverage gaps with targeted tests to reach 90%+ on parser, validator, expression, dag
- [ ] 09-03-PLAN.md — Full pipeline integration tests (parse -> validate -> DAG -> imports -> expressions)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
Note: Phases 5 and 6 depend only on Phase 2 and can theoretically run in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffolding | 0/2 | Complete    | 2026-03-31 |
| 2. Type System & JSON Schema | 0/2 | Complete    | 2026-04-01 |
| 3. Parser | 0/1 | Complete    | 2026-04-01 |
| 4. Schema Validator | 0/2 | Complete    | 2026-04-01 |
| 5. Expression Engine | 3/3 | Complete    | 2026-04-01 |
| 6. DAG Resolver | 0/1 | Complete    | 2026-04-01 |
| 7. Import Resolver | 0/2 | Complete    | 2026-04-01 |
| 8. CLI | 0/2 | Complete    | 2026-04-01 |
| 9. Test Coverage & Integration | 2/3 | In Progress|  |
