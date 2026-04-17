/**
 * Core conversion logic: LOGIC.md specification → LangGraph state graph definition.
 *
 * This module handles:
 * 1. Parsing and validating the LOGIC.md spec
 * 2. Compiling the spec into executable steps and DAG ordering
 * 3. Mapping steps and dependencies to graph nodes and edges
 * 4. Building a serializable StateGraphDefinition
 *
 * All operations are pure functions with no side effects.
 */

import type { CompiledStep, CompiledWorkflow, LogicSpec, WorkflowContext } from "@logic-md/core";
import { compileWorkflow, parse, resolve, validate } from "@logic-md/core";

import type {
	AdapterOptions,
	StateGraphDefinition,
	StateGraphEdge,
	StateGraphNode,
} from "./types.js";
import { AdapterError } from "./types.js";

/**
 * Convert a LOGIC.md specification string into a LangGraph state graph definition.
 *
 * This is a high-level entry point that handles parsing, validation, compilation,
 * and conversion in one step.
 *
 * @param specContent - Raw LOGIC.md content (YAML frontmatter + markdown)
 * @param options - Adapter options (includeMetadata, strict)
 * @returns StateGraphDefinition ready for LangGraph consumption
 * @throws AdapterError if parsing or compilation fails and strict mode is enabled
 */
export function toStateGraphFromContent(
	specContent: string,
	options?: AdapterOptions,
): StateGraphDefinition {
	// Step 1: Parse the LOGIC.md content
	const parseResult = parse(specContent);
	if (!parseResult.ok) {
		const message = parseResult.errors.map((e) => `Line ${e.line ?? "?"}: ${e.message}`).join("; ");
		if (options?.strict) {
			throw new AdapterError(`Parse failed: ${message}`);
		}
		console.warn(`Parse warning: ${message}`);
	}

	const spec = parseResult.data;

	// Step 2: Validate the parsed spec
	const validateResult = validate(specContent);
	if (!validateResult.ok) {
		const message = validateResult.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
		if (options?.strict) {
			throw new AdapterError(`Validation failed: ${message}`);
		}
		console.warn(`Validation warning: ${message}`);
	}

	// Step 3: Convert validated spec to graph definition
	return toStateGraphFromSpec(spec, options);
}

/**
 * Convert a parsed and validated LOGIC.md spec into a state graph definition.
 *
 * This is the core conversion logic that works with an already-parsed LogicSpec.
 * It handles the compilation and graph mapping.
 *
 * @param spec - A parsed LogicSpec object
 * @param options - Adapter options
 * @returns StateGraphDefinition
 * @throws AdapterError if compilation fails and strict mode is enabled
 */
export function toStateGraphFromSpec(
	spec: LogicSpec,
	options?: AdapterOptions,
): StateGraphDefinition {
	// Step 1: Resolve the DAG (get topological order and levels)
	if (!spec.steps || Object.keys(spec.steps).length === 0) {
		throw new AdapterError(
			"Spec has no steps defined. A LOGIC.md spec must define at least one step.",
		);
	}

	const dagResult = resolve(spec.steps);
	if (!dagResult.ok) {
		const message = dagResult.errors.map((e) => `${e.type}: ${e.message}`).join("; ");
		if (options?.strict) {
			throw new AdapterError(`DAG resolution failed: ${message}`);
		}
		console.warn(`DAG resolution warning: ${message}`);
	}

	const { levels: dagLevels, order: flatOrder } = dagResult;

	// Step 2: Build the workflow context
	// This is required by compileWorkflow but doesn't affect graph structure
	const workflowContext: WorkflowContext = {
		currentStep: flatOrder[0] ?? "unknown",
		previousOutputs: {},
		input: {},
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
		totalSteps: flatOrder.length,
		completedSteps: [],
		dagLevels,
	};

	// Step 3: Compile the workflow
	let compiled: CompiledWorkflow;
	try {
		compiled = compileWorkflow(spec, workflowContext);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (options?.strict) {
			throw new AdapterError(`Compilation failed: ${message}`);
		}
		console.warn(`Compilation warning: ${message}`);
		// Fall back to a minimal compilation
		compiled = {
			steps: [],
			dagLevels,
			globalQualityGates: [],
			fallbackPolicy: null,
			metadata: {
				name: spec.name,
				totalSteps: flatOrder.length,
				totalLevels: dagLevels.length,
			},
		};
	}

	// Step 4: Build the graph definition from compiled workflow and DAG
	return buildGraphDefinition(spec, compiled, dagLevels, flatOrder, options);
}

/**
 * Build a StateGraphDefinition from a compiled workflow and DAG ordering.
 *
 * This function:
 * - Creates graph nodes from compiled steps
 * - Creates edges from DAG dependencies
 * - Identifies entry and end points
 * - Captures metadata
 *
 * @internal
 */
function buildGraphDefinition(
	spec: LogicSpec,
	compiled: CompiledWorkflow,
	dagLevels: string[][],
	flatOrder: string[],
	options?: AdapterOptions,
): StateGraphDefinition {
	// Map step names to compiled steps for easy lookup
	const compiledStepMap = new Map<string, CompiledStep>(
		compiled.steps.map((step) => [step.metadata.stepName, step]),
	);

	// Build nodes from compiled steps
	const nodes: StateGraphNode[] = flatOrder.map((stepName) => {
		const compiledStep = compiledStepMap.get(stepName);
		if (!compiledStep) {
			console.warn(`No compiled step found for ${stepName}`);
			return {
				name: stepName,
				promptSegment: spec.steps?.[stepName]?.instructions ?? "",
				outputSchema: null,
				metadata: {
					stepName,
					dagLevel: findDagLevel(stepName, dagLevels),
					branchTaken: null,
					attemptNumber: 1,
					totalSteps: flatOrder.length,
				},
			};
		}

		// Extract quality gates from spec if available
		const stepSpec = spec.steps?.[stepName];
		const qualityGates = stepSpec?.verification
			? [
					{
						name: "verification",
						check: stepSpec.verification.check,
						severity: "error" as const,
					},
				]
			: [];

		return {
			name: stepName,
			promptSegment: compiledStep.systemPromptSegment,
			outputSchema: (compiledStep.outputSchema as Record<string, unknown>) ?? null,
			metadata: {
				stepName,
				dagLevel: compiledStep.metadata.dagLevel,
				branchTaken: compiledStep.metadata.branchTaken,
				attemptNumber: compiledStep.metadata.attemptNumber,
				totalSteps: compiledStep.metadata.totalSteps,
				qualityGates: options?.includeMetadata !== false ? qualityGates : undefined,
				retryPolicy:
					options?.includeMetadata !== false && compiledStep.retryPolicy
						? compiledStep.retryPolicy
						: undefined,
			},
		};
	});

	// Build edges from DAG dependencies
	const edges: StateGraphEdge[] = [];
	const stepDependencies = new Map<string, Set<string>>();

	// First pass: collect all dependencies
	if (spec.steps) {
		for (const [stepName, step] of Object.entries(spec.steps)) {
			if (step.needs && step.needs.length > 0) {
				stepDependencies.set(stepName, new Set(step.needs));
			}
		}
	}

	// Second pass: create edges from collected dependencies
	for (const [stepName, deps] of stepDependencies.entries()) {
		for (const dep of deps) {
			edges.push({
				from: dep,
				to: stepName,
			});
		}
	}

	// Identify entry and end nodes
	const entryPoint = flatOrder[0] ?? "unknown";
	const nodeNames = new Set(flatOrder);
	const hasOutgoing = new Set(edges.map((e) => e.from));
	const endNodes = Array.from(nodeNames).filter((n) => !hasOutgoing.has(n));

	// Build global quality gates metadata
	const globalQualityGates = spec.quality_gates?.pre_output
		? spec.quality_gates.pre_output.map((gate) => ({
				name: gate.name,
				check: gate.check,
				severity: gate.severity ?? ("info" as const),
			}))
		: [];

	return {
		nodes,
		edges,
		entryPoint,
		endNodes,
		metadata: {
			workflowName: spec.name,
			totalSteps: flatOrder.length,
			totalLevels: dagLevels.length,
			globalQualityGates: options?.includeMetadata !== false ? globalQualityGates : undefined,
			fallbackStrategy: spec.fallback?.strategy,
		},
	};
}

/**
 * Find the DAG level of a given step.
 *
 * @internal
 */
function findDagLevel(stepName: string, dagLevels: string[][]): number {
	for (let i = 0; i < dagLevels.length; i++) {
		if (dagLevels[i]!.includes(stepName)) {
			return i;
		}
	}
	return -1; // Not found
}
