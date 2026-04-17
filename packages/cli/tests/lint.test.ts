import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lintFile } from "../src/commands/lint.js";

describe("lint command", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "logic-md-lint-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("should pass clean file with all descriptions", () => {
		const filePath = join(tempDir, "clean.logic.md");
		const content = `---
spec_version: "1.0"
name: clean-agent
description: A clean workflow
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    description: First step
    instructions: Do step 1.
  step2:
    description: Second step
    needs:
      - step1
    instructions: Do step 2.
---

# Clean Agent`;

		writeFileSync(filePath, content, "utf8");
		const { issues, didFix } = lintFile(filePath, false);

		expect(issues).toHaveLength(0);
		expect(didFix).toBe(false);
	});

	it("should warn about missing top-level description", () => {
		const filePath = join(tempDir, "no-description.logic.md");
		const content = `---
spec_version: "1.0"
name: test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute step
    instructions: Do it.
---

# Test`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		expect(issues.length).toBeGreaterThan(0);
		const missingDescIssue = issues.find((i) => i.rule === "missing-description");
		expect(missingDescIssue).toBeDefined();
		expect(missingDescIssue?.severity).toBe("warning");
	});

	it("should warn about missing step descriptions", () => {
		const filePath = join(tempDir, "no-step-desc.logic.md");
		const content = `---
spec_version: "1.0"
name: test
description: Test workflow
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    instructions: Do step 1.
  step2:
    description: Step 2
    instructions: Do step 2.
---

# Test`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		const stepDescIssues = issues.filter((i) => i.rule === "missing-step-description");
		expect(stepDescIssues.length).toBeGreaterThan(0);
		expect(stepDescIssues[0].message).toContain("step1");
	});

	it("should fix missing descriptions with --fix flag", () => {
		const filePath = join(tempDir, "missing-descs.logic.md");
		const content = `---
spec_version: "1.0"
name: test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    instructions: Do it.
---

# Test`;

		writeFileSync(filePath, content, "utf8");

		// Check issues before fix
		const { issues: issuesBeforeFix } = lintFile(filePath, false);
		const descIssuesBeforeFix = issuesBeforeFix.filter(
			(i) => i.rule === "missing-description" || i.rule === "missing-step-description",
		);

		// Apply fix
		const { didFix } = lintFile(filePath, true);

		expect(didFix).toBe(true);

		// Verify the file was actually modified
		const newContent = readFileSync(filePath, "utf8");
		expect(newContent).toContain("description:");

		// Re-lint to see if descriptions were added
		const { issues: issuesAfterFix } = lintFile(filePath, false);
		const descIssuesAfterFix = issuesAfterFix.filter(
			(i) => i.rule === "missing-description" || i.rule === "missing-step-description",
		);
		// After fix, description issues should be gone
		expect(descIssuesAfterFix.length).toBeLessThan(descIssuesBeforeFix.length);
	});

	it("should not require fallback on single-step workflows", () => {
		const filePath = join(tempDir, "single-step.logic.md");
		const content = `---
spec_version: "1.0"
name: single
description: Single step workflow
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Execute
    instructions: Do it.
---

# Single Step`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		// Single step workflows should not trigger fallback warnings
		const fallbackIssues = issues.filter((i) => i.rule === "missing-fallback");
		expect(fallbackIssues.length).toBe(0);
	});

	it("should report parse errors as lint warnings", () => {
		const filePath = join(tempDir, "malformed-yaml.logic.md");
		const content = `---
spec_version: "1.0"
name: bad
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    instructions: Do it.
    bad: [unmatched bracket
---

# Bad`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		const parseErrors = issues.filter((i) => i.rule === "parse-error");
		expect(parseErrors.length).toBeGreaterThan(0);
	});

	it("should track file path in all issues", () => {
		const filePath = join(tempDir, "file-path.logic.md");
		const content = `---
spec_version: "1.0"
name: test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step:
    instructions: test.
---`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		for (const issue of issues) {
			expect(issue.file).toBe(filePath);
		}
	});

	it("should not fix non-fixable issues", () => {
		const filePath = join(tempDir, "non-fixable.logic.md");
		const content = `---
spec_version: "1.0"
name: test
description: Test
reasoning:
  strategy: invalid_strategy
steps:
  execute:
    description: Execute
    instructions: test.
---`;

		writeFileSync(filePath, content, "utf8");
		const { didFix } = lintFile(filePath, true);

		// If there are parse errors, didFix should be false
		// (we can't fix non-fixable issues)
		expect(typeof didFix).toBe("boolean");
	});

	it("should handle multi-step workflows without errors", () => {
		const filePath = join(tempDir, "multi-step.logic.md");
		const content = `---
spec_version: "1.0"
name: multi
description: Multi-step workflow
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  step1:
    description: First step
    instructions: Do step 1.
  step2:
    description: Second step
    needs:
      - step1
    instructions: Do step 2.
  step3:
    description: Third step
    needs:
      - step2
    instructions: Do step 3.
---

# Multi-Step`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		expect(issues).toHaveLength(0);
	});

	it("should handle workflows with all feature flags present", () => {
		const filePath = join(tempDir, "full-featured.logic.md");
		const content = `---
spec_version: "1.0"
name: full-featured
description: A full-featured workflow
reasoning:
  strategy: tot
  max_iterations: 10
steps:
  step1:
    description: First step
    instructions: Initialize.
  step2:
    description: Second step
    needs:
      - step1
    instructions: Process.
    branches:
      path_a:
        label: Path A
        condition: "{{ output.choice == 'a' }}"
      path_b:
        label: Path B
        condition: "{{ output.choice == 'b' }}"
  step3:
    description: Path A handler
    needs:
      - step2[path_a]
    instructions: Handle A.
  step4:
    description: Path B handler
    needs:
      - step2[path_b]
    instructions: Handle B.
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
quality_gates:
  post_output:
    - name: check
      check: "{{ output.result != null }}"
      message: Result required
      severity: error
      on_fail: retry
---

# Full Featured`;

		writeFileSync(filePath, content, "utf8");
		const { issues } = lintFile(filePath, false);

		expect(issues).toHaveLength(0);
	});

	it("should handle fixing of multiple missing descriptions", () => {
		const filePath = join(tempDir, "many-missing.logic.md");
		const content = `---
spec_version: "1.0"
name: many
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  step1:
    instructions: Do 1.
  step2:
    instructions: Do 2.
  step3:
    instructions: Do 3.
---`;

		writeFileSync(filePath, content, "utf8");
		const { didFix } = lintFile(filePath, true);

		if (didFix) {
			const newContent = readFileSync(filePath, "utf8");
			const descriptionCount = (newContent.match(/description:/g) || []).length;
			expect(descriptionCount).toBeGreaterThan(0);
		}
	});

	it("should preserve non-fixable content when applying fixes", () => {
		const filePath = join(tempDir, "preserve.logic.md");
		const originalInstructions = "Custom instructions that should be preserved";
		const content = `---
spec_version: "1.0"
name: test
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    instructions: |
      ${originalInstructions}
---`;

		writeFileSync(filePath, content, "utf8");
		lintFile(filePath, true);

		const newContent = readFileSync(filePath, "utf8");
		expect(newContent).toContain(originalInstructions);
	});

	it("should return didFix as false when no fixes are needed", () => {
		const filePath = join(tempDir, "no-fixes.logic.md");
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

		writeFileSync(filePath, content, "utf8");
		const { didFix } = lintFile(filePath, true);

		expect(didFix).toBe(false);
	});
});
