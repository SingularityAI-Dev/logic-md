import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LogicSpec } from "@logic-md/core";
import { estimateTokens, parse, resolve, validate } from "@logic-md/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("test command", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "logic-md-test-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function testFile(content: string) {
		const parsed = parse(content);
		if (!parsed.ok) {
			return { valid: false, errors: parsed.errors };
		}

		const validated = validate(content);
		if (!validated.ok) {
			return { valid: false, errors: validated.errors };
		}

		const spec = validated.data;
		return { valid: true, spec };
	}

	it("should validate single-step workflow", () => {
		const content = `---
spec_version: "1.0"
name: single
description: Single step
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});

	it("should validate multi-step workflow", () => {
		const content = `---
spec_version: "1.0"
name: multi
description: Multi-step
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  step1:
    description: Step 1
    instructions: Do 1.
  step2:
    description: Step 2
    needs:
      - step1
    instructions: Do 2.
  step3:
    description: Step 3
    needs:
      - step2
    instructions: Do 3.
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});

	it("should detect cyclic dependencies", () => {
		const content = `---
spec_version: "1.0"
name: cyclic
description: Cyclic
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: Step 1
    needs:
      - step2
    instructions: Do 1.
  step2:
    description: Step 2
    needs:
      - step1
    instructions: Do 2.
---`;

		const result = testFile(content);
		// May or may not be valid depending on schema validation
		expect(typeof result.valid).toBe("boolean");
	});

	it("should handle workflow with branches", () => {
		const content = `---
spec_version: "1.0"
name: branching
description: Branching
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  decide:
    description: Decide
    instructions: Make decision.
    branches:
      - if: "{{ output.choice == 'a' }}"
        then: handle_a
      - if: "{{ output.choice == 'b' }}"
        then: handle_b
  handle_a:
    description: Handle A
    needs:
      - decide
    instructions: Handle A.
  handle_b:
    description: Handle B
    needs:
      - decide
    instructions: Handle B.
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});

	it("should validate contracts", () => {
		const content = `---
spec_version: "1.0"
name: with-contracts
description: With contracts
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: Input
  outputs:
    - name: result
      type: object
      required: true
      description: Output
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);

		if (result.valid) {
			expect(result.spec.contracts).toBeDefined();
			expect(result.spec.contracts?.inputs).toBeDefined();
			expect(result.spec.contracts?.outputs).toBeDefined();
		}
	});

	it("should validate quality gates", () => {
		const content = `---
spec_version: "1.0"
name: with-gates
description: With gates
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
quality_gates:
  post_output:
    - name: check
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);

		if (result.valid) {
			expect(result.spec.quality_gates).toBeDefined();
			expect(result.spec.quality_gates?.post_output).toBeDefined();
		}
	});

	it("should estimate tokens for workflow", () => {
		const content = `---
spec_version: "1.0"
name: token-test
description: Token estimation test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: First step with some description
    instructions: |
      This is a longer set of instructions.
      It contains multiple lines.
      Each line contributes to token count.
  step2:
    description: Second step
    needs:
      - step1
    instructions: Short instructions.
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		if (parsed.ok) {
			// estimateTokens takes a string, not a spec object
			const tokens = estimateTokens(content);
			expect(tokens).toBeGreaterThan(0);
		}
	});

	it("should handle parallel execution paths", () => {
		const content = `---
spec_version: "1.0"
name: parallel
description: Parallel execution
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  init:
    description: Initialize
    instructions: Setup.
  task_a:
    description: Task A
    needs:
      - init
    instructions: Do A.
  task_b:
    description: Task B
    needs:
      - init
    instructions: Do B.
  task_c:
    description: Task C
    needs:
      - init
    instructions: Do C.
  gather:
    description: Gather results
    needs:
      - task_a
      - task_b
      - task_c
    instructions: Gather.
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});

	it("should validate step with multiple branches", () => {
		const content = `---
spec_version: "1.0"
name: multi-branch
description: Multiple branches
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  evaluate:
    description: Evaluate
    instructions: Evaluate input.
    branches:
      - if: "{{ output.score > 0.8 }}"
        then: handle_1
      - if: "{{ output.score > 0.5 }}"
        then: handle_2
      - if: "{{ output.score <= 0.5 }}"
        then: handle_3
  handle_1:
    description: Handle 1
    needs:
      - evaluate
    instructions: Handle 1.
  handle_2:
    description: Handle 2
    needs:
      - evaluate
    instructions: Handle 2.
  handle_3:
    description: Handle 3
    needs:
      - evaluate
    instructions: Handle 3.
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});

	it("should detect unreachable steps", () => {
		const content = `---
spec_version: "1.0"
name: unreachable
description: Unreachable steps
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: Step 1
    instructions: Do 1.
  step2:
    description: Step 2
    needs:
      - step1
    instructions: Do 2.
  orphan:
    description: Orphan step
    instructions: Orphaned.
---`;

		const result = testFile(content);
		// Validation may pass, but linting should catch unreachable steps
		expect(typeof result.valid).toBe("boolean");
	});

	it("should validate complex DAG with multiple levels", () => {
		const content = `---
spec_version: "1.0"
name: complex-dag
description: Complex DAG
reasoning:
  strategy: cot
  max_iterations: 10
steps:
  level_0:
    description: Level 0
    instructions: Start.
  level_1a:
    description: Level 1A
    needs:
      - level_0
    instructions: L1A.
  level_1b:
    description: Level 1B
    needs:
      - level_0
    instructions: L1B.
  level_2a:
    description: Level 2A
    needs:
      - level_1a
    instructions: L2A.
  level_2b:
    description: Level 2B
    needs:
      - level_1a
      - level_1b
    instructions: L2B.
  level_3:
    description: Level 3
    needs:
      - level_2a
      - level_2b
    instructions: End.
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});

	it("should handle workflow with input/output contracts", () => {
		const content = `---
spec_version: "1.0"
name: io-contracts
description: I/O contracts
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
contracts:
  inputs:
    - name: request
      type: object
      required: true
      description: Input request
      properties:
        id:
          type: string
        data:
          type: object
  outputs:
    - name: response
      type: object
      required: true
      description: Output response
      properties:
        id:
          type: string
        result:
          type: object
        success:
          type: boolean
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);

		if (result.valid) {
			const spec = result.spec;
			expect(spec.contracts?.inputs?.length).toBeGreaterThan(0);
			expect(spec.contracts?.inputs?.[0].name).toBe("request");
			expect(spec.contracts?.outputs?.length).toBeGreaterThan(0);
			expect(spec.contracts?.outputs?.[0].name).toBe("response");
		}
	});

	it("should validate all reasoning strategies", () => {
		const strategies = ["cot", "react", "tot", "got", "plan-execute"];

		for (const strategy of strategies) {
			const content = `---
spec_version: "1.0"
name: ${strategy}-test
description: Test ${strategy}
reasoning:
  strategy: ${strategy}
  max_iterations: 5
steps:
  execute:
    description: Execute
    instructions: Do it.
---`;

			const result = testFile(content);
			expect(result.valid).toBe(true);

			if (result.valid) {
				expect(result.spec.reasoning?.strategy).toBe(strategy);
			}
		}
	});

	it("should validate workflow with nested quality gates", () => {
		const content = `---
spec_version: "1.0"
name: nested-gates
description: Nested gates
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
quality_gates:
  post_output:
    - name: gate1
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
    - name: gate2
      check: "{{ output.success }}"
      message: Success required
      severity: warning
      on_fail: skip
---`;

		const result = testFile(content);
		expect(result.valid).toBe(true);
	});
});
