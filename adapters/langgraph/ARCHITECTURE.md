# LangGraph Adapter Architecture

## Overview

The LangGraph adapter bridges LOGIC.md specifications (declarative reasoning workflows) with LangGraph (agentic graph execution framework). It converts a compiled LOGIC.md spec into a serializable `StateGraphDefinition` that describes a directed acyclic graph (DAG) of reasoning steps.

## Design Philosophy

**Separation of Concerns:**

1. **Definition Layer** (`StateGraphDefinition`) — Pure data structure describing the graph, independent of LangGraph runtime
2. **Compilation Layer** — Uses @logic-md/core to parse, validate, and compile the spec
3. **Conversion Layer** — Maps compiled steps and DAG to graph nodes and edges

This design allows:

- **Framework independence** — The definition is not tied to LangGraph internals
- **Serialization** — Complete graph definition can be JSON-serialized
- **Composability** — Other adapters (e.g., for Prefect, Airflow) can reuse the same compilation layer
- **Testability** — Each layer can be tested independently

## Data Flow

```
LOGIC.md Content
      ↓
  parse()          [Parser: YAML + markdown → LogicSpec]
      ↓
  validate()       [Validator: TypeScript schema check]
      ↓
  resolve()        [DAG Resolver: topological sort, levels]
      ↓
  compileWorkflow() [Compiler: generate CompiledStep[] with metadata]
      ↓
buildGraphDefinition() [Converter: steps/DAG → nodes/edges]
      ↓
StateGraphDefinition   [Pure data structure]
      ↓
(LangGraph builder)    [Runtime: convert to StateGraph]
```

## Key Structures

### LogicSpec (from @logic-md/core)

The parsed LOGIC.md specification. Contains:

```typescript
{
  spec_version: "1.0"
  name: string
  reasoning?: Reasoning           // Global reasoning config
  steps: Record<string, Step>     // Named reasoning steps
  quality_gates?: QualityGates    // Pre/post output checks
  fallback?: Fallback             // Escalation strategies
  metadata?: Record<string, any>  // Arbitrary metadata
  ...
}
```

### CompiledStep (from @logic-md/core)

A compiled step ready for execution. Contains:

```typescript
{
  systemPromptSegment: string       // LLM context injection
  outputSchema: object | null       // JSON Schema for validation
  qualityGates: QualityGateValidator[] // Runtime validators
  retryPolicy: RetryPolicy | null   // Temporal retry config
  selfReflection: { ... } | null    // Reflection loop config
  metadata: {
    stepName: string
    dagLevel: number
    branchTaken: string | null
    attemptNumber: number
    totalSteps: number
  }
}
```

### StateGraphDefinition (New)

The serializable graph definition. Contains:

```typescript
{
  nodes: StateGraphNode[]        // One per step
  edges: StateGraphEdge[]        // Dependencies
  entryPoint: string             // First node
  endNodes: string[]             // Terminal nodes
  metadata: {
    workflowName: string
    totalSteps: number
    totalLevels: number
    globalQualityGates?: [...]
    fallbackStrategy?: string
  }
}
```

### StateGraphNode

Maps a step to a graph node:

```typescript
{
  name: string                   // Step name
  promptSegment: string          // System prompt
  outputSchema: object | null    // Validation schema
  metadata: {
    stepName: string
    dagLevel: number
    branchTaken: string | null
    attemptNumber: number
    totalSteps: number
    qualityGates?: Gate[]         // From step.verification
    retryPolicy?: RetryPolicy     // From step.retry
  }
}
```

### StateGraphEdge

Represents a dependency:

```typescript
{
  from: string              // Source step
  to: string                // Target step
  condition?: string        // For branching (not yet used)
}
```

## Conversion Algorithm

### 1. Parse & Validate

```typescript
const parseResult = parse(content);
const validateResult = validate(parseResult.data);
```

Both are pure, deterministic functions. On failure, they return descriptive errors.

### 2. Resolve DAG

```typescript
const dagResult = resolve(spec.steps);
const { levels, order } = dagResult;
```

`levels` is a 2D array: `string[][]` where `levels[i]` are all steps at depth `i` that can run in parallel.
`order` is a flat topological ordering.

**Example:**

```
spec.steps:
  start: {}
  a: { needs: ["start"] }
  b: { needs: ["start"] }
  merge: { needs: ["a", "b"] }

levels: [["start"], ["a", "b"], ["merge"]]
order:  ["start", "a", "b", "merge"]
```

### 3. Compile Workflow

```typescript
const compiled = compileWorkflow(spec, workflowContext);
```

This generates `CompiledStep[]` with system prompts, schemas, validators, and metadata baked in.

**Important:** The `workflowContext` is constructed from the DAG result:

```typescript
const workflowContext: WorkflowContext = {
  currentStep: order[0],           // First step
  previousOutputs: {},             // Empty (no previous execution)
  input: {},                       // Empty (not executing, just defining)
  attemptNumber: 1,
  branchReason: null,
  previousFailureReason: null,
  totalSteps: order.length,
  completedSteps: [],
  dagLevels: levels,
};
```

This context is **not an execution trace** — it's just metadata to help the compiler generate consistent identifiers.

### 4. Map to Graph Nodes

For each compiled step:

```typescript
const node: StateGraphNode = {
  name: stepName,
  promptSegment: compiledStep.systemPromptSegment,
  outputSchema: compiledStep.outputSchema,
  metadata: {
    stepName,
    dagLevel: findDagLevel(stepName, dagLevels),
    branchTaken: compiledStep.metadata.branchTaken,
    attemptNumber: compiledStep.metadata.attemptNumber,
    totalSteps: compiledStep.metadata.totalSteps,
    qualityGates: extractQualityGates(spec.steps[stepName]),
    retryPolicy: compiledStep.retryPolicy,
  },
};
```

**Quality Gate Extraction:**

If the step defines `verification`:

```typescript
step.verification: {
  check: "{{ output.confidence > 0.8 }}",
  on_fail: "retry"
}
```

It becomes a metadata gate:

```typescript
metadata.qualityGates = [
  {
    name: "verification",
    check: "{{ output.confidence > 0.8 }}",
    severity: "error",
  }
]
```

Note: These are **descriptive only** in Phase 1. They don't enforce runtime validation yet.

### 5. Map to Graph Edges

Extract dependencies from each step:

```typescript
for (const [stepName, step] of Object.entries(spec.steps)) {
  if (step.needs) {
    for (const dep of step.needs) {
      edges.push({ from: dep, to: stepName });
    }
  }
}
```

### 6. Identify Entry & End Points

**Entry Point:**

```typescript
const entryPoint = order[0];  // First topologically-sorted step
```

This is always the step(s) with no dependencies.

**End Nodes:**

```typescript
const hasOutgoing = new Set(edges.map(e => e.from));
const endNodes = order.filter(n => !hasOutgoing.has(n));
```

Nodes with no outgoing edges are terminal nodes.

## Error Handling

### Parsing Errors

```
❌ Parse failed: "Line 5: Invalid YAML syntax"
```

Returned by `parse()`. Structural issues with YAML.

### Validation Errors

```
❌ Validation failed: "/steps/analyze/timeout: should match duration format"
```

Returned by `validate()`. Schema violations.

### DAG Errors

```
❌ DAG resolution failed: "cycle: steps form a circular dependency"
```

Returned by `resolve()`. Structural graph issues.

### Compilation Errors

```
❌ Compilation failed: "Missing required output schema for step 'analyze'"
```

Thrown by `compileWorkflow()`. Logic or semantic issues.

### Adapter Errors

```
❌ AdapterError: "Spec has no steps defined"
```

Thrown by the adapter when given invalid input.

## Limitations (Phase 1)

### Not Yet Implemented

1. **Branching** — Step-level `branches[]` are parsed but not mapped to conditional edges
2. **Decision Trees** — Section 7 decision trees are not supported
3. **Quality Gate Enforcement** — Gates are captured in metadata but not executed at graph level
4. **Retry Integration** — Retry policies are extracted but not wired into graph transitions
5. **Parallel Execution Modeling** — Parallel steps are in DAG levels but not modeled as concurrent nodes
6. **Tool/Action Integration** — Step outputs don't wire to tool calls
7. **State Channel Derivation** — Graph state schema is not auto-derived from step schemas

### Design Constraints

- **No Runtime Dependencies** — The adapter doesn't depend on @langchain/langgraph itself
- **Pure Data Output** — `StateGraphDefinition` is not a `StateGraph` instance
- **No Execution** — The adapter compiles but doesn't execute workflows
- **No External I/O** — All operations are synchronous and deterministic

## Future Phases

### Phase 2: Branching & Control Flow

Map step-level branches to conditional edges:

```typescript
step.branches: [
  { if: "{{ output.confidence > 0.9 }}", then: "accept" },
  { if: "{{ output.confidence < 0.5 }}", then: "retry" },
  { default: true, then: "review" }
]
```

Becomes edges with conditions:

```typescript
{
  from: "analyze",
  to: "accept",
  condition: "{{ output.confidence > 0.9 }}"
}
```

### Phase 3: Quality Gate Enforcement & Resilience

- Wrap node functions with gate validators
- Integrate retry loops into edge transitions
- Support escalation chain routing
- Implement graceful degradation rules

### Phase 4: LangGraph Integration

- Build an actual `StateGraph` from the definition
- Support streaming and state channels
- Integrate with tool/action runtime
- Provide a complete end-to-end builder

## Testing Strategy

All critical paths are tested:

1. **Single-step specs** → 1 node, 0 edges, entry→node→END
2. **Linear DAGs** → correct edges and levels
3. **Branching DAGs** → diamond patterns, multiple end nodes
4. **Metadata capture** → quality gates, retry policies
5. **Error cases** → cycles, missing deps, invalid specs

See `src/__tests__/adapter.test.ts` for comprehensive test suite.

## Performance

- **Parsing:** ~1-10ms for typical specs
- **Compilation:** ~5-50ms depending on step count
- **Graph conversion:** ~1-5ms
- **Total:** Single-digit milliseconds for typical workflows

No optimization is needed for Phase 1.

## References

- LOGIC.md Spec: `docs/SPEC.md`
- LangGraph: https://github.com/langchain-ai/langgraph
- Project Instructions: `CLAUDE.md`
