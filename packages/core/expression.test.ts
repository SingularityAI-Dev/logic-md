import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	type ASTNode,
	ExpressionError,
	evaluate,
	parse,
	TokenType,
	tokenize,
} from "./expression.js";

// =============================================================================
// Lexer Tests
// =============================================================================

describe("tokenize", () => {
	it("tokenizes integer literal", () => {
		const tokens = tokenize("42");
		expect(tokens).toEqual([
			{ type: TokenType.Number, value: "42", position: 0 },
			{ type: TokenType.EOF, value: "", position: 2 },
		]);
	});

	it("tokenizes decimal literal", () => {
		const tokens = tokenize("3.14");
		expect(tokens).toEqual([
			{ type: TokenType.Number, value: "3.14", position: 0 },
			{ type: TokenType.EOF, value: "", position: 4 },
		]);
	});

	it("tokenizes double-quoted string literal", () => {
		const tokens = tokenize('"hello"');
		expect(tokens).toEqual([
			{ type: TokenType.String, value: "hello", position: 0 },
			{ type: TokenType.EOF, value: "", position: 7 },
		]);
	});

	it("tokenizes single-quoted string literal", () => {
		const tokens = tokenize("'world'");
		expect(tokens).toEqual([
			{ type: TokenType.String, value: "world", position: 0 },
			{ type: TokenType.EOF, value: "", position: 7 },
		]);
	});

	it("tokenizes boolean true", () => {
		const tokens = tokenize("true");
		expect(tokens).toEqual([
			{ type: TokenType.Boolean, value: "true", position: 0 },
			{ type: TokenType.EOF, value: "", position: 4 },
		]);
	});

	it("tokenizes boolean false", () => {
		const tokens = tokenize("false");
		expect(tokens).toEqual([
			{ type: TokenType.Boolean, value: "false", position: 0 },
			{ type: TokenType.EOF, value: "", position: 5 },
		]);
	});

	it("tokenizes null", () => {
		const tokens = tokenize("null");
		expect(tokens).toEqual([
			{ type: TokenType.Null, value: "null", position: 0 },
			{ type: TokenType.EOF, value: "", position: 4 },
		]);
	});

	it("tokenizes identifier", () => {
		const tokens = tokenize("output");
		expect(tokens).toEqual([
			{ type: TokenType.Identifier, value: "output", position: 0 },
			{ type: TokenType.EOF, value: "", position: 6 },
		]);
	});

	it("tokenizes two-char operators", () => {
		const ops: Array<[string, TokenType]> = [
			["==", TokenType.EqualEqual],
			["!=", TokenType.BangEqual],
			["<=", TokenType.LessEqual],
			[">=", TokenType.GreaterEqual],
			["&&", TokenType.AmpAmp],
			["||", TokenType.PipePipe],
		];
		for (const [op, type] of ops) {
			const tokens = tokenize(op);
			expect(tokens[0]).toEqual({ type, value: op, position: 0 });
		}
	});

	it("tokenizes single-char operators and delimiters", () => {
		const ops: Array<[string, TokenType]> = [
			[".", TokenType.Dot],
			["<", TokenType.Less],
			[">", TokenType.Greater],
			["!", TokenType.Bang],
			["?", TokenType.Question],
			[":", TokenType.Colon],
			["(", TokenType.LeftParen],
			[")", TokenType.RightParen],
			[",", TokenType.Comma],
		];
		for (const [op, type] of ops) {
			const tokens = tokenize(op);
			expect(tokens[0]).toEqual({ type, value: op, position: 0 });
		}
	});

	it("tokenizes compound expression", () => {
		const tokens = tokenize("output.findings.length > 0");
		const types = tokens.map((t) => t.type);
		expect(types).toEqual([
			TokenType.Identifier,
			TokenType.Dot,
			TokenType.Identifier,
			TokenType.Dot,
			TokenType.Identifier,
			TokenType.Greater,
			TokenType.Number,
			TokenType.EOF,
		]);
	});

	it("throws ExpressionError on unexpected character", () => {
		expect(() => tokenize("@")).toThrow(ExpressionError);
	});

	it("skips whitespace correctly", () => {
		const tokens = tokenize("  a  ");
		expect(tokens).toEqual([
			{ type: TokenType.Identifier, value: "a", position: 2 },
			{ type: TokenType.EOF, value: "", position: 5 },
		]);
	});
});

// =============================================================================
// Parser Tests
// =============================================================================

describe("parse", () => {
	/** Helper: tokenize then parse */
	function p(input: string): ASTNode {
		return parse(tokenize(input));
	}

	it("parses number literal", () => {
		expect(p("42")).toEqual({ type: "Literal", value: 42 });
	});

	it("parses decimal number literal", () => {
		expect(p("3.14")).toEqual({ type: "Literal", value: 3.14 });
	});

	it("parses string literal", () => {
		expect(p('"hello"')).toEqual({ type: "Literal", value: "hello" });
	});

	it("parses boolean literal true", () => {
		expect(p("true")).toEqual({ type: "Literal", value: true });
	});

	it("parses boolean literal false", () => {
		expect(p("false")).toEqual({ type: "Literal", value: false });
	});

	it("parses null literal", () => {
		expect(p("null")).toEqual({ type: "Literal", value: null });
	});

	it("parses identifier", () => {
		expect(p("output")).toEqual({ type: "Identifier", name: "output" });
	});

	it("parses dot access", () => {
		expect(p("output.findings")).toEqual({
			type: "MemberExpression",
			object: { type: "Identifier", name: "output" },
			property: "findings",
		});
	});

	it("parses chained dot access", () => {
		expect(p("output.findings.length")).toEqual({
			type: "MemberExpression",
			object: {
				type: "MemberExpression",
				object: { type: "Identifier", name: "output" },
				property: "findings",
			},
			property: "length",
		});
	});

	it("parses binary expression", () => {
		expect(p("a > 0")).toEqual({
			type: "BinaryExpression",
			operator: ">",
			left: { type: "Identifier", name: "a" },
			right: { type: "Literal", value: 0 },
		});
	});

	it("parses unary expression", () => {
		expect(p("!done")).toEqual({
			type: "UnaryExpression",
			operator: "!",
			operand: { type: "Identifier", name: "done" },
		});
	});

	it("parses ternary / conditional expression", () => {
		expect(p("a ? b : c")).toEqual({
			type: "ConditionalExpression",
			test: { type: "Identifier", name: "a" },
			consequent: { type: "Identifier", name: "b" },
			alternate: { type: "Identifier", name: "c" },
		});
	});

	it("parses method call with args", () => {
		expect(p("items.contains(x)")).toEqual({
			type: "CallExpression",
			callee: { type: "Identifier", name: "items" },
			property: "contains",
			args: [{ type: "Identifier", name: "x" }],
		});
	});

	it("parses method call no args", () => {
		expect(p("items.every()")).toEqual({
			type: "CallExpression",
			callee: { type: "Identifier", name: "items" },
			property: "every",
			args: [],
		});
	});

	it("parses grouped expression for precedence override", () => {
		const ast = p("(a || b) && c");
		expect(ast).toEqual({
			type: "BinaryExpression",
			operator: "&&",
			left: {
				type: "BinaryExpression",
				operator: "||",
				left: { type: "Identifier", name: "a" },
				right: { type: "Identifier", name: "b" },
			},
			right: { type: "Identifier", name: "c" },
		});
	});

	it("respects AND > OR precedence", () => {
		// a || b && c  should parse as  a || (b && c)
		const ast = p("a || b && c");
		expect(ast).toEqual({
			type: "BinaryExpression",
			operator: "||",
			left: { type: "Identifier", name: "a" },
			right: {
				type: "BinaryExpression",
				operator: "&&",
				left: { type: "Identifier", name: "b" },
				right: { type: "Identifier", name: "c" },
			},
		});
	});

	it("respects equality > AND precedence", () => {
		// a == b && c != d  should parse as  (a == b) && (c != d)
		const ast = p("a == b && c != d");
		expect(ast).toEqual({
			type: "BinaryExpression",
			operator: "&&",
			left: {
				type: "BinaryExpression",
				operator: "==",
				left: { type: "Identifier", name: "a" },
				right: { type: "Identifier", name: "b" },
			},
			right: {
				type: "BinaryExpression",
				operator: "!=",
				left: { type: "Identifier", name: "c" },
				right: { type: "Identifier", name: "d" },
			},
		});
	});

	it("throws ExpressionError on unexpected token", () => {
		expect(() => p(")")).toThrow(ExpressionError);
	});
});

// =============================================================================
// Evaluator Tests
// =============================================================================

describe("evaluate", () => {
	// -------------------------------------------------------------------------
	// Delimiter extraction
	// -------------------------------------------------------------------------
	describe("delimiter extraction", () => {
		it("extracts and evaluates expression within {{ }}", () => {
			expect(evaluate("{{ 42 }}", {})).toBe(42);
		});

		it("handles no spaces inside delimiters", () => {
			expect(evaluate("{{true}}", {})).toBe(true);
		});

		it("handles outer whitespace around delimiters", () => {
			expect(evaluate("  {{ 1 }}  ", {})).toBe(1);
		});

		it("throws ExpressionError when missing {{ }} delimiters", () => {
			expect(() => evaluate("42", {})).toThrow(ExpressionError);
		});
	});

	// -------------------------------------------------------------------------
	// Context injection (EXPR-07)
	// -------------------------------------------------------------------------
	describe("context injection", () => {
		it("resolves a simple context variable", () => {
			expect(evaluate("{{ x }}", { x: 10 })).toBe(10);
		});

		it("resolves dot-accessed context property", () => {
			expect(evaluate("{{ output.score }}", { output: { score: 85 } })).toBe(85);
		});

		it("resolves array length via dot access", () => {
			expect(
				evaluate("{{ output.findings.length }}", {
					output: { findings: [1, 2, 3] },
				}),
			).toBe(3);
		});

		it("resolves deeply nested property", () => {
			expect(evaluate("{{ a.b.c }}", { a: { b: { c: "deep" } } })).toBe("deep");
		});

		it("returns undefined for missing intermediate property (safe navigation)", () => {
			expect(evaluate("{{ a.b.c }}", { a: {} })).toBeUndefined();
		});

		it("returns undefined for missing root property (safe navigation)", () => {
			expect(evaluate("{{ a.b.c }}", {})).toBeUndefined();
		});

		it("resolves steps context variable", () => {
			expect(
				evaluate("{{ steps.analyze.output }}", {
					steps: { analyze: { output: "done" } },
				}),
			).toBe("done");
		});
	});

	// -------------------------------------------------------------------------
	// Comparison operators (EXPR-03)
	// -------------------------------------------------------------------------
	describe("comparison operators", () => {
		it("== returns true for equal numbers", () => {
			expect(evaluate("{{ 5 == 5 }}", {})).toBe(true);
		});

		it("!= returns true for different numbers", () => {
			expect(evaluate("{{ 5 != 3 }}", {})).toBe(true);
		});

		it("> returns true when left is greater", () => {
			expect(evaluate("{{ 10 > 5 }}", {})).toBe(true);
		});

		it("< returns true when left is less", () => {
			expect(evaluate("{{ 3 < 7 }}", {})).toBe(true);
		});

		it("<= returns true for equal values", () => {
			expect(evaluate("{{ 5 <= 5 }}", {})).toBe(true);
		});

		it(">= returns false when left is less", () => {
			expect(evaluate("{{ 5 >= 6 }}", {})).toBe(false);
		});

		it("== works for string comparison", () => {
			expect(evaluate('{{ "hello" == "hello" }}', {})).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Logical operators (EXPR-04)
	// -------------------------------------------------------------------------
	describe("logical operators", () => {
		it("&& returns true when both true", () => {
			expect(evaluate("{{ true && true }}", {})).toBe(true);
		});

		it("&& returns false when right is false", () => {
			expect(evaluate("{{ true && false }}", {})).toBe(false);
		});

		it("|| returns true when right is true", () => {
			expect(evaluate("{{ false || true }}", {})).toBe(true);
		});

		it("|| returns false when both false", () => {
			expect(evaluate("{{ false || false }}", {})).toBe(false);
		});

		it("! negates true to false", () => {
			expect(evaluate("{{ !true }}", {})).toBe(false);
		});

		it("! negates false to true", () => {
			expect(evaluate("{{ !false }}", {})).toBe(true);
		});

		it("&& short-circuits on false (does not evaluate right side)", () => {
			// x is undefined so x.y.z would throw if evaluated
			expect(evaluate("{{ false && x.y.z }}", {})).toBe(false);
		});

		it("|| short-circuits on true (does not evaluate right side)", () => {
			// x is undefined so x.y.z would throw if evaluated
			expect(evaluate("{{ true || x.y.z }}", {})).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Ternary (EXPR-06)
	// -------------------------------------------------------------------------
	describe("ternary expressions", () => {
		it("evaluates consequent when test is true", () => {
			expect(evaluate('{{ true ? "yes" : "no" }}', {})).toBe("yes");
		});

		it("evaluates alternate when test is false", () => {
			expect(evaluate('{{ false ? "yes" : "no" }}', {})).toBe("no");
		});

		it("evaluates ternary with context variable comparison", () => {
			expect(evaluate('{{ x > 5 ? "high" : "low" }}', { x: 10 })).toBe("high");
		});
	});

	// -------------------------------------------------------------------------
	// Array methods (EXPR-05)
	// -------------------------------------------------------------------------
	describe("array methods", () => {
		it(".length returns array length", () => {
			expect(evaluate("{{ items.length }}", { items: [1, 2, 3] })).toBe(3);
		});

		it(".contains() returns true when array includes value", () => {
			expect(evaluate('{{ items.contains("a") }}', { items: ["a", "b"] })).toBe(true);
		});

		it(".contains() returns false when array does not include value", () => {
			expect(evaluate('{{ items.contains("z") }}', { items: ["a", "b"] })).toBe(false);
		});

		it(".every() no args returns true when all elements truthy", () => {
			expect(evaluate("{{ items.every() }}", { items: [1, true, "x"] })).toBe(true);
		});

		it(".every() no args returns false when any element falsy", () => {
			expect(evaluate("{{ items.every() }}", { items: [1, 0, "x"] })).toBe(false);
		});

		it(".some() no args returns true when any element truthy", () => {
			expect(evaluate("{{ items.some() }}", { items: [0, false, 1] })).toBe(true);
		});

		it(".some() no args returns false when all elements falsy", () => {
			expect(evaluate("{{ items.some() }}", { items: [0, false, null] })).toBe(false);
		});

		it(".every(prop) checks named property on each element - all true", () => {
			expect(
				evaluate('{{ items.every("valid") }}', {
					items: [{ valid: true }, { valid: true }],
				}),
			).toBe(true);
		});

		it(".every(prop) checks named property on each element - one false", () => {
			expect(
				evaluate('{{ items.every("valid") }}', {
					items: [{ valid: true }, { valid: false }],
				}),
			).toBe(false);
		});

		it(".some(prop) checks named property on each element", () => {
			expect(
				evaluate('{{ items.some("active") }}', {
					items: [{ active: false }, { active: true }],
				}),
			).toBe(true);
		});

		it("throws ExpressionError when calling method on non-array", () => {
			expect(() => evaluate('{{ items.contains("a") }}', { items: "not-an-array" })).toThrow(
				ExpressionError,
			);
		});
	});

	// -------------------------------------------------------------------------
	// Complex expressions
	// -------------------------------------------------------------------------
	describe("complex expressions", () => {
		it("evaluates combined comparison with logical AND", () => {
			expect(
				evaluate("{{ output.findings.length > 0 && output.score >= 80 }}", {
					output: { findings: [1, 2], score: 90 },
				}),
			).toBe(true);
		});

		it("evaluates contains inside ternary", () => {
			expect(
				evaluate('{{ items.contains("critical") ? "block" : "pass" }}', {
					items: ["critical", "warning"],
				}),
			).toBe("block");
		});
	});
});

// =============================================================================
// Integration Tests -- LOGIC.md Expressions
// =============================================================================

describe("integration -- LOGIC.md expressions", () => {
	it("quality gate check: findings.length > 0", () => {
		const result = evaluate("{{ output.findings.length > 0 }}", {
			output: { findings: ["issue1", "issue2"] },
		});
		expect(result).toBe(true);
	});

	it("step verification: confidence >= 0.8", () => {
		const result = evaluate("{{ steps.analyze.output.confidence >= 0.8 }}", {
			steps: { analyze: { output: { confidence: 0.92 } } },
		});
		expect(result).toBe(true);
	});

	it("branch condition: risk_level == high AND findings > 3", () => {
		const result = evaluate('{{ output.risk_level == "high" && output.findings.length > 3 }}', {
			output: { risk_level: "high", findings: [1, 2, 3, 4] },
		});
		expect(result).toBe(true);
	});

	it("ternary routing: score-based pass/review", () => {
		const result = evaluate('{{ output.score > 80 ? "pass" : "review" }}', {
			output: { score: 65 },
		});
		expect(result).toBe("review");
	});

	it("array contains check: tags contain critical", () => {
		const result = evaluate('{{ output.tags.contains("critical") }}', {
			output: { tags: ["warning", "critical", "info"] },
		});
		expect(result).toBe(true);
	});

	it("every with property: all checks passed", () => {
		const result = evaluate('{{ steps.validate.output.checks.every("passed") }}', {
			steps: {
				validate: {
					output: { checks: [{ passed: true }, { passed: true }] },
				},
			},
		});
		expect(result).toBe(true);
	});

	it("some with property: any result has error", () => {
		const result = evaluate('{{ output.results.some("hasError") }}', {
			output: { results: [{ hasError: false }, { hasError: true }] },
		});
		expect(result).toBe(true);
	});

	it("negation: not approved", () => {
		const result = evaluate("{{ !output.approved }}", {
			output: { approved: false },
		});
		expect(result).toBe(true);
	});

	it("complex combined: findings exist OR not approved", () => {
		const result = evaluate("{{ output.findings.length > 0 || !steps.review.output.approved }}", {
			output: { findings: ["a"] },
			steps: { review: { output: { approved: true } } },
		});
		expect(result).toBe(true);
	});

	it("escalation trigger: low confidence", () => {
		const result = evaluate("{{ steps.analyze.output.confidence < 0.5 }}", {
			steps: { analyze: { output: { confidence: 0.3 } } },
		});
		expect(result).toBe(true);
	});
});

// =============================================================================
// Security: No eval() or Function constructor
// =============================================================================

// =============================================================================
// Coverage Gap Tests
// =============================================================================

describe("coverage gap tests", () => {
	it("ExpressionError stores position parameter", () => {
		const err = new ExpressionError("test error", 42);
		expect(err.position).toBe(42);
		expect(err.message).toBe("test error");
		expect(err.name).toBe("ExpressionError");
	});

	it("ExpressionError without position has undefined position", () => {
		const err = new ExpressionError("test error");
		expect(err.position).toBeUndefined();
	});

	it("tokenize throws on unterminated double-quoted string literal", () => {
		expect(() => tokenize('"unterminated')).toThrow(ExpressionError);
		expect(() => tokenize('"unterminated')).toThrow(/Unterminated string/);
	});

	it("tokenize throws on unterminated single-quoted string literal", () => {
		expect(() => tokenize("'unterminated")).toThrow(ExpressionError);
		expect(() => tokenize("'unterminated")).toThrow(/Unterminated string/);
	});

	it("parse throws on unexpected infix token", () => {
		// Create a scenario where parseInfix hits the default case.
		// A comma token after an identifier is not a valid infix operator.
		expect(() => parse(tokenize("a,b"))).toThrow(ExpressionError);
		expect(() => parse(tokenize("a,b"))).toThrow(/Unexpected/);
	});

	it("parse throws on trailing tokens after complete expression", () => {
		// Two identifiers in a row: "a b" -- after parsing "a", "b" is unexpected.
		expect(() => parse(tokenize("a b"))).toThrow(ExpressionError);
		expect(() => parse(tokenize("a b"))).toThrow(/Unexpected token after expression/);
	});

	it("evaluate throws on unknown method call", () => {
		expect(() => evaluate("{{ items.map() }}", { items: [1, 2, 3] })).toThrow(ExpressionError);
		expect(() => evaluate("{{ items.map() }}", { items: [1, 2, 3] })).toThrow(/Unknown method/);
	});

	it("evaluate throws on calling method on non-array (contains)", () => {
		expect(() => evaluate('{{ x.contains("a") }}', { x: "string" })).toThrow(ExpressionError);
		expect(() => evaluate('{{ x.contains("a") }}', { x: "string" })).toThrow(/non-array/);
	});

	it("evaluate handles safe navigation returning undefined for null member access", () => {
		expect(evaluate("{{ x.y }}", { x: null })).toBeUndefined();
		expect(evaluate("{{ x.y }}", { x: undefined })).toBeUndefined();
	});
});

describe("security -- no eval or Function constructor", () => {
	it("expression.ts does not contain eval() or new Function", () => {
		const source = readFileSync(new URL("./expression.ts", import.meta.url), "utf-8");
		// Strip comments before checking -- comments may mention eval/Function
		const stripped = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
		expect(stripped).not.toMatch(/\beval\s*\(/);
		expect(stripped).not.toMatch(/new\s+Function\s*\(/);
	});
});
