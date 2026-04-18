---
spec_version: "1.0"
name: revise-agent
reasoning:
  strategy: cot
steps:
  draft:
    description: "Produce an initial draft of the artifact"
    instructions: "Write a structured response to the input."
  self_check:
    description: "Verify the draft against its own rubric and revise on failure"
    needs:
      - draft
    instructions: "Evaluate the draft against the quality rubric."
    verification:
      check: "{{ output.meets_rubric == true }}"
      on_fail: revise
      on_fail_message: "Draft did not meet rubric; revise using the feedback provided."
---

Tests step-level `verification.on_fail: revise` — the schema allows five values
(`retry`, `escalate`, `skip`, `abort`, `revise`); this fixture exercises
`revise`, which was previously only documented in quality-gate contexts.
