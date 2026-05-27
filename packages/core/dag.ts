import type { Step } from "./types.js";

// =============================================================================
// Types
// =============================================================================

export interface DagError {
	type: "cycle" | "unreachable" | "missing_dependency";
	message: string;
	nodes: string[];
}

export interface DagSuccess {
	ok: true;
	/** Steps grouped by depth level (each group can run in parallel) */
	levels: string[][];
	/** Flat topological order (concatenation of levels) */
	order: string[];
}

export interface DagFailure {
	ok: false;
	errors: DagError[];
}

export type DagResult = DagSuccess | DagFailure;

// =============================================================================
// Cycle Path Extraction (DFS with gray/black coloring)
// =============================================================================

function extractCyclePath(cycleMembers: string[], steps: Record<string, Step>): string {
	const memberSet = new Set(cycleMembers);
	const gray = new Set<string>();
	const black = new Set<string>();
	let cyclePath: string[] = [];

	function dfs(node: string, path: string[]): boolean {
		if (gray.has(node)) {
			const cycleStart = path.indexOf(node);
			cyclePath = [...path.slice(cycleStart), node];
			return true;
		}
		if (black.has(node)) return false;
		gray.add(node);
		path.push(node);
		for (const dep of (steps[node]?.needs ?? []).slice().sort()) {
			if (memberSet.has(dep) && dfs(dep, path)) return true;
		}
		gray.delete(node);
		black.add(node);
		path.pop();
		return false;
	}

	for (const member of [...cycleMembers].sort()) {
		if (!black.has(member) && dfs(member, [])) break;
	}

	return cyclePath.join(" -> ");
}

// =============================================================================
// DAG Resolver
// =============================================================================

export function resolve(steps: Record<string, Step>): DagResult {
	const names = Object.keys(steps).sort();
	if (names.length === 0) return { ok: true, levels: [], order: [] };

	const errors: DagError[] = [];

	// 1. Validate references, build adjacency
	const inDegree = new Map<string, number>();
	const dependents = new Map<string, string[]>();

	for (const name of names) {
		inDegree.set(name, 0);
		dependents.set(name, []);
	}

	for (const name of names) {
		const needs = steps[name]?.needs ?? [];
		for (const dep of needs) {
			if (dep === name) {
				errors.push({
					type: "cycle",
					message: `Step "${name}" depends on itself`,
					nodes: [name],
				});
				continue;
			}
			if (!inDegree.has(dep)) {
				errors.push({
					type: "missing_dependency",
					message: `Step "${name}" depends on "${dep}" which does not exist`,
					nodes: [name, dep],
				});
				continue;
			}
			inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
			dependents.get(dep)!.push(name);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	// 2. Kahn's algorithm with depth tracking
	const depth = new Map<string, number>();
	const queue: string[] = [];

	for (const name of names) {
		if (inDegree.get(name) === 0) {
			queue.push(name);
			depth.set(name, 0);
		}
	}

	// The initial queue is seeded from `names` (already sorted) in step above, so
	// it starts in alphabetical order. Walk it with a FIFO index pointer instead
	// of re-sorting on every pop. The output (levels and order) is derived from
	// the depth map and the per-level alphabetical sort below, both independent
	// of dequeue order, so this yields byte-identical output (issue #46,
	// Candidate 3). depth is the longest path from a root and is order-invariant:
	// a node is dequeued only after every predecessor has been processed, so its
	// depth is final when read.
	const sorted: string[] = [];
	let head = 0;
	while (head < queue.length) {
		const current = queue[head++]!;
		sorted.push(current);
		const d = depth.get(current)!;

		for (const dep of dependents.get(current)!) {
			const newDeg = inDegree.get(dep)! - 1;
			inDegree.set(dep, newDeg);
			depth.set(dep, Math.max(depth.get(dep) ?? 0, d + 1));
			if (newDeg === 0) queue.push(dep);
		}
	}

	// 3. Cycle detection (remaining nodes after Kahn's)
	if (sorted.length < names.length) {
		const sortedSet = new Set(sorted);
		const cycleMembers = names.filter((n) => !sortedSet.has(n));
		errors.push({
			type: "cycle",
			message: `Circular dependency detected: ${extractCyclePath(cycleMembers, steps)}`,
			nodes: cycleMembers,
		});
	}

	// 4. Unreachable detection (forward BFS from roots)
	const roots = names.filter((n) => !steps[n]?.needs?.length);
	const reachable = new Set<string>();
	const reachQueue = [...roots];
	while (reachQueue.length > 0) {
		const current = reachQueue.shift()!;
		if (reachable.has(current)) continue;
		reachable.add(current);
		for (const dep of dependents.get(current) ?? []) {
			reachQueue.push(dep);
		}
	}

	const sortedSet = new Set(sorted);
	const unreachable = sorted.filter((n) => !reachable.has(n) && sortedSet.has(n));
	if (unreachable.length > 0) {
		errors.push({
			type: "unreachable",
			message: `Steps unreachable from any root: ${unreachable.join(", ")}`,
			nodes: unreachable,
		});
	}

	if (errors.length > 0) return { ok: false, errors };

	// 5. Group by depth level. Iterating the pre-sorted `names` drops each node
	// into its depth bucket in alphabetical order, reproducing the per-level sort
	// in a single O(V) pass instead of an O(V*D) filter-and-sort per level.
	const maxDepth = Math.max(...names.map((n) => depth.get(n)!), -1);
	const levels: string[][] = [];
	for (let d = 0; d <= maxDepth; d++) {
		levels.push([]);
	}
	for (const name of names) {
		levels[depth.get(name)!]!.push(name);
	}

	return { ok: true, levels, order: levels.flat() };
}
