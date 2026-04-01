---
phase: 05-expression-engine
plan: 01
subsystem: expression-engine
tags: [pratt-parser, lexer, ast, tokenizer, typescript]

requires:
  - phase: 02-type-hierarchy
    provides: Expression type alias (string) used in types.ts
provides:
  - "tokenize() function: converts expression strings to Token arrays"
  - "parse() function: Pratt parser converting Token arrays to typed AST"
  - "ExpressionError class with position tracking"
  - "TokenType enum and ASTNode discriminated union"
affects: [05-expression-engine]

tech-stack:
  added: []
  patterns: [pratt-parser, discriminated-union-ast, prefix-infix-parsing]

key-files:
  created:
    - packages/core/expression.ts
    - packages/core/expression.test.ts
  modified: []

key-decisions:
  - "Regular enum (not const enum) for TokenType to preserve runtime values"
  - "Pratt parser with 8 precedence levels: None < Ternary < Or < And < Equality < Comparison < Unary < Call < Member"
  - "CallExpression stores callee + property + args (method call pattern, not standalone function calls)"
  - "Max AST depth of 50 to prevent stack overflow on malicious input"

patterns-established:
  - "Pratt parser pattern: prefix/infix handlers with precedence climbing"
  - "ExpressionError with position field for source-mapped error reporting"

requirements-completed: [EXPR-01, EXPR-02, EXPR-08]

duration: 3min
completed: 2026-03-31
---

# Phase 5 Plan 1: Expression Lexer and Parser Summary

**Pratt parser and lexer for `{{ expression }}` template strings -- tokenize() and parse() producing typed AST with correct operator precedence**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T13:14:50Z
- **Completed:** 2026-04-01T13:17:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Lexer tokenizes all supported types: numbers, strings, booleans, null, identifiers, 6 two-char operators, 9 single-char operators
- Pratt parser produces correct AST for member access, binary/unary/ternary expressions, method calls with proper precedence
- 31 tests covering tokenizer and parser with full TDD workflow (RED then GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- Write failing tests for lexer and parser** - `3462ec3` (test)
2. **Task 2: GREEN -- Implement lexer and Pratt parser** - `5a9d97d` (feat)

## Files Created/Modified
- `packages/core/expression.ts` - Lexer (tokenize), Pratt parser (parse), ExpressionError, TokenType enum, ASTNode types
- `packages/core/expression.test.ts` - 31 tests covering all token types, AST node types, and precedence rules

## Decisions Made
- Used regular enum (not const enum) for TokenType to preserve runtime string values for error messages
- 8 precedence levels matching standard expression language conventions
- CallExpression models method calls (callee.property(args)) rather than standalone function calls
- Max AST depth of 50 prevents stack overflow on deeply nested or malicious expressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode errors with noUncheckedIndexedAccess**
- **Found during:** Task 2
- **Issue:** String indexing (`input[pos]`) and array indexing (`tokens[pos]`) return `T | undefined` under `noUncheckedIndexedAccess`
- **Fix:** Added non-null assertions where bounds are guaranteed by while-loop conditions; added runtime guard in `peek()` for token array
- **Files modified:** packages/core/expression.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 5a9d97d (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for TypeScript strict mode compliance. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lexer and parser complete, ready for evaluator (Plan 05-02)
- AST node types are exported and ready for tree-walking evaluation
- ExpressionError class provides position-tracked errors for the full pipeline

---
*Phase: 05-expression-engine*
*Completed: 2026-03-31*
