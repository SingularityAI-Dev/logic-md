import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const specMarkdown = `# LOGIC.md Specification Summary

## What is LOGIC.md?

LOGIC.md is a structured markdown format for defining AI agent reasoning workflows.
Files use YAML frontmatter (between --- delimiters) to declare a logic spec,
followed by an optional markdown body.

## Frontmatter Structure

\`\`\`yaml
---
name: string                  # Required: workflow identifier
description: string           # Optional: human-readable description
version: string               # Optional: semver version string
author: string                # Optional: author name

reasoning:                    # Optional: global reasoning configuration
  strategy: cot|react|tot|got|plan-execute|custom
  max_iterations: number
  temperature: number

steps:                        # Optional: named reasoning steps
  step_name:
    description: string
    prompt: string            # Prompt template with {{ expression }} interpolation
    needs: [step1, step2]     # Dependencies (creates DAG)
    mode: sequential|parallel|conditional
    on_fail: retry|escalate|skip|abort|revise
    max_retries: number

quality_gates:                # Optional: validation invariants
  - check: string
    severity: error|warning|info
    on_fail: retry|escalate|skip|abort

imports:                      # Optional: import other LOGIC.md files
  - ref: ./path/to/file.logic.md
    as: namespace             # Access imported steps as namespace.step_name

context:                      # Optional: context injection
  key: value
---
\`\`\`

## Key Concepts

- **Steps**: Named reasoning stages forming a directed acyclic graph (DAG)
- **Expressions**: \`{{ variable }}\` syntax for dynamic prompt interpolation
- **Quality Gates**: Invariants checked during or after execution
- **Imports**: Compose workflows by referencing other LOGIC.md files
- **Reasoning Strategies**: cot (chain-of-thought), react (reason+act), tot (tree-of-thought),
  got (graph-of-thought), plan-execute, or custom

## Step Execution Modes

- \`sequential\`: Steps run one at a time in dependency order
- \`parallel\`: Independent steps run concurrently
- \`conditional\`: Step runs only if a condition evaluates to true

## Available MCP Tools

- \`logic_md_parse\`: Parse content into typed spec (no schema validation)
- \`logic_md_validate\`: Validate content against JSON Schema
- \`logic_md_lint\`: Run advisory lint rules (missing descriptions, unreachable steps, unused imports)
- \`logic_md_list_templates\`: List all bundled LOGIC.md templates

## Available MCP Resources

- \`logic-md://schema\`: Full JSON Schema for frontmatter validation
- \`logic-md://spec\`: This specification summary
`;

export function registerSpecResource(server: McpServer): void {
	server.registerResource(
		"logic-md-spec",
		"logic-md://spec",
		{
			mimeType: "text/markdown",
			description: "LOGIC.md specification summary",
		},
		async () => ({
			contents: [
				{
					uri: "logic-md://spec",
					mimeType: "text/markdown",
					text: specMarkdown,
				},
			],
		}),
	);
}
