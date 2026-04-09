// =============================================================================
// LOGIC.md v1.1 - Compiler Module
// =============================================================================
// Pure functions only: no side effects, no I/O, no LLM calls, model-agnostic.
// =============================================================================

import { resolve } from "./dag.js";
import { evaluate } from "./expression.js";
import type {
	CompiledStep,
	CompiledWorkflow,
	ConfidenceConfig,
	ExecutionContext,
	JsonSchemaObject,
	LogicSpec,
	QualityGateValidator,
	Reasoning,
	RetryConfig,
	RetryPolicy,
	SelfVerification,
	Step,
	WorkflowContext,
} from "./types.js";

/** Error thrown by compiler functions */
export class CompilerError extends Error {
	override readonly name = "CompilerError";
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Format the reasoning strategy preamble section.
 * Returns empty string if no reasoning config is provided.
 */
function formatStrategyPreamble(reasoning: Reasoning): string {
	const lines: string[] = [
		"## Reasoning Strategy",
		`You are using ${reasoning.strategy} reasoning.`,
		`Max iterations: ${reasoning.max_iterations ?? "unlimited"}`,
	];

	if (reasoning.temperature !== undefined) {
		lines.push(`Temperature: ${reasoning.temperature}`);
	}

	if (reasoning.thinking_budget !== undefined) {
		lines.push(`Thinking budget: ${reasoning.thinking_budget} tokens`);
	}

	return lines.join("\n");
}

/**
 * Format the step instructions section.
 * Handles missing description and/or instructions gracefully.
 */
function formatStepInstructions(stepName: string, step: Step): string {
	const lines: string[] = [`## Current Step: ${stepName}`];

	if (step.description) {
		lines.push(step.description);
	}

	if (step.instructions) {
		if (step.description) {
			lines.push(""); // blank line between description and instructions
		}
		lines.push(step.instructions);
	}

	return lines.join("\n");
}

/**
 * Format the branch context section.
 * Explains why this branch was taken and lists alternative branches if present.
 */
function formatBranchContext(reason: string, step: Step): string {
	const lines: string[] = ["## Branch Context", `This step was reached because: ${reason}`];

	if (step.branches && step.branches.length > 0) {
		lines.push("");
		lines.push("Alternative branches from this step:");
		for (const branch of step.branches) {
			if (branch.default) {
				lines.push(`- ${branch.then} (default)`);
			} else {
				lines.push(`- ${branch.then} (condition: ${branch.if})`);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Format the retry context section.
 * Explains attempt number, max attempts, and previous failure reason.
 */
function formatRetryContext(
	attemptNumber: number,
	previousFailureReason: string | null,
	retryConfig: RetryConfig | undefined,
): string {
	let attemptLine = `Attempt ${attemptNumber}`;
	if (retryConfig) {
		attemptLine += ` of ${retryConfig.max_attempts ?? 3}`;
	}

	const lines: string[] = ["## Retry Context", attemptLine];

	if (previousFailureReason !== null) {
		lines.push(`Previous failure: ${previousFailureReason}`);
	}

	return lines.join("\n");
}

/**
 * Format confidence requirements section.
 * Instructs the LLM to meet minimum confidence levels.
 */
function formatConfidenceRequirements(confidence: ConfidenceConfig): string {
	const lines: string[] = ["## Confidence Requirements"];

	if (confidence.minimum !== undefined) {
		lines.push(`You must achieve a minimum confidence of ${confidence.minimum} in your response.`);
	}

	if (confidence.target !== undefined) {
		lines.push(`Target confidence level: ${confidence.target}`);
	}

	if (confidence.escalate_below !== undefined) {
		lines.push(
			`If your confidence falls below ${confidence.escalate_below}, escalate to a human reviewer rather than proceeding.`,
		);
	}

	return lines.join("\n");
}

/**
 * Format quality gate checklist section.
 * Collects items from step.verification and spec.quality_gates.pre_output.
 */
function formatQualityGateChecklist(step: Step, spec: LogicSpec): string {
	const items: string[] = [];

	if (step.verification) {
		items.push(step.verification.on_fail_message ?? step.verification.check);
	}

	if (spec.quality_gates?.pre_output) {
		for (const gate of spec.quality_gates.pre_output) {
			items.push(gate.message ?? gate.name);
		}
	}

	if (items.length === 0) {
		return "";
	}

	const lines: string[] = [
		"## Pre-Response Checklist",
		"Before responding, verify:",
		...items.map((item) => `- [ ] ${item}`),
	];

	return lines.join("\n");
}

/**
 * Format the output schema section for inclusion in the system prompt.
 * Model-agnostic: works for both JSON mode and function-calling mode.
 */
function formatOutputSchema(schema: JsonSchemaObject): string {
	const schemaJson = JSON.stringify(schema, null, 2);
	return [
		"## Required Output Format",
		"Your response must be valid JSON matching the following schema:",
		"",
		"```json",
		schemaJson,
		"```",
		"",
		"Ensure your output can be parsed as JSON. Include all required fields.",
		"If using structured output mode, this schema defines the response shape.",
	].join("\n");
}

/**
 * Compile a RetryConfig into a normalized RetryPolicy.
 * Applies sensible defaults for any missing fields.
 */
function compileRetryPolicy(retry: RetryConfig): RetryPolicy {
	const initialInterval = retry.initial_interval ?? "1s";
	return {
		maxAttempts: retry.max_attempts ?? 3,
		initialInterval,
		backoffCoefficient: retry.backoff_coefficient ?? 1.0,
		maximumInterval: retry.maximum_interval ?? (retry.initial_interval ? initialInterval : "60s"),
		nonRetryableErrors: retry.non_retryable_errors ?? [],
	};
}

/**
 * Compile self-verification config into a self-reflection prompt and minimum score.
 * Returns null if disabled or unsupported strategy.
 */
function compileSelfReflection(
	selfVerification: SelfVerification,
): { prompt: string; minimumScore: number } | null {
	if (selfVerification.enabled === false) {
		return null;
	}

	if (selfVerification.strategy === "rubric" && selfVerification.rubric) {
		const criteria = selfVerification.rubric.criteria ?? [];
		const minimumScore = selfVerification.rubric.minimum_score ?? 0.5;

		const criteriaLines = criteria.map(
			(c) => `- **${c.name}** (weight: ${c.weight}): ${c.description ?? "No description"}`,
		);

		const prompt = [
			"## Self-Evaluation",
			"",
			"Review your output against the following criteria and score each from 0.0 to 1.0:",
			"",
			...criteriaLines,
			"",
			`Calculate your weighted total score. Minimum passing score: ${minimumScore}.`,
		].join("\n");

		return { prompt, minimumScore };
	}

	if (selfVerification.strategy === "reflection" && selfVerification.reflection) {
		const prompt =
			selfVerification.reflection.prompt ?? "Review your output for accuracy and completeness.";
		return { prompt, minimumScore: 0 };
	}

	return null;
}

/**
 * Compile a gate check expression into a QualityGateValidator function.
 * Uses the expression engine's evaluate() to evaluate the check expression
 * with the step output injected as `{ output }` in the expression context.
 */
function compileGateValidator(checkExpression: string, message?: string): QualityGateValidator {
	return (output: unknown) => {
		const result = evaluate(checkExpression, { output });
		if (result) {
			return { passed: true };
		}
		return { passed: false, ...(message ? { message } : {}) };
	};
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Compile a single named step from a LogicSpec into an executable form.
 *
 * Pure function -- no I/O, no side effects.
 */
export function compileStep(
	spec: LogicSpec,
	stepName: string,
	context: ExecutionContext,
): CompiledStep {
	const steps = spec.steps;

	if (!steps || Object.keys(steps).length === 0) {
		throw new CompilerError(`Cannot compile step "${stepName}": spec has no steps`);
	}

	const step = steps[stepName];
	if (!step) {
		throw new CompilerError(`Step "${stepName}" not found in spec "${spec.name}"`);
	}

	// Resolve DAG to compute depth levels
	const dagResult = resolve(steps);
	let dagLevel = 0;
	if (dagResult.ok) {
		for (let level = 0; level < dagResult.levels.length; level++) {
			const levelSteps = dagResult.levels[level];
			if (levelSteps?.includes(stepName)) {
				dagLevel = level;
				break;
			}
		}
	}

	// Build systemPromptSegment
	const segments: string[] = [];

	if (spec.reasoning) {
		segments.push(formatStrategyPreamble(spec.reasoning));
	}

	segments.push(formatStepInstructions(stepName, step));

	if (context.branchReason !== null) {
		segments.push(formatBranchContext(context.branchReason, step));
	}

	if (context.attemptNumber > 1) {
		segments.push(
			formatRetryContext(context.attemptNumber, context.previousFailureReason, step.retry),
		);
	}

	if (step.confidence) {
		segments.push(formatConfidenceRequirements(step.confidence));
	}

	const qualityGateSection = formatQualityGateChecklist(step, spec);
	if (qualityGateSection) {
		segments.push(qualityGateSection);
	}

	if (step.output_schema) {
		segments.push(formatOutputSchema(step.output_schema));
	}

	const systemPromptSegment = segments.join("\n\n");

	const estimatedTokens = estimateTokens(systemPromptSegment);
	const tokenWarning =
		estimatedTokens > 2000
			? `Prompt segment is ~${estimatedTokens} tokens (exceeds 2000 token budget)`
			: undefined;

	return {
		systemPromptSegment,
		outputSchema: (step.output_schema as object) ?? null,
		qualityGates: (() => {
			const gates: QualityGateValidator[] = [];
			if (step.verification) {
				gates.push(
					compileGateValidator(step.verification.check, step.verification.on_fail_message),
				);
			}
			if (spec.quality_gates?.pre_output) {
				for (const gate of spec.quality_gates.pre_output) {
					gates.push(compileGateValidator(gate.check, gate.message));
				}
			}
			return gates;
		})(),
		selfReflection: spec.quality_gates?.self_verification
			? compileSelfReflection(spec.quality_gates.self_verification)
			: null,
		retryPolicy: step.retry ? compileRetryPolicy(step.retry) : null,
		metadata: {
			stepName,
			dagLevel,
			totalSteps: Object.keys(steps).length,
			attemptNumber: context.attemptNumber,
			branchTaken: context.branchReason,
		},
		tokenWarning,
	};
}

/**
 * Compile an entire workflow (all steps + DAG ordering) from a LogicSpec.
 *
 * Pure function -- no I/O, no side effects.
 */
export function compileWorkflow(spec: LogicSpec, context: WorkflowContext): CompiledWorkflow {
	// Handle empty steps
	if (!spec.steps || Object.keys(spec.steps).length === 0) {
		return {
			steps: [],
			dagLevels: [],
			globalQualityGates: [],
			fallbackPolicy: spec.fallback ?? null,
			metadata: { name: spec.name, totalSteps: 0, totalLevels: 0 },
		};
	}

	// Resolve DAG
	const dagResult = resolve(spec.steps);
	if (!dagResult.ok) {
		throw new CompilerError(
			`Workflow DAG resolution failed: ${dagResult.errors.map((e) => e.message).join("; ")}`,
		);
	}

	// Pre-compile steps in DAG order
	const compiledSteps: CompiledStep[] = [];
	for (const stepName of dagResult.order) {
		const ctx: ExecutionContext = {
			currentStep: stepName,
			previousOutputs: context.previousOutputs,
			input: context.input,
			attemptNumber: context.attemptNumber,
			branchReason: context.branchReason,
			previousFailureReason: context.previousFailureReason,
		};
		compiledSteps.push(compileStep(spec, stepName, ctx));
	}

	// Compile global quality gates
	const globalGates: QualityGateValidator[] = [];
	if (spec.quality_gates?.pre_output) {
		for (const gate of spec.quality_gates.pre_output) {
			globalGates.push(compileGateValidator(gate.check, gate.message));
		}
	}

	return {
		steps: compiledSteps,
		dagLevels: dagResult.levels,
		globalQualityGates: globalGates,
		fallbackPolicy: spec.fallback ?? null,
		metadata: {
			name: spec.name,
			totalSteps: Object.keys(spec.steps).length,
			totalLevels: dagResult.levels.length,
		},
	};
}

/**
 * Estimate token count for a text string.
 *
 * Pure function -- no I/O, no side effects.
 */
export function estimateTokens(text: string): number {
	if (text.length === 0) return 0;
	return Math.ceil(text.length / 4);
}
