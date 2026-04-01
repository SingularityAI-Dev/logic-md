import { describe, expect, it } from "vitest";
import { resolve } from "./dag.js";
import type { Step } from "./types.js";

// =============================================================================
// Helper
// =============================================================================

function steps(map: Record<string, string[]>): Record<string, Step> {
	const result: Record<string, Step> = {};
	for (const [name, needs] of Object.entries(map)) {
		result[name] = needs.length > 0 ? { needs } : {};
	}
	return result;
}

// =============================================================================
// Empty / Trivial Inputs (DAG-01 baseline)
// =============================================================================

describe("empty and trivial inputs", () => {
	it("returns success with empty levels and order for empty input", () => {
		const result = resolve({});
		expect(result).toEqual({ ok: true, levels: [], order: [] });
	});

	it("returns single level for single step with no needs", () => {
		const result = resolve(steps({ only: [] }));
		expect(result).toEqual({
			ok: true,
			levels: [["only"]],
			order: ["only"],
		});
	});
});

// =============================================================================
// Linear Chain (DAG-01)
// =============================================================================

describe("linear chain", () => {
	it("sorts a three-step linear chain", () => {
		const result = resolve(steps({ C: ["B"], B: ["A"], A: [] }));
		expect(result).toEqual({
			ok: true,
			levels: [["A"], ["B"], ["C"]],
			order: ["A", "B", "C"],
		});
	});
});

// =============================================================================
// Diamond Dependency (DAG-01 + DAG-04)
// =============================================================================

describe("diamond dependency", () => {
	it("groups independent steps in the same level", () => {
		const result = resolve(steps({ A: [], B: ["A"], C: ["A"], D: ["B", "C"] }));
		expect(result).toEqual({
			ok: true,
			levels: [["A"], ["B", "C"], ["D"]],
			order: ["A", "B", "C", "D"],
		});
	});
});

// =============================================================================
// Parallel Roots (DAG-04)
// =============================================================================

describe("parallel roots", () => {
	it("groups independent roots in the same level", () => {
		const result = resolve(steps({ X: [], Y: [], Z: ["X", "Y"] }));
		expect(result).toEqual({
			ok: true,
			levels: [["X", "Y"], ["Z"]],
			order: ["X", "Y", "Z"],
		});
	});
});

// =============================================================================
// Cycle Detection (DAG-02)
// =============================================================================

describe("cycle detection", () => {
	it("detects a simple two-node cycle", () => {
		const result = resolve(steps({ A: ["B"], B: ["A"] }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThanOrEqual(1);
			const cycleError = result.errors.find((e) => e.type === "cycle");
			expect(cycleError).toBeDefined();
			expect(cycleError!.nodes).toContain("A");
			expect(cycleError!.nodes).toContain("B");
			expect(cycleError!.message).toMatch(/->/);
		}
	});

	it("detects a three-node cycle", () => {
		const result = resolve(steps({ A: ["C"], B: ["A"], C: ["B"] }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const cycleError = result.errors.find((e) => e.type === "cycle");
			expect(cycleError).toBeDefined();
			expect(cycleError!.nodes).toContain("A");
			expect(cycleError!.nodes).toContain("B");
			expect(cycleError!.nodes).toContain("C");
			expect(cycleError!.message).toMatch(/->/);
		}
	});
});

// =============================================================================
// Self-Reference (DAG-02)
// =============================================================================

describe("self-reference", () => {
	it("detects a step that depends on itself", () => {
		const result = resolve(steps({ X: ["X"] }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const cycleError = result.errors.find((e) => e.type === "cycle");
			expect(cycleError).toBeDefined();
			expect(cycleError!.nodes).toContain("X");
		}
	});
});

// =============================================================================
// Missing Dependency (DAG-02 related)
// =============================================================================

describe("missing dependency", () => {
	it("reports a missing dependency", () => {
		const result = resolve(steps({ A: ["nonexistent"] }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const missingError = result.errors.find((e) => e.type === "missing_dependency");
			expect(missingError).toBeDefined();
			expect(missingError!.nodes).toContain("A");
			expect(missingError!.nodes).toContain("nonexistent");
		}
	});
});

// =============================================================================
// Cycle Members Not Reported as Unreachable (DAG-03)
// =============================================================================

describe("unreachable vs cycle", () => {
	it("reports cycle members as cycle errors, not unreachable", () => {
		// A is a root, B and C form a cycle
		const result = resolve(steps({ A: [], B: ["C"], C: ["B"] }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const cycleError = result.errors.find((e) => e.type === "cycle");
			expect(cycleError).toBeDefined();
			expect(cycleError!.nodes).toContain("B");
			expect(cycleError!.nodes).toContain("C");
			// B and C should NOT be reported as unreachable
			const unreachableError = result.errors.find((e) => e.type === "unreachable");
			expect(unreachableError).toBeUndefined();
		}
	});
});

// =============================================================================
// Deterministic Output (cross-cutting)
// =============================================================================

describe("deterministic output", () => {
	it("sorts steps alphabetically within levels regardless of insertion order", () => {
		// Insert in reverse alphabetical order
		const input: Record<string, Step> = {
			Z: {},
			M: {},
			A: {},
			D: { needs: ["Z", "A"] },
		};
		const result = resolve(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.levels[0]).toEqual(["A", "M", "Z"]);
			expect(result.levels[1]).toEqual(["D"]);
			expect(result.order).toEqual(["A", "M", "Z", "D"]);
		}
	});

	it("produces the same result on repeated calls", () => {
		const input = steps({ C: ["A"], B: ["A"], A: [], D: ["B", "C"] });
		const r1 = resolve(input);
		const r2 = resolve(input);
		expect(r1).toEqual(r2);
	});
});
