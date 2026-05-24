// =============================================================================
// Canary tests — semantic invariants on compiled prompt output
// =============================================================================
// Pins the executive phrasings the compiler is supposed to produce. If a
// refactor accidentally drops any of these structures while keeping unit
// tests green, the corresponding canary fires loudly.
//
// Each canary documents what it pins. Refinements per #47 review:
//   - "must be valid JSON" is load-bearing in the contract narrative; pinned.
//   - Strategy preamble matches on the strategy NAME appearing, not on a
//     specific sentence (lower brittleness, same regression-catching power).
//   - Retry-context section header and previousFailureReason content are
//     asserted independently — both halves can break independently.
//   - Output-schema fenced block (```json ... ```) is asserted as a serialisation
//     contract distinct from the surrounding prose.
//
// These canaries are AUTHORED AGAINST CURRENT COMPILER OUTPUT — they codify
// present behaviour as the contract going forward, not aspirational behaviour.
// =============================================================================

import { describe, expect, it } from "vitest";
import { compileStep } from "./compiler.js";
import type { ExecutionContext, LogicSpec, Step } from "./types.js";

// -----------------------------------------------------------------------------
// Helpers (match style of compiler.test.ts)
// -----------------------------------------------------------------------------

function makeSpec(steps: Record<string, Step>, overrides: Partial<LogicSpec> = {}): LogicSpec {
	return {
		spec_version: "1.0",
		name: "canary-spec",
		steps,
		...overrides,
	};
}

function makeCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
	return {
		currentStep: "test",
		previousOutputs: {},
		input: null,
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
		...overrides,
	};
}

// -----------------------------------------------------------------------------
// Canaries
// -----------------------------------------------------------------------------

describe("canaries: compiler output semantic invariants", () => {
	// -- Output contract ------------------------------------------------------

	it("step with output_schema produces a Required Output Format section", () => {
		const spec = makeSpec({
			step_a: {
				output_schema: {
					type: "object",
					required: ["result"],
					properties: { result: { type: "string" } },
				},
			},
		});

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toContain("## Required Output Format");
	});

	it("output schema produces the load-bearing 'must be valid JSON' phrasing", () => {
		// Pinned per #47 review: this phrasing carries the contract narrative.
		// A refactor that softens it (e.g. to "should be JSON-shaped") would
		// silently weaken the project's central pitch.
		const spec = makeSpec({
			step_a: {
				output_schema: { type: "object" },
			},
		});

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toContain("must be valid JSON");
	});

	it("output schema is rendered inside a fenced ```json block, not inlined as prose", () => {
		// Pinned per #47 review as a serialisation-contract regression test
		// distinct from the surrounding "must be valid JSON" prose. If the
		// schema serialisation is silently switched to plain text or to a
		// non-JSON fence, this fires.
		const spec = makeSpec({
			step_a: {
				output_schema: {
					type: "object",
					properties: { x: { type: "number" } },
				},
			},
		});

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toMatch(/```json\s*\n[\s\S]+?\n```/);
	});

	// -- Quality gates --------------------------------------------------------

	it("step with quality gates produces a Pre-Response Checklist section", () => {
		const spec = makeSpec(
			{
				step_a: {},
			},
			{
				quality_gates: {
					pre_output: [{ name: "groundedness", check: "{{ output.cited == true }}" }],
				},
			},
		);

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toContain("## Pre-Response Checklist");
	});

	it("quality gates produce 'Before responding, verify:' framing", () => {
		const spec = makeSpec(
			{
				step_a: {},
			},
			{
				quality_gates: {
					pre_output: [{ name: "groundedness", check: "{{ output.cited == true }}" }],
				},
			},
		);

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toContain("Before responding, verify:");
	});

	it("quality gate items render as Markdown checkboxes (- [ ])", () => {
		const spec = makeSpec(
			{
				step_a: {},
			},
			{
				quality_gates: {
					pre_output: [
						{ name: "groundedness", check: "{{ output.cited == true }}", message: "Cite sources" },
					],
				},
			},
		);

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toMatch(/^- \[ \]/m);
	});

	// -- Confidence -----------------------------------------------------------

	it("step with confidence config produces explicit threshold language", () => {
		const spec = makeSpec({
			step_a: {
				confidence: { minimum: 0.7, target: 0.85 },
			},
		});

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toMatch(/minimum confidence of [0-9.]+/);
	});

	it("step with escalate_below produces escalation language", () => {
		const spec = makeSpec({
			step_a: {
				confidence: { minimum: 0.7, escalate_below: 0.4 },
			},
		});

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toMatch(/falls below [0-9.]+/);
		expect(compiled.systemPromptSegment).toMatch(/escalate/i);
	});

	// -- Retry context (split into two independent canaries per #47 review) ---

	it("retry context (attempt > 1) produces a Retry Context section header", () => {
		// Header presence — independent of whether a previousFailureReason is set.
		const spec = makeSpec({
			step_a: {},
		});

		const compiled = compileStep(spec, "step_a", makeCtx({ attemptNumber: 2 }));

		expect(compiled.systemPromptSegment).toContain("## Retry Context");
	});

	it("retry context surfaces the previousFailureReason content", () => {
		// Content presence — independent of the section header. Both halves
		// can regress independently per #47 review.
		const reason = "low confidence on step_a output";
		const spec = makeSpec({
			step_a: {},
		});

		const compiled = compileStep(
			spec,
			"step_a",
			makeCtx({ attemptNumber: 2, previousFailureReason: reason }),
		);

		expect(compiled.systemPromptSegment).toContain(reason);
	});

	// -- Strategy preamble (per #47 review: match name, not sentence) ---------

	it("reasoning strategy is named in the strategy preamble", () => {
		// Per #47 review: match on the strategy NAME appearing somewhere in the
		// segment, not on a specific sentence. Lower brittleness, same
		// regression-catching power.
		const spec = makeSpec(
			{
				step_a: {},
			},
			{
				reasoning: { strategy: "react" },
			},
		);

		const compiled = compileStep(spec, "step_a", makeCtx());

		expect(compiled.systemPromptSegment).toContain("react");
	});

	// -- Branch routing -------------------------------------------------------

	it("branch context surfaces the routing reason when present", () => {
		const spec = makeSpec({
			step_a: {},
		});

		const compiled = compileStep(
			spec,
			"step_a",
			makeCtx({ branchReason: "previous step output exceeded threshold" }),
		);

		expect(compiled.systemPromptSegment).toContain("## Branch Context");
		expect(compiled.systemPromptSegment).toContain("previous step output exceeded threshold");
	});

	// -- Step identity --------------------------------------------------------

	it("compiled step segment names the current step in a Current Step header", () => {
		const spec = makeSpec({
			my_step: {},
		});

		const compiled = compileStep(spec, "my_step", makeCtx());

		expect(compiled.systemPromptSegment).toContain("## Current Step: my_step");
	});
});
