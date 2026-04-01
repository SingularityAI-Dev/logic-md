import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LogicSpec, Step } from "./index.js";
import {
	type ExpressionContext,
	ExpressionError,
	evaluate,
	parse,
	resolve,
	resolveImports,
	validate,
} from "./index.js";

// =============================================================================
// Integration Tests: Full Pipeline
// =============================================================================
// Proves the modules compose correctly as a pipeline:
// parse -> validate -> resolve DAG -> resolve imports -> evaluate expressions
// =============================================================================

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
	tmpDir = join(tmpdir(), `logic-md-integration-${Date.now()}`);
	mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

// -----------------------------------------------------------------------------
// Happy Path Tests
// -----------------------------------------------------------------------------

describe("full pipeline: valid spec", () => {
	const validSpec = `---
spec_version: "1.0"
name: "code-review-agent"
description: "An agent that performs structured code review"
reasoning:
  strategy: cot
  max_iterations: 5
  temperature: 0.3
steps:
  gather_context:
    description: "Collect code context and diff information"
    instructions: "Read the code changes and gather relevant context"
  analyze_patterns:
    description: "Identify code patterns and potential issues"
    needs: [gather_context]
    instructions: "Look for anti-patterns, bugs, and style issues"
  check_security:
    description: "Scan for security vulnerabilities"
    needs: [gather_context]
    instructions: "Check for common security issues"
  synthesize_review:
    description: "Combine findings into a structured review"
    needs: [analyze_patterns, check_security]
    instructions: "Merge findings and prioritize issues"
    verification:
      check: "{{ results.issues_found >= 0 }}"
      on_fail: retry
quality_gates:
  pre_output:
    - name: "confidence_check"
      check: "{{ confidence >= 0.7 }}"
      severity: error
      on_fail: revise
---

# Code Review Agent

This agent performs thorough code reviews.
`;

	it("parses a real LOGIC.md through the full pipeline", () => {
		// Step 1: Parse
		const parseResult = parse(validSpec);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		expect(parseResult.data.name).toBe("code-review-agent");
		expect(parseResult.data.reasoning?.strategy).toBe("cot");
		expect(parseResult.content).toContain("# Code Review Agent");

		// Step 2: Validate
		const validateResult = validate(validSpec);
		expect(validateResult.ok).toBe(true);
		if (!validateResult.ok) return;

		expect(validateResult.data.spec_version).toBe("1.0");
		expect(validateResult.data.steps).toBeDefined();

		// Step 3: Resolve DAG
		const steps = validateResult.data.steps as Record<string, Step>;
		const dagResult = resolve(steps);
		expect(dagResult.ok).toBe(true);
		if (!dagResult.ok) return;

		// gather_context has no deps -> level 0
		// analyze_patterns and check_security depend on gather_context -> level 1
		// synthesize_review depends on both -> level 2
		expect(dagResult.levels).toHaveLength(3);
		expect(dagResult.levels[0]).toEqual(["gather_context"]);
		expect(dagResult.levels[1]).toEqual(
			expect.arrayContaining(["analyze_patterns", "check_security"]),
		);
		expect(dagResult.levels[2]).toEqual(["synthesize_review"]);
		expect(dagResult.order).toHaveLength(4);

		// Step 4: Evaluate gate expressions
		const gate = validateResult.data.quality_gates?.pre_output?.[0];
		expect(gate).toBeDefined();
		if (!gate) return;

		const passingCtx: ExpressionContext = { confidence: 0.9 };
		expect(evaluate(gate.check, passingCtx)).toBe(true);

		const failingCtx: ExpressionContext = { confidence: 0.5 };
		expect(evaluate(gate.check, failingCtx)).toBe(false);
	});
});

describe("full pipeline: multi-step DAG", () => {
	it("resolves parallel and sequential steps correctly", () => {
		const multiStepSpec = `---
spec_version: "1.0"
name: "multi-step-pipeline"
steps:
  fetch_data:
    description: "Fetch raw data"
  clean_data:
    description: "Clean and normalize"
    needs: [fetch_data]
  extract_features:
    description: "Extract features from cleaned data"
    needs: [fetch_data]
  train_model:
    description: "Train on features"
    needs: [clean_data, extract_features]
  evaluate_model:
    description: "Evaluate model performance"
    needs: [train_model]
---
`;

		const parseResult = parse(multiStepSpec);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		const validateResult = validate(multiStepSpec);
		expect(validateResult.ok).toBe(true);
		if (!validateResult.ok) return;

		const steps = validateResult.data.steps as Record<string, Step>;
		const dagResult = resolve(steps);
		expect(dagResult.ok).toBe(true);
		if (!dagResult.ok) return;

		// Level 0: fetch_data (no deps)
		// Level 1: clean_data, extract_features (both depend on fetch_data, parallel)
		// Level 2: train_model (depends on both level 1 steps)
		// Level 3: evaluate_model (depends on train_model)
		expect(dagResult.levels).toHaveLength(4);
		expect(dagResult.levels[0]).toEqual(["fetch_data"]);
		expect(dagResult.levels[1]).toEqual(expect.arrayContaining(["clean_data", "extract_features"]));
		expect(dagResult.levels[1]).toHaveLength(2);
		expect(dagResult.levels[2]).toEqual(["train_model"]);
		expect(dagResult.levels[3]).toEqual(["evaluate_model"]);
		expect(dagResult.order).toHaveLength(5);
	});
});

// -----------------------------------------------------------------------------
// Error Path Tests
// -----------------------------------------------------------------------------

describe("pipeline error: malformed YAML", () => {
	it("returns parse error for broken YAML", () => {
		const malformedYaml = `---
spec_version: "1.0
name: "broken
  bad_indent: this is wrong
---
`;

		const result = parse(malformedYaml);
		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]!.message).toBeTruthy();
	});

	it("returns parse error for missing frontmatter delimiters", () => {
		const noFrontmatter = "Just some plain markdown content.";

		const result = parse(noFrontmatter);
		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.errors[0]!.message).toContain("No YAML frontmatter found");
	});

	it("returns parse error for empty input", () => {
		const result = parse("");
		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.errors[0]!.message).toContain("empty");
	});
});

describe("pipeline error: schema validation failure", () => {
	it("fails validation when required fields are missing", () => {
		const missingVersion = ["---", 'name: "missing-version"', "---", ""].join("\n");

		// parse succeeds (it only extracts, doesn't validate schema)
		const parseResult = parse(missingVersion);
		expect(parseResult.ok).toBe(true);

		// validate fails (spec_version is required)
		const validateResult = validate(missingVersion);
		expect(validateResult.ok).toBe(false);
		if (validateResult.ok) return;

		expect(validateResult.errors.length).toBeGreaterThan(0);
		const messages = validateResult.errors.map((e) => e.message);
		const hasVersionError = messages.some(
			(m) => m.includes("spec_version") || m.includes("required"),
		);
		expect(hasVersionError).toBe(true);
	});

	it("fails validation for invalid enum values", () => {
		const invalidStrategy = [
			"---",
			'spec_version: "1.0"',
			'name: "bad-strategy"',
			"reasoning:",
			'  strategy: "invalid_strategy"',
			"---",
			"",
		].join("\n");

		const parseResult = parse(invalidStrategy);
		expect(parseResult.ok).toBe(true);

		const validateResult = validate(invalidStrategy);
		expect(validateResult.ok).toBe(false);
		if (validateResult.ok) return;

		expect(validateResult.errors.length).toBeGreaterThan(0);
		const messages = validateResult.errors.map((e) => e.message);
		const hasEnumError = messages.some(
			(m) => m.includes("Invalid value") || m.includes("Allowed") || m.includes("enum"),
		);
		expect(hasEnumError).toBe(true);
	});

	it("provides line numbers in validation errors", () => {
		const missingVersion = ["---", 'name: "missing-version"', "---", ""].join("\n");

		const validateResult = validate(missingVersion);
		expect(validateResult.ok).toBe(false);
		if (validateResult.ok) return;

		// Errors should contain path information
		expect(validateResult.errors[0]!.path).toBeDefined();
	});
});

describe("pipeline error: circular dependencies", () => {
	it("detects direct circular dependencies in DAG", () => {
		const circularSpec = `---
spec_version: "1.0"
name: "circular-deps"
steps:
  step_a:
    description: "Step A"
    needs: [step_b]
  step_b:
    description: "Step B"
    needs: [step_a]
---
`;

		const parseResult = parse(circularSpec);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		const validateResult = validate(circularSpec);
		expect(validateResult.ok).toBe(true);
		if (!validateResult.ok) return;

		const steps = validateResult.data.steps as Record<string, Step>;
		const dagResult = resolve(steps);
		expect(dagResult.ok).toBe(false);
		if (dagResult.ok) return;

		expect(dagResult.errors.length).toBeGreaterThan(0);
		const cycleError = dagResult.errors.find((e) => e.type === "cycle");
		expect(cycleError).toBeDefined();
		expect(cycleError!.message).toContain("Circular dependency");
	});

	it("detects self-referencing dependencies", () => {
		const selfRef: Record<string, Step> = {
			loop: { description: "Self-loop", needs: ["loop"] },
		};

		const dagResult = resolve(selfRef);
		expect(dagResult.ok).toBe(false);
		if (dagResult.ok) return;

		const cycleError = dagResult.errors.find((e) => e.type === "cycle");
		expect(cycleError).toBeDefined();
		expect(cycleError!.message).toContain("depends on itself");
	});
});

describe("pipeline error: invalid expression", () => {
	it("throws ExpressionError for missing closing delimiter", () => {
		expect(() => {
			evaluate("{{ confidence >= 0.7 ", {});
		}).toThrow(ExpressionError);
		expect(() => {
			evaluate("{{ confidence >= 0.7 ", {});
		}).toThrow("delimiters");
	});

	it("throws ExpressionError for unterminated string", () => {
		expect(() => {
			evaluate('{{ name == "unclosed }}', {});
		}).toThrow(ExpressionError);
		expect(() => {
			evaluate('{{ name == "unclosed }}', {});
		}).toThrow("Unterminated string");
	});

	it("throws ExpressionError for unexpected characters", () => {
		expect(() => {
			evaluate("{{ x @ y }}", {});
		}).toThrow(ExpressionError);
		expect(() => {
			evaluate("{{ x @ y }}", {});
		}).toThrow("Unexpected character");
	});

	it("throws ExpressionError for calling method on non-array", () => {
		const ctx: ExpressionContext = { items: "not-an-array" };
		expect(() => {
			evaluate("{{ items.contains('x') }}", ctx);
		}).toThrow(ExpressionError);
		expect(() => {
			evaluate("{{ items.contains('x') }}", ctx);
		}).toThrow("non-array");
	});
});

// -----------------------------------------------------------------------------
// Import Resolution Tests
// -----------------------------------------------------------------------------

describe("pipeline: import resolution", () => {
	it("resolves imports with namespace merging", () => {
		const childContent = `---
spec_version: "1.0"
name: "child-spec"
steps:
  analyze:
    description: "Child analyze step"
  report:
    description: "Child report step"
    needs: [analyze]
---
`;

		const parentContent = `---
spec_version: "1.0"
name: "parent-spec"
imports:
  - ref: "./child.logic.md"
    as: "child"
steps:
  orchestrate:
    description: "Parent orchestration step"
---
`;

		writeFileSync(join(tmpDir, "child.logic.md"), childContent);
		writeFileSync(join(tmpDir, "parent.logic.md"), parentContent);

		// Parse the parent
		const parseResult = parse(parentContent);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		// Resolve imports
		const importResult = resolveImports(parseResult.data, tmpDir);
		expect(importResult.ok).toBe(true);
		if (!importResult.ok) return;

		// Verify namespaced steps appear
		const mergedSteps = importResult.data.steps;
		expect(mergedSteps).toBeDefined();
		expect(mergedSteps!["child.analyze"]).toBeDefined();
		expect(mergedSteps!["child.report"]).toBeDefined();
		expect(mergedSteps!.orchestrate).toBeDefined();

		// Verify namespaced needs are updated
		expect(mergedSteps!["child.report"]!.needs).toEqual(["child.analyze"]);
	});

	it("resolves transitive imports", () => {
		const grandchild = `---
spec_version: "1.0"
name: "grandchild"
steps:
  leaf:
    description: "Leaf step"
---
`;
		const child = `---
spec_version: "1.0"
name: "child"
imports:
  - ref: "./grandchild.logic.md"
    as: "gc"
steps:
  middle:
    description: "Middle step"
---
`;
		const parent = `---
spec_version: "1.0"
name: "parent"
imports:
  - ref: "./child.logic.md"
    as: "c"
steps:
  top:
    description: "Top step"
---
`;

		writeFileSync(join(tmpDir, "grandchild.logic.md"), grandchild);
		writeFileSync(join(tmpDir, "child.logic.md"), child);
		writeFileSync(join(tmpDir, "parent.logic.md"), parent);

		const parseResult = parse(parent);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		const importResult = resolveImports(parseResult.data, tmpDir);
		expect(importResult.ok).toBe(true);
		if (!importResult.ok) return;

		const steps = importResult.data.steps;
		expect(steps).toBeDefined();
		expect(steps!.top).toBeDefined();
		expect(steps!["c.middle"]).toBeDefined();
		// Transitive grandchild is namespaced under child's namespace
		expect(steps!["c.gc.leaf"]).toBeDefined();
	});
});

describe("pipeline: circular import detection", () => {
	it("detects circular imports between two files", () => {
		const fileA = `---
spec_version: "1.0"
name: "file-a"
imports:
  - ref: "./file-b.logic.md"
    as: "b"
---
`;

		const fileB = `---
spec_version: "1.0"
name: "file-b"
imports:
  - ref: "./file-a.logic.md"
    as: "a"
---
`;

		writeFileSync(join(tmpDir, "file-a.logic.md"), fileA);
		writeFileSync(join(tmpDir, "file-b.logic.md"), fileB);

		const parseResult = parse(fileA);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		const importResult = resolveImports(parseResult.data, tmpDir);
		expect(importResult.ok).toBe(false);
		if (importResult.ok) return;

		expect(importResult.errors.length).toBeGreaterThan(0);
		const circularError = importResult.errors.find((e) => e.type === "circular_import");
		expect(circularError).toBeDefined();
		expect(circularError!.message).toContain("Circular import");
	});

	it("detects missing import files", () => {
		const spec: LogicSpec = {
			spec_version: "1.0",
			name: "missing-import",
			imports: [{ ref: "./nonexistent.logic.md", as: "missing" }],
		};

		const importResult = resolveImports(spec, tmpDir);
		expect(importResult.ok).toBe(false);
		if (importResult.ok) return;

		const fileError = importResult.errors.find((e) => e.type === "file_not_found");
		expect(fileError).toBeDefined();
		expect(fileError!.message).toContain("not found");
	});
});

// -----------------------------------------------------------------------------
// End-to-End Pipeline Composition
// -----------------------------------------------------------------------------

describe("full pipeline: end-to-end composition", () => {
	it("composes parse -> validate -> resolve -> imports -> evaluate in sequence", () => {
		const childSpec = `---
spec_version: "1.0"
name: "scoring-module"
steps:
  score:
    description: "Calculate confidence score"
quality_gates:
  pre_output:
    - name: "min_score"
      check: "{{ score > 0.5 }}"
      severity: warning
---
`;

		const mainSpec = `---
spec_version: "1.0"
name: "review-pipeline"
imports:
  - ref: "./scoring.logic.md"
    as: "scorer"
reasoning:
  strategy: react
  max_iterations: 3
steps:
  gather:
    description: "Gather information"
  analyze:
    description: "Analyze findings"
    needs: [gather]
quality_gates:
  pre_output:
    - name: "has_results"
      check: "{{ results.length > 0 }}"
      severity: error
---
`;

		writeFileSync(join(tmpDir, "scoring.logic.md"), childSpec);

		// 1. Parse
		const parseResult = parse(mainSpec);
		expect(parseResult.ok).toBe(true);
		if (!parseResult.ok) return;

		// 2. Validate
		const validateResult = validate(mainSpec);
		expect(validateResult.ok).toBe(true);
		if (!validateResult.ok) return;

		// 3. Resolve imports
		const importResult = resolveImports(parseResult.data, tmpDir);
		expect(importResult.ok).toBe(true);
		if (!importResult.ok) return;

		// Verify merged steps
		const mergedSteps = importResult.data.steps;
		expect(mergedSteps).toBeDefined();
		expect(mergedSteps!.gather).toBeDefined();
		expect(mergedSteps!.analyze).toBeDefined();
		expect(mergedSteps!["scorer.score"]).toBeDefined();

		// 4. Resolve DAG on merged steps
		const dagResult = resolve(mergedSteps!);
		expect(dagResult.ok).toBe(true);
		if (!dagResult.ok) return;

		// gather and scorer.score are independent (level 0)
		// analyze depends on gather (level 1)
		expect(dagResult.levels.length).toBeGreaterThanOrEqual(2);
		expect(dagResult.order).toContain("gather");
		expect(dagResult.order).toContain("analyze");
		expect(dagResult.order).toContain("scorer.score");

		// analyze must come after gather in the order
		const gatherIdx = dagResult.order.indexOf("gather");
		const analyzeIdx = dagResult.order.indexOf("analyze");
		expect(analyzeIdx).toBeGreaterThan(gatherIdx);

		// 5. Evaluate gate expression
		const gate = validateResult.data.quality_gates?.pre_output?.[0];
		expect(gate).toBeDefined();
		if (!gate) return;

		const passingCtx: ExpressionContext = { results: { length: 3 } };
		expect(evaluate(gate.check, passingCtx)).toBe(true);

		const failingCtx: ExpressionContext = { results: { length: 0 } };
		expect(evaluate(gate.check, failingCtx)).toBe(false);
	});
});
