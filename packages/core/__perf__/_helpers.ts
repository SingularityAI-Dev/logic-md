// =============================================================================
// Perf-test helpers — synthetic spec generators for scaling assertions
// =============================================================================
// These are NOT part of the public API. They live under __perf__/ and are only
// used by the bench suite (`npm run bench`).
// =============================================================================

import type { LogicSpec, Step, WorkflowContext } from "../types.js";

/**
 * Generate a `LogicSpec` with `n` steps in a strict linear chain
 * (step_0 → step_1 → … → step_{n-1}).
 *
 * Linear chains are the worst case for several scaling concerns:
 *   - DAG resolve's level-grouping filter (D = N depths)
 *   - compileWorkflow's per-step DAG re-resolution (N×(V+E) traversal)
 *   - Token-budget warnings as the prompt segment grows.
 */
export function makeLinearChainSpec(n: number): LogicSpec {
	if (n < 1) {
		throw new Error(`makeLinearChainSpec requires n >= 1, got ${n}`);
	}
	const steps: Record<string, Step> = {
		step_0: {
			description: "first",
			instructions: "first step in linear chain",
		},
	};
	for (let i = 1; i < n; i++) {
		steps[`step_${i}`] = {
			description: `step ${i}`,
			instructions: `step ${i} in linear chain`,
			needs: [`step_${i - 1}`],
		};
	}
	return {
		spec_version: "1.0",
		name: "linear-chain-perf",
		steps,
	};
}

/**
 * Just the `steps` map from `makeLinearChainSpec(n)`.
 * Useful when calling `resolve(steps)` directly.
 */
export function makeLinearChainSteps(n: number): Record<string, Step> {
	const spec = makeLinearChainSpec(n);
	return spec.steps as Record<string, Step>;
}

/**
 * Default `WorkflowContext` for compile-bench measurements.
 */
export function makeWorkflowContext(): WorkflowContext {
	return {
		currentStep: "step_0",
		previousOutputs: {},
		input: {},
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
		totalSteps: 0,
		completedSteps: [],
		dagLevels: [],
	};
}
