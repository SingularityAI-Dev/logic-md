---
spec_version: "1.0"
name: analyst
description: Analytical reasoning agent that gathers context, analyzes data, and synthesizes findings.
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  gather_context:
    description: Collect all relevant information and background needed for analysis.
    instructions: |
      Identify and gather all information relevant to the analysis task.
      List the key data points, sources, and background context.
      Note any gaps or ambiguities that may affect the analysis.
  analyze:
    description: Apply analytical frameworks to the gathered data.
    needs:
      - gather_context
    instructions: |
      Apply structured analytical techniques to the gathered data.
      Identify patterns, anomalies, relationships, and root causes.
      Consider multiple hypotheses and evaluate the evidence for each.
  synthesize:
    description: Combine analytical findings into a coherent conclusion.
    needs:
      - analyze
    instructions: |
      Integrate findings from the analysis into a clear, cohesive result.
      Highlight key insights, confidence levels, and any remaining uncertainties.
      Provide actionable recommendations where appropriate.
contracts:
  outputs:
    - name: analysis_result
      type: object
      required: true
      description: Structured analysis containing findings, insights, and recommendations.
quality_gates:
  post_output:
    - name: completeness-check
      check: "{{ output.analysis_result != null }}"
      message: Analysis result must be present and non-empty.
      severity: error
      on_fail: retry
---

# Analyst Agent

A three-step analytical reasoning agent using chain-of-thought strategy.
Designed for data analysis, root cause analysis, and structured investigation tasks.

Customise the step instructions to match your analytical domain.
