# r/LocalLLaMA Post: LOGIC.md – Portable Reasoning Contracts for Local Agent Pipelines

## Title
LOGIC.md – Framework-agnostic reasoning specs for multi-step agent pipelines | Now with Python SDK (alpha)

## Body

**TL;DR:** LOGIC.md is a YAML-based file format for declaring how multi-agent pipelines reason — step dependencies, output contracts, quality gates, and fallback policies. Write once, run on LangGraph, CrewAI, Ollama-based systems, or your custom runtime. Python SDK is in alpha on PyPI.

**The problem**

You build a multi-step agent pipeline with local models:
1. Research node gathers sources
2. Analysis node processes findings
3. Output node formats and summarizes

But node 1 produces a summary of what it *would* research, not actual research data. Node 2 receives that vague summary and produces another summary. Node 3 has nothing concrete to work with.

It's not a prompt problem. It's a contracts problem. Your nodes have no contract enforcing what the previous step must actually produce.

**Here's what a LOGIC.md spec looks like:**

```yaml
---
spec_version: "1.0"
name: research-pipeline
steps:
  - name: gather_sources
    instructions: "Research the topic and produce a structured report"
    contracts:
      outputs:
        sources:
          type: array
          items:
            type: object
            properties:
              title: { type: string }
              url: { type: string }
              summary: { type: string }
        key_findings: { type: string }
    quality_gates:
      post_output:
        - check: "outputs.sources.length > 0"
          action: retry
          max_retries: 3

  - name: synthesize
    instructions: "Turn the sources into a coherent analysis"
    needs: [gather_sources]  # explicit dependency
    contracts:
      inputs:
        sources: { type: array }
      outputs:
        analysis: { type: string }
        confidence: { type: number, minimum: 0, maximum: 1 }
    quality_gates:
      post_output:
        - check: "outputs.confidence > 0.7"
          action: retry
---

A research pipeline with output contracts and quality gates.
```

When a step has output contracts, the runtime injects:

> *Your output IS the deliverable. Produce concrete structured data, not a description of what you would do.*

Result: gather_sources produces actual source data. synthesize receives that and produces actual analysis. The pipeline works end-to-end.

**What LOGIC.md controls**

- **Per-step tool permissions** — a research step can use `web_search` but deny `file_write`. An output step does the opposite.
- **Step DAGs with timeouts** — explicit `needs` dependencies, parallel execution groups, per-step timeouts, confidence thresholds.
- **Output contracts** — typed inputs and outputs. When agent A hands off to agent B, LOGIC.md enforces what that handoff looks like.
- **Quality gates** — `pre_output` checks (validate inputs), `post_output` checks (validate outputs), and `self_verification` loops using reflection, rubrics, or critic patterns.
- **Fallback escalation** — graceful degradation chains when steps fail or quality thresholds aren't met.
- **Reasoning strategy** — declare `cot` (chain-of-thought), `react`, `tot` (tree-of-thought), `plan-execute`, or `got` per agent. Not hardcoded.

**Why this matters for local LLMs**

Local models are often less reliable than APIs. LOGIC.md gives you the missing layer:

- **Quality gates catch failures early.** A step can self-verify its output before handing off. If a local model produces low-confidence output, retry with a different approach before wasting downstream compute.
- **Fallback chains gracefully degrade.** If your high-accuracy model times out, fall back to a faster local model. If that fails, escalate to human review. All declarative.
- **Tool permissions prevent catastrophic mistakes.** A local code-generation step can produce code but cannot execute it. An execution step can run code but cannot modify the source tree.

**Python SDK (alpha)**

The Python implementation on PyPI (`logic-md`) includes a parser and validator. You can load LOGIC.md specs in Python and build your own runtime or adapter:

```python
from logic_md import parse, validate

with open("research-pipeline.logic.md") as f:
    spec = parse(f.read())

validated = validate(spec)
# validated.steps, validated.contracts, validated.quality_gates
# use these to orchestrate your pipeline
```

**What exists today**

- TypeScript reference implementation: `@logic-md/core` (parser, validator, compiler), `@logic-md/cli` (9 commands), `@logic-md/mcp` (7 MCP tools).
- Python SDK: parser + validator on PyPI.
- Adapters: LangGraph (experimental), VSCode extension, GitHub Action for CI.
- 325 tests, 95.9% branch coverage, v1.0 stable spec.
- 18 conformance test fixtures to validate implementations across languages.

**What's missing**

- External adopters. This was validated internally with Modular9 (a visual agent builder). Real-world feedback on whether this solves problems for your pipelines would help enormously.
- More framework adapters. LangGraph is done. CrewAI and AutoGen adapters would follow if there's interest.

**Links**

- GitHub: [github.com/SingleSourceStudios/logic-md](https://github.com/SingleSourceStudios/logic-md)
- Spec: [docs/SPEC.md](https://github.com/SingleSourceStudios/logic-md/blob/main/docs/SPEC.md)
- PyPI: `pip install logic-md`
- npm: `npm install @logic-md/core` or `npm install -g @logic-md/cli`

---

**Does this solve a real problem for you?** I'm especially interested in feedback from people running local model pipelines. Are output contracts and quality gates things you need? Would declarative reasoning specs save you time compared to imperative orchestration code?
