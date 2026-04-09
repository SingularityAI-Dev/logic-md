---
spec_version: "1.0"
name: generator
description: Content generation agent that outlines, drafts, and refines output to meet quality standards.
reasoning:
  strategy: cot
  max_iterations: 5
steps:
  outline:
    description: Plan the structure and key elements of the content to generate.
    instructions: |
      Understand the content brief: purpose, audience, format, and constraints.
      Create a structured outline with sections, key points, and intended flow.
      Confirm the outline meets the stated requirements before proceeding.
  draft:
    description: Generate the full content based on the approved outline.
    needs:
      - outline
    instructions: |
      Write the content following the outline structure.
      Match the required tone, voice, and style for the target audience.
      Prioritise clarity, accuracy, and coherence.
  refine:
    description: Polish the draft to meet quality standards.
    needs:
      - draft
    instructions: |
      Review the draft for errors, inconsistencies, and weak sections.
      Improve clarity, flow, and engagement.
      Verify the content fulfils the original brief and quality criteria.
contracts:
  outputs:
    - name: generated_content
      type: string
      required: true
      description: The final refined content ready for use.
quality_gates:
  post_output:
    - name: quality-check
      check: "{{ output.generated_content != null && output.generated_content.length > 0 }}"
      message: Generated content must be non-empty.
      severity: error
      on_fail: retry
---

# Generator Agent

A three-step content generation agent using chain-of-thought reasoning.
Suitable for writing, code generation, report drafting, and creative content tasks.

Customise the `outline` step with your content domain, format requirements, and style guide.
