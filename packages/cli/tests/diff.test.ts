import { parse, validate } from "@logic-md/core";
import diff from "microdiff";
import { describe, expect, it } from "vitest";

describe("diff command", () => {
	function parseAndValidate(content: string) {
		const parsed = parse(content);
		if (!parsed.ok) return null;

		const validated = validate(content);
		if (!validated.ok) return null;

		return validated.data;
	}

	it("should detect changes in name field", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: old-name
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: new-name
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`);

		expect(v1).toBeTruthy();
		expect(v2).toBeTruthy();

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
		expect(changes.some((c) => c.path.includes("name"))).toBe(true);
	});

	it("should detect changes in description", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Old description
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: New description
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
		expect(changes.some((c) => c.path.includes("description"))).toBe(true);
	});

	it("should detect changes in reasoning strategy", () => {
		const v1 = parseAndValidate(`---
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
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: react
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---`);

		const changes = diff(v1, v2);
		expect(changes.some((c) => c.path.includes("strategy"))).toBe(true);
	});

	it("should detect changes in max_iterations", () => {
		const v1 = parseAndValidate(`---
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
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 10
steps:
  execute:
    description: Execute
    instructions: Do it.
---`);

		const changes = diff(v1, v2);
		expect(changes.some((c) => c.path.includes("max_iterations"))).toBe(true);
	});

	it("should detect added steps", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: Step 1
    instructions: Do 1.
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
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
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
		expect(changes.some((c) => c.type === "CREATE")).toBe(true);
	});

	it("should detect removed steps", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
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
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: Step 1
    instructions: Do 1.
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
		expect(changes.some((c) => c.type === "REMOVE")).toBe(true);
	});

	it("should detect modified step descriptions", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Old description
    instructions: Do it.
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: New description
    instructions: Do it.
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
	});

	it("should detect modified step instructions", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Original instructions.
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Updated instructions.
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
	});

	it("should detect changes in step dependencies", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
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
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: test
description: Test
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
      - step1
      - step2
    instructions: Do 3.
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
	});

	it("should detect added contracts", () => {
		const v1 = parseAndValidate(`---
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
---`);

		const v2 = parseAndValidate(`---
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
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: Input
---`);

		const changes = diff(v1, v2);
		expect(changes.some((c) => c.type === "CREATE")).toBe(true);
	});

	it("should detect removed contracts", () => {
		const v1 = parseAndValidate(`---
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
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: Input
---`);

		const v2 = parseAndValidate(`---
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
---`);

		const changes = diff(v1, v2);
		expect(changes.some((c) => c.type === "REMOVE")).toBe(true);
	});

	it("should detect changes in contract properties", () => {
		const v1 = parseAndValidate(`---
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
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: Input
---`);

		const v2 = parseAndValidate(`---
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
contracts:
  inputs:
    - name: data
      type: string
      required: false
      description: Input data
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(0);
	});

	it("should detect added quality gates", () => {
		const v1 = parseAndValidate(`---
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
---`);

		const v2 = parseAndValidate(`---
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
quality_gates:
  post_output:
    - name: check
      check: "{{ output != null }}"
      message: Output required
      severity: error
      on_fail: retry
---`);

		const changes = diff(v1, v2);
		expect(changes.some((c) => c.type === "CREATE")).toBe(true);
	});

	it("should detect added branches", () => {
		const v1 = parseAndValidate(`---
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
---`);

		const v2 = parseAndValidate(`---
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
    branches:
      - if: "{{ output.success }}"
        then: success_step
      - if: "{{ !output.success }}"
        then: failure_step
---`);

		const changes = diff(v1, v2);
		expect(changes.some((c) => c.type === "CREATE")).toBe(true);
	});

	it("should detect no changes when specs are identical", () => {
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

		const v1 = parseAndValidate(content);
		const v2 = parseAndValidate(content);

		const changes = diff(v1, v2);
		expect(changes).toHaveLength(0);
	});

	it("should handle complex multi-step changes", () => {
		const v1 = parseAndValidate(`---
spec_version: "1.0"
name: old
description: Old workflow
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
---`);

		const v2 = parseAndValidate(`---
spec_version: "1.0"
name: new
description: New workflow
reasoning:
  strategy: react
  max_iterations: 8
steps:
  step1:
    description: Updated Step 1
    instructions: Do 1 updated.
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
---`);

		const changes = diff(v1, v2);
		expect(changes.length).toBeGreaterThan(1);
	});
});
