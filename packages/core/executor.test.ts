import { describe, expect, it } from "vitest";
import { dryRun } from "./executor.js";
import type { ExecutionMode, JoinMode, LogicSpec, OnFailAction, Step } from "./types.js";

// =============================================================================
// Helpers
// =============================================================================

/** Build a minimal LogicSpec with given steps and optional reasoning */
function makeSpec(steps: Record<string, Step>, reasoning?: LogicSpec["reasoning"]): LogicSpec {
	return {
		spec_version: "1.0",
		name: "test-spec",
		steps,
		reasoning,
	};
}

// =============================================================================
// Basic Functionality
// =============================================================================

describe("dryRun", () => {
	it("returns ok:true for empty spec", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "empty",
		};
		const result = dryRun(spec);
		expect(result.ok).toBe(true);
		expect(result.totalSteps).toBe(0);
		expect(result.totalLevels).toBe(0);
	});

	it("processes single step correctly", () => {
		const spec = makeSpec({
			step1: {
				description: "First step",
				instructions: "Do something",
			},
		});
		const result = dryRun(spec);
		expect(result.ok).toBe(true);
		expect(result.totalSteps).toBe(1);
		expect(result.totalLevels).toBe(1);
		expect(result.executionOrder).toEqual(["step1"]);
		expect(result.steps).toHaveLength(1);
		expect(result.steps[0]?.stepName).toBe("step1");
		expect(result.steps[0]?.dagLevel).toBe(0);
	});

	it("respects DAG ordering for dependent steps", () => {
		const spec = makeSpec({
			step1: {
				description: "First step",
			},
			step2: {
				description: "Second step",
				needs: ["step1"],
			},
			step3: {
				description: "Third step",
				needs: ["step2"],
			},
		});
		const result = dryRun(spec);
		expect(result.ok).toBe(true);
		expect(result.totalSteps).toBe(3);
		expect(result.totalLevels).toBe(3);
		expect(result.executionOrder).toEqual(["step1", "step2", "step3"]);
	});

	it("groups parallel steps by DAG level", () => {
		const spec = makeSpec({
			step1: { description: "Root" },
			step2a: { description: "Parallel A", needs: ["step1"] },
			step2b: { description: "Parallel B", needs: ["step1"] },
			step3: { description: "Final", needs: ["step2a", "step2b"] },
		});
		const result = dryRun(spec);
		expect(result.ok).toBe(true);
		expect(result.dagLevels).toHaveLength(3);
		expect(result.dagLevels[0]).toEqual(["step1"]);
		expect(result.dagLevels[1]?.sort()).toEqual(["step2a", "step2b"]);
		expect(result.dagLevels[2]).toEqual(["step3"]);
	});

	it("records step metadata correctly", () => {
		const spec = makeSpec({
			test_step: {
				description: "Test description",
				instructions: "Test instructions",
				output_schema: {
					type: "object",
					properties: { result: { type: "string" } },
					required: ["result"],
				},
				retry: {
					max_attempts: 3,
					initial_interval: "1s",
				},
			},
		});
		const result = dryRun(spec);
		const trace = result.steps[0];
		expect(trace).toBeDefined();
		expect(trace?.stepName).toBe("test_step");
		expect(trace?.outputSchema).toBeDefined();
		expect(trace?.retryPolicy).toBeDefined();
		expect(trace?.retryPolicy?.maxAttempts).toBe(3);
	});

	it("marks step as executed when mock output is provided", () => {
		const spec = makeSpec({
			step1: {
				description: "Step",
				output_schema: { type: "object" },
			},
		});
		const result = dryRun(spec, {
			mockOutputs: { step1: { result: "test" } },
		});
		expect(result.steps[0]?.status).toBe("executed");
	});

	it("marks step as skipped when mock output is missing", () => {
		const spec = makeSpec({
			step1: {
				description: "Step",
			},
		});
		const result = dryRun(spec, {
			mockOutputs: {},
		});
		expect(result.steps[0]?.status).toBe("skipped");
	});

	it("validates schema contract when validateGates is enabled", () => {
		const spec = makeSpec({
			step1: {
				description: "Step",
				output_schema: {
					type: "object",
					required: ["name"],
					properties: { name: { type: "string" } },
				},
			},
		});
		const result = dryRun(spec, {
			validateGates: true,
			mockOutputs: { step1: {} }, // missing required field
		});
		expect(result.steps[0]?.contractViolations).toContain('Missing required field: "name"');
		expect(result.steps[0]?.status).toBe("failed");
		expect(result.ok).toBe(false);
	});

	it("passes schema validation with correct mock output", () => {
		const spec = makeSpec({
			step1: {
				description: "Step",
				output_schema: {
					type: "object",
					required: ["name"],
					properties: { name: { type: "string" } },
				},
			},
		});
		const result = dryRun(spec, {
			validateGates: true,
			mockOutputs: { step1: { name: "test" } },
		});
		expect(result.steps[0]?.contractViolations).toHaveLength(0);
	});

	it("estimates token count in prompt segment", () => {
		const spec = makeSpec({
			step1: {
				description: "A".repeat(100),
				instructions: "B".repeat(100),
			},
		});
		const result = dryRun(spec);
		const trace = result.steps[0];
		expect(trace?.tokenEstimate).toBeGreaterThan(0);
		expect(trace?.promptSegmentLength).toBeGreaterThan(0);
	});

	it("warns when token estimate exceeds 2000", () => {
		const spec = makeSpec({
			step1: {
				description: "X".repeat(10000),
				instructions: "Y".repeat(10000),
			},
		});
		const result = dryRun(spec);
		const warnings = result.warnings.filter((w) => w.includes("step1"));
		expect(warnings.length).toBeGreaterThan(0);
	});

	// =============================================================================
	// Step verification feeds quality-gate evaluation (issue #73)
	//
	// Characterizes the observable effect of a step's verification in the dry-run
	// executor: it contributes one quality-gate result carrying the verification's
	// failure message. The recovery action (on_fail) is not acted on by the
	// dry-run executor, so the message is the observable surface. These pin that
	// behaviour across every OnFailAction value plus the absent case, so switching
	// the read source from the un-compiled spec to CompiledStep.verification must
	// preserve it.
	// =============================================================================
	const onFailActions: OnFailAction[] = ["retry", "escalate", "skip", "abort", "revise"];

	it.each(
		onFailActions,
	)("surfaces the verification message as a quality gate result (on_fail: %s)", (onFail) => {
		const spec = makeSpec({
			step1: {
				description: "Step",
				verification: {
					check: "{{ output.ok }}",
					on_fail: onFail,
					on_fail_message: "Verification failed",
				},
			},
		});
		const result = dryRun(spec, {
			validateGates: true,
			mockOutputs: { step1: { ok: true } },
		});
		expect(result.steps[0]?.qualityGateResults).toContainEqual({
			passed: true,
			message: "Verification failed",
		});
	});

	it("produces no verification gate result when the step has no verification", () => {
		const spec = makeSpec({
			step1: { description: "Step" },
		});
		const result = dryRun(spec, {
			validateGates: true,
			mockOutputs: { step1: { ok: true } },
		});
		expect(result.steps[0]?.qualityGateResults).toHaveLength(0);
	});

	// =============================================================================
	// Step trace reflects CompiledStep.executionPlan (issue #75)
	//
	// The dry-run executor does not build a concurrent scheduler; it reflects the
	// compiled parallel plan (mode / parallelSteps / join / joinTimeout) onto each
	// step trace so a consumer can see the fan-out and fan-in without reaching back
	// into the un-compiled spec. These pin the reflection across every ExecutionMode
	// and JoinMode plus the absent case.
	// =============================================================================
	const executionModes: ExecutionMode[] = ["sequential", "parallel", "conditional"];
	const joinModes: JoinMode[] = ["all", "any", "majority"];

	it.each(executionModes)("reflects execution mode %s on the step trace", (mode) => {
		const spec = makeSpec({
			coordinator: {
				description: "Coordinator",
				execution: mode,
				parallel_steps: ["childA", "childB"],
				join: "all",
			},
			childA: { description: "Child A" },
			childB: { description: "Child B" },
		});
		const result = dryRun(spec);
		const trace = result.steps.find((s) => s.stepName === "coordinator");
		expect(trace?.executionPlan).toEqual({
			mode,
			parallelSteps: ["childA", "childB"],
			join: "all",
		});
	});

	it.each(joinModes)("reflects join mode %s on the step trace", (join) => {
		const spec = makeSpec({
			coordinator: {
				description: "Coordinator",
				execution: "parallel",
				parallel_steps: ["childA", "childB"],
				join,
				join_timeout: "60s",
			},
			childA: { description: "Child A" },
			childB: { description: "Child B" },
		});
		const result = dryRun(spec);
		const trace = result.steps.find((s) => s.stepName === "coordinator");
		expect(trace?.executionPlan).toEqual({
			mode: "parallel",
			parallelSteps: ["childA", "childB"],
			join,
			joinTimeout: "60s",
		});
	});

	it("reflects a null execution plan when the step declares no parallel structure", () => {
		const spec = makeSpec({
			step1: { description: "Step" },
		});
		const result = dryRun(spec);
		expect(result.steps[0]?.executionPlan).toBeNull();
	});

	it("handles missing mock output without validateGates", () => {
		const spec = makeSpec({
			step1: { description: "Step" },
		});
		const result = dryRun(spec, {
			mockOutputs: {},
			validateGates: false,
		});
		expect(result.ok).toBe(true);
		expect(result.steps[0]?.status).toBe("skipped");
	});

	it("detects DAG cycles and reports errors", () => {
		const spec = makeSpec({
			step1: { needs: ["step2"] },
			step2: { needs: ["step1"] },
		});
		const result = dryRun(spec);
		expect(result.ok).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toMatch(/cycle|Circular/i);
	});

	it("reports error when step has missing dependency", () => {
		const spec = makeSpec({
			step1: { needs: ["nonexistent"] },
		});
		const result = dryRun(spec);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/nonexistent/);
	});

	it("includes spec name in result", () => {
		const spec = makeSpec({});
		spec.name = "my-workflow";
		const result = dryRun(spec);
		expect(result.specName).toBe("my-workflow");
	});

	it("populates dagLevels in result", () => {
		const spec = makeSpec({
			a: {},
			b: { needs: ["a"] },
			c: { needs: ["b"] },
		});
		const result = dryRun(spec);
		expect(result.dagLevels).toEqual([["a"], ["b"], ["c"]]);
	});

	it("handles multiple independent root steps", () => {
		const spec = makeSpec({
			root1: {},
			root2: {},
			join: { needs: ["root1", "root2"] },
		});
		const result = dryRun(spec);
		expect(result.ok).toBe(true);
		expect(result.dagLevels[0]?.sort()).toEqual(["root1", "root2"]);
		expect(result.dagLevels[1]).toEqual(["join"]);
	});
});
