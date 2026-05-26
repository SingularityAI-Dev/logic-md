// =============================================================================
// Perf assertion: compileWorkflow scaling
// =============================================================================
// Pins the cost of compiling a 200-step linear-chain workflow against current
// `main`. Linear chains are the worst-case shape for `compileWorkflow` because
// every `compileStep` call re-resolves the full DAG (Candidate 1 in #46).
//
// Chain size of 200 (rather than 1000) keeps the bench under 2 seconds per
// run; once Candidate 1's fix lands the same workload should drop ~100×, and
// the assertion margin will widen dramatically — exactly the proof-of-fix
// signal Rain asked for in his sequencing comment.
//
// Threshold calibration methodology (per #46 review, with +50% adjustment
// noted in the calibration block below):
//   1. Run on `main` repeatedly across developer-machine sessions with
//      varying background load.
//   2. Take the worst observed elapsed time.
//   3. Multiply by 1.5 (Math.ceil) for slower-machine headroom.
//   4. Lock that value in as the assertion threshold.
//
// Calibration data captured 2026-05-07 on Node v22.18.0 across multiple
// developer-machine sessions with varying background load:
//   quiet runs: 746ms, 778ms, 1318ms, 1326ms, 1398ms
//   loaded runs: 2102ms, 2607ms, 2899ms
//   worst observed = 2899ms  →  ceil(2899 × 1.5) = 4349ms  →  4500ms (rounded)
//
// The +50% headroom (rather than the +25% suggested in the original #46
// review) reflects observed variance on Windows developer machines under
// realistic background load. The bench is opt-in (`npm run bench`, NOT
// default `npm test`), so this trade-off favours stable execution at the
// cost of slightly weaker regression sensitivity. Once Candidate 1's fix
// lands, the assertion margin will widen from ~1.5× to ~100×, providing
// a much sharper proof-of-fix signal.
// =============================================================================

import { describe, expect, test } from "vitest";
import { compileWorkflow } from "../index.js";
import { makeLinearChainSpec, makeWorkflowContext } from "./_helpers.js";

/**
 * Calibrated threshold for compileWorkflow on a 200-step linear chain.
 * See header comment for methodology and raw data.
 */
const COMPILE_200_STEP_THRESHOLD_MS = 4500;

describe("perf: compileWorkflow scaling", () => {
	test(`compileWorkflow on 200-step linear chain completes <${COMPILE_200_STEP_THRESHOLD_MS}ms`, () => {
		const spec = makeLinearChainSpec(200);
		const ctx = makeWorkflowContext();

		// Warm-up: let v8 optimise the hot path before measurement.
		compileWorkflow(spec, ctx);

		const t0 = performance.now();
		compileWorkflow(spec, ctx);
		const elapsed = performance.now() - t0;

		expect(elapsed).toBeLessThan(COMPILE_200_STEP_THRESHOLD_MS);
	});
});
