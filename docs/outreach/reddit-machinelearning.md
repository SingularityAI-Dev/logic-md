# r/MachineLearning Post: LOGIC.md – Structured Reasoning Contracts Meet Software Engineering

## Title
LOGIC.md: Declarative contracts for multi-step agent reasoning (reasoning DAGs + quality gates)

## Body

**TL;DR:** A file format for specifying multi-step AI agent reasoning as declarative contracts — inspired by OpenAPI specs and software engineering contracts, but for reasoning pipelines. Validates outputs, enforces step dependencies, and measures reasoning reliability without framework lock-in. 325 tests, v1.0 stable, seeking external validation.

---

## The Core Idea

Structured prompting and output schema validation (e.g., BAML, Instructor) have shown that constraining LLM outputs reliably improves downstream reliability. But they operate at the *call* level — validating a single LLM output.

LOGIC.md extends this to the *pipeline* level: validating reasoning *flow*, not just outputs. It borrows from:

- **Structured prompting**: Output contracts enforce that agents produce concrete data, not intent summaries.
- **Software contracts**: Pre-conditions, post-conditions, and invariants, but for multi-agent reasoning.
- **OpenAPI/JSON Schema**: Portable specs that travel with code and survive tool changes.

The result is a framework-agnostic format for declaring:
1. **Step DAGs** with explicit dependencies (topological sort)
2. **Output contracts** between agents (typed, with constraints)
3. **Quality gates** (pre/post output validation + self-verification)
4. **Fallback escalation chains** (graceful degradation on failure)
5. **Per-step tool permissions** (what each step can and cannot do)

---

## What Makes This a Research Contribution

**1. The describing-vs-doing problem is measurable**

This isn't theoretical. In Modular9 (a visual agent builder), multi-step workflows predictably produced intent summaries from every node instead of artifacts.

Example: A "security auditor" node that should produce an OWASP Top 10 report instead outputs: "As a Security Auditor, I would perform a comprehensive review of the attack surface, map findings to CWE IDs, and produce a risk matrix."

The next node receives a description, not data. The pipeline fails end-to-end.

Adding LOGIC.md contracts with three changes:
1. **Execution mandate** in system prompt: "Your output IS the artifact."
2. **Output contract injection** in user prompt: Structured field definitions (type, required, constraints).
3. **Input framing** in user prompt: "Here is the data from the previous step [structured]."

Result: Each node produces actual data. Node A writes the audit. Node B receives it and writes the threat model. Node C produces the summary. End-to-end artifact generation.

These are established prompting techniques. The contribution is a declarative, portable format to apply them *systematically* across any framework.

**2. Conformance as a benchmark**

LOGIC.md specs can be validated against a canonical specification — like JSON Schema for APIs. This enables:

- **Cross-language implementation validation**: TypeScript and Python implementations must pass the same 18 conformance test fixtures.
- **Reasoning reliability benchmarks**: Measure the impact of structured prompting + quality gates vs. freeform reasoning across model families.
- **Framework interop**: Define a spec once, compile it to LangGraph, CrewAI, or AutoGen without translation.

**3. Quality gates as observable reasoning loops**

Quality gates (pre-output, post-output, self-verification) map to observable reasoning patterns:

```yaml
quality_gates:
  post_output:
    - check: "outputs.confidence > 0.7"
      action: retry
      strategy: self_verification  # reflection, rubric, checklist, critic
```

This is measurable: Did the model succeed without retry? Did it self-correct on retry? What was the latency cost? These metrics can be collected systematically across pipelines.

---

## Technical Details

**Format**

LOGIC.md files are markdown with YAML frontmatter. Two fields required: `spec_version` and `name`. Everything else optional.

```yaml
---
spec_version: "1.0"
name: multi-step-reasoner
reasoning:
  strategy: plan-execute
steps:
  - name: research
    instructions: "Gather sources and synthesize findings"
    contracts:
      outputs:
        sources: { type: array, items: { type: object } }
        findings: { type: string }
    quality_gates:
      post_output:
        - check: "outputs.sources.length > 3"
          action: retry
          max_retries: 2

  - name: analyze
    needs: [research]
    contracts:
      inputs:
        sources: { type: array }
      outputs:
        analysis: { type: string }
        confidence: { type: number }
    quality_gates:
      post_output:
        - check: "outputs.confidence > 0.6"
          action: escalate_to_human
---
```

**DAG Resolution**

Steps are topologically sorted. Independent steps execute in parallel. Kahn's algorithm for cycle detection.

**Expression Engine**

Quality gate checks use a safe expression syntax (no eval, no Function constructor):
```
outputs.findings.length > 0 && inputs.sources.some(s => s.confidence > 0.7)
```

**Validation**

Against a canonical JSON Schema. Same schema validates across TypeScript, Python, and any language.

---

## Current State

- **Core implementation**: TypeScript, 307 tests, 95.9% branch coverage on compiler module.
- **MCP integration**: 7 tools (parse, validate, lint, compile_step, compile_workflow, init, list_templates). Works with Claude, Cursor, Windsurf.
- **Python SDK (alpha)**: Parser + validator. Conformance tested against fixtures.
- **Adapters**: LangGraph (experimental), VSCode extension, GitHub Action.
- **Conformance suite**: 18 test fixtures covering valid, invalid, and edge cases.

---

## Open Questions

1. **Does output contract injection reliably improve reasoning?** We saw it work in Modular9 but haven't published benchmarks across model families.

2. **What does a reasoning conformance suite look like at scale?** We have 18 fixtures. What does 100 look like? What patterns should be tested?

3. **Can frameworks adopt this without rewrites?** LangGraph adapter shows it's possible. But adoption friction exists — why would a CrewAI user switch to a new file format?

4. **How do quality gates trade off latency and reliability?** Self-verification is expensive. When is retry justified? Can this be learned or heuristically tuned?

---

## Links

- GitHub: [github.com/SingleSourceStudios/logic-md](https://github.com/SingleSourceStudios/logic-md)
- Spec: [docs/SPEC.md](https://github.com/SingleSourceStudios/logic-md/blob/main/docs/SPEC.md)
- Implementer guide: [docs/IMPLEMENTER-GUIDE.md](https://github.com/SingleSourceStudios/logic-md/blob/main/docs/IMPLEMENTER-GUIDE.md)
- Conformance fixtures: [spec/fixtures/](https://github.com/SingleSourceStudios/logic-md/tree/main/spec/fixtures)

---

**Feedback welcome.** This is early-stage research validated internally. Would this be useful for your agent pipeline work? Is structured prompting + quality gates something you're already solving elsewhere? Would a standardized reasoning contract format be valuable?
