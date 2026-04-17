/**
 * Tests for the LangGraph adapter.
 *
 * These tests verify:
 * 1. Single-step specs map to 1 node with entry→node→END
 * 2. Multi-step DAGs produce correct edges and levels
 * 3. Quality gates are captured in metadata
 * 4. Invalid specs are rejected appropriately
 */

import { parse, validate } from "@logic-md/core";
import { beforeEach, describe, expect, it } from "vitest";
import { AdapterError, toStateGraphFromContent, toStateGraphFromSpec } from "../index.js";

describe("LangGraph Adapter", () => {
	describe("toStateGraphFromContent", () => {
		it("should convert a single-step spec to a graph with 1 node", () => {
			const spec = `---
spec_version: "1.0"
name: "single-step-workflow"
reasoning:
  strategy: "cot"
steps:
  analyze:
    instructions: "Analyze the input."
    output_schema:
      type: "object"
      properties:
        result:
          type: "string"
---

A simple single-step workflow.
`;

			const graph = toStateGraphFromContent(spec);

			expect(graph.nodes).toHaveLength(1);
			expect(graph.nodes[0]).toBeDefined();
			expect(graph.nodes[0]!.name).toBe("analyze");
			expect(graph.nodes[0]!.promptSegment).toBe("Analyze the input.");
			expect(graph.nodes[0]!.outputSchema).toBeDefined();

			expect(graph.edges).toHaveLength(0);
			expect(graph.entryPoint).toBe("analyze");
			expect(graph.endNodes).toContain("analyze");

			expect(graph.metadata.workflowName).toBe("single-step-workflow");
			expect(graph.metadata.totalSteps).toBe(1);
			expect(graph.metadata.totalLevels).toBe(1);
		});

		it("should convert a linear multi-step spec to a correct DAG", () => {
			const spec = `---
spec_version: "1.0"
name: "linear-workflow"
steps:
  step1:
    instructions: "Do step 1."
  step2:
    needs: ["step1"]
    instructions: "Do step 2."
  step3:
    needs: ["step2"]
    instructions: "Do step 3."
---

A three-step linear workflow.
`;

			const graph = toStateGraphFromContent(spec);

			expect(graph.nodes).toHaveLength(3);
			expect(graph.nodes.map((n) => n.name)).toEqual(["step1", "step2", "step3"]);

			expect(graph.edges).toHaveLength(2);
			expect(graph.edges[0]).toEqual({ from: "step1", to: "step2" });
			expect(graph.edges[1]).toEqual({ from: "step2", to: "step3" });

			expect(graph.entryPoint).toBe("step1");
			expect(graph.endNodes).toEqual(["step3"]);

			expect(graph.metadata.totalLevels).toBe(3);
		});

		it("should handle a branching DAG with parallel levels", () => {
			const spec = `---
spec_version: "1.0"
name: "branching-workflow"
steps:
  start:
    instructions: "Start here."
  parallel_a:
    needs: ["start"]
    instructions: "Run in parallel (A)."
  parallel_b:
    needs: ["start"]
    instructions: "Run in parallel (B)."
  merge:
    needs: ["parallel_a", "parallel_b"]
    instructions: "Merge results."
---

A workflow with parallel branches.
`;

			const graph = toStateGraphFromContent(spec);

			expect(graph.nodes).toHaveLength(4);

			// Check DAG levels
			expect(graph.metadata.totalLevels).toBe(3);
			expect(graph.nodes[0]!.metadata.dagLevel).toBe(0); // start
			expect(graph.nodes[1]!.metadata.dagLevel).toBe(1); // parallel_a
			expect(graph.nodes[2]!.metadata.dagLevel).toBe(1); // parallel_b
			expect(graph.nodes[3]!.metadata.dagLevel).toBe(2); // merge

			// Check edges
			expect(graph.edges).toHaveLength(3);
			expect(graph.edges).toContainEqual({ from: "start", to: "parallel_a" });
			expect(graph.edges).toContainEqual({ from: "start", to: "parallel_b" });
			expect(graph.edges).toContainEqual({ from: "parallel_a", to: "merge" });
			expect(graph.edges).toContainEqual({ from: "parallel_b", to: "merge" });

			expect(graph.entryPoint).toBe("start");
			expect(graph.endNodes).toEqual(["merge"]);
		});

		it("should capture quality gates in metadata", () => {
			const spec = `---
spec_version: "1.0"
name: "workflow-with-gates"
steps:
  validate:
    instructions: "Validate input."
    verification:
      check: "{{ output.confidence > 0.8 }}"
      on_fail: "retry"
quality_gates:
  pre_output:
    - name: "global_gate"
      check: "{{ steps.validate.confidence > 0.9 }}"
      severity: "error"
---

Workflow with quality gates.
`;

			const graph = toStateGraphFromContent(spec);

			const node = graph.nodes[0];
			expect(node).toBeDefined();
			expect(node!.metadata.qualityGates).toBeDefined();
			expect(node!.metadata.qualityGates).toContainEqual({
				name: "verification",
				check: "{{ output.confidence > 0.8 }}",
				severity: "error",
			});

			expect(graph.metadata.globalQualityGates).toBeDefined();
			expect(graph.metadata.globalQualityGates).toContainEqual({
				name: "global_gate",
				check: "{{ steps.validate.confidence > 0.9 }}",
				severity: "error",
			});
		});

		it("should include retry policy in metadata", () => {
			const spec = `---
spec_version: "1.0"
name: "workflow-with-retry"
steps:
  flaky_step:
    instructions: "This might fail."
    retry:
      max_attempts: 3
      initial_interval: "1s"
      backoff_coefficient: 2
      maximum_interval: "30s"
---

Workflow with retry policy.
`;

			const graph = toStateGraphFromContent(spec);

			const node = graph.nodes[0];
			expect(node).toBeDefined();
			expect(node!.metadata.retryPolicy).toBeDefined();
			expect(node!.metadata.retryPolicy?.maxAttempts).toBe(3);
		});

		it("should reject an empty spec", () => {
			const spec = `---
spec_version: "1.0"
name: "empty-workflow"
---

No steps defined.
`;

			expect(() => toStateGraphFromContent(spec, { strict: true })).toThrow(AdapterError);
			expect(() => toStateGraphFromContent(spec, { strict: true })).toThrow(/no steps defined/i);
		});

		it("should reject a spec with a cycle", () => {
			const spec = `---
spec_version: "1.0"
name: "cyclic-workflow"
steps:
  step_a:
    needs: ["step_b"]
    instructions: "Step A."
  step_b:
    needs: ["step_a"]
    instructions: "Step B."
---

This has a cycle.
`;

			expect(() => toStateGraphFromContent(spec, { strict: true })).toThrow(AdapterError);
		});

		it("should handle invalid YAML with strict mode", () => {
			const badContent = `---
spec_version: "1.0"
name: [invalid array in name]
---

Bad YAML.
`;

			expect(() => toStateGraphFromContent(badContent, { strict: true })).toThrow();
		});

		it("should warn but not throw in non-strict mode for invalid content", () => {
			const badContent = `---
spec_version: "1.0"
---

No name field.
`;

			// Should not throw
			const graph = toStateGraphFromContent(badContent, { strict: false });
			expect(graph).toBeDefined();
		});
	});

	describe("toStateGraphFromSpec", () => {
		it("should work with pre-parsed and pre-validated specs", () => {
			const content = `---
spec_version: "1.0"
name: "test-workflow"
steps:
  task:
    instructions: "Do the task."
---

Test.
`;

			const parseResult = parse(content);
			expect(parseResult.ok).toBe(true);
			if (!parseResult.ok) throw new Error("Parse failed");

			const validateResult = validate(content);
			expect(validateResult.ok).toBe(true);
			if (!validateResult.ok) throw new Error("Validation failed");

			const graph = toStateGraphFromSpec(parseResult.data);
			expect(graph.nodes).toHaveLength(1);
			expect(graph.nodes[0]!.name).toBe("task");
		});

		it("should handle specs with descriptions and metadata", () => {
			const content = `---
spec_version: "1.0"
name: "documented-workflow"
description: "A workflow with full documentation."
metadata:
  author: "test-user"
  version: "1.0.0"
steps:
  first:
    description: "The first step."
    instructions: "Begin here."
    output_schema:
      type: "object"
      properties:
        data:
          type: "string"
---

Full documentation.
`;

			const parseResult = parse(content);
			expect(parseResult.ok).toBe(true);
			if (!parseResult.ok) throw new Error("Parse failed");

			const validateResult = validate(content);
			expect(validateResult.ok).toBe(true);
			if (!validateResult.ok) throw new Error("Validation failed");

			const graph = toStateGraphFromSpec(parseResult.data);
			expect(graph.metadata.workflowName).toBe("documented-workflow");
			expect(graph.nodes[0]!.promptSegment).toBe("Begin here.");
			expect(graph.nodes[0]!.outputSchema).toBeDefined();
		});
	});

	describe("Complex workflows", () => {
		it("should handle a diamond DAG pattern", () => {
			const spec = `---
spec_version: "1.0"
name: "diamond-workflow"
steps:
  root:
    instructions: "Root step."
  left:
    needs: ["root"]
    instructions: "Left branch."
  right:
    needs: ["root"]
    instructions: "Right branch."
  bottom:
    needs: ["left", "right"]
    instructions: "Bottom merge."
---

Diamond pattern.
`;

			const graph = toStateGraphFromContent(spec);

			expect(graph.nodes).toHaveLength(4);
			expect(graph.metadata.totalLevels).toBe(3);

			// All paths should lead to bottom
			const bottomNode = graph.nodes.find((n) => n.name === "bottom");
			expect(bottomNode).toBeDefined();
			expect(bottomNode!.metadata.dagLevel).toBe(2);

			// Check edges form the diamond
			expect(graph.edges.filter((e) => e.from === "root")).toHaveLength(2);
			expect(graph.edges.filter((e) => e.to === "bottom")).toHaveLength(2);
		});

		it("should correctly identify entry and end nodes in complex graphs", () => {
			const spec = `---
spec_version: "1.0"
name: "complex-workflow"
steps:
  entry:
    instructions: "Entry point."
  process_a:
    needs: ["entry"]
    instructions: "Path A."
  process_b:
    needs: ["entry"]
    instructions: "Path B."
  end_a:
    needs: ["process_a"]
    instructions: "End A."
  end_b:
    needs: ["process_b"]
    instructions: "End B."
---

Multiple end points.
`;

			const graph = toStateGraphFromContent(spec);

			expect(graph.entryPoint).toBe("entry");
			expect(new Set(graph.endNodes)).toEqual(new Set(["end_a", "end_b"]));
		});
	});

	describe("Edge cases", () => {
		it("should handle steps with no output schema", () => {
			const spec = `---
spec_version: "1.0"
name: "no-schema-workflow"
steps:
  step:
    instructions: "No output schema."
---

Test.
`;

			const graph = toStateGraphFromContent(spec);

			expect(graph.nodes[0]).toBeDefined();
			expect(graph.nodes[0]!.outputSchema).toBeNull();
		});

		it("should handle steps with input schema", () => {
			const spec = `---
spec_version: "1.0"
name: "input-schema-workflow"
steps:
  step:
    instructions: "With input schema."
    input_schema:
      type: "object"
      properties:
        query:
          type: "string"
---

Test.
`;

			const graph = toStateGraphFromContent(spec);
			expect(graph.nodes[0]).toBeDefined();
		});

		it("should preserve metadata when includeMetadata is disabled", () => {
			const spec = `---
spec_version: "1.0"
name: "metadata-test"
steps:
  step:
    instructions: "Step with metadata."
    retry:
      max_attempts: 5
quality_gates:
  pre_output:
    - name: "test_gate"
      check: "true"
---

Test.
`;

			const graph = toStateGraphFromContent(spec, { includeMetadata: false });

			expect(graph.nodes[0]!.metadata.qualityGates).toBeUndefined();
			expect(graph.nodes[0]!.metadata.retryPolicy).toBeUndefined();
			expect(graph.metadata.globalQualityGates).toBeUndefined();
		});
	});
});
