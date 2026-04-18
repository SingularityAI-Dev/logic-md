# Changelog

> Rolling log of last 20 notable changes. Full history in git.

## [Unreleased]

### Documentation
- docs(spec): clarify Import.as required (#25)

### Changed
- chore(deps): align toolchain on Node 22 LTS (#24) — CI runner bumped from Node 20 → 22; `@types/node` downgraded from `^24.12.2` → `^22.19.17` across root + `@logic-md/cli` + `@logic-md/mcp`; root `engines.node` declared as `>=22.0.0`. Closes the runtime/types gap introduced by PR #23.
- chore: bump TypeScript to 6.0.3 (from `~5.8.0`) across root + `@logic-md/cli` + `@logic-md/mcp`. No source edits required; full build, test, and conformance suites green on 6.0.3.

### Fixed
- Docs: SPEC.md §4.1 `Verification.on_fail` inline comment now documents all five schema-permitted values (`retry`, `escalate`, `skip`, `abort`, `revise`); added §4.1.1 Verification Properties table with per-value semantics; added conformance fixture `009-verification-revise` covering step-level `on_fail: revise` (#16).

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
