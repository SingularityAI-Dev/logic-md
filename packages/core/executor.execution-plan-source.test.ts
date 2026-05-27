import { describe, expect, it, vi } from "vitest";
import type { LogicSpec } from "./types.js";

// =============================================================================
// Loop-closing test for issue #75
//
// Proves the dry-run executor reflects a step's parallel plan from
// CompiledStep.executionPlan (the compiled artifact) and not from the
// un-compiled spec.steps[name] execution fields. To make the two sources
// observably diverge -- which the deterministic compiler never does on its own
// -- we wrap compileWorkflow and attach an executionPlan to the compiled step
// while the source spec declares no parallel structure. A consumer that still
// read the spec would see no plan; one that reads the compiled field reflects
// the injected fan-out and fan-in.
// =============================================================================

vi.mock("./compiler.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./compiler.js")>();
	return {
		...actual,
		compileWorkflow: (spec: LogicSpec, context: Parameters<typeof actual.compileWorkflow>[1]) => {
			const compiled = actual.compileWorkflow(spec, context);
			for (const step of compiled.steps) {
				step.executionPlan = {
					mode: "parallel",
					parallelSteps: ["from", "compiled"],
					join: "majority",
					joinTimeout: "90s",
				};
			}
			return compiled;
		},
	};
});

const { dryRun } = await import("./executor.js");

function makeSpec(steps: LogicSpec["steps"]): LogicSpec {
	return { spec_version: "1.0", name: "test-spec", steps };
}

describe("executor reflects the execution plan from the compiled artifact, not the spec", () => {
	it("surfaces the compiled execution plan when the spec declares no parallel structure", () => {
		const spec = makeSpec({
			// No execution / parallel_steps / join authored on the spec step.
			step1: { description: "Step" },
		});

		const result = dryRun(spec);

		expect(result.steps[0]?.executionPlan).toEqual({
			mode: "parallel",
			parallelSteps: ["from", "compiled"],
			join: "majority",
			joinTimeout: "90s",
		});
	});
});
