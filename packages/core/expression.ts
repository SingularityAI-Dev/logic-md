// =============================================================================
// Expression Engine: Lexer + Pratt Parser
// =============================================================================
// Converts expression strings into a typed AST.
// Pipeline: tokenize(input) -> Token[] -> parse(tokens) -> ASTNode
// No eval() or Function constructor -- custom recursive descent Pratt parser.
// =============================================================================

const MAX_AST_DEPTH = 50;

// -----------------------------------------------------------------------------
// ExpressionError
// -----------------------------------------------------------------------------

export class ExpressionError extends Error {
	readonly position?: number;

	constructor(message: string, position?: number) {
		super(message);
		this.name = "ExpressionError";
		this.position = position;
	}
}

// -----------------------------------------------------------------------------
// Token Types & Token
// -----------------------------------------------------------------------------

export enum TokenType {
	Number = "Number",
	String = "String",
	Boolean = "Boolean",
	Null = "Null",
	Identifier = "Identifier",
	Dot = "Dot",
	EqualEqual = "EqualEqual",
	BangEqual = "BangEqual",
	Less = "Less",
	Greater = "Greater",
	LessEqual = "LessEqual",
	GreaterEqual = "GreaterEqual",
	AmpAmp = "AmpAmp",
	PipePipe = "PipePipe",
	Bang = "Bang",
	Question = "Question",
	Colon = "Colon",
	LeftParen = "LeftParen",
	RightParen = "RightParen",
	Comma = "Comma",
	EOF = "EOF",
}

export interface Token {
	type: TokenType;
	value: string;
	position: number;
}

// -----------------------------------------------------------------------------
// AST Node Types (discriminated union)
// -----------------------------------------------------------------------------

export interface LiteralNode {
	type: "Literal";
	value: unknown;
}

export interface IdentifierNode {
	type: "Identifier";
	name: string;
}

export interface MemberExpressionNode {
	type: "MemberExpression";
	object: ASTNode;
	property: string;
}

export interface BinaryExpressionNode {
	type: "BinaryExpression";
	operator: string;
	left: ASTNode;
	right: ASTNode;
}

export interface UnaryExpressionNode {
	type: "UnaryExpression";
	operator: string;
	operand: ASTNode;
}

export interface ConditionalExpressionNode {
	type: "ConditionalExpression";
	test: ASTNode;
	consequent: ASTNode;
	alternate: ASTNode;
}

export interface CallExpressionNode {
	type: "CallExpression";
	callee: ASTNode;
	property: string;
	args: ASTNode[];
}

export type ASTNode =
	| LiteralNode
	| IdentifierNode
	| MemberExpressionNode
	| BinaryExpressionNode
	| UnaryExpressionNode
	| ConditionalExpressionNode
	| CallExpressionNode;

// -----------------------------------------------------------------------------
// Precedence Levels
// -----------------------------------------------------------------------------

enum Precedence {
	None = 0,
	Ternary = 1,
	Or = 2,
	And = 3,
	Equality = 4,
	Comparison = 5,
	Unary = 6,
	Call = 7,
	Member = 8,
}

function getInfixPrecedence(type: TokenType): Precedence {
	switch (type) {
		case TokenType.Question:
			return Precedence.Ternary;
		case TokenType.PipePipe:
			return Precedence.Or;
		case TokenType.AmpAmp:
			return Precedence.And;
		case TokenType.EqualEqual:
		case TokenType.BangEqual:
			return Precedence.Equality;
		case TokenType.Less:
		case TokenType.Greater:
		case TokenType.LessEqual:
		case TokenType.GreaterEqual:
			return Precedence.Comparison;
		case TokenType.Dot:
			return Precedence.Member;
		default:
			return Precedence.None;
	}
}

// -----------------------------------------------------------------------------
// Lexer
// -----------------------------------------------------------------------------

function isDigit(ch: string): boolean {
	return ch >= "0" && ch <= "9";
}

function isAlpha(ch: string): boolean {
	return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isAlphaNumeric(ch: string): boolean {
	return isAlpha(ch) || isDigit(ch);
}

export function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;

	while (pos < input.length) {
		const ch = input[pos]!;

		// Skip whitespace
		if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
			pos++;
			continue;
		}

		// Two-character operators (check before single-char)
		if (pos + 1 < input.length) {
			const two = `${input[pos]!}${input[pos + 1]!}`;
			let twoCharType: TokenType | undefined;
			switch (two) {
				case "==":
					twoCharType = TokenType.EqualEqual;
					break;
				case "!=":
					twoCharType = TokenType.BangEqual;
					break;
				case "<=":
					twoCharType = TokenType.LessEqual;
					break;
				case ">=":
					twoCharType = TokenType.GreaterEqual;
					break;
				case "&&":
					twoCharType = TokenType.AmpAmp;
					break;
				case "||":
					twoCharType = TokenType.PipePipe;
					break;
			}
			if (twoCharType !== undefined) {
				tokens.push({ type: twoCharType, value: two, position: pos });
				pos += 2;
				continue;
			}
		}

		// Single-character operators and delimiters
		let singleType: TokenType | undefined;
		switch (ch) {
			case ".":
				singleType = TokenType.Dot;
				break;
			case "<":
				singleType = TokenType.Less;
				break;
			case ">":
				singleType = TokenType.Greater;
				break;
			case "!":
				singleType = TokenType.Bang;
				break;
			case "?":
				singleType = TokenType.Question;
				break;
			case ":":
				singleType = TokenType.Colon;
				break;
			case "(":
				singleType = TokenType.LeftParen;
				break;
			case ")":
				singleType = TokenType.RightParen;
				break;
			case ",":
				singleType = TokenType.Comma;
				break;
		}
		if (singleType !== undefined) {
			tokens.push({ type: singleType, value: ch, position: pos });
			pos++;
			continue;
		}

		// Number literals
		if (isDigit(ch)) {
			const start = pos;
			while (pos < input.length && isDigit(input[pos]!)) {
				pos++;
			}
			if (pos < input.length && input[pos]! === ".") {
				pos++;
				while (pos < input.length && isDigit(input[pos]!)) {
					pos++;
				}
			}
			tokens.push({
				type: TokenType.Number,
				value: input.slice(start, pos),
				position: start,
			});
			continue;
		}

		// String literals
		if (ch === '"' || ch === "'") {
			const quote = ch;
			const start = pos;
			pos++; // skip opening quote
			const strStart = pos;
			while (pos < input.length && input[pos]! !== quote) {
				pos++;
			}
			if (pos >= input.length) {
				throw new ExpressionError(`Unterminated string literal`, start);
			}
			const value = input.slice(strStart, pos);
			pos++; // skip closing quote
			tokens.push({ type: TokenType.String, value, position: start });
			continue;
		}

		// Identifiers and keywords
		if (isAlpha(ch)) {
			const start = pos;
			while (pos < input.length && isAlphaNumeric(input[pos]!)) {
				pos++;
			}
			const word = input.slice(start, pos);
			if (word === "true" || word === "false") {
				tokens.push({ type: TokenType.Boolean, value: word, position: start });
			} else if (word === "null") {
				tokens.push({ type: TokenType.Null, value: word, position: start });
			} else {
				tokens.push({
					type: TokenType.Identifier,
					value: word,
					position: start,
				});
			}
			continue;
		}

		throw new ExpressionError(`Unexpected character: ${ch}`, pos);
	}

	tokens.push({ type: TokenType.EOF, value: "", position: pos });
	return tokens;
}

// -----------------------------------------------------------------------------
// Pratt Parser
// -----------------------------------------------------------------------------

export function parse(tokens: Token[]): ASTNode {
	let pos = 0;
	let depth = 0;

	function peek(): Token {
		const token = tokens[pos];
		if (!token) {
			throw new ExpressionError("Unexpected end of expression");
		}
		return token;
	}

	function advance(): Token {
		const token = peek();
		pos++;
		return token;
	}

	function expect(type: TokenType): Token {
		const token = peek();
		if (token.type !== type) {
			throw new ExpressionError(`Expected ${type} but got ${token.type}`, token.position);
		}
		return advance();
	}

	function parseExpression(precedence: Precedence): ASTNode {
		depth++;
		if (depth > MAX_AST_DEPTH) {
			throw new ExpressionError("Expression too deeply nested");
		}

		let left = parsePrefix();

		while (precedence < getInfixPrecedence(peek().type)) {
			left = parseInfix(left);
		}

		depth--;
		return left;
	}

	function parsePrefix(): ASTNode {
		const token = advance();

		switch (token.type) {
			case TokenType.Number:
				return { type: "Literal", value: Number(token.value) };

			case TokenType.String:
				return { type: "Literal", value: token.value };

			case TokenType.Boolean:
				return { type: "Literal", value: token.value === "true" };

			case TokenType.Null:
				return { type: "Literal", value: null };

			case TokenType.Identifier:
				return { type: "Identifier", name: token.value };

			case TokenType.Bang: {
				const operand = parseExpression(Precedence.Unary);
				return { type: "UnaryExpression", operator: "!", operand };
			}

			case TokenType.LeftParen: {
				const expr = parseExpression(Precedence.None);
				expect(TokenType.RightParen);
				return expr;
			}

			default:
				throw new ExpressionError(`Unexpected token: ${token.type}`, token.position);
		}
	}

	function parseInfix(left: ASTNode): ASTNode {
		const token = peek();

		switch (token.type) {
			case TokenType.EqualEqual:
			case TokenType.BangEqual:
			case TokenType.Less:
			case TokenType.Greater:
			case TokenType.LessEqual:
			case TokenType.GreaterEqual:
			case TokenType.AmpAmp:
			case TokenType.PipePipe: {
				const prec = getInfixPrecedence(token.type);
				advance();
				const right = parseExpression(prec);
				return {
					type: "BinaryExpression",
					operator: token.value,
					left,
					right,
				};
			}

			case TokenType.Dot: {
				advance(); // consume dot
				const propToken = expect(TokenType.Identifier);

				// Check if this is a method call: identifier followed by LeftParen
				if (peek().type === TokenType.LeftParen) {
					advance(); // consume '('
					const args: ASTNode[] = [];
					if (peek().type !== TokenType.RightParen) {
						args.push(parseExpression(Precedence.None));
						while (peek().type === TokenType.Comma) {
							advance(); // consume ','
							args.push(parseExpression(Precedence.None));
						}
					}
					expect(TokenType.RightParen);
					return {
						type: "CallExpression",
						callee: left,
						property: propToken.value,
						args,
					};
				}

				return {
					type: "MemberExpression",
					object: left,
					property: propToken.value,
				};
			}

			case TokenType.Question: {
				advance(); // consume '?'
				const consequent = parseExpression(Precedence.None);
				expect(TokenType.Colon);
				const alternate = parseExpression(Precedence.Ternary);
				return {
					type: "ConditionalExpression",
					test: left,
					consequent,
					alternate,
				};
			}

			default:
				throw new ExpressionError(`Unexpected infix token: ${token.type}`, token.position);
		}
	}

	const result = parseExpression(Precedence.None);

	if (peek().type !== TokenType.EOF) {
		throw new ExpressionError(`Unexpected token after expression: ${peek().type}`, peek().position);
	}

	return result;
}

// -----------------------------------------------------------------------------
// Expression Context
// -----------------------------------------------------------------------------

export type ExpressionContext = Record<string, unknown>;

// -----------------------------------------------------------------------------
// Delimiter Extraction
// -----------------------------------------------------------------------------

function extractExpression(template: string): string {
	const trimmed = template.trim();
	if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
		throw new ExpressionError("Expression must be wrapped in {{ }} delimiters");
	}
	return trimmed.slice(2, -2).trim();
}

// -----------------------------------------------------------------------------
// Tree-Walk Evaluator
// -----------------------------------------------------------------------------

function evaluateNode(node: ASTNode, context: ExpressionContext): unknown {
	switch (node.type) {
		case "Literal":
			return node.value;

		case "Identifier":
			return context[node.name];

		case "MemberExpression": {
			const obj = evaluateNode(node.object, context);
			if (obj === null || obj === undefined) {
				return undefined;
			}
			return (obj as Record<string, unknown>)[node.property];
		}

		case "BinaryExpression": {
			// Short-circuit for logical operators
			if (node.operator === "&&") {
				const leftVal = evaluateNode(node.left, context);
				if (!leftVal) return leftVal;
				return evaluateNode(node.right, context);
			}
			if (node.operator === "||") {
				const leftVal = evaluateNode(node.left, context);
				if (leftVal) return leftVal;
				return evaluateNode(node.right, context);
			}

			const left = evaluateNode(node.left, context);
			const right = evaluateNode(node.right, context);

			switch (node.operator) {
				case "==":
					return left == right;
				case "!=":
					return left != right;
				case "<":
					return (left as number) < (right as number);
				case ">":
					return (left as number) > (right as number);
				case "<=":
					return (left as number) <= (right as number);
				case ">=":
					return (left as number) >= (right as number);
				default:
					throw new ExpressionError(`Unknown operator: ${node.operator}`);
			}
		}

		case "UnaryExpression": {
			const operand = evaluateNode(node.operand, context);
			if (node.operator === "!") {
				return !operand;
			}
			throw new ExpressionError(`Unknown unary operator: ${node.operator}`);
		}

		case "ConditionalExpression": {
			const test = evaluateNode(node.test, context);
			return test ? evaluateNode(node.consequent, context) : evaluateNode(node.alternate, context);
		}

		case "CallExpression": {
			const target = evaluateNode(node.callee, context);
			if (!Array.isArray(target)) {
				throw new ExpressionError(`Cannot call .${node.property}() on non-array value`);
			}

			const evaluatedArgs = node.args.map((arg) => evaluateNode(arg, context));

			switch (node.property) {
				case "contains":
					return target.includes(evaluatedArgs[0]);

				case "every": {
					if (evaluatedArgs.length === 0) {
						return target.every(Boolean);
					}
					const propName = evaluatedArgs[0] as string;
					return target.every((item) => (item as Record<string, unknown>)[propName]);
				}

				case "some": {
					if (evaluatedArgs.length === 0) {
						return target.some(Boolean);
					}
					const propName = evaluatedArgs[0] as string;
					return target.some((item) => (item as Record<string, unknown>)[propName]);
				}

				default:
					throw new ExpressionError(`Unknown method: .${node.property}()`);
			}
		}
	}
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Soft cap on the number of cached ASTs. When exceeded, the least-recently-used
 * entry is evicted. Templates are reused verbatim rarely enough that a workflow
 * never approaches this; the cap only bounds memory for pathological callers.
 */
const AST_CACHE_CAP = 1000;

/**
 * Module-level cache of parsed ASTs keyed on the raw template string.
 *
 * The expression engine is pure (no eval/Function, and evaluateNode never
 * mutates the AST), so a parsed AST is valid forever and safe to share across
 * calls and contexts. Map insertion order gives us LRU for free: a cache hit
 * re-inserts the key (now most-recently-used), and eviction removes the first
 * (oldest) key.
 */
const astCache = new Map<string, ASTNode>();

/**
 * Resolve the AST for a template, parsing and caching on a miss. Only
 * successful parses are cached; a malformed template re-throws on every call,
 * identical to the uncached behaviour.
 */
function getCachedAst(template: string): ASTNode {
	const cached = astCache.get(template);
	if (cached !== undefined) {
		// Mark as most-recently-used.
		astCache.delete(template);
		astCache.set(template, cached);
		return cached;
	}

	const expr = extractExpression(template);
	const tokens = tokenize(expr);
	const ast = parse(tokens);

	if (astCache.size >= AST_CACHE_CAP) {
		const oldest = astCache.keys().next().value;
		if (oldest !== undefined) {
			astCache.delete(oldest);
		}
	}
	astCache.set(template, ast);
	return ast;
}

/** Clear the AST cache. Primarily for tests and memory-sensitive callers. */
export function clearExpressionCache(): void {
	astCache.clear();
}

/** Current number of cached ASTs. Primarily for tests and diagnostics. */
export function expressionCacheSize(): number {
	return astCache.size;
}

/**
 * Whether a template's AST is currently cached. Does not affect LRU recency
 * (a pure read). Primarily for tests and diagnostics.
 */
export function expressionCacheHas(template: string): boolean {
	return astCache.has(template);
}

export function evaluate(template: string, context: ExpressionContext): unknown {
	return evaluateNode(getCachedAst(template), context);
}
