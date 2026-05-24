# Published Benchmark Runs

This directory holds committed benchmark runs as evidence artifacts. Each run gets a dated subdirectory with raw output (`results.json`, `results.md`) and an interpretation document (`analysis.md` or `summary.md`).

The ephemeral `benchmarks/results/` directory holds the most recent run-in-progress and is gitignored. To preserve a run as evidence, copy it into a dated subdirectory here and commit.

## Index

| Date | Model | Tasks | n/condition | Result |
|---|---|---|---|---|
| 2026-05-07 | `claude-sonnet-4-6` | code-review only | 10 | Control 99 / Treatment 100. Ceiling effect, LOGIC.md is no-op on quality. [Details](./2026-05-07-claude-sonnet-4-6-codereview/summary.md) |
| 2026-05-07 | `meta/llama-3.1-70b-instruct` | code-review, research-synthesis, security-audit | 10 | Flat to slightly negative after excluding 7 Nvidia NIM connection drops. [Details](./2026-05-07-llama-3.1-70b/analysis.md) |

## Headline finding (2026-05-07)

Two independent runs on different models show **no measurable quality lift from LOGIC.md** on these tasks at n=10. Sonnet 4.6 is ceiling-bound; Llama 3.1 70B is flat to slightly negative once infrastructure failures are stripped.

This contradicts the original "describing-vs-doing fix" framing in the README and motivated the positioning pivot toward auditability and structural consistency, anchored instead in the [Archon integration test (2026-05-06)](https://github.com/SingularityAI-Dev/logic-md-archon-eval) which showed clean structural-consistency results (87% hash agreement under LOGIC.md vs 70% without).

## Open methodology questions (deferred for future runs)

1. **Scoring system rigidity.** Security-audit control runs all scored exactly 89, suggesting the rubric applies fixed-magnitude penalties rather than graduated ones. The `89-89-89-89` pattern is improbable from a stochastic LLM and likely a scorer artifact.

2. **Strict JSON-schema enum validation.** Outputs that are valid in spirit but use slightly different enum values get scored down harshly. May not reflect real-world acceptance criteria.

3. **Sample size.** n=10 is below the MANIFEST recommendation of 30. Confidence intervals are wide. Real-but-small effects may be invisible at this sample size.

4. **Task difficulty.** The current sample inputs (`tasks/inputs/*-sample.{js,txt}`) are short and may be too easy for capable models, eliminating the headroom LOGIC.md needs to differentiate. Harder fixtures might produce different signal.

5. **Single-temperature.** Temperature 0.7 is hardcoded. Sensitivity analysis across temperatures has not been done.

These are tracked but not blocking. The honest current finding stands: **LOGIC.md does not produce measurable quality lift on these tasks at this sample size.**

## Re-running

See each run's analysis for the exact reproduction command. Common pattern:

```bash
cd benchmarks
export <PROVIDER>_API_KEY=...
export BENCHMARK_MODEL=<model-id>     # optional, default is Llama 3.1 70B
node run.mjs [--task=<name>]          # omit --task to run all 3
# Then copy results/ to published/<date>-<model>/ before next run
```
