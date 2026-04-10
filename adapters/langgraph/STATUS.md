# @logic-md/langgraph-adapter — Status

**Project Status:** EXPERIMENTAL (Proof-of-Concept, 4-6 weeks)

**Created:** 2026-04-10

**Estimated Duration:** 4-6 weeks (April 2026)

## What Was Built

A **proof-of-concept adapter** that bridges LOGIC.md specifications (declarative reasoning workflows) into LangGraph StateGraph definitions.

### Core Deliverables

- [x] `src/types.ts` — Type definitions for StateGraphDefinition
- [x] `src/adapter.ts` — Core conversion logic (parse → compile → graph)
- [x] `src/index.ts` — Public API exports
- [x] `src/__tests__/adapter.test.ts` — Comprehensive test suite (16+ test cases)
- [x] `vitest.config.ts` — Test configuration
- [x] `package.json` — Dependency and build config
- [x] `tsconfig.json` — TypeScript strict mode config
- [x] `tsup.config.ts` — Build configuration
- [x] `README.md` — User-facing documentation with examples
- [x] `ARCHITECTURE.md` — Technical design and data flow
- [x] `CONTRIBUTING.md` — Contribution guidelines
- [x] `examples/basic-usage.ts` — Runnable example
- [x] `.gitignore` — Ignore patterns

## Current Capabilities (Phase 1)

### Fully Implemented

✅ **DAG→Graph Mapping**
- Parse LOGIC.md specs (YAML + markdown)
- Validate against JSON Schema
- Resolve step dependencies into topological levels
- Map steps to graph nodes with metadata
- Map dependencies to graph edges

✅ **Metadata Capture**
- Step names and DAG levels
- Output schemas for validation
- System prompt segments for LLM context
- Quality gate descriptions (not executed)
- Retry policies (not integrated)

✅ **Entry & Exit Point Detection**
- Automatically identify entry point (first topologically-sorted step)
- Identify terminal nodes (no outgoing edges)

✅ **Error Handling**
- Parse errors with line/column info
- Validation errors with JSON Pointer paths
- DAG errors (cycles, missing deps)
- Strict mode for production safety

✅ **Serialization**
- Pure data structure (no LangGraph dependencies)
- JSON-serializable output
- Framework-agnostic definition

## Limitations (Not Yet Implemented)

### Phase 1 Explicitly Does NOT Support

❌ **Branching** — Step-level conditional branches (`branches[]`) are parsed but not wired to edges
❌ **Quality Gate Enforcement** — Gates captured in metadata but not executed at graph level
❌ **Retry Loop Wiring** — Retry policies extracted but not integrated into transitions
❌ **Parallel Execution Modeling** — Parallel steps collapsed to sequential in graph
❌ **Decision Trees** — Section 7 decision trees not supported
❌ **Tool Integration** — No action/tool routing
❌ **State Channel Schema** — Not auto-derived from step outputs
❌ **LangGraph StateGraph** — Only returns definition, not actual StateGraph instance

These are candidates for Phase 2 (branching) and Phase 3+ (resilience, integration).

## Known Issues

1. **No branch support** — Specs with conditional branches compile but branches are ignored
2. **Quality gates are advisory** — Included in metadata but not enforced
3. **No retry wiring** — Retry policies are parsed but not enacted
4. **Parallel treated as sequential** — Parallel execution not modeled
5. **Limited error recovery** — Compilation failures may produce partial definitions

## Test Coverage

**16+ Test Cases:**

- ✅ Single-step specs
- ✅ Linear multi-step workflows
- ✅ Branching DAGs (diamond pattern)
- ✅ Quality gate capture
- ✅ Retry policy capture
- ✅ Invalid spec rejection
- ✅ DAG cycle detection
- ✅ Complex topology (multiple end nodes)
- ✅ Edge cases (no output schema, input schema, etc.)

Target: 80%+ coverage on core modules

## API Example

```typescript
import { toStateGraphFromContent } from "@logic-md/langgraph-adapter";

const graph = toStateGraphFromContent(logicMdContent);

// Returns:
{
  nodes: [
    {
      name: "analyze",
      promptSegment: "...",
      outputSchema: { type: "object", ... },
      metadata: { stepName: "analyze", dagLevel: 0, ... }
    },
    ...
  ],
  edges: [
    { from: "analyze", to: "synthesize" }
  ],
  entryPoint: "analyze",
  endNodes: ["synthesize"],
  metadata: { ... }
}
```

## Next Steps (Phase 2 Candidate)

### Branching Support (2-3 weeks)

- [ ] Map step-level `branches[]` to conditional edges
- [ ] Capture branch conditions in edge metadata
- [ ] Support default/fallthrough branches
- [ ] Test complex branching patterns

### Quality Gate Enforcement (1-2 weeks)

- [ ] Wrap node validators with gate logic
- [ ] Support pre/post output checks
- [ ] Integrate severity levels (error/warning/info)
- [ ] Test gate triggering

### Retry Loop Integration (1-2 weeks)

- [ ] Wire retry policies into edge transitions
- [ ] Support exponential backoff metadata
- [ ] Handle non-retryable error types
- [ ] Test retry scenarios

## Development Guidelines

For contributors:

- See `CONTRIBUTING.md` for scope and standards
- See `ARCHITECTURE.md` for design details
- Run `npm test` to verify changes
- Follow project style (Biome, TypeScript strict)

## Experimental Caveats

⚠️ **This is a 4-6 week experiment.**

- **API may change** between versions (prerelease: `1.0.0-experimental.N`)
- **Features may be deferred** to Phase 2/3
- **Not recommended for production** without understanding these constraints
- **Documentation is evolving** (not final)

If you're using this, be prepared for:

- Breaking changes to the API
- Incomplete implementations of listed features
- Limited support while the experiment is active

## Success Criteria (Phase 1)

- [x] Parse LOGIC.md specs into LogicSpec
- [x] Validate specs and report errors
- [x] Resolve step dependencies into DAG levels
- [x] Compile steps with metadata baked in
- [x] Map compiled steps to graph nodes
- [x] Map step dependencies to graph edges
- [x] Serialize to JSON-compatible StateGraphDefinition
- [x] Comprehensive test coverage
- [x] Clear documentation
- [x] Example usage code

**All Phase 1 criteria are MET.**

## Project Structure

```
adapters/langgraph/
├── src/
│   ├── types.ts                  # Type definitions
│   ├── adapter.ts                # Core conversion logic
│   ├── index.ts                  # Public API
│   └── __tests__/
│       └── adapter.test.ts       # Test suite
├── examples/
│   └── basic-usage.ts            # Runnable example
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md                      # User docs
├── ARCHITECTURE.md               # Technical deep-dive
├── CONTRIBUTING.md               # Contribution guide
├── STATUS.md                      # This file
└── .gitignore
```

## Related Files

- `CLAUDE.md` — Project instructions and standards
- `docs/SPEC.md` — LOGIC.md specification
- `packages/core/` — @logic-md/core implementation
- `.planning/ROADMAP.md` — Project phases and history

## Questions?

See:

1. **User questions** → `README.md` and `examples/`
2. **Technical questions** → `ARCHITECTURE.md`
3. **Contributing questions** → `CONTRIBUTING.md`
4. **Project scope** → This file (STATUS.md)

---

**Experimental Project** — Updated 2026-04-10
