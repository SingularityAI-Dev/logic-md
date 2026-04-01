# Phase 6: DAG Resolver - Research

**Researched:** 2026-03-31
**Domain:** Graph algorithms (topological sort, cycle detection, reachability, parallel grouping)
**Confidence:** HIGH

## Summary

Phase 6 implements a DAG (Directed Acyclic Graph) resolver that takes `Record<string, Step>` from a parsed LogicSpec and produces a topologically sorted execution order. The Step type already has an optional `needs: string[]` field defining dependencies. Steps with no `needs` are roots.

This is pure graph theory with zero external dependencies. The algorithms are well-established (Kahn's algorithm for topological sort, DFS with coloring for cycle detection, BFS for depth/level assignment). The entire implementation belongs in a single file `packages/core/dag.ts` with accompanying `dag.test.ts`.

**Primary recommendation:** Use Kahn's algorithm (BFS-based topological sort) as the primary algorithm -- it naturally provides cycle detection (remaining nodes after sort = cycle members), depth-level grouping (track depth during BFS), and is simpler to implement correctly than DFS-based alternatives when parallel grouping is also needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAG-01 | Topologically sort steps based on `needs` dependencies | Kahn's algorithm produces a valid topological order; depth tracking groups by level |
| DAG-02 | Detect and report cycles with clear error messages | After Kahn's completes, remaining unvisited nodes form cycles; DFS trace extracts the cycle path |
| DAG-03 | Identify unreachable steps (no path from any root) | Forward BFS from roots; steps not visited are unreachable |
| DAG-04 | Resolve parallel execution groups (independent steps at same depth) | Depth assignment during Kahn's BFS naturally groups same-depth independent steps |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none) | -- | Pure TypeScript, no dependencies | Graph algorithms are fundamental CS; adding a library would be over-engineering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (existing) | Unit testing | All test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Kahn's | graphlib / graphology | Over-engineering for 4 requirements; adds dependency weight for trivial graph ops |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/
  dag.ts          # DAG resolver implementation
  dag.test.ts     # Tests for DAG resolver
  index.ts        # Add dag exports to barrel
  types.ts        # Step type already has `needs` field
```

### Pattern 1: Result Type (Discriminated Union)
**What:** The project uses `{ ok: true, data } | { ok: false, errors }` for all operations that can fail.
**When to use:** The `resolve()` function should follow this same pattern.
**Example:**
```typescript
// Matches existing project patterns (parser, validator)
export interface DagResolveSuccess {
  ok: true;
  /** Steps grouped by execution depth (parallel within each group) */
  levels: string[][];
  /** Flat topological order */
  order: string[];
}

export interface DagResolveFailure {
  ok: false;
  errors: DagError[];
}

export type DagResult = DagResolveSuccess | DagResolveFailure;
```

### Pattern 2: Kahn's Algorithm with Depth Tracking
**What:** BFS-based topological sort where each node tracks its depth (max depth of predecessors + 1). Roots start at depth 0.
**When to use:** This is the core algorithm for DAG-01 and DAG-04.
**Example:**
```typescript
export function resolve(steps: Record<string, Step>): DagResult {
  // 1. Build adjacency list + in-degree map
  // 2. Enqueue all roots (in-degree 0, no `needs`)
  // 3. BFS: dequeue, assign depth, decrement neighbors' in-degree
  // 4. After BFS: remaining nodes = cycle members
  // 5. Check reachability from roots via forward BFS
  // 6. Group by depth for parallel levels
}
```

### Pattern 3: Cycle Path Extraction via DFS
**What:** After Kahn's identifies cycle members, run DFS on the subgraph of remaining nodes to extract the actual cycle path for error reporting.
**When to use:** DAG-02 requires reporting the cycle path (e.g., "A -> B -> C -> A").
**Example:**
```typescript
// DFS with gray/black coloring on cycle-member subgraph
// When a gray node is revisited, backtrack to build cycle path string
```

### Pattern 4: Custom Error Class
**What:** Follows the project's `ExpressionError` pattern -- a custom error class with structured data.
**When to use:** Error reporting for cycles and unreachable steps.
**Example:**
```typescript
export interface DagError {
  type: "cycle" | "unreachable" | "missing_dependency";
  message: string;
  nodes: string[];  // affected step names
}
```

### Anti-Patterns to Avoid
- **Recursive DFS for topological sort:** Harder to extract depth levels; Kahn's gives depth for free.
- **Throwing errors instead of returning them:** Project pattern is discriminated union results, not exceptions.
- **Mutating the input `steps` object:** Always work on derived data structures (adjacency list, in-degree map).
- **Ignoring missing dependencies:** If step A needs step "X" and "X" doesn't exist in the steps map, this should be reported as an error (missing_dependency).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N/A | -- | -- | This IS the hand-rolled module; the algorithms are simple enough that a library would be over-engineering |

**Key insight:** This is one of the rare cases where hand-rolling IS the right approach. The total implementation is ~100-150 lines. A graph library would add more code in the dependency than the solution itself.

## Common Pitfalls

### Pitfall 1: Self-Referencing Steps
**What goes wrong:** A step lists itself in its own `needs` array (e.g., `needs: ["self"]`).
**Why it happens:** User error in LOGIC.md authoring.
**How to avoid:** Check for self-references before running topological sort; report as a cycle of length 1.
**Warning signs:** Cycle detection finds single-node cycles.

### Pitfall 2: Missing Dependency References
**What goes wrong:** A step's `needs` references a step name that doesn't exist in the steps map.
**Why it happens:** Typo in LOGIC.md or incomplete step definitions.
**How to avoid:** Validate all `needs` references exist before running the sort. Report missing deps as separate error type.
**Warning signs:** Undefined entries in adjacency list.

### Pitfall 3: Confusing "Unreachable" with "Cycle Member"
**What goes wrong:** A step in a cycle is reported as both "in a cycle" and "unreachable from root."
**Why it happens:** Cycle members are indeed unreachable from roots, but the root cause is the cycle.
**How to avoid:** Report cycle errors first. Only report unreachable for non-cycle nodes that have no path from a root.
**Warning signs:** Duplicate error reporting for the same step.

### Pitfall 4: Non-Deterministic Order
**What goes wrong:** Same input produces different topological orders on different runs.
**Why it happens:** Using Sets or Maps without sorting when iterating.
**How to avoid:** Sort step names alphabetically when building the initial queue and when iterating adjacency lists. This ensures deterministic output for testing.
**Warning signs:** Flaky tests that pass sometimes.

### Pitfall 5: Empty Steps Map
**What goes wrong:** Crash when `steps` is undefined or empty.
**Why it happens:** LogicSpec.steps is optional.
**How to avoid:** Handle empty/undefined input gracefully -- return success with empty levels and order.

## Code Examples

### Core resolve() Function Skeleton
```typescript
import type { Step } from "./types.js";

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

export function resolve(steps: Record<string, Step>): DagResult {
  const names = Object.keys(steps).sort(); // deterministic order
  if (names.length === 0) return { ok: true, levels: [], order: [] };

  const errors: DagError[] = [];

  // 1. Validate references and build adjacency
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // step -> steps that depend on it
  
  for (const name of names) {
    inDegree.set(name, 0);
    dependents.set(name, []);
  }

  for (const name of names) {
    const needs = steps[name].needs ?? [];
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

  const sorted: string[] = [];

  while (queue.length > 0) {
    queue.sort(); // deterministic within each iteration
    const current = queue.shift()!;
    sorted.push(current);
    const d = depth.get(current)!;

    for (const dep of dependents.get(current)!.sort()) {
      const newDeg = inDegree.get(dep)! - 1;
      inDegree.set(dep, newDeg);
      depth.set(dep, Math.max(depth.get(dep) ?? 0, d + 1));
      if (newDeg === 0) queue.push(dep);
    }
  }

  // 3. Cycle detection (remaining nodes)
  if (sorted.length < names.length) {
    const cycleMembers = names.filter((n) => !sorted.includes(n));
    // Extract cycle path via DFS on remaining subgraph
    errors.push({
      type: "cycle",
      message: `Circular dependency detected: ${extractCyclePath(cycleMembers, steps)}`,
      nodes: cycleMembers,
    });
  }

  // 4. Unreachable detection (forward reachability from roots)
  const roots = names.filter((n) => !steps[n].needs?.length);
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
  const unreachable = sorted.filter((n) => !reachable.has(n));
  if (unreachable.length > 0) {
    errors.push({
      type: "unreachable",
      message: `Steps unreachable from any root: ${unreachable.join(", ")}`,
      nodes: unreachable,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  // 5. Group by depth level
  const maxDepth = Math.max(...sorted.map((n) => depth.get(n)!), -1);
  const levels: string[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    levels.push(sorted.filter((n) => depth.get(n) === d).sort());
  }

  return { ok: true, levels, order: sorted };
}
```

### Cycle Path Extraction
```typescript
function extractCyclePath(
  cycleMembers: string[],
  steps: Record<string, Step>
): string {
  // DFS with gray/black coloring to find actual cycle
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
    for (const dep of steps[node].needs ?? []) {
      if (memberSet.has(dep) && dfs(dep, path)) return true;
    }
    gray.delete(node);
    black.add(node);
    path.pop();
    return false;
  }

  for (const member of cycleMembers.sort()) {
    if (!black.has(member) && dfs(member, [])) break;
  }

  return cyclePath.join(" -> ");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DFS-based topological sort | Kahn's (BFS) with depth tracking | N/A -- both are standard | Kahn's naturally gives parallel levels |
| Single error reporting | Multi-error collection | Project convention | All errors reported in one pass |

**Deprecated/outdated:**
- None -- graph algorithms are stable computer science fundamentals.

## Open Questions

1. **Should unreachable steps be a warning or error?**
   - What we know: Requirements say "identify" unreachable steps, not "reject"
   - What's unclear: Whether the resolver should still succeed with unreachable steps present
   - Recommendation: Treat as error (fail the result). If the user wants to ignore them, they can remove the steps. This is safer for a spec parser. The planner can decide to make this configurable later if needed.

2. **Should the resolver validate `needs` references against the steps map?**
   - What we know: A step could reference a non-existent step name in `needs`
   - What's unclear: Whether schema validation (Phase 4) already catches this
   - Recommendation: Yes, validate here. Schema validation checks structure, not cross-references. The DAG resolver is the natural place to validate step name references.

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/core/types.ts` -- Step type with `needs: string[]`
- Project codebase: `packages/core/expression.ts` -- Error class and module patterns
- Project codebase: `packages/core/index.ts` -- Barrel export conventions

### Secondary (MEDIUM confidence)
- Standard CS algorithms: Kahn's algorithm (1962), DFS-based cycle detection -- well-established textbook algorithms

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no dependencies, pure TypeScript
- Architecture: HIGH -- follows established project patterns exactly (discriminated unions, flat files, barrel exports)
- Pitfalls: HIGH -- graph algorithm edge cases are well-documented in CS literature
- Code examples: HIGH -- algorithms are deterministic and well-understood

**Research date:** 2026-03-31
**Valid until:** Indefinite -- graph algorithms don't change; project patterns are established
