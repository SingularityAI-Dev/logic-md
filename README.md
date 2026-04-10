# LOGIC.md

**The declarative reasoning layer for AI agents.**

A portable, framework-agnostic file format for specifying *how* an agent thinks — strategy, step DAGs, contracts, quality gates, and fallback policies — declared in YAML rather than hardcoded in Python.

[![npm](https://img.shields.io/npm/v/@logic-md/core?color=7c6fe0&label=%40logic-md%2Fcore)](https://www.npmjs.com/package/@logic-md/core)
[![npm](https://img.shields.io/npm/v/@logic-md/cli?color=2db88a&label=%40logic-md%2Fcli)](https://www.npmjs.com/package/@logic-md/cli)
[![npm](https://img.shields.io/npm/v/@logic-md/mcp?color=e07050&label=%40logic-md%2Fmcp)](https://www.npmjs.com/package/@logic-md/mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-307%20core%20%2F%2018%20mcp-brightgreen)](packages/core)
[![Coverage](https://img.shields.io/badge/coverage-95.9%25%20branch-brightgreen)](packages/core)

Developed alongside and validated through [Modular9](https://github.com/SingleSourceStudios/modular9), a visual node-based agent builder by the same author, where it addressed a common agent pipeline failure mode that ad-hoc prompt engineering could not reliably solve at scale.

---

## The problem

Your agent describes what it would do instead of doing it.

```
"As a Security Auditor, I would perform an OWASP Top 10 review
and map findings to CWE IDs. I would then scan for injection
vulnerabilities..."
```

The next node in your pipeline receives an intent description, not data. Your workflow becomes a chain of *I would do X* statements that never produce real artifacts.

This is not a prompt engineering problem. It is a missing contracts problem.

Every agent framework gives you identity (`CLAUDE.md`), tools (`SKILL.md`), and memory. None of them give you a portable, framework-agnostic file format for declaring reasoning contracts — step dependencies, quality gates, and multi-agent handoffs — that travels with your code and survives framework changes.

**LOGIC.md fills that gap.**

---

## What it is

LOGIC.md is a markdown file with YAML frontmatter that sits between identity and capability — declaring the reasoning layer your agents are missing.

```yaml
spec_version: "1.0"
name: security-auditor
reasoning:
  strategy: plan-execute
steps:
  - name: audit
    instructions: "Produce the actual audit report"
    contracts:
      outputs:
        findings: array
        severity: string
    quality_gates:
      post_output:
        - check: "outputs.findings.length > 0"
          action: retry
```

When a node has output contracts, the runtime injects:

> *You MUST produce a concrete artifact. Your output IS the deliverable.*

Agents stop describing. They start doing.

---

## What it controls

**Reasoning strategy** — declare `cot`, `react`, `tot`, `plan-execute`, or `got` per agent. Not hardcoded in imperative Python. Portable across runtimes.

**Step DAGs** — named reasoning stages with `needs` dependencies, parallel execution groups, typed inputs and outputs, confidence thresholds, retry policies, and per-step timeouts.

**Contracts** — typed inputs and outputs following the A2A protocol pattern. When one agent's output becomes another agent's input, LOGIC.md defines exactly what that handoff looks like and enforces it.

**Quality gates** — `pre_output` and `post_output` checks, continuous invariants, and `self_verification` loops using reflection, rubric, checklist, or critic strategies.

**Per-step tool control** — `allowed_tools` and `denied_tools` per step. A research step allows `web_search` but denies `file_write`. An output step allows `file_write` but denies `web_search`. Agents cannot exceed what the step permits.

**Multi-agent DAGs** — `global / nodes / edges` with per-edge contracts and join modes (`wait_all`, `first`, `any`). Parallel agents converge cleanly with defined merge behaviour.

**Fallback and escalation** — escalation chains and graceful degradation rules when steps fail, confidence thresholds are not met, or retries are exhausted.

---

## Case study: the describing-vs-doing fix

This was validated during the Modular9 integration.

Before LOGIC.md, running a Modular9 workflow produced output like *"As a Security Auditor, I would perform an OWASP Top 10 review..."* from every node — intent descriptions instead of artifacts. The next node in the chain received a summary of what the previous node would have done, not the thing itself. Pipelines never produced real deliverables end-to-end.

The root cause was two compounding gaps. Plugin identity prompts said *"You are a Security Auditor specialist"* but never said *"produce the actual artifact"* — role-descriptive, not action-directive. And the user prompt framing was vague enough that the LLM defaulted to a conversational summary instead of structured output.

Three changes, all enabled by LOGIC.md contracts, solved it permanently:

1. **Execution mandate** — every node's system prompt gains: *"You are a node in an automated pipeline. Your output IS the artifact."*

2. **Output contract injection** — when a node has `contracts.outputs`, the user prompt gains a structured `## Required Output` section listing every field the agent must produce with type and description.

3. **Input framing** — previous node output is labeled `## Input Data` with contract field descriptions, so the agent knows it is transforming structured data, not answering a question.

The result: each node now produces actual deliverables. Node A writes the audit report. Node B receives it as data and produces the threat model. Node C receives that and produces the Slack summary. The pipeline produces real artifacts end-to-end.

The underlying techniques — execution mandates, output contract injection, structured input framing — are established patterns in prompt engineering. What made them hard to apply was doing it consistently across every node in a pipeline without framework-specific glue code. LOGIC.md provides a declarative, portable way to apply them systematically: **the fix travels with the spec rather than being buried in imperative code**.

---

## When to use it — and when not to

**Use LOGIC.md when:**
- You have multi-step agent pipelines where one agent's output feeds another
- You need reproducible, auditable reasoning that survives model swaps
- You're hitting the describing-vs-doing failure mode
- You need per-step tool permissions, confidence thresholds, or structured fallback
- You want reasoning configuration that is portable across LangGraph, CrewAI, AutoGen, or your own runtime

**You probably don't need LOGIC.md when:**
- Your agent is a single LLM call with no downstream consumers
- You're prototyping and don't yet know the shape of your reasoning steps
- Your workflow is fully covered by a DSPy signature or a single LangGraph node
- You have no quality gates, no contracts between stages, and no multi-agent handoffs

LOGIC.md is a reasoning *contract* format. If you don't have anything to contract between, you don't need it yet.

---

## How this differs from DSPy

DSPy is the most prominent project in the field that approaches declarative reasoning, so it's the right comparison to start with.

**DSPy** is Python-bound, optimizer-driven, and tightly coupled to its own runtime. Signatures are Python classes. Modules compose imperatively. The killer feature is automatic prompt optimization — DSPy *learns* better prompts from examples.

**LOGIC.md** is a portable file format, contracts-first, and runtime-agnostic. Specs are YAML you can check into any repo, validate in CI, and execute from any language. There is no optimizer — LOGIC.md declares the contract, it doesn't tune the prompt. It works with LangGraph, CrewAI, AutoGen, Modular9, or a runtime you write yourself.

**Use DSPy** when you want prompt optimization and you're all-in on Python. **Use LOGIC.md** when you need portable, declarative, multi-agent reasoning contracts that survive framework changes.

The two are not mutually exclusive. A DSPy module could reasonably ship with a LOGIC.md file describing its contracts to the outside world.

---

## How this differs from BAML

[BAML](https://docs.boundaryml.com) (Boundary AI Markup Language) is the closest project in spirit — it's file-based, declarative, and contracts-first. The distinction is scope and abstraction level.

**BAML** defines individual LLM function signatures: input types, output schemas, retry policies, and test cases. It generates type-safe client code in Python, TypeScript, Ruby, Go, Java, and more. The focus is on getting structured, validated outputs from individual LLM calls — and it does this very well.

**LOGIC.md** defines reasoning architecture: step DAGs with dependencies, multi-agent contracts, quality gates with self-verification loops, per-step tool permissions, fallback escalation chains, and workflow-level composition. The focus is on how multiple steps and agents coordinate their reasoning, not on validating individual call outputs.

**Use BAML** when you need type-safe structured outputs from individual LLM functions with cross-language codegen. **Use LOGIC.md** when you need to declare the reasoning flow, dependencies, and contracts across a multi-step or multi-agent pipeline.

A BAML function could be the implementation behind a LOGIC.md step. They compose naturally — BAML handles the output schema for each call, LOGIC.md handles the DAG, contracts between steps, and quality gates across the pipeline.

---

## How this differs from Instructor and Outlines

[Instructor](https://python.useinstructor.com/) and [Outlines](https://github.com/dottxt-ai/outlines) handle structured output validation at the generation layer — ensuring individual LLM calls produce outputs matching a Pydantic model or a constrained grammar. They're excellent at what they do and work with most LLM providers.

LOGIC.md operates at a different abstraction level: reasoning architecture rather than output validation. It defines step ordering, dependencies between agents, quality gates across a pipeline, and multi-agent composition. You'd use Instructor or Outlines *within* a LOGIC.md step to validate that step's output, while LOGIC.md orchestrates how steps relate to each other.

---

## Packages

| Package | Description | Install |
|---|---|---|
| `@logic-md/core` | Parser, validator, expression engine, DAG resolver, reasoning compiler | `npm i @logic-md/core` |
| `@logic-md/cli` | 9 commands, 12 templates, shell completion for bash/zsh/fish | `npm i -g @logic-md/cli` |
| `@logic-md/mcp` | 7 MCP tools over stdio and HTTP, works with any MCP host | `npm i @logic-md/mcp` |

---

## Quick start

### Core

```typescript
import { parse, validate, compile } from "@logic-md/core";

const spec = parse(markdownContent);
const validated = validate(spec);
const workflow = compile(validated);
// workflow.executionPlan — ordered steps with compiled prompt segments
// workflow.globalGates — quality validators
// workflow.fallbackPolicy — escalation chain
```

### CLI

```bash
# Validate a LOGIC.md file
logic-md validate my-agent.logic.md

# Lint for best practices (unused steps, missing fallbacks)
logic-md lint my-agent.logic.md

# Scaffold from a template
logic-md init --template research-synthesizer

# Compile a single step to see its runtime prompt segment
logic-md compile my-agent.logic.md --step gather_sources

# Semantic diff between two specs
logic-md diff v1.logic.md v2.logic.md

# Watch mode for development
logic-md watch my-agent.logic.md
```

**Built-in templates:** `research-synthesizer`, `code-reviewer`, `data-analyst`, `customer-support`, `content-writer`, `security-auditor`, `bug-triager`, `api-integrator`, `document-summarizer`, `decision-maker`, `plan-and-execute`, `react-loop`

### MCP server

Add to your MCP host config:

```json
{
  "mcpServers": {
    "logic-md": {
      "command": "npx",
      "args": ["@logic-md/mcp"]
    }
  }
}
```

Seven tools become available: `logic_md_parse`, `logic_md_validate`, `logic_md_lint`, `logic_md_compile_step`, `logic_md_compile_workflow`, `logic_md_init`, `logic_md_list_templates`.

Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible host without an npm install on the host side.

### Claude Code plugin

Five slash commands via the built-in integration:

```
/logic:status    — detect and show LOGIC.md files in your project
/logic:apply     — load a spec and apply its reasoning scaffold to the current task
/logic:validate  — validate all LOGIC.md files in the project
/logic:init      — scaffold a new LOGIC.md interactively
/logic:compile   — show the compiled prompt segment for a specific step
```

Four reasoning workflow templates ship with the plugin: `code-review`, `debug-workflow`, `refactor`, `architecture`.

---

## Format overview

A LOGIC.md file is a markdown document with a YAML frontmatter block. The YAML contains the machine-parseable spec. The markdown body contains human-readable design rationale. Two fields are required (`spec_version` and `name`). Everything else is optional.

**Twelve sections** — `imports`, `reasoning`, `steps`, `contracts`, `quality_gates`, `decision_trees`, `fallback`, `global`, `nodes`, `edges`, `visual`, and metadata fields.

**Imports** — compose external LOGIC.md files with namespace merging and circular detection. Build libraries of reusable reasoning patterns.

**Expression engine** — `{{ ... }}` expressions with dot notation, comparisons, logical ops, array methods (`.length`, `.avg`, `.min`, `.max`, `.every`, `.some`, `.contains`), and ternary expressions. Zero `eval`, zero `Function` constructor.

**DAG resolver** — Kahn's algorithm for topological sort, cycle detection, and parallel execution level computation. Steps with no dependency relationship execute in parallel automatically.

See [`docs/SPEC.md`](docs/SPEC.md) for the full v1.0 specification.

---

## What exists today vs LOGIC.md

| Standard / Framework | What it handles | Portable file format? |
|---|---|---|
| CLAUDE.md / AGENTS.md | Identity, project context, build commands, code style | Yes (markdown) |
| OpenClaw SOUL.md | Personality, behavioural rules, agent identity | Yes (markdown) |
| Cursor .mdc rules | Coding conventions with activation modes | Yes (markdown) |
| MCP | Agent ↔ tool connectivity | Protocol spec |
| A2A Protocol | Agent ↔ agent communication | Protocol spec |
| BAML | Type-safe output schemas, structured extraction, cross-language codegen | Yes (custom DSL) |
| Instructor | Pydantic-based output validation for individual LLM calls | No (library) |
| LangGraph | Reasoning as imperative Python StateGraph code | No (Python) |
| CrewAI | YAML for agent roles and tasks — reasoning is a boolean flag | Partial (YAML + Python) |
| AutoGen | Conversation patterns in Python — reasoning in system messages | No (Python) |
| DSPy | Composable signatures with prompt optimization — declarative but Python-bound | No (Python) |
| **LOGIC.md** | **Reasoning flow, step DAGs, multi-agent contracts, quality gates** | **Yes (markdown/YAML)** |

---

## Status

- **v1.4.0** — three packages, validated through Modular9 integration
- **325 tests** across `@logic-md/core` (307) and `@logic-md/mcp` (18)
- **95.9% branch coverage** on the compiler module (100% statements / functions / lines)
- **9 CLI commands** — validate, lint, compile, init, test, watch, fmt, diff, completion
- **7 MCP tools** — parse, validate, lint, compile_step, compile_workflow, init, list_templates
- **12 CLI templates + 4 Claude Code workflow templates**

---

## Roadmap

**Near term**
- Publish `@logic-md/core`, `@logic-md/cli`, `@logic-md/mcp` to npm
- Documentation site at logic-md.org with spec reference and getting started guide
- Template marketplace following the cursor.directory model

**Medium term**
- Framework adapters: LangGraph wrapper, CrewAI integration, AutoGen integration
- VSCode extension for syntax highlighting, validation, and inline lint
- GitHub Action for CI validation and lint in PRs
- Python SDK matching the TypeScript spec exactly

**Long term**
- Enterprise features: hosted dashboard, reasoning pattern analytics, compliance tooling
- v2.0 spec incorporating new reasoning paradigms as they emerge

---

## Development

```bash
git clone https://github.com/SingleSourceStudios/logic-md.git
cd logic-md
npm install
npm test          # tests across all packages
npm run lint      # biome check
npm run typecheck # tsc --build
```

**Stack:** TypeScript strict mode, ESM modules, Node 18+, npm workspaces, Vitest, Biome, gray-matter, ajv, js-yaml, @modelcontextprotocol/sdk, chokidar.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributors must sign the CLA — contributions become part of the package and are published under MIT.

---

*Built by [Rainier Potgieter](https://github.com/SingleSourceStudios) · Durban, South Africa · MIT licensed*
