import { describe, expect, it, vi } from "vitest";
import type { LogicSpec } from "./types.js";

// =============================================================================
// Loop-closing test for issue #73
//
// Proves the dry-run executor reads a step's verification from
// CompiledStep.verification (the compiled artifact) and not from the
// un-compiled spec.steps[name].verification. To make the two sources
// observably diverge -- which the deterministic compiler never does on its own
// -- we wrap compileWorkflow and attach a verification to the compiled step
// while the source spec carries none. A runtime that still read the spec would
// see no verification and emit no verification gate result; one that reads the
// compiled field emits the injected message.
// =============================================================================

vi.mock("./compiler.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./compiler.js")>();
	return {
		...actual,
		compileWorkflow: (spec: LogicSpec, context: Parameters<typeof actual.compileWorkflow>[1]) => {
			const compiled = actual.compileWorkflow(spec, context);
			for (const step of compiled.steps) {
				step.verification = {
					check: "{{ output.ok }}",
					onFail: "abort",
					message: "from compiled artifact",
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

describe("executor reads verification from the compiled artifact, not the spec", () => {
	it("surfaces the compiled verification message when the spec carries none", () => {
		const spec = makeSpec({
			// No verification authored on the spec step.
			step1: { description: "Step" },
		});

		const result = dryRun(spec, {
			validateGates: true,
			mockOutputs: { step1: { ok: true } },
		});

		expect(result.steps[0]?.qualityGateResults).toContainEqual({
			passed: true,
			message: "from compiled artifact",
		});
	});
});
