# Requirements: logic-md

**Defined:** 2026-03-31
**Core Value:** Developers can define agent reasoning strategies in a portable, declarative file format — parsed and validated by a standalone library.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scaffolding

- [ ] **SCAF-01**: Monorepo with npm workspaces containing packages/core and packages/cli
- [ ] **SCAF-02**: TypeScript strict mode with ESM output targeting Node 18+
- [ ] **SCAF-03**: Path aliases between packages (core importable from cli)
- [ ] **SCAF-04**: biome configured for lint and format across all packages
- [ ] **SCAF-05**: vitest configured with empty passing tests in each package
- [ ] **SCAF-06**: GitHub Actions CI: test + lint + typecheck on PR to main/develop
- [ ] **SCAF-07**: README.md with project description, quick start placeholder, license badge
- [ ] **SCAF-08**: LICENSE (MIT) and CONTRIBUTING.md skeleton
- [ ] **SCAF-09**: .gitignore covering node_modules, dist, .env, coverage
- [ ] **SCAF-10**: Branch strategy: main (stable) + develop (active)

### Parser

- [x] **PARS-01**: Extract YAML frontmatter from .md files using gray-matter
- [x] **PARS-02**: Return fully typed LogicSpec TypeScript object from parsed YAML
- [x] **PARS-03**: Validate parsed YAML against embedded JSON Schema using ajv
- [x] **PARS-04**: Report validation errors with line numbers and clear messages
- [x] **PARS-05**: Support multiple errors per file (don't bail on first error)
- [x] **PARS-06**: Handle edge cases: empty frontmatter, missing delimiters, invalid YAML

### Expression Engine

- [x] **EXPR-01**: Parse and evaluate `{{ }}` template expressions
- [x] **EXPR-02**: Support dot notation for nested property access (e.g., `output.findings.length`)
- [x] **EXPR-03**: Support comparison operators (==, !=, <, >, <=, >=)
- [x] **EXPR-04**: Support logical operators (&&, ||, !)
- [x] **EXPR-05**: Support array methods (.length, .every(), .some(), .contains())
- [x] **EXPR-06**: Support ternary expressions (condition ? a : b)
- [x] **EXPR-07**: Inject context variables (steps, input, output) into expression scope
- [x] **EXPR-08**: Custom parser only — no eval(), no Function constructor

### DAG Resolver

- [x] **DAG-01**: Topologically sort steps based on `needs` dependencies
- [x] **DAG-02**: Detect and report cycles with clear error messages
- [x] **DAG-03**: Identify unreachable steps (no path from any root)
- [x] **DAG-04**: Resolve parallel execution groups (independent steps at same depth)

### Import Resolver

- [ ] **IMPT-01**: Resolve `imports` array with `ref` and `as` namespace
- [ ] **IMPT-02**: Load and parse referenced LOGIC.md files from relative paths
- [ ] **IMPT-03**: Merge imported configs with correct precedence (local overrides imported)
- [ ] **IMPT-04**: Detect and report circular imports

### CLI

- [x] **CLI-01**: `logic-md validate <file>` — validate a LOGIC.md file and report errors
- [x] **CLI-02**: `logic-md lint <file>` — check best practices (unused steps, unreachable branches, missing fallbacks)
- [x] **CLI-03**: `logic-md compile <file>` — output compiled reasoning scaffold for a given step
- [x] **CLI-04**: Exit codes: 0 = success, 1 = validation errors, 2 = file not found
- [x] **CLI-05**: Colorized terminal output with error/warning/info levels

### Testing

- [x] **TEST-01**: 90%+ test coverage on parser module
- [x] **TEST-02**: 90%+ test coverage on validator module
- [x] **TEST-03**: 90%+ test coverage on expression engine
- [x] **TEST-04**: 90%+ test coverage on DAG resolver
- [x] **TEST-05**: Integration tests: parse → validate → resolve full LOGIC.md files

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Reasoning Compiler (M2)

- **COMP-01**: Compile LOGIC.md into injectable prompt segments (reasoning middleware)
- **COMP-02**: Output schema compilation for structured output modes (OpenAI/Anthropic/Gemini)
- **COMP-03**: Quality gate compilation to executable validation functions
- **COMP-04**: Confidence tracking with threshold-triggered actions

### Visual Builder Integration (M3)

- **VIS-01**: LogicMiddleware class wrapping LLM calls with reasoning scaffold injection
- **VIS-02**: Visual editor components (strategy selector, DAG editor, contract editor)
- **VIS-03**: Plugin SDK update with `logic` field in manifest

### Template Marketplace (M4)

- **TMPL-01**: Web app for browsing/searching reasoning pattern templates
- **TMPL-02**: `logic-md init <template>` CLI command
- **TMPL-03**: 20+ seed templates for common agent archetypes

## Out of Scope

| Feature | Reason |
|---------|--------|
| npm publishing | Deferred until package is stable |
| Framework integrations (LangGraph, CrewAI) | Post-M1 — need stable core first |
| Modular9 wiring | M3 milestone, separate project |
| Template marketplace | M4 milestone |
| Launch campaign | M5 milestone |
| Runtime execution engine | LOGIC.md is a spec/parser, not a runtime |
| LLM API calls | Parser is model-agnostic, no API dependencies |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01 | Phase 1 | Pending |
| SCAF-02 | Phase 1 | Pending |
| SCAF-03 | Phase 1 | Pending |
| SCAF-04 | Phase 1 | Pending |
| SCAF-05 | Phase 1 | Pending |
| SCAF-06 | Phase 1 | Pending |
| SCAF-07 | Phase 1 | Pending |
| SCAF-08 | Phase 1 | Pending |
| SCAF-09 | Phase 1 | Pending |
| SCAF-10 | Phase 1 | Pending |
| PARS-01 | Phase 3 | Complete |
| PARS-02 | Phase 2 | Complete |
| PARS-03 | Phase 4 | Complete |
| PARS-04 | Phase 4 | Complete |
| PARS-05 | Phase 4 | Complete |
| PARS-06 | Phase 3 | Complete |
| EXPR-01 | Phase 5 | Complete |
| EXPR-02 | Phase 5 | Complete |
| EXPR-03 | Phase 5 | Complete |
| EXPR-04 | Phase 5 | Complete |
| EXPR-05 | Phase 5 | Complete |
| EXPR-06 | Phase 5 | Complete |
| EXPR-07 | Phase 5 | Complete |
| EXPR-08 | Phase 5 | Complete |
| DAG-01 | Phase 6 | Complete |
| DAG-02 | Phase 6 | Complete |
| DAG-03 | Phase 6 | Complete |
| DAG-04 | Phase 6 | Complete |
| IMPT-01 | Phase 7 | Pending |
| IMPT-02 | Phase 7 | Pending |
| IMPT-03 | Phase 7 | Pending |
| IMPT-04 | Phase 7 | Pending |
| CLI-01 | Phase 8 | Complete |
| CLI-02 | Phase 8 | Complete |
| CLI-03 | Phase 8 | Complete |
| CLI-04 | Phase 8 | Complete |
| CLI-05 | Phase 8 | Complete |
| TEST-01 | Phase 9 | Complete |
| TEST-02 | Phase 9 | Complete |
| TEST-03 | Phase 9 | Complete |
| TEST-04 | Phase 9 | Complete |
| TEST-05 | Phase 9 | Complete |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
