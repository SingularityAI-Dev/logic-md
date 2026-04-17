/**
 * @logic-md/langgraph-adapter
 *
 * Experimental proof-of-concept adapter: compile LOGIC.md specs into
 * LangGraph StateGraph definitions.
 *
 * STATUS: EXPERIMENTAL (4-6 week project)
 *
 * Limitations:
 * - No branch support yet
 * - Quality gates are advisory only
 * - No retry loop integration
 * - Parallel execution treated as sequential
 */

// Main API: aliased for convenience
export {
	toStateGraphFromContent,
	toStateGraphFromContent as toStateGraph,
	toStateGraphFromSpec,
} from "./adapter.js";
export type {
	AdapterOptions,
	StateGraphDefinition,
	StateGraphEdge,
	StateGraphNode,
} from "./types.js";
export { AdapterError } from "./types.js";
