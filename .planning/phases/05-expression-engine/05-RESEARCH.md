# Phase 5: Expression Engine - Research

**Researched:** 2026-03-31
**Domain:** Custom expression parser/evaluator (lexer + Pratt parser + tree-walk evaluator)
**Confidence:** HIGH

## Summary

Phase 5 implements a safe, custom expression engine that parses `{{ }}` template expressions and evaluates them against an injected context object. The core constraint -- no `eval()` or `Function` constructor -- means building a proper lexer, parser, and evaluator from scratch. This is a well-understood computer science problem with established patterns.

The recommended approach is a **Pratt parser** (also called "top-down operator precedence" parser). Pratt parsing is the industry-standard technique for expression languages: it handles operator precedence and associativity elegantly, supports extension via a rule table, and produces a clean AST that can be tree-walked for evaluation. This is the same technique used by V8, Babel, TypeScript itself, and countless expression languages.

**Primary recommendation:** Implement a 3-stage pipeline: Lexer (string to tokens) -> Pratt Parser (tokens to AST) -> Tree-walk Evaluator (AST + context to value). Zero dependencies. All in a single `expression.ts` module with supporting types.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPR-01 | Parse and evaluate `{{ }}` template expressions | Delimiter extraction + Pratt parser pipeline |
| EXPR-02 | Support dot notation for nested property access | MemberExpression AST node with recursive property resolution |
| EXPR-03 | Support comparison operators (==, !=, <, >, <=, >=) | Binary operator precedence level in Pratt table |
| EXPR-04 | Support logical operators (&&, \|\|, !) | Binary/unary operator precedence levels; short-circuit evaluation |
| EXPR-05 | Support array methods (.length, .every(), .some(), .contains()) | CallExpression AST node with allowlisted method dispatch |
| EXPR-06 | Support ternary expressions (condition ? a : b) | Ternary as infix operator in Pratt table at lowest precedence |
| EXPR-07 | Inject context variables (steps, input, output) into expression scope | Context object passed to evaluator, identifiers resolve against it |
| EXPR-08 | Custom parser only -- no eval(), no Function constructor | Entire architecture is custom; verified by absence of these APIs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none -- zero dependencies) | N/A | Expression engine is hand-rolled | Security requirement EXPR-08; expression engines are small enough to not need external deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (already installed) | Unit testing | All expression engine tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled parser | jsep (npm) | jsep is 2.5KB and well-tested, but adds a dependency and doesn't support `{{ }}` delimiters natively. Constraint says zero additional deps. |
| Pratt parser | Recursive descent | Recursive descent works but requires one function per precedence level. Pratt is more compact and extensible. |
| Tree-walk evaluator | Bytecode compiler | Overkill for this expression complexity. Tree-walk is simpler, debuggable, and fast enough for config evaluation. |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended File Structure
```
packages/core/
  expression.ts          # All expression engine code (lexer, parser, evaluator)
  expression.test.ts     # Comprehensive tests
  index.ts               # Add evaluate export
  types.ts               # Expression type already exists
```

Keep it in a single file. The total code is likely 400-600 lines. Splitting into lexer.ts/parser.ts/evaluator.ts would be over-engineering for this scope. The module boundary is `expression.ts` -- internals are implementation detail.

### Pattern 1: Three-Stage Pipeline

**What:** Lexer -> Parser -> Evaluator, each stage cleanly separated.

**When to use:** Always. This is the only correct architecture for a safe expression engine.

**Stage 1 -- Lexer (Tokenizer):**
```typescript
// Token types needed for LOGIC.md expressions
enum TokenType {
  // Literals
  Number,        // 42, 3.14
  String,        // "hello", 'world'
  Boolean,       // true, false
  Null,          // null

  // Identifiers
  Identifier,    // output, steps, input

  // Operators
  Dot,           // .
  EqualEqual,    // ==
  BangEqual,     // !=
  Less,          // <
  Greater,       // >
  LessEqual,     // <=
  GreaterEqual,  // >=
  AmpAmp,        // &&
  PipePipe,      // ||
  Bang,          // !
  Question,      // ?
  Colon,         // :

  // Delimiters
  LeftParen,     // (
  RightParen,    // )
  Comma,         // ,

  // End
  EOF,
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}
```

**Stage 2 -- Pratt Parser:**
```typescript
// AST Node types
type ASTNode =
  | { type: "Literal"; value: unknown }
  | { type: "Identifier"; name: string }
  | { type: "MemberExpression"; object: ASTNode; property: string }
  | { type: "BinaryExpression"; operator: string; left: ASTNode; right: ASTNode }
  | { type: "UnaryExpression"; operator: string; operand: ASTNode }
  | { type: "ConditionalExpression"; test: ASTNode; consequent: ASTNode; alternate: ASTNode }
  | { type: "CallExpression"; callee: ASTNode; property: string; args: ASTNode[] };

// Precedence levels (low to high)
enum Precedence {
  None = 0,
  Ternary = 1,     // ? :
  Or = 2,          // ||
  And = 3,         // &&
  Equality = 4,    // == !=
  Comparison = 5,  // < > <= >=
  Unary = 6,       // !
  Call = 7,        // ()
  Member = 8,      // .
}
```

**Stage 3 -- Tree-Walk Evaluator:**
```typescript
// Context is a plain object with string keys
type ExpressionContext = Record<string, unknown>;

function evaluateNode(node: ASTNode, context: ExpressionContext): unknown {
  switch (node.type) {
    case "Literal": return node.value;
    case "Identifier": return context[node.name];
    case "MemberExpression": {
      const obj = evaluateNode(node.object, context);
      return (obj as Record<string, unknown>)?.[node.property];
    }
    case "BinaryExpression": {
      const left = evaluateNode(node.left, context);
      const right = evaluateNode(node.right, context);
      // dispatch on operator...
    }
    // etc.
  }
}
```

### Pattern 2: Delimiter Extraction

**What:** Strip `{{ }}` delimiters before parsing the inner expression.

**When to use:** Always as the entry point.

```typescript
export function evaluate(template: string, context: ExpressionContext): unknown {
  const expr = extractExpression(template);  // strips {{ }}
  const tokens = tokenize(expr);
  const ast = parse(tokens);
  return evaluateNode(ast, context);
}

function extractExpression(template: string): string {
  const trimmed = template.trim();
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    return trimmed.slice(2, -2).trim();
  }
  throw new ExpressionError("Expression must be wrapped in {{ }}");
}
```

### Pattern 3: Allowlisted Method Calls

**What:** Only permit specific method calls on values -- no arbitrary function execution.

**When to use:** For EXPR-05 (.length, .every(), .some(), .contains()).

```typescript
// .length is a property access, not a method call -- handle in MemberExpression
// .every(), .some(), .contains() are method calls -- handle in CallExpression

function evaluateCall(
  target: unknown,
  method: string,
  args: unknown[],
): unknown {
  if (!Array.isArray(target)) {
    throw new ExpressionError(`Cannot call .${method}() on non-array`);
  }
  switch (method) {
    case "every": return target.every(/* callback from args */);
    case "some": return target.some(/* callback from args */);
    case "contains": return target.includes(args[0]);
    default:
      throw new ExpressionError(`Unknown method: .${method}()`);
  }
}
```

**Important:** `.contains()` is NOT a native JS method -- it maps to `Array.prototype.includes()`. The spec defines it as a domain-specific convenience.

### Pattern 4: Short-Circuit Evaluation

**What:** `&&` and `||` must short-circuit like JavaScript.

**When to use:** When evaluating logical operators.

```typescript
case "&&": {
  const left = evaluateNode(node.left, context);
  if (!left) return left;  // short-circuit
  return evaluateNode(node.right, context);
}
case "||": {
  const left = evaluateNode(node.left, context);
  if (left) return left;  // short-circuit
  return evaluateNode(node.right, context);
}
```

### Pattern 5: Discriminated Union Result Type

**What:** Follow the existing codebase pattern of `{ ok: true, value } | { ok: false, error }`.

**When to use:** For the public API.

```typescript
export interface ExpressionError {
  message: string;
  position?: number;
}

export interface EvaluateSuccess {
  ok: true;
  value: unknown;
}

export interface EvaluateFailure {
  ok: false;
  error: ExpressionError;
}

export type EvaluateResult = EvaluateSuccess | EvaluateFailure;
```

**Alternative:** The success criteria show `evaluate("...", context)` returning the value directly. Consider a simpler API that throws on error, since expressions in LOGIC.md are validated at parse time and errors are exceptional. The planner should decide, but a throwing API is simpler for callers.

### Anti-Patterns to Avoid
- **Using eval() or Function():** Explicit security requirement. Never.
- **Using regex for parsing:** Regex cannot handle nested expressions, operator precedence, or parenthesized sub-expressions. A proper lexer/parser is required.
- **Supporting arbitrary JS:** Only support the operators specified in EXPR-01 through EXPR-06. No assignment, no function declarations, no object creation.
- **Deep recursion without limits:** Set a reasonable AST depth limit (e.g., 50 levels) to prevent stack overflow from pathological expressions.
- **Mutable AST nodes:** AST nodes should be readonly/immutable. Parse once, evaluate many times with different contexts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full JavaScript parser | A complete JS interpreter | Scoped expression grammar only | The expression language is intentionally limited; supporting full JS would violate the security model |

**Key insight:** This IS the case where hand-rolling is correct. The expression language is small, well-defined, and the security constraint (EXPR-08) demands full control over what gets executed. A dependency would actually be worse here.

## Common Pitfalls

### Pitfall 1: Operator Precedence Bugs
**What goes wrong:** `a || b && c` evaluates as `(a || b) && c` instead of `a || (b && c)`.
**Why it happens:** Incorrect precedence table or wrong recursive call levels.
**How to avoid:** Use the standard precedence order (Member > Call > Unary > Comparison > Equality > And > Or > Ternary). Test with complex nested expressions.
**Warning signs:** Tests with mixed operators producing unexpected results.

### Pitfall 2: Dot Notation Fails on Undefined Intermediates
**What goes wrong:** `output.findings.length` throws when `output.findings` is undefined.
**Why it happens:** Naive property access doesn't guard against undefined/null in the chain.
**How to avoid:** Return `undefined` when accessing a property on `undefined` or `null` (safe navigation behavior). Do NOT throw -- LOGIC.md expressions should degrade gracefully.
**Warning signs:** Runtime errors from deeply nested property access.

### Pitfall 3: String Comparison vs Number Comparison
**What goes wrong:** `"10" > "9"` evaluates to `false` (string comparison) when user expects numeric comparison.
**Why it happens:** JavaScript string comparison is lexicographic.
**How to avoid:** For comparison operators, if both sides are numbers or numeric strings, compare numerically. Document this behavior.
**Warning signs:** Comparisons involving numbers stored as strings.

### Pitfall 4: The .contains() Method Trap
**What goes wrong:** Developer implements `.contains()` as `Array.prototype.contains()` which doesn't exist.
**Why it happens:** The spec says `.contains()` but JavaScript arrays use `.includes()`.
**How to avoid:** Map `.contains()` to `.includes()` in the evaluator's method dispatch.
**Warning signs:** "contains is not a function" errors.

### Pitfall 5: Callback Arguments in .every()/.some()
**What goes wrong:** `.every()` and `.some()` need a callback/predicate, but how is this expressed in the `{{ }}` syntax?
**Why it happens:** The spec lists `.every()` and `.some()` but doesn't specify callback syntax.
**How to avoid:** Define a convention: `.every(item => item.valid)` style arrow functions inside expressions, OR simpler: `.every()` with no args checks truthiness of all elements. The planner needs to decide on the callback representation. Recommend the simplest approach: `.every()` checks all elements are truthy, `.some()` checks any element is truthy. If a predicate is needed, support a simple form like `.every(prop)` to check a specific property on each element.
**Warning signs:** Unclear API surface for array predicate methods.

### Pitfall 6: Template Strings with Multiple Expressions
**What goes wrong:** A template like `"Found {{ count }} items with {{ status }}"` needs string interpolation, not just single expression evaluation.
**Why it happens:** The spec mentions `{{ }}` delimiters but doesn't clarify single-expression vs string interpolation.
**How to avoid:** For Phase 5, the primary use case is single-expression evaluation (conditions, checks). String interpolation with multiple `{{ }}` is a separate concern. Implement `evaluate()` for single expressions first. If multi-expression string interpolation is needed later, add a separate `interpolate()` function.
**Warning signs:** Expressions appearing mid-string in step instructions.

## Code Examples

### Complete Lexer Token Loop
```typescript
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos]!)) { pos++; continue; }

    // Two-character operators first
    const twoChar = input.slice(pos, pos + 2);
    if (twoChar === "==" || twoChar === "!=" ||
        twoChar === "<=" || twoChar === ">=" ||
        twoChar === "&&" || twoChar === "||") {
      tokens.push({ type: TWO_CHAR_MAP[twoChar], value: twoChar, position: pos });
      pos += 2;
      continue;
    }

    // Single-character operators
    const ch = input[pos]!;
    if (ch in SINGLE_CHAR_MAP) {
      tokens.push({ type: SINGLE_CHAR_MAP[ch], value: ch, position: pos });
      pos++;
      continue;
    }

    // Numbers
    if (/\d/.test(ch)) {
      let num = "";
      while (pos < input.length && /[\d.]/.test(input[pos]!)) {
        num += input[pos]!;
        pos++;
      }
      tokens.push({ type: TokenType.Number, value: num, position: pos - num.length });
      continue;
    }

    // Strings (single or double quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      pos++; // skip opening quote
      let str = "";
      while (pos < input.length && input[pos] !== quote) {
        str += input[pos]!;
        pos++;
      }
      pos++; // skip closing quote
      tokens.push({ type: TokenType.String, value: str, position: pos - str.length - 2 });
      continue;
    }

    // Identifiers and keywords (true, false, null)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos]!)) {
        ident += input[pos]!;
        pos++;
      }
      if (ident === "true" || ident === "false") {
        tokens.push({ type: TokenType.Boolean, value: ident, position: pos - ident.length });
      } else if (ident === "null") {
        tokens.push({ type: TokenType.Null, value: ident, position: pos - ident.length });
      } else {
        tokens.push({ type: TokenType.Identifier, value: ident, position: pos - ident.length });
      }
      continue;
    }

    throw new ExpressionError(`Unexpected character: ${ch}`, pos);
  }

  tokens.push({ type: TokenType.EOF, value: "", position: pos });
  return tokens;
}
```

### Pratt Parser Core Loop
```typescript
function parseExpression(precedence: Precedence = Precedence.None): ASTNode {
  // Get prefix handler for current token
  const token = advance();
  const prefixFn = prefixRules.get(token.type);
  if (!prefixFn) {
    throw new ExpressionError(`Unexpected token: ${token.value}`, token.position);
  }
  let left = prefixFn(token);

  // Parse infix operations while precedence allows
  while (precedence < getPrecedence(peek().type)) {
    const infixToken = advance();
    const infixFn = infixRules.get(infixToken.type);
    if (!infixFn) break;
    left = infixFn(left, infixToken);
  }

  return left;
}
```

### Public API
```typescript
/**
 * Evaluate a `{{ }}` template expression against a context object.
 * Returns the evaluated value.
 * Throws ExpressionError for syntax errors or invalid operations.
 */
export function evaluate(template: string, context: ExpressionContext): unknown {
  const expr = extractExpression(template);
  const tokens = tokenize(expr);
  const ast = parseExpression(tokens);
  return evaluateNode(ast, context);
}

// Type alias for context (already matches what steps/input/output provide)
export type ExpressionContext = Record<string, unknown>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| eval()-based template engines | Custom parsers with AST | ~2018 onwards | Security: prevents code injection |
| Regex-based expression matching | Proper lexer/parser | Always was better | Correctness: handles precedence, nesting |
| PEG parser generators | Pratt/hand-rolled parsers | 2020s trend | Simpler, zero deps, better error messages |

**Deprecated/outdated:**
- Using `with()` statement for scoping: Strict mode forbids it, never was safe
- Using `new Function()` as "safe eval": Still executes arbitrary code, not safe

## Open Questions

1. **Callback syntax for .every()/.some()**
   - What we know: The spec requires `.every()` and `.some()` on arrays
   - What's unclear: What predicate syntax is supported inside the parens? Arrow functions? Property name shorthand?
   - Recommendation: Start with simplest form -- `.every()` with no args checks truthiness, `.some()` with no args checks truthiness. Support `.every(prop)` and `.some(prop)` as shorthand for checking a named property. This avoids needing to parse arrow functions in the expression grammar.

2. **Error handling strategy: throw vs result type**
   - What we know: Existing codebase uses `{ ok: true } | { ok: false }` pattern
   - What's unclear: Should `evaluate()` follow this pattern or throw?
   - Recommendation: Since expressions are validated at file-parse time and evaluation errors are programming bugs (wrong context shape), a throwing API is simpler. Export an `ExpressionError` class. But planner can override this.

3. **String interpolation with multiple expressions**
   - What we know: `{{ }}` delimiters are used in conditions, checks, and triggers
   - What's unclear: Whether `instructions: "Process {{ input.count }} items"` needs multi-expression interpolation
   - Recommendation: Phase 5 focuses on single-expression evaluation. Multi-expression string interpolation (if needed) can be a small addition later.

## Sources

### Primary (HIGH confidence)
- Pratt parsing algorithm: [On Recursive Descent and Pratt Parsing](https://www.chidiwilliams.com/posts/on-recursive-descent-and-pratt-parsing) -- detailed implementation guide
- Codebase analysis: `packages/core/types.ts`, `parser.ts`, `validator.ts` -- established patterns

### Secondary (MEDIUM confidence)
- n8n expression syntax: [n8n Docs - Expressions](https://docs.n8n.io/code/expressions/) -- `{{ }}` delimiter convention reference
- jsep architecture: [jsep - JavaScript Expression Parser](https://ericsmekens.github.io/jsep/) -- validates the lexer/parser/evaluator architecture

### Tertiary (LOW confidence)
- [LeanyLabs - How to Create Your Own Expression Interpreter](https://leanylabs.com/blog/js-formula-engine/) -- general approach validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero dependencies is the only option per constraints; well-understood domain
- Architecture: HIGH -- Pratt parsing is the textbook solution for expression languages; confirmed by multiple authoritative sources
- Pitfalls: HIGH -- these are classic pitfalls in expression engine implementations, verified through implementation experience and multiple sources

**Research date:** 2026-03-31
**Valid until:** Indefinite -- expression parsing is stable computer science, not a moving target
