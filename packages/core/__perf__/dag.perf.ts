// =============================================================================
// Perf assertion: resolve() scaling on a 1000-step linear chain
// =============================================================================
// Pins the cost of topological sort + level grouping on the worst-case DAG
// shape (linear chain, where depth = N). Catches regressions in the per-pop
// queue sort, neighbour sort, and level-filter loop in `dag.ts`.
// Threshold calibrated against current `main` (5 runs, take worst, +25%).
// =============================================================================

import { describe, expect, test } from "vitest";
import { resolve } from "../index.js";
import { makeLinearChainSteps } from "./_helpers.js";

/**
 * Calibrated threshold for resolve() on a 1000-step linear chain.
 *
 * Calibration methodology: multiple runs on `main` across developer-machine
 * sessions with varying background load; take worst observed, multiply by 1.5
 * for headroom.
 *
 * Calibration data captured 2026-05-07 on Node v22.18.0:
 *   quiet runs: 117ms, 128ms, 143ms, 152ms, 215ms
 *   loaded runs: 419ms, 484ms
 *   worst observed = 484ms  →  ceil(484 × 1.5) = 727ms  →  800ms (rounded)
 */
const RESOLVE_1000_STEP_THRESHOLD_MS = 800;

describe("perf: dag.resolve scaling", () => {
	test(`resolve(1000-step linear chain) completes <${RESOLVE_1000_STEP_THRESHOLD_MS}ms`, () => {
		const steps = makeLinearChainSteps(1000);

		// Warm-up.
		const warm = resolve(steps);
		expect(warm.ok).toBe(true);

		const t0 = performance.now();
		const r = resolve(steps);
		const elapsed = performance.now() - t0;

		expect(r.ok).toBe(true);
		expect(elapsed).toBeLessThan(RESOLVE_1000_STEP_THRESHOLD_MS);
	});
});
