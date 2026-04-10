/**
 * Basic usage example for @logic-md/langgraph-adapter
 *
 * This example demonstrates:
 * 1. Creating a LOGIC.md specification
 * 2. Converting it to a StateGraphDefinition
 * 3. Inspecting the resulting graph structure
 */

import { toStateGraphFromContent } from "../src/index.js";

// Define a LOGIC.md specification as a string
const logicMdSpec = `---
spec_version: "1.0"
name: "content-analysis-workflow"
description: |
  A workflow for analyzing content through multiple reasoning stages.
  This demonstrates a linear pipeline with quality checks.

reasoning:
  strategy: "cot"
  max_iterations: 3
  temperature: 0.7

steps:
  extract:
    description: "Extract key information from input"
    instructions: |
      Analyze the provided content and extract:
      - Main topics
      - Key entities
      - Sentiment indicators

      Be thorough but concise.
    output_schema:
      type: "object"
      properties:
        topics:
          type: "array"
          items:
            type: "string"
        entities:
          type: "array"
          items:
            type: "object"
            properties:
              name:
                type: "string"
              type:
                type: "string"
        sentiment:
          type: "string"
          enum: ["positive", "negative", "neutral"]
      required: ["topics", "entities", "sentiment"]

  analyze:
    needs: ["extract"]
    description: "Analyze extracted information for patterns"
    instructions: |
      Using the extracted information:
      - Identify relationships between topics
      - Find recurring themes
      - Assess overall coherence

      Provide structured analysis.
    output_schema:
      type: "object"
      properties:
        patterns:
          type: "array"
          items:
            type: "string"
        theme_summary:
          type: "string"
        coherence_score:
          type: "number"
          minimum: 0
          maximum: 1
      required: ["patterns", "theme_summary", "coherence_score"]

  synthesize:
    needs: ["analyze"]
    description: "Synthesize findings into final summary"
    instructions: |
      Combine the analysis results into a coherent summary:
      - Synthesize main conclusions
      - Highlight key insights
      - Suggest related areas for exploration
    output_schema:
      type: "object"
      properties:
        summary:
          type: "string"
        key_insights:
          type: "array"
          items:
            type: "string"
        followup_questions:
          type: "array"
          items:
            type: "string"

quality_gates:
  pre_output:
    - name: "output_completeness"
      check: "{{ output.summary and output.key_insights }}"
      severity: "error"
    - name: "insight_count"
      check: "{{ output.key_insights.length >= 2 }}"
      severity: "warning"

fallback:
  strategy: "graceful_degrade"
---

# Content Analysis Workflow

This workflow performs multi-stage analysis of content through:

1. **Extract**: Information extraction phase
2. **Analyze**: Pattern recognition and relationship mapping
3. **Synthesize**: Final summary generation

Each stage validates its output and can trigger fallback behavior
if quality gates fail.
`;

// Main execution
async function main() {
  console.log("=== LangGraph Adapter Example ===\n");

  try {
    // Convert the LOGIC.md spec to a graph definition
    const graphDef = toStateGraphFromContent(logicMdSpec);

    console.log("Workflow Name:", graphDef.metadata.workflowName);
    console.log("Total Steps:", graphDef.metadata.totalSteps);
    console.log("Total Levels:", graphDef.metadata.totalLevels);
    console.log("Fallback Strategy:", graphDef.metadata.fallbackStrategy);
    console.log();

    // Display nodes
    console.log("--- Nodes ---");
    for (const node of graphDef.nodes) {
      console.log(`\n[${node.metadata.dagLevel}] ${node.name}`);
      console.log(`    Prompt: ${node.promptSegment.substring(0, 60)}...`);
      if (node.outputSchema) {
        console.log(
          `    Output: ${JSON.stringify(node.outputSchema.properties ? Object.keys(node.outputSchema.properties) : [])}`
        );
      }
    }

    // Display edges
    console.log("\n--- Dependencies ---");
    for (const edge of graphDef.edges) {
      console.log(`${edge.from} → ${edge.to}`);
    }

    // Display graph topology
    console.log("\n--- Topology ---");
    console.log(`Entry Point: ${graphDef.entryPoint}`);
    console.log(`End Nodes: ${graphDef.endNodes.join(", ")}`);

    // Display quality gates
    if (graphDef.metadata.globalQualityGates) {
      console.log("\n--- Quality Gates ---");
      for (const gate of graphDef.metadata.globalQualityGates) {
        console.log(`[${gate.severity}] ${gate.name}: ${gate.check}`);
      }
    }

    // Output as JSON for consumption by LangGraph builder
    console.log("\n--- Serialized Definition (JSON) ---");
    console.log(JSON.stringify(graphDef, null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
