import { describe, expect, it } from "vitest";
import { CompilerError, compileStep } from "./compiler.js";
import type { ExecutionContext, LogicSpec, Step } from "./types.js";

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

/** Build a minimal ExecutionContext */
function makeCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
	return {
		currentStep: "test",
		previousOutputs: {},
		input: null,
		attemptNumber: 1,
		branchReason: null,
		...overrides,
	};
}

/** Research-synthesizer fixture (mirrors examples/research-synthesizer.logic.md) */
function researchSpec(): LogicSpec {
	return {
		spec_version: "1.0",
		name: "research-synthesizer",
		description: "Synthesizes multi-source research into structured reports with quality gates",
		reasoning: {
			strategy: "react",
			max_iterations: 12,
			temperature: 0.3,
			thinking_budget: 16000,
		},
		steps: {
			gather_sources: {
				description: "Search for and collect relevant sources on the research topic",
				instructions: [
					"Search for sources relevant to the query.",
					"Prioritize: peer-reviewed > official reports > news > blogs > forums.",
					"Minimum 3 independent sources required.",
				].join("\n"),
				output_schema: {
					type: "object",
					required: ["sources", "quality_scores"],
					properties: {
						sources: { type: "array", minItems: 3 },
						quality_scores: { type: "array" },
					},
				},
				retry: {
					max_attempts: 3,
					initial_interval: "1s",
					backoff_coefficient: 2.0,
					non_retryable_errors: ["AuthenticationError", "RateLimitError"],
				},
			},
			evaluate_credibility: {
				needs: ["gather_sources"],
				description: "Score each source for recency, authority, and corroboration",
				instructions: [
					"Evaluate each source for:",
					"- Recency (prefer last 12 months)",
					"- Authority (domain expertise of author/publication)",
					"- Corroboration (claims supported by other sources)",
					"Assign a credibility score 0.0-1.0 to each.",
				].join("\n"),
			},
			synthesize: {
				needs: ["evaluate_credibility"],
				description: "Combine findings into a coherent analysis",
				instructions: [
					"Cross-reference claims across minimum three independent sources.",
					"Lead with the most actionable insight.",
					"Flag any data gaps or low-confidence assessments.",
				].join("\n"),
			},
			expand_search: {
				needs: ["synthesize"],
				description: "Broaden search when initial sources are insufficient",
				instructions: [
					"Search additional databases and sources.",
					"Try alternative keywords and related topics.",
				].join("\n"),
			},
			draft_report: {
				needs: ["synthesize"],
				description: "Produce the final structured research report",
			},
		},
	};
}

// =============================================================================
// Error Cases
// =============================================================================

describe("compileStep error cases", () => {
	it("throws CompilerError for nonexistent step name", () => {
		const spec = researchSpec();
		expect(() => compileStep(spec, "nonexistent", makeCtx())).toThrow(CompilerError);
	});

	it("throws CompilerError when spec has no steps", () => {
		const spec = makeSpec({});
		expect(() => compileStep(spec, "any", makeCtx())).toThrow(CompilerError);
	});

	it("throws CompilerError when steps is undefined", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "empty",
		};
		expect(() => compileStep(spec, "any", makeCtx())).toThrow(CompilerError);
	});

	it("error message includes the missing step name", () => {
		const spec = researchSpec();
		expect(() => compileStep(spec, "ghost_step", makeCtx())).toThrow(/ghost_step/);
	});
});

// =============================================================================
// Strategy Preamble
// =============================================================================

describe("systemPromptSegment: strategy preamble", () => {
	it("contains reasoning strategy header and name", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("## Reasoning Strategy");
		expect(result.systemPromptSegment).toContain("react");
	});

	it("contains max_iterations value", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("12");
	});

	it("includes temperature when present", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("Temperature");
		expect(result.systemPromptSegment).toContain("0.3");
	});

	it("includes thinking_budget when present", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("Thinking budget");
		expect(result.systemPromptSegment).toContain("16000");
	});

	it("omits strategy preamble when spec has no reasoning block", () => {
		const spec = makeSpec({
			simple: { description: "A simple step" },
		});
		const result = compileStep(spec, "simple", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Reasoning Strategy");
	});

	it("shows 'unlimited' when max_iterations is not set", () => {
		const spec = makeSpec({ step: { description: "test" } }, { strategy: "cot" });
		const result = compileStep(spec, "step", makeCtx());
		expect(result.systemPromptSegment).toContain("unlimited");
	});

	it("omits temperature line when temperature not set", () => {
		const spec = makeSpec(
			{ step: { description: "test" } },
			{ strategy: "cot", max_iterations: 5 },
		);
		const result = compileStep(spec, "step", makeCtx());
		expect(result.systemPromptSegment).not.toContain("Temperature");
	});

	it("omits thinking_budget line when not set", () => {
		const spec = makeSpec(
			{ step: { description: "test" } },
			{ strategy: "cot", max_iterations: 5 },
		);
		const result = compileStep(spec, "step", makeCtx());
		expect(result.systemPromptSegment).not.toContain("Thinking budget");
	});
});

// =============================================================================
// Step Instructions
// =============================================================================

describe("systemPromptSegment: step instructions", () => {
	it("contains step name header", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("## Current Step: gather_sources");
	});

	it("contains step description", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("Search for and collect relevant sources");
	});

	it("contains step instructions text", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("Minimum 3 independent sources required");
	});

	it("handles step with no instructions (description only)", () => {
		const spec = makeSpec({
			no_instructions: { description: "Just a description" },
		});
		const result = compileStep(spec, "no_instructions", makeCtx());
		expect(result.systemPromptSegment).toContain("Just a description");
		expect(result.systemPromptSegment).toContain("## Current Step: no_instructions");
	});

	it("handles step with no description (instructions only)", () => {
		const spec = makeSpec({
			no_desc: { instructions: "Do the thing" },
		});
		const result = compileStep(spec, "no_desc", makeCtx());
		expect(result.systemPromptSegment).toContain("Do the thing");
		expect(result.systemPromptSegment).toContain("## Current Step: no_desc");
	});

	it("handles step with neither description nor instructions", () => {
		const spec = makeSpec({ bare: {} });
		const result = compileStep(spec, "bare", makeCtx());
		expect(result.systemPromptSegment).toContain("## Current Step: bare");
	});
});

// =============================================================================
// Metadata
// =============================================================================

describe("metadata", () => {
	it("stepName matches the requested step", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.metadata.stepName).toBe("gather_sources");
	});

	it("dagLevel is 0 for root step (gather_sources)", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.metadata.dagLevel).toBe(0);
	});

	it("dagLevel is 1 for evaluate_credibility (depends on gather_sources)", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "evaluate_credibility", makeCtx());
		expect(result.metadata.dagLevel).toBe(1);
	});

	it("dagLevel is 2 for synthesize (depends on evaluate_credibility)", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "synthesize", makeCtx());
		expect(result.metadata.dagLevel).toBe(2);
	});

	it("dagLevel is 3 for draft_report and expand_search (depend on synthesize)", () => {
		const spec = researchSpec();
		const draft = compileStep(spec, "draft_report", makeCtx());
		const expand = compileStep(spec, "expand_search", makeCtx());
		expect(draft.metadata.dagLevel).toBe(3);
		expect(expand.metadata.dagLevel).toBe(3);
	});

	it("totalSteps equals number of steps in spec", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.metadata.totalSteps).toBe(5);
	});

	it("attemptNumber comes from context", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx({ attemptNumber: 3 }));
		expect(result.metadata.attemptNumber).toBe(3);
	});

	it("branchTaken comes from context.branchReason", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx({ branchReason: "low_confidence" }));
		expect(result.metadata.branchTaken).toBe("low_confidence");
	});

	it("branchTaken is null when context.branchReason is null", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.metadata.branchTaken).toBeNull();
	});
});

// =============================================================================
// Output Fields (stubs for future phases)
// =============================================================================

describe("compiled step output fields", () => {
	it("outputSchema is step.output_schema when present", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.outputSchema).toEqual({
			type: "object",
			required: ["sources", "quality_scores"],
			properties: {
				sources: { type: "array", minItems: 3 },
				quality_scores: { type: "array" },
			},
		});
	});

	it("outputSchema is null when step has no output_schema", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "evaluate_credibility", makeCtx());
		expect(result.outputSchema).toBeNull();
	});

	it("qualityGates is empty array", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.qualityGates).toEqual([]);
	});

	it("selfReflection is null", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.selfReflection).toBeNull();
	});

	it("retryPolicy is compiled when step has retry config", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.retryPolicy).toEqual({
			maxAttempts: 3,
			initialInterval: "1s",
			backoffCoefficient: 2.0,
			maximumInterval: "1s",
			nonRetryableErrors: ["AuthenticationError", "RateLimitError"],
		});
	});

	it("retryPolicy is null when step has no retry config", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "evaluate_credibility", makeCtx());
		expect(result.retryPolicy).toBeNull();
	});
});

// =============================================================================
// Output Format in systemPromptSegment
// =============================================================================

describe("systemPromptSegment: output format section", () => {
	it("includes Required Output Format heading when step has output_schema", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain("## Required Output Format");
	});

	it("includes JSON schema instruction text", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain(
			"Your response must be valid JSON matching the following schema:",
		);
	});

	it("includes the JSON schema as formatted JSON", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		const schemaJson = JSON.stringify(spec.steps!.gather_sources.output_schema, null, 2);
		expect(result.systemPromptSegment).toContain(schemaJson);
	});

	it("includes JSON parsing instruction", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain(
			"Ensure your output can be parsed as JSON. Include all required fields.",
		);
	});

	it("includes structured output mode instruction", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).toContain(
			"If using structured output mode, this schema defines the response shape.",
		);
	});

	it("omits output format section when step has no output_schema", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "evaluate_credibility", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Required Output Format");
	});

	it("omits output format section for bare step", () => {
		const spec = makeSpec({ bare: {} });
		const result = compileStep(spec, "bare", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Required Output Format");
	});
});

// =============================================================================
// Retry Policy Compilation
// =============================================================================

describe("retryPolicy compilation", () => {
	it("maps max_attempts to maxAttempts", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.retryPolicy!.maxAttempts).toBe(3);
	});

	it("maps initial_interval to initialInterval", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.retryPolicy!.initialInterval).toBe("1s");
	});

	it("maps backoff_coefficient to backoffCoefficient", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.retryPolicy!.backoffCoefficient).toBe(2.0);
	});

	it("defaults maximumInterval to initialInterval when not specified", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.retryPolicy!.maximumInterval).toBe("1s");
	});

	it("maps non_retryable_errors to nonRetryableErrors", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.retryPolicy!.nonRetryableErrors).toEqual([
			"AuthenticationError",
			"RateLimitError",
		]);
	});

	it("applies defaults for partial retry config (only max_attempts)", () => {
		const spec = makeSpec({
			partial: {
				description: "partial retry",
				retry: { max_attempts: 5 },
			},
		});
		const result = compileStep(spec, "partial", makeCtx());
		expect(result.retryPolicy).toEqual({
			maxAttempts: 5,
			initialInterval: "1s",
			backoffCoefficient: 1.0,
			maximumInterval: "60s",
			nonRetryableErrors: [],
		});
	});

	it("applies all defaults for empty retry config", () => {
		const spec = makeSpec({
			empty_retry: {
				description: "empty retry",
				retry: {},
			},
		});
		const result = compileStep(spec, "empty_retry", makeCtx());
		expect(result.retryPolicy).toEqual({
			maxAttempts: 3,
			initialInterval: "1s",
			backoffCoefficient: 1.0,
			maximumInterval: "60s",
			nonRetryableErrors: [],
		});
	});

	it("uses explicit maximumInterval when provided", () => {
		const spec = makeSpec({
			with_max: {
				description: "with max interval",
				retry: {
					max_attempts: 2,
					initial_interval: "500ms",
					maximum_interval: "30s",
				},
			},
		});
		const result = compileStep(spec, "with_max", makeCtx());
		expect(result.retryPolicy!.maximumInterval).toBe("30s");
	});
});

// =============================================================================
// Integration: All 5 research-synthesizer steps
// =============================================================================

describe("integration: research-synthesizer all steps", () => {
	it("gather_sources: dagLevel 0, has output_schema, has retry", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.metadata.dagLevel).toBe(0);
		expect(result.outputSchema).not.toBeNull();
		expect(result.retryPolicy).not.toBeNull();
		expect(result.systemPromptSegment).toContain("## Required Output Format");
		expect(result.systemPromptSegment).toContain("gather_sources");
	});

	it("evaluate_credibility: dagLevel 1, no output_schema, no retry", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "evaluate_credibility", makeCtx());
		expect(result.metadata.dagLevel).toBe(1);
		expect(result.outputSchema).toBeNull();
		expect(result.retryPolicy).toBeNull();
		expect(result.systemPromptSegment).not.toContain("## Required Output Format");
	});

	it("synthesize: dagLevel 2, no output_schema, no retry", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "synthesize", makeCtx());
		expect(result.metadata.dagLevel).toBe(2);
		expect(result.outputSchema).toBeNull();
		expect(result.retryPolicy).toBeNull();
	});

	it("expand_search: dagLevel 3, minimal config", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "expand_search", makeCtx());
		expect(result.metadata.dagLevel).toBe(3);
		expect(result.outputSchema).toBeNull();
		expect(result.retryPolicy).toBeNull();
	});

	it("draft_report: dagLevel 3, no output_schema", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "draft_report", makeCtx());
		expect(result.metadata.dagLevel).toBe(3);
		expect(result.outputSchema).toBeNull();
		expect(result.retryPolicy).toBeNull();
	});

	it("all 5 steps compile without error", () => {
		const spec = researchSpec();
		const stepNames = [
			"gather_sources",
			"evaluate_credibility",
			"synthesize",
			"expand_search",
			"draft_report",
		];
		for (const name of stepNames) {
			expect(() => compileStep(spec, name, makeCtx())).not.toThrow();
		}
	});

	it("totalSteps is 5 for all compiled steps", () => {
		const spec = researchSpec();
		const stepNames = [
			"gather_sources",
			"evaluate_credibility",
			"synthesize",
			"expand_search",
			"draft_report",
		];
		for (const name of stepNames) {
			const result = compileStep(spec, name, makeCtx());
			expect(result.metadata.totalSteps).toBe(5);
		}
	});
});
