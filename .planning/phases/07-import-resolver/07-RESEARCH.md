# Phase 7: Import Resolver - Research

**Researched:** 2026-03-31
**Domain:** File-based import resolution, config merging, circular dependency detection
**Confidence:** HIGH

## Summary

Phase 7 implements the import resolver for LOGIC.md files. The `imports` array in a LogicSpec (`{ ref: string, as: string }[]`) allows one LOGIC.md file to compose reasoning scaffolds from other LOGIC.md files. The resolver must load referenced files from relative paths, namespace their contents under the `as` prefix, merge configs with correct precedence (local > later imports > earlier imports), and detect circular import chains.

This is a self-contained module that reuses the existing `parse()` function from `parser.ts` and adds `node:fs` + `node:path` for file I/O and path resolution. The circular detection algorithm is structurally similar to the cycle detection in `dag.ts` (visited set tracking) but operates on file paths rather than step names. The config merging logic is a deep merge with "local wins" semantics.

**Primary recommendation:** Create a single `imports.ts` file exporting a `resolveImports()` function that takes a `LogicSpec` and a base directory, recursively resolves imports, and returns a merged `LogicSpec` or error result. Follow the established `ok: true | ok: false` discriminated union pattern used by all other modules.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMPT-01 | Resolve `imports` array with `ref` and `as` namespace | Namespace prefixing strategy for steps, decision_trees keys |
| IMPT-02 | Load and parse referenced LOGIC.md files from relative paths | Reuse `parse()` + `node:fs/readFileSync` + `node:path/resolve` |
| IMPT-03 | Merge imported configs with correct precedence (local overrides imported) | Deep merge utility with local-wins semantics |
| IMPT-04 | Detect and report circular imports | Visited-set tracking with chain recording during DFS |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs | built-in | Read imported .logic.md files from disk | Standard Node.js file I/O, no external dependency |
| node:path | built-in | Resolve relative import paths against base directory | Standard Node.js path resolution |
| @logic-md/core parser | local | Parse imported file content into LogicSpec | Already exists, proven, typed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No additional dependencies needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| readFileSync | readFile (async) | Sync is simpler for recursive resolution; async adds complexity with no benefit for a CLI tool parsing config files |
| Custom deep merge | lodash.merge / deepmerge | Over-engineering for merging ~10 top-level keys with known structure; custom merge gives precise control over precedence |

**Installation:**
```bash
# No new dependencies needed -- uses node built-ins + existing parse()
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/
  imports.ts          # resolveImports() function + merge logic
  imports.test.ts     # Tests with fixture .logic.md files
  types.ts            # Import type already defined
  index.ts            # Add resolveImports export
```

### Pattern 1: Discriminated Union Result
**What:** All module entry points return `{ ok: true, ... } | { ok: false, errors: [] }`
**When to use:** Always -- this is the established project convention
**Example:**
```typescript
// Follows dag.ts, parser.ts, validator.ts pattern
export interface ImportError {
  type: "file_not_found" | "parse_error" | "circular_import" | "merge_error";
  message: string;
  /** Import chain leading to the error (file paths) */
  chain: string[];
}

export interface ImportSuccess {
  ok: true;
  /** Merged LogicSpec with all imports resolved */
  data: LogicSpec;
}

export interface ImportFailure {
  ok: false;
  errors: ImportError[];
}

export type ImportResult = ImportSuccess | ImportFailure;
```

### Pattern 2: Recursive DFS with Visited Set
**What:** Resolve imports depth-first, tracking visited file paths to detect cycles
**When to use:** For the core resolution algorithm
**Example:**
```typescript
export function resolveImports(
  spec: LogicSpec,
  basedir: string,
  /** Internal: tracks visited files for circular detection */
  _visited?: Set<string>,
  /** Internal: tracks the import chain for error reporting */
  _chain?: string[],
): ImportResult {
  const visited = _visited ?? new Set<string>();
  const chain = _chain ?? [];

  if (!spec.imports?.length) {
    return { ok: true, data: spec };
  }

  let merged = stripImports(spec); // Start with local spec minus imports array

  // Process imports in order (earlier imports have lower precedence)
  for (const imp of spec.imports) {
    const absPath = path.resolve(basedir, imp.ref);
    const normalizedPath = path.normalize(absPath);

    // Circular detection
    if (visited.has(normalizedPath)) {
      return {
        ok: false,
        errors: [{
          type: "circular_import",
          message: `Circular import detected: ${[...chain, normalizedPath].join(" -> ")}`,
          chain: [...chain, normalizedPath],
        }],
      };
    }

    // Load + parse
    let content: string;
    try {
      content = fs.readFileSync(absPath, "utf-8");
    } catch {
      return {
        ok: false,
        errors: [{
          type: "file_not_found",
          message: `Import "${imp.ref}" not found: ${absPath}`,
          chain: [...chain, absPath],
        }],
      };
    }

    const parseResult = parse(content);
    if (!parseResult.ok) {
      return {
        ok: false,
        errors: [{
          type: "parse_error",
          message: `Failed to parse import "${imp.ref}": ${parseResult.errors[0].message}`,
          chain: [...chain, absPath],
        }],
      };
    }

    // Recurse into imported file's own imports
    visited.add(normalizedPath);
    const resolved = resolveImports(
      parseResult.data,
      path.dirname(absPath),
      visited,
      [...chain, normalizedPath],
    );
    if (!resolved.ok) return resolved;

    // Namespace and merge (imported merges under local, earlier < later)
    merged = mergeSpecs(merged, namespaceSpec(resolved.data, imp.as));
  }

  // Local values override everything (apply local on top)
  merged = mergeSpecs(merged, stripImports(spec));

  return { ok: true, data: merged };
}
```

### Pattern 3: Namespace Prefixing
**What:** Prefix imported keys with the `as` namespace to avoid collisions
**When to use:** For `steps` and `decision_trees` (record-keyed sections)
**Example:**
```typescript
function namespaceSpec(spec: LogicSpec, ns: string): LogicSpec {
  const result = { ...spec };

  // Namespace steps: { analyze: ... } -> { "mylib.analyze": ... }
  if (spec.steps) {
    result.steps = {};
    for (const [key, value] of Object.entries(spec.steps)) {
      result.steps[`${ns}.${key}`] = {
        ...value,
        // Also namespace needs references
        needs: value.needs?.map(n => `${ns}.${n}`),
      };
    }
  }

  // Namespace decision_trees similarly
  if (spec.decision_trees) {
    result.decision_trees = {};
    for (const [key, value] of Object.entries(spec.decision_trees)) {
      result.decision_trees[`${ns}.${key}`] = value;
    }
  }

  return result;
}
```

### Pattern 4: Config Merging with Precedence
**What:** Deep merge of LogicSpec sections where later values override earlier
**When to use:** For merging imported configs into the local spec
**Example:**
```typescript
function mergeSpecs(base: LogicSpec, override: LogicSpec): LogicSpec {
  const merged: LogicSpec = { ...base };

  // Scalar overrides: later wins
  if (override.reasoning) merged.reasoning = { ...base.reasoning, ...override.reasoning };
  if (override.contracts) merged.contracts = { ...base.contracts, ...override.contracts };
  if (override.quality_gates) merged.quality_gates = { ...base.quality_gates, ...override.quality_gates };
  if (override.fallback) merged.fallback = { ...base.fallback, ...override.fallback };
  if (override.global) merged.global = { ...base.global, ...override.global };

  // Record merges: keys merge, conflicts resolved by override winning
  if (override.steps) merged.steps = { ...base.steps, ...override.steps };
  if (override.decision_trees) merged.decision_trees = { ...base.decision_trees, ...override.decision_trees };
  if (override.nodes) merged.nodes = { ...base.nodes, ...override.nodes };

  // Array merges: concatenate
  if (override.edges) merged.edges = [...(base.edges ?? []), ...override.edges];

  return merged;
}
```

### Anti-Patterns to Avoid
- **Async file loading for a CLI parser:** The entire parse pipeline is synchronous. Introducing async for `readFile` would propagate async through every caller for zero benefit on small config files.
- **Mutating the input LogicSpec:** Always create new objects. The input spec should remain untouched.
- **Global mutable state for visited tracking:** Pass the visited set as a parameter through recursion, not as module-level state.
- **Normalizing paths inconsistently:** Always use `path.normalize()` on resolved absolute paths before checking the visited set. Different relative paths can resolve to the same file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path resolution | Custom path joining/normalization | `node:path` resolve + normalize | Handles `.`, `..`, separators, edge cases |
| File reading | Custom stream/buffer handling | `fs.readFileSync(path, "utf-8")` | Simple, correct, sufficient for config files |
| YAML parsing | Custom frontmatter extraction | Existing `parse()` from parser.ts | Already tested and handles all edge cases |

**Key insight:** The import resolver is primarily glue between existing modules (parser, fs, path) with two novel concerns: circular detection and config merging. Both are straightforward algorithms that don't need libraries.

## Common Pitfalls

### Pitfall 1: Path Normalization Inconsistency
**What goes wrong:** `./lib/../lib/base.logic.md` and `./lib/base.logic.md` resolve to the same file but have different string representations, causing circular detection to miss cycles.
**Why it happens:** Comparing raw `ref` strings instead of normalized absolute paths.
**How to avoid:** Always `path.resolve()` then `path.normalize()` before storing in the visited set.
**Warning signs:** Tests pass with simple paths but fail with `..` traversals.

### Pitfall 2: Merge Precedence Inversion
**What goes wrong:** Imported values override local values instead of the other way around.
**Why it happens:** Applying local spec first, then imported spec on top. Or confusing `Object.assign` / spread order.
**How to avoid:** The merge order must be: start with empty -> apply imports (first to last) -> apply local on top. In spread terms: `{ ...imported, ...local }`.
**Warning signs:** A test where local has `temperature: 0.5` and import has `temperature: 0.9` -- local must win.

### Pitfall 3: Namespace Leaking into Needs References
**What goes wrong:** Imported steps have `needs: ["analyze"]` but after namespacing the step is `"lib.analyze"`. The `needs` reference breaks.
**Why it happens:** Namespacing step keys but forgetting to namespace intra-import `needs` references.
**How to avoid:** When namespacing steps, also namespace all `needs` arrays, `branches[].then` targets, and `parallel_steps` references within the same import scope.
**Warning signs:** DAG resolver fails after import resolution with "missing dependency" errors.

### Pitfall 4: Not Handling Missing imports Array
**What goes wrong:** Function crashes on `spec.imports.length` when imports is undefined.
**Why it happens:** `imports` is optional on LogicSpec.
**How to avoid:** Early return when `!spec.imports?.length` -- already shown in the pattern above.
**Warning signs:** TypeError on undefined property access.

### Pitfall 5: Forgetting to Remove imports Key from Merged Output
**What goes wrong:** The resolved LogicSpec still contains an `imports` array, which could cause re-resolution.
**Why it happens:** Spread-copying the spec without stripping `imports`.
**How to avoid:** Use a `stripImports()` helper that creates a copy without the `imports` field.
**Warning signs:** Downstream consumers attempt to resolve imports again.

## Code Examples

### Minimal resolveImports Signature
```typescript
// packages/core/imports.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "./parser.js";
import type { LogicSpec } from "./types.js";

export function resolveImports(
  spec: LogicSpec,
  basedir: string,
): ImportResult {
  return resolveImportsRecursive(spec, basedir, new Set(), []);
}
```

### Test Structure Pattern
```typescript
// packages/core/imports.test.ts
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveImports } from "./imports.js";
import { parse } from "./parser.js";

// Use actual fixture files or inline parse() calls for specs
const FIXTURES = path.join(import.meta.dirname, "__fixtures__");

describe("resolveImports", () => {
  it("returns spec unchanged when no imports", () => { ... });
  it("resolves a single import and namespaces steps", () => { ... });
  it("merges configs with local taking precedence", () => { ... });
  it("detects circular imports", () => { ... });
  it("reports file not found errors", () => { ... });
  it("handles transitive imports (A imports B imports C)", () => { ... });
});
```

### Fixture File Example
```yaml
# __fixtures__/base.logic.md
---
spec_version: "1.0"
name: base-reasoning
reasoning:
  strategy: cot
  temperature: 0.7
steps:
  analyze:
    description: Analyze input
  synthesize:
    description: Synthesize findings
    needs: [analyze]
---
```

### Importing File Example
```yaml
# __fixtures__/main.logic.md
---
spec_version: "1.0"
name: main-reasoning
imports:
  - ref: ./base.logic.md
    as: base
reasoning:
  strategy: react
  temperature: 0.5
steps:
  local_step:
    description: Local processing
---
```

Expected resolved output:
- `reasoning.strategy` = `"react"` (local wins)
- `reasoning.temperature` = `0.5` (local wins)
- Steps: `{ "base.analyze": ..., "base.synthesize": { needs: ["base.analyze"] }, "local_step": ... }`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | First implementation | Phase 7 | New capability |

This is a greenfield module. No deprecated patterns to worry about.

## Open Questions

1. **Should namespace separator be `.` or `/` or `::`?**
   - What we know: The `as` field is a plain string. The spec doesn't define separator convention.
   - Recommendation: Use `.` (dot) as separator (`base.analyze`). It's natural for property access, familiar from module systems, and doesn't conflict with YAML syntax. The planner should lock this choice.

2. **Should we validate the imported file against the schema (Phase 4) or just parse it?**
   - What we know: `parse()` extracts YAML without schema validation. `validate()` does schema validation.
   - Recommendation: Use `parse()` only. Schema validation is a separate concern and the CLI validate command (Phase 8) should handle that. The import resolver just needs structurally valid YAML.

3. **What happens with duplicate step names after namespacing across multiple imports?**
   - What we know: Two imports could define the same step name under different namespaces, which is fine. But if two imports use the same `as` namespace, they'd collide.
   - Recommendation: Detect duplicate `as` values in the imports array and report an error.

4. **Should branches[].then and parallel_steps references be namespaced?**
   - What we know: These fields reference step names. After namespacing, they would be broken.
   - Recommendation: Yes, namespace all intra-import step references (needs, branches[].then, parallel_steps). Cross-import references should use the full namespaced name explicitly in the source file.

## Sources

### Primary (HIGH confidence)
- `packages/core/types.ts` - Import type definition: `{ ref: string, as: string }`
- `packages/core/parser.ts` - parse() function signature and return types
- `packages/core/dag.ts` - Established patterns for discriminated unions, error types
- `packages/core/validator.ts` - Established patterns for file content processing
- `packages/core/index.ts` - Barrel export pattern
- `.planning/REQUIREMENTS.md` - IMPT-01 through IMPT-04 definitions

### Secondary (MEDIUM confidence)
- Node.js `path.resolve` / `path.normalize` behavior - standard Node.js API, well-known

### Tertiary (LOW confidence)
- None -- this phase builds entirely on known local code patterns and Node.js built-ins

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses only Node.js built-ins and existing project code
- Architecture: HIGH - follows exact patterns from dag.ts, parser.ts, validator.ts
- Pitfalls: HIGH - derived from direct analysis of the type system and merge semantics

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependencies to drift)
