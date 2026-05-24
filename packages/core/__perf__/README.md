# `@logic-md/core` perf assertions

Pre-merge regression assertions on the three core paths most likely to acquire
silent quadratic behaviour, per the analysis in #46.

## Running

From the repository root:

```bash
npm run bench
```

This invokes vitest with [`vitest.perf.config.ts`](../vitest.perf.config.ts),
which picks up only `**/__perf__/**/*.perf.ts` files and runs them serially in
a single fork (for stable timings). Default `npm test` does not run the bench
suite — `*.perf.ts` is outside the default `**/*.test.ts` glob.

## Coverage

| File | Asserts |
|---|---|
| [`compiler.perf.ts`](compiler.perf.ts) | `compileWorkflow` on a 200-step linear chain |
| [`expression.perf.ts`](expression.perf.ts) | `evaluate` × 10,000 calls on the same template against varying contexts |
| [`dag.perf.ts`](dag.perf.ts) | `resolve` on a 1000-step linear chain |

Linear chains are the worst-case input shape — depth equals node count, which
maximises the impact of any per-pop or per-level work in the DAG resolver and
maximises the per-step traversal cost in the compiler.

## Calibration methodology

Thresholds are calibrated against `main` per the methodology agreed in #46:

1. Run the bench on `main` repeatedly across multiple developer-machine
   sessions with varying background load.
2. Take the worst observed elapsed time per metric.
3. Multiply by **1.5** (Math.ceil) for slower-machine headroom.
4. Round up to a clean number for the assertion threshold.

The +50% headroom is wider than the +25% suggested in the original #46 review,
based on observed variance on Windows developer machines (single-shot timings
can vary up to ~3× between quiet and loaded sessions). The bench is opt-in, not
default-CI, so this trade-off favours stable execution at the cost of slightly
weaker regression sensitivity. Once the algorithmic fixes in PRs 2-4 land, the
assertion margin will widen substantially (~100× for the compiler fix), which
provides a much sharper proof-of-fix signal than the initial calibration.

Each `*.perf.ts` file documents its own calibration data in a header comment so
that recalibration after a change is auditable. If a fix legitimately reduces
the workload (e.g. PR 2 in the #46 sequence eliminating the per-step DAG
re-resolution), the threshold should NOT be tightened in the same PR — leave
the headroom widening as visible proof of the fix.

## Adding a new bench

1. Create `<name>.perf.ts` next to existing files.
2. Use `describe` + `test` from `vitest`.
3. Always include a warm-up call before timed measurement (let v8 optimise the
   hot path).
4. Run `node` directly with the same workload 5 times against `main`, capture
   raw timings, document them in a header comment, and lock the worst × 1.5.

## Why these three?

These are the three concrete candidates surfaced in [#46](../../../../issues/46) — places where the implementation is correct at small scale but algorithmically quadratic+ at scale, currently invisible to all 325 unit tests. The bench suite is the regression net for the full sequence:

- **PR 1 (this scaffold):** establish discipline; assertions pass on main.
- **PR 2:** compiler fix (compileStep accepting pre-computed dagResult).
- **PR 3:** expression cache (AST cache in `evaluate`).
- **PR 4:** DAG sort tightening (eliminate per-pop queue sort and level-filter loop).

After each fix, re-running `npm run bench` shows the assertion margin widening — which IS the proof.
