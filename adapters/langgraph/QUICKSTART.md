# Quick Start Guide

Get the LangGraph adapter up and running in 5 minutes.

## Installation

```bash
cd adapters/langgraph
npm install
```

## Build

```bash
npm run build
```

This compiles TypeScript to `dist/` using tsup.

## Run Tests

```bash
npm test
```

Runs the vitest suite (~16 test cases, ~80% coverage).

## Basic Usage

```typescript
import { toStateGraphFromContent } from "@logic-md/langgraph-adapter";

const logicMdSpec = `---
spec_version: "1.0"
name: "my-workflow"
steps:
  step1:
    instructions: "Do something."
  step2:
    needs: ["step1"]
    instructions: "Do next thing."
---

My workflow.
`;

const graph = toStateGraphFromContent(logicMdSpec);

console.log(graph.nodes);   // Array of nodes
console.log(graph.edges);   // Array of edges
console.log(graph.entryPoint); // "step1"
console.log(graph.endNodes);   // ["step2"]
```

Output:

```json
{
  "nodes": [
    {
      "name": "step1",
      "promptSegment": "Do something.",
      "outputSchema": null,
      "metadata": {
        "stepName": "step1",
        "dagLevel": 0,
        "branchTaken": null,
        "attemptNumber": 1,
        "totalSteps": 2
      }
    },
    {
      "name": "step2",
      "promptSegment": "Do next thing.",
      "outputSchema": null,
      "metadata": {
        "stepName": "step2",
        "dagLevel": 1,
        "branchTaken": null,
        "attemptNumber": 1,
        "totalSteps": 2
      }
    }
  ],
  "edges": [
    { "from": "step1", "to": "step2" }
  ],
  "entryPoint": "step1",
  "endNodes": ["step2"],
  "metadata": {
    "workflowName": "my-workflow",
    "totalSteps": 2,
    "totalLevels": 2
  }
}
```

## Run Example

```bash
npx ts-node examples/basic-usage.ts
```

(Requires ts-node. Alternatively, build and run the compiled JS.)

## Common Tasks

### Convert a LOGIC.md file

```typescript
import fs from "fs";
import { toStateGraphFromContent } from "@logic-md/langgraph-adapter";

const content = fs.readFileSync("my-workflow.md", "utf-8");
const graph = toStateGraphFromContent(content);

// Serialize to JSON
console.log(JSON.stringify(graph, null, 2));
```

### Handle errors

```typescript
try {
  const graph = toStateGraphFromContent(badContent, { strict: true });
} catch (error) {
  if (error instanceof AdapterError) {
    console.error("Adapter error:", error.message);
  } else {
    console.error("Unknown error:", error);
  }
}
```

### Pre-parse and validate separately

```typescript
import { parse, validate } from "@logic-md/core";
import { toStateGraphFromSpec } from "@logic-md/langgraph-adapter";

const parseResult = parse(content);
if (!parseResult.ok) {
  console.error("Parse error:", parseResult.errors);
  process.exit(1);
}

const validateResult = validate(parseResult.data);
if (!validateResult.ok) {
  console.error("Validation error:", validateResult.errors);
  process.exit(1);
}

const graph = toStateGraphFromSpec(validateResult.data);
```

### Inspect graph structure

```typescript
const graph = toStateGraphFromContent(spec);

// Entry point
console.log("Starting at:", graph.entryPoint);

// All nodes
graph.nodes.forEach(node => {
  console.log(`- ${node.name} (level ${node.metadata.dagLevel})`);
});

// All dependencies
graph.edges.forEach(edge => {
  console.log(`${edge.from} depends on ${edge.to}`);
});

// Terminal nodes
console.log("Ending with:", graph.endNodes);
```

## Next Steps

1. **Read the README** for detailed API docs: `README.md`
2. **Explore the examples** for real-world usage: `examples/`
3. **Understand the architecture** for deeper insight: `ARCHITECTURE.md`
4. **Check the tests** for more usage patterns: `src/__tests__/adapter.test.ts`
5. **Review the status** for what's implemented: `STATUS.md`

## Troubleshooting

### "Module not found: @logic-md/core"

Run `npm install`. The adapter depends on @logic-md/core via workspace reference.

### "Cannot find module '.../dist/index.js'"

Run `npm run build` to compile TypeScript to JavaScript.

### Tests failing

```bash
npm run typecheck    # Check for TypeScript errors
npm run build        # Rebuild
npm test             # Run tests again
```

### "strict mode" errors with invalid specs

Use `{ strict: false }` to get warnings instead of throws:

```typescript
const graph = toStateGraphFromContent(badSpec, { strict: false });
// Warnings logged to console, graph is partial
```

## Known Limitations (Phase 1)

- No branch support (conditional routing not yet mapped)
- Quality gates are descriptive only (not enforced)
- Retry policies are captured but not integrated
- No parallel execution modeling
- No decision tree support

See `STATUS.md` for details.

## Support

- **API Questions** → See `README.md`
- **Architecture Deep-Dive** → See `ARCHITECTURE.md`
- **Contributing** → See `CONTRIBUTING.md`
- **Bug Reports** → Open an issue in the main repo

---

That's it! You're ready to convert LOGIC.md specs to LangGraph definitions.
