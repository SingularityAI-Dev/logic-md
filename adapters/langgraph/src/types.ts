/**
 * Serializable LangGraph state graph definition.
 *
 * This structure represents a compiled LOGIC.md workflow as a directed acyclic graph
 * (DAG) compatible with LangGraph. It is intentionally framework-agnostic and does
 * not depend on the LangGraph runtime—only the data structure.
 *
 * Each node corresponds to a compiled step with:
 * - `systemPromptSegment`: the reasoning instructions for this step
 * - `outputSchema`: JSON Schema for output validation
 * - `metadata`: step name, DAG level, and other execution context
 *
 * Edges represent data flow dependencies between steps.
 */

/**
 * A single node in the state graph, representing a compiled step.
 */
export interface StateGraphNode {
	/** Unique node identifier (maps to step name) */
	name: string;

	/** LLM context injection: system prompt instructions for this step */
	promptSegment: string;

	/** JSON Schema for output validation (null if no schema defined) */
	outputSchema: Record<string, unknown> | null;

	/** Quality gate validators and step metadata */
	metadata: {
		/** Original step name from LOGIC.md */
		stepName: string;

		/** DAG level (0 = entry, higher = later stages) */
		dagLevel: number;

		/** Branch condition taken (null for main flow) */
		branchTaken: string | null;

		/** Attempt number (for retry tracking) */
		attemptNumber: number;

		/** Total steps in the workflow */
		totalSteps: number;

		/** Quality gates for this step (as human-readable descriptions for now) */
		qualityGates?: Array<{
			name: string;
			check: string;
			severity?: "error" | "warning" | "info";
		}>;

		/** Retry policy (for future integration) */
		retryPolicy?: {
			maxAttempts: number;
			initialInterval: string;
			backoffCoefficient: number;
			maximumInterval: string;
			nonRetryableErrors: string[];
		};
	};
}

/**
 * A directed edge between two nodes.
 */
export interface StateGraphEdge {
	/** Source node name */
	from: string;

	/** Target node name */
	to: string;

	/** Optional condition label (for branching, not yet implemented) */
	condition?: string;
}

/**
 * A complete state graph definition derived from a LOGIC.md specification.
 *
 * This is a pure data structure that can be serialized to JSON and consumed
 * by a LangGraph StateGraph builder.
 */
export interface StateGraphDefinition {
	/** Array of nodes (one per step) */
	nodes: StateGraphNode[];

	/** Array of edges (dependencies between steps) */
	edges: StateGraphEdge[];

	/** Name of the entry node (first step to execute) */
	entryPoint: string;

	/** Names of terminal nodes (no outgoing edges) */
	endNodes: string[];

	/** Workflow-level metadata */
	metadata: {
		/** Workflow name from LOGIC.md */
		workflowName: string;

		/** Total number of steps */
		totalSteps: number;

		/** Number of DAG levels */
		totalLevels: number;

		/** Global quality gates (as descriptions) */
		globalQualityGates?: Array<{
			name: string;
			check: string;
			severity?: "error" | "warning" | "info";
		}>;

		/** Fallback strategy (advisory, not enforced at graph level) */
		fallbackStrategy?: string;
	};
}

/**
 * Adapter configuration options.
 */
export interface AdapterOptions {
	/** Include full step metadata in the output (default: true) */
	includeMetadata?: boolean;

	/** Throw on validation errors instead of returning warnings (default: false) */
	strict?: boolean;
}

/**
 * Error thrown by the adapter.
 */
export class AdapterError extends Error {
	override readonly name = "AdapterError";

	constructor(message: string) {
		super(message);
	}
}
