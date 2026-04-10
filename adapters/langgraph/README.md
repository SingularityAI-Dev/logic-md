# @logic-md/langgraph-adapter

**STATUS: EXPERIMENTAL** (4-6 week proof-of-concept)

A proof-of-concept adapter that bridges compiled LOGIC.md specifications into LangGraph StateGraph definitions.

## What It Does

This adapter converts a LOGIC.md reasoning specification into a graph representation compatible with [LangGraph](https://github.com/langchain-ai/langgraph), an agentic framework for building stateful AI applications with explicit control flow.

**Input:** A LOGIC.md spec (YAML frontmatter + markdown)
**Output:** A serializable StateGraphDefinition describing nodes, edges, entry points, and metadata

## Current Limitations

This is an experimental integration. The following features are **not yet supported**:

- **Branching:** Step-level conditional branches (`branches[]`) are parsed but not yet mapped to graph edges
- **Quality gates:** Global and step-level quality gates are captured in node metadata but not enforced at graph level
- **Retry loops:** RetryPolicy is extracted but not wired into the graph structure
- **Parallel execution:** Parallel step groups are treated as sequential
- **Decision trees:** Inline decision trees (Section 7) are not yet supported
- **Fallback strategies:** Escalation chains and graceful degradation rules are stored but not enacted

These features are candidates for Phase 2 once the core pattern is validated.

## Installation

```bash
npm install @logic-md/langgraph-adapter @logic-md/core @langchain/langgraph
```

## Usage

### Basic Example

```typescript
import { toStateGraph } from "@logic-md/langgraph-adapter";
import { parse, validate, compileWorkflow } from "@logic-md/core";

const logicMdContent = `
---
spec_version: "1.0"
name: "analysis-workflow"
reasoning:
  strategy: "cot"
  max_iterations: 3
steps:
  analyze:
    instructions: "Analyze the input and identify key themes."
    output_schema:
      type: "object"
      properties:
        themes:
          type: "array"
          items:
            type: "string"
  synthesize:
    needs: ["analyze"]
    instructions: "Synthesize themes into a coherent summary."
    output_schema:
      type: "object"
      properties:
        summary:
          type: "string"
---

Reasoning workflow for analysis tasks.
`;

// Parse and validate
const parseResult = parse(logicMdContent);
if (!parseResult.ok) {
  console.error("Parse failed:", parseResult.errors);
  process.exit(1);
}

const validateResult = validate(parseResult.data);
if (!validateResult.ok) {
  console.error("Validation failed:", validateResult.errors);
  process.exit(1);
}

// Compile the workflow
const compiled = compileWorkflow(validateResult.data, {
  currentStep: "analyze",
  previousOutputs: {},
  input: { text: "sample" },
  attemptNumber: 1,
  branchReason: null,
  previousFailureReason: null,
  totalSteps: 2,
  completedSteps: [],
  dagLevels: [["analyze"], ["synthesize"]],
});

// Convert to StateGraph definition
const graphDef = toStateGraph(validateResult.data);

console.log("Graph definition:", JSON.stringify(graphDef, null, 2));
// {
//   "nodes": [
//     {
//       "name": "analyze",
//       "promptSegment": "Analyze the input and identify key themes.",
//       "outputSchema": { "type": "object", ... },
//       "metadata": { "stepName": "analyze", "dagLevel": 0 }
//     },
//     {
//       "name": "synthesize",
//       "promptSegment": "Synthesize themes into a coherent summary.",
//       "outputSchema": { "type": "object", ... },
//       "metadata": { "stepName": "synthesize", "dagLevel": 1 }
//     }
//   ],
//   "edges": [
//     { "from": "analyze", "to": "synthesize" }
//   ],
//   "entryPoint": "analyze",
//   "endNodes": ["synthesize"]
// }
```

### With LangGraph (Advanced)

The returned definition is designed to be consumed by a LangGraph runtime adapter (not yet included):

```typescript
import { StateGraph } from "@langchain/langgraph";

const graphDef = toStateGraph(logicSpec);

// Build the actual StateGraph from the definition
const graph = new StateGraph({
  channels: {
    input: { value: () => null },
    output: { value: () => null },
  },
});

// Add nodes from the definition
graphDef.nodes.forEach((node) => {
  graph.addNode(node.name, async (state) => {
    // Call LLM with node.promptSegment as context
    // Validate output against node.outputSchema
    return { output: modelResponse };
  });
});

// Add edges from the definition
graphDef.edges.forEach((edge) => {
  graph.addEdge(edge.from, edge.to);
});

graph.setEntryPoint(graphDef.entryPoint);
graphDef.endNodes.forEach((nodeName) => {
  graph.addEdge(nodeName, "__end__");
});

const compiled = graph.compile();
```

## API Reference

### `toStateGraph(spec, options?): StateGraphDefinition`

Convert a LOGIC.md specification into a state graph definition.

**Parameters:**

- `spec: LogicSpec` — The LOGIC.md specification object (parsed and validated)
- `options?: AdapterOptions` — (optional) Adapter configuration
  - `includeMetadata?: boolean` — Include full step metadata (default: true)
  - `strict?: boolean` — Throw on validation errors (default: false)

**Returns:** `StateGraphDefinition` object with nodes, edges, entry point, and end nodes.

**Throws:** `AdapterError` if `strict: true` and validation fails.

## Architecture

The adapter is built in three layers:

1. **Parser** (`src/adapter.ts`): Uses @logic-md/core to parse and compile the spec
2. **Converter** (`src/index.ts`): Maps CompiledStep and DAG structure to graph nodes/edges
3. **Definition** (`src/index.ts`): Serializes to StateGraphDefinition (LangGraph-agnostic)

## Testing

Run the test suite:

```bash
npm test
```

Tests cover:

- Single-step specs → verify 1 node + entry→node→END
- Multi-step DAGs → verify correct edges and levels
- Quality gates → verify gates are captured in metadata
- Invalid specs → verify error handling

## Development Roadmap

**Phase 1 (Current):** Core DAG→graph mapping
- [x] Linear step sequences
- [x] Multi-level DAGs
- [x] Metadata capture
- [x] Output schema validation
- [ ] Basic testing

**Phase 2 (4-6 weeks):** Branching and control flow
- [ ] Step-level conditional branches
- [ ] Branch metadata recording
- [ ] Decision tree support
- [ ] Runtime branch resolution

**Phase 3 (future):** Resilience and verification
- [ ] Quality gate enforcement at graph level
- [ ] Retry loop wiring
- [ ] Self-verification integration
- [ ] Escalation chain routing

**Phase 4 (future):** Integration
- [ ] LangGraph StateGraph builder (not just definition)
- [ ] Streaming support
- [ ] Tool/action integration
- [ ] State channel schema derivation

## Known Issues

1. **No branch support yet** — Specs with conditional branches will compile but branches will be ignored
2. **Quality gates are advisory** — Gates are included in metadata but not enforced at the graph level
3. **No retry wiring** — Retry policies are parsed but not integrated into graph transitions
4. **Parallel steps treated as sequential** — Parallel execution is not modeled in the graph

## Contributing

This is an experimental proof-of-concept. Contributions are welcome for:

- Bug reports and test cases for the current Phase 1 features
- Feedback on the API design
- Suggestions for Phase 2 branching support

See [CLAUDE.md](../../CLAUDE.md) for project standards.

## License

MIT
