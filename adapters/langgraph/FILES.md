# File Manifest — @logic-md/langgraph-adapter

## Overview

Complete list of all files created for the experimental LangGraph adapter.

**Location:** `/Users/rainierpotgieter/development/logic-md/adapters/langgraph/`

**Status:** EXPERIMENTAL (Proof-of-Concept, 4-6 weeks)

## Core Implementation

### Source Code

| File | Purpose | Lines |
|------|---------|-------|
| `src/types.ts` | Type definitions (StateGraphNode, StateGraphEdge, etc.) | ~160 |
| `src/adapter.ts` | Core conversion logic (parse → compile → graph) | ~280 |
| `src/index.ts` | Public API exports | ~23 |

### Tests

| File | Purpose | Test Cases |
|------|---------|-----------|
| `src/__tests__/adapter.test.ts` | Comprehensive test suite | 16+ |

## Configuration

| File | Purpose | Notes |
|------|---------|-------|
| `package.json` | NPM package config, dependencies, scripts | Private package |
| `tsconfig.json` | TypeScript strict mode configuration | ES2022 target |
| `tsup.config.ts` | Build configuration (bundles to dist/) | ESM format |
| `vitest.config.ts` | Test runner configuration | ~80% coverage target |
| `.gitignore` | Git ignore patterns | Includes dist/, node_modules/ |

## Documentation

| File | Purpose | Audience |
|------|---------|----------|
| `README.md` | User-facing documentation | Users/integrators |
| `QUICKSTART.md` | 5-minute getting started guide | New users |
| `ARCHITECTURE.md` | Technical deep-dive and design | Developers/contributors |
| `STATUS.md` | Project status and roadmap | Team/stakeholders |
| `CONTRIBUTING.md` | Contribution guidelines | Contributors |
| `FILES.md` | This file — manifest of all files | Documentation reference |

## Examples

| File | Purpose | Lines |
|------|---------|-------|
| `examples/basic-usage.ts` | Runnable example with detailed comments | ~120 |

## Project Structure

```
adapters/langgraph/
├── src/
│   ├── types.ts                          # Type definitions
│   ├── adapter.ts                        # Core logic
│   ├── index.ts                          # Public API
│   └── __tests__/
│       └── adapter.test.ts               # Test suite
├── examples/
│   └── basic-usage.ts                    # Usage example
├── package.json                          # Package config
├── tsconfig.json                         # TypeScript config
├── tsup.config.ts                        # Build config
├── vitest.config.ts                      # Test config
├── .gitignore                            # Git ignore
├── README.md                             # User docs
├── QUICKSTART.md                         # Getting started
├── ARCHITECTURE.md                       # Technical design
├── STATUS.md                             # Project status
├── CONTRIBUTING.md                       # Contribution guide
└── FILES.md                              # This file
```

## File Descriptions

### src/types.ts

**Exports:**

- `StateGraphNode` — Represents a compiled step as a graph node
- `StateGraphEdge` — Represents a dependency between steps
- `StateGraphDefinition` — Complete serializable graph structure
- `AdapterOptions` — Configuration options for the adapter
- `AdapterError` — Error class for adapter-specific failures

**Key Types:**

```typescript
interface StateGraphDefinition {
  nodes: StateGraphNode[]
  edges: StateGraphEdge[]
  entryPoint: string
  endNodes: string[]
  metadata: { ... }
}
```

**Responsibility:** Define the data structures that represent a LOGIC.md workflow as a LangGraph-compatible state graph.

### src/adapter.ts

**Exports:**

- `toStateGraphFromContent(spec, options)` — High-level API (parse + convert)
- `toStateGraphFromSpec(spec, options)` — Low-level API (convert only)

**Functions:**

1. `toStateGraphFromContent()` — Parses LOGIC.md content, validates, and converts
2. `toStateGraphFromSpec()` — Converts a pre-parsed LogicSpec to graph definition
3. `buildGraphDefinition()` — Internal: maps compiled workflow to graph nodes/edges
4. `findDagLevel()` — Internal: locates a step's DAG level

**Responsibility:** Implement the core conversion pipeline:

```
LOGIC.md Content
  ↓ parse()
LogicSpec
  ↓ validate()
  ↓ resolve()
DAG + LogicSpec
  ↓ compileWorkflow()
CompiledWorkflow + DAG
  ↓ buildGraphDefinition()
StateGraphDefinition
```

### src/index.ts

**Exports:**

- `toStateGraph()` — Alias for toStateGraphFromContent (main API)
- `toStateGraphFromContent()` — Parse and convert
- `toStateGraphFromSpec()` — Convert pre-parsed spec
- Type exports: `StateGraphDefinition`, `StateGraphNode`, `StateGraphEdge`, `AdapterOptions`
- `AdapterError` — Error class

**Responsibility:** Public API surface. Users import from this file.

### src/__tests__/adapter.test.ts

**Test Suites:**

1. `toStateGraphFromContent()` tests
   - Single-step specs
   - Linear multi-step specs
   - Branching DAGs
   - Quality gate capture
   - Retry policy capture
   - Error handling (invalid specs, cycles)
   - Non-strict mode warnings

2. `toStateGraphFromSpec()` tests
   - Pre-parsed/validated specs
   - Specs with descriptions and metadata

3. Complex workflows
   - Diamond DAG patterns
   - Multiple end nodes

4. Edge cases
   - No output schema
   - Input schema present
   - Metadata exclusion

**Test Framework:** Vitest with standard assertions

**Responsibility:** Verify all conversion paths work correctly and edge cases are handled.

### package.json

**Key Fields:**

- `name: "@logic-md/langgraph-adapter"` — Package identifier
- `version: "1.0.0-experimental.0"` — Prerelease version
- `private: true` — Not published to npm
- `type: "module"` — ESM format
- `main: "./dist/index.js"` — Entry point (after build)
- `types: "./dist/index.d.ts"` — TypeScript definitions

**Scripts:**

```json
"build": "tsup",
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

**Dependencies:**

- `@logic-md/core` (workspace: *) — Required
- `@langchain/langgraph` (peer, optional) — For type info only

**Responsibility:** Define package metadata, build process, and dependencies.

### tsconfig.json

**Key Options:**

- `target: "ES2022"` — Modern JavaScript target
- `module: "ESNext"` — ESM format
- `moduleResolution: "NodeNext"` — Node.js module resolution
- `strict: true` — Full type checking
- `declaration: true` — Emit .d.ts files
- `outDir: "./dist"` — Build output directory

**Responsibility:** Configure TypeScript compiler for strict, modern, ESM output.

### tsup.config.ts

**Configuration:**

- `entry: ["src/index.ts"]` — Single entry point
- `format: ["esm"]` — ESM only (no CommonJS)
- `dts: true` — Generate type definitions
- `splitting: false` — Single output bundle
- `sourcemap: true` — Include source maps

**Responsibility:** Configure the build process. Outputs to `dist/index.js` and `dist/index.d.ts`.

### vitest.config.ts

**Configuration:**

- `environment: "node"` — Run in Node.js
- `globals: true` — Global test/describe/it
- Coverage: 80% threshold on lines/functions/branches/statements

**Responsibility:** Configure test runner and coverage targets.

### .gitignore

**Ignored Patterns:**

- `node_modules/` — Dependencies
- `dist/` — Build output
- `.vscode/`, `.idea/` — IDE files
- `*.swp`, `*.swo`, `*~` — Editor backups
- `.env`, `.env.local` — Environment files
- `coverage/` — Test coverage reports

**Responsibility:** Keep repo clean of build artifacts and local files.

### README.md

**Sections:**

1. **Status** — EXPERIMENTAL badge
2. **What It Does** — High-level description
3. **Current Limitations** — Phase 1 scope
4. **Installation** — npm install
5. **Usage** — Code examples
6. **API Reference** — toStateGraph() signature
7. **Architecture** — Layer overview
8. **Testing** — How to run tests
9. **Roadmap** — Phase 2-4 plans
10. **Known Issues** — Documented limitations
11. **Contributing** — Link to CONTRIBUTING.md
12. **License** — MIT

**Audience:** Users and integrators

**Responsibility:** Primary user-facing documentation.

### QUICKSTART.md

**Sections:**

1. **Installation** — npm install
2. **Build** — npm run build
3. **Run Tests** — npm test
4. **Basic Usage** — 5-line example
5. **Common Tasks** — File conversion, error handling, inspection
6. **Next Steps** — Links to deeper docs
7. **Troubleshooting** — FAQ

**Audience:** New users

**Responsibility:** Get users productive in 5 minutes.

### ARCHITECTURE.md

**Sections:**

1. **Overview** — Design philosophy
2. **Data Flow** — Parse → compile → convert pipeline
3. **Key Structures** — LogicSpec, CompiledStep, StateGraphDefinition
4. **Conversion Algorithm** — Step-by-step walkthrough
5. **Error Handling** — Error types and handling strategies
6. **Limitations** — What Phase 1 doesn't do
7. **Future Phases** — Phase 2-4 roadmap
8. **Testing Strategy** — What's tested
9. **Performance** — Timing expectations
10. **References** — Links to related docs

**Audience:** Developers, contributors, integrators

**Responsibility:** Deep technical documentation.

### STATUS.md

**Sections:**

1. **Project Status** — Experimental, 4-6 weeks
2. **What Was Built** — Core deliverables checklist
3. **Current Capabilities** — What Phase 1 implements (✅)
4. **Limitations** — What it doesn't do (❌)
5. **Test Coverage** — 16+ test cases
6. **API Example** — Code snippet
7. **Next Steps** — Phase 2 roadmap
8. **Development Guidelines** — For contributors
9. **Experimental Caveats** — Important warnings
10. **Success Criteria** — Phase 1 goals
11. **Project Structure** — File listing
12. **Related Files** — Links to other docs

**Audience:** Team, stakeholders, maintainers

**Responsibility:** Project status and roadmap documentation.

### CONTRIBUTING.md

**Sections:**

1. **What to Contribute** — In-scope vs. out-of-scope
2. **Development Setup** — npm install, npm build, npm test
3. **Code Standards** — TypeScript, Biome, coverage
4. **Testing** — Test patterns and requirements
5. **Before Submission** — Pre-commit checklist
6. **Experimental Nature** — API/feature stability warnings
7. **Questions** — How to get help

**Audience:** Contributors

**Responsibility:** Contribution guidelines and expectations.

### examples/basic-usage.ts

**Structure:**

1. **Preamble** — Comments explaining the example
2. **LOGIC.md Content** — Complete spec as string
3. **Main Function** — Parse, convert, display graph
4. **Console Output** — Pretty-printed results
5. **Comments** — Explain each step

**Lines:** ~120

**Runnable:** Yes (requires ts-node or compilation)

**Responsibility:** Provide a complete, runnable example of adapter usage.

## Build & Distribution

### How to Build

```bash
npm run build
```

Compiles TypeScript → `dist/` using tsup.

**Output Files:**

- `dist/index.js` — Main bundle (ESM)
- `dist/index.d.ts` — Type definitions
- `dist/*.js.map` — Source maps
- `dist/*.d.ts.map` — Type definition maps

### How to Test

```bash
npm test
```

Runs vitest suite, generates coverage reports.

### How to Type-Check

```bash
npm run typecheck
```

Runs tsc in check-only mode.

## File Statistics

| Category | Count | Purpose |
|----------|-------|---------|
| Source Files | 3 | Core implementation |
| Test Files | 1 | 16+ test cases |
| Config Files | 4 | Build, test, TypeScript |
| Documentation | 6 | User, technical, project |
| Examples | 1 | Runnable usage |
| Metadata | 2 | .gitignore, FILES.md |
| **Total** | **17** | |

## Dependency Graph

```
src/index.ts
  ↓ exports
src/adapter.ts
  ├── uses: @logic-md/core (parse, validate, resolve, compileWorkflow)
  └── uses: src/types.ts
src/types.ts
  ├── imports: @logic-md/core (LogicSpec, CompiledWorkflow, etc.)
  └── defines: StateGraphDefinition and related types
```

## Integration Points

### Imports From @logic-md/core

```typescript
import {
  parse,                // Parse LOGIC.md content
  validate,             // Validate LogicSpec
  compileWorkflow,      // Compile steps with metadata
  resolve,              // Resolve step dependencies (DAG)
} from "@logic-md/core";

import type {
  LogicSpec,            // Parsed spec
  CompiledWorkflow,     // Compiled steps
  CompiledStep,         // Single compiled step
  WorkflowContext,      // Execution context
} from "@logic-md/core";
```

### Exports to Consumers

```typescript
export {
  toStateGraphFromContent,    // Main API
  toStateGraphFromSpec,       // Lower-level API
  type StateGraphDefinition,  // Return type
  type StateGraphNode,        // Node structure
  type StateGraphEdge,        // Edge structure
  type AdapterOptions,        // Configuration
  AdapterError,               // Error class
};
```

## Next Steps

1. **Run `npm install`** to install dependencies
2. **Run `npm run build`** to compile TypeScript
3. **Run `npm test`** to verify all tests pass
4. **Read `README.md`** for user documentation
5. **Read `ARCHITECTURE.md`** for technical details

---

**Created:** 2026-04-10  
**Status:** EXPERIMENTAL (4-6 week proof-of-concept)  
**License:** MIT
