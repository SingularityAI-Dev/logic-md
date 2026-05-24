// =============================================================================
// Perf assertion: evaluate() throughput on repeated expressions
// =============================================================================
// Pins the cost of evaluating the same `{{ ... }}` expression 10,000 times
// against varying contexts. Catches regressions in tokenize/parse hot path
// (e.g. accidental disabling of an AST cache once one is added in PR 3).
// Threshold calibrated against current `main` (5 runs, take worst, +25%).
// =============================================================================

import { describe, expect, test } from "vitest";
import { evaluate } from "../index.js";

/**
 * Calibrated threshold for 10,000 evaluate() calls on the same template.
 *
 * Calibration methodology: multiple runs on `main` across developer-machine
 * sessions with varying background load; take worst observed, multiply by 1.5
 * for headroom. The +50% (rather than the original +25%) reflects observed
 * variance on Windows developer machines.
 *
 * Calibration data captured 2026-05-07 on Node v22.18.0:
 *   quiet runs: 135ms, 197ms, 234ms, 268ms, 382ms
 *   loaded runs: 617ms
 *   worst observed = 617ms  →  ceil(617 × 1.5) = 926ms  →  1000ms (rounded)
 */
const EVAL_10K_THRESHOLD_MS = 1000;

describe("perf: evaluate() throughput", () => {
	test(`evaluate same expression 10,000 times <${EVAL_10K_THRESHOLD_MS}ms`, () => {
		const tmpl = "{{ output.findings.length > 3 && output.confidence >= 0.6 }}";

		// Warm-up: prime the parser path.
		for (let i = 0; i < 100; i++) {
			evaluate(tmpl, { output: { findings: [], confidence: 0 } });
		}

		const t0 = performance.now();
		for (let i = 0; i < 10_000; i++) {
			evaluate(tmpl, {
				output: {
					findings: new Array(i % 5),
					confidence: (i % 100) / 100,
				},
			});
		}
		const elapsed = performance.now() - t0;

		expect(elapsed).toBeLessThan(EVAL_10K_THRESHOLD_MS);
	});
});
