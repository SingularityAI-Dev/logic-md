import type { LogicSpec } from "@logic-md/core";
import { describe, expect, it, vi } from "vitest";

// =============================================================================
// Loop-closing test for issue #75 (adapter side)
//
// Proves the LangGraph adapter builds its node-level execution plan (fan-out /
// fan-in) from CompiledStep.executionPlan and not from the un-compiled spec's
// execution fields. To make the two sources observably diverge -- which the
// deterministic compiler never does on its own -- we wrap compileWorkflow and
// attach an executionPlan to the compiled step while the source spec declares
// no parallel structure. An adapter that still read the spec would emit no
// execution plan; one that reads the compiled field reflects the injected
// fan-out and fan-in onto the node metadata.
// =============================================================================

vi.mock("@logic-md/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@logic-md/core")>();
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

const { toStateGraphFromSpec } = await import("../adapter.js");

describe("adapter reflects the execution plan from the compiled artifact, not the spec", () => {
	it("surfaces the compiled execution plan on node metadata when the spec declares none", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "test-spec",
			// No execution / parallel_steps / join authored on the spec step.
			steps: { step1: { instructions: "Do something." } },
		};

		const graph = toStateGraphFromSpec(spec);

		expect(graph.nodes[0]?.metadata.executionPlan).toEqual({
			mode: "parallel",
			parallelSteps: ["from", "compiled"],
			join: "majority",
			joinTimeout: "90s",
		});
	});
});
