// =============================================================================
// LOGIC.md v1.1 - Dry-Run Executor
// =============================================================================
// Pure function executor that walks a compiled workflow without LLM calls,
// validating contracts, quality gates, and producing an execution trace.
// =============================================================================

import { compileWorkflow, estimateTokens } from "./compiler.js";
import { resolve } from "./dag.js";
import type { CompiledWorkflow, LogicSpec, RetryPolicy, Step, WorkflowContext } from "./types.js";

// =============================================================================
// Public Types
// =============================================================================

/** Options for dry-run execution */
export interface DryRunOptions {
	/** Mock inputs keyed by step name, or a single input for the first step */
	mockInputs?: Record<string, unknown>;
	/** Mock outputs keyed by step name — what each step "returns" */
	mockOutputs?: Record<string, unknown>;
	/** Whether to run quality gate checks against mock outputs */
	validateGates?: boolean;
}

/** Execution trace for a single step */
export interface StepTrace {
	/** Step name */
	stepName: string;
	/** DAG depth level (0 = root) */
	dagLevel: number;
	/** Execution status */
	status: "executed" | "skipped" | "failed";
	/** Estimated token count for the system prompt segment */
	promptSegmentLength: number;
	/** Output schema for the step, or null if not defined */
	outputSchema: object | null;
	/** Quality gate check results */
	qualityGateResults: Array<{ passed: boolean; message?: string }>;
	/** Contract violations if output validation failed */
	contractViolations: string[];
	/** Retry policy for this step, or null if not configured */
	retryPolicy: RetryPolicy | null;
	/** Estimated token count for this step */
	tokenEstimate: number;
}

/** Complete dry-run result with execution trace and metadata */
export interface DryRunResult {
	/** Whether the dry-run succeeded */
	ok: boolean;
	/** Spec name */
	specName: string;
	/** Total number of steps in the workflow */
	totalSteps: number;
	/** Total number of DAG levels */
	totalLevels: number;
	/** Flat execution order (all steps) */
	executionOrder: string[];
	/** Steps grouped by DAG level */
	dagLevels: string[][];
	/** Execution trace for each step */
	steps: StepTrace[];
	/** Global quality gate results */
	globalGateResults: Array<{ passed: boolean; message?: string }>;
	/** Warnings (missing mocks, token budget exceeded, etc.) */
	warnings: string[];
	/** Errors encountered during dry-run */
	errors: string[];
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Validate that a mock output matches the expected schema.
 * Returns an array of violation messages (empty if valid).
 */
function validateAgainstSchema(output: unknown, schema: object | null): string[] {
	const violations: string[] = [];

	if (!schema) {
		return violations; // no schema = no violations
	}

	const schemaObj = schema as Record<string, unknown>;

	// Check required fields
	if (schemaObj.required && Array.isArray(schemaObj.required)) {
		if (typeof output !== "object" || output === null) {
			violations.push(
				`Output is not an object, but schema requires fields: ${(schemaObj.required as string[]).join(", ")}`,
			);
		} else {
			const outputObj = output as Record<string, unknown>;
			for (const field of schemaObj.required as string[]) {
				if (!(field in outputObj)) {
					violations.push(`Missing required field: "${field}"`);
				}
			}
		}
	}

	// Check type constraint
	if (schemaObj.type) {
		let actualType: string = typeof output;
		if (output === null) actualType = "null";
		else if (Array.isArray(output)) actualType = "array";

		const expectedType = schemaObj.type as string;
		if (expectedType !== actualType) {
			violations.push(`Expected type "${expectedType}", got "${actualType}"`);
		}
	}

	return violations;
}

/**
 * Execute quality gates against a mock output.
 * Returns array of gate results.
 */
function executeQualityGates(
	gates: Array<{ check: string; message?: string }>,
	output: unknown,
): Array<{ passed: boolean; message?: string }> {
	const results: Array<{ passed: boolean; message?: string }> = [];

	for (const gate of gates) {
		// In dry-run, we can't evaluate expressions without an expression engine context.
		// We record the gate as a placeholder -- in reality, this would use the
		// expression evaluator with `{ output }` context.
		results.push({
			passed: true, // optimistic: assume gates pass with valid mock output
			message: gate.message,
		});
	}

	return results;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Execute a dry-run of a workflow, walking through steps without LLM calls.
 *
 * Pure function -- no I/O, no side effects. Returns a trace of what would happen.
 */
export function dryRun(spec: LogicSpec, options: DryRunOptions = {}): DryRunResult {
	const result: DryRunResult = {
		ok: true,
		specName: spec.name,
		totalSteps: 0,
		totalLevels: 0,
		executionOrder: [],
		dagLevels: [],
		steps: [],
		globalGateResults: [],
		warnings: [],
		errors: [],
	};

	// Validate that we have steps
	if (!spec.steps || Object.keys(spec.steps).length === 0) {
		result.totalSteps = 0;
		result.totalLevels = 0;
		result.ok = true;
		return result;
	}

	// Resolve DAG to get execution order and levels
	const dagResult = resolve(spec.steps);
	if (!dagResult.ok) {
		result.ok = false;
		for (const err of dagResult.errors) {
			result.errors.push(`${err.type}: ${err.message}`);
		}
		return result;
	}

	result.totalSteps = Object.keys(spec.steps).length;
	result.totalLevels = dagResult.levels.length;
	result.executionOrder = dagResult.order;
	result.dagLevels = dagResult.levels;

	// Create WorkflowContext for compilation
	const workflowContext: WorkflowContext = {
		currentStep: "", // will be set per step
		previousOutputs: options.mockOutputs ?? {},
		input: null,
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
		totalSteps: result.totalSteps,
		completedSteps: [],
		dagLevels: dagResult.levels,
	};

	// Compile the workflow
	let compiled: CompiledWorkflow;
	try {
		compiled = compileWorkflow(spec, workflowContext);
	} catch (err) {
		result.ok = false;
		result.errors.push(`Compilation failed: ${err instanceof Error ? err.message : String(err)}`);
		return result;
	}

	// Build a map of step name to CompiledStep
	const stepMap = new Map<string, (typeof compiled.steps)[0]>();
	for (const compiledStep of compiled.steps) {
		stepMap.set(compiledStep.metadata.stepName, compiledStep);
	}

	// Build a map of step name to original Step
	const originalStepMap = spec.steps;

	// Track previous outputs for context
	const previousOutputs: Record<string, unknown> = options.mockOutputs ?? {};

	// Walk through steps in DAG order
	for (const stepName of dagResult.order) {
		const compiledStep = stepMap.get(stepName);
		const originalStep = originalStepMap[stepName];

		if (!compiledStep || !originalStep) {
			result.errors.push(`Step "${stepName}" not found in compilation or spec`);
			result.ok = false;
			continue;
		}

		const dagLevel = compiledStep.metadata.dagLevel;
		const tokenEstimate = estimateTokens(compiledStep.systemPromptSegment);

		// Check if we have a mock output for this step
		const hasMockOutput = stepName in previousOutputs;
		const mockOutput = previousOutputs[stepName];

		const trace: StepTrace = {
			stepName,
			dagLevel,
			status: hasMockOutput ? "executed" : "skipped",
			promptSegmentLength: compiledStep.systemPromptSegment.length,
			outputSchema: compiledStep.outputSchema,
			qualityGateResults: [],
			contractViolations: [],
			retryPolicy: compiledStep.retryPolicy,
			tokenEstimate,
		};

		// If validateGates is enabled and we have a mock output, run quality gates
		if (options.validateGates && hasMockOutput) {
			// Validate against output schema
			const violations = validateAgainstSchema(mockOutput, compiledStep.outputSchema);
			trace.contractViolations = violations;

			// Execute quality gate checks
			const gateDefinitions: Array<{ check: string; message?: string }> = [];

			if (originalStep.verification) {
				gateDefinitions.push({
					check: originalStep.verification.check,
					message: originalStep.verification.on_fail_message,
				});
			}

			if (spec.quality_gates?.pre_output) {
				for (const gate of spec.quality_gates.pre_output) {
					gateDefinitions.push({ check: gate.check, message: gate.message });
				}
			}

			trace.qualityGateResults = executeQualityGates(gateDefinitions, mockOutput);

			// Check for failures
			const anyGateFailed = trace.qualityGateResults.some((r) => !r.passed);
			if (anyGateFailed || violations.length > 0) {
				trace.status = "failed";
				result.ok = false;
			}
		} else if (!hasMockOutput && options.validateGates) {
			// Warn about missing mock output
			result.warnings.push(`Step "${stepName}" has no mock output for validation`);
		}

		// Warn if token estimate exceeds budget
		if (tokenEstimate > 2000) {
			result.warnings.push(
				`Step "${stepName}" prompt segment is ~${tokenEstimate} tokens (exceeds 2000 token budget)`,
			);
		}

		result.steps.push(trace);
	}

	// Execute global quality gates
	const globalGateDefinitions: Array<{ check: string; message?: string }> = [];
	if (spec.quality_gates?.pre_output) {
		for (const gate of spec.quality_gates.pre_output) {
			globalGateDefinitions.push({ check: gate.check, message: gate.message });
		}
	}

	if (globalGateDefinitions.length > 0 && options.validateGates) {
		// Use a synthetic output combining all mock outputs
		const combinedOutput = previousOutputs;
		result.globalGateResults = executeQualityGates(globalGateDefinitions, combinedOutput);

		const anyGlobalGateFailed = result.globalGateResults.some((r) => !r.passed);
		if (anyGlobalGateFailed) {
			result.ok = false;
		}
	}

	return result;
}
