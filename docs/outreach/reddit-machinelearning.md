# r/MachineLearning Post: LOGIC.md – Pipeline-level adaptive computation for agents

## Title
[P] LOGIC.md: declarative reasoning contracts for multi-step LLM pipelines (pipeline-level adaptive computation, framework-agnostic)

## Body

**TL;DR:** A portable YAML format for multi-step LLM pipelines that declares step DAGs, output contracts, quality gates, self-verification loops, and fallback chains. Treat it as **pipeline-level adaptive computation** — the same halt/retry/verify primitives PonderNet and Universal Transformers put *inside* the model, exposed *outside* the model as a declarative spec. v1.0 stable, 325 tests, seeking external validation and benchmark collaborators.

---

## Why this exists

Three results motivate a contract layer above the model:

1. **Adaptive computation improves reasoning.** Universal Transformers (arXiv:1807.03819), PonderNet (arXiv:2107.05407), and Ouro's looped LMs (arXiv:2510.25741) show that variable-depth, halting-aware computation beats fixed-depth forward passes on reasoning tasks.
2. **RL post-training has a ceiling.** Yue et al. (arXiv:2504.13837) argue RLHF/RLAIF sharpens base-model capability rather than adding new reasoning capacity. Reliability gains must come from elsewhere.
3. **Pretraining data is finite.** Villalobos et al. (arXiv:2211.04325) quantify the approaching wall on human-generated data; Kaplan et al. (arXiv:2001.08361) set the frame.

If (1)–(3) hold, reliability gains are increasingly an inference-time orchestration problem. LOGIC.md is a portable, model-agnostic format for that layer: declare halt conditions, verification loops, and fallback chains once; execute them across LangGraph, CrewAI, AutoGen, or custom runtimes.

---

## What it declares

- **Step DAGs** with explicit `needs`, parallel levels (Kahn's algorithm, cycle detection).
- **Output contracts** — typed inputs/outputs enforced at step boundaries.
- **Quality gates** — `pre_output`, `post_output`, and `self_verification` (reflection / rubric / checklist / critic).
- **Halting policy** — confidence thresholds + `max_retries` per gate. Direct analogue of PonderNet's ponder cost, at the pipeline layer.
- **Fallback chains** — graceful degradation when gates fail or budgets exhaust.
- **Per-step tool permissions** — `allowed_tools` / `denied_tools` enforced per node.

Full spec: [docs/SPEC.md](https://github.com/SingleSourceStudios/logic-md/blob/main/docs/SPEC.md). Expressions use a safe evaluator — no `eval`, no `Function`.

---

## The empirical observation driving it

Multi-step pipelines reliably fail by producing *intent summaries* instead of artifacts: "As a Security Auditor, I would perform an OWASP Top 10 review..." — passed verbatim to the next node, which summarises the summary. End-to-end artifact generation collapses.

Three interventions, all declared in LOGIC.md, resolved this in the Modular9 integration: an execution mandate in the system prompt, structured output-contract injection in the user prompt, and input framing that labels prior-step output as data. These are known prompting techniques; the contribution is applying them *systematically and portably* via a spec.

This was validated internally on one codebase. Cross-model benchmarks are the obvious next step and are not published yet — calling that out upfront.

---

## Falsifiable open questions

1. Does output-contract injection improve artifact-rate reliably across model families (Claude, GPT, Llama, Qwen)? We have anecdotal evidence; no controlled benchmark.
2. Do declarative quality gates + retry budgets outperform equivalent imperative orchestration on latency-adjusted reliability?
3. What is the cost/reliability curve of self-verification strategies (reflection vs rubric vs critic) as retry budget scales?
4. Can framework adapters (LangGraph → CrewAI → AutoGen) preserve spec semantics end-to-end, or do impedance mismatches force lossy compilation?

If anyone is running adaptive-compute or verification-loop experiments and wants a standard spec format to ablate against, I'd like to collaborate.

---

## Implementation state

- TypeScript reference impl (`@logic-md/core`): 307 tests, 95.9% branch coverage on the compiler.
- Python SDK (alpha, PyPI `logic-md`): parser + validator, conformance-tested.
- MCP server: 7 tools (parse, validate, lint, compile_step, compile_workflow, init, list_templates).
- LangGraph adapter (experimental), VSCode extension, GitHub Action.
- 18 conformance fixtures against a canonical JSON Schema for cross-language implementations.

---

## Links

- GitHub: github.com/SingleSourceStudios/logic-md
- Spec: docs/SPEC.md
- Theoretical grounding (README): github.com/SingleSourceStudios/logic-md#theoretical-grounding
- Implementer guide: docs/IMPLEMENTER-GUIDE.md
- Conformance fixtures: spec/fixtures/

---

Feedback especially welcome on: the framing as pipeline-level adaptive computation, whether the open questions are the right ones to benchmark first, and gaps in the conformance suite.
