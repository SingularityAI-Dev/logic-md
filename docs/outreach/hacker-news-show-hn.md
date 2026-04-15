# Show HN: LOGIC.md — Declarative Reasoning Contracts for AI Agents

## Title
LOGIC.md – Portable reasoning specs for AI agents (think OpenAPI for reasoning)

## Body

**What it is**

LOGIC.md is a declarative file format for specifying how an AI agent thinks — reasoning strategy, step dependencies, output contracts, quality gates, and fallback policies — defined in YAML instead of hardcoded in framework-specific code.

**The problem it solves**

Agent frameworks give you identity files (CLAUDE.md), tools (SKILL.md), and memory. None give you a portable, framework-agnostic way to declare reasoning contracts — the critical dependencies and handoffs between reasoning steps.

Without it, multi-step agent pipelines degrade predictably. Node A produces an intent summary instead of structured data. Node B receives it and produces another summary. The pipeline never produces actual artifacts. This is not a prompt problem; it is a contracts problem.

**Why it's different**

- **BAML** validates individual LLM call outputs. LOGIC.md orchestrates multi-step reasoning: DAGs, dependencies, quality gates, and multi-agent handoffs.
- **DSPy** optimizes prompts within Python. LOGIC.md is a portable file format you can check into any repo, validate in CI, and execute from TypeScript, Python, or any language.
- **LangGraph** is imperative Python StateGraph code. LOGIC.md is declarative YAML that compiles to any framework, so your reasoning contracts survive framework changes.

**What's working**

- Validated through Modular9, a visual node-based agent builder. Before LOGIC.md specs, Modular9 workflows produced "I would do X" descriptions from every node. After adding LOGIC.md contracts, each node produces actual artifacts that the next node consumes as data. The pipeline works end-to-end.
- 325 tests across the TypeScript implementation (307 core + 18 MCP).
- Three npm packages: `@logic-md/core` (parser, validator, compiler), `@logic-md/cli` (9 commands), `@logic-md/mcp` (7 MCP tools).
- Python SDK (alpha, on PyPI) with parser and validator.
- Adapters: LangGraph (experimental), VSCode extension, GitHub Action for CI validation.

**What's not done**

- No external adopters yet. The validation is internal to Modular9. We need real-world feedback on whether this solves problems for other teams.
- Preliminary benchmark on Llama 3.1 70B was inconclusive (deltas within variance). Cross-model sweep on frontier models (Claude Sonnet, GPT-4o class) is the next experiment. Harness and raw runs are in the repo regardless of outcome.
- Framework adapter ecosystem is nascent. LangGraph adapter exists. CrewAI and AutoGen adapters are planned.

**Where to find it**

- GitHub: [github.com/SingularityAI-Dev/logic-md](https://github.com/SingularityAI-Dev/logic-md)
- Spec: [docs/SPEC.md](https://github.com/SingularityAI-Dev/logic-md/blob/main/docs/SPEC.md)
- npm: `@logic-md/core`, `@logic-md/cli`, `@logic-md/mcp`
- PyPI: `logic-md`

---

This is early-stage, single-author validated work. The format is stable (v1.0), but adoption is zero. If you're building multi-step agent systems and hitting the problem of agents describing what they'd do instead of doing it, I'd appreciate your feedback on whether LOGIC.md is actually useful.
