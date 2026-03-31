# Phase 2: Type System & JSON Schema - Research

**Researched:** 2026-03-31
**Domain:** TypeScript type modeling, JSON Schema authoring, ajv validation
**Confidence:** HIGH

## Summary

Phase 2 builds the foundational type system for the entire logic-md project. The LOGIC.md v1.0 specification defines a rich YAML frontmatter schema with root properties (spec_version, name, imports, reasoning, steps, contracts, quality_gates, etc.), each containing deeply nested sub-structures. The task is to model this entire hierarchy as strict TypeScript interfaces and produce a corresponding JSON Schema file that ajv can validate against.

The project already has `ajv ^8.0.0` as a dependency in `@logic-md/core`. The recommended approach is to **hand-author the TypeScript interfaces first** (source of truth for the developer experience), then **hand-author a matching JSON Schema draft-07 file** (source of truth for validation). This "dual-source" approach is standard for spec-driven projects where both the types and the schema are public-facing artifacts. Generating one from the other adds build complexity and limits expressiveness.

**Primary recommendation:** Hand-write TypeScript interfaces modeling every spec section, hand-write a matching JSON Schema draft-07 file, and add a vitest test that validates a known-good fixture against the schema to ensure they stay in sync.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARS-02 | Return fully typed LogicSpec TypeScript object from parsed YAML | This phase creates the `LogicSpec` interface and all sub-types that the parser (Phase 3) will return. The JSON Schema provides the validation backbone used in Phase 4. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ajv | ^8.0.0 | JSON Schema validation | Already in package.json; industry standard, supports draft-07, TypeScript-native since v8 |
| TypeScript | ~5.8.0 | Type definitions | Already configured with strict mode, noUncheckedIndexedAccess |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv-formats | ^3.0.0 | Format validation (uri, date-time, duration) | Needed for `format: uri` in contracts and `format: duration` in timeouts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written JSON Schema | ts-json-schema-generator | Adds build step, loses control over schema descriptions/examples, overkill for a single well-defined spec |
| Hand-written types | json-schema-to-typescript | Generated types are verbose, lose JSDoc, harder to read as public API |
| ajv JSONSchemaType | Hand-written schema | JSONSchemaType has union limitations and makes schemas harder to read; hand-written schema is clearer for a spec project |

**Installation:**
```bash
npm install ajv-formats --workspace=packages/core
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/
  src/
    types/
      index.ts              # Re-exports everything
      logic-spec.ts         # Root LogicSpec interface
      reasoning.ts          # Reasoning, StrategyConfig types
      steps.ts              # Step, Branch, Retry, Verification, Confidence types
      contracts.ts          # Contracts, ContractInput, ContractOutput, Capabilities types
      quality-gates.ts      # QualityGates, Gate, SelfVerification types
      decision-trees.ts     # DecisionTree, DecisionNode types
      fallback.ts           # Fallback, Escalation, Degradation types
      imports.ts            # Import type
      common.ts             # Shared types: Expression, JsonSchema (inline schema refs)
      visual.ts             # Visual builder integration types
    schema/
      logic-spec.schema.json   # JSON Schema draft-07
      index.ts                 # Schema loader + ajv compile helper
  index.ts                     # Public exports
```

### Pattern 1: Hierarchical Type Composition
**What:** Each spec section gets its own file with interfaces that compose into the root `LogicSpec`.
**When to use:** Always -- this is the only pattern for this phase.
**Example:**
```typescript
// types/logic-spec.ts
import type { Import } from './imports.js';
import type { Reasoning } from './reasoning.js';
import type { Step } from './steps.js';
import type { Contracts } from './contracts.js';
import type { QualityGates } from './quality-gates.js';
import type { DecisionTree } from './decision-trees.js';
import type { Fallback } from './fallback.js';
import type { Visual } from './visual.js';

export interface LogicSpec {
  spec_version: string;
  name: string;
  description?: string;
  imports?: Import[];
  reasoning?: Reasoning;
  steps?: Record<string, Step>;
  contracts?: Contracts;
  quality_gates?: QualityGates;
  decision_trees?: Record<string, DecisionTree>;
  fallback?: Fallback;
  visual?: Visual;
  metadata?: Record<string, unknown>;
}
```

### Pattern 2: String Literal Unions for Enums
**What:** Use TypeScript string literal unions (not enums) for spec-defined value sets.
**When to use:** For strategy names, severity levels, action types, execution modes.
**Example:**
```typescript
// types/reasoning.ts
export type ReasoningStrategy = 'cot' | 'react' | 'tot' | 'got' | 'plan-execute' | 'custom';
export type Severity = 'error' | 'warning' | 'info';
export type OnFailAction = 'retry' | 'escalate' | 'skip' | 'abort' | 'revise';
export type ExecutionMode = 'sequential' | 'parallel' | 'conditional';
export type JoinMode = 'all' | 'any' | 'majority';
export type ValidationMode = 'strict' | 'warn' | 'permissive';
export type ViolationAction = 'reject' | 'coerce' | 'warn' | 'retry' | 'escalate';
```

### Pattern 3: Embedded JSON Schema References
**What:** Steps have `input_schema` and `output_schema` fields that are inline JSON Schema objects. Type these as a loose `JsonSchemaObject` rather than trying to fully type JSON Schema itself.
**When to use:** For any field in the spec that contains user-authored inline JSON Schema.
**Example:**
```typescript
// types/common.ts
/** An inline JSON Schema object as authored by users in LOGIC.md YAML */
export interface JsonSchemaObject {
  type?: string | string[];
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject;
  required?: string[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  [key: string]: unknown;  // JSON Schema is extensible
}

/** Expression string using {{ }} delimiters */
export type Expression = string;
```

### Pattern 4: JSON Schema as Static Asset
**What:** The JSON Schema file is a `.json` file in the source tree, loaded at runtime via a helper.
**When to use:** Always -- this keeps the schema inspectable and usable outside TypeScript.
**Example:**
```typescript
// schema/index.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import logicSpecSchema from './logic-spec.schema.json' with { type: 'json' };
import type { LogicSpec } from '../types/index.js';

export function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile<LogicSpec>(logicSpecSchema);
  return validate;
}

export { logicSpecSchema };
```

### Anti-Patterns to Avoid
- **Using `any` or `unknown` for spec-defined structures:** Every field in the spec has a known shape. Use proper types, not escape hatches.
- **Using TypeScript enums:** String literal unions are preferred in modern TS -- they serialize cleanly, work with JSON, and have no runtime cost.
- **Generating JSON Schema from types at build time:** Adds complexity, makes schema hard to inspect/edit, and the generated output often needs manual tweaking anyway.
- **Using ajv JSONSchemaType to define schemas:** It has known union limitations and produces unreadable schema definitions. Write the JSON Schema by hand.
- **Putting all types in one file:** The spec has 10+ major sections. One file becomes unmanageable quickly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom YAML validator | ajv (already installed) | Handles draft-07 fully, allErrors mode, format validation |
| URI format validation | Regex for URLs | ajv-formats | Covers uri, uri-reference, date-time, duration, email |
| JSON Schema type | Full JSON Schema TS types | Loose `JsonSchemaObject` with index signature | JSON Schema is enormous; users embed arbitrary subsets. Full typing is a separate project (see ajv's own types) |

**Key insight:** The `input_schema`/`output_schema` fields inside steps contain user-authored JSON Schema fragments. Don't try to strongly type all of JSON Schema -- use a permissive interface with an index signature and validate the overall structure with ajv.

## Common Pitfalls

### Pitfall 1: Forgetting Optional vs Required at Every Level
**What goes wrong:** The spec has only `spec_version` and `name` as required root fields. Everything else is optional. But within sub-structures (e.g., a Step's `retry` block), some fields become required if the parent exists.
**Why it happens:** Easy to mark everything optional or everything required without reading the spec carefully.
**How to avoid:** Map every section of the spec to required/optional. Use `?` on the TypeScript side and `required` arrays in JSON Schema.
**Warning signs:** Tests pass with empty objects when they shouldn't.

### Pitfall 2: Steps Map vs Array
**What goes wrong:** Modeling `steps` as an array when the spec defines it as `map<string, Step>` (a YAML mapping where keys are step names).
**Why it happens:** YAML arrays and mappings look similar at a glance.
**How to avoid:** The spec clearly says `steps: map<string, Step>`. Use `Record<string, Step>` in TypeScript and `additionalProperties: { $ref: "#/definitions/Step" }` in JSON Schema.
**Warning signs:** Step names end up as a `name` field inside the step instead of being the map key.

### Pitfall 3: Expression Fields are Just Strings
**What goes wrong:** Trying to parse/validate expressions at the type/schema level.
**Why it happens:** Expressions like `{{ output.confidence > 0.8 }}` look special.
**How to avoid:** At the type system level, expressions are plain strings. Expression parsing belongs to Phase 5. Type them as `string` (or a branded `Expression` type alias for documentation).
**Warning signs:** Adding expression grammar to JSON Schema pattern validation.

### Pitfall 4: JSON Schema Draft Mismatch
**What goes wrong:** Writing draft-2020-12 keywords but importing the default ajv (which is draft-07).
**Why it happens:** Copy-pasting from newer schema examples.
**How to avoid:** Use `$schema: "http://json-schema.org/draft-07/schema#"` and stick to draft-07 keywords. Import `Ajv` from `"ajv"` (not `"ajv/dist/2019"`).
**Warning signs:** ajv strict mode warnings about unknown keywords.

### Pitfall 5: Index Signature Conflicts in Strict TS
**What goes wrong:** TypeScript strict mode rejects `[key: string]: unknown` alongside typed properties unless all typed properties are assignable to `unknown`.
**Why it happens:** `noUncheckedIndexedAccess` and strict mode interact poorly with index signatures.
**How to avoid:** For `JsonSchemaObject`, this works fine since all specific properties are subtypes of `unknown`. For `metadata`, use `Record<string, unknown>` directly.
**Warning signs:** Type errors about index signatures when defining interfaces with both known and unknown keys.

### Pitfall 6: JSON Import in ESM with verbatimModuleSyntax
**What goes wrong:** `import schema from './schema.json'` fails or loses types.
**Why it happens:** The project uses `verbatimModuleSyntax: true` and `module: nodenext`.
**How to avoid:** Use `import schema from './schema.json' with { type: 'json' }` (import attributes, supported in Node 18.20+ and TS 5.3+). Alternatively, use `fs.readFileSync` + `JSON.parse` in the schema loader.
**Warning signs:** Build errors about JSON imports or missing type assertions.

## Code Examples

### Full Type Map from Spec

Based on the complete LOGIC.md v1.0 specification, here is the exhaustive type catalog:

```typescript
// Root
interface LogicSpec {
  spec_version: string;         // Required: "1.0"
  name: string;                 // Required
  description?: string;
  imports?: Import[];
  reasoning?: Reasoning;
  steps?: Record<string, Step>;
  contracts?: Contracts;
  quality_gates?: QualityGates;
  decision_trees?: Record<string, DecisionTree>;
  fallback?: Fallback;
  global?: GlobalConfig;        // Section 9.1 workflow-level
  nodes?: Record<string, NodeRef>;  // Section 9.1
  edges?: Edge[];               // Section 9.1
  visual?: Visual;              // Section 10
  metadata?: Record<string, unknown>;
}

// Section 2.2
interface Import {
  ref: string;                  // Required
  as: string;                   // Required
}

// Section 3
interface Reasoning {
  strategy: ReasoningStrategy;  // Required
  max_iterations?: number;
  temperature?: number;
  thinking_budget?: number;
  strategy_config?: Record<string, unknown>;  // Strategy-specific params
}

// Section 4.1
interface Step {
  description?: string;
  needs?: string[];
  instructions?: string;
  input_schema?: JsonSchemaObject;
  output_schema?: JsonSchemaObject;
  confidence?: ConfidenceConfig;
  branches?: Branch[];
  retry?: RetryConfig;
  verification?: Verification;
  timeout?: string;
  allowed_tools?: string[];
  denied_tools?: string[];
  execution?: ExecutionMode;
  parallel_steps?: string[];
  join?: JoinMode;
  join_timeout?: string;
}

interface ConfidenceConfig {
  minimum?: number;
  target?: number;
  escalate_below?: number;
}

interface Branch {
  if?: Expression;
  default?: boolean;
  then: string;                 // Required: target step name
}

interface RetryConfig {
  max_attempts?: number;
  initial_interval?: string;
  backoff_coefficient?: number;
  maximum_interval?: string;
  non_retryable_errors?: string[];
}

interface Verification {
  check: Expression;            // Required
  on_fail: OnFailAction;        // Required
  on_fail_message?: string;
}

// Section 5
interface Contracts {
  inputs?: ContractField[];
  outputs?: ContractField[];
  capabilities?: Capabilities;
  validation?: ContractValidation;
}

interface ContractField {
  name: string;                 // Required
  type: string;                 // Required
  required?: boolean | string[];
  description?: string;
  constraints?: Record<string, unknown>;
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject;
}

interface Capabilities {
  name?: string;
  version?: string;
  description?: string;
  supported_domains?: string[];
  max_input_tokens?: number;
  avg_response_time?: string;
  languages?: string[];
}

interface ContractValidation {
  mode?: ValidationMode;
  on_input_violation?: ViolationAction;
  on_output_violation?: ViolationAction;
}

// Section 6
interface QualityGates {
  pre_output?: Gate[];
  post_output?: Gate[];
  invariants?: Invariant[];
  self_verification?: SelfVerification;
}

interface Gate {
  name: string;                 // Required
  check: Expression;            // Required
  message?: string;
  severity?: Severity;
  on_fail?: OnFailAction;
}

interface Invariant {
  name: string;                 // Required
  check: Expression;            // Required
  message?: string;
  on_breach?: string;
}

interface SelfVerification {
  enabled?: boolean;
  strategy?: SelfVerificationStrategy;
  reflection?: ReflectionConfig;
  rubric?: RubricConfig;
  checklist?: string[];
}

// Section 7
interface DecisionTree {
  description?: string;
  root: string;                 // Required
  nodes: Record<string, DecisionNode>;  // Required
  terminals?: Record<string, Terminal>;
}

interface DecisionNode {
  condition: Expression;        // Required
  branches: DecisionBranch[];   // Required
}

interface DecisionBranch {
  value?: unknown;
  default?: boolean;
  next: string;                 // Required
}

interface Terminal {
  action: string;               // Required
  message?: string;
}

// Section 8
interface Fallback {
  strategy?: FallbackStrategy;
  escalation?: EscalationLevel[];
  degradation?: DegradationRule[];
}

interface EscalationLevel {
  level: number;                // Required
  trigger: Expression;          // Required
  action: string;               // Required
  new_strategy?: ReasoningStrategy;
  message?: string;
  include_reasoning_trace?: boolean;
}

interface DegradationRule {
  when: string;                 // Required
  fallback_to: string;          // Required
  message?: string;
  include_fields?: string[];
  exclude_fields?: string[];
}

// Section 9.1 (workflow-level)
interface GlobalConfig {
  max_total_time?: string;
  max_total_cost?: number;
  fail_fast?: boolean;
  max_parallelism?: number;
}

interface NodeRef {
  logic_ref?: string;
  depends_on?: string[];
  overrides?: Record<string, unknown>;
}

interface Edge {
  from: string;                 // Required
  to: string;                   // Required
  contract?: JsonSchemaObject;
  on_contract_violation?: string;
}

// Section 10
interface Visual {
  icon?: string;
  category?: string;
  color?: string;
  inspector?: InspectorField[];
  ports?: VisualPorts;
}
```

### JSON Schema Structure (draft-07)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://logic-md.dev/schema/v1.0/logic-spec.json",
  "title": "LogicSpec",
  "description": "LOGIC.md v1.0 specification schema",
  "type": "object",
  "required": ["spec_version", "name"],
  "properties": {
    "spec_version": {
      "type": "string",
      "const": "1.0"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "steps": {
      "type": "object",
      "additionalProperties": { "$ref": "#/definitions/Step" }
    }
  },
  "additionalProperties": false,
  "definitions": {
    "Step": { },
    "Reasoning": { },
    "Contracts": { }
  }
}
```

### Schema Loader Pattern
```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import type { LogicSpec } from '../types/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedValidator: ValidateFunction<LogicSpec> | null = null;

export function getSchema(): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, 'logic-spec.schema.json'), 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

export function createValidator(): ValidateFunction<LogicSpec> {
  if (cachedValidator) return cachedValidator;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  cachedValidator = ajv.compile<LogicSpec>(getSchema());
  return cachedValidator;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Draft-04 JSON Schema | Draft-07 JSON Schema | ajv v7 (2021) | Draft-04 no longer supported in ajv 7+ |
| `require('./schema.json')` | `import` with assertions or `readFileSync` | Node 18+ / TS 5.3+ | ESM requires explicit JSON import handling |
| `ajv` constructor function | `new Ajv()` class | ajv v8 (2021) | ajv is now an ES6 class |
| Loose schema | Strict mode by default | ajv v8 (2021) | Unknown keywords and type mismatches are errors by default |

**Deprecated/outdated:**
- Draft-04 JSON Schema: Not supported in ajv v7+
- `ajv.addSchema()` without `$id`: Strict mode requires schemas to have `$id`

## Open Questions

1. **`additionalProperties: false` at root level?**
   - What we know: The spec says parsers should "never silently ignore unknown properties (warn instead)". This suggests `additionalProperties: false` is appropriate for strict validation, but a `warn` mode might want `additionalProperties: true`.
   - What's unclear: Whether the JSON Schema should be strict (reject unknown) or permissive (allow unknown with warnings).
   - Recommendation: Use `additionalProperties: false` in the schema. The validator (Phase 4) can provide a `warn` mode by catching ajv errors for `additionalProperties` and downgrading them to warnings.

2. **Workflow-level vs Node-level schema scope**
   - What we know: Section 9.1 shows workflow-level LOGIC.md with `global`, `nodes`, `edges` -- these are additional root properties not present in node-level files.
   - What's unclear: Whether one schema covers both or if they are separate schemas.
   - Recommendation: Use a single `LogicSpec` type that includes all root properties. Both workflow-level and node-level files parse to the same type, just with different fields populated. This keeps the type system simple.

3. **Should the types live in `src/` or at the package root?**
   - What we know: Current `packages/core/` has `index.ts` at the root, tsconfig `rootDir` is `.`.
   - Recommendation: Add a `src/` directory for the new type files. Update `rootDir` or adjust the barrel export. This keeps the package root clean as the type system grows.

## Sources

### Primary (HIGH confidence)
- LOGIC.md Specification v1.0 (`/Users/rainierpotgieter/development/modular9/docs/LOGIC-md-Specification-v1.0.md`) - Full spec read, all sections analyzed
- [Ajv TypeScript guide](https://ajv.js.org/guide/typescript.html) - JSONSchemaType limitations, type guard behavior
- [Ajv schema language guide](https://ajv.js.org/guide/schema-language.html) - Draft-07 recommended, import patterns

### Secondary (MEDIUM confidence)
- [Ajv strict mode docs](https://ajv.js.org/strict-mode.html) - Strict mode defaults in v8
- [ajv-formats npm](https://www.npmjs.com/package/ajv-formats) - URI/duration format support

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ajv already installed, draft-07 is well-documented standard
- Architecture: HIGH - type hierarchy directly maps from the spec with no ambiguity
- Pitfalls: HIGH - based on known TypeScript strict mode + ESM + ajv interactions

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable domain, no fast-moving dependencies)
