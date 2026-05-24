# Benchmark Run Analysis — Llama 3.1 70B (2026-05-07)

## Setup

| Field | Value |
|---|---|
| Date | 2026-05-07 |
| Model | `meta/llama-3.1-70b-instruct` |
| Provider | Nvidia NIM (free tier) |
| Tasks | code-review, research-synthesis, security-audit |
| Conditions | control (prose prompt), treatment (LOGIC.md compiled prompt) |
| Runs per condition | 10 |
| Total runs | 60 |
| Harness | `benchmarks/run.mjs` (commit at run-time) |
| Scoring | 4-dimensional aggregate: structured-compliance (40%), describing-vs-doing (30%), pipeline-completion (20%), quality-gate-compliance (10%) |
| Cost | $0 (Nvidia free tier) |

## Raw aggregate scores (as reported by harness)

```
                        Control       Treatment    Diff
code-review             98 ± 2        89 ± 30      -9
research-synthesis      66 ± 44       85 ± 29      +19
security-audit          71 ± 36       83 ± 17      +12
```

## Investigation: variance and zero-score runs

Treatment ranges of 0-100 across all three tasks indicated catastrophic outliers. Diagnostic dig revealed **7 of 60 runs failed with `"Connection error."` from the Nvidia NIM endpoint**, not from the LLM or LOGIC.md:

| Task | Condition | Connection-drop runs |
|---|---|---|
| code-review | treatment | 1 |
| research-synthesis | control | 3 |
| research-synthesis | treatment | 1 |
| security-audit | control | 2 |
| (everywhere else) | | 0 |

These are infrastructure failures, not signal. Each scored 0 (no output to score) and dragged the mean of its group down.

## Cleaned aggregate scores (excluding fatal connection drops)

```
                        Control          Treatment       Diff
code-review             98.3 (n=10)      98.9 (n=9)      +0.6
research-synthesis      94.6 (n=7)       94.0 (n=9)      -0.6
security-audit          89.0 (n=8)       83.0 (n=10)     -6.0
```

## Honest interpretation

The original "+19 / +12" lifts were artifacts of unequal connection-drop incidence between conditions: control runs failed infrastructurally more often than treatment runs, dragging control means down. Once corrected:

- **code-review**: ceiling effect. Both ~98. LOGIC.md adds nothing measurable on a task this easy for a 70B-parameter model.
- **research-synthesis**: flat. Both ~94. LOGIC.md adds nothing measurable.
- **security-audit**: treatment underperforms control by 6 points (89 → 83). Treatment also showed wider range (50-100 vs control's 89-89).

**On Llama 3.1 70B at n=10, LOGIC.md does not produce measurable quality lift on these tasks.**

A separate Sonnet 4.6 single-task run earlier the same day showed the same flat result on code-review (control 99, treatment 100). Two independent flat data points.

## Anomalies worth investigating before re-running

**1. The 89-89-89-89 pattern on security-audit control.** Every successful control run scored exactly 89, with range 89-89. This is improbable from a stochastic LLM and points to a scoring-system quirk: every run hits the same fixed-magnitude penalty in the rubric, suggesting the scorer applies binary deductions rather than graduated ones. The penalty calibration may need review before the security-audit results can be trusted as quality signal.

**2. Strict JSON-schema enum validation.** Example error from a `research-synthesis` control run:

```
"errors": ["/sources/3/type: must be equal to one of the allowed values"]
```

The output was otherwise valid (structured-compliance 75%, aggregate 88). The scoring system applies the schema-validation error harshly. Real-world consumers might accept the output as good. The scorer rejects it. This contributes variance that doesn't reflect real quality.

**3. n=10 with high inherent LLM variance.** Confidence intervals are wide. A real but small effect may be invisible at this sample size. n=30 is the minimum recommended in the benchmark MANIFEST for tighter intervals.

## What this does and does not say about LOGIC.md

**Does not say**: LOGIC.md is broken, doesn't work, or has no value.

**Does say**: on these specific tasks, this specific sample size, and this specific scoring rubric, LOGIC.md does not produce measurable quality lift on Llama 3.1 70B. The benchmark was designed to test the README's quality-lift claim. The claim is not supported by this data.

## What evidence we DO have for LOGIC.md value

The Archon integration test (2026-05-06, separate experiment, 60 trials) showed:

| Metric | Without LOGIC.md | With LOGIC.md |
|---|---|---|
| Verdict-agreement (auth-sql-injection) | 50% (5/10) | 100% (10/10) |
| Structural hash agreement (overall) | 70% | 87% |
| Audit trail | Manual reconstruction | Workflow event JSONL out of the box |
| Modifiability | Prose edit, no validation | Structured rule + CLI contract check |

That experiment measured **structural consistency** rather than **quality lift**, and produced a clean positive result. The two experiments together suggest LOGIC.md's value is in consistency, audit, and modifiability — not in making individual outputs better.

## Reproducibility

To re-run this exact configuration:

```bash
cd benchmarks
unset BENCHMARK_MODEL                 # default is meta/llama-3.1-70b-instruct
export NVIDIA_API_KEY=nvapi-...
node run.mjs                           # runs all 3 tasks at 10 runs/condition
```

Caveats: Nvidia NIM free tier introduces non-deterministic connection drops. Paid tier or alternative endpoint recommended for cleaner data.

To analyse with infra failures excluded:

```bash
node -e "
const r = require('./results/results.json');
const groups = {};
r.results.forEach(x => {
  if (x.stopReason === 'error' || x.outputLength === 0) return;
  const k = x.task + ':' + x.condition;
  groups[k] = groups[k] || [];
  groups[k].push(x.aggregateScore);
});
Object.entries(groups).forEach(([k, scores]) => {
  const mean = scores.reduce((a,b)=>a+b,0) / scores.length;
  console.log(k.padEnd(40), 'n=' + scores.length, '| mean=' + mean.toFixed(1));
});
"
```

## Files

- `results.json` — full per-run output as emitted by `run.mjs`
- `results.md` — auto-generated summary (raw, before cleanup)
- `analysis.md` — this document (honest interpretation post-cleanup)
