# LOGIC.md

**The audit and governance layer for AI agent reasoning.**

A portable, framework-agnostic file format for declaring agent reasoning as structured contracts: step DAGs, output schemas, tool permissions, and quality gates. Contracts are validated at compile time, executed deterministically, and produce auditable event traces by default. Where prose prompts give you behaviour, LOGIC.md gives you accountability.

[![npm](https://img.shields.io/npm/v/@logic-md/core?color=7c6fe0&label=%40logic-md%2Fcore)](https://www.npmjs.com/package/@logic-md/core)
[![npm](https://img.shields.io/npm/v/@logic-md/cli?color=2db88a&label=%40logic-md%2Fcli)](https://www.npmjs.com/package/@logic-md/cli)
[![npm](https://img.shields.io/npm/v/@logic-md/mcp?color=e07050&label=%40logic-md%2Fmcp)](https://www.npmjs.com/package/@logic-md/mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-307%20core%20%2F%2018%20mcp-brightgreen)](packages/core)
[![Coverage](https://img.shields.io/badge/coverage-95.9%25%20branch-brightgreen)](packages/core)

Developed alongside and validated in production through [Modular9](https://github.com/SingleSourceStudios/modular9), a visual node-based agent builder by the same author, where the contract-enforcement architecture was first proven at scale. Independently evaluated against [Archon](https://github.com/coleam00/Archon) in a 60-trial controlled experiment ([logic-md-archon-eval](https://github.com/SingularityAI-Dev/logic-md-archon-eval)).

<p align="center">
  <img src="docs/assets/hero-layers.svg" alt="LOGIC.md sits between agent identity (CLAUDE.md), capability (SKILL.md), and protocols (MCP, A2A) as the missing declarative reasoning layer." width="100%"/>
</p>

---

## The problem

Your agent reasoning is locked inside prose prompts. That has three consequences:

**You cannot audit it.** When a regulator, security team, or user asks "why did the agent take that action?", the answer is buried in the model's hidden reasoning trace. Replaying the exact same input rarely produces the exact same output. The audit trail is whatever logs you remembered to add.

**You cannot modify it safely.** Updating a multi-step workflow means editing prose. There are no contracts, no types, no `validate()`. A six-word change can quietly break four downstream consumers. The diff doesn't tell you what changed semantically.

**You cannot trust the consistency.** Two runs of the same workflow on the same input produce different structured outputs at non-trivial rates. On reasoning tasks where the model has multiple plausible paths, prose prompts under-constrain the output enough that the variance becomes a real problem for downstream consumers.

This is not a prompt-engineering problem you can fix by writing better prompts. It is a missing-contracts problem.

Every agent framework gives you identity (`CLAUDE.md`), tools (`SKILL.md`), and memory. None of them give you a portable, framework-agnostic file format for declaring reasoning contracts that travel with your code, validate at compile time, execute deterministically, and produce structured audit trails.

**LOGIC.md fills that gap.**

---

## What it is

LOGIC.md is a markdown file with YAML frontmatter that sits between identity and capability: declaring the reasoning layer your agents are missing.

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

When a node has output contracts, the runtime compiles a structured prompt segment with a `## Required Output` section listing every field the agent must produce, with type and description, and emits the resulting compiled prompt + schema as part of the workflow event trace.

The contract is enforceable, diffable, and auditable. The compiled prompt is deterministic given the spec.

---

## What it controls

**Reasoning strategy**: declare `cot`, `react`, `tot`, `plan-execute`, or `got` per agent. Not hardcoded in imperative Python. Portable across runtimes.

**Step DAGs**: named reasoning stages with `needs` dependencies, parallel execution groups, typed inputs and outputs, confidence thresholds, retry policies, and per-step timeouts.

**Contracts**: typed inputs and outputs following the A2A protocol pattern. When one agent's output becomes another agent's input, LOGIC.md defines exactly what that handoff looks like and enforces it.

**Quality gates**: `pre_output` and `post_output` checks, continuous invariants, and `self_verification` loops using reflection, rubric, checklist, or critic strategies.

**Per-step tool control**: `allowed_tools` and `denied_tools` per step. A research step allows `web_search` but denies `file_write`. An output step allows `file_write` but denies `web_search`. Agents cannot exceed what the step permits.

**Multi-agent DAGs**: `global / nodes / edges` with per-edge contracts and join modes (`wait_all`, `first`, `any`). Parallel agents converge cleanly with defined merge behaviour.

**Fallback and escalation**: escalation chains and graceful degradation rules when steps fail, confidence thresholds are not met, or retries are exhausted.

<p align="center">
  <img src="docs/assets/pipeline-contracts.svg" alt="Animated pipeline showing three reasoning steps linked by typed output contracts, with a quality gate firing a retry loop and a fallback escalation path." width="100%"/>
</p>

<p align="center">
  <img src="docs/assets/quality-gate-loop.svg" alt="Quality gate loop: a step evaluates its own output and branches to pass, retry, or escalate: declarative adaptive computation." width="90%"/>
</p>

---

## Case study: structural consistency under LOGIC.md

This was validated in May 2026 against [Archon](https://github.com/coleam00/Archon), an open-source AI workflow engine, in a 60-trial controlled experiment. Full repo: [logic-md-archon-eval](https://github.com/SingularityAI-Dev/logic-md-archon-eval).

**Setup.** Identical PR-review task. Two configurations on the same Archon node:
- **Case A**: stock prose prompt with Zod output schema. No LOGIC.md.
- **Case B**: same node, reasoning step delegated to LOGIC.md's MCP server (`@logic-md/mcp`) via Archon's existing `mcp:` field. The LOGIC.md spec defines 4 reasoning steps, output contracts, and a deterministic precedence rule for verdict aggregation.

Same model, same fixtures, same harness. Zero patches to Archon. We measure verdict-agreement rate (do the same inputs produce the same verdicts across 10 runs?) and structural hash agreement (`sha256({verdict, critical_count, high_count})`).

**Results across 3 fixtures × 2 cases × 10 runs (60 trials):**

| | Case A (prose) | Case B (LOGIC.md) |
|---|---|---|
| Verdict agreement (auth-sql-injection) | 5/10 different tuples | **10/10 identical** |
| Structural hash agreement (overall) | 70% | **87%** |
| Audit trail | Manual reconstruction | Workflow event JSONL out of the box |
| Modifiability (add HIGH-blocks-PR rule) | 8-line prose edit, no validation | 9-line structured rule + `validate()` |
| Runtime overhead | 1× | 2.6× |

**The headline.** On the auth-sql-injection fixture, Case A produced 5 different `(verdict, critical_count, high_count)` tuples across 10 identical runs. The model's choice between e.g. "1 critical / 2 high" and "2 critical / 1 high" was essentially a coin flip. Case B produced 1 unique tuple — 10/10 identical structured output.

LOGIC.md does not change the verdict (both cases reach `REQUEST_CHANGES`). It eliminates the structural variance in the supporting metadata that downstream consumers depend on.

**Audit and modifiability are properties of the runtime, not separately measured.** Every step's compiled prompt, output schema, and quality-gate result is emitted as a structured workflow event. Adding a new rule (e.g. "any HIGH-severity issue blocks the PR") is a 9-line YAML change with `@logic-md/cli validate` as the contract check. Without LOGIC.md, the equivalent is an 8-line prose edit with no enforcement and no signal that downstream consumers might break.

**The 2.6× runtime cost is real.** LOGIC.md is not free. The trade is consistency, auditability, and safe modifiability against execution speed. For regulated domains, multi-agent pipelines, or any workflow where agent decisions need to be defensible, the trade is worth making. For one-shot prototypes or fast classification gates, it is not.

[Full report with methodology, traces, and per-fixture analysis](https://github.com/SingularityAI-Dev/logic-md-archon-eval/blob/main/REPORT.md).

---

## When to use it: and when not to

**Use LOGIC.md when:**
- You need agent decisions to be auditable. Regulated domains, security teams, internal compliance.
- You have multi-step pipelines where one agent's output feeds another and you need the contract to be enforceable.
- You need consistent verdicts across runs. The same input should produce the same structured output, not a different paraphrase each time.
- Your workflow needs to be safely modifiable by people who didn't author it. Structured contracts catch what prose review misses.
- You need per-step tool permissions, confidence thresholds, or governed fallback policies.
- You want reasoning configuration that is portable across LangGraph, CrewAI, AutoGen, or your own runtime.

**You probably don't need LOGIC.md when:**
- Your agent is a single LLM call with no downstream consumers.
- You're prototyping and don't yet know the shape of your reasoning steps.
- Your workflow is fully covered by a DSPy signature or a single LangGraph node.
- You're optimising for raw output quality on a frontier model. LOGIC.md does not provide measurable quality lift on capable models; structured outputs add overhead.
- You have no quality gates, no contracts between stages, and no multi-agent handoffs.

**Honest disclosure on quality lift.** Cross-model benchmarks (Claude Sonnet 4.6 and Llama 3.1 70B at n=10 per condition) do not show measurable quality lift from LOGIC.md on these tasks. The value is structural — consistency, auditability, modifiability — not generative. Pitch and adopt accordingly. [Benchmark methodology and raw results](benchmarks/published/INDEX.md).

LOGIC.md is a reasoning *contract* format. If you don't have anything to contract between, you don't need it yet.

---

## What LOGIC.md actually delivers

Three properties that fall out of the runtime, not the model:

**1. Structure as a contract.** A LOGIC.md spec compiles into a deterministic execution plan: a DAG with named steps, typed input/output schemas, and quality gates. The compiler is pure: same spec, same plan. The CLI's `validate()` catches contract violations before any LLM is called. Refactors are diffable as structure, not prose.

**2. Audit trail as a default artifact.** Every compiled step's prompt, schema, and gate evaluation is emitted as a structured workflow event (JSONL). The trail is a property of the runtime, not an instrumentation library you remembered to add. When someone asks "what did the agent do?", you have a structured record, not a screen scrape.

**3. Modifications as structured diffs.** Changing a workflow is a YAML edit, validated against the spec. Adding a new rule, tool restriction, or quality gate produces a reviewable diff with type-checked semantics. Adding the equivalent to a prose prompt produces an English edit with no enforcement.

These properties matter most where agent decisions are consequential, replayable, and questioned: regulated industries, security review, compliance workflows, internal governance. They matter least where prompts are throwaway and outputs are not audited.

---

## How this differs from DSPy

DSPy is the most prominent project in the field that approaches declarative reasoning, so it's the right comparison to start with.

**DSPy** is Python-bound, optimizer-driven, and tightly coupled to its own runtime. Signatures are Python classes. Modules compose imperatively. The killer feature is automatic prompt optimization: DSPy *learns* better prompts from examples.

**LOGIC.md** is a portable file format, contracts-first, and runtime-agnostic. Specs are YAML you can check into any repo, validate in CI, and execute from any language. There is no optimizer: LOGIC.md declares the contract, it doesn't tune the prompt. It works with LangGraph, CrewAI, AutoGen, Modular9, or a runtime you write yourself.

**Use DSPy** when you want prompt optimization and you're all-in on Python. **Use LOGIC.md** when you need portable, declarative, multi-agent reasoning contracts that survive framework changes.

The two are not mutually exclusive. A DSPy module could reasonably ship with a LOGIC.md file describing its contracts to the outside world.

---

## How this differs from BAML

[BAML](https://docs.boundaryml.com) (Boundary AI Markup Language) is the closest project in spirit: it's file-based, declarative, and contracts-first. The distinction is scope and abstraction level.

**BAML** defines individual LLM function signatures: input types, output schemas, retry policies, and test cases. It generates type-safe client code in Python, TypeScript, Ruby, Go, Java, and more. The focus is on getting structured, validated outputs from individual LLM calls: and it does this very well.

**LOGIC.md** defines reasoning architecture: step DAGs with dependencies, multi-agent contracts, quality gates with self-verification loops, per-step tool permissions, fallback escalation chains, and workflow-level composition. The focus is on how multiple steps and agents coordinate their reasoning, not on validating individual call outputs.

**Use BAML** when you need type-safe structured outputs from individual LLM functions with cross-language codegen. **Use LOGIC.md** when you need to declare the reasoning flow, dependencies, and contracts across a multi-step or multi-agent pipeline.

A BAML function could be the implementation behind a LOGIC.md step. They compose naturally: BAML handles the output schema for each call, LOGIC.md handles the DAG, contracts between steps, and quality gates across the pipeline.

---

## How this differs from Instructor and Outlines

[Instructor](https://python.useinstructor.com/) and [Outlines](https://github.com/dottxt-ai/outlines) handle structured output validation at the generation layer: ensuring individual LLM calls produce outputs matching a Pydantic model or a constrained grammar. They're excellent at what they do and work with most LLM providers.

LOGIC.md operates at a different abstraction level: reasoning architecture rather than output validation. It defines step ordering, dependencies between agents, quality gates across a pipeline, and multi-agent composition. You'd use Instructor or Outlines *within* a LOGIC.md step to validate that step's output, while LOGIC.md orchestrates how steps relate to each other.

---

## Theoretical grounding

LOGIC.md is best understood as **pipeline-level adaptive computation**: a declarative way to allocate extra reasoning effort (retry, self-verification, fallback) where it is needed, without modifying the underlying model. This connects to three active research threads.

**Adaptive computation and learned halting.** [Universal Transformers](https://arxiv.org/abs/1807.03819) and [PonderNet](https://arxiv.org/abs/2107.05407) show that iterative, variable-depth computation improves reasoning reliability compared to fixed-depth forward passes. [Ouro: Scaling Latent Reasoning via Looped Language Models](https://arxiv.org/abs/2510.25741) extends this with looped LMs that re-enter their own latent state. These techniques operate inside the model. LOGIC.md's quality gates, retry policies, and self-verification loops implement the same primitive: "compute more when the output is not yet good enough": at the orchestration layer, where any model (local, hosted, or mixed) can benefit without retraining.

**Reasoning reliability beyond the base model.** [Yue et al. (2025): *Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?*](https://arxiv.org/abs/2504.13837) argues that RL post-training sharpens capabilities already present in the base model rather than adding new reasoning capacity. If that holds, reliability gains at the application layer must come from structured inference-time scaffolding: contracts, verification, and orchestrated retry. LOGIC.md is a portable format for exactly that scaffolding.

**Scaling limits and the case for inference-time structure.** [Kaplan et al. (2020)](https://arxiv.org/abs/2001.08361) established the original scaling laws; [Villalobos et al. (2022): *Will we run out of data?*](https://arxiv.org/abs/2211.04325) quantifies the approaching limit on human-generated training data. As pretraining returns diminish, reliability increasingly depends on how inference is orchestrated. A portable, declarative format for multi-step reasoning contracts becomes more valuable: not less: in that regime.

LOGIC.md does not replace any of this research. It is inference-time, model-agnostic orchestration. The connection is that it exposes the same adaptive-compute and halting primitives: declaratively, across frameworks: that these papers argue matter for reasoning quality.

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
// workflow.executionPlan: ordered steps with compiled prompt segments
// workflow.globalGates: quality validators
// workflow.fallbackPolicy: escalation chain
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
/logic:status   : detect and show LOGIC.md files in your project
/logic:apply    : load a spec and apply its reasoning scaffold to the current task
/logic:validate : validate all LOGIC.md files in the project
/logic:init     : scaffold a new LOGIC.md interactively
/logic:compile  : show the compiled prompt segment for a specific step
```

Four reasoning workflow templates ship with the plugin: `code-review`, `debug-workflow`, `refactor`, `architecture`.

---

## Format overview

A LOGIC.md file is a markdown document with a YAML frontmatter block. The YAML contains the machine-parseable spec. The markdown body contains human-readable design rationale. Two fields are required (`spec_version` and `name`). Everything else is optional.

**Twelve sections**: `imports`, `reasoning`, `steps`, `contracts`, `quality_gates`, `decision_trees`, `fallback`, `global`, `nodes`, `edges`, `visual`, and metadata fields.

**Imports**: compose external LOGIC.md files with namespace merging and circular detection. Build libraries of reusable reasoning patterns.

**Expression engine**: `{{ ... }}` expressions with dot notation, comparisons, logical ops, array methods (`.length`, `.avg`, `.min`, `.max`, `.every`, `.some`, `.contains`), and ternary expressions. Zero `eval`, zero `Function` constructor.

**DAG resolver**: Kahn's algorithm for topological sort, cycle detection, and parallel execution level computation. Steps with no dependency relationship execute in parallel automatically.

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

- **@logic-md/core**: Parser, validator, compiler, DAG resolver, expression engine, dry-run executor
- **@logic-md/cli**: 9-command CLI: `validate`, `lint`, `compile`, `init`, `test`, `watch`, `fmt`, `diff`, `completion`
- **@logic-md/mcp**: MCP server with 7 tools for AI agent integration

### SDKs

- **TypeScript** (reference implementation): `@logic-md/core` on npm
- **Python** (alpha): Parser + validator, conformance tested: [`sdks/python/`](sdks/python/)

### Adapters

- **LangGraph** (experimental): Converts specs to `StateGraph` definitions: [`adapters/langgraph/`](adapters/langgraph/)

The LangGraph adapter is a Phase 1 proof-of-concept. It produces a graph *definition* rather than an executable `StateGraph` instance, and does not wire branching, quality-gate enforcement, retry loops, or parallel execution: `branches[]` is parsed but not connected to edges, quality gates are captured in metadata but not enforced, and parallel groups execute sequentially. See [adapters/langgraph/STATUS.md](adapters/langgraph/STATUS.md) for the full Phase 1 scope list before building on it.

### Editor Support

- **VSCode extension**: Syntax highlighting + snippets: [`editors/vscode/`](editors/vscode/)

### CI/CD

- **GitHub Action**: Validates `.logic.md` files in any repo: [`.github/actions/validate/`](.github/actions/validate/)

---

## Conformance

LOGIC.md specs are validated against a canonical specification to ensure implementations across languages remain compatible.

- **Canonical JSON Schema** at [`spec/schema.json`](spec/schema.json)
- **18 conformance test fixtures** at [`spec/fixtures/`](spec/fixtures/)
- **Three conformance tiers:**
  - **Parser**: Read and tokenize LOGIC.md files
  - **Runtime**: Parse, validate, and execute execution plans
  - **Full Adapter**: Implement all features including quality gates and multi-agent DAGs

For building implementations in other languages, see [`docs/IMPLEMENTER-GUIDE.md`](docs/IMPLEMENTER-GUIDE.md).

### Known implementations

| Language | Package | Conformance | Maintainer |
|----------|---------|-------------|------------|
| TypeScript | @logic-md/core | Full | SingularityAI-Dev |
| Python | logic-md (alpha) | Parser | SingularityAI-Dev |

---

## Status

- **v1.4.0**: three packages, validated through Modular9 integration
- **325 tests** across `@logic-md/core` (307) and `@logic-md/mcp` (18)
- **95.9% branch coverage** on the compiler module (100% statements / functions / lines)
- **9 CLI commands**: validate, lint, compile, init, test, watch, fmt, diff, completion
- **7 MCP tools**: parse, validate, lint, compile_step, compile_workflow, init, list_templates
- **16 CLI templates + 4 Claude Code workflow templates**

---

## Benchmarks and honest disclosure

LOGIC.md's value proposition is structural — consistency, auditability, modifiability — not generative quality lift. The benchmarks below substantiate that distinction.

**Quality lift: no measurable signal on these tasks (2026-05-07).** Cross-model sweep at n=10 per condition:

| Model | Tasks | Result |
|---|---|---|
| Claude Sonnet 4.6 | code-review | Control 99/100, treatment 100/100. Ceiling effect. |
| Llama 3.1 70B (Nvidia NIM) | code-review, research-synthesis, security-audit | Flat to slightly negative after excluding 7 infrastructure-failure runs. |

Raw results, per-trial JSON, and analysis: [`benchmarks/published/`](benchmarks/published/INDEX.md).

The honest reading: on capable models with reasonable prose prompts on these tasks, LOGIC.md does not produce measurable quality lift. Treat any positioning that claims otherwise with scepticism, including older versions of this README. **Use LOGIC.md for structure and governance, not for quality.**

Open methodology questions are catalogued in `benchmarks/published/INDEX.md` (rigid scoring rubric, strict enum validation, n=10 too small, fixtures may be too easy). Re-runs at higher n on a paid tier are queued.

**Structural consistency: clean positive signal (2026-05-06).** A separate 60-trial integration test against [Archon](https://github.com/coleam00/Archon) measured verdict-agreement and structural-hash agreement under stock prose vs LOGIC.md compiled prompts on the same node:

| | Case A (prose) | Case B (LOGIC.md) |
|---|---|---|
| Hash agreement (overall) | 70% | **87%** |
| auth-sql-injection fixture | 5/10 different `(verdict, critical, high)` tuples | **10/10 identical** |

Full repo with methodology, raw traces, and report: [logic-md-archon-eval](https://github.com/SingularityAI-Dev/logic-md-archon-eval).

**Why the two findings don't conflict.** Quality lift measures whether outputs are *better*. Structural consistency measures whether outputs are *the same across runs*. LOGIC.md doesn't appear to make individual outputs better — it makes the distribution across runs tighter, which is what audit, replay, and downstream-pipeline contracts actually need.

**Reproducing.** The cross-model harness is at [`benchmarks/`](benchmarks/) and runs against any Anthropic, OpenAI, or Nvidia NIM endpoint. The Archon eval harness is in the [eval repo](https://github.com/SingularityAI-Dev/logic-md-archon-eval). All raw outputs are published. If you have credits and want to co-run at higher n or on additional models, [open an issue](https://github.com/SingularityAI-Dev/logic-md/issues).

---

## Roadmap

**Shipped (v1.4)**
- `@logic-md/core`, `@logic-md/cli`, `@logic-md/mcp` on npm · `logic-md` (alpha) on PyPI
- 9-command CLI with 16 templates · 7-tool MCP server (stdio + HTTP)
- LangGraph adapter (experimental) · VSCode extension · GitHub Action for CI
- 325 tests · 95.9% branch coverage on compiler · 18 conformance fixtures · canonical JSON Schema

**Near term**
- Cross-model benchmark expansion: re-run at n=30 on a paid tier (eliminate Nvidia connection-drop noise), add Haiku 4.5 within-vendor comparison, add DeepSeek V3 / Qwen 2.5 as current open-model data points
- Benchmark scoring system audit: investigate the rigid penalty thresholds surfaced in 2026-05-07 results
- VSCode marketplace publish
- Python SDK feature parity: compiler + dry-run executor matching TypeScript
- LangGraph adapter Phase 2: branch support, quality-gate enforcement, parallel execution
- Documentation site at logic-md.org

**Medium term**
- CrewAI and AutoGen adapters
- Template marketplace (cursor.directory model)
- Additional language implementations (Rust / Go): the canonical JSON Schema makes these tractable
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

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributors must sign the CLA: contributions become part of the package and are published under MIT.
