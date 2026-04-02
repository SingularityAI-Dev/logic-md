import { describe, expect, it } from "vitest";
import { CompilerError, compileStep, compileWorkflow, estimateTokens } from "./compiler.js";
import type { ExecutionContext, LogicSpec, Step, WorkflowContext } from "./types.js";

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
		previousFailureReason: null,
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

// =============================================================================
// Branch Context in systemPromptSegment
// =============================================================================

describe("systemPromptSegment: branch context", () => {
	it("includes branch context section when branchReason is set", () => {
		const spec = researchSpec();
		const result = compileStep(
			spec,
			"gather_sources",
			makeCtx({ branchReason: "confidence below threshold" }),
		);
		expect(result.systemPromptSegment).toContain("## Branch Context");
		expect(result.systemPromptSegment).toContain("confidence below threshold");
	});

	it("explains alternatives when step has branches", () => {
		const spec = makeSpec({
			branching_step: {
				description: "A step with branches",
				branches: [
					{ if: "{{ confidence > 0.8 }}", then: "step_a" },
					{ default: true, then: "step_b" },
				],
			},
		});
		const result = compileStep(
			spec,
			"branching_step",
			makeCtx({ branchReason: "confidence check" }),
		);
		expect(result.systemPromptSegment).toMatch(/[Aa]lternative/);
		expect(result.systemPromptSegment).toContain("step_a");
		expect(result.systemPromptSegment).toContain("step_b");
	});

	it("omits branch context when branchReason is null", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Branch Context");
	});
});

// =============================================================================
// Retry Context in systemPromptSegment
// =============================================================================

describe("systemPromptSegment: retry context", () => {
	it("includes retry context section when attemptNumber > 1", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx({ attemptNumber: 2 }));
		expect(result.systemPromptSegment).toContain("## Retry Context");
		expect(result.systemPromptSegment).toContain("Attempt 2");
	});

	it("includes previous failure reason when set", () => {
		const spec = researchSpec();
		const result = compileStep(
			spec,
			"gather_sources",
			makeCtx({
				attemptNumber: 3,
				previousFailureReason: "Output schema validation failed",
			}),
		);
		expect(result.systemPromptSegment).toContain("Output schema validation failed");
	});

	it("includes max attempts from retry policy when step has retry config", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx({ attemptNumber: 2 }));
		expect(result.systemPromptSegment).toContain("3");
	});

	it("omits retry context when attemptNumber is 1", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Retry Context");
	});

	it("omits failure reason line when previousFailureReason is null", () => {
		const spec = researchSpec();
		const result = compileStep(
			spec,
			"gather_sources",
			makeCtx({ attemptNumber: 2, previousFailureReason: null }),
		);
		expect(result.systemPromptSegment).toContain("## Retry Context");
		expect(result.systemPromptSegment).not.toContain("Previous failure");
	});
});

// =============================================================================
// Confidence Requirements in systemPromptSegment
// =============================================================================

describe("systemPromptSegment: confidence requirements", () => {
	it("includes confidence section when step has confidence config", () => {
		const spec = makeSpec({
			analyzed: {
				description: "Analyze data",
				confidence: { minimum: 0.7, target: 0.9 },
			},
		});
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.systemPromptSegment).toContain("## Confidence Requirements");
	});

	it("shows minimum confidence threshold", () => {
		const spec = makeSpec({
			analyzed: {
				description: "Analyze data",
				confidence: { minimum: 0.7, target: 0.9 },
			},
		});
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.systemPromptSegment).toContain("0.7");
		expect(result.systemPromptSegment).toMatch(/minimum/i);
	});

	it("shows target confidence when set", () => {
		const spec = makeSpec({
			analyzed: {
				description: "Analyze data",
				confidence: { minimum: 0.7, target: 0.9 },
			},
		});
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.systemPromptSegment).toContain("0.9");
		expect(result.systemPromptSegment).toMatch(/target/i);
	});

	it("shows escalate_below when set", () => {
		const spec = makeSpec({
			risky: {
				description: "Risky step",
				confidence: { minimum: 0.5, escalate_below: 0.3 },
			},
		});
		const result = compileStep(spec, "risky", makeCtx());
		expect(result.systemPromptSegment).toContain("0.3");
		expect(result.systemPromptSegment).toMatch(/escalat/i);
	});

	it("omits confidence section when step has no confidence config", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Confidence Requirements");
	});
});

// =============================================================================
// Quality Gate Checklist in systemPromptSegment
// =============================================================================

describe("systemPromptSegment: quality gate checklist", () => {
	it("includes quality gate checklist from step.verification", () => {
		const spec = makeSpec({
			verified: {
				description: "Verified step",
				verification: {
					check: "{{ output.sources.length >= 3 }}",
					on_fail: "retry",
					on_fail_message: "Need at least 3 sources",
				},
			},
		});
		const result = compileStep(spec, "verified", makeCtx());
		expect(result.systemPromptSegment).toContain("## Pre-Response Checklist");
		expect(result.systemPromptSegment).toContain("Need at least 3 sources");
	});

	it("includes pre_output gates from spec.quality_gates", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "gated-spec",
			steps: {
				checked: { description: "Checked step" },
			},
			quality_gates: {
				pre_output: [
					{
						name: "length_check",
						check: "{{ output.length > 100 }}",
						message: "Response must be over 100 chars",
					},
				],
			},
		};
		const result = compileStep(spec, "checked", makeCtx());
		expect(result.systemPromptSegment).toContain("Response must be over 100 chars");
	});

	it("combines step verification and global quality gates", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "combined-spec",
			steps: {
				combined: {
					description: "Combined step",
					verification: {
						check: "{{ output.valid }}",
						on_fail: "retry",
						on_fail_message: "Output must be valid",
					},
				},
			},
			quality_gates: {
				pre_output: [
					{
						name: "format_gate",
						check: "{{ output.formatted }}",
						message: "Output must be formatted",
					},
				],
			},
		};
		const result = compileStep(spec, "combined", makeCtx());
		expect(result.systemPromptSegment).toContain("Output must be valid");
		expect(result.systemPromptSegment).toContain("Output must be formatted");
	});

	it("omits checklist when no verification and no quality_gates", () => {
		const spec = makeSpec({ bare: {} });
		const result = compileStep(spec, "bare", makeCtx());
		expect(result.systemPromptSegment).not.toContain("## Pre-Response Checklist");
	});

	it("uses gate name as fallback when message is missing", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "namefallback-spec",
			steps: {
				fallback_step: { description: "Step with nameless gate" },
			},
			quality_gates: {
				pre_output: [
					{
						name: "format_check",
						check: "{{ valid }}",
					},
				],
			},
		};
		const result = compileStep(spec, "fallback_step", makeCtx());
		expect(result.systemPromptSegment).toContain("format_check");
	});
});

// =============================================================================
// Quality Gate Compilation (qualityGates validators)
// =============================================================================

describe("compileStep: qualityGates", () => {
	it("step verification gate compiles to validator", () => {
		const spec = makeSpec({
			validated: {
				description: "Validated step",
				verification: {
					check: "{{ output.valid == true }}",
					on_fail: "retry",
					on_fail_message: "Output not valid",
				},
			},
		});
		const result = compileStep(spec, "validated", makeCtx());
		expect(result.qualityGates).toHaveLength(1);
		expect(result.qualityGates[0]!({ valid: true })).toEqual({ passed: true });
		expect(result.qualityGates[0]!({ valid: false })).toEqual({
			passed: false,
			message: "Output not valid",
		});
	});

	it("spec-level pre_output gates compile to validators", () => {
		const spec: LogicSpec = {
			...makeSpec({
				scored: { description: "Scored step" },
			}),
			quality_gates: {
				pre_output: [
					{
						name: "confidence-check",
						check: "{{ output.score >= 0.8 }}",
						message: "Score too low",
						severity: "error",
					},
				],
			},
		};
		const result = compileStep(spec, "scored", makeCtx());
		expect(result.qualityGates.length).toBeGreaterThanOrEqual(1);
		expect(result.qualityGates[0]!({ score: 0.9 })).toEqual({ passed: true });
		expect(result.qualityGates[0]!({ score: 0.5 })).toEqual({
			passed: false,
			message: "Score too low",
		});
	});

	it("both step verification and spec pre_output combined", () => {
		const spec: LogicSpec = {
			...makeSpec({
				combined: {
					description: "Combined step",
					verification: {
						check: "{{ output.valid == true }}",
						on_fail: "retry",
						on_fail_message: "Not valid",
					},
				},
			}),
			quality_gates: {
				pre_output: [
					{
						name: "format-gate",
						check: "{{ output.formatted == true }}",
						message: "Not formatted",
					},
				],
			},
		};
		const result = compileStep(spec, "combined", makeCtx());
		expect(result.qualityGates).toHaveLength(2);
		// Step verification first
		expect(result.qualityGates[0]!({ valid: true })).toEqual({ passed: true });
		expect(result.qualityGates[0]!({ valid: false })).toEqual({
			passed: false,
			message: "Not valid",
		});
		// Spec pre_output second
		expect(result.qualityGates[1]!({ formatted: true })).toEqual({ passed: true });
		expect(result.qualityGates[1]!({ formatted: false })).toEqual({
			passed: false,
			message: "Not formatted",
		});
	});

	it("gate with no message returns passed:false without message", () => {
		const spec = makeSpec({
			no_msg: {
				description: "No message step",
				verification: {
					check: "{{ output.ok == true }}",
					on_fail: "retry",
				},
			},
		});
		const result = compileStep(spec, "no_msg", makeCtx());
		expect(result.qualityGates).toHaveLength(1);
		const failing = result.qualityGates[0]!({ ok: false });
		expect(failing.passed).toBe(false);
		expect(failing.message).toBeUndefined();
	});

	it("step without verification has no step-level gates", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.qualityGates).toEqual([]);
	});

	it("gate expression uses evaluate() from expression engine", () => {
		const spec = makeSpec({
			expr_step: {
				description: "Expression test step",
				verification: {
					check: "{{ output.items.length > 0 }}",
					on_fail: "retry",
					on_fail_message: "Items must not be empty",
				},
			},
		});
		const result = compileStep(spec, "expr_step", makeCtx());
		expect(result.qualityGates).toHaveLength(1);
		expect(result.qualityGates[0]!({ items: [1, 2, 3] })).toEqual({ passed: true });
		expect(result.qualityGates[0]!({ items: [] })).toEqual({
			passed: false,
			message: "Items must not be empty",
		});
	});
});

// =============================================================================
// Self-Reflection Compilation
// =============================================================================

describe("compileStep: selfReflection", () => {
	it("rubric self-verification compiles to selfReflection", () => {
		const spec: LogicSpec = {
			...makeSpec({
				analyzed: { description: "Analyze data" },
			}),
			quality_gates: {
				self_verification: {
					enabled: true,
					strategy: "rubric",
					rubric: {
						criteria: [
							{ name: "accuracy", weight: 0.4, description: "Factual correctness" },
							{ name: "completeness", weight: 0.6, description: "Covers all aspects" },
						],
						minimum_score: 0.7,
					},
				},
			},
		};
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.selfReflection).not.toBeNull();
		expect(result.selfReflection!.minimumScore).toBe(0.7);
		expect(result.selfReflection!.prompt).toContain("accuracy");
		expect(result.selfReflection!.prompt).toContain("completeness");
		expect(result.selfReflection!.prompt).toContain("0.4");
		expect(result.selfReflection!.prompt).toContain("0.6");
		expect(result.selfReflection!.prompt).toContain("Factual correctness");
		expect(result.selfReflection!.prompt).toContain("Covers all aspects");
	});

	it("self-reflection prompt is human-readable", () => {
		const spec: LogicSpec = {
			...makeSpec({
				analyzed: { description: "Analyze data" },
			}),
			quality_gates: {
				self_verification: {
					enabled: true,
					strategy: "rubric",
					rubric: {
						criteria: [
							{ name: "accuracy", weight: 0.4, description: "Factual correctness" },
							{ name: "completeness", weight: 0.6, description: "Covers all aspects" },
						],
						minimum_score: 0.7,
					},
				},
			},
		};
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.selfReflection).not.toBeNull();
		const prompt = result.selfReflection!.prompt;
		// Contains a self-evaluation header
		expect(prompt).toMatch(/Self-Evaluation|Review your output/i);
		// Contains each criterion listed
		expect(prompt).toContain("accuracy");
		expect(prompt).toContain("completeness");
		// Contains instruction to score
		expect(prompt).toMatch(/score/i);
	});

	it("disabled self-verification returns null", () => {
		const spec: LogicSpec = {
			...makeSpec({
				analyzed: { description: "Analyze data" },
			}),
			quality_gates: {
				self_verification: {
					enabled: false,
					strategy: "rubric",
					rubric: {
						criteria: [{ name: "accuracy", weight: 0.4, description: "Factual correctness" }],
						minimum_score: 0.7,
					},
				},
			},
		};
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.selfReflection).toBeNull();
	});

	it("missing self-verification returns null", () => {
		const spec = researchSpec();
		const result = compileStep(spec, "gather_sources", makeCtx());
		expect(result.selfReflection).toBeNull();
	});

	it("reflection strategy compiles to selfReflection", () => {
		const spec: LogicSpec = {
			...makeSpec({
				reviewed: { description: "Review output" },
			}),
			quality_gates: {
				self_verification: {
					enabled: true,
					strategy: "reflection",
					reflection: {
						prompt: "Review your response for accuracy and bias",
						max_revisions: 2,
					},
				},
			},
		};
		const result = compileStep(spec, "reviewed", makeCtx());
		expect(result.selfReflection).not.toBeNull();
		expect(result.selfReflection!.prompt).toContain("Review your response for accuracy and bias");
		expect(result.selfReflection!.minimumScore).toBe(0);
	});

	it("rubric without minimum_score defaults to 0.5", () => {
		const spec: LogicSpec = {
			...makeSpec({
				analyzed: { description: "Analyze data" },
			}),
			quality_gates: {
				self_verification: {
					enabled: true,
					strategy: "rubric",
					rubric: {
						criteria: [{ name: "clarity", weight: 1.0, description: "Clear and concise" }],
					},
				},
			},
		};
		const result = compileStep(spec, "analyzed", makeCtx());
		expect(result.selfReflection).not.toBeNull();
		expect(result.selfReflection!.minimumScore).toBe(0.5);
	});
});

// =============================================================================
// estimateTokens
// =============================================================================

describe("estimateTokens", () => {
	it("returns 0 for empty string", () => {
		expect(estimateTokens("")).toBe(0);
	});

	it("estimates ~4 chars per token", () => {
		expect(estimateTokens("hello world")).toBe(3); // 11 / 4 = 2.75, ceil to 3
	});

	it("handles long text", () => {
		const str = "a".repeat(8000);
		expect(estimateTokens(str)).toBe(2000); // 8000 / 4 = 2000 exactly
	});

	it("handles whitespace-only text", () => {
		expect(estimateTokens("    ")).toBe(1); // 4 / 4 = 1
	});
});

// =============================================================================
// Token Warnings
// =============================================================================

describe("token warnings", () => {
	it("adds tokenWarning when segment exceeds 2000 tokens", () => {
		const longInstructions = "x".repeat(9000);
		const spec = makeSpec({
			long_step: {
				instructions: longInstructions,
			},
		});
		const result = compileStep(spec, "long_step", makeCtx());
		expect(result.tokenWarning).toBeDefined();
		expect(typeof result.tokenWarning).toBe("string");
		expect(result.tokenWarning).toContain("2000");
		expect(result.tokenWarning!.toLowerCase()).toContain("token");
	});

	it("does not add tokenWarning for short segments", () => {
		const spec = makeSpec({
			short_step: {
				description: "Short step",
				instructions: "Do something simple",
			},
		});
		const result = compileStep(spec, "short_step", makeCtx());
		expect(result.tokenWarning).toBeUndefined();
	});
});

// =============================================================================
// Helpers (compileWorkflow)
// =============================================================================

/** Build a minimal WorkflowContext */
function makeWorkflowCtx(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
	return {
		currentStep: "",
		previousOutputs: {},
		input: null,
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
		totalSteps: 0,
		completedSteps: [],
		dagLevels: [],
		...overrides,
	};
}

// =============================================================================
// compileWorkflow
// =============================================================================

describe("compileWorkflow", () => {
	it("compiles a single-step workflow", () => {
		const spec = makeSpec({
			only_step: { description: "The only step" },
		});
		const result = compileWorkflow(spec, makeWorkflowCtx());
		expect(result.steps).toHaveLength(1);
		expect(result.dagLevels).toEqual([["only_step"]]);
		expect(result.metadata.totalSteps).toBe(1);
		expect(result.metadata.totalLevels).toBe(1);
		expect(result.metadata.name).toBe("test-spec");
		expect(result.steps[0]!.metadata.stepName).toBe("only_step");
	});

	it("orders steps by DAG levels", () => {
		const spec = researchSpec();
		const result = compileWorkflow(spec, makeWorkflowCtx());
		expect(result.dagLevels[0]).toEqual(["gather_sources"]);
		expect(result.dagLevels[1]).toEqual(["evaluate_credibility"]);
		expect(result.dagLevels[2]).toEqual(["synthesize"]);
		expect(result.dagLevels[3]).toEqual(["draft_report", "expand_search"]);
		expect(result.steps).toHaveLength(5);
		expect(result.metadata.totalLevels).toBe(4);
	});

	it("pre-compiles each step via compileStep", () => {
		const spec = researchSpec();
		const result = compileWorkflow(spec, makeWorkflowCtx());
		for (const step of result.steps) {
			expect(step.systemPromptSegment).toBeTruthy();
		}
		expect(result.steps[0]!.systemPromptSegment).toContain("gather_sources");
		expect(result.steps[0]!.retryPolicy).not.toBeNull();
	});

	it("attaches global quality gates as validators", () => {
		const spec: LogicSpec = {
			...makeSpec({
				checked: { description: "Checked step" },
			}),
			quality_gates: {
				pre_output: [
					{
						name: "len_check",
						check: "{{ output.length > 0 }}",
						message: "Output must not be empty",
					},
				],
			},
		};
		const result = compileWorkflow(spec, makeWorkflowCtx());
		expect(result.globalQualityGates).toHaveLength(1);
		expect(result.globalQualityGates[0]!("hello")).toEqual({ passed: true });
		expect(result.globalQualityGates[0]!("")).toEqual({
			passed: false,
			message: "Output must not be empty",
		});
	});

	it("attaches fallback policy", () => {
		const specWithFallback: LogicSpec = {
			...makeSpec({
				step_a: { description: "Step A" },
			}),
			fallback: { strategy: "graceful_degrade" },
		};
		const result = compileWorkflow(specWithFallback, makeWorkflowCtx());
		expect(result.fallbackPolicy).toEqual({ strategy: "graceful_degrade" });

		const specWithout = makeSpec({
			step_a: { description: "Step A" },
		});
		const resultWithout = compileWorkflow(specWithout, makeWorkflowCtx());
		expect(resultWithout.fallbackPolicy).toBeNull();
	});

	it("returns empty steps for spec with no steps", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "empty-workflow",
		};
		const result = compileWorkflow(spec, makeWorkflowCtx());
		expect(result.steps).toEqual([]);
		expect(result.dagLevels).toEqual([]);
		expect(result.metadata.totalSteps).toBe(0);
		expect(result.metadata.totalLevels).toBe(0);
	});

	it("throws CompilerError on DAG cycle", () => {
		const spec = makeSpec({
			step_a: { description: "A", needs: ["step_b"] },
			step_b: { description: "B", needs: ["step_a"] },
		});
		expect(() => compileWorkflow(spec, makeWorkflowCtx())).toThrow(CompilerError);
	});
});
