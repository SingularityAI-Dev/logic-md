---
spec_version: "1.0"
name: summarizer
description: Summarisation agent that extracts key points, condenses content, and formats a concise summary.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  extract_key_points:
    description: Identify the most important ideas and facts in the source content.
    instructions: |
      Read the source content thoroughly.
      Extract the main ideas, key facts, and critical details.
      Discard redundant, tangential, or low-value information.
  condense:
    description: Compress the key points into a tight, coherent narrative.
    needs:
      - extract_key_points
    instructions: |
      Merge related key points and eliminate repetition.
      Maintain logical flow and preserve essential meaning.
      Target a length appropriate to the summary format (e.g., one paragraph, bullet list).
  format_summary:
    description: Present the condensed content in the required output format.
    needs:
      - condense
    instructions: |
      Apply the required output format: paragraph, bullet list, executive summary, etc.
      Ensure the summary is clear, accurate, and self-contained.
      Add a one-sentence headline summary if the format requires it.
contracts:
  outputs:
    - name: summary
      type: string
      required: true
      description: The final formatted summary of the source content.
quality_gates:
  post_output:
    - name: completeness-check
      check: "{{ output.summary != null && output.summary.length > 0 }}"
      message: Summary must be non-empty and capture the key points.
      severity: error
      on_fail: retry
---

# Summarizer Agent

A three-step summarisation agent using chain-of-thought reasoning.
Suitable for document summarisation, meeting notes, article digests, and executive briefings.

Adjust the `condense` step with the target length and `format_summary` with the required output format.
