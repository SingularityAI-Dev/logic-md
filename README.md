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

<p align="center">
  <img src="docs/assets/hero-layers.svg" alt="LOGIC.md sits between agent identity (CLAUDE.md), capability (SKILL.md), and protocols (MCP, A2A) as the missing declarative reasoning layer." width="100%"/>
</p>

---

## The problem

Your agent describes what it would do instead of doing it.

```
"As a Security Auditor, I would perform an OWASP Top 10 review
and map findings to CWE IDs. I would then scan for injection
vulnerabilities..."
```

The next node in your pipeline receives an intent description, not data. Your workflow becomes a chain of *I would do X* statements that never produce real artifacts.

<p align="center">
  <img src="docs/assets/describing-vs-doing.svg" alt="Before and after LOGIC.md: agents that describe intent versus agents that emit structured artifacts that flow to the next step." width="100%"/>
</p>

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

<p align="center">
  <img src="docs/assets/pipeline-contracts.svg" alt="Animated pipeline showing three reasoning steps linked by typed output contracts, with a quality gate firing a retry loop and a fallback escalation path." width="100%"/>
</p>

<p align="center">
  <img src="docs/assets/quality-gate-loop.svg" alt="Quality gate loop: a step evaluates its own output and branches to pass, retry, or escalate — declarative adaptive computation." width="90%"/>
</p>

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

## Theoretical grounding

LOGIC.md is best understood as **pipeline-level adaptive computation**: a declarative way to allocate extra reasoning effort (retry, self-verification, fallback) where it is needed, without modifying the underlying model. This connects to three active research threads.

**Adaptive computation and learned halting.** [Universal Transformers](https://arxiv.org/abs/1807.03819) and [PonderNet](https://arxiv.org/abs/2107.05407) show that iterative, variable-depth computation improves reasoning reliability compared to fixed-depth forward passes. [Ouro — Scaling Latent Reasoning via Looped Language Models](https://arxiv.org/abs/2510.25741) extends this with looped LMs that re-enter their own latent state. These techniques operate inside the model. LOGIC.md's quality gates, retry policies, and self-verification loops implement the same primitive — "compute more when the output is not yet good enough" — at the orchestration layer, where any model (local, hosted, or mixed) can benefit without retraining.

**Reasoning reliability beyond the base model.** [Yue et al. (2025) — *Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?*](https://arxiv.org/abs/2504.13837) argues that RL post-training sharpens capabilities already present in the base model rather than adding new reasoning capacity. If that holds, reliability gains at the application layer must come from structured inference-time scaffolding: contracts, verification, and orchestrated retry. LOGIC.md is a portable format for exactly that scaffolding.

**Scaling limits and the case for inference-time structure.** [Kaplan et al. (2020)](https://arxiv.org/abs/2001.08361) established the original scaling laws; [Villalobos et al. (2022) — *Will we run out of data?*](https://arxiv.org/abs/2211.04325) quantifies the approaching limit on human-generated training data. As pretraining returns diminish, reliability increasingly depends on how inference is orchestrated. A portable, declarative format for multi-step reasoning contracts becomes more valuable — not less — in that regime.

LOGIC.md does not replace any of this research. It is inference-time, model-agnostic orchestration. The connection is that it exposes the same adaptive-compute and halting primitives — declaratively, across frameworks — that these papers argue matter for reasoning quality.

---

## Packages

| Package | Description | Install |
|---|---|---|
| `@logic-md/core` | Parser, validator, expression engine, DAG resolver, reasoning compiler | `npm i @logic-md/core` |
| `@logic-md/cli` | 9 commands, 16 templates, shell completion for bash/zsh/fish | `npm i -g @logic-md/cli` |
| `@logic-md/mcp` | 7 MCP tools over stdio and HTTP, works with any MCP host | `npm i @logic-md/mcp` |

---

## Getting Started

### As a library (TypeScript)

Install the core package:

```bash
npm install @logic-md/core
```

Parse, validate, and compile specs:

```typescript
import { parse, validate, compile } from "@logic-md/core";

const spec = parse(markdownContent);
const validated = validate(spec);
const workflow = compile(validated);
// workflow.executionPlan — ordered steps with compiled prompt segments
// workflow.globalGates — quality validators
// workflow.fallbackPolicy — escalation chain
```

### As a CLI tool

Install globally:

```bash
npm install -g @logic-md/cli
```

Use the 9-command interface:

```bash
# Validate a LOGIC.md file
logic-md validate my-agent.logic.md

# Lint for best practices (unused steps, missing fallbacks)
logic-md lint my-agent.logic.md

# Scaffold from a template
logic-md init --template researcher

# Compile a single step to see its runtime prompt segment
logic-md compile my-agent.logic.md --step gather_sources

# Semantic diff between two specs
logic-md diff v1.logic.md v2.logic.md

# Watch mode for development
logic-md watch my-agent.logic.md
```

**Built-in templates (16):** `minimal`, `analyst`, `researcher`, `summarizer`, `extractor`, `reviewer`, `code-review`, `validator`, `generator`, `classifier`, `refactor`, `planner`, `orchestrator`, `debugger`, `debug-workflow`, `architecture`

### In Python (alpha)

The Python SDK is available at [`sdks/python/`](sdks/python/) with parser and validator support. Install from source:

```bash
cd sdks/python
pip install -e .
```

See the Python SDK README for usage examples.

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

| | Handles | Portable |
|---|---|---|
| CLAUDE.md / AGENTS.md | Identity, project context, code style | Markdown |
| OpenClaw SOUL.md | Personality, behavioural rules | Markdown |
| Cursor `.mdc` rules | Coding conventions with activation modes | Markdown |
| MCP | Agent ↔ tool connectivity | Protocol |
| A2A Protocol | Agent ↔ agent communication | Protocol |
| BAML | Typed output schemas, cross-language codegen | Custom DSL |
| Instructor | Pydantic validation for individual LLM calls | Library |
| LangGraph | Reasoning as imperative StateGraph code | Python |
| CrewAI | YAML for roles/tasks, reasoning as a bool | Partial |
| AutoGen | Conversation patterns, reasoning in messages | Python |
| DSPy | Composable signatures + prompt optimization | Python |
| **LOGIC.md** | **Step DAGs, contracts, quality gates, multi-agent** | **Markdown / YAML** |

---

## Ecosystem

The logic-md ecosystem spans packages, SDKs, adapters, editor support, and CI/CD tooling.

### Packages (all on npm)

- **@logic-md/core** — Parser, validator, compiler, DAG resolver, expression engine, dry-run executor
- **@logic-md/cli** — 9-command CLI: `validate`, `lint`, `compile`, `init`, `test`, `watch`, `fmt`, `diff`, `completion`
- **@logic-md/mcp** — MCP server with 7 tools for AI agent integration

### SDKs

- **TypeScript** (reference implementation) — `@logic-md/core` on npm
- **Python** (alpha) — Parser + validator, conformance tested — [`sdks/python/`](sdks/python/)

### Adapters

- **LangGraph** (experimental) — Converts specs to `StateGraph` definitions — [`adapters/langgraph/`](adapters/langgraph/)

The LangGraph adapter is a Phase 1 proof-of-concept. It produces a graph *definition* rather than an executable `StateGraph` instance, and does not wire branching, quality-gate enforcement, retry loops, or parallel execution — `branches[]` is parsed but not connected to edges, quality gates are captured in metadata but not enforced, and parallel groups execute sequentially. See [adapters/langgraph/STATUS.md](adapters/langgraph/STATUS.md) for the full Phase 1 scope list before building on it.

### Editor Support

- **VSCode extension** — Syntax highlighting + snippets — [`editors/vscode/`](editors/vscode/)

### CI/CD

- **GitHub Action** — Validates `.logic.md` files in any repo — [`.github/actions/validate/`](.github/actions/validate/)

---

## Conformance

LOGIC.md specs are validated against a canonical specification to ensure implementations across languages remain compatible.

- **Canonical JSON Schema** at [`spec/schema.json`](spec/schema.json)
- **18 conformance test fixtures** at [`spec/fixtures/`](spec/fixtures/)
- **Three conformance tiers:**
  - **Parser** — Read and tokenize LOGIC.md files
  - **Runtime** — Parse, validate, and execute execution plans
  - **Full Adapter** — Implement all features including quality gates and multi-agent DAGs

For building implementations in other languages, see [`docs/IMPLEMENTER-GUIDE.md`](docs/IMPLEMENTER-GUIDE.md).

### Known implementations

| Language | Package | Conformance | Maintainer |
|----------|---------|-------------|------------|
| TypeScript | @logic-md/core | Full | SingularityAI-Dev |
| Python | logic-md (alpha) | Parser | SingularityAI-Dev |

---

## Status

- **v1.4.0** — three packages, validated through Modular9 integration
- **325 tests** across `@logic-md/core` (307) and `@logic-md/mcp` (18)
- **95.9% branch coverage** on the compiler module (100% statements / functions / lines)
- **9 CLI commands** — validate, lint, compile, init, test, watch, fmt, diff, completion
- **7 MCP tools** — parse, validate, lint, compile_step, compile_workflow, init, list_templates
- **16 CLI templates + 4 Claude Code workflow templates**

---

## Benchmarks

LOGIC.md's thesis — that declarative contracts + quality gates measurably improve multi-step reasoning reliability — is internally validated (Modular9 integration) but not yet benchmarked across model families.

**Preliminary (Llama 3.1 70B, April 2026):** single-model artifact-rate comparison between freeform prompting and LOGIC.md-compiled prompts. Deltas were within variance. Conclusion: inconclusive on weaker open-weight models; a meaningful signal likely requires frontier models where instruction-following is tight enough to expose the contract effect. See [`benchmarks/`](benchmarks/) for the harness and raw runs.

**Next:** cross-model sweep on Claude Sonnet and GPT-4o class models, same harness, measuring (a) artifact-rate — does the step produce the declared output shape, (b) handoff fidelity — does the next step receive usable data, and (c) latency-adjusted reliability under a fixed retry budget.

If you have API credits and want to co-run the benchmark, [open an issue](https://github.com/SingularityAI-Dev/logic-md/issues) — the harness is reproducible and raw outputs will be published regardless of outcome.

---

## Roadmap

**Shipped (v1.4)**
- `@logic-md/core`, `@logic-md/cli`, `@logic-md/mcp` on npm · `logic-md` (alpha) on PyPI
- 9-command CLI with 16 templates · 7-tool MCP server (stdio + HTTP)
- LangGraph adapter (experimental) · VSCode extension · GitHub Action for CI
- 325 tests · 95.9% branch coverage on compiler · 18 conformance fixtures · canonical JSON Schema

**Near term**
- Cross-model benchmark suite on frontier models (Claude Sonnet, GPT-4o)
- VSCode marketplace publish
- Python SDK feature parity — compiler + dry-run executor matching TypeScript
- LangGraph adapter Phase 2 — branch support, quality-gate enforcement, parallel execution — timeline TBD, pending frontier-model benchmark results
- Documentation site at logic-md.org

**Medium term**
- CrewAI and AutoGen adapters
- Template marketplace (cursor.directory model)
- Additional language implementations (Rust / Go) — the canonical JSON Schema makes these tractable
- Reasoning pattern analytics on collected conformance traces

**Long term**
- Hosted validation + analytics dashboard
- v2.0 spec absorbing new reasoning paradigms (looped / latent / adaptive-depth) as they stabilise
- Compliance tooling for regulated deployments

---

## Development

```bash
git clone https://github.com/SingularityAI-Dev/logic-md.git
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
