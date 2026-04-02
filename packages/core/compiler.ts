// =============================================================================
// LOGIC.md v1.1 - Compiler Module
// =============================================================================
// Pure functions only: no side effects, no I/O, no LLM calls, model-agnostic.
// =============================================================================

import { resolve } from "./dag.js";
import type {
	CompiledStep,
	CompiledWorkflow,
	ExecutionContext,
	JsonSchemaObject,
	LogicSpec,
	Reasoning,
	RetryConfig,
	RetryPolicy,
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
	const lines: string[] = [
		"## Branch Context",
		`This step was reached because: ${reason}`,
	];

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

	if (step.output_schema) {
		segments.push(formatOutputSchema(step.output_schema));
	}

	const systemPromptSegment = segments.join("\n\n");

	return {
		systemPromptSegment,
		outputSchema: (step.output_schema as object) ?? null,
		qualityGates: [],
		selfReflection: null,
		retryPolicy: step.retry ? compileRetryPolicy(step.retry) : null,
		metadata: {
			stepName,
			dagLevel,
			totalSteps: Object.keys(steps).length,
			attemptNumber: context.attemptNumber,
			branchTaken: context.branchReason,
		},
	};
}

/**
 * Compile an entire workflow (all steps + DAG ordering) from a LogicSpec.
 *
 * Pure function -- no I/O, no side effects.
 */
export function compileWorkflow(_spec: LogicSpec, _context: WorkflowContext): CompiledWorkflow {
	throw new CompilerError("Not implemented");
}

/**
 * Estimate token count for a text string.
 *
 * Pure function -- no I/O, no side effects.
 */
export function estimateTokens(_text: string): number {
	throw new CompilerError("Not implemented");
}
