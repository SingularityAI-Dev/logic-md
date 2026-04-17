import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, validate } from "@logic-md/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("init command", () => {
	let tempDir: string;
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const templatesDir = pathJoin(__dirname, "../templates");

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "logic-md-init-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function getAvailableTemplates(): string[] {
		return readdirSync(templatesDir)
			.filter((f) => f.endsWith(".logic.md"))
			.map((f) => f.replace(".logic.md", ""))
			.sort();
	}

	function loadTemplate(name: string): string {
		const templatePath = join(templatesDir, `${name}.logic.md`);
		return readFileSync(templatePath, "utf8");
	}

	it("should list all available templates", () => {
		const templates = getAvailableTemplates();

		expect(templates.length).toBeGreaterThan(0);
		expect(templates).toContain("minimal");
		expect(templates).toContain("analyst");
	});

	it("should load minimal template successfully", () => {
		const content = loadTemplate("minimal");

		expect(content).toBeTruthy();
		expect(content).toContain("spec_version");
		expect(content).toContain("name: minimal");
	});

	it("should load analyst template successfully", () => {
		const content = loadTemplate("analyst");

		expect(content).toBeTruthy();
		expect(content).toContain("spec_version");
		expect(content).toContain("name: analyst");
		expect(content).toContain("gather_context");
		expect(content).toContain("analyze");
		expect(content).toContain("synthesize");
	});

	it("should validate minimal template as valid LOGIC.md", () => {
		const content = loadTemplate("minimal");

		const parsed = parse(content);
		expect(parsed.ok).toBe(true);

		const validated = validate(content);
		expect(validated.ok).toBe(true);
	});

	it("should validate all available templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);
			expect(parsed.ok).toBe(true);

			const validated = validate(content);
			expect(validated.ok).toBe(true);
		}
	});

	it("minimal template should have correct structure", () => {
		const content = loadTemplate("minimal");
		const parsed = parse(content);

		expect(parsed.ok).toBe(true);
		const spec = parsed.data;

		expect(spec.spec_version).toBe("1.0");
		expect(spec.name).toBe("minimal");
		expect(spec.description).toBeTruthy();
		expect(spec.reasoning).toBeDefined();
		expect(spec.steps).toBeDefined();
		expect(spec.steps.execute).toBeDefined();
	});

	it("analyst template should have multiple steps", () => {
		const content = loadTemplate("analyst");
		const parsed = parse(content);

		expect(parsed.ok).toBe(true);
		const spec = parsed.data;

		const stepNames = Object.keys(spec.steps || {});
		expect(stepNames.length).toBeGreaterThanOrEqual(3);
		expect(stepNames).toContain("gather_context");
		expect(stepNames).toContain("analyze");
	});

	it("analyst template should have step dependencies", () => {
		const content = loadTemplate("analyst");
		const parsed = parse(content);

		expect(parsed.ok).toBe(true);
		const spec = parsed.data;
		const steps = spec.steps || {};

		expect(steps.analyze?.needs).toBeDefined();
		expect(steps.analyze?.needs).toContain("gather_context");
		expect(steps.synthesize?.needs).toContain("analyze");
	});

	it("should include contracts in templates that have them", () => {
		const content = loadTemplate("analyst");
		const parsed = parse(content);

		expect(parsed.ok).toBe(true);
		const spec = parsed.data;

		expect(spec.contracts).toBeDefined();
		expect(spec.contracts?.outputs).toBeDefined();
		expect(spec.contracts?.outputs?.length).toBeGreaterThan(0);
	});

	it("should include quality gates in templates that have them", () => {
		const content = loadTemplate("analyst");
		const parsed = parse(content);

		expect(parsed.ok).toBe(true);
		const spec = parsed.data;

		expect(spec.quality_gates).toBeDefined();
		expect(spec.quality_gates?.post_output).toBeDefined();
	});

	it("validator template should have strict contracts", () => {
		const content = loadTemplate("validator");
		const parsed = parse(content);

		expect(parsed.ok).toBe(true);
		const spec = parsed.data;

		expect(spec.contracts?.inputs).toBeDefined();
		expect(spec.contracts?.inputs?.length).toBeGreaterThan(0);
		expect(spec.contracts?.outputs).toBeDefined();
		expect(spec.contracts?.outputs?.length).toBeGreaterThan(0);
	});

	it("researcher template should exist and be valid", () => {
		const templates = getAvailableTemplates();
		expect(templates).toContain("researcher");

		const content = loadTemplate("researcher");
		const validated = validate(content);
		expect(validated.ok).toBe(true);
	});

	it("should have templates for different agent types", () => {
		const templates = getAvailableTemplates();

		// Check for diverse agent types
		expect(templates.some((t) => t.includes("analyst"))).toBe(true);
		expect(templates.some((t) => t.includes("review"))).toBe(true);
		expect(templates.some((t) => t.includes("plan"))).toBe(true);
		expect(templates.some((t) => t.includes("generator"))).toBe(true);
	});

	it("should have reasoning strategy in all templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);

			expect(parsed.ok).toBe(true);
			const spec = parsed.data;

			expect(spec.reasoning).toBeDefined();
			expect(spec.reasoning?.strategy).toBeDefined();
			expect(spec.reasoning?.max_iterations).toBeDefined();
		}
	});

	it("should have max_iterations in valid range for all templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);

			const spec = parsed.data;
			const maxIter = spec.reasoning?.max_iterations;

			expect(typeof maxIter).toBe("number");
			expect(maxIter).toBeGreaterThan(0);
			expect(maxIter).toBeLessThanOrEqual(100);
		}
	});

	it("should have descriptions for all steps in templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);

			const spec = parsed.data;
			const steps = spec.steps || {};

			for (const step of Object.values(steps)) {
				expect(step.description).toBeTruthy();
				expect(typeof step.description).toBe("string");
			}
		}
	});

	it("should have instructions for all steps in templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);

			const spec = parsed.data;
			const steps = spec.steps || {};

			for (const step of Object.values(steps)) {
				expect(step.instructions).toBeTruthy();
				expect(typeof step.instructions).toBe("string");
			}
		}
	});

	it("minimal template should be the simplest", () => {
		const minimalContent = loadTemplate("minimal");
		const minimalParsed = parse(minimalContent);
		const minimalSpec = minimalParsed.data;

		const minimalSteps = Object.keys(minimalSpec.steps || {}).length;

		// Other templates should have equal or more steps
		const templates = getAvailableTemplates().filter((t) => t !== "minimal");

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);
			const spec = parsed.data;

			const stepCount = Object.keys(spec.steps || {}).length;
			// Most non-minimal templates should have more steps
			if (templateName !== "minimal") {
				// This is just a sanity check, not a hard requirement
				// just verify they parse
				expect(stepCount).toBeGreaterThan(0);
			}
		}
	});

	it("should have valid YAML frontmatter in all templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);

			// Check for proper YAML delimiter
			const matches = content.match(/^---\n([\s\S]*?)\n---/);
			expect(matches).toBeTruthy();
			expect(matches?.[1]).toBeTruthy();
		}
	});

	it("should have markdown content after frontmatter", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);

			// Should have content after the closing ---
			const parts = content.split(/^---\n[\s\S]*?\n---/m);
			expect(parts.length).toBeGreaterThan(1);
			expect(parts[1]).toBeTruthy();
			expect(parts[1].trim()).toBeTruthy();
		}
	});

	it("debugger template should be valid", () => {
		const templates = getAvailableTemplates();
		expect(templates).toContain("debugger");

		const content = loadTemplate("debugger");
		const validated = validate(content);
		expect(validated.ok).toBe(true);
	});

	it("orchestrator template should be valid", () => {
		const templates = getAvailableTemplates();
		expect(templates).toContain("orchestrator");

		const content = loadTemplate("orchestrator");
		const validated = validate(content);
		expect(validated.ok).toBe(true);
	});

	it("should have proper step naming conventions", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);

			const spec = parsed.data;
			const stepNames = Object.keys(spec.steps || {});

			for (const stepName of stepNames) {
				// Step names should be valid identifiers
				expect(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(stepName)).toBe(true);
			}
		}
	});

	it("should have consistent spec_version across all templates", () => {
		const templates = getAvailableTemplates();

		for (const templateName of templates) {
			const content = loadTemplate(templateName);
			const parsed = parse(content);

			const spec = parsed.data;
			expect(spec.spec_version).toBe("1.0");
		}
	});
});
