# Benchmark Run Summary — Claude Sonnet 4.6, code-review only (2026-05-07)

## Setup

| Field | Value |
|---|---|
| Date | 2026-05-07 |
| Model | `claude-sonnet-4-6` |
| Provider | Anthropic API |
| Task | code-review (only — single-task validation run) |
| Conditions | control (prose prompt), treatment (LOGIC.md compiled prompt) |
| Runs per condition | 10 |
| Total runs | 20 |
| Cost | ~$0.50 |

## Why no raw JSON

This run was followed by a Llama 3.1 70B all-tasks run that overwrote `results/results.json` and `results/results.md` (the harness writes to fixed paths, not dated paths). This summary captures the headline numbers from the markdown report before overwrite.

For future runs, recommend either: (a) the harness writes to dated filenames by default, or (b) operators copy results to `published/` before triggering the next run. Tracked as a benchmark-harness improvement.

## Results

```
                Control          Treatment        Diff
code-review     99 ± 1           100 ± 0          +1.0
                (range 97-100)   (range 99-100)
```

Per-dimension:

| Dimension | Control | Treatment |
|---|---|---|
| Structured Compliance | 100% ± 0% | 100% ± 0% |
| Describing vs Doing | 4% ± 2% | 2% ± 2% |
| Pipeline Completion | 100% ± 0% | 100% ± 0% |

## Interpretation

**Ceiling effect.** Claude Sonnet 4.6 scores 99/100 on the control prompt for this task. There is no headroom for LOGIC.md to add measurable value: treatment can at best go to 100, which it does. The +1 difference is within sampling noise.

This is consistent with the hypothesis that LOGIC.md's value (if any on raw quality) shows on weaker models. Subsequent Llama 3.1 70B testing (see `2026-05-07-llama-3.1-70b/`) showed flat-to-negative results, contradicting that hypothesis.

**Net: on Sonnet 4.6 code-review at n=10, LOGIC.md is a no-op on quality.**

## Reproducibility

```bash
cd benchmarks
export ANTHROPIC_API_KEY=sk-ant-...
export BENCHMARK_MODEL=claude-sonnet-4-6
node run.mjs --task=code-review
```

## Limitations

- Single task only (code-review), so this is not a complete cross-condition picture for Sonnet.
- n=10 is small; CIs are wide.
- The code-review sample input (`tasks/inputs/code-review-sample.js`) is short and contains obvious vulnerabilities, making the task easy for any capable model.
- A harder code-review fixture might create headroom for LOGIC.md to differentiate; this was not tested.

## Honest disclosure

This single-task run cost ~$0.50. The next planned step (a 3-task Sonnet sweep) was not executed because the prelim showed clear ceiling effects and the marginal value of more Sonnet data was low compared to running a free-tier Llama sweep on all 3 tasks. That decision is reflected in `2026-05-07-llama-3.1-70b/`.

## Files

- `summary.md` — this document (raw JSON not preserved due to harness overwrite, see "Why no raw JSON" above)
