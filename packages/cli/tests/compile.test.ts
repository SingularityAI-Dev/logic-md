import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@logic-md/core";
import { compileWorkflow, parse, validate } from "@logic-md/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("compile command", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "logic-md-compile-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	const createMinimalContext = (): WorkflowContext => ({
		currentStep: "",
		previousOutputs: {},
		input: null,
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
		totalSteps: 0,
		completedSteps: [],
		dagLevels: [],
	});

	it("should compile a single-step workflow", () => {
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
---

# Single`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled).toBeDefined();
		expect(compiled.steps).toBeDefined();
		expect(compiled.steps.length).toBeGreaterThan(0);
		expect(compiled.steps[0].metadata.stepName).toBe("execute");
	});

	it("should compile a multi-step workflow", () => {
		const content = `---
spec_version: "1.0"
name: multi
description: Multi-step
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  step1:
    description: First
    instructions: Do 1.
  step2:
    description: Second
    needs:
      - step1
    instructions: Do 2.
  step3:
    description: Third
    needs:
      - step2
    instructions: Do 3.
---

# Multi`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.steps.length).toBe(3);
		expect(compiled.steps[0].metadata.stepName).toBe("step1");
		expect(compiled.steps[1].metadata.stepName).toBe("step2");
		expect(compiled.steps[2].metadata.stepName).toBe("step3");
	});

	it("should fail to compile file with parse error", () => {
		const content = `---
spec_version: "1.0"
name: invalid
reasoning:
  strategy: cot
steps:
  bad: [unclosed
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(false);
	});

	it("should fail to compile file with validation error", () => {
		const content = `---
spec_version: "2.0"
name: invalid
reasoning:
  strategy: cot
  max_iterations: 3
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(false);
	});

	it("should include step descriptions in compiled output", () => {
		const content = `---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute the task
    instructions: Do the task.
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.steps[0].systemPromptSegment).toContain("Execute the task");
	});

	it("should include step instructions in compiled output", () => {
		const instructions = "Do this important work";
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
    instructions: |
      ${instructions}
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.steps[0].systemPromptSegment).toContain(instructions);
	});

	it("should preserve step dependencies in DAG order", () => {
		const content = `---
spec_version: "1.0"
name: dag-test
description: DAG test
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  init:
    description: Initialize
    instructions: Initialize.
  parallel_1:
    description: Parallel 1
    needs:
      - init
    instructions: Do parallel 1.
  parallel_2:
    description: Parallel 2
    needs:
      - init
    instructions: Do parallel 2.
  final:
    description: Final
    needs:
      - parallel_1
      - parallel_2
    instructions: Finalize.
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		const names = compiled.steps.map((s) => s.metadata.stepName);
		expect(names).toEqual(["init", "parallel_1", "parallel_2", "final"]);
	});

	it("should compile file with contracts", () => {
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
      description: Input data
  outputs:
    - name: result
      type: object
      required: true
      description: Result
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled).toBeDefined();
		expect(compiled.metadata.name).toBe("with-contracts");
		expect(compiled.steps.length).toBeGreaterThan(0);
	});

	it("should compile file with quality gates", () => {
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
    - name: output-check
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.globalQualityGates).toBeDefined();
	});

	it("should compile file with branching logic", () => {
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

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		const stepNames = compiled.steps.map((s) => s.metadata.stepName);
		expect(stepNames).toContain("decide");
		expect(stepNames).toContain("handle_a");
		expect(stepNames).toContain("handle_b");
	});

	it("should include reasoning configuration in compiled output", () => {
		const content = `---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: tot
  max_iterations: 10
steps:
  execute:
    description: Execute
    instructions: Do it.
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.metadata.name).toBe("test");
		expect(compiled.steps[0].systemPromptSegment).toBeDefined();
	});

	it("should compile workflow with all features", () => {
		const content = `---
spec_version: "1.0"
name: comprehensive
description: Comprehensive workflow
reasoning:
  strategy: react
  max_iterations: 8
steps:
  init:
    description: Initialize
    instructions: Initialize.
  process:
    description: Process
    needs:
      - init
    instructions: Process.
    branches:
      - if: "{{ output.valid }}"
        then: success_handler
      - default: true
        then: failure_handler
  success_handler:
    description: Success handler
    needs:
      - process
    instructions: Handle success.
  failure_handler:
    description: Failure handler
    needs:
      - process
    instructions: Handle failure.
  finalize:
    description: Finalize
    needs:
      - success_handler
      - failure_handler
    instructions: Finalize.
contracts:
  inputs:
    - name: input_data
      type: object
      required: true
      description: Input data
  outputs:
    - name: output_data
      type: object
      required: true
      description: Output data
quality_gates:
  post_output:
    - name: result-check
      check: "{{ output.output_data != null }}"
      message: Output data required
      severity: error
      on_fail: retry
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.steps.length).toBe(5);
		expect(compiled.metadata.name).toBe("comprehensive");
		expect(compiled.globalQualityGates).toBeDefined();
	});

	it("should compile workflow with custom reasoning parameters", () => {
		const content = `---
spec_version: "1.0"
name: custom-params
description: Custom params
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  execute:
    description: Execute
    instructions: Do it.
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		expect(compiled.steps.length).toBeGreaterThan(0);
		expect(compiled.metadata.name).toBe("custom-params");
	});

	it("should generate valid JSON from compiled output", () => {
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
---`;

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const ctx = createMinimalContext();
		const compiled = compileWorkflow(validated.data, ctx);

		// Should be serializable to JSON
		const jsonStr = JSON.stringify(compiled);
		expect(jsonStr).toBeTruthy();

		// Should be deserializable back
		const parsed = JSON.parse(jsonStr);
		expect(parsed.steps).toBeDefined();
		expect(parsed.steps.length).toBeGreaterThan(0);
	});
});
