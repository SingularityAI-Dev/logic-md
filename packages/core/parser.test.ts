import { describe, expect, it } from "vitest";
import { parse, type ParseResult } from "./parser.js";

describe("parse()", () => {
	describe("valid input", () => {
		it("returns ok:true with typed data for valid frontmatter", () => {
			const input = `---\nspec_version: "1.0"\nname: test\n---\nSome markdown body`;
			const result: ParseResult = parse(input);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.spec_version).toBe("1.0");
				expect(result.data.name).toBe("test");
				expect(result.content).toBe("Some markdown body");
			}
		});

		it("returns ok:true with nested reasoning and steps objects", () => {
			const input = [
				"---",
				'spec_version: "1.0"',
				"name: complex-test",
				"reasoning:",
				"  strategy: cot",
				"  max_iterations: 5",
				"steps:",
				"  analyze:",
				'    description: "Analyze the input"',
				"    needs: []",
				"---",
				"Body content here",
			].join("\n");

			const result: ParseResult = parse(input);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.reasoning).toEqual({
					strategy: "cot",
					max_iterations: 5,
				});
				expect(result.data.steps).toEqual({
					analyze: {
						description: "Analyze the input",
						needs: [],
					},
				});
			}
		});

		it("returns ok:true with empty data for empty frontmatter", () => {
			const input = "---\n---\nContent";
			const result: ParseResult = parse(input);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data).toEqual({});
				expect(result.content).toBe("Content");
			}
		});

		it("content field does not include --- delimiters or YAML", () => {
			const input = `---\nspec_version: "1.0"\nname: test\n---\nMarkdown only`;
			const result: ParseResult = parse(input);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.content).not.toContain("---");
				expect(result.content).not.toContain("spec_version");
				expect(result.content).toBe("Markdown only");
			}
		});
	});

	describe("edge cases", () => {
		it("returns ok:false for empty string input", () => {
			const result: ParseResult = parse("");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors).toHaveLength(1);
				expect(result.errors[0].message).toEqual(
					expect.stringContaining("empty"),
				);
			}
		});

		it("returns ok:false for whitespace-only input", () => {
			const result: ParseResult = parse("   \n\t\n  ");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors.length).toBeGreaterThanOrEqual(1);
			}
		});

		it("returns ok:false when no frontmatter delimiters present", () => {
			const result: ParseResult = parse("Just markdown");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0].message).toEqual(
					expect.stringContaining("---"),
				);
			}
		});

		it("returns ok:false with line/column info for invalid YAML", () => {
			const input = "---\n: [broken\n---\n";
			const result: ParseResult = parse(input);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0].line).toBeDefined();
			}
		});

		it("returns ok:false for missing closing delimiter (not a thrown exception)", () => {
			const input = "---\nname: test\nNo closing";
			const result: ParseResult = parse(input);

			expect(result.ok).toBe(false);
		});
	});
});
