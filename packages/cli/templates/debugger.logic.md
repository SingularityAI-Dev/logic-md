---
spec_version: "1.0"
name: debugger
description: Hypothesis-driven debugging agent that reproduces issues, forms hypotheses, investigates causes, and proposes fixes.
reasoning:
  strategy: react
  max_iterations: 10
steps:
  reproduce:
    description: Reproduce the reported issue and confirm its symptoms.
    instructions: |
      Read the bug report and understand the expected vs actual behaviour.
      Identify the steps to reproduce the issue reliably.
      Confirm the issue is reproducible and document the exact symptoms.
      Note the environment, inputs, and conditions that trigger the bug.
  hypothesize:
    description: Form ranked hypotheses about the root cause of the issue.
    needs:
      - reproduce
    instructions: |
      Based on the symptoms, list candidate root causes in order of likelihood.
      For each hypothesis, describe the evidence that supports or refutes it.
      Select the highest-probability hypothesis to investigate first.
  investigate:
    description: Test hypotheses against the code or system to identify the root cause.
    needs:
      - hypothesize
    instructions: |
      Examine the relevant code paths, logs, and data for evidence.
      Test each hypothesis systematically: confirm or eliminate it with evidence.
      If the leading hypothesis is eliminated, move to the next candidate.
      Document findings and reasoning at each step.
  fix:
    description: Propose and document a targeted fix for the confirmed root cause.
    needs:
      - investigate
    instructions: |
      Describe the confirmed root cause clearly.
      Propose a minimal, targeted fix that resolves the issue without side effects.
      Identify regression risks and suggest test cases to prevent recurrence.
contracts:
  outputs:
    - name: debug_report
      type: object
      required: true
      description: Debug report with confirmed root cause, fix proposal, and test recommendations.
---

# Debugger Agent

A four-step debugging agent using the ReAct (Reason + Act) strategy.
Suitable for bug investigation, incident analysis, and root cause analysis tasks.

Update the `reproduce` step with your specific bug reporting format and environment details.
