# Changelog

> Rolling log of last 20 notable changes. Full history in git.

## [Unreleased]

## [1.5.0] - 2026-05-15

### Added
- Core: protocol-shape the spec — canonical schema, 18 conformance fixtures, RFC 2119 conformance section, discovery conventions (Phase 1)
- Core/CLI: dry-run executor, CI hardening, expanded CLI tests, benchmarks scaffolding (Phase 2)
- Core: tier-1 semantic canaries on compiled prompt output (#54) — 13 pinned assertions on executive phrasings the compiler must produce (output-schema rendering, quality gates, retry context, strategy preamble, branch context, step identity); regression-fires loudly if a refactor drops them.

### Changed
- chore(deps): align toolchain on Node 22 LTS (#24) — CI runner bumped from Node 20 → 22; `@types/node` downgraded from `^24.12.2` → `^22.19.17` across root + `@logic-md/cli` + `@logic-md/mcp`; root `engines.node` declared as `>=22.0.0`. Closes the runtime/types gap introduced by PR #23.
- chore: bump TypeScript to 6.0.3 (from `~5.8.0`) across root + `@logic-md/cli` + `@logic-md/mcp`. No source edits required; full build, test, and conformance suites green on 6.0.3.
- chore(deps): bump ajv 8.18.0 → 8.20.0 (#38), yaml 2.8.3 → 2.8.4 (#43), zod 4.3.6 → 4.4.3 (#42), tinyglobby 0.2.15 → 0.2.16 (#14).
- chore: organisation rename SingleSourceStudios → SingularityAI-Dev across repo URLs and metadata.

### Fixed
- Core schema: enforce `[0, 1]` bounds on probability/score fields, split violation enums into precise variants, fix dist build (7e48f4a). Previously-accepted out-of-range values are now rejected by `@logic-md/core` validators.
- Docs: SPEC.md §4.1 `Verification.on_fail` inline comment now documents all five schema-permitted values (`retry`, `escalate`, `skip`, `abort`, `revise`); added §4.1.1 Verification Properties table with per-value semantics; added conformance fixture `009-verification-revise` covering step-level `on_fail: revise` (#16).

### Documentation
- docs(spec): clarify Import.as required (#25)
- docs: add `llms.txt` at repo root (#52)
- docs: README positioning pivot (#50)
- benchmarks: publish 2026-05-07 cross-model results (#49)

## [1.4.0] - 2026-04-09

### Added
- CLI: 6 new commands — init, test, watch, fmt, diff, completion (M4 merge from Modular9)
- CLI: 16 LOGIC.md templates (analyst, classifier, debugger, orchestrator, planner, etc.)
- CLI: commander-based argument parsing with shell completion support
- MCP server: 7 tools — parse, validate, lint, compile-step, compile-workflow, init, list-templates
- MCP server: stdio + HTTP transport with security sandboxing
- Claude Code plugin: 5 slash commands (apply, compile, init, status, validate)
- Core: exports field fix — main, types, default, ./package.json export

### Changed
- CLI build system migrated from tsc to tsup (98KB bundle)
- MCP server uses tsup build (300KB bundle)
- Root build script now sequential: core (tsc) -> cli (tsup) -> mcp (tsup)

## [1.1.0] - 2026-04-02

### Added
- Reasoning compiler: compileStep and compileWorkflow APIs
- Step compiler with system prompt generation, output schemas, quality gates
- Self-reflection compilation for rubric and reflection strategies
- Token estimation on compiled steps
- DAG-ordered workflow compilation
- CLI --step flag for single-step compilation with self-reflection output
- Compiler test coverage (scenario tests for workflow shapes and edge cases)

## [1.0.0] - 2026-04-01

### Added
- LOGIC.md parser (gray-matter + YAML frontmatter)
- JSON Schema validator
- Expression engine for step conditions and outputs
- DAG resolver for step dependency ordering
- Import resolver for cross-file references
- CLI with validate, lint, compile commands
- Full test suite (307 tests)
