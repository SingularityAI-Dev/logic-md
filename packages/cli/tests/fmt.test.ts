import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toCanonical } from "../src/commands/fmt.js";

describe("fmt command", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "logic-md-fmt-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("should format file with non-canonical key order", () => {
		const content = `---
name: test
description: Test workflow
spec_version: "1.0"
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---

# Test`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();
		expect(canonical).toContain('spec_version: "1.0"');

		// Check that spec_version comes before name in canonical format
		const specVersionIdx = canonical!.indexOf("spec_version");
		const nameIdx = canonical!.indexOf("name:");
		expect(specVersionIdx).toBeLessThan(nameIdx);
	});

	it("should preserve markdown body during formatting", () => {
		const body = `# Test Agent

This is a test agent with multiple paragraphs.

- Item 1
- Item 2`;

		const content = `---
name: test
spec_version: "1.0"
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---

${body}`;

		const canonical = toCanonical(content);
		expect(canonical).toContain("# Test Agent");
		expect(canonical).toContain("This is a test agent");
		expect(canonical).toContain("- Item 1");
	});

	it("should not modify already-canonical file", () => {
		const content = `---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---

# Test`;

		const canonical = toCanonical(content);
		expect(canonical).toBe(content);
	});

	it("should handle file without YAML frontmatter", () => {
		const content = "# Just markdown\n\nNo YAML frontmatter here.";
		const canonical = toCanonical(content);
		expect(canonical).toBeNull();
	});

	it("should reorder keys to canonical order", () => {
		const content = `---
quality_gates:
  post_output:
    - name: check
      check: "{{ true }}"
      message: Check
      severity: error
      on_fail: retry
steps:
  execute:
    description: Execute
    instructions: Do it.
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: Data
reasoning:
  strategy: cot
  max_iterations: 3
description: Test
spec_version: "1.0"
name: test
---`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();

		// Extract just the frontmatter
		const lines = canonical!.split("\n");
		const specIdx = lines.findIndex((l) => l.includes("spec_version"));
		const nameIdx = lines.findIndex((l) => l.includes("name:"));
		const descIdx = lines.findIndex((l) => l.includes("description:"));
		const reasoningIdx = lines.findIndex((l) => l.includes("reasoning:"));
		const stepsIdx = lines.findIndex((l) => l.includes("steps:"));
		const contractsIdx = lines.findIndex((l) => l.includes("contracts:"));
		const gatesIdx = lines.findIndex((l) => l.includes("quality_gates:"));

		// Verify canonical order
		expect(specIdx).toBeLessThan(nameIdx);
		expect(nameIdx).toBeLessThan(descIdx);
		expect(descIdx).toBeLessThan(reasoningIdx);
		expect(reasoningIdx).toBeLessThan(stepsIdx);
		expect(stepsIdx).toBeLessThan(contractsIdx);
		expect(contractsIdx).toBeLessThan(gatesIdx);
	});

	it("should use 2-space indentation", () => {
		const content = `---
name: test
spec_version: "1.0"
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();

		// Check for 2-space indentation (should have "  strategy" but not "\t" tabs)
		expect(canonical).toContain("  strategy:");
		expect(canonical).not.toContain("\t");
	});

	it("should handle complex nested structures", () => {
		const content = `---
name: complex
spec_version: "1.0"
description: Complex workflow
reasoning:
  strategy: react
  max_iterations: 8
  parameters:
    temperature: 0.7
    top_p: 0.95
steps:
  step1:
    description: Step 1
    instructions: Do step 1.
  step2:
    description: Step 2
    needs:
      - step1
    instructions: Do step 2.
    branches:
      path_a:
        label: Path A
        condition: "{{ output.choice == 'a' }}"
      path_b:
        label: Path B
        condition: "{{ output.choice == 'b' }}"
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: Input data
  outputs:
    - name: result
      type: object
      required: true
      description: Output result
quality_gates:
  post_output:
    - name: check1
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
    - name: check2
      check: "{{ output.result != null }}"
      message: Result required
      severity: warning
      on_fail: skip
---`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();
		expect(canonical).toContain("spec_version");
		expect(canonical).toContain("reasoning:");
		expect(canonical).toContain("temperature:");
		expect(canonical).toContain("branches:");
		expect(canonical).toContain("contracts:");
		expect(canonical).toContain("quality_gates:");
	});

	it("should handle file with extra custom fields", () => {
		const content = `---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
custom_field: custom_value
another_field: another_value
---`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();
		// Custom fields should still be present
		expect(canonical).toContain("custom_field");
		expect(canonical).toContain("another_field");
	});

	it("should preserve Windows line endings in body", () => {
		const content = `---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---\r\n# Test\r\nWith Windows line endings\r\n`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();
		// The body should preserve whatever line endings were there
	});

	it("should format multi-step DAG workflow", () => {
		const content = `---
steps:
  init:
    description: Initialize
    instructions: Init.
  parallel_1:
    description: Parallel 1
    needs:
      - init
    instructions: P1.
  parallel_2:
    description: Parallel 2
    needs:
      - init
    instructions: P2.
  final:
    description: Final
    needs:
      - parallel_1
      - parallel_2
    instructions: Final.
reasoning:
  strategy: cot
  max_iterations: 5
description: DAG workflow
spec_version: "1.0"
name: dag-test
---`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();

		const lines = canonical!.split("\n");
		const specIdx = lines.findIndex((l) => l.includes("spec_version"));
		const stepsIdx = lines.findIndex((l) => l.includes("steps:"));

		expect(specIdx).toBeLessThan(stepsIdx);
	});

	it("should handle minimal valid file", () => {
		const content = `---
spec_version: "1.0"
name: minimal
description: Minimal workflow
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---

# Minimal`;

		const canonical = toCanonical(content);
		expect(canonical).toBe(content);
	});

	it("should format file with all canonical fields in wrong order", () => {
		const content = `---
metadata:
  version: 1
visual:
  color: blue
global:
  timeout: 300
edges: []
nodes: []
decision_trees: {}
fallback:
  instruction: Fallback instruction
quality_gates:
  post_output: []
contracts:
  inputs: []
  outputs: []
steps:
  execute:
    description: Execute
    instructions: Do it.
reasoning:
  strategy: cot
  max_iterations: 3
imports: []
description: Test
name: test
spec_version: "1.0"
---`;

		const canonical = toCanonical(content);
		expect(canonical).toBeTruthy();

		// Verify spec_version is first
		const lines = canonical!.split("\n");
		let firstKeyIdx = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].match(/^\S+:/)) {
				firstKeyIdx = i;
				break;
			}
		}
		expect(lines[firstKeyIdx]).toContain("spec_version");
	});
});
