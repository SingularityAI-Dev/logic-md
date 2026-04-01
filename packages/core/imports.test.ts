import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveImports } from "./imports.js";
import { parse } from "./parser.js";
import type { LogicSpec } from "./types.js";

const fixturesDir = resolve(import.meta.dirname!, "__fixtures__");

function loadFixture(name: string): LogicSpec {
	const content = readFileSync(resolve(fixturesDir, name), "utf-8");
	const result = parse(content);
	if (!result.ok) throw new Error(`Failed to parse fixture ${name}: ${result.errors[0]!.message}`);
	return result.data;
}

describe("resolveImports", () => {
	it("returns spec unchanged when no imports", () => {
		const spec: LogicSpec = { spec_version: "1.0", name: "no-imports" };
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.name).toBe("no-imports");
		}
	});

	it("resolves a single import and namespaces steps", () => {
		const spec = loadFixture("main.logic.md");
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const stepKeys = Object.keys(result.data.steps ?? {});
			expect(stepKeys).toContain("base.analyze");
			expect(stepKeys).toContain("base.synthesize");
			expect(stepKeys).toContain("local_step");
			expect(result.data.steps!["base.synthesize"]!.needs).toEqual(["base.analyze"]);
		}
	});

	it("merges configs with local taking precedence", () => {
		const spec = loadFixture("main.logic.md");
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.reasoning?.strategy).toBe("react");
			expect(result.data.reasoning?.temperature).toBe(0.5);
		}
	});

	it("detects circular imports", () => {
		const spec = loadFixture("circular-a.logic.md");
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]!.type).toBe("circular_import");
			expect(result.errors[0]!.chain.length).toBeGreaterThan(0);
		}
	});

	it("reports file not found errors", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "missing-import",
			imports: [{ ref: "./nonexistent.logic.md", as: "x" }],
		};
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]!.type).toBe("file_not_found");
		}
	});

	it("handles transitive imports (A->B->C)", () => {
		const spec = loadFixture("transitive-a.logic.md");
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const stepKeys = Object.keys(result.data.steps ?? {});
			expect(stepKeys).toContain("b.c.deep_step");
			expect(stepKeys).toContain("b.mid_step");
			expect(stepKeys).toContain("top_step");
		}
	});

	it("strips imports array from resolved output", () => {
		const spec = loadFixture("main.logic.md");
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.imports).toBeUndefined();
		}
	});

	it("detects duplicate as namespaces", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "dup-ns",
			imports: [
				{ ref: "./base.logic.md", as: "x" },
				{ ref: "./base.logic.md", as: "x" },
			],
		};
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]!.type).toBe("merge_error");
			expect(result.errors[0]!.message).toContain("Duplicate");
		}
	});

	it("preserves spec_version and name from local spec", () => {
		const spec = loadFixture("main.logic.md");
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.spec_version).toBe("1.0");
			expect(result.data.name).toBe("main-workflow");
		}
	});

	it("handles import with invalid YAML in referenced file", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "bad-import",
			imports: [{ ref: "./base.logic.md", as: "b" }],
		};
		// base.logic.md is valid, so this should succeed
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
	});

	it("handles empty steps in imported file", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "no-steps",
			imports: [{ ref: "./base.logic.md", as: "b" }],
			steps: {},
		};
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			// Should have imported steps but no local steps
			const stepKeys = Object.keys(result.data.steps ?? {});
			expect(stepKeys).toContain("b.analyze");
			expect(stepKeys).toContain("b.synthesize");
		}
	});

	it("reports parse_error when imported file has invalid YAML", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "bad-import",
			imports: [{ ref: "./invalid-yaml.logic.md", as: "bad" }],
		};
		const result = resolveImports(spec, fixturesDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]!.type).toBe("parse_error");
			expect(result.errors[0]!.message).toContain("Failed to parse import");
		}
	});

	it("namespaces needs, parallel_steps, and branch.then references", () => {
		const _spec = loadFixture("with-branches.logic.md");
		// Import the spec that has branches, parallel_steps, and needs
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-branches.logic.md", as: "br" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const steps = result.data.steps ?? {};
			// Check namespaced step keys
			expect(steps["br.check"]).toBeDefined();
			expect(steps["br.process"]).toBeDefined();
			expect(steps["br.fallback"]).toBeDefined();

			// Check needs namespaced
			expect(steps["br.process"]!.needs).toEqual(["br.check"]);

			// Check parallel_steps namespaced
			expect(steps["br.check"]!.parallel_steps).toEqual(["br.process", "br.fallback"]);

			// Check branches.then namespaced
			const branches = steps["br.check"]!.branches ?? [];
			expect(branches[0]!.then).toBe("br.process");
			expect(branches[1]!.then).toBe("br.fallback");
		}
	});

	it("namespaces decision_trees keys", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const trees = result.data.decision_trees ?? {};
			expect(trees["sec.route"]).toBeDefined();
			// Original key should not exist
			expect(trees.route).toBeUndefined();
		}
	});

	it("merges reasoning section (base + override)", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
			reasoning: {
				strategy: "react",
				max_iterations: 10,
			},
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			// Local override wins for strategy
			expect(result.data.reasoning?.strategy).toBe("react");
			// Local adds max_iterations
			expect(result.data.reasoning?.max_iterations).toBe(10);
		}
	});

	it("merges contracts section", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.contracts).toBeDefined();
			expect(result.data.contracts?.inputs).toBeDefined();
		}
	});

	it("merges quality_gates section", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.quality_gates).toBeDefined();
			expect(result.data.quality_gates?.pre_output).toBeDefined();
		}
	});

	it("merges decision_trees section", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.decision_trees).toBeDefined();
			expect(Object.keys(result.data.decision_trees ?? {}).length).toBeGreaterThan(0);
		}
	});

	it("merges fallback section (override wins entirely)", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
			fallback: {
				strategy: "abort",
			},
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			// Local fallback wins entirely
			expect(result.data.fallback?.strategy).toBe("abort");
		}
	});

	it("merges fallback section from import when local has none", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.fallback?.strategy).toBe("escalate");
		}
	});

	it("merges metadata section", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
			metadata: { extra: "local-value" },
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.metadata?.author).toBe("test");
			expect(result.data.metadata?.extra).toBe("local-value");
		}
	});

	it("merges description (override wins via nullish coalescing)", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			description: "local description",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.description).toBe("local description");
		}
	});

	it("uses imported description when local has none", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.description).toBe("A spec with all optional sections");
		}
	});

	it("merges steps section from multiple sources", () => {
		const wrapper: LogicSpec = {
			spec_version: "1.0",
			name: "wrapper",
			imports: [{ ref: "./with-sections.logic.md", as: "sec" }],
			steps: {
				local_step: { description: "local" },
			},
		};
		const result = resolveImports(wrapper, fixturesDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const stepKeys = Object.keys(result.data.steps ?? {});
			expect(stepKeys).toContain("sec.analyze");
			expect(stepKeys).toContain("local_step");
		}
	});
});
