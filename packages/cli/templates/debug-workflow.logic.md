---
spec_version: "1.0"
name: debug-workflow
description: Claude Code debugging workflow that gathers context, reproduces issues using tools, diagnoses root causes, and implements verified fixes.
reasoning:
  strategy: react
  max_iterations: 8
steps:
  gather_context:
    description: Collect error messages, stack traces, and reproduction steps from the user.
    instructions: |
      Ask the user to provide: the exact error message or unexpected behavior, stack trace if available, and steps to reproduce.
      Read any referenced files, log output, or test failures the user shares.
      Clarify the expected behavior versus the actual behavior.
      Note the environment: runtime version, OS, relevant configuration.
  reproduce:
    description: Use tools to find relevant source files and attempt to reproduce the issue.
    needs:
      - gather_context
    instructions: |
      Use grep and file reading tools to locate the relevant source files mentioned in the stack trace or error.
      Trace the code path from entry point to the failure point.
      Attempt to identify the exact line or condition that triggers the issue.
      If tests exist, read the relevant test file to understand expected behavior.
      Document: which files are involved, the call chain, and the reproduction path.
  diagnose:
    description: Form and test hypotheses about the root cause by tracing code paths.
    needs:
      - reproduce
    instructions: |
      Based on reproduction findings, list candidate root causes ranked by likelihood.
      For each hypothesis: describe the evidence for and against it.
      Use grep and file reads to trace data flow, variable states, and control paths.
      Test each hypothesis: eliminate or confirm with direct code evidence.
      Document the confirmed root cause with the specific code location and why it causes the failure.
  fix_and_verify:
    description: Implement the fix, run tests, and confirm the issue is resolved.
    needs:
      - diagnose
    instructions: |
      Implement a minimal, targeted fix at the confirmed root cause location.
      Explain what the fix changes and why it resolves the issue without side effects.
      Run relevant tests using the terminal tool to verify the fix passes.
      Check for regression risks: does the fix affect any callers or related code paths?
      Suggest additional test cases to prevent recurrence of this class of bug.
contracts:
  outputs:
    - name: fix_report
      type: object
      required: true
      description: Fix report with root_cause, fix_description, files_changed, and tests_passed status.
---

# Debug Workflow Agent

A four-step Claude Code debugging agent using the ReAct strategy with up to 8 iterations.
Optimized for Claude Code's tool-use capabilities: file reading, grep, and terminal access.

Distinct from the generic `debugger` template — this workflow is specifically designed for
iterative diagnosis within Claude Code's tool-use loop.

Use with: `/logic:apply ./debug-workflow.logic.md`
