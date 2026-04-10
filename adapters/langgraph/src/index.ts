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

export type { StateGraphDefinition, StateGraphNode, StateGraphEdge, AdapterOptions } from "./types.js";
export { AdapterError } from "./types.js";

export { toStateGraphFromContent, toStateGraphFromSpec } from "./adapter.js";

// Main API: aliased for convenience
export { toStateGraphFromContent as toStateGraph } from "./adapter.js";
