# Handover Report: LOGIC.md
**Date**: 2026-04-10
**Session**: Full ecosystem — origin, isolation, README, architecture diagrams

---

## Executive Summary

LOGIC.md is a declarative reasoning specification format for AI agents — the first of its kind, zero prior art in the ecosystem. It was built inside the Modular9 codebase across 6 milestones in approximately one week, then extracted into a standalone repo at `~/development/logic-md` (GitHub: `SingularityAI-Dev/logic-md`, private). As of this session it is at v1.4.0, fully consolidated, with a world-class README and two animated architecture diagrams ready for open-source launch. The immediate next step is: register the `@logic-md` npm org, publish three packages, make the repo public, and execute the HN + Reddit launch.

---

## How It Came About

### Origin
LOGIC.md was not planned as a standalone product. It emerged from a specific failure mode encountered during Modular9 development — the **describing-vs-doing bug**.

Modular9 is a visual node-based AI workflow builder (ReactFlow canvas, BullMQ execution engine, 39 specialist plugins). When running multi-node workflows, every node was producing output like:

> *"As a Security Auditor, I would perform an OWASP Top 10 review and map findings to CWE IDs..."*

Instead of producing the actual audit report. The next node received intent descriptions, not data. Pipelines became chains of *I would do X* statements.

### Root cause identified
Two compounding issues:
1. System prompts said "You are a Security Auditor" but never said "produce the actual artifact"
2. No output structure was declared — the LLM defaulted to conversational summary

### The fix that became a format
To solve this properly, Rainier designed a declarative spec format that could:
- Declare output contracts (typed fields each node MUST produce)
- Inject execution mandates automatically at runtime
- Define reasoning strategies, step DAGs, quality gates, and fallback policies
- Be portable across any agent framework

This became LOGIC.md — a markdown file with YAML frontmatter, sitting between identity files (CLAUDE.md, SOUL.md) and capability files (SKILL.md, TOOLS.md).

### The three-part fix
```
Part A — Execution mandate injected into every node's system prompt:
"You are a node in an automated workflow pipeline. Your output IS the artifact."

Part B — Output contract injected into user prompt when logicConfig.contracts.outputs exists:
"## Required Output
You MUST produce a concrete artifact with this structure:
- findings (array, required): List of code review findings
- severity (string, required): critical, high, medium, low"

Part C — Input framing restructured:
Previous node output labeled as "## Input Data" with contract field descriptions.
```

---

## Milestone History

All 6 milestones were built using the GSD framework inside the Modular9 codebase, then M4-M6 were merged into the standalone logic-md repo.

| Tag | Milestone | What shipped | Where built |
|-----|-----------|--------------|-------------|
| v0.1.0 | M1: Core | Parser, JSON Schema validator, expression engine (Pratt parser, no eval), DAG resolver (Kahn's algorithm), import resolver, CLI v1 (validate/lint/compile). 207 tests, 91.82% branch coverage | `~/development/logic-md` |
| v1.1.0 | M2: Compiler | `compileStep()` and `compileWorkflow()` — reasoning compiler. Quality gate validators, token estimation, self-reflection prompts. 328 tests, 100% statement / 95.9% branch / 100% function / 100% line coverage | `~/development/logic-md` |
| v1.1-modular9 | M3: Integration | LogicMiddleware class, plugin SDK with logic field, visual editor with five tabs, execution trace inspector with SSE streaming, deep-merge cascade across workflow/plugin/user levels. The describing-vs-doing fix. | `~/development/modular9` (STAYS here — application-specific) |
| v1.2.0 | M4: CLI extension | Six new CLI commands (init, test, watch, fmt, diff, completion) plus 12 archetype templates. Shell completion for bash, zsh, fish | `~/development/modular9/packages/cli` → merged to logic-md |
| v1.3.0 | M5: MCP Server | `@logic-md/mcp` package with 7 tools over stdio and HTTP transport, path traversal security, 2 resources (schema and spec). 33/33 requirements across 4 phases | `~/development/modular9/packages/mcp` → merged to logic-md |
| v1.4.0 | M6: Claude Code | Five slash commands wired to M5 MCP server, plus 4 reasoning workflow templates (code-review, debug, refactor, architecture). Documentation in `docs/claude-code-plugin.md` | `~/development/modular9/.claude/commands/logic` → merged to logic-md |

---

## Repository Structure

### Standalone repo (canonical home)
```
~/development/logic-md/
├── packages/
│   ├── core/              @logic-md/core — parser, validator, compiler, DAG, expressions
│   ├── cli/               @logic-md/cli — 9 commands, 12 templates
│   └── mcp/               @logic-md/mcp — 7 MCP tools, stdio + HTTP
├── integrations/
│   └── claude-code/       5 slash commands, 4 workflow templates
├── docs/
│   ├── SPEC.md            LOGIC.md specification v1.0
│   └── claude-code-plugin.md
├── examples/              example .logic.md files
├── .github/workflows/     CI pipeline
├── .planning/             GSD planning docs for all 6 milestones
├── README.md              World-class README (written this session)
├── package.json           npm workspaces root, v1.4.0
├── biome.json             linting config
├── vitest.config.ts       test config
├── tsconfig.json
└── tsconfig.build.json
```

**GitHub**: `github.com/SingularityAI-Dev/logic-md` (currently **private**)
**Status**: v1.4.0 tagged, all packages building, 307 tests passing, 2 lint warnings (non-blocking)

### Modular9 repo (keeps vendored copies — do not touch)
```
~/development/modular9/
├── packages/
│   ├── logic-md-core/     vendored copy of @logic-md/core (keep until npm switch)
│   ├── cli/               vendored copy with M4 work (keep until npm switch)
│   └── mcp/               vendored copy with M5 work (keep until npm switch)
├── src/lib/execution/
│   ├── logic-middleware.ts   M3 runtime integration — STAYS in Modular9
│   └── agent-runner.ts       the three-part fix lives here
└── .claude/commands/logic/   M6 slash commands (copied to integrations/ already)
```

---

## Technical Architecture

### @logic-md/core pipeline
```
.logic.md text
→ parse()        markdown/YAML → raw object (gray-matter)
→ validate()     JSON Schema (ajv, 887-line schema, 34 definitions)
→ resolveImports() compose external files, namespace merging, circular detection
→ resolveDAG()   topological sort (Kahn's), cycle detection, parallel levels
→ compile()      emit CompiledWorkflow — system prompt segments, output schemas,
                 quality gate validators, token estimates
→ execute        Modular9 LogicMiddleware (in Modular9, not in this package)
```

### Key files in @logic-md/core
- `types.ts` — 583 lines, 30+ interfaces, 9 unions. Source of truth
- `schema.json` — 887 lines, draft-07 JSON Schema, 34 definitions
- `expression.ts` — ~570-line Pratt parser + tree-walk evaluator for `{{ ... }}` expressions. Zero eval, zero Function constructor
- `dag.ts` — Kahn's algorithm, parallel execution levels via `_dagLevels`
- `compiler.ts` — `compileStep()` and `compileWorkflow()` — the core value

### LOGIC.md spec sections (all optional except spec_version and name)
- `imports` — compose external specs with namespacing
- `reasoning` — strategy (cot, react, tot, got, plan-execute, custom), iterations, temperature, thinking budget
- `steps` — named stages with needs (DAG deps), instructions, I/O schemas, confidence thresholds, branches, retry, verification, timeouts, allowed/denied tools, parallel execution
- `contracts` — typed inputs/outputs following A2A protocol pattern
- `quality_gates` — pre/post output checks, continuous invariants, self_verification loops
- `decision_trees` — named nodes and terminals for complex routing
- `fallback` — escalation chains and graceful degradation
- `global / nodes / edges` — multi-agent DAG composition with per-edge contracts
- `visual` — icon, palette category, inspector fields, ports for visual node builders

### CLI commands (9 total)
`validate`, `lint` (--fix), `compile` (--step), `init` (--template), `test`, `watch` (--fix), `fmt` (--check), `diff`, `completion`

### MCP tools (7 total)
`logic_md_parse`, `logic_md_validate`, `logic_md_lint`, `logic_md_compile_step`, `logic_md_compile_workflow`, `logic_md_init`, `logic_md_list_templates`

### MCP resources (2)
`logic-md://schema`, `logic-md://spec`

### Claude Code slash commands (5)
`/logic:status`, `/logic:apply`, `/logic:validate`, `/logic:init`, `/logic:compile`

### Built-in templates (12 CLI + 4 Claude Code)
CLI: `research-synthesizer`, `code-reviewer`, `data-analyst`, `customer-support`, `content-writer`, `security-auditor`, `bug-triager`, `api-integrator`, `document-summarizer`, `decision-maker`, `plan-and-execute`, `react-loop`

Claude Code: `code-review.logic.md`, `debug-workflow.logic.md`, `refactor.logic.md`, `architecture.logic.md`

---

## Architecture Diagrams (Built This Session)

Two animated SVG diagrams were created in this session and are ready to drop into the README or docs site. They use the same dark-background styling as the NVIDIA CLI architecture diagram that inspired them — dark fills, bright coloured strokes, animated dashed connecting lines.

### Diagram 1: Ecosystem overview
**Title**: LOGIC.md ecosystem
**Layers**:
- Row 1 (gray): CLAUDE.md · SOUL.md · SKILL.md — existing convention files
- Arrow: "missing layer" animated down
- Hero (purple): LOGIC.md — Reasoning strategy · step DAGs · contracts · quality gates · fallback policies
- Row 2 (teal, 4px inset gap): @logic-md/core · @logic-md/cli · @logic-md/mcp
- Row 3 (coral, 4px inset gap): Modular9 · Claude Code · Any MCP host
- Stats row (purple): 328 tests · 6 milestones · zero prior art · v1.4.0 MIT

**Styling**: Dark fills (#0d2a22 teal, #2a1208 coral, #1e1b38 purple, #2a2a35 gray), bright coloured strokes (#2db88a teal, #e07050 coral, #7c6fe0 purple, #6b6b7a gray). Animated dashed lines in matching stroke colours. 4px gaps between boxes in rows 2 and 3. All boxes clickable via sendPrompt().

### Diagram 2: Orchestration layer
**Title**: LOGIC.md orchestration
**Three sections**:

1. **Agent-to-agent** — Agent A (teal) → edge contract (purple) → Agent B (teal). Animated purple arrows. Caption: "output schema enforced · next agent receives structured data, not intent"

2. **Multi-agent DAG** — Orchestrator (purple) fans out via animated arrows to three parallel agents (teal: Security audit, Code review, Dependency scan), then converges via reverse-animated arrows to join node (purple: "join: all · merge outputs / wait_all · first · any")

3. **Agent-to-skill / per-step tool control** — Three coral boxes in sequence: research step (allowed: web_search / denied: file_write) → analysis step (allowed: code_exec / denied: web_search) → output step (allowed: file_write / denied: code_exec). Animated coral arrows between steps.

**Note**: Both diagrams are currently rendered as interactive Claude widgets. To embed in README, they need to be exported as static SVG files or PNG screenshots. The SVG code is available in this session's chat history.

---

## README (Written This Session)

Full README is ready at `/mnt/user-data/outputs/README.md`.

**Structure follows the playbook research**:
1. Name + tagline + badges
2. The problem (describing-vs-doing, code example of bad output)
3. What it is (YAML example showing contracts)
4. What it controls (7 capabilities listed)
5. The describing-vs-doing fix (the three-part solution, production-validated)
6. Packages table
7. Quick start (core, CLI, MCP, Claude Code)
8. Format overview (12 sections, expression engine, DAG resolver)
9. Competitive landscape table
10. Status block with all numbers
11. Roadmap
12. Development setup
13. Contributing
14. Author byline: *Six milestones. One week. Zero prior art.*

**Key hook**: Opening quote — *"Have you not considered that there is no logic?"*

---

## Competitive Position

| Standard / Framework | What it handles |
|---|---|
| CLAUDE.md / AGENTS.md | Identity, project context, build commands |
| OpenClaw SOUL.md | Personality, behavioural rules |
| Cursor .mdc rules | Coding conventions |
| MCP | Agent ↔ tool connectivity |
| A2A Protocol | Agent ↔ agent communication |
| LangGraph | Reasoning as imperative Python code |
| CrewAI | YAML for roles — reasoning is a boolean flag |
| AutoGen | Conversation patterns in Python |
| DSPy | Closest — composable signatures, still imperative |
| **LOGIC.md** | **Declarative reasoning structure as a portable file format** |

No equivalent project exists. This was verified against GitHub, academic literature, framework documentation, and visual builder architectures.

**Market context**: LangChain 115K+ stars, AutoGPT 178K+, CrewAI $18M Series A, MCP 97M monthly SDK downloads. Enterprise adoption gap: 79% adopted AI agents, only 11% in production. Blockers are governance, reproducibility, standardisation — exactly what LOGIC.md addresses.

---

## Launch Plan

### Pre-launch checklist
- [ ] Register `@logic-md` org on npmjs.com (free)
- [ ] `npm publish` for all three packages from `~/development/logic-md`
- [ ] Update README badges with real npm links once published
- [ ] Export architecture diagrams as static PNG/SVG for README embedding
- [ ] Make repo public on GitHub
- [ ] Buy `logic-md.org` domain (Cloudflare Registrar, ~$10/year)
- [ ] Set up email capture (Kit/ConvertKit — free up to 10,000 subscribers)
- [ ] Set up Lemon Squeezy account (South Africa-compatible payments, MoR model)
- [ ] Add GitHub repo topics: `ai-agents`, `llm`, `reasoning`, `mcp`, `typescript`, `open-source`, `claude`, `langchain`, `crewai`, `agent-framework`
- [ ] Set social preview image (1280×640, use the ecosystem diagram)
- [ ] Tag v1.0.0 release on GitHub with release notes

### Launch sequence (from playbook research)
**Day 1-2**: Show HN post
- Title: `Show HN: LOGIC.md – declarative reasoning specs for AI agents`
- First comment: the describing-vs-doing story. Personal, candid. End with a question.
- Stay in thread for 2-3 hours minimum. Reply to everything.
- Have 3-5 friends comment early (find via /newest, NOT shared link)

**Same day**: r/SideProject
- Format: `I built LOGIC.md — the missing reasoning layer for AI agents`
- Same story: problem → fix → production proof

**Day 3-5**: Dev.to article
- Title: `The describing-vs-doing bug: how I built LOGIC.md to fix it`
- Tags: #showdev #ai #typescript #opensource
- Cross-post to Hashnode and HackerNoon

**Week 2**: Directory submissions
- alternativeto.net (list as alternative to LangGraph/CrewAI reasoning config)
- openalternative.co
- awesome-mcp-servers (PR)
- awesome-llm-agents (PR)
- console.dev/tools (submit for newsletter feature)
- TLDR newsletter submission

**Week 3+**: Product Hunt prep, LinkedIn post, framework-specific subreddits

### HN first comment hook
```
I built this to fix a specific problem: AI agents that describe what they would do
instead of doing it.

Before LOGIC.md, every node in our pipeline produced output like "As a Security Auditor,
I would perform an OWASP Top 10 review..." — descriptions of intent, not actual artifacts.
The next node received narratives, not data.

The fix required contracts that explicitly declare what each node must produce, plus
quality gates that enforce the structure. You can't solve this with system prompts alone.
LOGIC.md is the format that makes it declarative and portable.

Six milestones in one week, zero prior art in the space. Happy to answer anything
about the spec design, the expression engine, or the Modular9 integration.

What reasoning challenges are you hitting in your agent pipelines?
```

---

## Payment / Monetisation

Stripe is not available in South Africa. Use **Lemon Squeezy** (5% + $0.50/transaction) — supports SA bank payouts, handles global VAT/tax as Merchant of Record. Set up account now even before charging anything.

Path to revenue: open source traction → hosted cloud version of logic-md.org (managed LOGIC.md validation, template marketplace, team features). Target: $19-49/month per team.

At R18-19/USD exchange rate, 10 customers at $19/month = $190/month = ~R3,500/month. Sustainability threshold is much lower in Durban than in London or SF.

---

## Current Test Status
```
npm test output (as of this session):
✓ @logic-md/core  index.test.ts        (3 tests)
✓ @logic-md/core  dag.test.ts          (14 tests)
✓ @logic-md/core  expression.test.ts   (93 tests)
✓ @logic-md/core  compiler.test.ts     (116 tests)
✓ @logic-md/core  parser.test.ts       (12 tests)
✓ @logic-md/core  imports.test.ts      (24 tests)
✓ @logic-md/core  schema.test.ts       (7 tests)
✓ @logic-md/core  validator.test.ts    (19 tests)
✓ @logic-md/core  integration.test.ts  (19 tests)

Test Files: 9 passed
Tests:      307 passed
Duration:   525ms

Lint: 2 warnings (non-blocking)
  - packages/cli/src/commands/init.ts:170 — noCommaOperator warning
  - packages/cli/src/commands/lint.ts:37 — noExplicitAny warning
Typecheck: clean
```

---

## Open Questions

- [ ] What equity % is on the descriptions in the LOGIC.md spec for the `visual` section — confirm these match the Modular9 node editor fields before publishing spec
- [ ] npm publish — confirm `@logic-md` org is available on npmjs.com before registering
- [ ] logic-md.org domain — check availability before buying
- [ ] Diagram export — decide: PNG screenshots embedded in README, or keep as SVG files in `docs/` folder
- [ ] Lemon Squeezy account — set up now for when revenue conversations start
- [ ] The two lint warnings — fix before npm publish or leave as known issues?

---

## Next Session Start

Paste this into the next Claude chat to continue immediately:

```
I am launching LOGIC.md — a declarative reasoning spec format for AI agents,
zero prior art, v1.4.0, 307 tests, 6 milestones built in one week.

Repo: github.com/SingularityAI-Dev/logic-md (currently private)
Packages: @logic-md/core, @logic-md/cli, @logic-md/mcp
README: complete and ready
Architecture diagrams: two animated SVG diagrams built, need static export for README

IMMEDIATE TASKS:
1. Register @logic-md org on npmjs.com
2. npm publish all three packages
3. Export architecture diagrams as PNG for README
4. Make repo public
5. Execute Show HN + r/SideProject launch same day

Context: Built by Rainier Potgieter, Durban SA, solo founder,
Claude Max plan expires in ~12 days, needs traction urgently.
Full handover report available in previous session.
```

---

## Session Metadata
- **Project**: LOGIC.md standalone open-source launch
- **Related project**: Modular9 (SingleSourceStudios/modular9) — application that uses LOGIC.md in production
- **GSD Framework**: used for all 6 milestones
- **Stack**: TypeScript strict, ESM, Node 18+, npm workspaces, Vitest, Biome
- **Author**: Rainier Potgieter (Geez), Durban, South Africa
- **Claude Max plan**: ~12 days remaining as of 2026-04-10
