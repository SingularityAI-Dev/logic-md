import { parse, validate } from "@logic-md/core";
import { describe, expect, it } from "vitest";

describe("CLI commands integration", () => {
	it("should support basic workflow validation flow", () => {
		const content = `---
spec_version: "1.0"
name: test
description: Test workflow
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: First step
    instructions: Do the first step.
  step2:
    description: Second step
    needs:
      - step1
    instructions: Do the second step.
---

# Test Workflow

This is a test workflow.`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);
	});

	it("should validate all required metadata fields", () => {
		const content = `---
spec_version: "1.0"
name: complete
description: Complete workflow
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  main:
    description: Main step
    instructions: Execute main step.
contracts:
  inputs:
    - name: input
      type: object
      required: true
      description: Input
  outputs:
    - name: output
      type: object
      required: true
      description: Output
quality_gates:
  post_output:
    - name: test
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		expect(spec.spec_version).toBe("1.0");
		expect(spec.name).toBe("complete");
		expect(spec.description).toBeTruthy();
		expect(spec.reasoning).toBeDefined();
		expect(spec.steps).toBeDefined();
		expect(spec.contracts).toBeDefined();
		expect(spec.quality_gates).toBeDefined();
	});

	it("should handle workflow with all reasoning strategies", () => {
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

			const parsed = parse(content);
			expect(parsed.ok).toBe(true);

			const validated = validate(content);
			expect(validated.ok).toBe(true);
		}
	});

	it("should support complex DAG workflows", () => {
		const content = `---
spec_version: "1.0"
name: complex-dag
description: Complex workflow with DAG
reasoning:
  strategy: cot
  max_iterations: 10
steps:
  init:
    description: Initialize
    instructions: Start processing.
  parallel_1:
    description: Parallel task 1
    needs:
      - init
    instructions: Run task 1.
  parallel_2:
    description: Parallel task 2
    needs:
      - init
    instructions: Run task 2.
  parallel_3:
    description: Parallel task 3
    needs:
      - init
    instructions: Run task 3.
  gather:
    description: Gather results
    needs:
      - parallel_1
      - parallel_2
      - parallel_3
    instructions: Combine results.
  finalize:
    description: Finalize
    needs:
      - gather
    instructions: Complete processing.
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		expect(Object.keys(spec.steps || {})).toHaveLength(6);
	});

	it("should support branching workflows", () => {
		const content = `---
spec_version: "1.0"
name: branching-test
description: Workflow with branches
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  evaluate:
    description: Evaluate input
    instructions: Make evaluation.
    branches:
      - if: "{{ output.score > 0.7 }}"
        then: handle_good
      - if: "{{ output.score > 0.4 }}"
        then: handle_ok
      - default: true
        then: handle_bad
  handle_good:
    description: Handle good case
    needs:
      - evaluate
    instructions: Handle good path.
  handle_ok:
    description: Handle OK case
    needs:
      - evaluate
    instructions: Handle ok path.
  handle_bad:
    description: Handle bad case
    needs:
      - evaluate
    instructions: Handle bad path.
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);
	});

	it("should validate step with multiple dependencies", () => {
		const content = `---
spec_version: "1.0"
name: multi-deps
description: Multiple dependencies
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  step_a:
    description: Step A
    instructions: Do A.
  step_b:
    description: Step B
    instructions: Do B.
  step_c:
    description: Step C
    instructions: Do C.
  combined:
    description: Combined result
    needs:
      - step_a
      - step_b
      - step_c
    instructions: Combine A, B, C.
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		const combinedStep = spec.steps?.combined;
		expect(combinedStep?.needs).toHaveLength(3);
	});

	it("should handle workflows with custom reasoning parameters", () => {
		const content = `---
spec_version: "1.0"
name: custom-params
description: Custom reasoning parameters
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  execute:
    description: Execute
    instructions: Do it.
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		expect(spec.reasoning).toBeDefined();
	});

	it("should validate workflows with multiple contract inputs", () => {
		const content = `---
spec_version: "1.0"
name: multi-input
description: Multiple inputs
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  process:
    description: Process
    instructions: Do it.
contracts:
  inputs:
    - name: primary_input
      type: object
      required: true
      description: Primary input
    - name: config
      type: object
      required: false
      description: Configuration
    - name: context
      type: object
      required: false
      description: Context data
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		expect(spec.contracts?.inputs).toHaveLength(3);
	});

	it("should validate workflows with multiple quality gates", () => {
		const content = `---
spec_version: "1.0"
name: multi-gates
description: Multiple quality gates
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
quality_gates:
  post_output:
    - name: gate_1
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
    - name: gate_2
      check: "{{ output.success }}"
      message: Success flag required
      severity: error
      on_fail: retry
    - name: gate_3
      check: "{{ output.confidence > 0.5 }}"
      message: Minimum confidence not met
      severity: warning
      on_fail: skip
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		expect(spec.quality_gates?.post_output).toHaveLength(3);
	});

	it("should handle complete workflow with all features", () => {
		const content = `---
spec_version: "1.0"
name: full-featured
description: A complete workflow demonstrating all features
reasoning:
  strategy: react
  max_iterations: 10
steps:
  initialize:
    description: Initialize workflow
    instructions: Set up initial state and context.
  gather_data:
    description: Gather required data
    needs:
      - initialize
    instructions: Collect all necessary data from sources.
  analyze_data:
    description: Analyze gathered data
    needs:
      - gather_data
    instructions: Apply analytical frameworks to the data.
    branches:
      - if: "{{ output.confidence > 0.8 }}"
        then: handle_high
      - if: "{{ output.confidence > 0.5 }}"
        then: handle_medium
      - default: true
        then: handle_low
  handle_high:
    description: Handle high confidence path
    needs:
      - analyze_data
    instructions: Proceed with high confidence result.
  handle_medium:
    description: Handle medium confidence path
    needs:
      - analyze_data
    instructions: Refine medium confidence result.
  handle_low:
    description: Handle low confidence path
    needs:
      - analyze_data
    instructions: Request additional analysis.
  synthesize:
    description: Synthesize results
    needs:
      - handle_high
      - handle_medium
      - handle_low
    instructions: Combine all results into final output.
contracts:
  inputs:
    - name: request
      type: object
      required: true
      description: Input request containing parameters
      properties:
        type:
          type: string
        priority:
          type: number
  outputs:
    - name: analysis_result
      type: object
      required: true
      description: Complete analysis result
      properties:
        findings:
          type: array
        confidence:
          type: number
        recommendations:
          type: array
quality_gates:
  post_output:
    - name: result_completeness
      check: "{{ output.analysis_result != null && output.analysis_result.findings != null }}"
      message: Result must include findings
      severity: error
      on_fail: retry
    - name: confidence_threshold
      check: "{{ output.analysis_result.confidence > 0.4 }}"
      message: Confidence must exceed minimum threshold
      severity: warning
      on_fail: skip
---`;

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);

		const spec = validated.data;
		expect(Object.keys(spec.steps || {})).toHaveLength(7);
		expect(spec.contracts?.inputs).toHaveLength(1);
		expect(spec.contracts?.outputs).toHaveLength(1);
		expect(spec.quality_gates?.post_output).toHaveLength(2);
	});

	it("should validate workflow modifications without losing data", () => {
		const original = `---
spec_version: "1.0"
name: original
description: Original workflow
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: Step 1
    instructions: Do step 1.
  step2:
    description: Step 2
    needs:
      - step1
    instructions: Do step 2.
---`;

		const modified = `---
spec_version: "1.0"
name: original
description: Updated description
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  step1:
    description: Step 1
    instructions: Do step 1.
  step2:
    description: Step 2 updated
    needs:
      - step1
    instructions: Updated step 2.
  step3:
    description: Step 3
    needs:
      - step2
    instructions: Do step 3.
---`;

		const parsedOrig = parse(original);
		expect(parsedOrig.ok).toBe(true);

		const validatedOrig = validate(original);
		expect(validatedOrig.ok).toBe(true);

		const parsedMod = parse(modified);
		expect(parsedMod.ok).toBe(true);

		const validatedMod = validate(modified);
		expect(validatedMod.ok).toBe(true);

		// Verify changes are tracked
		const origSteps = validatedOrig.data.steps;
		const modSteps = validatedMod.data.steps;

		expect(Object.keys(modSteps || {})).toHaveLength(3);
		expect(origSteps?.step2?.description).not.toBe(modSteps?.step2?.description);
	});
});
